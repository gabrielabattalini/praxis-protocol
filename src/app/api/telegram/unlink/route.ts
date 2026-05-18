import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unlinkTelegram } from "@/lib/telegram-center.server";

export const runtime = "nodejs";

export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  await unlinkTelegram(userId);
  return NextResponse.json({ ok: true });
}
