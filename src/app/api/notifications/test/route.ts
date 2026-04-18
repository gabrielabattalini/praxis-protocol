import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { sendTestNotification } from "@/lib/notification-center.server";

export const runtime = "nodejs";

export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const result = await sendTestNotification(userId);
  return NextResponse.json(result);
}
