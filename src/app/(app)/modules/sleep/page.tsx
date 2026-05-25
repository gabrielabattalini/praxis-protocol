"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  CalendarDays,
  MoonStar,
  Sunrise,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import { ProgressCurveChart } from "@/components/ui/progress-curve-chart";
import type {
  SleepLogEntry as PersistedSleepLogEntry,
  SleepWeeklyPlan as PersistedSleepWeeklyPlan,
  Weekday,
} from "@/lib/types";
import { weekdayLongLabel } from "@/lib/utils";

const selectFieldClassName =
  "praxis-field w-full appearance-none bg-[#0b0b0d] px-4 py-3 text-sm text-zinc-100 [color-scheme:dark]";
// Legacy localStorage keys — kept only so existing users get their
// data migrated into the central KV store on first load. After the
// migration, all sleep state lives in state.sleepPlan / state.sleepHistory.
const sleepPlanStorageKey = "praxis-protocol-sleep-weekly-plan";
const sleepHistoryStorageKey = "praxis-protocol-sleep-history-v1";
const hourOptions = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, "0"),
);
const minuteOptions = Array.from({ length: 12 }, (_, index) =>
  String(index * 5).padStart(2, "0"),
);

const weekdayMeta: Array<{ id: Weekday; shortLabel: string }> = [
  { id: "monday", shortLabel: "Seg" },
  { id: "tuesday", shortLabel: "Ter" },
  { id: "wednesday", shortLabel: "Qua" },
  { id: "thursday", shortLabel: "Qui" },
  { id: "friday", shortLabel: "Sex" },
  { id: "saturday", shortLabel: "Sáb" },
  { id: "sunday", shortLabel: "Dom" },
];

type SleepDayPlan = {
  enabled: boolean;
  bedtime: string;
  wakeTime: string;
};

type SleepWeeklyPlan = {
  recommendedHours: string;
  days: Record<Weekday, SleepDayPlan>;
};

type SleepLogEntry = {
  id: string;
  date: string;
  bedtime: string;
  wakeTime: string;
  hours: number;
  createdAt: string;
};

type SleepLogDraft = {
  date: string;
  bedtime: string;
  wakeTime: string;
};

