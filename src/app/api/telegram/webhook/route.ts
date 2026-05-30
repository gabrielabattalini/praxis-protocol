import { NextResponse } from "next/server";
import {
  answerCallbackQuery,
  bindTelegramChat,
  consumeTelegramLinkCode,
  editMessageReplyMarkup,
  getTelegramBinding,
  getTelegramWebhookSecret,
  getUserIdByChatId,
  sendTelegramMessage,
} from "@/lib/telegram-center.server";
import {
  completeMealBlockForUser,
  completeTaskForUser,
} from "@/lib/telegram-actions.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramUpdate = {
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

  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Inline button callback ("✓ Concluir" abaixo dos lembretes).
  // Sempre responde 200; falhas viram um toast curto pra quem clicou.
  if (update.callback_query) {
    const cb = update.callback_query;
    const cbChatId = cb.message?.chat?.id;
    const cbMessageId = cb.message?.message_id;
    const data = cb.data ?? "";

    if (!cbChatId) {
      await answerCallbackQuery(cb.id, "Chat inválido.");
      return NextResponse.json({ ok: true });
    }

    const userId = await getUserIdByChatId(cbChatId);
    if (!userId) {
      await answerCallbackQuery(cb.id, "Conta não vinculada — reconecte no app.");
      return NextResponse.json({ ok: true });
    }

    // Confere que quem clicou é o dono do binding. Sem isso, se outra
    // pessoa tiver acesso ao mesmo chat (grupo) ou o secret for vazado,
    // dá pra forjar callback_query com chat.id de outro usuário.
    const cbFromId = cb.from?.id;
    const binding = await getTelegramBinding(userId);
    if (
      binding?.telegramUserId &&
      cbFromId &&
      binding.telegramUserId !== cbFromId
    ) {
      await answerCallbackQuery(cb.id, "Apenas o dono da conta pode concluir.");
      return NextResponse.json({ ok: true });
    }

    let result: { ok: boolean; message: string };
    if (data.startsWith("t:")) {
      result = await completeTaskForUser(userId, data.slice("t:".length));
    } else if (data.startsWith("mb:")) {
      result = await completeMealBlockForUser(userId, data.slice("mb:".length));
    } else {
      result = { ok: false, message: "Ação desconhecida." };
    }

    await answerCallbackQuery(cb.id, result.message);

    // Substitui o botão por "✓ Concluído" indelével pra evitar cliques
    // duplicados / confusão visual. Mesmo formato: 1 linha, 1 botão sem
    // callback_data (texto puro fica como rótulo desabilitado de fato).
    if (result.ok && cbMessageId) {
      try {
        await editMessageReplyMarkup(cbChatId, cbMessageId, [
          [{ text: "✓ Concluído", callback_data: "noop" }],
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
