import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { snoozeNotification } from "@/lib/notification-center.server";
import {
  PayloadTooLargeError,
  readJsonWithLimit,
} from "@/lib/security/request-body";

export const runtime = "nodejs";

const MAX_BYTES = 4_000;

const snoozeSchema = z.object({
  itemId: z.string().trim().min(1).max(200),
  minutes: z.number().int().min(1).max(180),
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(500).optional(),
});

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const raw = await readJsonWithLimit<unknown>(request, MAX_BYTES);
    const parsed = snoozeSchema.parse(raw);
    const result = await snoozeNotification(userId, parsed);
    return NextResponse.json({ ok: true, fireAt: result.fireAt });
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: "Payload muito grande." }, { status: 413 });
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível adiar o lembrete.",
      },
      { status: 400 },
    );
  }
}
