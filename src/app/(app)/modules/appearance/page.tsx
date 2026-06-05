"use client";

import { useState } from "react";
import { CheckCircle2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import { appearanceRoutineTemplates } from "@/lib/mock-data";
import type {
  AppearanceRoutineTemplate,
  Task,
  TaskDifficulty,
  Weekday,
} from "@/lib/types";
import {
  formatRecurrence,
  getTaskDifficultyFromXp,
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

type AppearanceTaskDraft = {
  templateId: string;
  editingTaskId?: string;
  title: string;
  description: string;
  scheduledTime: string;
  difficulty: TaskDifficulty;
  recurrenceKind: "daily" | "selected-weekdays";
  weekdays: Weekday[];
};

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

function buildDraft(template: AppearanceRoutineTemplate): AppearanceTaskDraft {
  return {
    templateId: template.id,
    title: template.name,
    description: template.description,
    scheduledTime: template.defaultTime,
    difficulty: getTaskDifficultyFromXp(template.suggestedXp),
    recurrenceKind:
      template.defaultWeekdays.length === weekdayOptions.length
        ? "daily"
        : "selected-weekdays",
    weekdays: template.defaultWeekdays,
  };
}

function buildDraftFromTask(
  task: Task,
  fallbackWeekday: Weekday,
): AppearanceTaskDraft {
  const kind: AppearanceTaskDraft["recurrenceKind"] =
    task.recurrence.kind === "daily" ? "daily" : "selected-weekdays";
  const weekdays =
    task.recurrence.weekdays?.length
      ? task.recurrence.weekdays
      : task.recurrence.weekday
        ? [task.recurrence.weekday]
        : [fallbackWeekday];

  return {
    templateId: "",
    editingTaskId: task.id,
    title: task.title,
    description: task.description,
    scheduledTime: task.scheduledTime ?? "",
    difficulty: task.difficulty ?? getTaskDifficultyFromXp(task.xp),
    recurrenceKind: kind,
    weekdays,
  };
}

export default function AppearanceModulePage() {
  const { state, actions } = useAppStore();
  const today = new Date();
  const todayWeekday = getTodayWeekday(today);
  const appearanceTasks = state.tasks
    .filter((task) => task.moduleId === "appearance")
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
  const tasksDueToday = appearanceTasks.filter((task) =>
    isTaskDueForDate(task, today),
  );
  const completedTasks = appearanceTasks.filter((task) =>
    isTaskCompletedForDate(task, today),
  ).length;
  const activeTasks = appearanceTasks.filter(
    (task) => !isTaskCompletedForDate(task, today),
  ).length;
  const [draft, setDraft] = useState<AppearanceTaskDraft | null>(null);

  function toggleDraftWeekday(day: Weekday) {
    setDraft((current) => {
      if (!current) return current;

      const exists = current.weekdays.includes(day);
      const nextWeekdays = exists
        ? current.weekdays.filter((item) => item !== day)
        : [...current.weekdays, day];

      return {
        ...current,
        weekdays: nextWeekdays,
      };
    });
  }

  function saveTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft?.title.trim()) return;

    const weekdays =
      draft.recurrenceKind === "daily"
        ? weekdayOptions
        : draft.weekdays.length
          ? draft.weekdays
          : [todayWeekday];

    const recurrence =
      draft.recurrenceKind === "daily"
        ? { kind: "daily" as const }
        : { kind: "selected-weekdays" as const, weekdays };

    if (draft.editingTaskId) {
      actions.updateTask({
        taskId: draft.editingTaskId,
        patch: {
          title: draft.title.trim(),
          description: draft.description.trim(),
          scheduledTime: draft.scheduledTime || undefined,
          difficulty: draft.difficulty,
          recurrence,
        },
      });
    } else {
      actions.addTask({
        title: draft.title.trim(),
        description: draft.description.trim(),
        category: "appearance",
        moduleId: "appearance",
        scheduledTime: draft.scheduledTime || undefined,
        difficulty: draft.difficulty,
        recurrence,
      });
    }

    setDraft(null);
  }

  // Formulário de edição/criação, renderizado inline (logo abaixo da
  // tarefa que está sendo editada, ou abaixo da biblioteca quando é
  // uma nova tarefa vinda de um template).
  function renderDraftForm() {
    if (!draft) return null;

    return (
      <div
        className="praxis-panel rounded-sm p-4"
        style={{ borderColor: "rgba(251,146,60,0.34)" }}
      >
        <div className="mb-4">
          <p className="text-sm text-zinc-500">
            {draft.editingTaskId ? "Editar tarefa" : "Finalizar tarefa"}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-zinc-100">
            {draft.editingTaskId
              ? "Ajuste nome, horário e dias"
              : "Edite antes de salvar"}
          </h3>
        </div>

        <form className="space-y-4" onSubmit={saveTask}>
          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Nome da tarefa</span>
            <input
              value={draft.title}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, title: event.target.value } : current,
                )
              }
              className={fieldClassName}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Descrição</span>
            <textarea
              rows={4}
              value={draft.description}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, description: event.target.value } : current,
                )
              }
              className={fieldClassName}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm text-zinc-300">Horário</span>
              <input
                type="time"
                value={draft.scheduledTime}
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? { ...current, scheduledTime: event.target.value }
                      : current,
                  )
                }
                className={fieldClassName}
              />
            </label>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-zinc-300">Frequência</p>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "selected-weekdays", label: "Dias específicos" },
                { id: "daily", label: "Todos os dias" },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            recurrenceKind: option.id as AppearanceTaskDraft["recurrenceKind"],
                          }
                        : current,
                    )
                  }
                  className={`rounded-sm border px-4 py-2 text-sm ${
                    draft.recurrenceKind === option.id
                      ? "border-transparent bg-[var(--accent)] font-semibold text-[#140a03] shadow-[0_0_14px_rgba(251,146,60,0.45)]"
                      : "border-zinc-800 bg-black/50 text-zinc-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {draft.recurrenceKind === "selected-weekdays" ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-300">Dias da rotina</p>
              <div className="flex flex-wrap gap-2">
                {weekdayOptions.map((day) => {
                  const active = draft.weekdays.includes(day);

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDraftWeekday(day)}
                      className={`rounded-sm border px-3 py-2 text-sm ${
                        active
                          ? "border-[rgba(251,146,60,0.34)] bg-[rgba(251,146,60,0.12)] text-[var(--accent)]"
                          : "border-zinc-800 bg-black/50 text-zinc-300"
                      }`}
                    >
                      {weekdayLongLabel(day)}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 praxis-button px-4 py-3 text-slate-950"
            >
              {draft.editingTaskId ? "Salvar alterações" : "Salvar tarefa"}
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-sm border border-zinc-800 bg-black/60 px-4 py-3 text-sm text-zinc-300"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mod-hero">
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div className="mod-icon" style={{ width: 56, height: 56, borderRadius: 14, fontSize: 24 }}>✨</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="praxis-label" style={{ color: "var(--accent)", marginBottom: 4 }}>▸ MÓDULO · APARÊNCIA</div>
            <div className="praxis-title" style={{ fontSize: 26 }}>Cuidado pessoal</div>
            <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
              Rotinas de skincare, grooming e cuidado corporal viram tarefas reais do módulo.
            </div>
          </div>
          <div className="mod-hero-side" style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div className="mod-hero-side-stat" style={{ textAlign: "right", borderLeft: "1px solid rgba(39,39,42,0.6)", paddingLeft: 16 }}>
              <div className="praxis-label" style={{ fontSize: 9 }}>HOJE</div>
              <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "var(--font-space-grotesk), sans-serif", marginTop: 2 }}>
                {tasksDueToday.length}/{activeTasks}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className="kpi">
          <div className="praxis-label">Rotinas disponíveis</div>
          <div className="kpi-value">{appearanceRoutineTemplates.length}</div>
          <div className="kpi-sub">Biblioteca pronta</div>
        </div>
        <div className="kpi">
          <div className="praxis-label">Tarefas ativas</div>
          <div className="kpi-value">{activeTasks}</div>
          <div className="kpi-sub">No módulo</div>
        </div>
        <div className="kpi">
          <div className="praxis-label">Para hoje</div>
          <div className="kpi-value">{tasksDueToday.length}</div>
          <div className="kpi-sub">{weekdayLongLabel(todayWeekday).toLowerCase()}</div>
        </div>
        <div className="kpi">
          <div className="praxis-label">Concluídas</div>
          <div className="kpi-value" style={{ color: "var(--ok)" }}>{completedTasks}</div>
          <div className="kpi-sub">Histórico</div>
        </div>
      </div>

      <GlassPanel className="space-y-4">
        <div>
          <p className="text-sm text-zinc-500">Tarefas do módulo</p>
          <h2 className="mt-1 text-2xl font-semibold text-zinc-100">
            O que já está em execução
          </h2>
        </div>

        {appearanceTasks.length ? (
          <div className="space-y-3">
            {appearanceTasks.map((task) => {
              const completedForToday = isTaskCompletedForDate(task, today);
              const isEditing = draft?.editingTaskId === task.id;

              return (
                <div key={task.id} className="space-y-3">
                <div
                  className="praxis-panel rounded-sm p-4"
                  style={
                    isEditing
                      ? { borderColor: "rgba(251,146,60,0.34)" }
                      : undefined
                  }
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-sm border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-300">
                          {formatRecurrence(task.recurrence)}
                        </span>
                        {task.scheduledTime ? (
                          <span className="rounded-sm border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-300">
                            {task.scheduledTime}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 break-words font-semibold text-zinc-100">
                        {task.title}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-zinc-500">
                        {task.description}
                      </p>
                    </div>
                    <span className="w-fit rounded-sm border border-[rgba(251,146,60,0.22)] bg-[rgba(251,146,60,0.12)] px-3 py-2 text-xs text-[var(--accent)]">
                      +{task.xp} XP
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => actions.toggleTask(task.id)}
                      className={`inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-xs ${
                        completedForToday
                          ? "border-zinc-800 bg-black/60 text-zinc-300"
                          : "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {completedForToday ? "Concluída" : "Concluir"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft(buildDraftFromTask(task, todayWeekday))
                      }
                      className="inline-flex items-center gap-2 rounded-sm border border-[rgba(251,146,60,0.22)] bg-[rgba(251,146,60,0.08)] px-3 py-2 text-xs text-[var(--accent)]"
                    >
                      <Pencil className="h-4 w-4" />
                      {isEditing ? "Editando…" : "Editar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (draft?.editingTaskId === task.id) {
                          setDraft(null);
                        }
                        actions.removeTask(task.id);
                      }}
                      className="inline-flex items-center gap-2 rounded-sm border border-zinc-800 bg-black/60 px-3 py-2 text-xs text-zinc-300"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </button>
                  </div>
                </div>

                {isEditing ? renderDraftForm() : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-sm border border-dashed border-zinc-800 bg-black/40 p-5 text-sm text-zinc-500">
            Nenhuma tarefa de aparência criada ainda. Use a biblioteca abaixo
            para adicionar a primeira.
          </div>
        )}
      </GlassPanel>

      <GlassPanel className="space-y-4">
        <div>
          <p className="text-sm text-zinc-500">Biblioteca de rotinas</p>
          <h2 className="mt-1 text-2xl font-semibold text-zinc-100">
            Escolha a base e ajuste antes de criar
          </h2>
        </div>

        <div className="space-y-3">
          {appearanceRoutineTemplates.map((template) => {
            const isAddingThis =
              !!draft && !draft.editingTaskId && draft.templateId === template.id;

            return (
            <div key={template.id} className="space-y-3">
            <div
              className="praxis-panel rounded-sm p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-sm border border-[rgba(251,146,60,0.22)] bg-[rgba(251,146,60,0.12)] px-3 py-2 text-[var(--accent)]">
                      {template.categoryName}
                    </span>
                    <span className="rounded-sm border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-300">
                      {template.frequencyLabel}
                    </span>
                    <span className="rounded-sm border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-300">
                      {template.defaultTime}
                    </span>
                  </div>
                  <p className="mt-3 text-xl font-semibold text-zinc-100">
                    {template.name}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    {template.description}
                  </p>
                </div>
                <Sparkles className="h-6 w-6 shrink-0 text-[var(--accent)]" />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {template.steps.map((step) => (
                  <span
                    key={step}
                    className="rounded-sm border border-zinc-800 bg-black/50 px-3 py-2 text-xs text-zinc-300"
                  >
                    {step}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setDraft(buildDraft(template))}
                  className="praxis-button inline-flex items-center gap-2 px-4 py-2 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar como tarefa
                </button>
              </div>
            </div>

            {isAddingThis ? renderDraftForm() : null}
            </div>
            );
          })}
        </div>
      </GlassPanel>
    </div>
  );
}









