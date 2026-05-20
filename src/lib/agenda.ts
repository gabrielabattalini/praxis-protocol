import { moduleCatalog } from "@/lib/mock-data";
import type { MealPlanBlock, ModuleId, PersistedState, Weekday } from "@/lib/types";
import {
  formatDateKey,
  isTaskCompletedForDate,
  isTaskDueForDate,
  weekdayLongLabel,
  weekdayLabel,
} from "@/lib/utils";

export type AgendaEventKind = "manual" | "meal" | "workout" | "recovery";

export type AgendaEvent = {
  id: string;
  kind: AgendaEventKind;
  title: string;
  description: string;
  sourceLabel: string;
  badgeLabel: string;
  time?: string;
  completed: boolean;
  route: string;
  xp?: number;
};

export type AgendaDaySummary = {
  date: Date;
  dateKey: string;
  dayLabel: string;
  shortLabel: string;
  items: AgendaEvent[];
  completedCount: number;
  totalCount: number;
};

const weekdayMap: Record<number, Weekday> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

function getWeekday(date: Date): Weekday {
  return weekdayMap[date.getDay()];
}

function addDays(referenceDate: Date, amount: number) {
  const date = new Date(referenceDate);
  date.setDate(referenceDate.getDate() + amount);
  return date;
}

function startOfWeek(referenceDate: Date) {
  const date = new Date(referenceDate);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function routeForModule(moduleId: ModuleId | null) {
  if (!moduleId) return "/tasks";
  return moduleCatalog.find((module) => module.id === moduleId)?.route ?? "/tasks";
}

function labelForModule(moduleId: ModuleId | null) {
  if (!moduleId) return "Manual";
  return moduleCatalog.find((module) => module.id === moduleId)?.name ?? "Manual";
}

function reminderMatchesDay(
  block: MealPlanBlock,
  state: PersistedState,
  weekday: Weekday,
) {
  const reminder = state.reminders.find(
    (item) =>
      item.entityId === block.id &&
      (item.entityType === "meal" || item.entityType === "supplement"),
  );

  if (!reminder?.weekdays?.length) {
    return true;
  }

  return reminder.weekdays.includes(weekday);
}

export function buildAgendaEvents(
  state: PersistedState,
  referenceDate: Date,
): AgendaEvent[] {
  const reminders = state.reminders ?? [];
  const tasks = state.tasks ?? [];
  const mealPlan = state.mealPlan ?? [];
  const workoutPrograms = state.workoutPrograms ?? [];
  const workoutPlan = state.workoutPlan ?? [];
  const workoutDayCompletions = state.workoutDayCompletions ?? [];
  const workoutLoadEntries = state.workoutLoadEntries ?? [];
  const weekday = getWeekday(referenceDate);
  const dateKey = formatDateKey(referenceDate);
  const activeWorkoutProgram =
    workoutPrograms.find(
      (program) => program.id === state.activeWorkoutProgramId,
    ) ?? workoutPrograms[0];
  const activeWorkoutPlan =
    activeWorkoutProgram?.workoutPlan?.length
      ? activeWorkoutProgram.workoutPlan
      : workoutPlan;

  const manualTasks = tasks
    .filter((task) => isTaskDueForDate(task, referenceDate))
    .map<AgendaEvent>((task) => ({
      id: `task-${task.id}-${dateKey}`,
      kind: "manual",
      title: task.title,
      description: task.description,
      sourceLabel: labelForModule(task.moduleId),
      badgeLabel: task.sourceKey ? "Sincronizada" : "Manual",
      time: task.scheduledTime,
      completed: isTaskCompletedForDate(task, referenceDate),
      route: routeForModule(task.moduleId),
      xp: task.xp,
    }));

  const mealBlocks = mealPlan
    .filter((block) => reminderMatchesDay(block, state, weekday))
    .map<AgendaEvent>((block) => {
      const reminder = reminders.find(
        (item) =>
          item.entityId === block.id &&
          (item.entityType === "meal" || item.entityType === "supplement"),
      );
      const completedCount = block.items.filter((item) => item.completed).length;
      const totalCount = block.items.length;

      return {
        id: `meal-${block.id}-${dateKey}`,
        kind: "meal",
        title: block.title,
        description:
          totalCount > 0
            ? `${completedCount}/${totalCount} itens concluídos`
            : "Sem itens definidos",
        sourceLabel: "Dieta",
        badgeLabel: "Sincronizada",
        time: reminder?.time || block.time,
        completed: totalCount > 0 && completedCount === totalCount,
        route: "/modules/nutrition",
      };
    });

  const recoveryPlan = state.recoveryPlan ?? [];
  const recoveryDayCompletions = state.recoveryDayCompletions ?? [];
  const recoveryBlocks = recoveryPlan
    .filter((day) => day.weekday === weekday && !day.isRestDay)
    .map<AgendaEvent>((day) => {
      const completed = recoveryDayCompletions.some(
        (completion) => completion.dayId === day.id && completion.dateKey === dateKey,
      );
      const exerciseCount = day.exercises.length;
      return {
        id: `recovery-${day.id}-${dateKey}`,
        kind: "recovery",
        title: day.title,
        description:
          day.summary ||
          (exerciseCount > 0
            ? `${exerciseCount} exercício${exerciseCount > 1 ? "s" : ""}${day.focus ? ` · ${day.focus}` : ""}`
            : day.focus || "Sessão de mobilidade"),
        sourceLabel: "Recuperação",
        badgeLabel: "Sincronizada",
        time: undefined,
        completed,
        route: "/modules/recovery",
      };
    });

  const workoutBlocks = activeWorkoutPlan
    .filter((day) => day.weekday === weekday && !day.isRestDay)
    .map<AgendaEvent>((day) => {
      const reminder = reminders.find(
        (item) => item.entityId === day.id && item.entityType === "workout",
      );
      const completed =
        workoutDayCompletions.some(
          (completion) => completion.dayId === day.id && completion.dateKey === dateKey,
        ) ||
        workoutLoadEntries.some(
          (entry) => entry.dayId === day.id && entry.loggedAt.slice(0, 10) === dateKey,
        );

      return {
        id: `workout-${day.id}-${dateKey}`,
        kind: "workout",
        title: day.title,
        description:
          day.exercises.length > 0
            ? `${day.exercises.length} exercícios • ${day.summary}`
            : day.summary,
        sourceLabel: "Treino",
        badgeLabel: "Sincronizada",
        time: reminder?.time || "17:30",
        completed,
        route: `/modules/workout?dayId=${day.id}`,
      };
    });

  return [
    ...manualTasks,
    ...mealBlocks,
    ...workoutBlocks,
    ...recoveryBlocks,
  ].sort((left, right) => {
    if (left.completed !== right.completed) {
      return left.completed ? 1 : -1;
    }

    if (left.time && right.time) {
      return left.time.localeCompare(right.time);
    }

    if (left.time) return -1;
    if (right.time) return 1;
    return left.title.localeCompare(right.title);
  });
}

export function buildWeekAgenda(
  state: PersistedState,
  referenceDate: Date,
): AgendaDaySummary[] {
  const weekStart = startOfWeek(referenceDate);

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const items = buildAgendaEvents(state, date);

    return {
      date,
      dateKey: formatDateKey(date),
      dayLabel: weekdayLongLabel(getWeekday(date)),
      shortLabel: weekdayLabel(getWeekday(date)),
      completedCount: items.filter((item) => item.completed).length,
      totalCount: items.length,
      items,
    };
  });
}
