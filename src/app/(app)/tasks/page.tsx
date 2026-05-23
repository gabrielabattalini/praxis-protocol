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
import { RxPBar } from "@/components/redesign/primitives";
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

const phaseAccent: Record<
  "morning" | "afternoon" | "night" | "unscheduled",
  { border: string; bg: string; color: string }
> = {
  morning: {
    border: "rgba(56,189,248,0.3)",
    bg: "rgba(56,189,248,0.08)",
    color: "#7dd3fc",
  },
  afternoon: {
    border: "rgba(251,146,60,0.3)",
    bg: "rgba(251,146,60,0.08)",
    color: "#fdba74",
  },
  night: {
    border: "rgba(167,139,250,0.3)",
    bg: "rgba(167,139,250,0.08)",
    color: "#c4b5fd",
  },
  unscheduled: {
    border: "rgba(113,113,122,0.3)",
    bg: "rgba(39,39,42,0.4)",
    color: "#a1a1aa",
  },
};

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
    window: "",
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
  // visibleMonthLabel + weeklyRangeLabel deleted — the badge that
  // showed them between the prev/next arrows was removed for being
  // redundant with the calendar grid itself.

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
    const isCompleted = item.completed;
    const canUpdateSelectedDate = isSelectedDateToday;
    const detailBlockId = item.detailItems?.[0]?.blockId;
    const canToggleAllDetails =
      item.kind === "nutrition" &&
      Boolean(detailBlockId) &&
      Boolean(item.detailItems?.length);
    const canToggleAlarm = Boolean(item.reminderId || item.reminderConfig);

    const cardClasses = [
      "item-card",
      isCompleted ? "completed" : "",
      options?.featured && !isCompleted ? "featured" : "",
      !isCompleted && !options?.featured && item.kind === "workout"
        ? "accent-card"
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    const titleStyle: React.CSSProperties = isCompleted
      ? {
          fontSize: 16,
          fontWeight: 600,
          color: "#71717a",
          textDecoration: "line-through",
          textAlign: "center",
        }
      : {
          fontSize: 16,
          fontWeight: 600,
          color: "var(--fg)",
          textAlign: "center",
        };

    // descriptionStyle + categoryBadgeClass removed — both were only
    // consumed by the badge row / description / sourceLabel block that
    // was deleted in this commit. Keeping the data fields in AgendaItem
    // so the values stay reachable for any future detail view.

    return (
      <div
        key={item.id}
        className={cardClasses}
        style={{ display: "grid", gap: 16 }}
      >
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "minmax(0,1fr)",
          }}
          className="lg:grid-cols-[80px_minmax(0,1fr)_220px]"
        >
          {/* Time block */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              textAlign: "center",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--fg-3)",
              }}
            >
              {/* "Fluxo" caption for untimed tasks removed — looked like
                  filler text. When there's no time we hide the label and
                  show "—" below instead of "--:--". */}
              {item.time ? "Horário" : ""}
            </span>
            <div
              style={{
                fontFamily: "var(--font-space-grotesk), sans-serif",
                fontSize: 28,
                fontWeight: 600,
                lineHeight: 1,
                letterSpacing: "-0.02em",
                color: isCompleted ? "#a1a1aa" : "var(--fg)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {item.time || "—"}
            </div>
          </div>

          {/* Body */}
          {item.kind === "workout" && item.moduleRoute ? (
            <Link
              href={item.moduleRoute}
              style={{
                minWidth: 0,
                color: "inherit",
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              {/* Card body simplified: dropped the [categoria + Sincronizada]
                  badge row, the duplicated description line, and the
                  sourceLabel hint. Title carries the info; time chip is on
                  the left; recurrenceLabel ("Toda quinta-feira") below.
                  See commit message for the full rationale. */}
              <div style={titleStyle}>{item.title}</div>
              {item.stats?.length ? (
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  {item.stats.map((stat) => (
                    <span key={stat} className="badge badge-sm">
                      {stat}
                    </span>
                  ))}
                </div>
              ) : null}
              <p
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: isCompleted ? "#71717a" : "#fca5a5",
                }}
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
              style={{
                minWidth: 0,
                textAlign: "center",
                background: "transparent",
                border: "none",
                padding: 0,
                color: "inherit",
                cursor: "pointer",
                width: "100%",
              }}
            >
              {/* Card body simplified: dropped the [categoria + Sincronizada]
                  badge row, the duplicated description line, and the
                  sourceLabel hint. Title carries the info; time chip is on
                  the left; recurrenceLabel ("Toda quinta-feira") below.
                  See commit message for the full rationale. */}
              <div style={titleStyle}>{item.title}</div>
              {item.stats?.length ? (
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  {item.stats.map((stat) => (
                    <span key={stat} className="badge badge-sm">
                      {stat}
                    </span>
                  ))}
                </div>
              ) : null}
              <div
                style={{
                  marginTop: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  color: isCompleted ? "#71717a" : "var(--accent)",
                }}
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
            <div style={{ minWidth: 0, textAlign: "center" }}>
              {/* Card body simplified: dropped the [categoria + Sincronizada]
                  badge row, the duplicated description line, and the
                  sourceLabel hint. Title carries the info; time chip is on
                  the left; recurrenceLabel ("Toda quinta-feira") below.
                  See commit message for the full rationale. */}
              <div style={titleStyle}>{item.title}</div>
              {item.recurrenceLabel ? (
                <p
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    color: isCompleted ? "#71717a" : "var(--accent)",
                    textDecoration: isCompleted ? "line-through" : "none",
                  }}
                >
                  {item.recurrenceLabel}
                </p>
              ) : null}
            </div>
          )}

          {/* Actions */}
          <div
            className="task-actions"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              minWidth: 0,
            }}
          >
            {item.manualTaskId ? (
              <>
                {canUpdateSelectedDate ? (
                  <button
                    type="button"
                    onClick={() => actions.toggleTask(item.manualTaskId!)}
                    className={`v2-btn v2-btn-sm ${
                      item.completed ? "" : "v2-btn-ok"
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {item.completed
                      ? "Marcar como pendente"
                      : "Marcar como concluída"}
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
                    className="v2-btn v2-btn-sm v2-btn-ghost"
                  >
                    {item.postponeLabel}
                  </button>
                ) : null}
              </>
            ) : item.workoutDayId ? (
              item.workoutLoggedToday ? (
                <div className="v2-btn v2-btn-sm" style={{ cursor: "default" }}>
                  <CheckCircle2
                    className="h-3.5 w-3.5"
                    style={{ color: "var(--ok)" }}
                  />
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
                  className={`v2-btn v2-btn-sm ${
                    item.completed ? "" : "v2-btn-ok"
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
                  className={`v2-btn v2-btn-sm ${
                    item.completed ? "" : "v2-btn-ok"
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
                className="v2-btn v2-btn-sm v2-btn-ghost"
                style={{ textDecoration: "none" }}
              >
                {item.kind === "workout" ? "Abrir treino" : "Abrir"}
              </Link>
            ) : null}

            {canToggleAlarm ? (
              <button
                type="button"
                onClick={() => handleAlarmToggle(item)}
                className={`v2-btn v2-btn-sm ${
                  item.reminderEnabled ? "v2-btn-ok" : "v2-btn-ghost"
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
          <div
            style={{
              borderTop: "1px solid var(--line)",
              paddingTop: 14,
              display: "grid",
              gap: 10,
            }}
          >
            {item.detailItems?.map((detail) => {
              const detailTone = detailToneClasses(detail.tone);

              return (
                <div
                  key={detail.id}
                  className={`flex items-start justify-between gap-3 rounded-[14px] border px-4 py-3 ${
                    detail.completed
                      ? "border-slate-200/10 bg-slate-300/5 opacity-80"
                      : detailTone.card
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span
                        className={`rounded-full border px-3 py-1 ${
                          detail.completed
                            ? "border-slate-200/10 bg-slate-300/8 text-zinc-300"
                            : detailTone.badge
                        }`}
                      >
                        {detail.badge}
                      </span>
                      {detail.completed !== undefined ? (
                        <span className="rounded-full border border-zinc-800 bg-[rgba(18,18,20,0.96)] px-3 py-1 text-zinc-300">
                          {detail.completed ? "Concluído" : "Pendente"}
                        </span>
                      ) : null}
                    </div>
                    <p
                      className={`mt-2 font-medium ${
                        detail.completed
                          ? "text-zinc-500 line-through"
                          : "text-white"
                      }`}
                    >
                      {detail.title}
                    </p>
                    <p
                      className={`mt-1 text-sm leading-6 ${
                        detail.completed
                          ? "text-zinc-500 line-through"
                          : "text-zinc-500"
                      }`}
                    >
                      {detail.subtitle}
                    </p>
                  </div>

                  {detail.blockId &&
                  detail.mealItemId &&
                  canUpdateSelectedDate ? (
                    <button
                      type="button"
                      onClick={() =>
                        actions.toggleMealItemCompleted({
                          blockId: detail.blockId!,
                          itemId: detail.mealItemId!,
                        })
                      }
                      className={`v2-btn v2-btn-xs ${
                        detail.completed ? "v2-btn-ok" : "v2-btn-ghost"
                      }`}
                    >
                      {detail.completed ? "Desfazer" : "Concluir"}
                    </button>
                  ) : null}
                </div>
              );
            })}
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
    // Capped at max-w-4xl + mx-auto so the page sits as a centered column
    // instead of stretching edge-to-edge on widescreen monitors. On phones
    // the cap is larger than the viewport so the layout still uses the
    // full width naturally.
    <div className="mx-auto w-full max-w-4xl">
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div className="page-eyebrow" style={{ color: "var(--ok)" }}>
          Linha do tempo
        </div>
        <h1 className="page-title-v2">Tarefas em modo execução</h1>
        <p className="page-description-v2">
          Calendário, consistência e execução no mesmo eixo visual. Acompanhe o
          fluxo do dia em manhã, tarde e noite.
        </p>
      </div>

      {/* Controls + calendar */}
      <div className="glass glass-ok" style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              className="page-eyebrow"
              style={{ color: "var(--ok)", marginBottom: 6 }}
            >
              Calendário de tarefas
            </div>
            {/* Removed: "Visualização semanal/mensal" heading + the
                "Volume de execução por dia desta semana." description.
                The eyebrow above already labels this block, and the
                calendar grid below conveys the rest. */}
          </div>

          {/* Removed the Nova meta / Hoje / Amanhã action row. The Nova
              meta form heading further down still works if reached via
              the showCreateTaskForm flag from somewhere else; today's
              path is just the calendar grid. */}
        </div>

        {/* Calendar nav */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <button
            type="button"
            onClick={() => moveCalendar(-1)}
            className="v2-btn v2-btn-icon v2-btn-ghost"
            aria-label={
              calendarView === "week" ? "Semana anterior" : "Mês anterior"
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {/* Removed the "17 de mai. - 23 de mai. de 2026" range badge —
              the calendar grid below already shows the days, so the textual
              range was redundant. The arrows still scroll week/month. */}
          <button
            type="button"
            onClick={() => moveCalendar(1)}
            className="v2-btn v2-btn-icon v2-btn-ghost"
            aria-label={
              calendarView === "week" ? "Próxima semana" : "Próximo mês"
            }
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCalendarView("week")}
            className={`v2-btn v2-btn-sm ${
              calendarView === "week" ? "v2-btn-ok" : "v2-btn-ghost"
            }`}
          >
            Semanal
          </button>
          <button
            type="button"
            onClick={() => setCalendarView("month")}
            className={`v2-btn v2-btn-sm ${
              calendarView === "month" ? "v2-btn-ok" : "v2-btn-ghost"
            }`}
          >
            Mensal
          </button>
        </div>

        {/* Calendar grid */}
        {calendarView === "week" ? (
          // Removed the desktop-only minWidth: 720 so the 7-day strip fits
          // a 360px viewport (≈47px per column). The circle inside drops
          // to 36px on mobile via the .tasks-day-circle class below.
          <div style={{ overflowX: "auto", paddingBottom: 4 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                gap: 6,
              }}
            >
              {weeklyProgress.map((day) => {
                const active = day.isSelected || day.isToday;
                return (
                  <button
                    type="button"
                    key={day.id}
                    onClick={() => focusDate(day.date)}
                    className="tasks-day-button"
                    style={{
                      borderRadius: 16,
                      padding: "10px 4px",
                      textAlign: "center",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      border: active
                        ? "1px solid rgba(74,222,128,0.45)"
                        : "1px solid rgba(39,39,42,0.8)",
                      background: active
                        ? "rgba(74,222,128,0.1)"
                        : "rgba(18,18,20,0.88)",
                    }}
                  >
                    <div
                      className="field-label"
                      style={{
                        marginBottom: 0,
                        color: active ? "var(--ok)" : "#71717a",
                        fontSize: 9,
                      }}
                    >
                      {day.weekdayLabel}
                    </div>
                    <div
                      className="tasks-day-circle"
                      style={{
                        borderRadius: "50%",
                        margin: "6px auto",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 600,
                        border: active
                          ? "1px solid rgba(74,222,128,0.4)"
                          : "1px solid rgba(39,39,42,0.8)",
                        background: active
                          ? "rgba(74,222,128,0.12)"
                          : "rgba(0,0,0,0.4)",
                        color: active ? "#d1fae5" : "var(--fg)",
                      }}
                    >
                      {day.dateLabel}
                    </div>
                    <div
                      className="tasks-day-count"
                      style={{
                        color: active ? "var(--ok)" : "#71717a",
                      }}
                    >
                      {day.total} tarefas
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          // Month view: same treatment — drop the desktop minWidth so the
          // 7×N grid actually fits the phone viewport instead of forcing
          // a horizontal scroll the user might not realize they need.
          <div style={{ overflowX: "auto", paddingBottom: 4 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  gap: 4,
                }}
              >
                {calendarHeaderLabels.map((label) => (
                  <div
                    key={label}
                    style={{
                      borderRadius: 10,
                      border: "1px solid rgba(39,39,42,0.8)",
                      background: "rgba(18,18,20,0.88)",
                      padding: "6px 4px",
                      textAlign: "center",
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: 9,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "#71717a",
                    }}
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div
                className="tasks-month-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  gap: 4,
                }}
              >
                {monthlyProgress.map((day, index) =>
                  day ? (
                    <button
                      type="button"
                      key={day.id}
                      onClick={() => focusDate(day.date)}
                      className="tasks-month-cell"
                      style={{
                        borderRadius: 12,
                        transition: "all 0.15s",
                        border: day.isSelected
                          ? "1px solid rgba(74,222,128,0.45)"
                          : day.isToday
                            ? "1px solid rgba(74,222,128,0.25)"
                            : "1px solid rgba(39,39,42,0.8)",
                        background: day.isSelected
                          ? "rgba(74,222,128,0.1)"
                          : day.isToday
                            ? "rgba(74,222,128,0.06)"
                            : "rgba(18,18,20,0.88)",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span
                          className="tasks-month-cell-date"
                          style={{
                            fontWeight: 600,
                            color:
                              day.isSelected || day.isToday
                                ? "var(--fg)"
                                : "#a1a1aa",
                          }}
                        >
                          {day.dateLabel}
                        </span>
                        {day.total > 0 ? (
                          <span
                            className="badge badge-sm tasks-month-cell-badge"
                            style={{ padding: "1px 6px" }}
                          >
                            {day.total}
                          </span>
                        ) : null}
                      </div>
                      <p
                        className="tasks-month-cell-meta"
                        style={{
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                          color: "#71717a",
                        }}
                      >
                        {day.total > 0 ? `${day.total} tarefas` : "Sem tarefas"}
                      </p>
                    </button>
                  ) : (
                    <div
                      key={`empty-${index}`}
                      className="tasks-month-cell tasks-month-cell--empty"
                      style={{
                        borderRadius: 12,
                        border: "1px dashed rgba(39,39,42,0.6)",
                        background: "rgba(10,10,12,0.4)",
                      }}
                    />
                  ),
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            marginTop: 18,
          }}
        >
          <span className="badge">
            {activeTimelineItems.length} tarefas
          </span>
          <span className="badge badge-ok">
            {completedAgenda.length} concluídas
          </span>
          <span className="badge">{pendingAgenda.length} pendentes</span>
          <span className="badge" style={{ marginLeft: "auto" }}>
            {selectedDateSummaryLabel}
          </span>
        </div>
      </div>

      {/* Create task form */}
      {showCreateTaskForm ? (
        <div
          className="glass"
          style={{
            marginBottom: 20,
            borderColor: "rgba(74,222,128,0.2)",
          }}
        >
          <div className="field-label" style={{ marginBottom: 10 }}>
            Nova meta
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--fg-3)",
              lineHeight: 1.55,
              marginBottom: 14,
            }}
          >
            Toda nova meta nasce dentro de um módulo. Escolha a frente e o app
            te leva direto para a criação certa.
          </p>

          {visibleModules.length ? (
            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              {visibleModules.map((module) => (
                <Link
                  key={module.id}
                  href={module.route}
                  onClick={() => setShowCreateTaskForm(false)}
                  className={`item-card bg-gradient-to-br ${module.color}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <p
                    className={`text-sm font-semibold ${module.accent}`}
                    style={{ marginBottom: 6 }}
                  >
                    {module.name}
                  </p>
                  <p
                    style={{
                      fontSize: 13,
                      lineHeight: 1.55,
                      color: "var(--fg-2)",
                    }}
                  >
                    {module.description}
                  </p>
                  <p
                    style={{
                      marginTop: 10,
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: 10,
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: "#d4d4d8",
                    }}
                  >
                    Abrir módulo →
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div
              style={{
                borderRadius: 16,
                border: "1px dashed rgba(39,39,42,0.8)",
                padding: "20px 16px",
                fontSize: 13,
                color: "#71717a",
                textAlign: "center",
              }}
            >
              Nenhum módulo ativo no momento. Reative os módulos em
              Configurações para criar novas metas.
            </div>
          )}
        </div>
      ) : null}

      {/* Consistency KPI */}
      <div className="glass" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="field-label" style={{ marginBottom: 6 }}>
              Consistência diária
            </div>
            <div className="kpi-value">{Math.round(consistencyRate)}%</div>
            <div className="kpi-sub">{selectedDateSummaryLabel}</div>
          </div>
          <span className="badge">
            {completedAgenda.length}/{activeTimelineItems.length || 0}
          </span>
        </div>
        <div style={{ marginTop: 14 }}>
          <RxPBar value={consistencyRate} />
        </div>
      </div>

      {/* Timeline */}
      <div className="glass">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--fg)",
            }}
          >
            Tarefas
          </h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="badge badge-ok">
              {completedAgenda.length} concluídas
            </span>
            <span className="badge">{pendingAgenda.length} pendentes</span>
          </div>
        </div>

        {activeTimelineItems.length ? (
          <div style={{ display: "grid", gap: 24 }}>
            {activeTimelineBuckets.map((phase) => {
              const accent = phaseAccent[phase.id];
              return (
                <section key={phase.id}>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 0",
                      borderBottom: "1px solid rgba(39,39,42,0.5)",
                      marginBottom: 12,
                    }}
                  >
                    <span
                      className="badge"
                      style={{
                        borderColor: accent.border,
                        background: accent.bg,
                        color: accent.color,
                      }}
                    >
                      {phase.label}
                    </span>
                    {/* Removed the time-window caption ("05:00 - 11:59") —
                        the Manhã / Tarde / Noite label is enough on its own,
                        and the explicit range added noise without info. */}
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 11,
                        color: "#71717a",
                      }}
                    >
                      {phase.completed}/{phase.total} concluídas
                    </span>
                  </div>
                  <div style={{ display: "grid", gap: 14 }}>
                    {phase.items.map((item) =>
                      renderAgendaItemCard(item, {
                        featured: item.id === featuredAgendaItemId,
                      }),
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              borderRadius: 20,
              border: "1px dashed rgba(39,39,42,0.8)",
              padding: "40px 20px",
              textAlign: "center",
              color: "#71717a",
            }}
          >
            <Clock3
              className="h-5 w-5"
              style={{ color: "var(--fg-3)", margin: "0 auto 10px" }}
            />
            <div style={{ fontSize: 14 }}>
              {isSelectedDateToday
                ? "Nada programado para hoje."
                : `Nada programado para ${selectedDateLabel.toLowerCase()}.`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
