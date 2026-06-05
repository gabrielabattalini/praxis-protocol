import { buildNotificationBodyWithCue } from "@/lib/discipline-cues";
import { isTaskDueForDate } from "@/lib/utils";
import type {
  MealPlanBlock,
  ModuleId,
  ReminderEntityType,
  ReminderItem,
  Task,
  TaskRecurrence,
  Weekday,
} from "@/lib/types";

export type NotificationScheduleSource = "task" | "reminder" | "meal" | "workout";

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
  // Frases personalizadas do usuário (texto pronto, já com "— autor"
  // quando houver). Anexadas aos lembretes do Telegram junto das nativas.
  customQuotes?: string[];
  // Textos das frases NATIVAS que o usuário escondeu — o dispatch as
  // remove do pool antes de anexar uma frase ao lembrete.
  hiddenQuotes?: string[];
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

// Subtrai N minutos do time "HH:MM". Retorna "" se cruzaria a meia-noite
// (não dá pra agendar um pre-warn de hoje pra ontem com o modelo atual).
function offsetTimeBackward(time: string, minutes: number): string {
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return "";
  const totalMin = Number(match[1]) * 60 + Number(match[2]) - minutes;
  if (totalMin < 0) return "";
  const h = String(Math.floor(totalMin / 60)).padStart(2, "0");
  const m = String(totalMin % 60).padStart(2, "0");
  return `${h}:${m}`;
}

// 5min de pre-warning antes do horário marcado. Adiciona um schedule item
// extra com id ":pre5" pra cada task/reminder. O title indica que é aviso
// antecipado. dispatchKey por dia já garante dedup entre os dois disparos.
const PRE_WARNING_MINUTES = 5;

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

