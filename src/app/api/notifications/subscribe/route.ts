import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { subscribeUserToNotifications } from "@/lib/notification-center.server";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const bodySchema = z.object({
  subscription: subscriptionSchema,
  deviceLabel: z.string().trim().min(1).max(80).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  userAgent: z.string().trim().min(1).max(400).optional(),
});

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const limited = await enforceRateLimit("notif-subscribe", userId, 20, 60);
  if (limited) return limited;

  try {
    const body = bodySchema.parse(await request.json());
    const status = await subscribeUserToNotifications(
      userId,
      body.subscription,
      {
        deviceLabel: body.deviceLabel,
        timezone: body.timezone,
        userAgent: body.userAgent,
      },
    );

    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível salvar a assinatura de notificações.",
      },
      { status: 400 },
    );
  }
}
