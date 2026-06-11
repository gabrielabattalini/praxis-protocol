import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { sendTestNotification } from "@/lib/notification-center.server";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const limited = await enforceRateLimit("notif-test", userId, 5, 60);
  if (limited) return limited;

  const result = await sendTestNotification(userId);
  return NextResponse.json(result);
}
