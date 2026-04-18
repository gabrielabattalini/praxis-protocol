"use client";

import { useState } from "react";
import { CheckCircle2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import { PageIntro } from "@/components/ui/page-intro";
import {
  appearanceCareCategories,
  appearanceRoutineTemplates,
} from "@/lib/mock-data";
import type {
  AppearanceRoutineTemplate,
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

    actions.addTask({
      title: draft.title.trim(),
      description: draft.description.trim(),
      category: "appearance",
      moduleId: "appearance",
      scheduledTime: draft.scheduledTime || undefined,
      difficulty: draft.difficulty,
      recurrence:
        draft.recurrenceKind === "daily"
          ? { kind: "daily" }
          : { kind: "selected-weekdays", weekdays },
    });

    setDraft(null);
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Módulo"
        title="Aparência"
        description="Monte rotinas reais de cuidado pessoal e transforme cada uma em tarefa do módulo antes de finalizar."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <GlassPanel>
          <p className="text-sm text-zinc-500">Rotinas disponíveis</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">
            {appearanceRoutineTemplates.length}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Biblioteca pronta para virar tarefa
          </p>
        </GlassPanel>
        <GlassPanel>
          <p className="text-sm text-zinc-500">Tarefas ativas</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">{activeTasks}</p>
          <p className="mt-2 text-sm text-zinc-500">Rotinas abertas no módulo</p>
        </GlassPanel>
        <GlassPanel>
          <p className="text-sm text-zinc-500">Programadas para hoje</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">
            {tasksDueToday.length}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Cuidados previstos para {weekdayLongLabel(todayWeekday).toLowerCase()}
          </p>
        </GlassPanel>
        <GlassPanel>
          <p className="text-sm text-zinc-500">Concluídas</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">{completedTasks}</p>
          <p className="mt-2 text-sm text-zinc-500">Histórico do módulo</p>
        </GlassPanel>
      </div>

      <GlassPanel className="space-y-4">
        <div>
          <p className="text-sm text-zinc-500">Frentes de cuidado</p>
          <h2 className="mt-1 text-2xl font-semibold text-zinc-100">
            Rotinas específicas para rosto, corpo e grooming
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {appearanceCareCategories.map((category) => (
            <div
              key={category.id}
              className="praxis-panel rounded-sm p-4"
            >
              <p className="text-base font-semibold text-zinc-100">{category.name}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {category.description}
              </p>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="rounded-sm border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-300">
                  {category.routines} rotinas
                </span>
                <span className="text-[var(--accent)]">{category.points}</span>
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <GlassPanel className="space-y-4">
          <div>
            <p className="text-sm text-zinc-500">Biblioteca de rotinas</p>
            <h2 className="mt-1 text-2xl font-semibold text-zinc-100">
              Escolha a base e ajuste antes de criar
            </h2>
          </div>

          <div className="space-y-3">
            {appearanceRoutineTemplates.map((template) => (
              <div
                key={template.id}
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
            ))}
          </div>
        </GlassPanel>

        <div className="min-w-0 space-y-6">
          <GlassPanel className="space-y-4">
            <div>
              <p className="text-sm text-zinc-500">Finalizar tarefa</p>
              <h2 className="mt-1 text-2xl font-semibold text-zinc-100">
                Edite antes de salvar
              </h2>
            </div>

            {draft ? (
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
                            ? "border-[rgba(251,146,60,0.34)] bg-[rgba(251,146,60,0.12)] text-[var(--accent)]"
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
                    Salvar tarefa
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
            ) : (
              <div className="rounded-sm border border-dashed border-zinc-800 bg-black/40 p-5 text-sm leading-6 text-zinc-500">
                Escolha uma rotina da biblioteca para abrir aqui. O ajuste final do
                nome, da descrição, do horário e dos dias acontece antes de criar a
                tarefa.
              </div>
            )}
          </GlassPanel>

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

                  return (
                    <div
                      key={task.id}
                      className="praxis-panel rounded-sm p-4"
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
                          onClick={() => actions.removeTask(task.id)}
                          className="inline-flex items-center gap-2 rounded-sm border border-zinc-800 bg-black/60 px-3 py-2 text-xs text-zinc-300"
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
              <div className="rounded-sm border border-dashed border-zinc-800 bg-black/40 p-5 text-sm text-zinc-500">
                Nenhuma tarefa de aparência criada ainda.
              </div>
            )}
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}




