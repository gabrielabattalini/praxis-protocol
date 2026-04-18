"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Bell,
  BellOff,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  Plus,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import { ProgressBar } from "@/components/ui/progress-bar";
import { moduleCatalog } from "@/lib/mock-data";
import type {
  MealPlanBlock,
  MealPlanItem,
  ReminderEntityType,
  Task,
  TaskCategory,
  TaskRecurrence,
  Weekday,
} from "@/lib/types";
import {
  formatDateKey,
  formatRecurrence,
  isTaskCompletedForDate,
  isTaskDueForDate,
  weekdayLongLabel,
} from "@/lib/utils";

type AgendaDetailItem = {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  tone?: "food" | "supplement";
  completed?: boolean;
  blockId?: string;
  mealItemId?: string;
};

type AgendaItem = {
  id: string;
  kind: "manual" | "nutrition" | "workout";
  originType: "manual" | "synced";
  originLabel: string;
  title: string;
  description: string;
  categoryLabel: string;
  sourceLabel: string;
  time?: string;
  completed: boolean;
  reminderId?: string;
  reminderEnabled: boolean;
  reminderConfig?: {
    entityType: ReminderEntityType;
    entityId: string;
    title: string;
    time: string;
    weekdays?: Weekday[];
  };
  moduleRoute?: string;
  manualTaskId?: string;
  workoutDayId?: string;
  workoutLoggedToday?: boolean;
  workoutMarkedCompleted?: boolean;
  canPostpone?: boolean;
  postponeLabel?: string;
  points?: number;
  recurrenceLabel?: string;
  detailHint?: string;
  detailItems?: AgendaDetailItem[];
  stats?: string[];
};

const categoryLabels: Record<TaskCategory, string> = {
  fitness: "Fitness",
  study: "Estudo",
  nutrition: "Nutrição",
  mindfulness: "Mindfulness",
  productivity: "Produtividade",
  social: "Social",
  creativity: "Criatividade",
  appearance: "Aparência",
  finance: "Finanças",
  health: "Saúde",
};

const weekdays: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const weekdayShortLabels: Record<Weekday, string> = {
  monday: "SEG",
  tuesday: "TER",
  wednesday: "QUA",
  thursday: "QUI",
  friday: "SEX",
  saturday: "SÁB",
  sunday: "DOM",
};

const calendarHeaderLabels = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

const hiddenLegacyTaskIds = new Set(["task-pull", "task-push", "task-legs"]);

function taskSourceLabel(moduleId: Task["moduleId"]) {
  if (!moduleId) return "Meta personalizada";
  return moduleCatalog.find((module) => module.id === moduleId)?.name ?? "Meta personalizada";
}

function getTodayWeekday(date = new Date()): Weekday {
  const mapping: Record<number, Weekday> = {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
  };
  return mapping[date.getDay()];
}

function reminderWeekdaysFromTask(
  recurrence: TaskRecurrence,
  todayWeekday: Weekday,
) {
  switch (recurrence.kind) {
    case "daily":
      return weekdays;
    case "selected-weekdays":
      return recurrence.weekdays?.length ? recurrence.weekdays : [todayWeekday];
    case "weekly-fixed":
      return recurrence.weekday ? [recurrence.weekday] : [todayWeekday];
    default:
      return [todayWeekday];
  }
}

function reminderMatchesToday(
  reminderWeekdays: Weekday[] | undefined,
  todayWeekday: Weekday,
) {
  if (!reminderWeekdays?.length) return true;
  return reminderWeekdays.includes(todayWeekday);
}

