import type {
  BasalMetabolicRateSource,
  BiologicalSex,
  FinanceBudgetLine,
  FinanceLineFrequency,
  FinanceMonthId,
  FinancePaymentMethod,
  FinanceYearBudget,
  LifeAreaAssessment,
  LifeAreaProfile,
  ModuleId,
  NutritionMacros,
  RankTier,
  Task,
  TaskDifficulty,
  TaskRecurrence,
  Weekday,
  WorkoutDayPlan,
  WorkoutLoadEntry,
  WorkoutMuscleGroup,
} from "@/lib/types";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatPoints(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function roundCurrencyValue(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(roundCurrencyValue(value));
}

export const financeMonthOrder: FinanceMonthId[] = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

export const financeMonthLabels: Record<FinanceMonthId, string> = {
  january: "Jan",
  february: "Fev",
  march: "Mar",
  april: "Abr",
  may: "Mai",
  june: "Jun",
  july: "Jul",
  august: "Ago",
  september: "Set",
  october: "Out",
  november: "Nov",
  december: "Dez",
};

export function emptyFinanceMonthlyValues() {
  return {
    january: 0,
    february: 0,
    march: 0,
    april: 0,
    may: 0,
    june: 0,
    july: 0,
    august: 0,
    september: 0,
    october: 0,
    november: 0,
    december: 0,
  } satisfies Record<FinanceMonthId, number>;
}

export function emptyFinanceMonthlyFlags() {
  return {
    january: false,
    february: false,
    march: false,
    april: false,
    may: false,
    june: false,
    july: false,
    august: false,
    september: false,
    october: false,
    november: false,
    december: false,
  } satisfies Record<FinanceMonthId, boolean>;
}

export function sumFinanceLine(line: { monthly: Record<FinanceMonthId, number> }) {
  return roundCurrencyValue(
    financeMonthOrder.reduce((sum, month) => sum + (line.monthly[month] ?? 0), 0),
  );
}

export function isFinanceCreditCardPaymentMethod(method: FinancePaymentMethod) {
  return method === "credit-card";
}

export function isFinanceAutoDebitPaymentMethod(method: FinancePaymentMethod) {
  return method === "auto-debit";
}

function isFinanceAutoDebitDue(
  line: Pick<FinanceBudgetLine, "paymentMethod" | "dueDay">,
  month: FinanceMonthId,
  year: number,
) {
  if (!isFinanceAutoDebitPaymentMethod(line.paymentMethod) || !line.dueDay) {
    return false;
  }

  const monthIndex = financeMonthOrder.indexOf(month);
  const dueDate = new Date(year, monthIndex, line.dueDay, 23, 59, 59, 999);
  return dueDate.getTime() <= Date.now();
}

export function isFinanceSettledInMonth(
  line: Pick<
    FinanceBudgetLine,
    "paymentMethod" | "dueDay" | "settledMonths" | "settledAmounts" | "monthly"
  >,
  month: FinanceMonthId,
  year = new Date().getFullYear(),
) {
  return (
    getFinanceSettledAmount(line, month, year) >= roundCurrencyValue(line.monthly[month] ?? 0)
  );
}

export function getFinanceSettledAmount(
  line: Pick<
    FinanceBudgetLine,
    "paymentMethod" | "dueDay" | "settledMonths" | "settledAmounts" | "monthly"
  >,
  month: FinanceMonthId,
  year = new Date().getFullYear(),
) {
  if (isFinanceAutoDebitDue(line, month, year)) {
    return roundCurrencyValue(line.monthly[month] ?? 0);
  }

  const explicitAmount = line.settledAmounts?.[month];
  if (typeof explicitAmount === "number") {
    return roundCurrencyValue(explicitAmount);
  }

  return line.settledMonths?.[month]
    ? roundCurrencyValue(line.monthly[month] ?? 0)
    : 0;
}

export function isFinanceInvoiceBaseLine(
  line: Pick<FinanceBudgetLine, "kind" | "paymentMethod" | "category" | "name">,
) {
  const name = line.name.trim().toLowerCase();
  const category = line.category.trim().toLowerCase();
  return (
    line.kind === "expense" &&
    line.paymentMethod === "credit-card" &&
    category === "cartão" &&
    (name === "inter" ||
      name.includes("resultado dos cart") ||
      name.includes("fatura"))
  );
}

export function isFinanceSummaryHelperLine(
  line: Pick<FinanceBudgetLine, "name">,
) {
  const name = line.name.trim().toLowerCase();
  return name === "gastos dinheiro" || name.includes("resultado dos cart");
}

export function formatFinancePaymentMethod(method: FinancePaymentMethod) {
  switch (method) {
    case "credit-card":
      return "Cartão de crédito";
    case "debit-card":
      return "Cartão de débito";
    case "auto-debit":
      return "Débito automático";
    case "pix":
      return "Pix";
    case "bank-slip":
      return "Boleto";
    case "bank-transfer":
      return "Transferência";
    default:
      return "Dinheiro";
  }
}

export function formatFinanceFrequency(frequency: FinanceLineFrequency) {
  return frequency === "fixed" ? "Fixo" : "Variável";
}

export function getFinanceMonthSummaries(budget: FinanceYearBudget) {
  return financeMonthOrder.map((month) => {
    const income = roundCurrencyValue(
      budget.lines
      .filter((line) => line.kind === "income")
      .reduce((sum, line) => sum + (line.monthly[month] ?? 0), 0),
    );
    const expenseLines = budget.lines.filter((line) => line.kind === "expense");
    const invoiceBase = roundCurrencyValue(budget.cardInvoiceBase?.[month] ?? 0);
    const expenses = roundCurrencyValue(expenseLines.reduce(
      (sum, line) => sum + getFinanceSettledAmount(line, month, budget.year),
      invoiceBase,
    ));
    const cardExpenses = roundCurrencyValue(expenseLines
      .filter((line) => isFinanceCreditCardPaymentMethod(line.paymentMethod))
      .reduce(
        (sum, line) => sum + getFinanceSettledAmount(line, month, budget.year),
        invoiceBase,
      ));
    const cashExpenses = roundCurrencyValue(expenseLines
      .filter((line) => !isFinanceCreditCardPaymentMethod(line.paymentMethod))
      .reduce(
        (sum, line) => sum + getFinanceSettledAmount(line, month, budget.year),
        0,
      ));

    return {
      id: month,
      label: financeMonthLabels[month],
      income,
      expenses,
      balance: roundCurrencyValue(income - cashExpenses),
      cardExpenses,
      cashExpenses,
    };
  });
}

const taskXpByDifficulty: Record<TaskDifficulty, number> = {
  easy: 25,
  medium: 40,
  hard: 55,
};

export function getTaskXpFromDifficulty(difficulty: TaskDifficulty) {
  return taskXpByDifficulty[difficulty];
}

export function getTaskDifficultyFromXp(xp: number): TaskDifficulty {
  if (xp <= 30) return "easy";
  if (xp <= 45) return "medium";
  return "hard";
}

export function normalizeTaskDifficulty(
  difficulty: TaskDifficulty | null | undefined,
  fallbackXp = 40,
): TaskDifficulty {
  if (difficulty === "easy" || difficulty === "medium" || difficulty === "hard") {
    return difficulty;
  }

  return getTaskDifficultyFromXp(fallbackXp);
}

const rankTierWeight: Record<RankTier, number> = {
  E: 1,
  D: 2,
  C: 3,
  B: 4,
  A: 5,
  S: 6,
};

export function normalizeLifeAreaRank(
  value: RankTier | number | null | undefined,
  fallback: RankTier = "C",
): RankTier {
  if (value === "E" || value === "D" || value === "C" || value === "B" || value === "A" || value === "S") {
    return value;
  }

  if (typeof value === "number") {
    const rounded = Math.round(value);
    if (rounded <= 1) return "E";
    if (rounded === 2) return "D";
    if (rounded === 3) return "C";
    if (rounded === 4) return "B";
    if (rounded >= 5) return "S";
  }

  return fallback;
}

export function getLifeAreaMultiplier(assessment: LifeAreaAssessment) {
  const importanceFactor = 0.75 + (rankTierWeight[assessment.importance] - 1) * 0.1;
  const levelFactor = 1.25 - (rankTierWeight[assessment.currentLevel] - 1) * 0.1;
  return Number((importanceFactor * levelFactor).toFixed(2));
}

export function moduleFromTaskArea(task: Pick<Task, "moduleId" | "category">): ModuleId {
  if (task.moduleId) return task.moduleId;

  switch (task.category) {
    case "finance":
      return "finance";
    case "appearance":
      return "appearance";
    case "health":
      return "health";
    case "nutrition":
      return "nutrition";
    case "mindfulness":
      return "mind";
    case "productivity":
      return "work";
    case "fitness":
      return "workout";
    default:
      return "mind";
  }
}

export function getTaskBaseXp(task: Pick<Task, "baseXp" | "difficulty" | "xp">) {
  if (typeof task.baseXp === "number" && task.baseXp > 0) {
    return task.baseXp;
  }

  const difficulty = normalizeTaskDifficulty(task.difficulty, task.xp);
  return getTaskXpFromDifficulty(difficulty);
}

export function getAdjustedTaskXp(
  task: Pick<Task, "moduleId" | "category" | "baseXp" | "difficulty" | "xp">,
  profile: LifeAreaProfile,
) {
  const moduleId = moduleFromTaskArea(task);
  const assessment = profile.areas[moduleId];
  const baseXp = getTaskBaseXp(task);

  if (!assessment) return baseXp;

  return Math.max(10, Math.round(baseXp * getLifeAreaMultiplier(assessment)));
}

export function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const weekdayLabels: Record<Weekday, string> = {
  monday: "Seg",
  tuesday: "Ter",
  wednesday: "Qua",
  thursday: "Qui",
  friday: "Sex",
  saturday: "Sáb",
  sunday: "Dom",
};

export function weekdayLabel(day: Weekday) {
  return weekdayLabels[day];
}

const weekdayLongLabels: Record<Weekday, string> = {
  monday: "Segunda",
  tuesday: "Terca",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sabado",
  sunday: "Domingo",
};

export function weekdayLongLabel(day: Weekday) {
  return weekdayLongLabels[day];
}

function startOfWeek(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  const day = nextDate.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  nextDate.setDate(nextDate.getDate() + diff);
  return nextDate;
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isSameWeek(left: Date, right: Date) {
  return startOfWeek(left).getTime() === startOfWeek(right).getTime();
}

function isSameMonth(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

export function isRecurringTask(task: Task) {
  return task.recurrence.kind !== "one-time";
}

export function isTaskCompletedForDate(
  task: Task,
  referenceDate = new Date(),
) {
  // Per-date completion array takes precedence — it's the source of
  // truth once the user starts marking past days. Empty array (length
  // 0) is still treated as "no per-date data yet" so legacy tasks
  // toggled before this field existed keep their original completedAt
  // behavior.
  if (task.completedDates && task.completedDates.length > 0) {
    const dateKey = formatDateKey(referenceDate);
    if (task.completedDates.includes(dateKey)) return true;
    // For one-time tasks, the array is authoritative — if today isn't
    // in the list, the task isn't done. For recurring tasks we fall
    // through to the legacy completedAt check so completing today via
    // the old toggleTask flow still registers without requiring the
    // user to re-click after migration.
    if (task.recurrence.kind === "one-time") return false;
  }

  if (!task.completed) return false;
  if (!task.completedAt) return task.completed;

  const completionDate = new Date(task.completedAt);
  if (Number.isNaN(completionDate.getTime())) {
    return task.completed;
  }

  switch (task.recurrence.kind) {
    case "daily":
    case "selected-weekdays":
    case "interval-days":
      return isSameDay(completionDate, referenceDate);
    case "weekly-fixed":
    case "times-per-week":
      return isSameWeek(completionDate, referenceDate);
    case "monthly":
      return isSameMonth(completionDate, referenceDate);
    case "one-time":
    default:
      return task.completed;
  }
}

function weekdayFromDate(referenceDate: Date): Weekday {
  const mapping: Record<number, Weekday> = {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
  };

  return mapping[referenceDate.getDay()];
}

function startOfDay(referenceDate: Date) {
  const nextDate = new Date(referenceDate);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

export function formatDateKey(referenceDate: Date) {
  const date = startOfDay(referenceDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isTaskDueForDate(task: Task, referenceDate = new Date()) {
  const referenceKey = formatDateKey(referenceDate);
  if (task.deferUntilDate && task.deferUntilDate > referenceKey) {
    return false;
  }

  const weekday = weekdayFromDate(referenceDate);

  switch (task.recurrence.kind) {
    case "daily":
      return true;
    case "selected-weekdays":
      return task.recurrence.weekdays?.includes(weekday) ?? false;
    case "weekly-fixed":
      return task.recurrence.weekday === weekday;
    case "monthly":
      return task.recurrence.dayOfMonth === referenceDate.getDate();
    case "interval-days": {
      const intervalDays = Math.max(1, task.recurrence.intervalDays ?? 1);
      if (!task.completedAt) return true;

      const completionDate = new Date(task.completedAt);
      if (Number.isNaN(completionDate.getTime())) return true;

      const dayDifference = Math.floor(
        (startOfDay(referenceDate).getTime() - startOfDay(completionDate).getTime()) /
          86400000,
      );

      return dayDifference >= intervalDays;
    }
    case "times-per-week":
      return true;
    case "one-time":
    default:
      return !task.completed;
  }
}

export function normalizeRecurringTaskCompletion(
  task: Task,
  referenceDate = new Date(),
) {
  if (!isRecurringTask(task)) {
    return task;
  }

  if (!task.completedAt) {
    return {
      ...task,
      completed: false,
    };
  }

  return isTaskCompletedForDate(task, referenceDate)
    ? task
    : {
        ...task,
        completed: false,
      };
}

export function formatRecurrence(recurrence: TaskRecurrence) {
  switch (recurrence.kind) {
    case "daily":
      return "Todos os dias";
    case "times-per-week":
      return recurrence.timesPerWeek
        ? `${recurrence.timesPerWeek}x por semana`
        : "Frequencia semanal";
    case "selected-weekdays":
      return recurrence.weekdays?.length
        ? `Dias: ${recurrence.weekdays.map(weekdayLabel).join(" • ")}`
        : "Dias selecionados";
    case "weekly-fixed":
      return recurrence.weekday
        ? `Toda ${weekdayLabel(recurrence.weekday)}`
        : "Dia fixo semanal";
    case "monthly":
      return recurrence.dayOfMonth
        ? `Todo dia ${recurrence.dayOfMonth} do mês`
        : "Mensal";
    case "interval-days":
      return recurrence.intervalDays
        ? `A cada ${recurrence.intervalDays} dias`
        : "Intervalo personalizado";
    default:
      return "Uma vez";
  }
}

export function emptyMacros(): NutritionMacros {
  return {
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sodium: 0,
    calories: 0,
  };
}

export function estimateBasalMetabolicRate(payload: {
  bodyWeightKg: number;
  bodyHeightCm: number;
  ageYears: number;
  biologicalSex: BiologicalSex;
}) {
  const weight = Math.max(1, payload.bodyWeightKg);
  const height = Math.max(1, payload.bodyHeightCm);
  const age = Math.max(1, payload.ageYears);
  const base = 10 * weight + 6.25 * height - 5 * age;
  return Math.round(
    payload.biologicalSex === "male" ? base + 5 : base - 161,
  );
}

export function resolveBasalMetabolicRate(payload: {
  bodyWeightKg: number;
  bodyHeightCm: number;
  ageYears: number;
  biologicalSex: BiologicalSex;
  basalMetabolicRate?: number;
  basalMetabolicRateSource: BasalMetabolicRateSource;
}) {
  if (payload.basalMetabolicRateSource === "manual" && payload.basalMetabolicRate) {
    return Math.max(0, Math.round(payload.basalMetabolicRate));
  }

  return estimateBasalMetabolicRate(payload);
}

/**
 * Activity multiplier (TDEE coefficient) inferred from how many days
 * per week the user actually trains. The classic Mifflin-St Jeor BMR
 * captures the bedrest baseline; multiplying it gives total daily
 * energy expenditure including NEAT + planned exercise.
 *
 * Mapping mirrors the Harris-Benedict bands:
 *   0    → 1.2   sedentary
 *   1-3  → 1.375 light
 *   4-5  → 1.55  moderate
 *   6+   → 1.725 high
 */
export function getActivityMultiplierFromTrainingDays(daysPerWeek: number) {
  const days = Math.max(0, Math.round(daysPerWeek));
  if (days === 0) return 1.2;
  if (days <= 3) return 1.375;
  if (days <= 5) return 1.55;
  return 1.725;
}

export function describeTrainingActivity(daysPerWeek: number) {
  const days = Math.max(0, Math.round(daysPerWeek));
  if (days === 0) return "Sedentário (sem treinos)";
  if (days <= 3) return "Leve (1-3 treinos/semana)";
  if (days <= 5) return "Moderado (4-5 treinos/semana)";
  return "Intenso (6+ treinos/semana)";
}

export function addMacros(
  base: NutritionMacros,
  current: NutritionMacros,
): NutritionMacros {
  return {
    protein: base.protein + current.protein,
    carbs: base.carbs + current.carbs,
    fat: base.fat + current.fat,
    fiber: base.fiber + current.fiber,
    sodium: base.sodium + current.sodium,
    calories: base.calories + current.calories,
  };
}

function normalizeWorkoutHistoryToken(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export type WorkoutHistorySet = {
  id: string;
  setNumber: number;
  weightKg: number;
  repetitions: number;
};

export type WorkoutHistoryEntry = {
  id: string;
  key: string;
  programId: string;
  dayId: string;
  dayTitle: string;
  exerciseId: string;
  exerciseName: string;
  loggedAt: string;
  sets: WorkoutHistorySet[];
};

export function workoutHistory(
  loads: WorkoutLoadEntry[],
  payload: {
    exerciseId?: string;
    exerciseName?: string;
    programId?: string;
  },
  limit?: number,
) {
  const normalizedName = normalizeWorkoutHistoryToken(payload.exerciseName);
  const filteredEntries = loads
    .filter((entry) => {
      if (payload.programId && entry.programId !== payload.programId) {
        return false;
      }

      if (!payload.exerciseId && normalizedName.length === 0) {
        return true;
      }

      if (payload.exerciseId && entry.exerciseId === payload.exerciseId) {
        return true;
      }

      return (
        normalizedName.length > 0 &&
        normalizeWorkoutHistoryToken(entry.exerciseName) === normalizedName
      );
    })
    .sort(
      (left, right) =>
        new Date(right.loggedAt).getTime() - new Date(left.loggedAt).getTime(),
    );

  const grouped = new Map<string, WorkoutHistoryEntry>();

  for (const entry of filteredEntries) {
    const groupKey = `${entry.key}:${entry.loggedAt}`;
    const currentGroup = grouped.get(groupKey);

    if (currentGroup) {
      currentGroup.sets.push({
        id: entry.id,
        setNumber: entry.setNumber,
        weightKg: entry.weightKg,
        repetitions: entry.repetitions,
      });
      continue;
    }

    grouped.set(groupKey, {
      id: groupKey,
      key: entry.key,
      programId: entry.programId,
      dayId: entry.dayId,
      dayTitle: entry.dayTitle,
      exerciseId: entry.exerciseId,
      exerciseName: entry.exerciseName,
      loggedAt: entry.loggedAt,
      sets: [
        {
          id: entry.id,
          setNumber: entry.setNumber,
          weightKg: entry.weightKg,
          repetitions: entry.repetitions,
        },
      ],
    });
  }

  const history = Array.from(grouped.values()).map((entry) => ({
    ...entry,
    sets: entry.sets.sort((left, right) => left.setNumber - right.setNumber),
  }));

  return typeof limit === "number" ? history.slice(0, limit) : history;
}

export function latestWorkoutLoad(
  loads: WorkoutLoadEntry[],
  payload: {
    exerciseId?: string;
    exerciseName?: string;
    programId?: string;
  },
) {
  return workoutHistory(loads, payload, 1)[0];
}

export function weeklyVolumeByMuscle(plan: WorkoutDayPlan[]) {
  const totals = new Map<WorkoutMuscleGroup, number>();
  for (const day of plan) {
    for (const exercise of day.exercises) {
      totals.set(
        exercise.muscleGroup,
        (totals.get(exercise.muscleGroup) ?? 0) + exercise.sets,
      );
    }
  }
  return Array.from(totals.entries())
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((left, right) => right.sets - left.sets);
}
