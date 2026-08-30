import type { TaskDifficulty, TaskRecurrence, Weekday } from "@/lib/types";

/**
 * Regras de dificuldade/recorrência das tarefas de SAÚDE, extraídas de
 * modules/health/page.tsx SEM mudança de lógica. Vivem aqui porque o
 * form rápido global (quick-task-form) cria tarefa de saúde fora da
 * página do módulo — e a dificuldade define o XP (getTaskBaseXp), então
 * duplicar a regra = mesma tarefa valer XP diferente dependendo de onde
 * foi criada.
 */
export type HealthRecurrenceKind =
  | "interval-days"
  | "selected-weekdays"
  | "monthly";

export function getHealthDifficulty(
  recurrenceKind: HealthRecurrenceKind,
  intervalDays: number,
): TaskDifficulty {
  if (recurrenceKind === "interval-days" && intervalDays >= 90) {
    return "hard";
  }

  if (recurrenceKind === "monthly") {
    return "hard";
  }

  return "medium";
}

export function buildHealthRecurrence(
  recurrenceKind: HealthRecurrenceKind,
  todayWeekday: Weekday,
  intervalDays: number,
  weekdays: Weekday[],
  dayOfMonth: number,
): TaskRecurrence {
  if (recurrenceKind === "selected-weekdays") {
    return {
      kind: "selected-weekdays",
      weekdays: weekdays.length ? weekdays : [todayWeekday],
    };
  }

  if (recurrenceKind === "monthly") {
    return {
      kind: "monthly",
      dayOfMonth: Math.max(1, Math.min(28, dayOfMonth)),
    };
  }

  return {
    kind: "interval-days",
    intervalDays: Math.max(1, intervalDays),
  };
}
