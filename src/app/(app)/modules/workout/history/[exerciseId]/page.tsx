"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, History } from "lucide-react";
import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import { PageIntro } from "@/components/ui/page-intro";
import { workoutHistory } from "@/lib/utils";

function formatWorkoutDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatWorkoutSetSummary(
  sets: Array<{ setNumber: number; weightKg: number; repetitions: number }>,
) {
  return sets
    .map((set) => `${set.setNumber}a série · ${set.repetitions} reps · ${set.weightKg} kg`)
    .join(" / ");
}

export default function ExerciseHistoryPage() {
  const params = useParams<{ exerciseId: string }>();
  const searchParams = useSearchParams();
  const { state } = useAppStore();

  const exerciseId = Array.isArray(params.exerciseId)
    ? params.exerciseId[0]
    : params.exerciseId;
  const requestedName = searchParams.get("name") ?? "";

  const activeProgram =
    state.workoutPrograms.find(
      (program) => program.id === state.activeWorkoutProgramId,
    ) ?? state.workoutPrograms[0];

  const matchedExercise =
    state.workoutPlan
      .flatMap((day) =>
        day.exercises.map((exercise) => ({
          ...exercise,
          dayTitle: day.title,
        })),
      )
      .find((exercise) => exercise.id === exerciseId) ?? null;

  const exerciseName = matchedExercise?.name ?? requestedName ?? "Exercício";
  const exerciseHistory = useMemo(
    () =>
      workoutHistory(state.workoutLoadEntries, {
        programId: activeProgram?.id,
        exerciseId,
        exerciseName,
      }),
    [activeProgram?.id, exerciseId, exerciseName, state.workoutLoadEntries],
  );

  const totalSets = exerciseHistory.reduce(
    (sum, entry) => sum + entry.sets.length,
    0,
  );
  const bestWeight = exerciseHistory.length
    ? Math.max(
        ...exerciseHistory.flatMap((entry) =>
          entry.sets.map((set) => set.weightKg),
        ),
      )
    : 0;
  const latestEntry = exerciseHistory[0];

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Histórico do exercício"
        title={exerciseName}
        description="Todas as execuções salvas deste exercício, com data, séries, repetições e carga."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              href="/modules/workout/history"
              className="praxis-button-ghost inline-flex items-center gap-2 px-4 py-3"
            >
              <ArrowLeft className="h-4 w-4" />
              Ver histórico completo
            </Link>
            <Link
              href="/modules/workout"
              className="praxis-button inline-flex items-center gap-2 px-4 py-3"
            >
              Voltar para treino
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <GlassPanel className="space-y-2">
          <p className="praxis-label text-[var(--accent)]">Sessões registradas</p>
          <p className="font-title text-3xl font-bold text-zinc-100">
            {exerciseHistory.length}
          </p>
        </GlassPanel>
        <GlassPanel className="space-y-2">
          <p className="praxis-label text-[var(--accent)]">Séries totais</p>
          <p className="font-title text-3xl font-bold text-zinc-100">
            {totalSets}
          </p>
        </GlassPanel>
        <GlassPanel className="space-y-2">
          <p className="praxis-label text-[var(--accent)]">Melhor carga</p>
          <p className="font-title text-3xl font-bold text-zinc-100">
            {bestWeight} kg
          </p>
        </GlassPanel>
      </section>

      <GlassPanel className="space-y-5">
        <div className="flex items-center gap-3">
          <History className="h-5 w-5 text-[var(--accent)]" />
          <div>
            <p className="praxis-label text-[var(--accent)]">Linha do tempo</p>
            <h2 className="praxis-title mt-2 text-3xl">Execuções salvas</h2>
          </div>
        </div>

        {latestEntry ? (
          <div className="rounded-sm border border-[rgba(251,146,60,0.22)] bg-[rgba(251,146,60,0.08)] px-4 py-4">
            <p className="praxis-label text-[var(--accent)]">Último lançamento</p>
            <p className="mt-2 text-sm text-zinc-200">
              {formatWorkoutDateTime(latestEntry.loggedAt)}
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              {formatWorkoutSetSummary(latestEntry.sets)}
            </p>
          </div>
        ) : null}

        {exerciseHistory.length ? (
          <div className="space-y-3">
            {exerciseHistory.map((entry) => (
              <div
                key={entry.id}
                className="rounded-sm border border-zinc-800 bg-[rgba(18,18,20,0.94)] p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-headline text-lg font-bold text-zinc-100">
                      {entry.dayTitle}
                    </p>
                    <p className="mt-2 inline-flex items-center gap-2 text-sm text-zinc-500">
                      <CalendarDays className="h-4 w-4" />
                      {formatWorkoutDateTime(entry.loggedAt)}
                    </p>
                  </div>
                  <span className="rounded-sm border border-zinc-800 bg-black/40 px-3 py-2 text-xs uppercase tracking-widest text-zinc-300">
                    {entry.sets.length} séries
                  </span>
                </div>

                <div className="mt-4 grid gap-3">
                  {entry.sets.map((set) => (
                    <div
                      key={set.id}
                      className="grid gap-3 rounded-sm border border-zinc-800 bg-black/40 p-4 md:grid-cols-3"
                    >
                      <div>
                        <p className="praxis-label text-zinc-500">Série</p>
                        <p className="mt-2 font-title text-xl font-bold text-zinc-100">
                          {set.setNumber}
                        </p>
                      </div>
                      <div>
                        <p className="praxis-label text-zinc-500">Repetições</p>
                        <p className="mt-2 font-title text-xl font-bold text-zinc-100">
                          {set.repetitions}
                        </p>
                      </div>
                      <div>
                        <p className="praxis-label text-zinc-500">Peso</p>
                        <p className="mt-2 font-title text-xl font-bold text-zinc-100">
                          {set.weightKg} kg
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="praxis-panel rounded-sm border-dashed px-5 py-6 text-sm leading-6 text-zinc-500">
            Ainda não há histórico salvo para este exercício. Volte ao módulo de treino,
            registre as séries e elas aparecerão aqui automaticamente.
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
