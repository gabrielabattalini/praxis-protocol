import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  answerCallbackQuery,
  bindTelegramChat,
  consumeTelegramLinkCode,
  editMessageReplyMarkup,
  getTelegramBinding,
  getTelegramWebhookSecret,
  getUserIdByChatId,
  markTelegramUpdateProcessed,
  sendTelegramMessage,
} from "@/lib/telegram-center.server";
import {
  completeMealBlockForUser,
  completeTaskForUser,
  completeWorkoutDayForUser,
} from "@/lib/telegram-actions.server";
import {
  TELEGRAM_SNOOZE_MINUTES,
  snoozeNotification,
} from "@/lib/notification-center.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramUpdate = {
  update_id?: number;
  message?: {
    chat?: { id?: number; type?: string };
    from?: {
      id?: number;
      username?: string;
      first_name?: string;
    };
    text?: string;
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: {
      chat?: { id?: number };
      message_id?: number;
    };
    from?: { id?: number };
  };
};

/**
 * Telegram calls this endpoint (configured via setWebhook). It is a
 * PUBLIC route — Telegram has no Clerk session — so it is protected by
 * the secret token Telegram echoes back in this header on every call.
 *
 * Always returns 200 quickly; Telegram retries non-2xx responses.
 */
export async function POST(request: Request) {
  const expectedSecret = getTelegramWebhookSecret();
  const providedSecret = request.headers.get(
    "x-telegram-bot-api-secret-token",
  );

  // Fail-CLOSED: sem segredo configurado o webhook não pode aceitar updates.
  // Antes o `expectedSecret &&` short-circuitava e qualquer um conseguia
  // forjar updates (incluindo callback_query com chat.id arbitrário) e
  // mexer no estado da conta correspondente.
  if (!expectedSecret) {
    console.error(
      "[telegram-webhook] TELEGRAM_WEBHOOK_SECRET ausente — recusando update",
    );
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // Comparação em tempo constante (evita timing oracle no segredo).
  const secretOk =
    typeof providedSecret === "string" &&
    crypto.timingSafeEqual(
      crypto.createHash("sha256").update(providedSecret).digest(),
      crypto.createHash("sha256").update(expectedSecret).digest(),
    );
  if (!secretOk) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Proteção contra replay: cada update do Telegram tem um update_id
  // único. Se já processamos esse id (7 dias de janela), ignora — evita
  // re-disparar ações se o secret + body vazarem e forem reenviados.
  if (typeof update.update_id === "number") {
    const isNew = await markTelegramUpdateProcessed(update.update_id);
    if (!isNew) {
      return NextResponse.json({ ok: true });
    }
  }

  // Inline button callback ("✓ Concluir" abaixo dos lembretes).
  // Sempre responde 200; falhas viram um toast curto pra quem clicou.
  if (update.callback_query) {
    const cb = update.callback_query;
    const cbChatId = cb.message?.chat?.id;
    const cbMessageId = cb.message?.message_id;
    const data = cb.data ?? "";
    const cbFromId = cb.from?.id;

    console.info(
      `[telegram-webhook] callback chat=${cbChatId} from=${cbFromId} data=${data}`,
    );

    if (!cbChatId) {
      await answerCallbackQuery(cb.id, "Chat inválido.");
      return NextResponse.json({ ok: true });
    }

    const userId = await getUserIdByChatId(cbChatId);
    if (!userId) {
      await answerCallbackQuery(cb.id, "Conta não vinculada — reconecte no app.");
      return NextResponse.json({ ok: true });
    }

    // Confere que quem clicou bate com o dono do binding. Se o
    // telegramUserId do binding existe e NÃO bate com quem clicou, é
    // outra pessoa (ex.: bot adicionado a um grupo, ou binding antigo
    // num chat reusado) — recusa em vez de marcar a tarefa na conta
    // errada. (#7 da auditoria: antes só logava e deixava passar.)
    const binding = await getTelegramBinding(userId);
    // Quando o binding tem telegramUserId, EXIGE que o clique tenha
    // from.id presente E igual. Antes a checagem só rodava se cbFromId
    // existisse — um callback sem from.id pulava o controle. Agora, se o
    // binding conhece o dono, um clique sem from.id (ou divergente) é
    // recusado.
    if (
      binding?.telegramUserId &&
      (!cbFromId || binding.telegramUserId !== cbFromId)
    ) {
      console.warn(
        `[telegram-webhook] from.id mismatch: binding=${binding.telegramUserId} cb=${cbFromId} userId=${userId} — recusando`,
      );
      await answerCallbackQuery(cb.id, "Sessão de Telegram inválida.");
      return NextResponse.json({ ok: true });
    }

    let result: { ok: boolean; message: string };
    let snoozed = false;
    if (data.startsWith("t:")) {
      result = await completeTaskForUser(userId, data.slice("t:".length));
    } else if (data.startsWith("mb:")) {
      result = await completeMealBlockForUser(userId, data.slice("mb:".length));
    } else if (data.startsWith("wd:")) {
      // Workout day completion: marca o dia inteiro como feito.
      result = await completeWorkoutDayForUser(userId, data.slice("wd:".length));
    } else if (data.startsWith("sz:")) {
      // Adiar: agenda um re-disparo em N min. O título/corpo são
      // resolvidos do schedule no momento do re-disparo (processUserSnoozes),
      // então não precisamos carregá-los aqui.
      const itemId = data.slice("sz:".length);
      try {
        await snoozeNotification(userId, {
          itemId,
          minutes: TELEGRAM_SNOOZE_MINUTES,
        });
        snoozed = true;
        result = {
          ok: true,
          message: `⏰ Adiado ${TELEGRAM_SNOOZE_MINUTES} min.`,
        };
      } catch {
        result = { ok: false, message: "Não consegui adiar agora." };
      }
    } else if (data === "noop") {
      // Clique no botão "✓ Concluído" (já marcado num clique anterior).
      // Só confirma — não há mais nada a fazer.
      result = { ok: false, message: "✓ Já concluído." };
    } else {
      result = { ok: false, message: "Ação desconhecida." };
    }

    console.info(
      `[telegram-webhook] action result userId=${userId} ok=${result.ok} msg="${result.message}"`,
    );

    await answerCallbackQuery(cb.id, result.message);

    // Substitui o botão por um rótulo indelével pra evitar cliques
    // duplicados / confusão visual. "✓ Concluído" pra conclusão,
    // "⏰ Adiado N min" pro adiamento. Botão sem ação real (noop).
    if (result.ok && cbMessageId) {
      const label = snoozed
        ? `⏰ Adiado ${TELEGRAM_SNOOZE_MINUTES} min`
        : "✓ Concluído";
      try {
        await editMessageReplyMarkup(cbChatId, cbMessageId, [
          [{ text: label, callback_data: "noop" }],
        ]);
      } catch {
        /* swallow — alteração visual é opcional */
      }
    }

    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  const chatId = message?.chat?.id;
  const text = message?.text?.trim() ?? "";

  if (!chatId) {
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith("/start")) {
    // Recusa vincular em chats que não sejam privados 1:1. Se o usuário
    // adicionar o bot a um grupo e mandar /start lá, o binding ficaria
    // com o chatId do GRUPO — qualquer membro receberia os lembretes e
    // poderia marcar tarefas. (#7b da auditoria.)
    if (message?.chat?.type && message.chat.type !== "private") {
      await sendTelegramMessage(
        chatId,
        "Conecte o Praxis no chat privado com o bot, não em um grupo. Abra a conversa 1:1 e tente de novo.",
      );
      return NextResponse.json({ ok: true });
    }

    const code = text.split(/\s+/)[1]?.trim();

    if (!code) {
      await sendTelegramMessage(
        chatId,
        [
          "<b>Praxis Protocol</b>",
          "",
          "Para conectar este Telegram à sua conta, abra o app, vá em",
          "<b>Configurações → Notificações</b> e toque em",
          "<b>Conectar Telegram</b>.",
        ].join("\n"),
        { html: true },
      );
      return NextResponse.json({ ok: true });
    }

    const userId = await consumeTelegramLinkCode(code);

    if (!userId) {
      await sendTelegramMessage(
        chatId,
        "Este link de conexão expirou. Gere um novo no app em Configurações → Notificações.",
      );
      return NextResponse.json({ ok: true });
    }

    await bindTelegramChat(userId, {
      chatId,
      telegramUserId: message?.from?.id,
      username: message?.from?.username,
      firstName: message?.from?.first_name,
      linkedAt: new Date().toISOString(),
    });

    await sendTelegramMessage(
      chatId,
      [
        "<b>✅ Conectado!</b>",
        "",
        "Seu Telegram está vinculado ao Praxis Protocol.",
        "Você receberá aqui seus lembretes de tarefas, hábitos e eventos.",
      ].join("\n"),
      { html: true },
    );

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
