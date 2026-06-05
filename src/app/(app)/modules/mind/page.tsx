"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  NotebookPen,
  Pencil,
  Plus,
  Sparkles,
  TimerReset,
  Trash2,
  X,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import type { Task, Weekday } from "@/lib/types";
import {
  formatRecurrence,
  isTaskCompletedForDate,
  isTaskDueForDate,
  weekdayLongLabel,
} from "@/lib/utils";

const fieldClassName = "praxis-field w-full px-4 py-3 text-sm";

const weekdayOptions: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

// Estilo do toggle SELECIONADO (dia/frequência). Inline de propósito: a
// classe base .praxis-button-ghost fica fora de @layer em globals.css e
// vence as utilities do Tailwind (@layer utilities) por cascade layers —
// então bg-[var(--accent)] via className não aplicava. Inline vence tudo.
const activeToggleStyle = {
  background: "var(--accent)",
  borderColor: "transparent",
  color: "#140a03",
  boxShadow: "0 0 14px rgba(251,146,60,0.45)",
};

const mindPresets = [
  {
    id: "meditation",
    label: "Meditação",
    title: "Meditação guiada",
    description: "Sessão curta para estabilizar a mente e baixar o ruído do dia.",
    scheduledTime: "07:00",
    xp: 35,
    weekdays: ["monday", "tuesday", "wednesday", "thursday", "friday"] as Weekday[],
  },
  {
    id: "breathing",
    label: "Respiração",
    title: "Respiração consciente",
    description: "Bloco breve de respiração para reduzir tensão e organizar a atenção.",
    scheduledTime: "12:30",
    xp: 25,
    weekdays: ["monday", "wednesday", "friday"] as Weekday[],
  },
  {
    id: "journal",
    label: "Journal",
    title: "Journal rápido",
    description: "Escrever como o dia começou, o que pesa e o que precisa ficar claro.",
    scheduledTime: "21:30",
    xp: 30,
    weekdays: ["tuesday", "thursday", "sunday"] as Weekday[],
  },
  {
    id: "focus",
    label: "Foco",
    title: "Bloco de foco mental",
    description: "Prática sem distração para consolidar presença, clareza e concentração.",
    scheduledTime: "09:30",
    xp: 40,
    weekdays: ["monday", "tuesday", "wednesday", "thursday", "friday"] as Weekday[],
  },
];

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

