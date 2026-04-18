import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getNotificationStatus } from "@/lib/notification-center.server";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  return NextResponse.json(getNotificationStatus(userId));
}
