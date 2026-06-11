import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { sendTelegramTest } from "@/lib/telegram-center.server";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const limited = await enforceRateLimit("telegram-test", userId, 5, 60);
  if (limited) return limited;

  const result = await sendTelegramTest(userId);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Falha ao enviar o teste." },
      { status: result.skipped ? 409 : 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
