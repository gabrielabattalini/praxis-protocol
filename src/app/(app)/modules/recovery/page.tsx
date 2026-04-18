"use client";

import { useState } from "react";
import {
  CheckCircle2,
  HeartPulse,
  Plus,
  Trash2,
  Waves,
  ZapOff,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import { PageIntro } from "@/components/ui/page-intro";
import type { TaskDifficulty, Weekday } from "@/lib/types";
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

const recoveryPresets = [
  {
    id: "mobility",
    label: "Mobilidade",
    title: "Treino de mobilidade",
    description: "Sessão para abrir quadril, coluna torácica, ombros e tornozelos.",
    scheduledTime: "07:30",
    xp: 35,
    weekdays: ["monday", "wednesday", "friday"] as Weekday[],
  },
  {
    id: "stretching",
    label: "Alongamento",
    title: "Alongamento guiado",
    description: "Bloco leve para reduzir rigidez e recuperar amplitude de movimento.",
    scheduledTime: "20:00",
    xp: 30,
    weekdays: ["tuesday", "thursday", "saturday"] as Weekday[],
  },
  {
    id: "release",
    label: "Liberação",
    title: "Liberação miofascial",
    description: "Rolo, bola e pressão leve nos pontos mais tensos do corpo.",
    scheduledTime: "18:30",
    xp: 40,
    weekdays: ["tuesday", "thursday", "sunday"] as Weekday[],
  },
  {
    id: "rest",
    label: "Descanso",
    title: "Descanso ativo",
    description: "Pausa estratégica com caminhada leve, respiração e recuperação do corpo.",
    scheduledTime: "21:00",
    xp: 25,
    weekdays: ["sunday"] as Weekday[],
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

export default function RecoveryModulePage() {
  const { state, actions } = useAppStore();
  const today = new Date();
  const todayWeekday = getTodayWeekday(today);
  const recoveryTasks = state.tasks
    .filter((task) => task.moduleId === "recovery")
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
  const recoveryTasksToday = recoveryTasks.filter((task) =>
    isTaskDueForDate(task, today),
  );
  const completedCount = recoveryTasks.filter((task) =>
    isTaskCompletedForDate(task, today),
  ).length;
  const openCount = recoveryTasks.length - completedCount;
  const recoveryXpOpen = recoveryTasks
    .filter((task) => !isTaskCompletedForDate(task, today))
    .reduce((sum, task) => sum + task.xp, 0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledTime, setScheduledTime] = useState("07:30");
  const [difficulty, setDifficulty] = useState<TaskDifficulty>("medium");
  const [recurrenceKind, setRecurrenceKind] = useState<"daily" | "selected-weekdays">(
    "selected-weekdays",
  );
  const [weekdays, setWeekdays] = useState<Weekday[]>([
    "monday",
    "wednesday",
    "friday",
  ]);

  function applyPreset(presetId: string) {
    const preset = recoveryPresets.find((item) => item.id === presetId);
    if (!preset) return;

    setTitle(preset.title);
    setDescription(preset.description);
    setScheduledTime(preset.scheduledTime);
    setDifficulty(getTaskDifficultyFromXp(preset.xp));
    setRecurrenceKind("selected-weekdays");
    setWeekdays(preset.weekdays);
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

    actions.addTask({
      title: title.trim(),
      description: description.trim(),
      category: "fitness",
      moduleId: "recovery",
      scheduledTime: scheduledTime || undefined,
      difficulty,
      recurrence:
        recurrenceKind === "daily"
          ? { kind: "daily" }
          : {
              kind: "selected-weekdays",
              weekdays: weekdays.length ? weekdays : [todayWeekday],
            },
    });

    setTitle("");
    setDescription("");
    setScheduledTime("07:30");
    setDifficulty("medium");
    setRecurrenceKind("selected-weekdays");
    setWeekdays(["monday", "wednesday", "friday"]);
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Módulo"
        title="Recuperação"
        description="Crie tarefas de mobilidade, alongamento, liberação e descanso com leitura limpa e sem componentes escapando da caixa."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <GlassPanel className="space-y-2">
          <p className="praxis-label text-[var(--accent)]">Tarefas de recuperação</p>
          <p className="font-title text-4xl font-bold text-zinc-100">{recoveryTasks.length}</p>
          <p className="text-sm leading-6 text-zinc-500">Total do módulo</p>
        </GlassPanel>
        <GlassPanel className="space-y-2">
          <p className="praxis-label text-[var(--accent)]">Pendentes</p>
          <p className="font-title text-4xl font-bold text-zinc-100">{openCount}</p>
          <p className="text-sm leading-6 text-zinc-500">Ainda em aberto</p>
        </GlassPanel>
        <GlassPanel className="space-y-2">
          <p className="praxis-label text-[var(--accent)]">Para hoje</p>
          <p className="font-title text-4xl font-bold text-zinc-100">
            {recoveryTasksToday.length}
          </p>
          <p className="text-sm leading-6 text-zinc-500">
            Programadas para {weekdayLongLabel(todayWeekday).toLowerCase()}
          </p>
        </GlassPanel>
        <GlassPanel className="space-y-2">
          <p className="praxis-label text-[var(--accent)]">XP em aberto</p>
          <p className="font-title text-4xl font-bold text-zinc-100">{recoveryXpOpen}</p>
          <p className="text-sm leading-6 text-zinc-500">Carga atual de recuperação</p>
        </GlassPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <GlassPanel className="space-y-4">
          <div className="flex items-center gap-3">
            <HeartPulse className="h-6 w-6 text-[var(--accent)]" />
            <div>
              <p className="praxis-label text-[var(--accent)]">Nova tarefa</p>
              <h2 className="praxis-title text-2xl">
                Planejamento de recuperação
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {recoveryPresets.map((preset) => (
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
                placeholder="Ex.: treino de mobilidade, alongamento ou descanso ativo"
                className={fieldClassName}
              />
            </label>

            <label className="block space-y-2">
              <span className="praxis-label text-[var(--accent)]">Descrição</span>
              <textarea
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Explique o foco da sessão e o que a pessoa precisa fazer."
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
                    className={`praxis-button-ghost px-4 py-2 ${
                      recurrenceKind === option.id
                         ? "border-[rgba(251,146,60,0.34)] bg-[rgba(251,146,60,0.12)] text-zinc-100"
                        : ""
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
                        className={`praxis-button-ghost px-3 py-2 ${
                          active
                             ? "border-[rgba(251,146,60,0.34)] bg-[rgba(251,146,60,0.12)] text-zinc-100"
                            : ""
                        }`}
                      >
                        {weekdayLongLabel(day)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <button
              type="submit"
              className="praxis-button inline-flex w-full items-center justify-center gap-2 px-4 py-3"
            >
              <Plus className="h-4 w-4" />
              Criar tarefa de recuperação
            </button>
          </form>
        </GlassPanel>

        <div className="space-y-6">
          <GlassPanel className="space-y-4">
            <div>
              <p className="praxis-label text-[var(--accent)]">Hoje na recuperação</p>
              <h2 className="mt-1 praxis-title text-2xl">
                O que entra na agenda de hoje
              </h2>
            </div>

            {recoveryTasksToday.length ? (
              <div className="space-y-3">
                {recoveryTasksToday.map((task) => {
                  const completedForToday = isTaskCompletedForDate(task, today);

                  return (
                    <div
                      key={task.id}
                      className="praxis-panel rounded-sm p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-3 py-2 text-[var(--accent)]">
                              Recuperação
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

                      <div className="mt-4 flex gap-2">
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
                          onClick={() => actions.removeTask(task.id)}
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
                Nenhuma tarefa de recuperação cai em{" "}
                {weekdayLongLabel(todayWeekday).toLowerCase()}.
              </div>
            )}
          </GlassPanel>

          <GlassPanel className="space-y-4">
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <Waves className="h-4 w-4" />
              Biblioteca do módulo
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {recoveryPresets.map((preset) => (
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
                </div>
              ))}
            </div>
          </GlassPanel>

          <GlassPanel className="space-y-4">
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <ZapOff className="h-4 w-4" />
              Tarefas do módulo
            </div>
            {recoveryTasks.length ? (
              <div className="space-y-3">
                {recoveryTasks.map((task) => {
                  const completedForToday = isTaskCompletedForDate(task, today);

                  return (
                    <div
                      key={task.id}
                      className="praxis-panel rounded-sm p-4"
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

                      <div className="mt-4 flex gap-2">
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
                          onClick={() => actions.removeTask(task.id)}
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
                Crie a primeira tarefa de recuperação para o módulo aparecer na agenda.
              </div>
            )}
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
