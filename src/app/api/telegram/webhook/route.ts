import { NextResponse } from "next/server";
import {
  bindTelegramChat,
  consumeTelegramLinkCode,
  getTelegramWebhookSecret,
  sendTelegramMessage,
} from "@/lib/telegram-center.server";

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

  if (expectedSecret && providedSecret !== expectedSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
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