function sortAgendaItems(items: AgendaItem[]) {
  return [...items].sort((left, right) => {
    if (left.completed !== right.completed) {
      return left.completed ? 1 : -1;
    }

    if (left.time && right.time) {
      const leftMinutes = normalizeAgendaTimeForDayOrder(left.time);
      const rightMinutes = normalizeAgendaTimeForDayOrder(right.time);

      if (leftMinutes !== rightMinutes) {
        return leftMinutes - rightMinutes;
      }

      return left.time.localeCompare(right.time);
    }

    if (left.time) return -1;
    if (right.time) return 1;
    return left.title.localeCompare(right.title);
  });
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function summarizeMealBlock(block: MealPlanBlock) {
  const supplementCount = block.items.filter(
    (item) => item.kind === "supplement",
  ).length;
  const foodCount = block.items.length - supplementCount;
  const summaryParts: string[] = [];

  if (foodCount) {
    summaryParts.push(pluralize(foodCount, "alimento"));
  }

  if (supplementCount) {
    summaryParts.push(pluralize(supplementCount, "suplemento"));
  }

  return {
    foodCount,
    supplementCount,
    summaryText: summaryParts.join(" + ") || "Sem itens",
  };
}

function mealSourceLabel(foodCount: number, supplementCount: number) {
  if (supplementCount && !foodCount) return "Suplementos";
  if (supplementCount && foodCount) return "Refeição + suplementos";
  return "Refeição";
}

function buildMealDetailSubtitle(item: MealPlanItem) {
  const parts = [item.quantityLabel];

  if (item.macros.calories > 0) {
    parts.push(`${Math.round(item.macros.calories)} kcal`);
  }

  if (item.notes?.trim()) {
    parts.push(item.notes.trim());
  }

  return parts.join(" - ");
}

function detailToneClasses(tone?: AgendaDetailItem["tone"]) {
  if (tone === "supplement") {
    return {
      card: "border-[rgba(251,146,60,0.22)] bg-[rgba(251,146,60,0.08)]",
      badge: "border-[rgba(251,146,60,0.28)] bg-[rgba(251,146,60,0.12)] text-[var(--accent)]",
    };
  }

  if (tone === "food") {
    return {
      card: "border-[rgba(251,146,60,0.16)] bg-[rgba(251,146,60,0.06)]",
      badge: "border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] text-[var(--accent)]",
    };
  }

  return {
    card: "border-zinc-800 bg-[rgba(18,18,20,0.96)]",
    badge: "border-zinc-800 bg-[rgba(18,18,20,0.96)] text-zinc-300",
  };
}

function agendaItemToneClasses(item: AgendaItem) {
  if (item.completed) {
    return {
      card: "border-zinc-800 bg-[rgba(14,14,17,0.92)]",
      badge: "border-zinc-800 bg-[rgba(18,18,20,0.96)] text-zinc-300",
    };
  }

  if (item.kind === "workout") {
    return {
      card: "border-[rgba(251,146,60,0.18)] bg-[rgba(251,146,60,0.06)]",
      badge: "border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] text-[var(--accent)]",
    };
  }

  return {
    card: "border-zinc-800 bg-[rgba(14,14,17,0.96)]",
    badge: "border-zinc-800 bg-[rgba(18,18,20,0.96)] text-zinc-300",
  };
}

type AgendaPhaseId = "morning" | "afternoon" | "night" | "unscheduled";

type AgendaPhaseBucket = {
  id: AgendaPhaseId;
  label: string;
  window: string;
  description: string;
  accentClass: string;
  items: AgendaItem[];
};

type AgendaTimelineBucket = AgendaPhaseBucket & {
  total: number;
  completed: number;
};

const agendaPhaseOrder: Array<Omit<AgendaPhaseBucket, "items">> = [
  {
    id: "morning",
    label: "Manhã",
    window: "05:00 - 11:59",
    description: "Começos, rotinas e tarefas que pedem energia cedo.",
    accentClass: "from-sky-400/20 to-cyan-400/10",
  },
  {
    id: "afternoon",
    label: "Tarde",
    window: "12:00 - 17:59",
    description: "Execuções do meio do dia e tarefas de produção.",
    accentClass: "from-amber-400/20 to-orange-400/10",
  },
  {
    id: "night",
    label: "Noite",
    window: "18:00 - 04:59",
    description: "Fechamento, treino e pendências de final de ciclo.",
    accentClass: "from-violet-400/20 to-fuchsia-400/10",
  },
  {
    id: "unscheduled",
    label: "Sem horário",
    window: "Fluxo livre",
    description: "Itens úteis que ainda não têm janela definida.",
    accentClass: "from-zinc-400/20 to-zinc-500/10",
  },
];

function parseAgendaTimeMinutes(time?: string) {
  if (!time) return null;
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  return hours * 60 + minutes;
}

function normalizeAgendaTimeForDayOrder(time?: string) {
  const minutes = parseAgendaTimeMinutes(time);
  if (minutes === null) return Number.POSITIVE_INFINITY;

  // Horários entre 00:00 e 04:59 pertencem ao fim do ciclo do mesmo dia.
  return minutes < 5 * 60 ? minutes + 24 * 60 : minutes;
}

function isMealItemCompletedForDateKey(item: MealPlanItem, dateKey: string) {
  return Boolean(item.completedAt?.slice(0, 10) === dateKey);
}

function getAgendaPhaseId(time?: string): AgendaPhaseId {
  const minutes = parseAgendaTimeMinutes(time);
  if (minutes === null) return "unscheduled";
  if (minutes < 5 * 60) return "night";
  if (minutes < 12 * 60) return "morning";
  if (minutes < 18 * 60) return "afternoon";
  return "night";
}

function buildAgendaTimeline(items: AgendaItem[]): AgendaTimelineBucket[] {
  return agendaPhaseOrder.map((phase) => {
    const phaseItems = items.filter((item) => getAgendaPhaseId(item.time) === phase.id);
    return {
      ...phase,
      items: phaseItems,
      total: phaseItems.length,
      completed: phaseItems.filter((item) => item.completed).length,
    };
  });
}

export default function TasksPage() {
  const { state, actions } = useAppStore();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const todayKey = formatDateKey(today);
  const tomorrowKey = formatDateKey(tomorrow);
  const activeWorkoutProgram =
    state.workoutPrograms.find(
      (program) => program.id === state.activeWorkoutProgramId,
    ) ?? state.workoutPrograms[0];
  const activeWorkoutPlan =
    activeWorkoutProgram?.workoutPlan?.length
      ? activeWorkoutProgram.workoutPlan
      : state.workoutPlan;
  const visibleModules = moduleCatalog.filter(
    (module) => state.settings.activeModules[module.id],
  );

  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<"week" | "month">("week");
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const current = new Date();
    current.setHours(0, 0, 0, 0);
    return current;
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    const current = new Date();
    current.setHours(0, 0, 0, 0);
    return current;
  });
  const [showCreateTaskForm, setShowCreateTaskForm] = useState(false);
  const selectedDateKey = formatDateKey(selectedDate);
  const selectedDateWeekday = getTodayWeekday(selectedDate);
  const selectedDateLabel = weekdayLongLabel(selectedDateWeekday);
  const isSelectedDateToday = selectedDateKey === todayKey;
  const isSelectedDateTomorrow = selectedDateKey === tomorrowKey;

  function buildAgendaForDate(targetDate: Date) {
    const targetDateKey = formatDateKey(targetDate);
    const targetWeekday = getTodayWeekday(targetDate);

    const manualAgendaItems = state.tasks
      .filter((task) => !hiddenLegacyTaskIds.has(task.id))
      .filter((task) => isTaskDueForDate(task, targetDate))
      .map<AgendaItem>((task) => {
        const completedForTargetDate = isTaskCompletedForDate(task, targetDate);
        const isSyncedTask = Boolean(task.sourceKey);
        const reminder = state.reminders.find(
          (item) => item.entityType === "task" && item.entityId === task.id,
        );

        return {
          id: `${targetDateKey}-manual-${task.id}`,
          kind: "manual",
          originType: isSyncedTask ? "synced" : "manual",
          originLabel: isSyncedTask ? "Sincronizada" : "Manual",
          title: task.title,
          description: task.description,
          categoryLabel: categoryLabels[task.category],
          sourceLabel: taskSourceLabel(task.moduleId),
          time: task.scheduledTime,
          completed: completedForTargetDate,
          reminderId: reminder?.id,
          reminderEnabled: reminder?.enabled ?? false,
          reminderConfig: {
            entityType: "task",
            entityId: task.id,
            title: task.title,
            time: task.scheduledTime || "09:00",
            weekdays: reminderWeekdaysFromTask(task.recurrence, targetWeekday),
          },
          moduleRoute: task.moduleId
            ? moduleCatalog.find((module) => module.id === task.moduleId)?.route
            : undefined,
          manualTaskId: task.id,
          canPostpone: targetDateKey === todayKey && !completedForTargetDate && !isSyncedTask,
          postponeLabel:
            task.recurrence.kind === "one-time" ? "Adiar para amanhã" : "Pular hoje",
          points: task.xp,
          recurrenceLabel: formatRecurrence(task.recurrence),
        };
      });

    const nutritionAgendaItems = state.mealPlan
      .filter((block) => {
        const reminder = state.reminders.find(
          (item) =>
            item.entityId === block.id &&
            (item.entityType === "meal" || item.entityType === "supplement"),
        );
        return reminder
          ? reminderMatchesToday(reminder.weekdays, targetWeekday)
          : true;
      })
      .map<AgendaItem>((block) => {
        const reminder = state.reminders.find(
          (item) =>
            item.entityId === block.id &&
            (item.entityType === "meal" || item.entityType === "supplement"),
        );
        const { foodCount, supplementCount, summaryText } = summarizeMealBlock(block);
        const completedItems = block.items.filter((item) =>
          isMealItemCompletedForDateKey(item, targetDateKey),
        ).length;

        return {
          id: `${targetDateKey}-nutrition-${block.id}`,
          kind: "nutrition",
          originType: "synced",
          originLabel: "Sincronizada",
          title: block.title,
          description:
            block.notes?.trim() ||
            `${summaryText} planejados para este horário.`,
          categoryLabel: "Nutrição",
          sourceLabel: mealSourceLabel(foodCount, supplementCount),
          time: reminder?.time || block.time,
          completed:
            block.items.length > 0
              ? block.items.every((item) => isMealItemCompletedForDateKey(item, targetDateKey))
              : false,
          reminderId: reminder?.id,
          reminderEnabled: reminder?.enabled ?? false,
          reminderConfig: {
            entityType: supplementCount && !foodCount ? "supplement" : "meal",
            entityId: block.id,
            title: block.title,
            time: block.time,
            weekdays: reminder?.weekdays ?? weekdays,
          },
          moduleRoute: "/modules/nutrition",
          detailHint: "Toque para ver alimentos, suplementos e observações.",
          detailItems: block.items.map((item) => ({
            id: `${targetDateKey}-${item.id}`,
            title: item.label,
            subtitle: buildMealDetailSubtitle(item),
            badge: item.kind === "supplement" ? "Suplemento" : "Alimento",
            tone: item.kind,
            completed: isMealItemCompletedForDateKey(item, targetDateKey),
            blockId: block.id,
            mealItemId: item.id,
          })),
          stats: [
            summaryText,
            `${completedItems}/${block.items.length} itens feitos`,
          ],
        };
      });

    const workoutAgendaItems = activeWorkoutPlan
      .filter((day) => day.weekday === targetWeekday && !day.isRestDay)
      .map<AgendaItem>((day) => {
        const reminder = state.reminders.find(
          (item) => item.entityId === day.id && item.entityType === "workout",
        );
        const latestDayLog = state.workoutLoadEntries
          .filter((entry) => entry.dayId === day.id)
          .sort(
            (left, right) =>
              new Date(right.loggedAt).getTime() - new Date(left.loggedAt).getTime(),
          )[0];
        const loggedForTargetDate = state.workoutLoadEntries.some(
          (entry) => entry.dayId === day.id && entry.loggedAt.slice(0, 10) === targetDateKey,
        );
        const markedCompleted = state.workoutDayCompletions.some(
          (completion) =>
            completion.dayId === day.id &&
            completion.dateKey === targetDateKey &&
            completion.programId ===
              (activeWorkoutProgram?.id ?? state.activeWorkoutProgramId),
        );

        return {
          id: `${targetDateKey}-workout-${day.id}`,
          kind: "workout",
          originType: "synced",
          originLabel: "Sincronizada",
          title: day.title,
          description: `${day.summary} ${
            day.focus ? `Foco em ${day.focus.toLowerCase()}.` : ""
          }`.trim(),
          categoryLabel: "Treino",
          sourceLabel: "Treino do dia",
          time: reminder?.time || "17:30",
          completed: loggedForTargetDate || markedCompleted,
          reminderId: reminder?.id,
          reminderEnabled: reminder?.enabled ?? false,
          reminderConfig: {
            entityType: "workout",
            entityId: day.id,
            title: day.title,
            time: reminder?.time || "17:30",
            weekdays: [day.weekday],
          },
          moduleRoute: `/modules/workout?dayId=${day.id}`,
          workoutDayId: day.id,
          workoutLoggedToday: loggedForTargetDate,
          workoutMarkedCompleted: markedCompleted,
          stats: [
            pluralize(day.exercises.length, "exercício"),
            latestDayLog
              ? `Último log ${formatShortDate(latestDayLog.loggedAt)}`
              : "sem carga registrada",
          ],
        };
      });

    return sortAgendaItems([
      ...manualAgendaItems,
      ...nutritionAgendaItems,
      ...workoutAgendaItems,
    ]);
  }

  const activeTimelineItems = buildAgendaForDate(selectedDate);
  const completedAgenda = activeTimelineItems.filter((item) => item.completed);
  const pendingAgenda = activeTimelineItems.filter((item) => !item.completed);
  const consistencyRate =
    activeTimelineItems.length > 0
      ? (completedAgenda.length / activeTimelineItems.length) * 100
      : 0;
  const activeTimelineBuckets = buildAgendaTimeline(activeTimelineItems).filter(
    (phase) => phase.items.length,
  );
  const featuredAgendaItemId = pendingAgenda[0]?.id ?? activeTimelineItems[0]?.id;
  const selectedDateSummaryLabel = selectedDate.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const visibleMonthLabel = calendarCursor
    .toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    })
    .replace(/^\p{L}/u, (letter) => letter.toUpperCase());

  function countAgendaEntriesForDate(targetDate: Date) {
    const targetWeekday = getTodayWeekday(targetDate);
    const tasksCount = state.tasks
      .filter((task) => !hiddenLegacyTaskIds.has(task.id))
      .filter((task) => isTaskDueForDate(task, targetDate)).length;

    const mealCount = state.mealPlan.filter((block) => {
      const reminder = state.reminders.find(
        (item) =>
          item.entityId === block.id &&
          (item.entityType === "meal" || item.entityType === "supplement"),
      );
      return reminder ? reminderMatchesToday(reminder.weekdays, targetWeekday) : true;
    }).length;

    const workoutCount = activeWorkoutPlan.filter(
      (day) => day.weekday === targetWeekday && !day.isRestDay,
    ).length;

    return tasksCount + mealCount + workoutCount;
  }

  const weekStart = new Date(calendarCursor);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(calendarCursor.getDate() - calendarCursor.getDay());

  const weeklyProgress = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + offset);
    const dateKey = formatDateKey(date);
    const weekday = getTodayWeekday(date);

    return {
      id: dateKey,
      date,
      dateLabel: String(date.getDate()).padStart(2, "0"),
      weekdayLabel: weekdayShortLabels[weekday],
      total: countAgendaEntriesForDate(date),
      isToday: dateKey === todayKey,
      isSelected: dateKey === selectedDateKey,
    };
  });
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weeklyRangeLabel = `${weekStart.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  })} - ${weekEnd.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;

  const monthStart = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
  const monthEnd = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 0);
  const monthLeadingSlots = monthStart.getDay();
  const totalMonthCells = Math.ceil((monthLeadingSlots + monthEnd.getDate()) / 7) * 7;
  const monthlyProgress = Array.from({ length: totalMonthCells }, (_, index) => {
    const dayNumber = index - monthLeadingSlots + 1;

    if (dayNumber < 1 || dayNumber > monthEnd.getDate()) {
      return null;
    }

    const date = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), dayNumber);
    const dateKey = formatDateKey(date);

    return {
      id: dateKey,
      date,
      dateLabel: String(dayNumber).padStart(2, "0"),
      total: countAgendaEntriesForDate(date),
      isToday: dateKey === todayKey,
      isSelected: dateKey === selectedDateKey,
    };
  });

  function moveCalendar(direction: -1 | 1) {
    setCalendarCursor((current) => {
      const next = new Date(current);
      next.setHours(0, 0, 0, 0);

      if (calendarView === "week") {
        next.setDate(next.getDate() + 7 * direction);
      } else {
        next.setDate(1);
        next.setMonth(next.getMonth() + direction);
      }

      return next;
    });
  }

  function focusDate(date: Date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    setSelectedDate(next);
    setCalendarCursor(next);
  }

  function renderAgendaItemCard(item: AgendaItem, options?: { featured?: boolean }) {
    const isExpanded = expandedItemId === item.id;
    const hasDetails =
      item.kind !== "workout" && Boolean(item.detailItems?.length);
    const tone = agendaItemToneClasses(item);
    const isCompleted = item.completed;
    const canUpdateSelectedDate = isSelectedDateToday;
    const detailBlockId = item.detailItems?.[0]?.blockId;
    const canToggleAllDetails =
      item.kind === "nutrition" &&
      Boolean(detailBlockId) &&
      Boolean(item.detailItems?.length);
    const canToggleAlarm = Boolean(item.reminderId || item.reminderConfig);
    const titleClass = isCompleted
      ? "mt-3 break-words text-xl font-semibold uppercase tracking-[-0.03em] text-zinc-500 line-through decoration-slate-500/80"
      : "mt-3 break-words text-xl font-semibold uppercase tracking-[-0.03em] text-white";
    const descriptionClass = isCompleted
      ? "mt-2 break-words text-sm leading-6 text-zinc-500 line-through decoration-slate-600/70"
      : item.kind === "workout"
        ? "mt-2 break-words text-sm leading-6 text-zinc-300"
        : "mt-2 break-words text-sm leading-6 text-zinc-500";
    const statClass = isCompleted
      ? "rounded-full border border-slate-200/10 bg-slate-300/6 px-3 py-1.5 text-zinc-500 line-through decoration-slate-500/80"
      : item.kind === "workout"
        ? `rounded-full border px-3 py-1.5 ${tone.badge}`
        : "rounded-full border border-zinc-800 bg-[rgba(18,18,20,0.98)] px-3 py-1.5";

    return (
      <div
        key={item.id}
        className={`rounded-[20px] border px-4 py-4 md:px-5 ${tone.card} ${
          options?.featured && !isCompleted
            ? "border-emerald-400/35 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(24,24,26,0.98))] shadow-[0_0_0_1px_rgba(16,185,129,0.12)]"
            : ""
        } ${isCompleted ? "opacity-80" : ""
        }`}
      >
        <div className="grid gap-4 lg:grid-cols-[96px_minmax(0,1fr)_228px]">
          <div className="flex min-h-[92px] items-center border-b border-zinc-800/80 pb-4 lg:min-h-0 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-5">
            <div className="text-left lg:text-center">
              <span className="whitespace-nowrap text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              {item.time ? "Horário" : "Fluxo"}
              </span>
              <div className="mt-3 whitespace-nowrap text-[2.1rem] font-semibold leading-none tracking-tight tabular-nums text-white">
                {item.time || "--:--"}
              </div>
            </div>
          </div>

          {item.kind === "workout" && item.moduleRoute ? (
            <Link href={item.moduleRoute} className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-zinc-300">
                <span className={`rounded-full border px-3 py-1.5 ${tone.badge}`}>
                  {item.categoryLabel}
                </span>
                <span className="rounded-full border border-zinc-800 bg-[rgba(18,18,20,0.96)] px-3 py-1.5 text-zinc-300">
                  {item.originLabel}
                </span>
              </div>
              <p className={titleClass}>{item.title}</p>
              <p className={descriptionClass}>{item.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                <span>{item.sourceLabel}</span>
              </div>
              {item.stats?.length ? (
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  {item.stats.map((stat) => (
                    <span key={stat} className={statClass}>
                      {stat}
                    </span>
                  ))}
                </div>
              ) : null}
              <p
                className={`mt-3 text-xs ${
                  isCompleted ? "text-zinc-500" : "text-rose-100/85"
                }`}
              >
                {item.workoutLoggedToday
                  ? "Treino salvo no histórico de carga."
                  : isCompleted
                    ? "Treino marcado como concluído hoje."
                    : "Toque para abrir o treino do dia."}
              </p>
            </Link>
          ) : hasDetails ? (
            <button
              type="button"
              onClick={() => toggleDetails(item.id)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-zinc-300">
                <span className={`rounded-full border px-3 py-1.5 ${tone.badge}`}>
                  {item.categoryLabel}
                </span>
                <span className="rounded-full border border-zinc-800 bg-[rgba(18,18,20,0.96)] px-3 py-1.5 text-zinc-300">
                  {item.originLabel}
                </span>
              </div>
              <p className={titleClass}>{item.title}</p>
              <p className={descriptionClass}>{item.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                <span>{item.sourceLabel}</span>
              </div>
              {item.stats?.length ? (
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  {item.stats.map((stat) => (
                    <span key={stat} className={statClass}>
                      {stat}
                    </span>
                  ))}
                </div>
              ) : null}
              <div
                className={`mt-3 inline-flex items-center gap-2 text-xs ${
                  isCompleted ? "text-zinc-500" : "text-[var(--accent)]"
                }`}
              >
                {item.detailHint}
                {isExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </div>
            </button>
          ) : (
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-zinc-300">
                <span className={`rounded-full border px-3 py-1.5 ${tone.badge}`}>
                  {item.categoryLabel}
                </span>
                <span className="rounded-full border border-zinc-800 bg-[rgba(18,18,20,0.96)] px-3 py-1.5 text-zinc-300">
                  {item.originLabel}
                </span>
              </div>
              <p className={titleClass}>{item.title}</p>
              <p className={descriptionClass}>{item.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                <span>{item.sourceLabel}</span>
              </div>
              {item.recurrenceLabel ? (
                <p
                  className={`mt-3 text-xs ${
                    isCompleted
                      ? "text-zinc-500 line-through decoration-slate-600/70"
                      : "text-[var(--accent)]"
                  }`}
                >
                  {item.recurrenceLabel}
                </p>
              ) : null}
            </div>
          )}

          <div className="flex w-full shrink-0 flex-col gap-2 xl:w-auto xl:min-w-[220px]">
            {item.manualTaskId ? (
              <>
                {canUpdateSelectedDate ? (
                  <button
                    type="button"
                    onClick={() => actions.toggleTask(item.manualTaskId!)}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-[10px] border px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                      item.completed
                        ? "border-zinc-800 bg-[rgba(18,18,20,0.98)] text-zinc-300"
                        : "border-emerald-400/30 bg-emerald-400/14 text-emerald-100 shadow-[0_0_14px_rgba(16,185,129,0.12)]"
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {item.completed ? "Marcar como pendente" : "Marcar como concluída"}
                  </button>
                ) : null}
                {item.canPostpone ? (
                  <button
                    type="button"
                    onClick={() =>
                      actions.updateTask({
                        taskId: item.manualTaskId!,
                        patch: {
                          completed: false,
                          completedAt: undefined,
                          deferUntilDate: tomorrowKey,
                        },
                      })
                    }
                    className="inline-flex w-full items-center justify-center rounded-[10px] border border-zinc-800 bg-[rgba(18,18,20,0.98)] px-3 py-3 text-[11px] uppercase tracking-[0.14em] text-zinc-300"
                  >
                    {item.postponeLabel}
                  </button>
                ) : null}
              </>
            ) : item.workoutDayId ? (
              item.workoutLoggedToday ? (
                <div className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] border border-zinc-800 bg-[rgba(18,18,20,0.98)] px-3 py-3 text-center text-[11px] uppercase tracking-[0.14em] text-zinc-300">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                  Treino salvo no histórico
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    actions.toggleWorkoutDayCompleted({
                      dayId: item.workoutDayId!,
                      dateKey: selectedDateKey,
                    })
                  }
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-[10px] border px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                    item.completed
                      ? "border-zinc-800 bg-[rgba(18,18,20,0.98)] text-zinc-300"
                      : "border-emerald-400/30 bg-emerald-400/14 text-emerald-100 shadow-[0_0_14px_rgba(16,185,129,0.12)]"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {item.completed
                    ? "Marcar treino como pendente"
                    : "Marcar treino como concluído"}
                </button>
              )
            ) : canToggleAllDetails ? (
              canUpdateSelectedDate ? (
                <button
                  type="button"
                  onClick={() =>
                    actions.setMealBlockItemsCompleted({
                      blockId: detailBlockId!,
                      completed: !item.completed,
                    })
                  }
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-[10px] border px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                    item.completed
                      ? "border-zinc-800 bg-[rgba(18,18,20,0.98)] text-zinc-300"
                      : "border-emerald-400/30 bg-emerald-400/14 text-emerald-100 shadow-[0_0_14px_rgba(16,185,129,0.12)]"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {item.completed ? "Desmarcar refeição" : "Concluir refeição"}
                </button>
              ) : null
            ) : null}

            {item.moduleRoute ? (
              <Link
                href={item.moduleRoute}
                className="inline-flex w-full items-center justify-center rounded-[10px] border border-zinc-800 bg-[rgba(18,18,20,0.98)] px-3 py-3 text-[11px] uppercase tracking-[0.14em] text-zinc-300"
              >
                {item.kind === "workout" ? "Abrir treino" : "Abrir"}
              </Link>
            ) : null}

            {canToggleAlarm ? (
              <button
                type="button"
                onClick={() => handleAlarmToggle(item)}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-[10px] border px-3 py-3 text-[11px] uppercase tracking-[0.14em] ${
                  item.reminderEnabled
                    ? "border-emerald-400/24 bg-emerald-400/10 text-emerald-100"
                    : "border-zinc-800 bg-[rgba(18,18,20,0.98)] text-zinc-300"
                }`}
              >
                {item.reminderEnabled ? (
                  <Bell className="h-3.5 w-3.5" />
                ) : (
                  <BellOff className="h-3.5 w-3.5" />
                )}
                {item.reminderEnabled ? "Alarme ligado" : "Ligar alarme"}
              </button>
            ) : null}
          </div>
        </div>

        {hasDetails && isExpanded ? (
          <div className="mt-4 border-t border-zinc-800 pt-4">
            <div className="space-y-3">
              {item.detailItems?.map((detail) => {
                const detailTone = detailToneClasses(detail.tone);

                return (
                  <div
                    key={detail.id}
                    className={`flex items-start justify-between gap-3 rounded-sm border px-4 py-3 ${
                      detail.completed
                        ? "border-slate-200/10 bg-slate-300/5 opacity-80"
                        : detailTone.card
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                        <span
                          className={`rounded-sm border px-3 py-1.5 ${
                            detail.completed
                              ? "border-slate-200/10 bg-slate-300/8 text-zinc-300"
                              : detailTone.badge
                          }`}
                        >
                          {detail.badge}
                        </span>
                        {detail.completed !== undefined ? (
                          <span className="rounded-sm border border-zinc-800 bg-[rgba(18,18,20,0.96)] px-3 py-1.5">
                            {detail.completed ? "Concluído" : "Pendente"}
                          </span>
                        ) : null}
                      </div>
                      <p
                        className={`mt-2 font-medium ${
                          detail.completed
                            ? "text-zinc-500 line-through decoration-slate-500/80"
                            : "text-white"
                        }`}
                      >
                        {detail.title}
                      </p>
                      <p
                        className={`mt-1 text-sm leading-6 ${
                          detail.completed
                            ? "text-zinc-500 line-through decoration-slate-600/70"
                            : "text-zinc-500"
                        }`}
                      >
                        {detail.subtitle}
                      </p>
                    </div>

                    {detail.blockId && detail.mealItemId && canUpdateSelectedDate ? (
                      <button
                        type="button"
                        onClick={() =>
                          actions.toggleMealItemCompleted({
                            blockId: detail.blockId!,
                            itemId: detail.mealItemId!,
                          })
                        }
                        className={`rounded-sm border px-3 py-2 text-xs ${
                          detail.completed
                            ? "border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] text-emerald-100"
                            : "border-zinc-800 bg-[rgba(18,18,20,0.98)] text-zinc-300"
                        }`}
                      >
                        {detail.completed ? "Desfazer" : "Concluir"}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function handleAlarmToggle(item: AgendaItem) {
    if (item.reminderId) {
      actions.toggleReminder(item.reminderId);
      return;
    }

    if (!item.reminderConfig) return;
    actions.addReminder(item.reminderConfig);
  }

  function toggleDetails(itemId: string) {
    setExpandedItemId((current) => (current === itemId ? null : itemId));
  }

  return (
    <div className="space-y-6">
      <GlassPanel className="overflow-hidden border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_38%),rgba(10,10,12,0.96)]">
        <div className="space-y-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.32em] text-emerald-300">
                Linha do tempo
              </p>
              <h1 className="mt-3 text-4xl font-semibold uppercase tracking-[-0.04em] text-white sm:text-5xl">
                Tarefas em modo execução
              </h1>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowCreateTaskForm((current) => !current)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                  showCreateTaskForm
                    ? "border-emerald-400/40 bg-emerald-400/14 text-emerald-100"
                    : "border-zinc-800 bg-[rgba(18,18,20,0.98)] text-white hover:border-zinc-700"
                }`}
              >
                <Plus className="h-4 w-4" />
                {showCreateTaskForm ? "Fechar criação" : "Nova meta"}
              </button>
              <button
                type="button"
                onClick={() => focusDate(today)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                  isSelectedDateToday
                    ? "border-emerald-400/40 bg-emerald-400/14 text-emerald-100"
                    : "border-zinc-800 bg-[rgba(18,18,20,0.98)] text-zinc-300"
                }`}
              >
                <CalendarDays className="h-4 w-4" />
                Hoje
              </button>
              <button
                type="button"
                onClick={() => focusDate(tomorrow)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                  isSelectedDateTomorrow
                    ? "border-emerald-400/40 bg-emerald-400/14 text-emerald-100"
                    : "border-zinc-800 bg-[rgba(18,18,20,0.98)] text-zinc-300"
                }`}
              >
                <ArrowRight className="h-4 w-4" />
                Amanhã
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                Calendário de tarefas
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                {calendarView === "week"
                  ? "Visualização semanal do volume de execução."
                  : "Visualização mensal para enxergar carga e distribuição."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => moveCalendar(-1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-[rgba(18,18,20,0.98)] text-zinc-300 transition hover:border-zinc-700"
                aria-label={
                  calendarView === "week" ? "Semana anterior" : "Mês anterior"
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="rounded-full border border-zinc-800 bg-[rgba(18,18,20,0.98)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-zinc-300">
                {calendarView === "week" ? weeklyRangeLabel : visibleMonthLabel}
              </span>
              <button
                type="button"
                onClick={() => moveCalendar(1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-[rgba(18,18,20,0.98)] text-zinc-300 transition hover:border-zinc-700"
                aria-label={
                  calendarView === "week" ? "Próxima semana" : "Próximo mês"
                }
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCalendarView("week")}
                className={`inline-flex items-center rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                  calendarView === "week"
                    ? "border-emerald-400/40 bg-emerald-400/14 text-emerald-100"
                    : "border-zinc-800 bg-[rgba(18,18,20,0.98)] text-zinc-300"
                }`}
              >
                Semanal
              </button>
              <button
                type="button"
                onClick={() => setCalendarView("month")}
                className={`inline-flex items-center rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                  calendarView === "month"
                    ? "border-emerald-400/40 bg-emerald-400/14 text-emerald-100"
                    : "border-zinc-800 bg-[rgba(18,18,20,0.98)] text-zinc-300"
                }`}
              >
                Mensal
              </button>
            </div>
          </div>

          {calendarView === "week" ? (
            <div className="overflow-x-auto pb-1">
              <div className="grid min-w-[720px] gap-3 grid-cols-7">
                {weeklyProgress.map((day) => (
                  <button
                    type="button"
                    key={day.id}
                    onClick={() => focusDate(day.date)}
                    className={`rounded-[22px] border px-4 py-4 text-center transition ${
                      day.isSelected
                        ? "border-emerald-400/45 bg-[rgba(16,185,129,0.12)] shadow-[0_0_0_1px_rgba(16,185,129,0.14)]"
                        : day.isToday
                        ? "border-emerald-400/45 bg-[rgba(16,185,129,0.12)] shadow-[0_0_0_1px_rgba(16,185,129,0.14)]"
                        : "border-zinc-800 bg-[rgba(18,18,20,0.88)]"
                    }`}
                  >
                    <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                      {day.weekdayLabel}
                    </p>
                    <div className="mt-4 flex items-center justify-center">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-full border text-lg font-semibold ${
                          day.isSelected || day.isToday
                            ? "border-emerald-400/40 bg-emerald-400/12 text-emerald-100"
                            : "border-zinc-800 bg-black/40 text-white"
                        }`}
                      >
                        {day.dateLabel}
                      </div>
                    </div>
                    <p className="mt-4 text-xs uppercase tracking-[0.18em] text-zinc-500">
                      {day.total} tarefas
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto pb-1">
              <div className="min-w-[720px] space-y-3">
                <div className="grid grid-cols-7 gap-3">
                  {calendarHeaderLabels.map((label) => (
                    <div
                      key={label}
                      className="rounded-[16px] border border-zinc-800 bg-[rgba(18,18,20,0.88)] px-3 py-3 text-center text-[11px] uppercase tracking-[0.24em] text-zinc-500"
                    >
                      {label}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-3">
                  {monthlyProgress.map((day, index) =>
                    day ? (
                      <button
                        type="button"
                        key={day.id}
                        onClick={() => focusDate(day.date)}
                        className={`min-h-[96px] rounded-[20px] border px-3 py-3 transition ${
                          day.isSelected
                            ? "border-emerald-400/45 bg-[rgba(16,185,129,0.12)] shadow-[0_0_0_1px_rgba(16,185,129,0.14)]"
                            : day.isToday
                              ? "border-emerald-400/25 bg-[rgba(16,185,129,0.08)]"
                              : "border-zinc-800 bg-[rgba(18,18,20,0.88)]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-sm font-semibold ${
                              day.isSelected || day.isToday ? "text-white" : "text-zinc-300"
                            }`}
                          >
                            {day.dateLabel}
                          </span>
                          {day.total > 0 ? (
                            <span className="rounded-full border border-zinc-800 bg-black/30 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                              {day.total}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-5 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                          {day.total > 0 ? `${day.total} tarefas` : "Sem tarefas"}
                        </p>
                      </button>
                    ) : (
                      <div
                        key={`empty-${index}`}
                        className="min-h-[96px] rounded-[20px] border border-dashed border-zinc-900 bg-[rgba(10,10,12,0.4)]"
                      />
                    ),
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </GlassPanel>

      <div className="space-y-6">
        <GlassPanel className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                Dia em foco
              </p>
              <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[-0.04em] text-white">
                Tarefas
              </h2>
              <p className="mt-2 text-sm text-zinc-500">{selectedDateSummaryLabel}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-zinc-800 bg-[rgba(18,18,20,0.98)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-zinc-300">
                {activeTimelineItems.length} tarefas
              </span>
              <span className="rounded-full border border-zinc-800 bg-[rgba(18,18,20,0.98)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-zinc-300">
                {pendingAgenda.length} pendentes
              </span>
            </div>
          </div>

          <div className="rounded-[22px] border border-zinc-800 bg-[rgba(18,18,20,0.9)] px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                  Consistência diária
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {Math.round(consistencyRate)}%
                </p>
              </div>
              <span className="rounded-full border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-zinc-300">
                {completedAgenda.length}/{activeTimelineItems.length || 0}
              </span>
            </div>
            <div className="mt-4">
              <ProgressBar value={consistencyRate} />
            </div>
          </div>

          {showCreateTaskForm ? (
            <div className="rounded-[24px] border border-zinc-800 bg-[rgba(14,14,17,0.96)] p-5">
              <div className="space-y-4">
                <p className="text-sm leading-6 text-zinc-300">
                  Toda nova meta nasce dentro de um módulo. Escolha a frente e
                  o app te leva direto para a criação certa.
                </p>

                {visibleModules.length ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {visibleModules.map((module) => (
                      <Link
                        key={module.id}
                        href={module.route}
                        onClick={() => setShowCreateTaskForm(false)}
                        className={`rounded-[20px] border border-zinc-800 bg-gradient-to-br ${module.color} p-4 transition hover:-translate-y-0.5`}
                      >
                        <p className={`text-sm font-semibold ${module.accent}`}>
                          {module.name}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-zinc-200">
                          {module.description}
                        </p>
                        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-zinc-300">
                          Abrir módulo
                        </p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[18px] border border-dashed border-zinc-800 px-4 py-6 text-sm text-zinc-500">
                    Nenhum módulo ativo no momento. Reative os módulos em
                    Configurações para criar novas metas.
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {activeTimelineItems.length ? (
            <div className="space-y-6">
              {activeTimelineBuckets.map((phase) => {
                const phaseProgress =
                  phase.total > 0 ? (phase.completed / phase.total) * 100 : 0;

                return (
                  <section
                    key={phase.id}
                    className="rounded-[26px] border border-zinc-800 bg-[rgba(24,24,26,0.94)] p-4 md:p-5"
                  >
                    <div className="space-y-4">
                      <div className="flex flex-col gap-4 border-l-2 border-emerald-400 pl-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10">
                            <Clock3 className="h-5 w-5 text-emerald-300" />
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">
                              {phase.window}
                            </p>
                            <h3 className="mt-1 text-[1.75rem] font-semibold uppercase tracking-[-0.04em] text-white">
                              {phase.label}
                            </h3>
                            <p className="mt-1 text-sm text-zinc-500">
                              {phase.description}
                            </p>
                          </div>
                        </div>

                        <div className="min-w-[180px]">
                          <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-zinc-500">
                            <span>Progresso</span>
                            <span>
                              {phase.completed}/{phase.total}
                            </span>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full border border-zinc-800 bg-black/40">
                            <div
                              className="h-full rounded-full bg-[linear-gradient(90deg,#10b981_0%,#34d399_100%)]"
                              style={{ width: `${phaseProgress}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {phase.items.map((item) =>
                          renderAgendaItemCard(item, {
                            featured: item.id === featuredAgendaItemId,
                          }),
                        )}
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-zinc-800 px-5 py-10 text-center text-sm text-zinc-500">
              {isSelectedDateToday
                ? "Nada programado para hoje."
                : `Nada programado para ${selectedDateLabel.toLowerCase()}.`}
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}

