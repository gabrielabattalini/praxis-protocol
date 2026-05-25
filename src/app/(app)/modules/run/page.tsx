"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock3,
  Plus,
  TimerReset,
  Trash2,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import { ProgressCurveChart } from "@/components/ui/progress-curve-chart";
import { formatMinutes, getStartOfWeek, sortEntriesByDate } from "@/lib/module-page-utils";
import type { PersistedState, Weekday } from "@/lib/types";

type CardioType = "walking" | "running" | "bike" | "elliptical" | "stairs";

type RunEntry = {
  id: string;
  date: string;
  createdAt: string;
  weekday: Weekday;
  distanceKm: number;
  durationSeconds: number;
};

type DailyTarget = {
  km: number;
  time: string;
  type: CardioType;
};

type RunState = {
  dailyTargets: Record<Weekday, DailyTarget>;
  entries: RunEntry[];
};

type RunFormState = {
  date: string;
  distanceKm: string;
  minutes: string;
  seconds: string;
};

const weekdayItems: Array<{ id: Weekday; label: string }> = [
  { id: "monday", label: "Segunda" },
  { id: "tuesday", label: "Terça" },
  { id: "wednesday", label: "Quarta" },
  { id: "thursday", label: "Quinta" },
  { id: "friday", label: "Sexta" },
  { id: "saturday", label: "Sábado" },
  { id: "sunday", label: "Domingo" },
];

const cardioTypeItems: Array<{ id: CardioType; label: string }> = [
  { id: "running", label: "Corrida" },
  { id: "walking", label: "Caminhada" },
  { id: "bike", label: "Bike" },
  { id: "elliptical", label: "Elíptico" },
  { id: "stairs", label: "Escada" },
];

const CARDIO_TYPES: CardioType[] = cardioTypeItems.map((item) => item.id);

// Legacy localStorage key; migrated into state.moduleState[runModuleKey]
// on first load, then cleaned up.
const runStorageKey = "praxis-protocol:run-module-v2";
const runModuleKey = "run-module-v2";

function createEmptyTargets(defaultType: CardioType = "running") {
  return weekdayItems.reduce(
    (accumulator, item) => {
      accumulator[item.id] = { km: 0, time: "", type: defaultType };
      return accumulator;
    },
    {} as Record<Weekday, DailyTarget>,
  );
}

function coerceCardioType(value: unknown, fallback: CardioType): CardioType {
  return CARDIO_TYPES.includes(value as CardioType)
    ? (value as CardioType)
    : fallback;
}

