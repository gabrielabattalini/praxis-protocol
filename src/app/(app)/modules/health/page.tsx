"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  HeartPulse,
  Plus,
  Shield,
  Stethoscope,
  Trash2,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import { ProgressCurveChart } from "@/components/ui/progress-curve-chart";
import type { Task, TaskDifficulty, TaskRecurrence, Weekday } from "@/lib/types";
import {
  formatRecurrence,
  isTaskCompletedForDate,
  isTaskDueForDate,
  weekdayLongLabel,
} from "@/lib/utils";

const fieldClassName = "praxis-field w-full px-4 py-3 text-sm";
const healthHistoryStorageKey = "praxis-protocol-health-history-v1";

const weekdayOptions: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

type HealthHistoryEntry = {
  id: string;
  taskId: string;
  title: string;
  xp: number;
  completedAt: string;
};

const healthPresets = [
  {
    id: "checkup-annual",
    label: "Check-up anual",
    title: "Agendar check-up clínico geral",
    description:
      "Revisão geral com consulta, exame físico e leitura ampla do estado de saúde.",
    scheduledTime: "08:30",
    recurrence: { kind: "interval-days", intervalDays: 365 } as TaskRecurrence,
    difficulty: "hard" as TaskDifficulty,
  },
  {
    id: "blood-work",
    label: "Exames de sangue",
    title: "Refazer exames de sangue completos",
    description:
      "Acompanhar hemograma, vitaminas, perfil metabólico e marcadores importantes.",
    scheduledTime: "07:00",
    recurrence: { kind: "interval-days", intervalDays: 180 } as TaskRecurrence,
    difficulty: "hard" as TaskDifficulty,
  },
  {
    id: "nutritionist",
    label: "Nutricionista",
    title: "Consulta com nutricionista",
    description:
      "Revisar exames, rotina alimentar, digestão e ajustes do protocolo nutricional.",
    scheduledTime: "10:00",
    recurrence: { kind: "interval-days", intervalDays: 60 } as TaskRecurrence,
    difficulty: "medium" as TaskDifficulty,
  },
  {
    id: "dentist",
    label: "Odontologia",
    title: "Consulta odontológica preventiva",
    description:
      "Revisão preventiva, limpeza e acompanhamento geral da saúde bucal.",
    scheduledTime: "14:00",
    recurrence: { kind: "interval-days", intervalDays: 180 } as TaskRecurrence,
    difficulty: "medium" as TaskDifficulty,
  },
  {
    id: "weekly-monitoring",
    label: "Acompanhamento",
    title: "Revisar sinais, sintomas e marcadores",
    description:
      "Checar sinais do corpo, dores, recuperação, medicação e qualquer alerta da semana.",
    scheduledTime: "20:00",
    recurrence: {
      kind: "selected-weekdays",
      weekdays: ["sunday"],
    } as TaskRecurrence,
    difficulty: "medium" as TaskDifficulty,
  },
] as const;

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

