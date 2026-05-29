import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { syncNotificationSchedule } from "@/lib/notification-center.server";
import type { NotificationSyncPayload } from "@/lib/notification-schedule";
import type { ModuleId, ReminderEntityType } from "@/lib/types";
import {
  PayloadTooLargeError,
  readJsonWithLimit,
} from "@/lib/security/request-body";

export const runtime = "nodejs";

const NOTIFICATION_SYNC_MAX_BYTES = 250_000;

const weekdaySchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

const moduleIdValues = [
  "run",
  "workout",
  "work",
  "nutrition",
  "finance",
  "appearance",
  "recovery",
  "health",
  "mind",
  "sleep",
  "home",
  "market",
  "supplements",
] as const satisfies readonly ModuleId[];

const reminderEntityTypeValues = [
  "task",
  "meal",
  "supplement",
  "workout",
  "cardio",
] as const satisfies readonly ReminderEntityType[];

const notificationScheduleItemSchema = z.object({
  id: z.string().trim().min(1).max(200),
  source: z.enum(["task", "reminder", "meal", "workout"]),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(500),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  route: z.string().trim().min(1).max(200),
  moduleId: z.enum(moduleIdValues).nullable().optional(),
  entityType: z.enum(reminderEntityTypeValues).optional(),
  entityId: z.string().trim().min(1).max(160).optional(),
  enabled: z.boolean(),
  weekdays: z.array(weekdaySchema).max(7).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  intervalDays: z.number().int().min(1).max(366).optional(),
  anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const notificationSyncSchema = z.object({
  timezone: z.string().trim().min(1).max(80),
  syncedAt: z.string().trim().min(1).max(80).optional(),
  items: z.array(notificationScheduleItemSchema).max(512),
  customQuotes: z.array(z.string().trim().min(1).max(280)).max(100).optional(),
  hiddenQuotes: z.array(z.string().trim().min(1).max(280)).max(200).optional(),
});

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const body = notificationSyncSchema.parse(
      await readJsonWithLimit<NotificationSyncPayload>(
        request,
        NOTIFICATION_SYNC_MAX_BYTES,
      ),
    );

    const status = await syncNotificationSchedule(userId, {
      timezone: body.timezone,
      syncedAt: body.syncedAt || new Date().toISOString(),
      items: body.items,
    });

    return NextResponse.json(status);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json(
        { error: "Carga de sincronização maior do que o permitido." },
        { status: 413 },
      );
    }

    return NextResponse.json(
      { error: "Carga de sincronização inválida." },
      { status: 400 },
    );
  }
}
