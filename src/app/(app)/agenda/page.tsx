"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import { ProgressBar } from "@/components/ui/progress-bar";
import { buildWeekAgenda, type AgendaEvent } from "@/lib/agenda";
import { cn, formatPoints } from "@/lib/utils";

function formatFullDate(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function formatWeekRange(days: { date: Date }[]) {
  if (!days.length) return "";
  const first = days[0].date;
  const last = days[days.length - 1].date;

  return `${first
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    .replace(".", "")} - ${last
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    .replace(".", "")}`;
}

function toneForKind(kind: AgendaEvent["kind"]) {
  if (kind === "meal") {
    return {
      icon: UtensilsCrossed,
      badge:
        "border-lime-400/20 bg-lime-400/10 text-lime-100",
      iconWrap:
        "border-lime-400/15 bg-lime-400/10 text-lime-300",
      card:
        "border-zinc-800 bg-[rgba(18,18,20,0.92)] hover:border-lime-400/20",
    };
  }

  if (kind === "workout") {
    return {
      icon: Dumbbell,
      badge:
        "border-amber-400/20 bg-amber-400/10 text-amber-100",
      iconWrap:
        "border-amber-400/15 bg-amber-400/10 text-[var(--accent)]",
      card:
        "border-zinc-800 bg-[rgba(18,18,20,0.92)] hover:border-[rgba(251,146,60,0.24)]",
    };
  }

  return {
    icon: CalendarClock,
    badge:
      "border-zinc-800 bg-[rgba(14,14,17,0.96)] text-zinc-300",
    iconWrap:
      "border-zinc-800 bg-[rgba(14,14,17,0.96)] text-zinc-300",
    card:
      "border-zinc-800 bg-[rgba(18,18,20,0.92)] hover:border-zinc-700",
  };
}

function buildReferenceDate(base: Date, weekOffset: number) {
  const next = new Date(base);
  next.setDate(base.getDate() + weekOffset * 7);
  return next;
}

export default function AgendaPage() {
  const { state } = useAppStore();
  const today = useMemo(() => new Date(), []);
  const [weekOffset, setWeekOffset] = useState(0);

  const referenceDate = useMemo(
    () => buildReferenceDate(today, weekOffset),
    [today, weekOffset],
  );

  const weekAgenda = useMemo(
    () => buildWeekAgenda(state, referenceDate),
    [state, referenceDate],
  );

  const [selectedDateKey, setSelectedDateKey] = useState(weekAgenda[0]?.dateKey ?? "");

  const selectedDay =
    weekAgenda.find((day) => day.dateKey === selectedDateKey) ?? weekAgenda[0];

  const selectedDayIndex = weekAgenda.findIndex(
    (day) => day.dateKey === selectedDay?.dateKey,
  );

  const pendingItems = selectedDay?.items.filter((item) => !item.completed) ?? [];
  const completedItems = selectedDay?.items.filter((item) => item.completed) ?? [];
  const totalXp = pendingItems.reduce((sum, item) => sum + (item.xp ?? 0), 0);
  const consistency =
    selectedDay?.totalCount ? (selectedDay.completedCount / selectedDay.totalCount) * 100 : 0;
  const featuredItem = pendingItems[0] ?? completedItems[0];

  const flowItems = [
    ...pendingItems,
    ...completedItems,
  ].filter((item) => item.id !== featuredItem?.id);

  return (
    <div className="space-y-6">
      <GlassPanel className="overflow-hidden border-emerald-400/15 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_42%),rgba(10,10,12,0.98)]">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-emerald-300">
                Semana
              </p>
              <h1 className="mt-3 text-4xl font-semibold uppercase tracking-[-0.04em] text-white sm:text-5xl">
                Linha do tempo semanal
              </h1>
              <p className="mt-3 text-sm uppercase tracking-[0.18em] text-zinc-500">
                Período ativo: {formatWeekRange(weekAgenda)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-zinc-800 bg-[rgba(18,18,20,0.96)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-zinc-300">
                {selectedDayIndex >= 0 ? `Dia ${selectedDayIndex + 1}/7` : "Semana"}
              </div>
              <Link
                href="/tasks"
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/14 px-4 py-2.5 text-sm font-medium text-emerald-100 transition hover:border-emerald-400/45"
              >
                Abrir tarefas
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                Progresso semanal
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWeekOffset((current) => current - 1)}
                className="grid h-10 w-10 place-items-center rounded-full border border-zinc-800 bg-[rgba(18,18,20,0.96)] text-zinc-300 transition hover:border-zinc-700"
                aria-label="Semana anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset((current) => current + 1)}
                className="grid h-10 w-10 place-items-center rounded-full border border-zinc-800 bg-[rgba(18,18,20,0.96)] text-zinc-300 transition hover:border-zinc-700"
                aria-label="Próxima semana"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {weekAgenda.map((day) => {
              const selected = day.dateKey === selectedDay?.dateKey;
              const completion =
                day.totalCount > 0
                  ? Math.round((day.completedCount / day.totalCount) * 100)
                  : 0;

              return (
                <button
                  key={day.dateKey}
                  type="button"
                  onClick={() => setSelectedDateKey(day.dateKey)}
                  className={cn(
                    "rounded-[22px] border px-4 py-4 text-center transition",
                    selected
                      ? "border-emerald-400/40 bg-[rgba(16,185,129,0.14)] shadow-[0_0_0_1px_rgba(16,185,129,0.14)]"
                      : "border-zinc-800 bg-[rgba(18,18,20,0.92)] hover:border-zinc-700",
                  )}
                >
                  <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                    {day.shortLabel}
                  </p>
                  <div className="mt-4 flex items-center justify-center">
                    <div
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-full border text-lg font-semibold",
                        selected
                          ? "border-emerald-400/35 bg-emerald-400/12 text-emerald-100"
                          : "border-zinc-800 bg-black/40 text-white",
                      )}
                    >
                      {day.date.getDate().toString().padStart(2, "0")}
                    </div>
                  </div>
                  <p className="mt-4 text-xs uppercase tracking-[0.18em] text-zinc-500">
                    {day.completedCount}/{day.totalCount}
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full border border-zinc-800 bg-black/50">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#10b981_0%,#34d399_100%)]"
                      style={{ width: `${Math.max(day.totalCount ? 8 : 0, completion)}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </GlassPanel>

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <GlassPanel className="space-y-5 border-emerald-400/18 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_46%),rgba(10,10,12,0.98)]">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                Dia selecionado
              </p>
              <h2 className="mt-3 text-4xl font-semibold uppercase tracking-[-0.04em] text-white">
                {selectedDay?.dayLabel ?? "Semana"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                {selectedDay ? formatFullDate(selectedDay.date) : "Selecione um dia."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-[20px] border border-zinc-800 bg-[rgba(18,18,20,0.92)] px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                  Pendentes
                </p>
                <p className="mt-3 text-4xl font-semibold text-white">
                  {pendingItems.length.toString().padStart(2, "0")}
                </p>
              </div>
              <div className="rounded-[20px] border border-zinc-800 bg-[rgba(18,18,20,0.92)] px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                  Concluídas
                </p>
                <p className="mt-3 text-4xl font-semibold text-emerald-300">
                  {completedItems.length.toString().padStart(2, "0")}
                </p>
              </div>
              <div className="rounded-[20px] border border-zinc-800 bg-[rgba(18,18,20,0.92)] px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                  XP diário
                </p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  +{formatPoints(totalXp)}
                </p>
              </div>
            </div>

            <div className="rounded-[20px] border border-zinc-800 bg-[rgba(18,18,20,0.92)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                  Consistência
                </p>
                <span className="text-sm font-semibold text-emerald-300">
                  {Math.round(consistency)}%
                </span>
              </div>
              <div className="mt-4">
                <ProgressBar value={consistency} />
              </div>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-emerald-400/18 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_58%),linear-gradient(180deg,rgba(20,20,22,0.94),rgba(10,10,12,0.98))]">
              <div className="space-y-4 p-5">
                <div className="flex h-36 items-end rounded-[18px] border border-emerald-400/10 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_46%),linear-gradient(180deg,#151517_0%,#0b0b0d_100%)] p-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-200">
                      Virtude pela disciplina
                    </p>
                    <p className="mt-2 max-w-[180px] text-xs leading-6 text-zinc-400">
                      O dia fica mais leve quando o próximo bloco já vem claro.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3">
                  <Link
                    href="/tasks"
                    className="inline-flex items-center justify-between rounded-[16px] border border-zinc-800 bg-[rgba(18,18,20,0.96)] px-4 py-3 text-sm text-white transition hover:border-zinc-700"
                  >
                    Registrar refeição
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/modules/nutrition"
                    className="inline-flex items-center justify-between rounded-[16px] border border-zinc-800 bg-[rgba(18,18,20,0.96)] px-4 py-3 text-sm text-white transition hover:border-zinc-700"
                  >
                    Registrar biometria
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </GlassPanel>
        </div>

        <GlassPanel className="space-y-5">
          <div className="flex flex-col gap-3 border-b border-zinc-800 pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                Fluxo operacional
              </p>
              <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[-0.04em] text-white">
                Fluxo operacional do dia
              </h2>
            </div>
            <span className="rounded-full border border-zinc-800 bg-[rgba(18,18,20,0.96)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-zinc-300">
              {selectedDay?.totalCount ?? 0} blocos
            </span>
          </div>

          {featuredItem ? (
            <Link
              href={featuredItem.route}
              className="block rounded-[26px] border border-emerald-400/35 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(10,10,12,0.98))] p-5 shadow-[0_0_0_1px_rgba(16,185,129,0.12)] transition hover:border-emerald-400/50"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/12 px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] text-emerald-100">
                      {featuredItem.time || "Sem horário"}
                    </span>
                    <span className="rounded-full border border-zinc-800 bg-[rgba(18,18,20,0.92)] px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] text-zinc-300">
                      {featuredItem.badgeLabel}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-3xl font-semibold text-white">
                      {featuredItem.title}
                    </h3>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-300">
                      {featuredItem.description}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[16px] border border-zinc-800 bg-[rgba(18,18,20,0.92)] px-4 py-3">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                        Origem
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        {featuredItem.sourceLabel}
                      </p>
                    </div>
                    <div className="rounded-[16px] border border-zinc-800 bg-[rgba(18,18,20,0.92)] px-4 py-3">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                        Status
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        {featuredItem.completed ? "Concluído" : "Em execução"}
                      </p>
                    </div>
                    <div className="rounded-[16px] border border-zinc-800 bg-[rgba(18,18,20,0.92)] px-4 py-3">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                        Tag
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        {featuredItem.badgeLabel}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="inline-flex h-12 items-center rounded-full border border-emerald-400/25 bg-emerald-400/14 px-5 text-sm font-medium text-emerald-100">
                    Abrir bloco
                  </span>
                </div>
              </div>
            </Link>
          ) : null}

          {selectedDay?.items.length ? (
            <div className="space-y-3">
              {flowItems.map((item) => {
                const tone = toneForKind(item.kind);
                const Icon = tone.icon;

                return (
                  <Link
                    key={item.id}
                    href={item.route}
                    className={cn(
                      "flex items-center justify-between gap-4 rounded-[22px] border px-4 py-4 transition",
                      item.completed
                        ? "border-zinc-800 bg-[rgba(14,14,17,0.88)] opacity-80 hover:border-zinc-700"
                        : tone.card,
                    )}
                  >
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="w-16 shrink-0 pt-1 text-right">
                        <p className="text-sm font-medium text-zinc-200">
                          {item.time || "--:--"}
                        </p>
                      </div>

                      <span
                        className={cn(
                          "grid h-11 w-11 shrink-0 place-items-center rounded-full border",
                          tone.iconWrap,
                        )}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </span>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white">
                            {item.title}
                          </p>
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em]",
                              tone.badge,
                            )}
                          >
                            {item.badgeLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-zinc-500">
                          {item.description}
                        </p>
                        <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                          {item.sourceLabel}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {item.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                      ) : (
                        <ArrowRight className="h-4 w-4 text-zinc-500" />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-zinc-800 px-5 py-12 text-center">
              <Clock3 className="mx-auto h-6 w-6 text-zinc-500" />
              <p className="mt-4 text-lg font-semibold text-zinc-100">
                Nenhum bloco para esse dia
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                A semana continua acessível no topo. Se quiser, abra tarefas
                para montar um novo ciclo para esta data.
              </p>
            </div>
          )}

          <div className="grid gap-3 border-t border-zinc-800 pt-5 md:grid-cols-3">
            <Link
              href="/tasks"
              className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-zinc-800 bg-[rgba(18,18,20,0.96)] px-4 py-3 text-sm text-white transition hover:border-zinc-700"
            >
              Centro diário
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/modules/workout"
              className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-zinc-800 bg-[rgba(18,18,20,0.96)] px-4 py-3 text-sm text-white transition hover:border-zinc-700"
            >
              Treino do dia
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-zinc-800 bg-[rgba(18,18,20,0.96)] px-4 py-3 text-sm text-white transition hover:border-zinc-700"
            >
              Painel
              <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            </Link>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