function startOfDay(referenceDate: Date) {
  const date = new Date(referenceDate);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(referenceDate: Date, amount: number) {
  const date = new Date(referenceDate);
  date.setDate(date.getDate() + amount);
  return date;
}

function getHealthDifficulty(
  recurrenceKind: "interval-days" | "selected-weekdays" | "monthly",
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

function buildRecurrence(
  recurrenceKind: "interval-days" | "selected-weekdays" | "monthly",
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

function nextHealthWindowLabel(task: Task, referenceDate: Date) {
  if (task.recurrence.kind !== "interval-days") {
    return formatRecurrence(task.recurrence);
  }

  if (isTaskDueForDate(task, referenceDate)) {
    return "Disponível agora";
  }

  if (!task.completedAt) {
    return "Disponível agora";
  }

  const completionDate = new Date(task.completedAt);
  if (Number.isNaN(completionDate.getTime())) {
    return formatRecurrence(task.recurrence);
  }

  const intervalDays = Math.max(1, task.recurrence.intervalDays ?? 1);
  const nextDueDate = addDays(startOfDay(completionDate), intervalDays);
  const dayDifference = Math.ceil(
    (startOfDay(nextDueDate).getTime() - startOfDay(referenceDate).getTime()) /
      86400000,
  );

  if (dayDifference <= 0) {
    return "Disponível agora";
  }

  return `Volta em ${dayDifference} dia${dayDifference === 1 ? "" : "s"}`;
}

function cadenceBadgeLabel(recurrence: TaskRecurrence) {
  switch (recurrence.kind) {
    case "interval-days":
      return recurrence.intervalDays
        ? `${recurrence.intervalDays} dias`
        : "Intervalo";
    case "monthly":
      return recurrence.dayOfMonth
        ? `Dia ${recurrence.dayOfMonth}`
        : "Mensal";
    case "selected-weekdays":
      return recurrence.weekdays?.length
        ? recurrence.weekdays.map((day) => weekdayLongLabel(day)).join(" • ")
        : "Semanal";
    default:
      return formatRecurrence(recurrence);
  }
}

function formatHealthHistoryDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

export default function HealthModulePage() {
  const { state, actions } = useAppStore();
  const today = useMemo(() => new Date(), []);
  const todayWeekday = getTodayWeekday(today);
  const [persistedHealthHistory] = useState<HealthHistoryEntry[]>(() => {
    if (typeof window === "undefined") return [];

    try {
      const stored = window.localStorage.getItem(healthHistoryStorageKey);
      if (!stored) return [];
      return (JSON.parse(stored) as HealthHistoryEntry[])
        .filter((entry) => entry?.taskId && entry?.completedAt)
        .sort(
          (left, right) =>
            new Date(right.completedAt).getTime() -
            new Date(left.completedAt).getTime(),
        );
    } catch {
      return [];
    }
  });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledTime, setScheduledTime] = useState("08:30");
  const [recurrenceKind, setRecurrenceKind] = useState<
    "interval-days" | "selected-weekdays" | "monthly"
  >("interval-days");
  const [intervalDays, setIntervalDays] = useState(180);
  const [weekdays, setWeekdays] = useState<Weekday[]>(["sunday"]);
  const [dayOfMonth, setDayOfMonth] = useState(5);

  const healthTasks = state.tasks
    .filter((task) => task.moduleId === "health")
    .sort((left, right) => {
      const leftCompleted = isTaskCompletedForDate(left, today);
      const rightCompleted = isTaskCompletedForDate(right, today);
      const leftDue = isTaskDueForDate(left, today);
      const rightDue = isTaskDueForDate(right, today);

      if (leftCompleted !== rightCompleted) {
        return leftCompleted ? 1 : -1;
      }

      if (leftDue !== rightDue) {
        return leftDue ? -1 : 1;
      }

      if (left.scheduledTime && right.scheduledTime) {
        return left.scheduledTime.localeCompare(right.scheduledTime);
      }

      return left.title.localeCompare(right.title);
    });

  const healthHistory = useMemo(() => {
    const completionEntries = healthTasks
      .filter((task) => task.completed && task.completedAt)
      .map((task) => ({
        id: `${task.id}:${task.completedAt}`,
        taskId: task.id,
        title: task.title,
        xp: task.xp,
        completedAt: task.completedAt ?? "",
      }));

    return [...persistedHealthHistory, ...completionEntries]
      .reduce<HealthHistoryEntry[]>((accumulator, entry) => {
        if (accumulator.some((current) => current.id === entry.id)) {
          return accumulator;
        }

        accumulator.push(entry);
        return accumulator;
      }, [])
      .sort(
        (left, right) =>
          new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime(),
      );
  }, [healthTasks, persistedHealthHistory]);

  const healthTasksToday = healthTasks.filter((task) => isTaskDueForDate(task, today));
  const completedTodayCount = healthTasks.filter((task) =>
    isTaskCompletedForDate(task, today),
  ).length;
  const openTodayCount = healthTasksToday.filter(
    (task) => !isTaskCompletedForDate(task, today),
  ).length;
  const healthXpOpen = healthTasksToday
    .filter((task) => !isTaskCompletedForDate(task, today))
    .reduce((sum, task) => sum + task.xp, 0);
  const recentHealthHistory = useMemo(() => healthHistory.slice(0, 5), [healthHistory]);
  const completedLast30Days = useMemo(() => {
    const threshold = startOfDay(addDays(today, -29));
    return healthHistory.filter(
      (entry) => new Date(entry.completedAt) >= threshold,
    ).length;
  }, [healthHistory, today]);
  const protocolsWithHistory = new Set(healthHistory.map((entry) => entry.taskId)).size;
  const healthHistoryCurve = useMemo(() => {
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    return Array.from({ length: 6 }, (_, index) => {
      const monthStart = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() - (5 - index),
        1,
      );
      const nextMonth = new Date(
        monthStart.getFullYear(),
        monthStart.getMonth() + 1,
        1,
      );
      const count = healthHistory.filter((entry) => {
        const completedAt = new Date(entry.completedAt);
        return completedAt >= monthStart && completedAt < nextMonth;
      }).length;

      return {
        label: monthStart
          .toLocaleDateString("pt-BR", { month: "short" })
          .replace(".", ""),
        value: count,
        helper: count ? `${count} concl.` : "Sem baixa",
      };
    });
  }, [healthHistory, today]);

  useEffect(() => {
    window.localStorage.setItem(
      healthHistoryStorageKey,
      JSON.stringify(healthHistory),
    );
  }, [healthHistory]);

  function applyPreset(presetId: string) {
    const preset = healthPresets.find((item) => item.id === presetId);
    if (!preset) return;

    setTitle(preset.title);
    setDescription(preset.description);
    setScheduledTime(preset.scheduledTime);

    switch (preset.recurrence.kind) {
      case "selected-weekdays":
        setRecurrenceKind("selected-weekdays");
        setWeekdays(preset.recurrence.weekdays ?? ["sunday"]);
        break;
      case "monthly":
        setRecurrenceKind("monthly");
        setDayOfMonth(preset.recurrence.dayOfMonth ?? 5);
        break;
      case "interval-days":
      default:
        setRecurrenceKind("interval-days");
        setIntervalDays(preset.recurrence.intervalDays ?? 180);
        break;
    }
  }

  function toggleWeekday(day: Weekday) {
    setWeekdays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day],
    );
  }

  function saveTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;

    const recurrence = buildRecurrence(
      recurrenceKind,
      todayWeekday,
      intervalDays,
      weekdays,
      dayOfMonth,
    );

    actions.addTask({
      title: title.trim(),
      description: description.trim(),
      category: "health",
      moduleId: "health",
      scheduledTime: scheduledTime || undefined,
      difficulty: getHealthDifficulty(recurrenceKind, intervalDays),
      recurrence,
    });

    setTitle("");
    setDescription("");
    setScheduledTime("08:30");
    setRecurrenceKind("interval-days");
    setIntervalDays(180);
    setWeekdays(["sunday"]);
    setDayOfMonth(5);
  }

  return (
    <div className="space-y-6">
      <div className="mod-hero">
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div className="mod-icon" style={{ width: 56, height: 56, borderRadius: 14, fontSize: 24 }}>❤️</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="praxis-label" style={{ color: "var(--accent)", marginBottom: 4 }}>▸ MÓDULO · SAÚDE</div>
            <div className="praxis-title" style={{ fontSize: 26 }}>Exames e check-ups</div>
            <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
              Organize exames, consultas e check-ups periódicos integrados às tarefas.
            </div>
          </div>
          <div className="mod-hero-side" style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div className="mod-hero-side-stat" style={{ textAlign: "right", borderLeft: "1px solid rgba(39,39,42,0.6)", paddingLeft: 16 }}>
              <div className="praxis-label" style={{ fontSize: 9 }}>HOJE</div>
              <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "var(--font-space-grotesk), sans-serif", marginTop: 2 }}>
                {healthTasksToday.length}/{healthTasks.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <GlassPanel className="space-y-2">
          <p className="praxis-label text-[var(--accent)]">Protocolos ativos</p>
          <p className="font-title text-4xl font-bold text-zinc-100">{healthTasks.length}</p>
          <p className="text-sm leading-6 text-zinc-500">Saúde em acompanhamento</p>
        </GlassPanel>
        <GlassPanel className="space-y-2">
          <p className="praxis-label text-[var(--accent)]">Para hoje</p>
          <p className="font-title text-4xl font-bold text-zinc-100">{healthTasksToday.length}</p>
          <p className="text-sm leading-6 text-zinc-500">
            Leituras para {weekdayLongLabel(todayWeekday).toLowerCase()}
          </p>
        </GlassPanel>
        <GlassPanel className="space-y-2">
          <p className="praxis-label text-[var(--accent)]">Pendentes</p>
          <p className="font-title text-4xl font-bold text-zinc-100">{openTodayCount}</p>
          <p className="text-sm leading-6 text-zinc-500">Ainda precisam de ação hoje</p>
        </GlassPanel>
        <GlassPanel className="space-y-2">
          <p className="praxis-label text-[var(--accent)]">Concluídos hoje</p>
          <p className="font-title text-4xl font-bold text-zinc-100">{completedTodayCount}</p>
          <p className="text-sm leading-6 text-zinc-500">Já processados neste ciclo</p>
        </GlassPanel>
        <GlassPanel className="space-y-2">
          <p className="praxis-label text-[var(--accent)]">XP em aberto</p>
          <p className="font-title text-4xl font-bold text-zinc-100">{healthXpOpen}</p>
          <p className="text-sm leading-6 text-zinc-500">Carga atual da saúde</p>
        </GlassPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <GlassPanel className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="praxis-label text-[var(--accent)]">Histórico</p>
              <h2 className="praxis-title text-2xl">Curva preventiva</h2>
            </div>
            <span className="text-sm text-zinc-500">
              {completedLast30Days} conclusões em 30 dias
            </span>
          </div>

          <ProgressCurveChart
            points={healthHistoryCurve}
            valueFormatter={(value) => `${Math.round(value)}`}
            emptyLabel="Conclua protocolos para começar a curva do módulo."
          />
        </GlassPanel>

        <GlassPanel className="space-y-4">
          <div>
            <p className="praxis-label text-[var(--accent)]">Leitura real</p>
            <h2 className="praxis-title text-2xl">Últimas confirmações</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-sm border border-zinc-800 bg-black/30 p-4">
              <p className="praxis-label text-zinc-500">Protocolos com histórico</p>
              <p className="mt-2 font-title text-3xl font-bold text-zinc-100">
                {protocolsWithHistory}
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                Protocolos que já tiveram ao menos uma conclusão registrada
              </p>
            </div>
            <div className="rounded-sm border border-zinc-800 bg-black/30 p-4">
              <p className="praxis-label text-zinc-500">Baixas recentes</p>
              <p className="mt-2 font-title text-3xl font-bold text-[var(--accent)]">
                {recentHealthHistory.length}
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                Itens mais recentes capturados pelo histórico do módulo
              </p>
            </div>
          </div>

          {recentHealthHistory.length ? (
            <div className="space-y-2">
              {recentHealthHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.92)] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-100">{entry.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {formatHealthHistoryDate(entry.completedAt)}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
                    {entry.xp} XP
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-sm border border-dashed border-zinc-800 bg-[rgba(10,10,12,0.96)] p-5 text-sm leading-7 text-zinc-500">
              O módulo ainda não tem baixa real registrada. Quando você concluir um protocolo,
              ele passa a alimentar esse histórico automaticamente.
            </div>
          )}
        </GlassPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.94fr_1.06fr]">
        <GlassPanel className="space-y-4">
          <div className="flex items-center gap-3">
            <Stethoscope className="h-6 w-6 text-[var(--accent)]" />
            <div>
              <p className="praxis-label text-[var(--accent)]">Novo protocolo</p>
              <h2 className="praxis-title text-2xl">Planejamento de saúde</h2>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {healthPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className="praxis-button-ghost px-3 py-2"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={saveTask}>
            <label className="block space-y-2">
              <span className="praxis-label text-[var(--accent)]">Título</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex.: agendar check-up geral ou refazer exames"
                className={fieldClassName}
              />
            </label>

            <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
              <label className="block space-y-2">
                <span className="praxis-label text-[var(--accent)]">Horário</span>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(event) => setScheduledTime(event.target.value)}
                  className={fieldClassName}
                />
              </label>

              <label className="block space-y-2">
                <span className="praxis-label text-[var(--accent)]">Cadência</span>
                <select
                  value={recurrenceKind}
                  onChange={(event) =>
                    setRecurrenceKind(
                      event.target.value as "interval-days" | "selected-weekdays" | "monthly",
                    )
                  }
                  className={fieldClassName}
                >
                  <option value="interval-days">A cada X dias</option>
                  <option value="selected-weekdays">Dias da semana</option>
                  <option value="monthly">Todo mês</option>
                </select>
              </label>
            </div>

            {recurrenceKind === "interval-days" ? (
              <label className="block space-y-2">
                <span className="praxis-label text-[var(--accent)]">Intervalo em dias</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={intervalDays}
                  onChange={(event) =>
                    setIntervalDays(Math.max(1, Number(event.target.value) || 1))
                  }
                  className={fieldClassName}
                />
              </label>
            ) : null}

            {recurrenceKind === "monthly" ? (
              <label className="block space-y-2">
                <span className="praxis-label text-[var(--accent)]">Dia do mês</span>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={dayOfMonth}
                  onChange={(event) =>
                    setDayOfMonth(Math.min(28, Math.max(1, Number(event.target.value) || 1)))
                  }
                  className={fieldClassName}
                />
              </label>
            ) : null}

            {recurrenceKind === "selected-weekdays" ? (
              <div className="space-y-2">
                <p className="praxis-label text-[var(--accent)]">Dias da semana</p>
                <div className="flex flex-wrap gap-2">
                  {weekdayOptions.map((day) => {
                    const active = weekdays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleWeekday(day)}
                        className={
                          active
                            ? "praxis-button px-3 py-2"
                            : "praxis-button-ghost px-3 py-2"
                        }
                      >
                        {weekdayLongLabel(day)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="rounded-sm border border-emerald-400/20 bg-emerald-400/5 p-4">
              <p className="praxis-label text-emerald-300">Leitura automática</p>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                O sistema define a carga e o XP internamente com base na cadência do protocolo. Na
                agenda, isso entra como tarefa recorrente normal, junto das outras áreas.
              </p>
            </div>

            <button
              type="submit"
              className="praxis-button flex w-full items-center justify-center gap-2 px-4 py-3"
            >
              <Plus className="h-4 w-4" />
              Criar protocolo de saúde
            </button>
          </form>
        </GlassPanel>

        <div className="space-y-6">
          <GlassPanel className="space-y-4">
            <div className="flex items-center gap-3">
              <HeartPulse className="h-6 w-6 text-[var(--accent)]" />
              <div>
                <p className="praxis-label text-[var(--accent)]">Hoje em saúde</p>
                <h2 className="praxis-title text-2xl">Leitura do dia</h2>
              </div>
            </div>

            {healthTasksToday.length ? (
              <div className="space-y-3">
                {healthTasksToday.map((task) => {
                  const completed = isTaskCompletedForDate(task, today);

                  return (
                    <div
                      key={task.id}
                      className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="praxis-label text-[var(--accent)]">Saúde</span>
                            <span className="rounded-sm border border-zinc-800 px-2 py-1 text-[0.72rem] uppercase tracking-[0.18em] text-zinc-400">
                              {cadenceBadgeLabel(task.recurrence)}
                            </span>
                          </div>
                          <p className="font-title text-xl font-semibold text-zinc-100">
                            {task.title}
                          </p>
                          <p className="text-sm leading-7 text-zinc-500">{task.description}</p>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <span className="rounded-sm border border-[rgba(251,146,60,0.28)] bg-[rgba(251,146,60,0.12)] px-2 py-1 text-[0.72rem] uppercase tracking-[0.18em] text-[var(--accent)]">
                            {task.scheduledTime || "Sem horário"}
                          </span>
                          <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                            {task.xp} XP
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => actions.toggleTask(task.id)}
                          className={
                            completed
                              ? "praxis-button-ghost px-3 py-2"
                              : "praxis-button px-3 py-2"
                          }
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {completed ? "Concluído hoje" : "Marcar como concluída"}
                        </button>
                        <button
                          type="button"
                          onClick={() => actions.removeTask(task.id)}
                          className="praxis-button-ghost px-3 py-2 text-red-300 hover:border-red-400/30 hover:text-red-200"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remover
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-sm border border-dashed border-zinc-800 bg-[rgba(10,10,12,0.96)] p-5 text-sm leading-7 text-zinc-500">
                Nada vence hoje na saúde. Os protocolos de ciclo longo continuam monitorados e vão
                aparecer aqui quando ficarem disponíveis.
              </div>
            )}
          </GlassPanel>

          <GlassPanel className="space-y-4">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-[var(--accent)]" />
              <div>
                <p className="praxis-label text-[var(--accent)]">Protocolos do módulo</p>
                <h2 className="praxis-title text-2xl">Agenda preventiva</h2>
              </div>
            </div>

            {healthTasks.length ? (
              <div className="space-y-3">
                {healthTasks.map((task) => {
                  const completed = isTaskCompletedForDate(task, today);
                  const dueNow = isTaskDueForDate(task, today);

                  return (
                    <div
                      key={task.id}
                      className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.98)] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="praxis-label text-[var(--accent)]">
                              {dueNow ? "Disponível" : "Em monitoramento"}
                            </span>
                            <span className="rounded-sm border border-zinc-800 px-2 py-1 text-[0.72rem] uppercase tracking-[0.18em] text-zinc-400">
                              {nextHealthWindowLabel(task, today)}
                            </span>
                          </div>
                          <p className="font-title text-lg font-semibold text-zinc-100">
                            {task.title}
                          </p>
                          <p className="text-sm leading-7 text-zinc-500">{task.description}</p>
                        </div>

                        <div className="text-right">
                          <p className="praxis-label text-zinc-500">
                            {task.scheduledTime || "Sem horário"}
                          </p>
                          <p className="mt-2 text-sm text-zinc-400">
                            {formatRecurrence(task.recurrence)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-zinc-500">
                        <span>{task.xp} XP</span>
                        <span>•</span>
                        <span>{cadenceBadgeLabel(task.recurrence)}</span>
                        <span>•</span>
                        <span>{completed ? "Concluído no ciclo atual" : "Pendente"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-sm border border-dashed border-zinc-800 bg-[rgba(10,10,12,0.96)] p-5 text-sm leading-7 text-zinc-500">
                Nenhum protocolo de saúde criado ainda. Comece com um check-up, um exame de sangue
                ou uma consulta recorrente.
              </div>
            )}
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
