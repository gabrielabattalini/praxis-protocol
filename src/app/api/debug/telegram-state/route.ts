import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAccountState } from "@/lib/account-state.server";
import {
  getNotificationScheduleSnapshot,
  getUserTimezone,
} from "@/lib/notification-center.server";
import type { PersistedState, Task } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico do que o bot do Telegram enxerga do estado do usuário.
 * Autenticado pelo Clerk (não está em isPublicRoute). Retorna SÓ o que
 * importa pra debugar conclusão por callback — sem dados sensíveis.
 *
 * Como usar: abra https://praxis-protocol.vercel.app/api/debug/telegram-state
 * no browser logado e copie o JSON.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 });
  }

  const envelope = await getAccountState(userId);
  if (!envelope) {
    return NextResponse.json({
      userId,
      accountState: null,
      note: "Sem account-state no servidor — o app nunca sincronizou ou o KV está vazio.",
    });
  }

  const timezone = await getUserTimezone(userId);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const todayKey = `${get("year")}-${get("month")}-${get("day")}`;

  const state = envelope.state as PersistedState;
  const tasks = state.tasks ?? [];
  const mealPlan = state.mealPlan ?? [];

  // Foco nas tasks de aparência (caso "banho") + qualquer task com
  // "banho"/"intra" no título pra diagnóstico direcionado.
  const appearanceTasks = tasks.filter((t) => t.moduleId === "appearance");
  const matchingTasks = tasks.filter((t) =>
    /banho|intra|hidrat/i.test(t.title),
  );

  const slimTask = (t: Task) => ({
    id: t.id,
    sourceKey: t.sourceKey,
    title: t.title,
    moduleId: t.moduleId,
    scheduledTime: t.scheduledTime,
    completed: t.completed,
    completedAt: t.completedAt,
    completedDates: t.completedDates,
    recurrenceKind: t.recurrence?.kind,
  });

  // Reminders pra ver qual entityId está virando o callback.
  const reminders = (state.reminders ?? []).map((r) => ({
    id: r.id,
    entityType: r.entityType,
    entityId: r.entityId,
    title: r.title,
    time: r.time,
    enabled: r.enabled,
  }));

  // Blocks com itens e completedDates.
  const blocks = mealPlan.map((b) => ({
    id: b.id,
    title: b.title,
    time: b.time,
    items: b.items.map((it) => ({
      id: it.id,
      label: it.label,
      completedAt: it.completedAt,
      completedDates: it.completedDates,
    })),
  }));

  return NextResponse.json({
    userId,
    serverNow: new Date().toISOString(),
    timezone,
    todayKey,
    accountStateUpdatedAt: envelope.updatedAt,
    counts: {
      tasks: tasks.length,
      appearanceTasks: appearanceTasks.length,
      blocks: mealPlan.length,
      reminders: reminders.length,
    },
    appearanceTasks: appearanceTasks.map(slimTask),
    matchingByTitle: matchingTasks.map(slimTask),
    blocks,
    reminders,
    allTaskIds: tasks.map((t) => t.id),
    allTaskSourceKeys: tasks
      .map((t) => t.sourceKey)
      .filter((k): k is string => Boolean(k)),
    // Snapshot do schedule armazenado pelo servidor — é o que o cron
    // itera pra disparar. Útil pra diagnosticar quando uma notificação
    // dispara sem botão (entityType/entityId ausentes ou inválidos).
    schedule: await (async () => {
      const snap = await getNotificationScheduleSnapshot(userId);
      if (!snap) return null;
      return {
        timezone: snap.timezone,
        syncedAt: snap.syncedAt,
        itemCount: snap.items.length,
        items: snap.items.map((item) => ({
          id: item.id,
          title: item.title,
          time: item.time,
          entityType: item.entityType,
          entityId: item.entityId,
          enabled: item.enabled,
          source: item.source,
          weekdays: item.weekdays,
        })),
      };
    })(),
  });
}
