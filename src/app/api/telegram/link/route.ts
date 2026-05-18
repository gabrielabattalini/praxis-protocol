import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  createTelegramLinkCode,
  isTelegramConfigured,
} from "@/lib/telegram-center.server";

export const runtime = "nodejs";

export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!isTelegramConfigured()) {
    return NextResponse.json(
      { error: "Bot do Telegram ainda não configurado no servidor." },
      { status: 503 },
    );
  }

  const { code, url, botUsername } = await createTelegramLinkCode(userId);

  if (!url) {
    return NextResponse.json(
      { error: "Não foi possível resolver o usuário do bot." },
      { status: 502 },
    );
  }

  return NextResponse.json({ code, url, botUsername });
}