// Data (YYYY-MM-DD) da conclusão mais recente da task — considera tanto
// completedAt (toggle do módulo/missões) quanto completedDates (toggle
// por data no calendário). Usada pra ancorar tarefas interval-days no
// ciclo correto.
function latestCompletionKey(task: Task): string | null {
  const keys: string[] = [];
  if (task.completedAt) {
    const parsed = new Date(task.completedAt);
    if (!Number.isNaN(parsed.getTime())) keys.push(localDateKey(parsed));
  }
  if (task.completedDates?.length) {
    keys.push(...task.completedDates);
  }
  if (keys.length === 0) return null;
  return keys.sort().at(-1) ?? null;
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
  mealPlan: MealPlanBlock[] = [],
  customQuotes: string[] = [],
  hiddenQuotes: string[] = [],
): NotificationSyncPayload {
  const syncedAt = new Date().toISOString();
  const todayKey = localDateKey();
  const reminderTaskIds = new Set(
    reminders
      .filter((reminder) => reminder.entityType === "task")
      .map((reminder) => reminder.entityId),
  );
  // Reminders manuais já cobrem blocos específicos — evitar 2 schedules
  // pro mesmo bloco se o usuário criou um reminder explícito.
  const reminderMealIds = new Set(
    reminders
      .filter((reminder) => reminder.entityType === "meal" || reminder.entityType === "supplement")
      .map((reminder) => reminder.entityId),
  );

  const taskItems = tasks
    .filter((task) => Boolean(task.scheduledTime))
    .filter((task) => !task.completed)
    .filter((task) => !reminderTaskIds.has(task.id))
    // interval-days só entra no schedule quando está DUE HOJE — mesma
    // regra de Missões (isTaskDueForDate). Sem isto, uma tarefa de ciclo
    // longo (ex.: "consulta odontológica a cada 180 dias") já concluída
    // continuava notificando: o schedule fica em cache no servidor com um
    // anchorDate defasado e o cron disparava no marco dos 180 dias do
    // anchor antigo, mesmo a tarefa já tendo sido refeita. Filtrando por
    // due-ness, notificação e Missões ficam consistentes e schedules
    // antigos se auto-corrigem no próximo sync.
    //
    // Só interval-days: a due-ness dele PERSISTE (vence em
    // completedAt+intervalDays e segue vencido todo dia até refazer),
    // então qualquer sync após vencer reinclui a tarefa. monthly/
    // weekly/daily usam dia absoluto (sem drift) e NÃO podem ser
    // filtrados — senão só disparariam se o sync caísse no dia exato.
    .filter((task) => {
      if (task.recurrence.kind === "interval-days") {
        return isTaskDueForDate(task);
      }
      return true;
    })
    .flatMap<NotificationScheduleItem>((task) => {
      const time = normalizeTime(task.scheduledTime);
      const route = task.moduleId ? notificationRouteByModuleId[task.moduleId] : "/tasks";
      // Interval-days ancora na ÚLTIMA conclusão — não no dia do sync.
      // Antes o anchor virava todayKey a cada sincronização, e como o
      // dispatch dispara quando diffDays % intervalDays === 0, dava 0 %
      // N === 0 TODO dia → tarefas como "consulta odontológica a cada
      // 180 dias" notificavam diariamente mesmo já concluídas. Ancorando
      // na conclusão, o próximo disparo cai em conclusão + intervalDays
      // (uma vez por ciclo). Nunca concluída → cai no anchor padrão
      // (hoje) = vence agora.
      const completionKey =
        task.recurrence.kind === "interval-days"
          ? latestCompletionKey(task)
          : null;
      const schedule = recurrenceToSchedule(
        task.recurrence,
        completionKey || task.deferUntilDate || todayKey,
      );

      if (!time || !schedule) {
        return [];
      }

      const baseId = taskNotificationId(task);
      const description = task.description || "Tarefa pronta para execução no Praxis.";

      const onTimeItem: NotificationScheduleItem = {
        id: baseId,
        source: "task" as const,
        title: task.title,
        body: buildNotificationBodyWithCue({
          title: task.title,
          body: description,
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

      const preTime = offsetTimeBackward(time, PRE_WARNING_MINUTES);
      if (!preTime) return [onTimeItem];

      const preItem: NotificationScheduleItem = {
        ...onTimeItem,
        id: `${baseId}:pre${PRE_WARNING_MINUTES}`,
        title: `⏰ Em ${PRE_WARNING_MINUTES} min: ${task.title}`,
        body: buildNotificationBodyWithCue({
          title: task.title,
          body: `Faltam ${PRE_WARNING_MINUTES} minutos. ${description}`,
          moduleId: task.moduleId,
          entityType: "task",
          route,
        }),
        time: preTime,
      };

      return [preItem, onTimeItem];
    });

  const reminderItems = reminders
    .flatMap<NotificationScheduleItem>((reminder) => {
      const time = normalizeTime(reminder.time);

      if (!time) {
        return [];
      }

      const route = reminderRoute(reminder);
      const baseId = reminderNotificationId(reminder);
      const description = reminder.note?.trim() || "Lembrete pronto para execução no Praxis.";

      const onTimeItem: NotificationScheduleItem = {
        id: baseId,
        source: "reminder" as const,
        title: reminder.title,
        body: buildNotificationBodyWithCue({
          title: reminder.title,
          body: description,
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

      const preTime = offsetTimeBackward(time, PRE_WARNING_MINUTES);
      if (!preTime) return [onTimeItem];

      const preItem: NotificationScheduleItem = {
        ...onTimeItem,
        id: `${baseId}:pre${PRE_WARNING_MINUTES}`,
        title: `⏰ Em ${PRE_WARNING_MINUTES} min: ${reminder.title}`,
        body: buildNotificationBodyWithCue({
          title: reminder.title,
          body: `Faltam ${PRE_WARNING_MINUTES} minutos. ${description}`,
          entityType: reminder.entityType,
          route,
        }),
        time: preTime,
      };

      return [preItem, onTimeItem];
    });

  // Meal blocks com time viram notificações automáticas (sem precisar
  // criar reminder manual). weekdays=all = todo dia.
  const mealItems = mealPlan
    .filter((block) => !reminderMealIds.has(block.id))
    .flatMap<NotificationScheduleItem>((block) => {
      const time = normalizeTime(block.time);
      if (!time) return [];
      const itemsCount = block.items.length;
      const description =
        itemsCount > 0
          ? `${itemsCount} ${itemsCount === 1 ? "item" : "itens"} planejados`
          : "Refeição planejada no Praxis.";
      const baseId = `meal:${block.id}`;

      const onTimeItem: NotificationScheduleItem = {
        id: baseId,
        source: "meal" as const,
        title: block.title,
        body: buildNotificationBodyWithCue({
          title: block.title,
          body: description,
          entityType: "meal",
          route: "/modules/nutrition",
        }),
        time,
        route: "/modules/nutrition",
        entityType: "meal" as const,
        entityId: block.id,
        enabled: true,
        weekdays: allWeekdays(),
      };

      const preTime = offsetTimeBackward(time, PRE_WARNING_MINUTES);
      if (!preTime) return [onTimeItem];

      const preItem: NotificationScheduleItem = {
        ...onTimeItem,
        id: `${baseId}:pre${PRE_WARNING_MINUTES}`,
        title: `⏰ Em ${PRE_WARNING_MINUTES} min: ${block.title}`,
        body: buildNotificationBodyWithCue({
          title: block.title,
          body: `Faltam ${PRE_WARNING_MINUTES} minutos. ${description}`,
          entityType: "meal",
          route: "/modules/nutrition",
        }),
        time: preTime,
      };

      return [preItem, onTimeItem];
    });

  // Workout: WorkoutDayPlan não tem campo `time` próprio — o horário
  // do treino vive no reminder vinculado. Já é coberto por reminderItems.
  // Nada a gerar aqui.

  return {
    timezone,
    syncedAt,
    items: [...taskItems, ...reminderItems, ...mealItems],
    customQuotes: customQuotes
      .map((quote) => quote.trim())
      .filter((quote) => quote.length > 0)
      .slice(0, 100),
    hiddenQuotes: hiddenQuotes
      .map((quote) => quote.trim())
      .filter((quote) => quote.length > 0)
      .slice(0, 200),
  };
}
