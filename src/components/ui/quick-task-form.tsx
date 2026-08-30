"use client";

import { useState } from "react";
import type { ModuleId, TaskDifficulty, TaskRecurrence, Weekday } from "@/lib/types";
import type { QuickFormConfig, QuickFormRecurrenceKind } from "@/lib/task-creation";
import {
  buildHealthRecurrence,
  getHealthDifficulty,
  type HealthRecurrenceKind,
} from "@/lib/health-task-rules";
import { useAppStore } from "@/components/providers/app-store-provider";
import { weekdayLabel } from "@/lib/utils";

const WEEKDAY_ORDER: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function todayWeekday(): Weekday {
  const jsDay = new Date().getDay(); // 0 = domingo
  return WEEKDAY_ORDER[(jsDay + 6) % 7];
}

const RECURRENCE_LABELS: Record<QuickFormRecurrenceKind, string> = {
  "one-time": "Uma vez",
  daily: "Todo dia",
  "selected-weekdays": "Dias da semana",
  "interval-days": "A cada N dias",
  monthly: "Mensal",
};

const chipBase =
  "rounded-sm border px-3 py-1.5 text-xs font-medium transition";
const chipOff = `${chipBase} border-zinc-800 bg-black/40 text-zinc-400 hover:border-white/20`;
const chipOn = `${chipBase} border-amber-300/40 bg-amber-300/10 text-amber-100`;

/**
 * Form rápido do fluxo global "Nova meta". Dirigido pelo QuickFormConfig
 * do registry (task-creation.ts): a category, a dificuldade interna e as
 * recorrências permitidas vêm de lá — idênticas ao form nativo do módulo,
 * pra tarefa criada aqui valer o MESMO XP.
 *
 * O form NÃO pergunta dificuldade nem XP: essa escolha não existe mais na
 * UI do app (os forms nativos dos módulos também só definem por dentro).
 *
 * Nunca envia sourceKey: tarefa daqui é sempre manual (sourceKey é o
 * canal das tarefas sincronizadas pelos módulos).
 */
export function QuickTaskForm({
  moduleId,
  config,
  onCreated,
}: {
  moduleId: ModuleId | null;
  config: QuickFormConfig;
  onCreated: (title: string) => void;
}) {
  const { actions } = useAppStore();
  const [title, setTitle] = useState("");
  const [scheduledTime, setScheduledTime] = useState(config.defaultTime ?? "");
  const [recurrenceKind, setRecurrenceKind] = useState<QuickFormRecurrenceKind>(
    config.recurrenceKinds[0],
  );
  const [weekdays, setWeekdays] = useState<Weekday[]>([todayWeekday()]);
  const [intervalDays, setIntervalDays] = useState(30);
  const [dayOfMonth, setDayOfMonth] = useState(1);

  function toggleWeekday(day: Weekday) {
    setWeekdays((current) =>
      current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day],
    );
  }

  function buildRecurrence(): TaskRecurrence {
    if (config.difficultyMode === "derived-health") {
      // Saúde usa o builder extraído do módulo (clamps idênticos).
      return buildHealthRecurrence(
        recurrenceKind as HealthRecurrenceKind,
        todayWeekday(),
        intervalDays,
        weekdays,
        dayOfMonth,
      );
    }
    if (recurrenceKind === "selected-weekdays") {
      return {
        kind: "selected-weekdays",
        weekdays: weekdays.length ? weekdays : [todayWeekday()],
      };
    }
    if (recurrenceKind === "one-time") {
      return { kind: "one-time" };
    }
    return { kind: "daily" };
  }

  /**
   * Dificuldade é regra INTERNA (entra no cálculo de XP) — o app não
   * pergunta isso ao usuário em lugar nenhum, e este form não é exceção.
   * Espelha o que o form nativo de cada módulo define por dentro.
   */
  function resolveDifficulty(): TaskDifficulty {
    if (config.difficultyMode === "fixed-hard") return "hard";
    if (config.difficultyMode === "derived-health") {
      return getHealthDifficulty(
        recurrenceKind as HealthRecurrenceKind,
        intervalDays,
      );
    }
    return "medium";
  }

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return;

    actions.addTask({
      title: trimmed,
      description: "",
      category: config.category,
      moduleId,
      scheduledTime: scheduledTime || undefined,
      difficulty: resolveDifficulty(),
      recurrence: buildRecurrence(),
    });
    onCreated(trimmed);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          O que você quer fazer?
        </label>
        <input
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          placeholder="Ex.: Pagar o contador, meditar 10 min…"
          className="mt-2 w-full rounded-sm border border-zinc-800 bg-black/60 px-4 py-3 text-white placeholder:text-zinc-600"
        />
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          Repetição
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {config.recurrenceKinds.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setRecurrenceKind(kind)}
              className={recurrenceKind === kind ? chipOn : chipOff}
            >
              {RECURRENCE_LABELS[kind]}
            </button>
          ))}
        </div>
        {recurrenceKind === "selected-weekdays" ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {WEEKDAY_ORDER.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleWeekday(day)}
                className={weekdays.includes(day) ? chipOn : chipOff}
              >
                {weekdayLabel(day)}
              </button>
            ))}
          </div>
        ) : null}
        {recurrenceKind === "interval-days" ? (
          <label className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
            A cada
            <input
              type="number"
              min={1}
              value={intervalDays}
              onChange={(event) =>
                setIntervalDays(Math.max(1, Number(event.target.value) || 1))
              }
              className="w-20 rounded-sm border border-zinc-800 bg-black/60 px-2 py-1.5 text-center text-white"
            />
            dias
          </label>
        ) : null}
        {recurrenceKind === "monthly" ? (
          <label className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
            Todo dia
            <input
              type="number"
              min={1}
              max={28}
              value={dayOfMonth}
              onChange={(event) =>
                setDayOfMonth(
                  Math.max(1, Math.min(28, Number(event.target.value) || 1)),
                )
              }
              className="w-20 rounded-sm border border-zinc-800 bg-black/60 px-2 py-1.5 text-center text-white"
            />
            do mês
          </label>
        ) : null}
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          Horário (opcional)
        </label>
        <input
          type="time"
          value={scheduledTime}
          onChange={(event) => setScheduledTime(event.target.value)}
          className="mt-2 w-full rounded-sm border border-zinc-800 bg-black/60 px-4 py-3 text-white"
        />
        {scheduledTime ? (
          <p className="mt-1.5 text-xs text-zinc-500">
            Um lembrete será ativado às {scheduledTime}.
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!title.trim()}
        className="w-full rounded-sm border border-amber-300/30 bg-[linear-gradient(135deg,var(--accent)_0%,#fbbf24_100%)] px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Criar meta
      </button>
    </div>
  );
}
