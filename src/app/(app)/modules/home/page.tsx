"use client";

import { useState } from "react";
import {
  CheckCircle2,
  House,
  Plus,
  Trash2,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import type { TaskDifficulty, Weekday } from "@/lib/types";
import {
  getTaskDifficultyFromXp,
  isTaskDueForDate,
  isTaskCompletedForDate,
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

const homePresets = [
  {
    id: "cleaning",
    label: "Limpeza",
    title: "Limpeza da casa",
    description:
      "Bloco para limpar os ambientes principais e manter a casa em ordem.",
    scheduledTime: "09:00",
    xp: 35,
    weekdays: ["monday", "wednesday", "friday"] as Weekday[],
  },
  {
    id: "laundry",
    label: "Lavanderia",
    title: "Lavar e organizar roupas",
    description:
      "Separar, lavar, secar e guardar as roupas da rotina da semana.",
    scheduledTime: "10:30",
    xp: 30,
    weekdays: ["tuesday", "saturday"] as Weekday[],
  },
  {
    id: "shopping",
    label: "Compras",
    title: "Revisar compras da casa",
    description:
      "Checar o que faltou em casa e abrir o módulo Mercado para comparar ofertas.",
    scheduledTime: "18:00",
    xp: 40,
    weekdays: ["thursday", "saturday"] as Weekday[],
  },
  {
    id: "maintenance",
    label: "Manutenção",
    title: "Checklist de manutenção doméstica",
    description:
      "Verificar pequenos ajustes, reposições e pendências da casa.",
    scheduledTime: "11:00",
    xp: 45,
    weekdays: ["sunday"] as Weekday[],
  },
  {
    id: "organization",
    label: "Organização",
    title: "Organizar ambientes",
    description:
      "Colocar a casa no lugar, destravar acúmulos e deixar tudo funcional.",
    scheduledTime: "19:30",
    xp: 30,
    weekdays: ["monday", "thursday", "sunday"] as Weekday[],
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

export default function HomeModulePage() {
  const { state, actions } = useAppStore();
  const today = new Date();
  const todayWeekday = getTodayWeekday(today);
  const homeTasks = state.tasks
    .filter((task) => task.moduleId === "home")
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
  const homeTasksToday = homeTasks.filter((task) => isTaskDueForDate(task, today));
  const completedCount = homeTasks.filter((task) =>
    isTaskCompletedForDate(task, today),
  ).length;
  const openCount = homeTasks.length - completedCount;
  const homeXpOpen = homeTasks
    .filter((task) => !isTaskCompletedForDate(task, today))
    .reduce((sum, task) => sum + task.xp, 0);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [difficulty, setDifficulty] = useState<TaskDifficulty>("medium");
  const [recurrenceKind, setRecurrenceKind] = useState<
    "daily" | "selected-weekdays"
  >("selected-weekdays");
  const [weekdays, setWeekdays] = useState<Weekday[]>([
    "monday",
    "wednesday",
    "friday",
  ]);

  function applyPreset(presetId: string) {
    const preset = homePresets.find((item) => item.id === presetId);
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
      category: "productivity",
      moduleId: "home",
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
    setScheduledTime("09:00");
    setDifficulty("medium");
    setRecurrenceKind("selected-weekdays");
    setWeekdays(["monday", "wednesday", "friday"]);
  }

  return (
    <div className="space-y-6">
      {/* Module hero — design bundle's mod-hero pattern */}
      <div className="mod-hero">
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div
            className="mod-icon"
            style={{ width: 56, height: 56, borderRadius: 14, fontSize: 24 }}
          >
            🏠
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="praxis-label" style={{ color: "var(--accent)", marginBottom: 4 }}>
              ▸ MÓDULO · CASA
            </div>
            <div className="praxis-title" style={{ fontSize: 26 }}>
              Gestão do lar
            </div>
            <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
              Tarefas domésticas, manutenção e rotinas. Compras agora ficam em Mercado.
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div
              style={{
                textAlign: "right",
                borderLeft: "1px solid rgba(39,39,42,0.6)",
                paddingLeft: 16,
              }}
            >
              <div className="praxis-label" style={{ fontSize: 9 }}>HOJE</div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  fontFamily: "var(--font-space-grotesk), sans-serif",
                  marginTop: 2,
                }}
              >
                {homeTasksToday.length}/{homeTasks.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <div className="kpi">
          <div className="praxis-label">Tarefas</div>
          <div className="kpi-value">{homeTasks.length}</div>
          <div className="kpi-sub">Total do módulo</div>
        </div>
        <div className="kpi">
          <div className="praxis-label">Pendentes</div>
          <div className="kpi-value" style={{ color: openCount > 0 ? "var(--accent)" : "var(--fg)" }}>
            {openCount}
          </div>
          <div className="kpi-sub">Em aberto</div>
        </div>
        <div className="kpi">
          <div className="praxis-label">Para hoje</div>
          <div className="kpi-value">{homeTasksToday.length}</div>
          <div className="kpi-sub">{weekdayLongLabel(todayWeekday).toLowerCase()}</div>
        </div>
        <div className="kpi">
          <div className="praxis-label">XP em aberto</div>
          <div className="kpi-value" style={{ color: "var(--accent)" }}>{homeXpOpen}</div>
          <div className="kpi-sub">Carga atual</div>
        </div>
        <div className="kpi">
          <div className="praxis-label">Compras</div>
          <div className="kpi-value" style={{ fontSize: 20 }}>Mercado</div>
          <div className="kpi-sub">Em módulo próprio</div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-6">
          <GlassPanel className="space-y-4">
            <div className="flex items-center gap-3">
              <House className="h-6 w-6 text-[var(--accent)]" />
              <div>
                <p className="praxis-label text-[var(--accent)]">Nova tarefa</p>
                <h2 className="praxis-title text-2xl">
                  Planejamento da casa
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {homePresets.map((preset) => (
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
                  placeholder="Ex.: limpar cozinha, lavar roupas ou revisar compras"
                  className={fieldClassName}
                />
              </label>

              <label className="block space-y-2">
                <span className="praxis-label text-[var(--accent)]">
                  Descrição
                </span>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Explique o que precisa ser feito nessa tarefa doméstica."
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
                  <p className="praxis-label text-[var(--accent)]">
                    Dias da semana
                  </p>
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
                Criar tarefa da casa
              </button>
            </form>
          </GlassPanel>

        </div>

        <div className="space-y-6">
          <GlassPanel className="space-y-4">
            <div>
              <p className="praxis-label text-[var(--accent)]">Hoje em casa</p>
              <h2 className="mt-1 praxis-title text-2xl">
                O que entra na rotina de hoje
              </h2>
            </div>

            {homeTasksToday.length ? (
              <div className="space-y-3">
                {homeTasksToday.map((task) => {
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
                              Casa
                            </span>
                            {task.scheduledTime ? (
                              <span className="rounded-sm border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-400">
                                {task.scheduledTime}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-3 truncate font-medium text-zinc-100">
                            {task.title}
                          </p>
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
                Nenhuma tarefa da casa cai em{" "}
                {weekdayLongLabel(todayWeekday).toLowerCase()}.
              </div>
            )}
          </GlassPanel>

          <GlassPanel className="space-y-4">
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <House className="h-4 w-4" />
              Frentes da casa
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {homePresets.map((preset) => (
                <div key={preset.id} className="praxis-panel rounded-sm p-4">
                  <p className="truncate font-medium text-zinc-100">
                    {preset.title}
                  </p>
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
        </div>
      </div>
    </div>
  );
}
