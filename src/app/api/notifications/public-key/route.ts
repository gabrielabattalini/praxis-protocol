import { NextResponse } from "next/server";
import { getNotificationPublicKey } from "@/lib/notification-center.server";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({
      publicKey: getNotificationPublicKey(),
    });
  } catch {
    return NextResponse.json(
      {
        error: "Não foi possível carregar a chave pública de notificações.",
      },
      { status: 500 },
    );
  }
}