function normalizeTimeValue(value: unknown) {
  if (typeof value !== "string") return "";
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const hours = Math.min(23, Number(match[1]));
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/**
 * Migrates the old shape (dailyTargets: Record<Weekday, number>) to the
 * new one (km + time + type per weekday) without losing existing km.
 */
function normalizeRunState(raw: unknown, defaultType: CardioType): RunState {
  const base: RunState = { dailyTargets: createEmptyTargets(defaultType), entries: [] };
  if (!raw || typeof raw !== "object") return base;

  const value = raw as Partial<RunState> & {
    dailyTargets?: Record<string, unknown>;
  };

  const dailyTargets = createEmptyTargets(defaultType);
  for (const item of weekdayItems) {
    const stored = value.dailyTargets?.[item.id];
    if (typeof stored === "number") {
      dailyTargets[item.id] = {
        km: Math.max(0, stored),
        time: "",
        type: defaultType,
      };
    } else if (stored && typeof stored === "object") {
      const entry = stored as Partial<DailyTarget>;
      dailyTargets[item.id] = {
        km: Math.max(0, Number(entry.km) || 0),
        time: normalizeTimeValue(entry.time),
        type: coerceCardioType(entry.type, defaultType),
      };
    }
  }

  const entries = Array.isArray(value.entries) ? (value.entries as RunEntry[]) : [];
  return { dailyTargets, entries };
}

function parseDecimal(value: string) {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return 0;
  const nextValue = Number(normalized);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function parseDurationSeconds(minutes: string, seconds: string) {
  return Math.max(0, Number(minutes) || 0) * 60 + Math.max(0, Number(seconds) || 0);
}

function formatPace(totalSeconds: number, distanceKm: number) {
  if (distanceKm <= 0 || totalSeconds <= 0) return "--:--";
  const secondsPerKm = Math.round(totalSeconds / distanceKm);
  const paceMinutes = Math.floor(secondsPerKm / 60);
  const paceSeconds = secondsPerKm % 60;
  return `${String(paceMinutes).padStart(2, "0")}:${String(paceSeconds).padStart(2, "0")}/km`;
}

function formatRunDate(dateKey: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(parseLocalDate(dateKey));
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`);
}

function startOfWeekForDate(date: Date) {
  const reference = new Date(date);
  reference.setHours(0, 0, 0, 0);
  return getStartOfWeek(reference);
}

function formatWeekLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function getWeekday(date: Date): Weekday {
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

function defaultSpeedKmH(
  preferredCardio: PersistedState["personalProfile"]["preferredCardio"],
) {
  if (preferredCardio === "walking") return 5.8;
  if (preferredCardio === "bike") return 18;
  if (preferredCardio === "elliptical") return 6.4;
  if (preferredCardio === "stairs") return 4.6;
  return 8.5;
}

function weeklyMinutesByLevel(
  level: PersistedState["personalProfile"]["activityLevel"],
  goal: PersistedState["personalProfile"]["cardioGoal"],
) {
  const base = { sedentary: 110, light: 140, moderate: 180, high: 220 }[level];
  const adjustment = {
    health: 0,
    maintenance: 20,
    "fat-loss": 40,
    performance: 60,
    "muscle-gain": -20,
  }[goal];
  return Math.min(320, Math.max(90, Math.round((base + adjustment) / 5) * 5));
}

function cardioGoalLabel(goal: PersistedState["personalProfile"]["cardioGoal"]) {
  if (goal === "health") return "Saúde e consistência";
  if (goal === "fat-loss") return "Secar e aumentar gasto";
  if (goal === "maintenance") return "Manter condicionamento";
  if (goal === "performance") return "Performance e ritmo";
  return "Ganhar massa sem exagerar no cardio";
}

function activityLevelLabel(level: PersistedState["personalProfile"]["activityLevel"]) {
  if (level === "sedentary") return "Baixo";
  if (level === "light") return "Leve";
  if (level === "moderate") return "Moderado";
  return "Alto";
}

function cardioPreferenceLabel(
  preference: PersistedState["personalProfile"]["preferredCardio"],
) {
  if (preference === "walking") return "Caminhada";
  if (preference === "running") return "Corrida";
  if (preference === "bike") return "Bike";
  if (preference === "elliptical") return "Elíptico";
  return "Escada";
}

function recommendedDays(count: number): Weekday[] {
  if (count <= 3) return ["monday", "wednesday", "saturday"];
  if (count === 4) return ["monday", "tuesday", "thursday", "saturday"];
  if (count === 5) return ["monday", "tuesday", "wednesday", "friday", "saturday"];
  return ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
}

export default function RunModulePage() {
  const { state: appState, actions } = useAppStore();
  const profile = appState.personalProfile;
  const defaultCardioType = coerceCardioType(profile.preferredCardio, "running");
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<RunState>(() => ({
    dailyTargets: createEmptyTargets(),
    entries: [],
  }));
  const [form, setForm] = useState<RunFormState>({
    date: localDateKey(),
    distanceKm: "",
    minutes: "",
    seconds: "",
  });
  const [feedback, setFeedback] = useState("");
  // Toggle for the "Recomendação da semana / Cardio guiado pelo perfil"
  // panel — collapsed shows only the header so the user can hide the
  // KPI grid + base usada + contexto when they don't need it.
  const [recommendationExpanded, setRecommendationExpanded] = useState(true);

  const defaultTypeRef = useRef(defaultCardioType);
  defaultTypeRef.current = defaultCardioType;
  const targetsRef = useRef(state.dailyTargets);
  targetsRef.current = state.dailyTargets;
  const tasksRef = useRef(appState.tasks);
  tasksRef.current = appState.tasks;
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  // Hydrate from the central KV-backed moduleState bucket. Falls back
  // to the legacy localStorage key once (for users who already had run
  // data before this migration), then clears the legacy key.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const fromStore = appState.moduleState?.[runModuleKey];
        if (fromStore) {
          setState(normalizeRunState(fromStore, defaultTypeRef.current));
        } else {
          const stored =
            typeof window !== "undefined"
              ? window.localStorage.getItem(runStorageKey)
              : null;
          if (stored) {
            const parsed = JSON.parse(stored);
            const normalized = normalizeRunState(parsed, defaultTypeRef.current);
            setState(normalized);
            actionsRef.current.setModuleState(runModuleKey, normalized);
          }
        }
      } catch {}
      try {
        window.localStorage.removeItem(runStorageKey);
      } catch {}
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror the local state back to the KV bucket. The central store
  // debounces a 700ms KV save so multi-device sync is automatic.
  useEffect(() => {
    if (!hydrated) return;
    actionsRef.current.setModuleState(runModuleKey, state);
  }, [hydrated, state]);

  // Auto-sync the daily cardio plan into real account tasks so each
  // day with km + horário shows up in the agenda AND fires a
  // notification (web push / Telegram). Mirrors the sleep-module
  // reconcile pattern: upsert by stable sourceKey, drop stale keys.
  const syncCardioTasks = useCallback(() => {
    const act = actionsRef.current;
    const tasks = tasksRef.current;
    const targets = targetsRef.current;

    const generated = tasks.filter(
      (task) =>
        task.moduleId === "run" &&
        task.sourceKey?.startsWith("cardio-target-"),
    );

    const bySource = new Map<string, (typeof generated)[number]>();
    const duplicateIds: string[] = [];
    for (const task of generated) {
      if (!task.sourceKey) continue;
      if (bySource.has(task.sourceKey)) {
        duplicateIds.push(task.id);
        continue;
      }
      bySource.set(task.sourceKey, task);
    }
    duplicateIds.forEach((id) => act.removeTask(id));

    const activeKeys = new Set<string>();
    weekdayItems.forEach((item) => {
      const target = targets[item.id];
      const km = target?.km ?? 0;
      const time = (target?.time ?? "").trim();
      if (km <= 0 || !isValidTime(time)) {
        return;
      }

      const typeLabel = cardioPreferenceLabel(target.type);
      const key = `cardio-target-${item.id}`;
      const payload = {
        title: `Cardio · ${km} km`,
        description: `Meta de ${typeLabel.toLowerCase()} (${km} km) na ${item.label.toLowerCase()}.`,
        category: "fitness" as const,
        moduleId: "run" as const,
        scheduledTime: time,
        difficulty: "medium" as const,
        recurrence: { kind: "weekly-fixed" as const, weekday: item.id },
      };

      const existing = bySource.get(key);
      if (existing) {
        act.updateTask({ taskId: existing.id, patch: payload });
      } else {
        act.addTask({ ...payload, sourceKey: key });
      }
      activeKeys.add(key);
    });

    bySource.forEach((task) => {
      if (task.sourceKey && !activeKeys.has(task.sourceKey)) {
        act.removeTask(task.id);
      }
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      syncCardioTasks();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [hydrated, state.dailyTargets, syncCardioTasks]);

  const weekStart = useMemo(() => getStartOfWeek(new Date()), []);
  const weekEnd = useMemo(() => {
    const nextDate = new Date(weekStart);
    nextDate.setDate(nextDate.getDate() + 6);
    nextDate.setHours(23, 59, 59, 999);
    return nextDate;
  }, [weekStart]);

  const weekEntries = useMemo(
    () =>
      state.entries.filter((entry) => {
        const entryDate = parseLocalDate(entry.date);
        return entryDate >= weekStart && entryDate <= weekEnd;
      }),
    [state.entries, weekEnd, weekStart],
  );

  const dailyDistanceMap = useMemo(() => {
    const map = weekdayItems.reduce(
      (accumulator, item) => {
        accumulator[item.id] = 0;
        return accumulator;
      },
      {} as Record<Weekday, number>,
    );
    for (const entry of weekEntries) {
      map[entry.weekday] = Number((map[entry.weekday] + entry.distanceKm).toFixed(2));
    }
    return map;
  }, [weekEntries]);

  const weeklyDistance = weekEntries.reduce((sum, entry) => sum + entry.distanceKm, 0);
  const weeklyDuration = weekEntries.reduce((sum, entry) => sum + entry.durationSeconds, 0);
  const weeklyTarget = weekdayItems.reduce(
    (sum, item) => sum + (state.dailyTargets[item.id]?.km ?? 0),
    0,
  );
  const scheduledDays = weekdayItems.filter((item) => {
    const target = state.dailyTargets[item.id];
    return (target?.km ?? 0) > 0 && isValidTime((target?.time ?? "").trim());
  }).length;
  const averageSpeedKmH =
    weeklyDuration > 0
      ? weeklyDistance / (weeklyDuration / 3600)
      : defaultSpeedKmH(profile.preferredCardio);
  const recommendationMinutes = weeklyMinutesByLevel(
    appState.personalProfile.activityLevel,
    appState.personalProfile.cardioGoal,
  );
  const recommendationSessions =
    recommendationMinutes <= 120 ? 3 : recommendationMinutes <= 180 ? 4 : recommendationMinutes <= 240 ? 5 : 6;
  const recommendationKm = Number(((recommendationMinutes / 60) * averageSpeedKmH).toFixed(1));
  const estimatedMaxHeartRate = Math.max(120, 220 - profile.ageYears);
  const bpmLabel = profile.usesHeartRateMedication
    ? "BPM ocultado"
    : `${Math.round(estimatedMaxHeartRate * 0.6)}-${Math.round(estimatedMaxHeartRate * 0.75)} bpm`;
  const recentEntries = useMemo(() => sortEntriesByDate(state.entries).slice(0, 6), [state.entries]);
  const weeklyEvolution = useMemo(() => {
    const currentWeekStart = startOfWeekForDate(new Date());

    return Array.from({ length: 4 }, (_, index) => {
      const weekStartDate = new Date(currentWeekStart);
      weekStartDate.setDate(currentWeekStart.getDate() - (3 - index) * 7);
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekStartDate.getDate() + 6);
      weekEndDate.setHours(23, 59, 59, 999);

      const entries = state.entries.filter((entry) => {
        const entryDate = parseLocalDate(entry.date);
        return entryDate >= weekStartDate && entryDate <= weekEndDate;
      });
      const distance = entries.reduce((sum, entry) => sum + entry.distanceKm, 0);
      const duration = entries.reduce((sum, entry) => sum + entry.durationSeconds, 0);

      return {
        label: index === 3 ? "Atual" : `S-${3 - index}`,
        value: Number(distance.toFixed(1)),
        helper:
          entries.length > 0
            ? `${entries.length} registros • ${formatPace(duration, distance)}`
            : "Sem registros",
        weekStart: weekStartDate,
      };
    });
  }, [state.entries]);
  const activeWeekdays = weekdayItems.filter((item) => dailyDistanceMap[item.id] > 0).length;
  const bestPaceEntry = useMemo(() => {
    const eligibleEntries = state.entries.filter(
      (entry) => entry.distanceKm > 0 && entry.durationSeconds > 0,
    );

    return eligibleEntries.reduce<RunEntry | null>((bestEntry, entry) => {
      if (!bestEntry) return entry;
      const bestPaceSeconds = bestEntry.durationSeconds / bestEntry.distanceKm;
      const currentPaceSeconds = entry.durationSeconds / entry.distanceKm;
      return currentPaceSeconds < bestPaceSeconds ? entry : bestEntry;
    }, null);
  }, [state.entries]);
  const longestRunEntry = useMemo(
    () =>
      state.entries.reduce<RunEntry | null>(
        (bestEntry, entry) =>
          !bestEntry || entry.distanceKm > bestEntry.distanceKm ? entry : bestEntry,
        null,
      ),
    [state.entries],
  );
  const latestEntry = recentEntries[0] ?? null;
  const weeklyCompletionRate =
    weeklyTarget > 0 ? Math.min(100, Math.round((weeklyDistance / weeklyTarget) * 100)) : 0;
  const profileBaseSummary = [
    { label: "Idade", value: `${profile.ageYears} anos` },
    { label: "Peso", value: `${profile.bodyWeightKg.toFixed(1)} kg` },
    { label: "Altura", value: `${profile.bodyHeightCm.toFixed(0)} cm` },
    { label: "Nível", value: activityLevelLabel(profile.activityLevel) },
    { label: "Objetivo", value: cardioGoalLabel(profile.cardioGoal) },
    { label: "Base", value: cardioPreferenceLabel(profile.preferredCardio) },
  ];

  function applyRecommendation() {
    const perDay = Number((recommendationKm / recommendationSessions).toFixed(1));
    const days = recommendedDays(recommendationSessions);
    setState((current) => ({
      ...current,
      dailyTargets: weekdayItems.reduce(
        (accumulator, item) => {
          const previous = current.dailyTargets[item.id];
          accumulator[item.id] = {
            km: days.includes(item.id) ? perDay : 0,
            time: previous?.time ?? "",
            type: previous?.type ?? defaultCardioType,
          };
          return accumulator;
        },
        createEmptyTargets(defaultCardioType),
      ),
    }));
    setFeedback("Sugestão aplicada. Defina o horário de cada dia para gerar as tarefas.");
  }

  function updateTarget(weekday: Weekday, patch: Partial<DailyTarget>) {
    setState((current) => ({
      ...current,
      dailyTargets: {
        ...current.dailyTargets,
        [weekday]: { ...current.dailyTargets[weekday], ...patch },
      },
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const distanceKm = parseDecimal(form.distanceKm);
    const durationSeconds = parseDurationSeconds(form.minutes, form.seconds);
    if (distanceKm <= 0 || durationSeconds <= 0) return;
    const dateKey = form.date || localDateKey();
    setState((current) => ({
      ...current,
      entries: [
        {
          id: `run-${Date.now()}`,
          date: dateKey,
          createdAt: new Date().toISOString(),
          weekday: getWeekday(parseLocalDate(dateKey)),
          distanceKm: Number(distanceKm.toFixed(2)),
          durationSeconds,
        },
        ...current.entries,
      ],
    }));
    setForm({ date: localDateKey(), distanceKm: "", minutes: "", seconds: "" });
  }

  if (!hydrated) {
    return <div className="min-h-screen bg-[#050505]" />;
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 pb-24 pt-4">
      <div className="mod-hero">
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div className="mod-icon" style={{ width: 56, height: 56, borderRadius: 14, fontSize: 24 }}>🏃</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="praxis-label" style={{ color: "var(--accent)", marginBottom: 4 }}>▸ MÓDULO · CARDIO</div>
            <div className="praxis-title" style={{ fontSize: 26 }}>Cardio guiado pelo perfil</div>
            <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
              Idade, peso, altura e contexto de saúde viram um ponto de partida em minutos, sessões e km.
            </div>
          </div>
          <div className="mod-hero-side" style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div className="mod-hero-side-stat" style={{ textAlign: "right", borderLeft: "1px solid rgba(39,39,42,0.6)", paddingLeft: 16 }}>
              <div className="praxis-label" style={{ fontSize: 9 }}>SEMANA</div>
              <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "var(--font-space-grotesk), sans-serif", marginTop: 2 }}>
                {recommendationMinutes} min
              </div>
            </div>
          </div>
        </div>
      </div>

      <GlassPanel className="space-y-5 border-l-2 border-l-[var(--accent)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="praxis-label text-[var(--accent)]">Recomendação da semana</p>
            <h2 className="mt-1 font-headline text-2xl font-bold uppercase tracking-tighter text-zinc-100">Cardio guiado pelo perfil</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              O Praxis usa idade, peso, altura, atividade e contexto de saúde para sugerir um ponto de partida em minutos, sessões e km estimados.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/profile"
              className="inline-flex items-center border border-zinc-800 bg-black/50 px-4 py-3 font-headline text-xs font-bold uppercase tracking-[0.25em] text-zinc-100 transition hover:border-[rgba(251,146,60,0.24)] hover:text-[var(--accent)]"
            >
              Ajustar perfil
            </Link>
            <button
              type="button"
              onClick={() => setRecommendationExpanded((current) => !current)}
              aria-expanded={recommendationExpanded}
              aria-label={
                recommendationExpanded
                  ? "Ocultar recomendação"
                  : "Expandir recomendação"
              }
              className="inline-flex items-center gap-2 border border-zinc-800 bg-black/50 px-4 py-3 font-headline text-xs font-bold uppercase tracking-[0.25em] text-zinc-100 transition hover:border-[rgba(251,146,60,0.24)] hover:text-[var(--accent)]"
            >
              {recommendationExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              {recommendationExpanded ? "Ocultar" : "Expandir"}
            </button>
          </div>
        </div>

        {recommendationExpanded ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="praxis-kpi p-4"><p className="praxis-label text-zinc-500">Meta inicial</p><p className="mt-2 font-title text-3xl font-bold text-[var(--accent)]">{recommendationMinutes} min</p></div>
              <div className="praxis-kpi p-4"><p className="praxis-label text-zinc-500">Sessões</p><p className="mt-2 font-title text-3xl font-bold text-zinc-100">{recommendationSessions}x</p></div>
              <div className="praxis-kpi p-4"><p className="praxis-label text-zinc-500">Por sessão</p><p className="mt-2 font-title text-3xl font-bold text-zinc-100">{Math.round(recommendationMinutes / recommendationSessions)} min</p></div>
              <div className="praxis-kpi p-4"><p className="praxis-label text-zinc-500">Zona alvo</p><p className="mt-2 font-title text-3xl font-bold text-zinc-100">{bpmLabel}</p></div>
              <div className="praxis-kpi p-4"><p className="praxis-label text-zinc-500">Estimativa em km</p><p className="mt-2 font-title text-3xl font-bold text-zinc-100">{recommendationKm} km</p></div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-sm border border-zinc-800 bg-black/30 p-4">
                <p className="praxis-label text-[var(--accent)]">Base usada</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {profileBaseSummary.map((item) => (
                    <div key={item.label} className="rounded-sm border border-zinc-800 bg-black/40 p-3">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-zinc-500">{item.label}</p>
                      <p className="mt-2 text-sm font-medium text-zinc-100">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-sm border border-zinc-800 bg-black/30 p-4">
                <p className="praxis-label text-[var(--accent)]">Contexto aplicado</p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  {profile.hasCardiovascularCondition
                    ? "A recomendação começa mais conservadora por conta do histórico cardiovascular."
                    : "Sem restrição cardiovascular informada, a faixa já entra no ponto de partida normal."}
                </p>
                <p className="mt-3 text-sm leading-6 text-zinc-300">
                  {profile.hasJointLimitation
                    ? "A limitação articular reduz o impacto sugerido nas sessões."
                    : "Sem limitação articular informada, cardio de impacto e caminhada seguem como base principal."}
                </p>
                <p className="mt-3 text-sm leading-6 text-zinc-300">
                  {profile.usesHeartRateMedication
                    ? "O BPM foi ocultado porque a medicação pode distorcer a leitura."
                    : `A zona alvo foi estimada em ${bpmLabel}.`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={applyRecommendation} className="praxis-button px-5 py-3">Aplicar sugestão na semana</button>
              {feedback ? <span className="text-sm text-zinc-400">{feedback}</span> : null}
            </div>
          </>
        ) : null}
      </GlassPanel>

      <div className="grid gap-4 md:grid-cols-3">
        <GlassPanel><p className="praxis-label text-zinc-500">Meta semanal</p><p className="mt-2 font-title text-3xl font-bold text-[var(--accent)]">{weeklyTarget.toFixed(1)} km</p></GlassPanel>
        <GlassPanel><p className="praxis-label text-zinc-500">Percorrido</p><p className="mt-2 font-title text-3xl font-bold text-zinc-100">{weeklyDistance.toFixed(2)} km</p></GlassPanel>
        <GlassPanel><p className="praxis-label text-zinc-500">Ritmo médio</p><p className="mt-2 font-title text-3xl font-bold text-zinc-100">{formatPace(weeklyDuration, weeklyDistance)}</p></GlassPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <GlassPanel className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="praxis-label text-[var(--accent)]">Evolução</p>
              <h2 className="mt-1 font-headline text-2xl font-bold uppercase tracking-tighter text-zinc-100">
                Curva das últimas semanas
              </h2>
            </div>
            <span className="text-sm text-zinc-500">
              {formatWeekLabel(weeklyEvolution[0]?.weekStart ?? weekStart)} a{" "}
              {formatWeekLabel(weeklyEvolution[weeklyEvolution.length - 1]?.weekStart ?? weekStart)}
            </span>
          </div>

          <ProgressCurveChart
            points={weeklyEvolution}
            valueFormatter={(value) => `${value.toFixed(1)} km`}
            emptyLabel="Registre alguns treinos de cardio para aparecer a curva semanal."
          />
        </GlassPanel>

        <GlassPanel className="space-y-4">
          <div>
            <p className="praxis-label text-[var(--accent)]">Leitura real</p>
            <h2 className="mt-1 font-headline text-2xl font-bold uppercase tracking-tighter text-zinc-100">
              Progresso do cardio
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-sm border border-zinc-800 bg-black/30 p-4">
              <p className="praxis-label text-zinc-500">Execução da semana</p>
              <p className="mt-2 font-title text-3xl font-bold text-[var(--accent)]">
                {weeklyCompletionRate}%
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                {weeklyDistance.toFixed(1)} km de {weeklyTarget.toFixed(1)} km
              </p>
            </div>
            <div className="rounded-sm border border-zinc-800 bg-black/30 p-4">
              <p className="praxis-label text-zinc-500">Dias com treino</p>
              <p className="mt-2 font-title text-3xl font-bold text-zinc-100">
                {activeWeekdays}x
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                Dias da semana que já receberam registro
              </p>
            </div>
            <div className="rounded-sm border border-zinc-800 bg-black/30 p-4">
              <p className="praxis-label text-zinc-500">Melhor ritmo</p>
              <p className="mt-2 font-title text-3xl font-bold text-zinc-100">
                {bestPaceEntry
                  ? formatPace(bestPaceEntry.durationSeconds, bestPaceEntry.distanceKm)
                  : "--:--"}
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                {bestPaceEntry
                  ? `${bestPaceEntry.distanceKm.toFixed(1)} km em ${formatRunDate(bestPaceEntry.date)}`
                  : "Sem pace suficiente ainda"}
              </p>
            </div>
            <div className="rounded-sm border border-zinc-800 bg-black/30 p-4">
              <p className="praxis-label text-zinc-500">Maior sessão</p>
              <p className="mt-2 font-title text-3xl font-bold text-zinc-100">
                {longestRunEntry ? `${longestRunEntry.distanceKm.toFixed(1)} km` : "--"}
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                {latestEntry
                  ? `Último treino em ${formatRunDate(latestEntry.date)}`
                  : "Histórico aguardando o primeiro registro"}
              </p>
            </div>
          </div>
        </GlassPanel>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <GlassPanel className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="praxis-label text-[var(--accent)]">Registro</p>
              <h2 className="mt-1 font-headline text-2xl font-bold uppercase tracking-tighter text-zinc-100">Lançar cardio</h2>
            </div>
            <button type="button" onClick={() => setForm({ date: localDateKey(), distanceKm: "", minutes: "", seconds: "" })} className="inline-flex items-center gap-2 border border-zinc-800 bg-black/50 px-4 py-2 font-headline text-xs font-bold uppercase tracking-[0.25em] text-zinc-100 transition hover:border-[rgba(251,146,60,0.24)] hover:text-[var(--accent)]"><TimerReset className="h-4 w-4" />Limpar</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} className="praxis-field px-4 py-3 text-sm text-white" />
              <input type="number" min="0" step="0.01" value={form.distanceKm} onChange={(event) => setForm((current) => ({ ...current, distanceKm: event.target.value }))} placeholder="Distância (km)" className="praxis-field px-4 py-3 text-sm text-white placeholder:text-zinc-500" />
              <input type="number" min="0" value={form.minutes} onChange={(event) => setForm((current) => ({ ...current, minutes: event.target.value }))} placeholder="Minutos" className="praxis-field px-4 py-3 text-sm text-white placeholder:text-zinc-500" />
              <input type="number" min="0" max="59" value={form.seconds} onChange={(event) => setForm((current) => ({ ...current, seconds: event.target.value }))} placeholder="Segundos" className="praxis-field px-4 py-3 text-sm text-white placeholder:text-zinc-500" />
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="submit" className="praxis-button px-5 py-3"><Plus className="h-4 w-4" />Registrar treino</button>
              <div className="flex items-center gap-2 border border-zinc-800 bg-black/50 px-4 py-3 text-xs text-zinc-400"><Clock3 className="h-4 w-4 text-[var(--accent)]" />Ritmo calculado automaticamente</div>
            </div>
          </form>
        </GlassPanel>

        <GlassPanel className="space-y-5">
          <div>
            <p className="praxis-label text-[var(--accent)]">Planejamento</p>
            <h2 className="mt-1 font-headline text-2xl font-bold uppercase tracking-tighter text-zinc-100">Meta por dia</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Defina km, horário e tipo de cardio. Cada dia com km e horário
              vira automaticamente uma tarefa na sua agenda e um lembrete
              (push / Telegram).
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
              {scheduledDays > 0
                ? `${scheduledDays} ${scheduledDays === 1 ? "dia gerando tarefa" : "dias gerando tarefa"} na agenda`
                : "Preencha km + horário para gerar tarefas"}
            </p>
          </div>
          <div className="space-y-3">
            {weekdayItems.map((item) => {
              const target = state.dailyTargets[item.id];
              const remaining = Math.max(
                0,
                (target?.km ?? 0) - dailyDistanceMap[item.id],
              );
              const willSchedule =
                (target?.km ?? 0) > 0 && isValidTime((target?.time ?? "").trim());
              return (
                <div
                  key={item.id}
                  className="grid gap-3 border border-zinc-800 bg-black/40 p-4 md:grid-cols-[1fr_104px_120px_132px] md:items-center"
                  style={{
                    borderColor: willSchedule
                      ? "rgba(251,146,60,0.28)"
                      : undefined,
                  }}
                >
                  <div>
                    <p className="font-headline text-lg font-bold text-zinc-100">{item.label}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {dailyDistanceMap[item.id].toFixed(1)} km feitos ·{" "}
                      {remaining.toFixed(1)} km faltam
                    </p>
                    <p className="mt-1 text-[0.68rem] uppercase tracking-[0.2em] text-zinc-600">
                      {willSchedule
                        ? `Tarefa ${target.time} • ${cardioPreferenceLabel(target.type)}`
                        : "Sem tarefa (falta km ou horário)"}
                    </p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={target?.km ?? 0}
                    onChange={(event) =>
                      updateTarget(item.id, {
                        km: Math.max(0, Number(event.target.value) || 0),
                      })
                    }
                    placeholder="km"
                    className="praxis-field px-3 py-3 text-sm text-white"
                  />
                  <input
                    type="time"
                    value={target?.time ?? ""}
                    onChange={(event) =>
                      updateTarget(item.id, { time: event.target.value })
                    }
                    className="praxis-field px-3 py-3 text-sm text-white"
                  />
                  <select
                    value={target?.type ?? defaultCardioType}
                    onChange={(event) =>
                      updateTarget(item.id, {
                        type: event.target.value as CardioType,
                      })
                    }
                    className="praxis-field px-3 py-3 text-sm text-white"
                  >
                    {cardioTypeItems.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      </div>

      <GlassPanel className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="praxis-label text-[var(--accent)]">Histórico</p>
            <h2 className="mt-1 font-headline text-2xl font-bold uppercase tracking-tighter text-zinc-100">Últimos registros</h2>
          </div>
          <span className="text-sm text-zinc-500">{recentEntries.length} visíveis</span>
        </div>
        <div className="space-y-3">
          {recentEntries.length ? recentEntries.map((entry) => (
            <article key={entry.id} className="flex flex-col gap-4 border border-zinc-800 bg-black/50 p-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="font-headline text-lg font-bold text-zinc-100">{entry.distanceKm.toFixed(2)} km</p>
                <p className="text-sm text-zinc-500">{formatRunDate(entry.date)} • {formatMinutes(Math.round(entry.durationSeconds / 60))} • {formatPace(entry.durationSeconds, entry.distanceKm)}</p>
              </div>
              <button type="button" onClick={() => setState((current) => ({ ...current, entries: current.entries.filter((other) => other.id !== entry.id) }))} className="inline-flex items-center gap-2 border border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.08)] px-4 py-2 font-headline text-xs font-bold uppercase tracking-[0.25em] text-red-300 transition hover:border-[rgba(239,68,68,0.45)] hover:text-red-200"><Trash2 className="h-4 w-4" />Excluir</button>
            </article>
          )) : (
            <div className="border border-dashed border-zinc-800 bg-black/30 px-6 py-10 text-center text-sm text-zinc-400">
              Lance o primeiro treino para começar o histórico da semana.
            </div>
          )}
        </div>
      </GlassPanel>
    </main>
  );
}