function createDefaultSleepPlan(): SleepWeeklyPlan {
  // New accounts start with NO sleep definition — every day disabled,
  // no bedtime/wake times, no recommended hours. The user defines it.
  const emptyDay = { enabled: false, bedtime: "", wakeTime: "" };
  return {
    recommendedHours: "",
    days: {
      monday: { ...emptyDay },
      tuesday: { ...emptyDay },
      wednesday: { ...emptyDay },
      thursday: { ...emptyDay },
      friday: { ...emptyDay },
      saturday: { ...emptyDay },
      sunday: { ...emptyDay },
    },
  };
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

function getNextWeekday(day: Weekday): Weekday {
  const order: Weekday[] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  const index = order.indexOf(day);
  return order[(index + 1) % order.length] ?? day;
}

function parseHoursGoal(value: string) {
  if (value.includes(":")) {
    const [hours, minutes] = value.split(":").map((part) => Number(part));
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 8;
    return Math.min(12, Math.max(4, hours + minutes / 60));
  }

  const normalized = Number(value.replace(",", "."));
  if (!Number.isFinite(normalized)) return 8;
  return Math.min(12, Math.max(4, normalized));
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

function splitTime(value: string) {
  const [hours = "00", minutes = "00"] = value.split(":");
  return {
    hours: hours.padStart(2, "0"),
    minutes: minutes.padStart(2, "0"),
  };
}

function joinTime(hours: string, minutes: string) {
  return `${hours}:${minutes}`;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatSleepHistoryDate(dateKey: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${dateKey}T00:00:00`));
}

function getSleepDurationHours(bedtime: string, wakeTime: string) {
  const bedtimeMinutes = timeToMinutes(bedtime);
  const wakeMinutes = timeToMinutes(wakeTime);
  const rawDuration = wakeMinutes - bedtimeMinutes;
  const normalizedDuration = rawDuration > 0 ? rawDuration : rawDuration + 24 * 60;
  return normalizedDuration / 60;
}

function formatSleepHours(hours: number) {
  const roundedMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  return `${wholeHours}h${String(minutes).padStart(2, "0")}`;
}

function buildSleepDescriptions(
  day: Weekday,
  wakeDay: Weekday,
  bedtime: string,
  wakeTime: string,
  durationHours: number,
) {
  return {
    bedtime: `Dormir às ${bedtime} em ${weekdayLongLabel(day).toLowerCase()} para buscar ${formatSleepHours(durationHours)} de sono até ${wakeTime}.`,
    wake: `Acordar às ${wakeTime} em ${weekdayLongLabel(wakeDay).toLowerCase()} mantendo a consistência do cronograma semanal.`,
  };
}

type TimePickerFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

function TimePickerField({ label, value, onChange, disabled }: TimePickerFieldProps) {
  const time = splitTime(value);

  return (
    <label className="block min-w-0 space-y-2">
      <span className="praxis-label text-[var(--accent)]">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={time.hours}
          onChange={(event) => onChange(joinTime(event.target.value, time.minutes))}
          disabled={disabled}
          className={selectFieldClassName}
        >
          {hourOptions.map((hour) => (
            <option key={hour} value={hour}>
              {hour}
            </option>
          ))}
        </select>
        <select
          value={time.minutes}
          onChange={(event) => onChange(joinTime(time.hours, event.target.value))}
          disabled={disabled}
          className={selectFieldClassName}
        >
          {minuteOptions.map((minute) => (
            <option key={minute} value={minute}>
              {minute}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

export default function SleepModulePage() {
  const { state, actions } = useAppStore();
  const today = useMemo(() => new Date(), []);
  const todayWeekday = getTodayWeekday(today);
  // sleepPlan + sleepHistory now live in the central PersistedState
  // (KV-backed, syncs across devices). The localStorage keys are
  // ONLY consulted once for migration on first load.
  const sleepPlan = state.sleepPlan as SleepWeeklyPlan;
  const setSleepPlan = useCallback(
    (next: SleepWeeklyPlan | ((current: SleepWeeklyPlan) => SleepWeeklyPlan)) => {
      const resolved =
        typeof next === "function"
          ? (next as (current: SleepWeeklyPlan) => SleepWeeklyPlan)(sleepPlan)
          : next;
      actions.setSleepPlan(resolved as PersistedSleepWeeklyPlan);
    },
    [actions, sleepPlan],
  );
  const sleepHistory = state.sleepHistory as SleepLogEntry[];
  const setSleepHistory = useCallback(
    (
      next:
        | SleepLogEntry[]
        | ((current: SleepLogEntry[]) => SleepLogEntry[]),
    ) => {
      const resolved =
        typeof next === "function"
          ? (next as (current: SleepLogEntry[]) => SleepLogEntry[])(
              sleepHistory,
            )
          : next;
      actions.setSleepHistory(resolved as PersistedSleepLogEntry[]);
    },
    [actions, sleepHistory],
  );
  const [hasHydratedPlan, setHasHydratedPlan] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState("Carregando cronograma...");
  const [syncFeedback, setSyncFeedback] = useState("Sincronize o cronograma para gerar as tarefas do sono.");
  const [isSyncingTasks, setIsSyncingTasks] = useState(false);
  const [sleepDraft, setSleepDraft] = useState<SleepLogDraft>({
    date: localDateKey(),
    bedtime: "23:00",
    wakeTime: "07:00",
  });
  const [historyFeedback, setHistoryFeedback] = useState("Registre a noite real para alimentar a curva.");
  const syncInFlightRef = useRef(false);
  const autoSyncTimerRef = useRef<number | null>(null);

  function buildSaveLabel() {
    return `Salvo automaticamente às ${new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}.`;
  }

  // One-time migration: if the central store has no plan/history yet
  // but the old localStorage keys do, lift that data into the store
  // (which will then sync to KV across devices). After migrating, we
  // clean up the legacy keys so the user only ever has one source of
  // truth. hasHydratedPlan flips true once we've considered the
  // migration so the auto-save effects can fire.
  useEffect(() => {
    const planIsEmpty =
      !sleepPlan.recommendedHours &&
      Object.values(sleepPlan.days ?? {}).every(
        (day) => !day?.enabled && !day?.bedtime && !day?.wakeTime,
      );

    if (planIsEmpty) {
      try {
        const stored = window.localStorage.getItem(sleepPlanStorageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<SleepWeeklyPlan>;
          setSleepPlan({
            recommendedHours:
              parsed.recommendedHours ?? createDefaultSleepPlan().recommendedHours,
            days: {
              ...createDefaultSleepPlan().days,
              ...parsed.days,
            },
          });
        }
      } catch {
        // Ignore — defaults already apply.
      }
    }

    if (sleepHistory.length === 0) {
      try {
        const stored = window.localStorage.getItem(sleepHistoryStorageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as SleepLogEntry[];
          const valid = parsed
            .filter((entry) => entry?.date && entry?.bedtime && entry?.wakeTime)
            .sort((left, right) => right.date.localeCompare(left.date));
          if (valid.length) setSleepHistory(valid);
        }
      } catch {}
    }

    // Clean up the legacy keys whether or not we hit them — after the
    // first migration pass we never need them again.
    try {
      window.localStorage.removeItem(sleepPlanStorageKey);
      window.localStorage.removeItem(sleepHistoryStorageKey);
    } catch {}

    setHasHydratedPlan(true);
    setSaveFeedback(buildSaveLabel());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every time the plan or history changes, the central store
  // auto-debounces a save to KV (700ms). Surface a "Salvo às HH:MM"
  // feedback to the user so they know the change is persisted.
  useEffect(() => {
    if (!hasHydratedPlan) return;
    setSaveFeedback(buildSaveLabel());
  }, [hasHydratedPlan, sleepPlan, sleepHistory]);

  useEffect(() => {
    if (!hasHydratedPlan) return;
    const todayDefault = sleepPlan.days[todayWeekday];

    setSleepDraft((current) => {
      if (current.date !== localDateKey()) {
        return current;
      }

      const hasCustomValue =
        current.bedtime !== "23:00" || current.wakeTime !== "07:00";
      if (hasCustomValue) {
        return current;
      }

      return {
        ...current,
        bedtime: todayDefault?.bedtime ?? current.bedtime,
        wakeTime: todayDefault?.wakeTime ?? current.wakeTime,
      };
    });
  }, [hasHydratedPlan, sleepPlan.days, todayWeekday]);

  useEffect(() => {
    const seenSourceKeys = new Set<string>();
    const duplicateIds = state.tasks
      .filter(
        (task) =>
          task.moduleId === "sleep" && task.sourceKey?.startsWith("sleep-plan-"),
      )
      .flatMap((task) => {
        if (!task.sourceKey) {
          return [];
        }

        if (seenSourceKeys.has(task.sourceKey)) {
          return [task.id];
        }

        seenSourceKeys.add(task.sourceKey);
        return [];
      });

    if (!duplicateIds.length) {
      return;
    }

    duplicateIds.forEach((taskId) => {
      actions.removeTask(taskId);
    });
  }, [actions, state.tasks]);

  const recommendedHours = useMemo(
    () => parseHoursGoal(sleepPlan.recommendedHours),
    [sleepPlan.recommendedHours],
  );

  const weeklySleepData = useMemo(
    () =>
      weekdayMeta.map((item) => {
        const dayPlan = sleepPlan.days[item.id];
        const hasSleepWindow = dayPlan.enabled;
        const hours = hasSleepWindow
          ? getSleepDurationHours(dayPlan.bedtime, dayPlan.wakeTime)
          : 0;

        return {
          ...item,
          enabled: dayPlan.enabled,
          bedtime: dayPlan.bedtime,
          wakeTime: dayPlan.wakeTime,
          hours,
          withinTarget: hasSleepWindow && hours >= recommendedHours,
        };
      }),
    [recommendedHours, sleepPlan.days],
  );

  const activeDays = weeklySleepData.filter((item) => item.enabled);
  const averageSleepHours =
    activeDays.length > 0
      ? activeDays.reduce((sum, item) => sum + item.hours, 0) / activeDays.length
      : 0;
  const daysWithinTarget = activeDays.filter((item) => item.withinTarget).length;
  const todayPlan =
    weeklySleepData.find((item) => item.id === todayWeekday) ?? weeklySleepData[0];
  const recentSleepLogs = sleepHistory.slice(0, 4);
  const sleepHistoryMap = useMemo(
    () => new Map(sleepHistory.map((entry) => [entry.date, entry])),
    [sleepHistory],
  );
  const sleepEvolutionPoints = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() - (6 - index));
        const dateKey = localDateKey(date);
        const weekday = getTodayWeekday(date);
        const historyEntry = sleepHistoryMap.get(dateKey);
        const plannedEntry = weeklySleepData.find((item) => item.id === weekday);

        return {
          label: weekdayMeta.find((item) => item.id === weekday)?.shortLabel ?? weekday,
          value: historyEntry?.hours ?? (plannedEntry?.enabled ? plannedEntry.hours : 0),
          helper: historyEntry
            ? `${formatSleepHistoryDate(dateKey)} • real`
            : plannedEntry?.enabled
              ? `${formatSleepHistoryDate(dateKey)} • plano`
              : `${formatSleepHistoryDate(dateKey)} • sem rotina`,
        };
      }),
    [sleepHistoryMap, today, weeklySleepData],
  );
  const loggedSleepEntries = sleepHistory.filter((entry) => entry.hours > 0);
  const averageLoggedSleepHours =
    loggedSleepEntries.length > 0
      ? loggedSleepEntries.reduce((sum, entry) => sum + entry.hours, 0) /
        loggedSleepEntries.length
      : 0;
  const loggedDaysWithinTarget = loggedSleepEntries.filter(
    (entry) => entry.hours >= recommendedHours,
  ).length;
  const lastSleepLog = sleepHistory[0] ?? null;
  const chartMaxHours = Math.max(
    8.5,
    recommendedHours + 1.5,
    ...weeklySleepData.map((day) => (day.enabled ? day.hours : 0)),
  );
  const targetLineOffset = Math.min(100, (recommendedHours / chartMaxHours) * 100);

  function updateDayPlan(day: Weekday, patch: Partial<SleepDayPlan>) {
    setSleepPlan((current) => ({
      ...current,
      days: {
        ...current.days,
        [day]: {
          ...current.days[day],
          ...patch,
        },
      },
    }));
  }

  function saveSleepLog() {
    const hours = getSleepDurationHours(sleepDraft.bedtime, sleepDraft.wakeTime);
    if (hours <= 0) return;

    const nextEntry: SleepLogEntry = {
      id: `sleep-log-${sleepDraft.date}`,
      date: sleepDraft.date,
      bedtime: sleepDraft.bedtime,
      wakeTime: sleepDraft.wakeTime,
      hours,
      createdAt: new Date().toISOString(),
    };

    setSleepHistory((current) =>
      [nextEntry, ...current.filter((entry) => entry.date !== nextEntry.date)].sort(
        (left, right) => right.date.localeCompare(left.date),
      ),
    );
    setHistoryFeedback(`Histórico atualizado em ${formatSleepHistoryDate(sleepDraft.date)}.`);
  }

  const syncSleepTasks = useCallback(() => {
    if (syncInFlightRef.current) {
      return;
    }

    syncInFlightRef.current = true;
    setIsSyncingTasks(true);

    const generatedTasks = state.tasks.filter(
      (task) => task.moduleId === "sleep" && task.sourceKey?.startsWith("sleep-plan-"),
    );
    const duplicateGeneratedTaskIds: string[] = [];
    const taskBySource = new Map<string, (typeof generatedTasks)[number]>();

    generatedTasks.forEach((task) => {
      if (!task.sourceKey) {
        return;
      }

      if (taskBySource.has(task.sourceKey)) {
        duplicateGeneratedTaskIds.push(task.id);
        return;
      }

      taskBySource.set(task.sourceKey, task);
    });

    duplicateGeneratedTaskIds.forEach((taskId) => {
      actions.removeTask(taskId);
    });
    const activeKeys = new Set<string>();

    weekdayMeta.forEach((item) => {
      const dayPlan = sleepPlan.days[item.id];
      const bedtimeKey = `sleep-plan-bedtime-${item.id}`;
      const wakeKey = `sleep-plan-wake-${item.id}`;
      // The "wake" alarm fires on the SAME calendar day as the row —
      // user's mental model. e.g. configuring Domingo wake=10:00 means
      // "wake me at 10 on Sunday morning", NOT "wake me Monday morning
      // after sleeping Sunday night". (Old code did getNextWeekday(item.id)
      // and shoved Sunday's wake into Monday's agenda, displacing
      // every day's wake by one.)
      const wakeDay = item.id;

      if (!dayPlan.enabled) {
        return;
      }

      const durationHours = getSleepDurationHours(dayPlan.bedtime, dayPlan.wakeTime);
      const descriptions = buildSleepDescriptions(
        item.id,
        wakeDay,
        dayPlan.bedtime,
        dayPlan.wakeTime,
        durationHours,
      );

      const bedtimePayload = {
        title: "Dormir",
        description: descriptions.bedtime,
        category: "mindfulness" as const,
        moduleId: "sleep" as const,
        scheduledTime: dayPlan.bedtime,
        difficulty: "medium" as const,
        recurrence: { kind: "weekly-fixed" as const, weekday: item.id },
      };

      const wakePayload = {
        title: "Acordar",
        description: descriptions.wake,
        category: "mindfulness" as const,
        moduleId: "sleep" as const,
        scheduledTime: dayPlan.wakeTime,
        difficulty: "medium" as const,
        recurrence: { kind: "weekly-fixed" as const, weekday: wakeDay },
      };

      const existingBedtime = taskBySource.get(bedtimeKey);
      if (existingBedtime) {
        actions.updateTask({
          taskId: existingBedtime.id,
          patch: bedtimePayload,
        });
      } else {
        actions.addTask({
          ...bedtimePayload,
          sourceKey: bedtimeKey,
        });
      }

      const existingWake = taskBySource.get(wakeKey);
      if (existingWake) {
        actions.updateTask({
          taskId: existingWake.id,
          patch: wakePayload,
        });
      } else {
        actions.addTask({
          ...wakePayload,
          sourceKey: wakeKey,
        });
      }

      activeKeys.add(bedtimeKey);
      activeKeys.add(wakeKey);
    });

    taskBySource.forEach((task) => {
      if (task.sourceKey && !activeKeys.has(task.sourceKey)) {
        actions.removeTask(task.id);
      }
    });

    window.setTimeout(() => {
      syncInFlightRef.current = false;
      setIsSyncingTasks(false);
    }, 250);

    setSyncFeedback(
      `Cronograma sincronizado com ${activeKeys.size} tarefas automáticas do sono.`,
    );
  }, [actions, sleepPlan.days, state.tasks]);

  // Hold the latest syncSleepTasks in a ref so the auto-sync effect
  // does NOT re-fire when the callback's identity changes (which it does
  // every time state.tasks changes — i.e. every time we just synced).
  // Without this, sync → state.tasks update → useCallback recreates →
  // effect re-runs → sync again → infinite loop (visible as the
  // "Sincronizar com tarefas" button flashing between states).
  const syncSleepTasksRef = useRef(syncSleepTasks);
  syncSleepTasksRef.current = syncSleepTasks;

  useEffect(() => {
    if (!hasHydratedPlan) {
      return;
    }

    if (autoSyncTimerRef.current) {
      window.clearTimeout(autoSyncTimerRef.current);
    }

    autoSyncTimerRef.current = window.setTimeout(() => {
      syncSleepTasksRef.current();
      autoSyncTimerRef.current = null;
    }, 450);

    return () => {
      if (autoSyncTimerRef.current) {
        window.clearTimeout(autoSyncTimerRef.current);
        autoSyncTimerRef.current = null;
      }
    };
  }, [hasHydratedPlan, sleepPlan]);

  return (
    <div className="space-y-6">
      <div className="mod-hero">
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div className="mod-icon" style={{ width: 56, height: 56, borderRadius: 14, fontSize: 24 }}>🌙</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="praxis-label" style={{ color: "var(--accent)", marginBottom: 4 }}>▸ MÓDULO · SONO</div>
            <div className="praxis-title" style={{ fontSize: 26 }}>Rotina de descanso</div>
            <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
              Defina horário de dormir e acordar; o sistema gera a rotina automaticamente.
            </div>
          </div>
          <div className="mod-hero-side" style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div className="mod-hero-side-stat" style={{ textAlign: "right", borderLeft: "1px solid rgba(39,39,42,0.6)", paddingLeft: 16 }}>
              <div className="praxis-label" style={{ fontSize: 9 }}>HOJE</div>
              <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "var(--font-space-grotesk), sans-serif", marginTop: 2 }}>
                {todayPlan.enabled ? formatSleepHours(todayPlan.hours) : "--"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className="kpi">
          <div className="praxis-label">Meta diária</div>
          <div className="kpi-value" style={{ color: "var(--accent)" }}>{formatSleepHours(recommendedHours)}</div>
          <div className="kpi-sub">Horas por noite</div>
        </div>
        <div className="kpi">
          <div className="praxis-label">Média planejada</div>
          <div className="kpi-value">{formatSleepHours(averageSleepHours)}</div>
          <div className="kpi-sub">Semana ativa</div>
        </div>
        <div className="kpi">
          <div className="praxis-label">Dias na meta</div>
          <div className="kpi-value" style={{ color: "var(--ok)" }}>{daysWithinTarget}/{activeDays.length || 0}</div>
          <div className="kpi-sub">Dentro da recomendação</div>
        </div>
        <div className="kpi">
          <div className="praxis-label">Hoje</div>
          <div className="kpi-value">{todayPlan.enabled ? formatSleepHours(todayPlan.hours) : "--"}</div>
          <div className="kpi-sub">
            {todayPlan.enabled && todayPlan.withinTarget
              ? "Dentro da recomendação"
              : todayPlan.enabled
                ? "Abaixo da recomendação"
                : "Sem rotina ativa"}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <GlassPanel className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <CalendarDays className="h-6 w-6 shrink-0 text-[var(--accent)]" />
              <div className="min-w-0">
                <p className="praxis-label text-[var(--accent)]">Cronograma semanal</p>
                <h2 className="praxis-title break-words text-2xl leading-tight">
                  Horários de dormir e acordar
                </h2>
              </div>
            </div>

            <div className="min-w-[180px] lg:ml-auto lg:text-right">
              <TimePickerField
                label="Meta de sono"
                value={sleepPlan.recommendedHours}
                onChange={(value) =>
                  setSleepPlan((current) => ({
                    ...current,
                    recommendedHours: value,
                  }))
                }
              />
            </div>
          </div>

          <div className="space-y-3">
            {weeklySleepData.map((day) => (
              <div
                key={day.id}
                className={`flex flex-col gap-4 rounded-sm border p-4 ${
                  day.enabled
                    ? "border-zinc-800 bg-black/30"
                    : "border-zinc-900 bg-black/10 opacity-65"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="whitespace-nowrap font-medium text-zinc-100">
                      {weekdayLongLabel(day.id)}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {day.enabled
                        ? day.withinTarget
                          ? "Dentro da meta"
                          : "Abaixo da meta"
                        : "Desativado"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateDayPlan(day.id, { enabled: !day.enabled })}
                    className={`min-w-[76px] whitespace-nowrap rounded-sm border px-3 py-2 text-xs uppercase tracking-[0.14em] ${
                      day.enabled
                        ? "border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] text-[var(--accent)]"
                        : "border-zinc-800 bg-black/50 text-zinc-500"
                    }`}
                  >
                    {day.enabled ? "Ativo" : "Off"}
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <TimePickerField
                    label="Acordar"
                    value={day.wakeTime}
                    onChange={(value) => updateDayPlan(day.id, { wakeTime: value })}
                    disabled={!day.enabled}
                  />

                  <TimePickerField
                    label="Dormir"
                    value={day.bedtime}
                    onChange={(value) => updateDayPlan(day.id, { bedtime: value })}
                    disabled={!day.enabled}
                  />

                  <div className="flex min-w-0 items-center justify-between gap-3 rounded-sm border border-zinc-800 bg-[#0b0b0d] px-4 py-3 xl:min-w-[10rem] xl:flex-col xl:items-start xl:justify-center">
                    <p className="praxis-label text-zinc-500">Janela total</p>
                    <p className="font-title text-2xl font-bold text-zinc-100">
                      {day.enabled ? formatSleepHours(day.hours) : "--"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-zinc-800/80 pt-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm leading-6 text-zinc-500">{saveFeedback}</p>
              <p className="text-sm leading-6 text-zinc-500">{syncFeedback}</p>
            </div>
            <button
              type="button"
              onClick={syncSleepTasks}
              disabled={isSyncingTasks}
              className="praxis-button inline-flex items-center justify-center gap-2 px-4 py-3 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSyncingTasks ? "Sincronizando..." : "Sincronizar com tarefas"}
            </button>
          </div>
        </GlassPanel>

        <div className="space-y-6">
          <GlassPanel className="space-y-4">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-[var(--accent)]" />
              <div>
                <p className="praxis-label text-[var(--accent)]">Histórico real</p>
                <h2 className="praxis-title text-2xl">Curva do sono recente</h2>
              </div>
            </div>

            <ProgressCurveChart
              points={sleepEvolutionPoints}
              goalValue={recommendedHours}
              valueFormatter={(value) => formatSleepHours(value)}
              emptyLabel="Registre a primeira noite para sair do modo planejado."
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-sm border border-zinc-800 bg-black/30 p-4">
                <p className="praxis-label text-zinc-500">Média registrada</p>
                <p className="mt-2 font-title text-3xl font-bold text-zinc-100">
                  {loggedSleepEntries.length
                    ? formatSleepHours(averageLoggedSleepHours)
                    : "--"}
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  {loggedSleepEntries.length
                    ? `${loggedDaysWithinTarget}/${loggedSleepEntries.length} noites na meta`
                    : "Sem noites reais salvas ainda"}
                </p>
              </div>
              <div className="rounded-sm border border-zinc-800 bg-black/30 p-4">
                <p className="praxis-label text-zinc-500">Último registro</p>
                <p className="mt-2 font-title text-3xl font-bold text-zinc-100">
                  {lastSleepLog ? formatSleepHours(lastSleepLog.hours) : "--"}
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  {lastSleepLog
                    ? `${formatSleepHistoryDate(lastSleepLog.date)} • ${lastSleepLog.bedtime} → ${lastSleepLog.wakeTime}`
                    : "Aguardando a primeira noite real"}
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-sm border border-zinc-800 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="praxis-label text-[var(--accent)]">Registrar noite</p>
                  <p className="mt-1 text-sm text-zinc-500">{historyFeedback}</p>
                </div>
                <button
                  type="button"
                  onClick={saveSleepLog}
                  className="praxis-button px-4 py-2.5"
                >
                  Salvar noite
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="block space-y-2">
                  <span className="praxis-label text-[var(--accent)]">Data</span>
                  <input
                    type="date"
                    value={sleepDraft.date}
                    onChange={(event) =>
                      setSleepDraft((current) => ({
                        ...current,
                        date: event.target.value,
                      }))
                    }
                    className={selectFieldClassName}
                  />
                </label>
                <TimePickerField
                  label="Dormir real"
                  value={sleepDraft.bedtime}
                  onChange={(value) =>
                    setSleepDraft((current) => ({ ...current, bedtime: value }))
                  }
                />
                <TimePickerField
                  label="Acordar real"
                  value={sleepDraft.wakeTime}
                  onChange={(value) =>
                    setSleepDraft((current) => ({ ...current, wakeTime: value }))
                  }
                />
              </div>

              {recentSleepLogs.length ? (
                <div className="space-y-2 border-t border-zinc-800/80 pt-3">
                  {recentSleepLogs.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-3 rounded-sm border border-zinc-800 bg-black/30 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-zinc-100">
                          {formatSleepHistoryDate(entry.date)}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {entry.bedtime} → {entry.wakeTime}
                        </p>
                      </div>
                      <span className="font-headline text-lg font-bold text-[var(--accent)]">
                        {formatSleepHours(entry.hours)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </GlassPanel>

          <GlassPanel className="hidden space-y-4">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-[var(--accent)]" />
              <div>
                <p className="praxis-label text-[var(--accent)]">Gráfico semanal</p>
                <h2 className="praxis-title text-2xl">Sono planejado na semana</h2>
              </div>
            </div>

            <div className="rounded-sm border border-zinc-800 bg-black/30 p-4">
              <div className="mb-4 flex justify-end">
                <div className="rounded-sm bg-[#121214] px-2 py-1 font-mono text-[0.56rem] uppercase tracking-[0.2em] text-amber-300">
                  Meta {formatSleepHours(recommendedHours)}
                </div>
              </div>

              <div className="mb-3 grid grid-cols-7 gap-3">
                {weeklySleepData.map((day) => (
                  <p
                    key={`${day.id}-value`}
                    className="text-center text-xs text-zinc-500"
                  >
                    {day.enabled ? formatSleepHours(day.hours) : "--"}
                  </p>
                ))}
              </div>

              <div className="relative">
                <div
                  className="pointer-events-none absolute inset-x-0 border-t border-dashed border-amber-400/35"
                  style={{ bottom: `${targetLineOffset}%` }}
                />

                <div className="grid h-[238px] grid-cols-7 items-end gap-3">
                  {weeklySleepData.map((day) => {
                    const heightPercent = day.enabled ? (day.hours / chartMaxHours) * 100 : 6;

                    return (
                      <div
                        key={day.id}
                        className="flex h-full w-full items-end justify-center"
                      >
                        <div
                          className={`w-full max-w-[54px] rounded-sm border transition-all duration-700 ${
                            day.enabled
                              ? day.withinTarget
                                ? "border-[rgba(251,146,60,0.34)] bg-[linear-gradient(180deg,rgba(251,146,60,0.9),rgba(251,146,60,0.28))]"
                                : "border-zinc-700 bg-[linear-gradient(180deg,rgba(113,113,122,0.9),rgba(63,63,70,0.28))]"
                              : "border-zinc-900 bg-black/40"
                          }`}
                          style={{ height: `${Math.max(heightPercent, 8)}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-7 gap-3">
                {weeklySleepData.map((day) => (
                  <p
                    key={`${day.id}-label`}
                    className="font-mono text-center text-[0.58rem] uppercase tracking-[0.2em] text-zinc-500"
                  >
                    {day.shortLabel}
                  </p>
                ))}
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="space-y-4">
            <div>
              <p className="praxis-label text-[var(--accent)]">Hoje no sono</p>
              <h2 className="mt-1 praxis-title text-2xl">Leitura do dia</h2>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-sm border border-zinc-800 bg-black/30 p-4">
                <div className="flex items-center gap-2 text-[var(--accent)]">
                  <Sunrise className="h-4 w-4" />
                  Acordar
                </div>
                <p className="mt-3 break-words font-title text-2xl font-bold leading-tight text-zinc-100">
                  {todayPlan.wakeTime}
                </p>
              </div>

              <div className="rounded-sm border border-zinc-800 bg-black/30 p-4">
                <p className="praxis-label text-[var(--accent)]">Status</p>
                <p className="mt-3 break-words font-title text-xl font-bold leading-tight text-zinc-100">
                  {todayPlan.enabled
                    ? todayPlan.withinTarget
                      ? "Na meta"
                      : "Abaixo"
                    : "Desligado"}
                </p>
              </div>

              <div className="rounded-sm border border-zinc-800 bg-black/30 p-4">
                <div className="flex items-center gap-2 text-[var(--accent)]">
                  <MoonStar className="h-4 w-4" />
                  Dormir
                </div>
                <p className="mt-3 break-words font-title text-2xl font-bold leading-tight text-zinc-100">
                  {todayPlan.bedtime}
                </p>
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}


