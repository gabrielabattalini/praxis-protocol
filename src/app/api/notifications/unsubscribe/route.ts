import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { unsubscribeUserFromNotifications } from "@/lib/notification-center.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = (await request.json()) as {
    endpoint?: string;
  };

  const status = unsubscribeUserFromNotifications(userId, body.endpoint);
  return NextResponse.json(status);
}