export default function MindModulePage() {
  const { state, actions } = useAppStore();
  const today = new Date();
  const todayWeekday = getTodayWeekday(today);
  const mindTasks = state.tasks
    .filter((task) => task.moduleId === "mind")
    .sort((left, right) => {
      const leftCompleted = isTaskCompletedForDate(left, today);
      const rightCompleted = isTaskCompletedForDate(right, today);

      if (leftCompleted !== rightCompleted) {
        return leftCompleted ? 1 : -1;
      }

      if (left.scheduledTime && right.scheduledTime) {
        return left.scheduledTime.localeCompare(right.scheduledTime);
      }

      return left.title.localeCompare(right.title);
    });
  const mindTasksToday = mindTasks.filter((task) => isTaskDueForDate(task, today));
  const completedCount = mindTasks.filter((task) =>
    isTaskCompletedForDate(task, today),
  ).length;
  const openCount = mindTasks.length - completedCount;
  const mindXpOpen = mindTasks
    .filter((task) => !isTaskCompletedForDate(task, today))
    .reduce((sum, task) => sum + task.xp, 0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledTime, setScheduledTime] = useState("07:00");
  const [recurrenceKind, setRecurrenceKind] = useState<"daily" | "selected-weekdays">(
    "selected-weekdays",
  );
  const [weekdays, setWeekdays] = useState<Weekday[]>([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
  ]);
  // editingTaskId !== null muda o saveTask pra updateTask (edição) em
  // vez de addTask (criação). Padrão consistente entre os módulos de
  // tarefas (Mente, Casa, Saúde, Aparência).
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function resetForm() {
    setTitle("");
    setDescription("");
    setScheduledTime("07:00");
    setRecurrenceKind("selected-weekdays");
    setWeekdays(["monday", "tuesday", "wednesday", "thursday", "friday"]);
    setEditingTaskId(null);
  }

  function applyPreset(presetId: string) {
    const preset = mindPresets.find((item) => item.id === presetId);
    if (!preset) return;

    setTitle(preset.title);
    setDescription(preset.description);
    setScheduledTime(preset.scheduledTime);
    setRecurrenceKind("selected-weekdays");
    setWeekdays(preset.weekdays);
    setEditingTaskId(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function startEditingTask(task: Task) {
    setTitle(task.title);
    setDescription(task.description);
    setScheduledTime(task.scheduledTime ?? "");
    if (task.recurrence.kind === "daily") {
      setRecurrenceKind("daily");
    } else {
      setRecurrenceKind("selected-weekdays");
      const taskWeekdays =
        task.recurrence.kind === "selected-weekdays" &&
        task.recurrence.weekdays?.length
          ? task.recurrence.weekdays
          : task.recurrence.kind === "weekly-fixed" && task.recurrence.weekday
            ? [task.recurrence.weekday]
            : [todayWeekday];
      setWeekdays(taskWeekdays);
    }
    setEditingTaskId(task.id);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
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

    const recurrence =
      recurrenceKind === "daily"
        ? ({ kind: "daily" } as const)
        : ({
            kind: "selected-weekdays" as const,
            weekdays: weekdays.length ? weekdays : [todayWeekday],
          } as const);

    if (editingTaskId) {
      actions.updateTask({
        taskId: editingTaskId,
        patch: {
          title: title.trim(),
          description: description.trim(),
          scheduledTime: scheduledTime || undefined,
          recurrence,
        },
      });
    } else {
      actions.addTask({
        title: title.trim(),
        description: description.trim(),
        category: "mindfulness",
        moduleId: "mind",
        scheduledTime: scheduledTime || undefined,
        difficulty: "hard",
        recurrence,
      });
    }

    resetForm();
  }

  return (
    <div className="space-y-6">
      {/* Module hero */}
      <div className="mod-hero">
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div className="mod-icon" style={{ width: 56, height: 56, borderRadius: 14, fontSize: 24 }}>🧠</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="praxis-label" style={{ color: "var(--accent)", marginBottom: 4 }}>▸ MÓDULO · MENTE</div>
            <div className="praxis-title" style={{ fontSize: 26 }}>Planejamento mental</div>
            <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
              Tarefas mentais recorrentes — meditação, journaling, blocos de foco.
            </div>
          </div>
          <div className="mod-hero-side" style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div className="mod-hero-side-stat" style={{ textAlign: "right", borderLeft: "1px solid rgba(39,39,42,0.6)", paddingLeft: 16 }}>
              <div className="praxis-label" style={{ fontSize: 9 }}>HOJE</div>
              <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "var(--font-space-grotesk), sans-serif", marginTop: 2 }}>
                {mindTasksToday.length}/{mindTasks.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className="kpi">
          <div className="praxis-label">Tarefas mentais</div>
          <div className="kpi-value">{mindTasks.length}</div>
          <div className="kpi-sub">Total do módulo</div>
        </div>
        <div className="kpi">
          <div className="praxis-label">Pendentes</div>
          <div className="kpi-value" style={{ color: openCount > 0 ? "var(--accent)" : "var(--fg)" }}>{openCount}</div>
          <div className="kpi-sub">Em aberto</div>
        </div>
        <div className="kpi">
          <div className="praxis-label">Para hoje</div>
          <div className="kpi-value">{mindTasksToday.length}</div>
          <div className="kpi-sub">{weekdayLongLabel(todayWeekday).toLowerCase()}</div>
        </div>
        <div className="kpi">
          <div className="praxis-label">XP em aberto</div>
          <div className="kpi-value" style={{ color: "var(--accent)" }}>{mindXpOpen}</div>
          <div className="kpi-sub">Carga da mente</div>
        </div>
      </div>

      {/* Atalho contextual para Utilitários — Focus Timer, Ruído branco
          e Reset respiratório vivem fora do módulo Mente, mas servem
          diretamente para foco e regulação. */}
      <Link
        href="/tools"
        className="group flex items-center gap-4 rounded-sm border border-white/10 bg-[#0a0a0b] p-4 transition hover:border-[var(--accent)]/40 hover:bg-[rgba(251,146,60,0.06)]"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-[var(--accent)]/30 bg-[rgba(251,146,60,0.08)] text-[var(--accent)]">
          <TimerReset className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="praxis-label text-[var(--accent)]">Ferramentas da mente</p>
          <p className="mt-1 text-sm leading-6 text-zinc-200">
            Focus Timer, Ruído branco e Reset respiratório — utilitários para apoiar foco e regulação.
          </p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
      </Link>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <GlassPanel className="space-y-4">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-[var(--accent)]" />
            <div>
              <p className="praxis-label text-[var(--accent)]">
                {editingTaskId ? "Editar tarefa" : "Nova tarefa"}
              </p>
              <h2 className="praxis-title text-2xl">
                {editingTaskId
                  ? "Ajuste os campos abaixo"
                  : "Planejamento mental"}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {mindPresets.map((preset) => (
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

          <form ref={formRef} className="space-y-4" onSubmit={saveTask}>
            <label className="block space-y-2">
              <span className="praxis-label text-[var(--accent)]">Título</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex.: meditação guiada, journal rápido ou bloco de foco"
                className={fieldClassName}
              />
            </label>

            <label className="block space-y-2">
              <span className="praxis-label text-[var(--accent)]">Descrição</span>
              <textarea
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Descreva como a prática deve acontecer e o objetivo da tarefa."
                className={fieldClassName}
              />
            </label>

            <label className="block space-y-2">
              <span className="praxis-label text-[var(--accent)]">Horário</span>
              <input
                type="time"
                value={scheduledTime}
                onChange={(event) => setScheduledTime(event.target.value)}
                className={fieldClassName}
              />
            </label>

            <div className="space-y-3">
              <p className="praxis-label text-[var(--accent)]">Frequência</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "selected-weekdays", label: "Dias específicos" },
                  { id: "daily", label: "Todos os dias" },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      setRecurrenceKind(
                        option.id as "daily" | "selected-weekdays",
                      )
                    }
                    aria-pressed={recurrenceKind === option.id}
                    style={recurrenceKind === option.id ? activeToggleStyle : undefined}
                    className={`praxis-button-ghost px-4 py-2 ${
                      recurrenceKind === option.id ? "" : "opacity-70"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {recurrenceKind === "selected-weekdays" ? (
              <div className="space-y-3">
                <p className="praxis-label text-[var(--accent)]">Dias da semana</p>
                <div className="flex flex-wrap gap-2">
                  {weekdayOptions.map((day) => {
                    const active = weekdays.includes(day);

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleWeekday(day)}
                        aria-pressed={active}
                        style={active ? activeToggleStyle : undefined}
                        className={`praxis-button-ghost px-3 py-2 ${
                          active ? "" : "opacity-70"
                        }`}
                      >
                        {weekdayLongLabel(day)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="submit"
                className="praxis-button inline-flex flex-1 items-center justify-center gap-2 px-4 py-3"
              >
                {editingTaskId ? (
                  <>
                    <Pencil className="h-4 w-4" />
                    Salvar alterações
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Criar tarefa mental
                  </>
                )}
              </button>
              {editingTaskId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="praxis-button-ghost inline-flex items-center justify-center gap-2 px-4 py-3"
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>
        </GlassPanel>

        <div className="space-y-6">
          <GlassPanel className="space-y-4">
            <div>
              <p className="praxis-label text-[var(--accent)]">Hoje na mente</p>
              <h2 className="mt-1 praxis-title text-2xl">
                O que entra na agenda de hoje
              </h2>
            </div>

            {mindTasksToday.length ? (
              <div className="space-y-3">
                {mindTasksToday.map((task) => {
                  const completedForToday = isTaskCompletedForDate(task, today);
                  const isEditing = editingTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      className="praxis-panel rounded-sm p-4"
                      style={
                        isEditing
                          ? { borderColor: "rgba(251,146,60,0.34)" }
                          : undefined
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-3 py-2 text-[var(--accent)]">
                              Mente
                            </span>
                            {task.scheduledTime ? (
                              <span className="rounded-sm border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-400">
                                {task.scheduledTime}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-3 truncate font-medium text-zinc-100">{task.title}</p>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500">
                            {task.description}
                          </p>
                        </div>
                        <span className="rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-3 py-2 text-xs text-[var(--accent)]">
                          +{task.xp} XP
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => actions.toggleTask(task.id)}
                          className={`inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-xs ${
                            completedForToday
                              ? "border-zinc-800 bg-black/50 text-zinc-500"
                              : "border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] text-zinc-100"
                          }`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {completedForToday ? "Concluída" : "Concluir"}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditingTask(task)}
                          className="inline-flex items-center gap-2 rounded-sm border border-[rgba(251,146,60,0.22)] bg-[rgba(251,146,60,0.08)] px-3 py-2 text-xs text-[var(--accent)]"
                        >
                          <Pencil className="h-4 w-4" />
                          {isEditing ? "Editando…" : "Editar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (editingTaskId === task.id) resetForm();
                            actions.removeTask(task.id);
                          }}
                          className="inline-flex items-center gap-2 rounded-sm border border-zinc-800 bg-black/50 px-3 py-2 text-xs text-zinc-400"
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
              <div className="rounded-sm border border-dashed border-zinc-800 bg-black/40 p-5 text-sm leading-6 text-zinc-500">
                Nenhuma tarefa mental cai em {weekdayLongLabel(todayWeekday).toLowerCase()}.
              </div>
            )}
          </GlassPanel>

          <GlassPanel className="space-y-4">
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <Sparkles className="h-4 w-4" />
              Biblioteca do módulo
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {mindPresets.map((preset) => (
                <div
                  key={preset.id}
                  className="praxis-panel rounded-sm p-4"
                >
                  <p className="truncate font-medium text-zinc-100">{preset.title}</p>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500">
                    {preset.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-400">
                    <span className="rounded-sm border border-zinc-800 bg-black/50 px-3 py-2">
                      {preset.scheduledTime}
                    </span>
                    <span className="rounded-sm border border-zinc-800 bg-black/50 px-3 py-2">
                      {preset.weekdays.map(weekdayLongLabel).join(", ")}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    className="praxis-button mt-4 inline-flex w-full items-center justify-center gap-2 px-3 py-2 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar como tarefa
                  </button>
                </div>
              ))}
            </div>
          </GlassPanel>

          <GlassPanel className="space-y-4">
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <NotebookPen className="h-4 w-4" />
              Tarefas do módulo
            </div>
            {mindTasks.length ? (
              <div className="space-y-3">
                {mindTasks.map((task) => {
                  const completedForToday = isTaskCompletedForDate(task, today);
                  const isEditing = editingTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      className="praxis-panel rounded-sm p-4"
                      style={
                        isEditing
                          ? { borderColor: "rgba(251,146,60,0.34)" }
                          : undefined
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-sm border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-400">
                              {formatRecurrence(task.recurrence)}
                            </span>
                            {task.scheduledTime ? (
                              <span className="rounded-sm border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-400">
                                {task.scheduledTime}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-3 truncate font-medium text-zinc-100">{task.title}</p>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500">
                            {task.description}
                          </p>
                        </div>
                        <span className="rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-3 py-2 text-xs text-[var(--accent)]">
                          +{task.xp} XP
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => actions.toggleTask(task.id)}
                          className={`inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-xs ${
                            completedForToday
                              ? "border-zinc-800 bg-black/50 text-zinc-500"
                              : "border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] text-zinc-100"
                          }`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {completedForToday ? "Concluída" : "Concluir"}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditingTask(task)}
                          className="inline-flex items-center gap-2 rounded-sm border border-[rgba(251,146,60,0.22)] bg-[rgba(251,146,60,0.08)] px-3 py-2 text-xs text-[var(--accent)]"
                        >
                          <Pencil className="h-4 w-4" />
                          {isEditing ? "Editando…" : "Editar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (editingTaskId === task.id) resetForm();
                            actions.removeTask(task.id);
                          }}
                          className="inline-flex items-center gap-2 rounded-sm border border-zinc-800 bg-black/50 px-3 py-2 text-xs text-zinc-400"
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
              <div className="rounded-sm border border-dashed border-zinc-800 bg-black/40 p-5 text-sm leading-6 text-zinc-500">
                Crie a primeira tarefa mental para o módulo aparecer na agenda.
              </div>
            )}
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
