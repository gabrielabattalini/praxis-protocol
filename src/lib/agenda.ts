import { moduleCatalog } from "@/lib/mock-data";
import type { MealPlanBlock, ModuleId, PersistedState, Weekday } from "@/lib/types";
import {
  formatDateKey,
  isMealItemCompletedForDateKey,
  isTaskCompletedForDate,
  isTaskDueForDate,
  isWorkoutDayDeferredTo,
  isWorkoutDayVisibleOnDate,
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
  // "Tocado" — o usuário fez ALGUMA coisa nesse evento no dia, mesmo que
  // não tenha fechado tudo. Pra refeição: ≥1 item marcado. Pra hidratação
  // (sourceKey nutrition-hydration-daily): houve waterEntry > 0 no dia.
  // Usado pelo relatório semanal pra não contar como "missed" o bloco que
  // o usuário comeu (mas deixou um suplemento opcional pra trás), ou o
  // dia em que ele bebeu água sem fechar a meta.
  partiallyCompleted?: boolean;
  route: string;
  xp?: number;
  // Data (YYYY-MM-DD) a que este evento pertence — permite dar/tirar
  // baixa na própria Agenda pro dia certo (inclusive dias passados).
  dateKey: string;
  // IDs da entidade por trás do evento, pra marcar conclusão direto da
  // Agenda (sincronizado com Missões). Só um é populado por evento.
  taskId?: string;
  mealBlockId?: string;
  recoveryDayId?: string;
  // Só populados pra kind="workout" — usados pelo agregador do
  // relatório semanal pra contar uma sessão por workout day em vez
  // de duplicar quando o usuário fez off-schedule (canonical=quarta,
  // executado=quinta gerava antes scheduled=2, completed=1).
  workoutDayId?: string;
  isOffSchedule?: boolean;
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
  const workoutDayDeferrals = state.workoutDayDeferrals ?? [];
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

  const waterEntries = state.waterEntries ?? [];
  const hydratedDateKeys = new Set(
    waterEntries
      .filter((entry) => (entry.consumedMl ?? 0) > 0)
      .map((entry) => entry.date),
  );

  const manualTasks = tasks
    .filter((task) => isTaskDueForDate(task, referenceDate))
    .map<AgendaEvent>((task) => {
      const completed = isTaskCompletedForDate(task, referenceDate);
      // Hidratação só fica "completed" quando bate a meta (ex.: 4,5 L)
      // ou marca manual. Sem isto, qualquer dia em que o usuário bebeu
      // água mas não fechou a meta entrava como "missed" no relatório,
      // que é mentira — ele FEZ algo. Marcar partiallyCompleted preserva
      // o sinal "tocou na atividade" sem mexer no resto do app.
      const isHydration = task.sourceKey === "nutrition-hydration-daily";
      const partiallyCompleted =
        !completed && isHydration && hydratedDateKeys.has(dateKey);

      return {
        id: `task-${task.id}-${dateKey}`,
        kind: "manual",
        title: task.title,
        description: task.description,
        sourceLabel: labelForModule(task.moduleId),
        badgeLabel: task.sourceKey ? "Sincronizada" : "Manual",
        time: task.scheduledTime,
        completed,
        partiallyCompleted,
        route: routeForModule(task.moduleId),
        xp: task.xp,
        dateKey,
        taskId: task.id,
      };
    });

  const mealBlocks = mealPlan
    .filter((block) => reminderMatchesDay(block, state, weekday))
    .map<AgendaEvent>((block) => {
      const reminder = reminders.find(
        (item) =>
          item.entityId === block.id &&
          (item.entityType === "meal" || item.entityType === "supplement"),
      );
      // Conclusão é por DATA (completedDates), não pelo boolean único
      // do item — sem isso, marcar refeição de ontem em Missões não
      // refletia aqui (e portanto também não no relatório semanal).
      const completedCount = block.items.filter((item) =>
        isMealItemCompletedForDateKey(item, dateKey),
      ).length;
      const totalCount = block.items.length;

      const allDone = totalCount > 0 && completedCount === totalCount;
      // "Tocado" = pelo menos um item marcado. Reflete que o usuário
      // efetivamente fez a refeição, mesmo deixando um item opcional
      // (suplemento, complemento) pra trás. Usado SÓ pelo relatório
      // semanal (via weekly-report.ts), pra não classificar essa
      // refeição como "missed".
      const touched = !allDone && completedCount > 0;

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
        completed: allDone,
        partiallyCompleted: touched,
        route: "/modules/nutrition",
        dateKey,
        mealBlockId: block.id,
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
        dateKey,
        recoveryDayId: day.id,
      };
    });

  const workoutBlocks = activeWorkoutPlan
    .map((day) => {
      if (day.isRestDay) return null;
      const reminder = reminders.find(
        (item) =>
          item.entityType === "workout" && item.entityId === day.id,
      );
      // scheduled = aparece nesse weekday por agendamento canônico do
      // dia OU pelo multi-select de reminder.weekdays. Se nenhum,
      // ainda incluímos quando há atividade real na data (log de carga
      // ou marcação manual) → isso é "off-schedule" e o relatório não
      // conta esse dia como uma sessão A MAIS no scheduled.
      const scheduled =
        Array.isArray(reminder?.weekdays) && reminder.weekdays.length > 0
          ? reminder.weekdays.includes(weekday)
          : day.weekday === weekday;
      const hasLogOnDate = workoutLoadEntries.some(
        (entry) =>
          entry.dayId === day.id && entry.loggedAt.slice(0, 10) === dateKey,
      );
      const hasCompletionOnDate = workoutDayCompletions.some(
        (completion) =>
          completion.dayId === day.id && completion.dateKey === dateKey,
      );
      // Inclui adiamentos ("Passar pra amanhã"): esconde a ocorrência
      // original e mostra na data de destino.
      const deferredTo = isWorkoutDayDeferredTo(
        workoutDayDeferrals,
        day.id,
        dateKey,
      );
      const visible = isWorkoutDayVisibleOnDate({
        dayId: day.id,
        scheduled,
        hasActivity: hasLogOnDate || hasCompletionOnDate,
        dateKey,
        deferrals: workoutDayDeferrals,
      });
      if (!visible) return null;

      const completed = hasLogOnDate || hasCompletionOnDate;
      const event: AgendaEvent = {
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
        dateKey,
        workoutDayId: day.id,
        // Deferred-to conta como a sessão agendada (só mudou de dia).
        isOffSchedule: !scheduled && !deferredTo,
      };
      return event;
    })
    .filter((event): event is AgendaEvent => event !== null);

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
      // 00:00 = meia-noite = fim do dia, vai por último.
      const leftKey = left.time === "00:00" ? "24:00" : left.time;
      const rightKey = right.time === "00:00" ? "24:00" : right.time;
      return leftKey.localeCompare(rightKey);
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
