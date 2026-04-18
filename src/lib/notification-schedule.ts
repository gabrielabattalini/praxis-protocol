import { buildNotificationBodyWithCue } from "@/lib/discipline-cues";
import type {
  ModuleId,
  ReminderEntityType,
  ReminderItem,
  Task,
  TaskRecurrence,
  Weekday,
} from "@/lib/types";

export type NotificationScheduleSource = "task" | "reminder";

export interface NotificationScheduleItem {
  id: string;
  source: NotificationScheduleSource;
  title: string;
  body: string;
  time: string;
  route: string;
  moduleId?: ModuleId | null;
  entityType?: ReminderEntityType | "task";
  entityId?: string;
  enabled: boolean;
  weekdays?: Weekday[];
  dayOfMonth?: number;
  intervalDays?: number;
  anchorDate?: string;
}

export interface NotificationSyncPayload {
  timezone: string;
  syncedAt: string;
  items: NotificationScheduleItem[];
}

export const notificationRouteByModuleId: Record<ModuleId, string> = {
  run: "/modules/run",
  workout: "/modules/workout",
  work: "/modules/work",
  nutrition: "/modules/nutrition",
  finance: "/modules/finance",
  appearance: "/modules/appearance",
  recovery: "/modules/recovery",
  health: "/modules/health",
  mind: "/modules/mind",
  sleep: "/modules/sleep",
  home: "/modules/home",
  market: "/modules/market",
  supplements: "/modules/supplements",
};

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTime(value: string | undefined) {
  if (!value) return "";
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function allWeekdays(): Weekday[] {
  return [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
}

function recurrenceToSchedule(
  recurrence: TaskRecurrence,
  fallbackAnchorDate: string,
) {
  switch (recurrence.kind) {
    case "daily":
      return { weekdays: allWeekdays() };
    case "selected-weekdays":
      return recurrence.weekdays?.length ? { weekdays: recurrence.weekdays } : null;
    case "weekly-fixed":
      return recurrence.weekday ? { weekdays: [recurrence.weekday] } : null;
    case "monthly":
      return recurrence.dayOfMonth ? { dayOfMonth: recurrence.dayOfMonth } : null;
    case "interval-days":
      return recurrence.intervalDays
        ? {
            intervalDays: recurrence.intervalDays,
            anchorDate: fallbackAnchorDate,
          }
        : null;
    case "one-time":
      return fallbackAnchorDate ? { anchorDate: fallbackAnchorDate } : null;
    case "times-per-week":
    default:
      return null;
  }
}

function taskNotificationId(task: Task) {
  return `task:${task.sourceKey || task.id}`;
}

function reminderNotificationId(reminder: ReminderItem) {
  return `reminder:${reminder.entityType}:${reminder.entityId}:${reminder.time}`;
}

function reminderRoute(reminder: ReminderItem) {
  if (reminder.entityType === "meal" || reminder.entityType === "supplement") {
    return "/modules/nutrition";
  }

  if (reminder.entityType === "workout") {
    return "/modules/workout";
  }

  if (reminder.entityType === "cardio") {
    return "/modules/run";
  }

  return "/tasks";
}

export function buildNotificationSyncPayload(
  tasks: Task[],
  reminders: ReminderItem[],
  timezone: string,
): NotificationSyncPayload {
  const syncedAt = new Date().toISOString();
  const todayKey = localDateKey();
  const reminderTaskIds = new Set(
    reminders
      .filter((reminder) => reminder.entityType === "task")
      .map((reminder) => reminder.entityId),
  );

  const taskItems = tasks
    .filter((task) => Boolean(task.scheduledTime))
    .filter((task) => !task.completed)
    .filter((task) => !reminderTaskIds.has(task.id))
    .map<NotificationScheduleItem | null>((task) => {
      const time = normalizeTime(task.scheduledTime);
      const route = task.moduleId ? notificationRouteByModuleId[task.moduleId] : "/tasks";
      const schedule = recurrenceToSchedule(
        task.recurrence,
        task.deferUntilDate || todayKey,
      );

      if (!time || !schedule) {
        return null;
      }

      return {
        id: taskNotificationId(task),
        source: "task" as const,
        title: task.title,
        body: buildNotificationBodyWithCue({
          title: task.title,
          body: task.description || "Tarefa pronta para execução no Praxis.",
          moduleId: task.moduleId,
          entityType: "task",
          route,
        }),
        time,
        route,
        moduleId: task.moduleId,
        entityType: "task" as const,
        entityId: task.id,
        enabled: true,
        ...schedule,
      };
    })
    .filter((item): item is NotificationScheduleItem => item !== null);

  const reminderItems = reminders
    .map<NotificationScheduleItem | null>((reminder) => {
      const time = normalizeTime(reminder.time);

      if (!time) {
        return null;
      }

      const route = reminderRoute(reminder);

      return {
        id: reminderNotificationId(reminder),
        source: "reminder" as const,
        title: reminder.title,
        body: buildNotificationBodyWithCue({
          title: reminder.title,
          body: reminder.note?.trim() || "Lembrete pronto para execução no Praxis.",
          entityType: reminder.entityType,
          route,
        }),
        time,
        route,
        entityType: reminder.entityType,
        entityId: reminder.entityId,
        enabled: reminder.enabled,
        weekdays: reminder.weekdays?.length ? reminder.weekdays : allWeekdays(),
      };
    })
    .filter((item): item is NotificationScheduleItem => item !== null);

  return {
    timezone,
    syncedAt,
    items: [...taskItems, ...reminderItems],
  };
}
