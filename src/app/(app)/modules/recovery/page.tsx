"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  NotebookPen,
  Plus,
  Sparkles,
  Trash2,
  Waves,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import type {
  RecoveryDayCompletion,
  RecoveryDayPlan,
  RecoveryExercise,
  Weekday,
} from "@/lib/types";
import { formatDateKey, weekdayLongLabel } from "@/lib/utils";

/* ── Local helpers ─────────────────────────────────────────────── */

const weekdayOrder: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const weekdayShortLabel: Record<Weekday, string> = {
  monday: "Seg",
  tuesday: "Ter",
  wednesday: "Qua",
  thursday: "Qui",
  friday: "Sex",
  saturday: "Sáb",
  sunday: "Dom",
};

const weekdayFromJsIndex: Record<number, Weekday> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

const fieldClassName = "praxis-field w-full px-3 py-2.5 text-sm";

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

function endOfWeek(date: Date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/* Prebuilt mobility templates the user can apply to any weekday. */
const dayPresets: Array<{
  id: string;
  title: string;
  focus: string;
  summary: string;
  exercises: Omit<RecoveryExercise, "id">[];
}> = [
  {
    id: "preset-morning-mobility",
    title: "Mobilidade matinal",
    focus: "Quadril, coluna torácica, ombros",
    summary: "Abertura geral pra começar o dia com amplitude.",
    exercises: [
      { name: "Cat-cow", bodyArea: "Coluna", sets: 2, durationOrReps: "10 reps lentas" },
      { name: "Hip 90/90", bodyArea: "Quadril", sets: 2, durationOrReps: "8 reps cada lado" },
      { name: "Thoracic openers", bodyArea: "Coluna torácica", sets: 2, durationOrReps: "8 reps cada lado" },
      { name: "Shoulder CARs", bodyArea: "Ombros", sets: 2, durationOrReps: "5 reps cada lado" },
    ],
  },
  {
    id: "preset-post-workout-stretch",
    title: "Alongamento pós-treino",
    focus: "Posteriores, glúteos, panturrilha",
    summary: "Devolução de amplitude depois do esforço.",
    exercises: [
      { name: "Pigeon", bodyArea: "Quadril", sets: 1, durationOrReps: "45s cada lado" },
      { name: "Hamstring estático", bodyArea: "Posterior de coxa", sets: 1, durationOrReps: "45s cada lado" },
      { name: "Panturrilha em parede", bodyArea: "Panturrilha", sets: 1, durationOrReps: "45s cada lado" },
      { name: "Child pose", bodyArea: "Coluna lombar", sets: 1, durationOrReps: "60s" },
    ],
  },
  {
    id: "preset-myofascial",
    title: "Liberação miofascial",
    focus: "Pontos tensos com rolo e bola",
    summary: "Pressão leve e movimento curto pra desfazer rigidez.",
    exercises: [
      { name: "Rolo na coluna torácica", bodyArea: "Coluna torácica", sets: 1, durationOrReps: "60s rolando" },
      { name: "Bola no glúteo", bodyArea: "Glúteo", sets: 1, durationOrReps: "60s cada lado" },
      { name: "Rolo no quadríceps", bodyArea: "Quadríceps", sets: 1, durationOrReps: "45s cada lado" },
      { name: "Bola na planta do pé", bodyArea: "Pé", sets: 1, durationOrReps: "45s cada lado" },
    ],
  },
];

/* ── Page ──────────────────────────────────────────────────────── */

export default function RecoveryModulePage() {
  const { state, actions } = useAppStore();
  const plan = state.recoveryPlan ?? [];
  const completions = state.recoveryDayCompletions ?? [];

  const todayDate = useMemo(() => new Date(), []);
  const todayKey = formatDateKey(todayDate);
  const todayWeekday = weekdayFromJsIndex[todayDate.getDay()];

  /* ── Derived ─────────────────────────────────────────────────── */
  const dayByWeekday = useMemo(() => {
    const map: Partial<Record<Weekday, RecoveryDayPlan>> = {};
    for (const day of plan) map[day.weekday] = day;
    return map;
  }, [plan]);

  const totalDays = plan.filter((d) => !d.isRestDay).length;
  const totalExercises = plan.reduce((sum, d) => sum + d.exercises.length, 0);
  const weekStart = startOfWeek(todayDate);
  const weekEnd = endOfWeek(todayDate);
  const completionsThisWeek = completions.filter((c) => {
    const completedAt = new Date(c.completedAt);
    return completedAt >= weekStart && completedAt <= weekEnd;
  }).length;
  const todayPlan = dayByWeekday[todayWeekday];
  const isCompletedToday = (dayId: string) =>
    completions.some((c) => c.dayId === dayId && c.dateKey === todayKey);

  /* ── Mutations (all go through replaceRecoveryPlan) ──────────── */
  function setPlan(next: RecoveryDayPlan[]) {
    actions.replaceRecoveryPlan(next);
  }
  function setCompletions(next: RecoveryDayCompletion[]) {
    actions.replaceRecoveryDayCompletions(next);
  }

  function addDayForWeekday(weekday: Weekday) {
    if (dayByWeekday[weekday]) return;
    const newDay: RecoveryDayPlan = {
      id: makeId("rday"),
      weekday,
      title: `${weekdayLongLabel(weekday)} de mobilidade`,
      focus: "",
      summary: "",
      isRestDay: false,
      exercises: [],
      notes: "",
    };
    setPlan([...plan, newDay]);
  }

  function applyPreset(weekday: Weekday, presetId: string) {
    const preset = dayPresets.find((p) => p.id === presetId);
    if (!preset) return;
    const exercises = preset.exercises.map<RecoveryExercise>((ex) => ({
      ...ex,
      id: makeId("rex"),
    }));
    const existing = dayByWeekday[weekday];
    if (existing) {
      setPlan(
        plan.map((d) =>
          d.id === existing.id
            ? {
                ...d,
                title: preset.title,
                focus: preset.focus,
                summary: preset.summary,
                isRestDay: false,
                exercises,
              }
            : d,
        ),
      );
    } else {
      const day: RecoveryDayPlan = {
        id: makeId("rday"),
        weekday,
        title: preset.title,
        focus: preset.focus,
        summary: preset.summary,
        isRestDay: false,
        exercises,
        notes: "",
      };
      setPlan([...plan, day]);
    }
  }

  function updateDay(dayId: string, patch: Partial<RecoveryDayPlan>) {
    setPlan(plan.map((d) => (d.id === dayId ? { ...d, ...patch } : d)));
  }

  function removeDay(dayId: string) {
    setPlan(plan.filter((d) => d.id !== dayId));
    setCompletions(completions.filter((c) => c.dayId !== dayId));
  }

  function addExercise(
    dayId: string,
    exercise: Omit<RecoveryExercise, "id">,
  ) {
    setPlan(
      plan.map((d) =>
        d.id === dayId
          ? { ...d, exercises: [...d.exercises, { ...exercise, id: makeId("rex") }] }
          : d,
      ),
    );
  }

  function updateExercise(
    dayId: string,
    exerciseId: string,
    patch: Partial<RecoveryExercise>,
  ) {
    setPlan(
      plan.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((ex) =>
                ex.id === exerciseId ? { ...ex, ...patch } : ex,
              ),
            }
          : d,
      ),
    );
  }

  function removeExercise(dayId: string, exerciseId: string) {
    setPlan(
      plan.map((d) =>
        d.id === dayId
          ? { ...d, exercises: d.exercises.filter((ex) => ex.id !== exerciseId) }
          : d,
      ),
    );
  }

  function toggleCompleteToday(day: RecoveryDayPlan) {
    if (isCompletedToday(day.id)) {
      setCompletions(
        completions.filter((c) => !(c.dayId === day.id && c.dateKey === todayKey)),
      );
      return;
    }
    const newCompletion: RecoveryDayCompletion = {
      id: makeId("rcomp"),
      programId: "default",
      dayId: day.id,
      dayTitle: day.title,
      dateKey: todayKey,
      completedAt: new Date().toISOString(),
    };
    setCompletions([newCompletion, ...completions]);
  }

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 pb-24 pt-4">
      {/* Hero */}
      <div className="mod-hero">
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div className="mod-icon" style={{ width: 56, height: 56, borderRadius: 14, fontSize: 24 }}>
            🧘
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="praxis-label" style={{ color: "var(--accent)", marginBottom: 4 }}>
              ▸ MÓDULO · RECUPERAÇÃO
            </div>
            <div className="praxis-title" style={{ fontSize: 26 }}>
              Mobilidade & alongamento
            </div>
            <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
              Planeje treinos de mobilidade, alongamento e liberação por dia da semana —
              com séries e duração/reps por exercício.
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ textAlign: "right", borderLeft: "1px solid rgba(39,39,42,0.6)", paddingLeft: 16 }}>
              <div className="praxis-label" style={{ fontSize: 9 }}>SEMANA</div>
              <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "var(--font-space-grotesk), sans-serif", marginTop: 2 }}>
                {completionsThisWeek}/{totalDays || 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className="kpi">
          <div className="praxis-label">Dias planejados</div>
          <div className="kpi-value">{totalDays}</div>
          <div className="kpi-sub">com exercícios na semana</div>
        </div>
        <div className="kpi">
          <div className="praxis-label">Exercícios</div>
          <div className="kpi-value" style={{ color: "var(--accent)" }}>{totalExercises}</div>
          <div className="kpi-sub">somando todos os dias</div>
        </div>
        <div className="kpi">
          <div className="praxis-label">Concluídos · semana</div>
          <div className="kpi-value">{completionsThisWeek}</div>
          <div className="kpi-sub">sessões marcadas como feitas</div>
        </div>
        <div className="kpi">
          <div className="praxis-label">Hoje</div>
          <div className="kpi-value" style={{ color: todayPlan ? "var(--accent)" : "var(--fg-3)" }}>
            {todayPlan ? (todayPlan.isRestDay ? "Descanso" : "Tem plano") : "Sem plano"}
          </div>
          <div className="kpi-sub">{weekdayLongLabel(todayWeekday).toLowerCase()}</div>
        </div>
      </div>

      {/* Today highlight */}
      {todayPlan && !todayPlan.isRestDay ? (
        <GlassPanel className="space-y-4 border-l-2 border-l-[var(--accent)]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="praxis-label text-[var(--accent)]">
                Foco de hoje · {weekdayLongLabel(todayWeekday)}
              </p>
              <h2 className="praxis-title text-2xl">{todayPlan.title}</h2>
              {todayPlan.focus ? (
                <p className="mt-1 text-sm leading-6 text-zinc-400">{todayPlan.focus}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => toggleCompleteToday(todayPlan)}
              className={
                isCompletedToday(todayPlan.id)
                  ? "praxis-button-ghost inline-flex items-center gap-2 px-4 py-3 text-emerald-300"
                  : "praxis-button inline-flex items-center gap-2 px-4 py-3"
              }
            >
              <CheckCircle2 className="h-4 w-4" />
              {isCompletedToday(todayPlan.id) ? "Sessão concluída · desmarcar" : "Marcar como concluída"}
            </button>
          </div>
          {todayPlan.summary ? (
            <p className="text-sm leading-6 text-zinc-300">{todayPlan.summary}</p>
          ) : null}
          {todayPlan.exercises.length > 0 ? (
            <div className="rounded-sm border border-white/10 bg-[#0a0a0b]">
              {todayPlan.exercises.map((ex, index) => (
                <div
                  key={ex.id}
                  className={
                    "grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center " +
                    (index > 0 ? "border-t border-white/5" : "")
                  }
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-100">{ex.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {ex.bodyArea}
                      {ex.notes ? ` · ${ex.notes}` : ""}
                    </p>
                  </div>
                  <p className="text-sm text-zinc-300">
                    <span className="text-zinc-500">{ex.sets}×</span>{" "}
                    <span className="font-semibold text-[var(--accent)]">{ex.durationOrReps}</span>
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-sm border border-dashed border-white/10 p-4 text-sm text-zinc-500">
              Nenhum exercício neste dia ainda. Edite abaixo na grade da semana.
            </p>
          )}
        </GlassPanel>
      ) : null}

      {/* Week grid: a card per weekday */}
      <div>
        <p className="praxis-label mb-3 text-[var(--accent)]">Semana</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {weekdayOrder.map((wd) => {
            const day = dayByWeekday[wd];
            const isToday = wd === todayWeekday;
            return (
              <DayCard
                key={wd}
                weekday={wd}
                day={day}
                isToday={isToday}
                completedToday={day ? isCompletedToday(day.id) : false}
                onAdd={() => addDayForWeekday(wd)}
                onApplyPreset={(presetId) => applyPreset(wd, presetId)}
                onUpdate={(patch) => day && updateDay(day.id, patch)}
                onRemove={() => day && removeDay(day.id)}
                onAddExercise={(ex) => day && addExercise(day.id, ex)}
                onUpdateExercise={(exId, patch) =>
                  day && updateExercise(day.id, exId, patch)
                }
                onRemoveExercise={(exId) => day && removeExercise(day.id, exId)}
                onToggleComplete={() => day && toggleCompleteToday(day)}
              />
            );
          })}
        </div>
      </div>

      {/* Presets gallery */}
      <GlassPanel className="space-y-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-[var(--accent)]" />
          <div>
            <p className="praxis-label text-[var(--accent)]">Modelos</p>
            <h2 className="praxis-title text-2xl">Comece rápido</h2>
          </div>
        </div>
        <p className="text-sm text-zinc-400">
          Use um modelo pronto e ajuste depois. Aplique a qualquer dia da semana —
          se o dia já existir, ele será substituído.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {dayPresets.map((preset) => (
            <div key={preset.id} className="rounded-sm border border-white/10 bg-[#0a0a0b] p-4">
              <p className="text-base font-semibold text-zinc-100">{preset.title}</p>
              <p className="mt-1 text-xs text-zinc-500">{preset.focus}</p>
              <p className="mt-3 text-xs leading-5 text-zinc-400">{preset.summary}</p>
              <ul className="mt-3 space-y-1 text-xs text-zinc-500">
                {preset.exercises.map((ex) => (
                  <li key={ex.name}>
                    • {ex.name} <span className="text-zinc-600">— {ex.sets}× {ex.durationOrReps}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <label className="block space-y-2">
                  <span className="praxis-label text-zinc-500">Aplicar em…</span>
                  <select
                    defaultValue=""
                    onChange={(event) => {
                      const wd = event.target.value as Weekday | "";
                      if (!wd) return;
                      applyPreset(wd, preset.id);
                      event.currentTarget.value = "";
                    }}
                    className={fieldClassName}
                  >
                    <option value="">Escolha um dia</option>
                    {weekdayOrder.map((wd) => (
                      <option key={wd} value={wd}>
                        {weekdayLongLabel(wd)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>
    </main>
  );
}

/* ── DayCard ──────────────────────────────────────────────────── */

type DayCardProps = {
  weekday: Weekday;
  day?: RecoveryDayPlan;
  isToday: boolean;
  completedToday: boolean;
  onAdd: () => void;
  onApplyPreset: (presetId: string) => void;
  onUpdate: (patch: Partial<RecoveryDayPlan>) => void;
  onRemove: () => void;
  onAddExercise: (exercise: Omit<RecoveryExercise, "id">) => void;
  onUpdateExercise: (
    exerciseId: string,
    patch: Partial<RecoveryExercise>,
  ) => void;
  onRemoveExercise: (exerciseId: string) => void;
  onToggleComplete: () => void;
};

function DayCard({
  weekday,
  day,
  isToday,
  completedToday,
  onAdd,
  onApplyPreset,
  onUpdate,
  onRemove,
  onAddExercise,
  onUpdateExercise,
  onRemoveExercise,
  onToggleComplete,
}: DayCardProps) {
  const [exerciseDraft, setExerciseDraft] = useState({
    name: "",
    bodyArea: "",
    sets: "2",
    durationOrReps: "",
  });

  if (!day) {
    return (
      <div
        className={
          "rounded-sm border border-dashed border-white/10 bg-[#0a0a0b] p-4 transition hover:border-[var(--accent)]/40 " +
          (isToday ? "ring-1 ring-[var(--accent)]/30" : "")
        }
      >
        <div className="flex items-center justify-between gap-2">
          <p className="praxis-label text-zinc-400">
            {weekdayShortLabel[weekday]} · {weekdayLongLabel(weekday)}
          </p>
          {isToday ? (
            <span className="praxis-label rounded-sm border border-[var(--accent)]/30 bg-[rgba(251,146,60,0.08)] px-2 py-0.5 text-[var(--accent)]">
              Hoje
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-sm text-zinc-500">
          Sem plano para este dia.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onAdd}
            className="praxis-button-ghost inline-flex items-center justify-center gap-2 px-3 py-2 text-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Criar dia em branco
          </button>
          <select
            defaultValue=""
            onChange={(event) => {
              const id = event.target.value;
              if (!id) return;
              onApplyPreset(id);
              event.currentTarget.value = "";
            }}
            className={fieldClassName}
          >
            <option value="">Ou aplicar modelo…</option>
            {dayPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.title}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  function handleSubmitExercise(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = exerciseDraft.name.trim();
    const bodyArea = exerciseDraft.bodyArea.trim();
    const sets = Math.max(1, Number(exerciseDraft.sets) || 1);
    const durationOrReps = exerciseDraft.durationOrReps.trim();
    if (!name || !durationOrReps) return;
    onAddExercise({
      name,
      bodyArea: bodyArea || "Geral",
      sets,
      durationOrReps,
    });
    setExerciseDraft({ name: "", bodyArea: "", sets: "2", durationOrReps: "" });
  }

  return (
    <div
      className={
        "flex flex-col gap-4 rounded-sm border bg-[#0a0a0b] p-4 transition " +
        (day.isRestDay
          ? "border-white/10 opacity-80"
          : "border-white/10") +
        (isToday ? " ring-1 ring-[var(--accent)]/40" : "")
      }
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="praxis-label text-[var(--accent)]">
              {weekdayShortLabel[weekday]} · {weekdayLongLabel(weekday)}
            </p>
            {isToday ? (
              <span className="praxis-label rounded-sm border border-[var(--accent)]/30 bg-[rgba(251,146,60,0.08)] px-2 py-0.5 text-[var(--accent)]">
                Hoje
              </span>
            ) : null}
            {completedToday ? (
              <span className="praxis-label rounded-sm border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-emerald-200">
                Feito
              </span>
            ) : null}
          </div>
          <input
            value={day.title}
            onChange={(event) => onUpdate({ title: event.target.value })}
            className="mt-2 w-full bg-transparent text-base font-semibold text-zinc-100 outline-none focus:text-[var(--accent)]"
            placeholder="Título do dia"
          />
          <input
            value={day.focus}
            onChange={(event) => onUpdate({ focus: event.target.value })}
            placeholder="Foco (ex.: quadril, ombros, costas)"
            className="mt-1 w-full bg-transparent text-xs text-zinc-500 outline-none focus:text-zinc-300"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-white/10 text-zinc-500 transition hover:border-red-400/30 hover:text-red-300"
          aria-label="Remover dia"
          title="Remover dia"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Rest day toggle */}
      <label className="flex items-center gap-2 text-xs text-zinc-400">
        <input
          type="checkbox"
          checked={day.isRestDay}
          onChange={(event) => onUpdate({ isRestDay: event.target.checked })}
          className="accent-[var(--accent)]"
        />
        Marcar como dia de descanso
      </label>

      {/* Exercises */}
      {!day.isRestDay ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-[var(--accent)]" />
            <p className="praxis-label text-zinc-500">
              Exercícios {day.exercises.length > 0 ? `(${day.exercises.length})` : ""}
            </p>
          </div>
          {day.exercises.length > 0 ? (
            <div className="space-y-1.5">
              {day.exercises.map((ex) => (
                <ExerciseRow
                  key={ex.id}
                  exercise={ex}
                  onUpdate={(patch) => onUpdateExercise(ex.id, patch)}
                  onRemove={() => onRemoveExercise(ex.id)}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-sm border border-dashed border-white/10 px-3 py-2 text-xs text-zinc-500">
              Adicione o primeiro exercício abaixo.
            </p>
          )}

          {/* Quick add */}
          <form onSubmit={handleSubmitExercise} className="space-y-2 rounded-sm border border-white/10 bg-black/40 p-3">
            <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr]">
              <input
                value={exerciseDraft.name}
                onChange={(event) =>
                  setExerciseDraft((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Exercício (ex.: Cat-cow)"
                className={fieldClassName}
              />
              <input
                value={exerciseDraft.bodyArea}
                onChange={(event) =>
                  setExerciseDraft((current) => ({ ...current, bodyArea: event.target.value }))
                }
                placeholder="Área (ex.: coluna)"
                className={fieldClassName}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-[80px_1fr_auto]">
              <input
                value={exerciseDraft.sets}
                onChange={(event) =>
                  setExerciseDraft((current) => ({ ...current, sets: event.target.value }))
                }
                type="number"
                min="1"
                max="20"
                className={fieldClassName}
                placeholder="Sets"
              />
              <input
                value={exerciseDraft.durationOrReps}
                onChange={(event) =>
                  setExerciseDraft((current) => ({
                    ...current,
                    durationOrReps: event.target.value,
                  }))
                }
                placeholder="Duração/reps (ex.: 30s cada lado, 10 reps)"
                className={fieldClassName}
              />
              <button
                type="submit"
                className="praxis-button inline-flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Notes */}
      <label className="flex items-start gap-2">
        <NotebookPen className="mt-2 h-3.5 w-3.5 shrink-0 text-zinc-500" />
        <textarea
          value={day.notes ?? ""}
          onChange={(event) => onUpdate({ notes: event.target.value })}
          placeholder="Notas (opcional)"
          rows={2}
          className="w-full resize-none rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-[var(--accent)]/40"
        />
      </label>

      {/* Complete button */}
      {!day.isRestDay ? (
        <button
          type="button"
          onClick={onToggleComplete}
          className={
            completedToday
              ? "praxis-button-ghost inline-flex items-center justify-center gap-2 px-3 py-2 text-sm text-emerald-300"
              : "praxis-button inline-flex items-center justify-center gap-2 px-3 py-2 text-sm"
          }
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {completedToday ? "Concluído · desmarcar" : "Marcar como feito hoje"}
        </button>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-sm border border-white/10 bg-black/40 p-2 text-xs text-zinc-500">
          <Waves className="h-3.5 w-3.5" />
          Dia de descanso
        </div>
      )}
    </div>
  );
}

/* ── ExerciseRow ──────────────────────────────────────────────── */

type ExerciseRowProps = {
  exercise: RecoveryExercise;
  onUpdate: (patch: Partial<RecoveryExercise>) => void;
  onRemove: () => void;
};

function ExerciseRow({ exercise, onUpdate, onRemove }: ExerciseRowProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-sm border border-white/5 bg-black/30 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-sm font-medium text-zinc-100">{exercise.name}</p>
          <p className="mt-0.5 truncate text-xs text-zinc-500">
            {exercise.bodyArea} · <span className="font-medium text-[var(--accent)]">{exercise.sets}×</span>{" "}
            {exercise.durationOrReps}
          </p>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-white/10 text-zinc-500 transition hover:border-red-400/30 hover:text-red-300"
          aria-label="Remover exercício"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {expanded ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="praxis-label text-zinc-500">Exercício</span>
            <input
              value={exercise.name}
              onChange={(event) => onUpdate({ name: event.target.value })}
              className={fieldClassName}
            />
          </label>
          <label className="block space-y-1">
            <span className="praxis-label text-zinc-500">Área</span>
            <input
              value={exercise.bodyArea}
              onChange={(event) => onUpdate({ bodyArea: event.target.value })}
              className={fieldClassName}
            />
          </label>
          <label className="block space-y-1">
            <span className="praxis-label text-zinc-500">Sets</span>
            <input
              type="number"
              min={1}
              max={20}
              value={exercise.sets}
              onChange={(event) =>
                onUpdate({ sets: Math.max(1, Number(event.target.value) || 1) })
              }
              className={fieldClassName}
            />
          </label>
          <label className="block space-y-1">
            <span className="praxis-label text-zinc-500">Duração / reps</span>
            <input
              value={exercise.durationOrReps}
              onChange={(event) => onUpdate({ durationOrReps: event.target.value })}
              className={fieldClassName}
            />
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className="praxis-label text-zinc-500">Notas (opcional)</span>
            <input
              value={exercise.notes ?? ""}
              onChange={(event) => onUpdate({ notes: event.target.value })}
              className={fieldClassName}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

