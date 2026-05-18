import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getTelegramStatus } from "@/lib/telegram-center.server";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const status = await getTelegramStatus(userId);
  return NextResponse.json(status);
}
