"use client";

import Link from "next/link";
import { ArrowLeft, History, TrendingUp } from "lucide-react";
import { useMemo } from "react";
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

export default function WorkoutHistoryPage() {
  const { state } = useAppStore();
  const activeProgram =
    state.workoutPrograms.find(
      (program) => program.id === state.activeWorkoutProgramId,
    ) ?? state.workoutPrograms[0];

  const historyEntries = useMemo(
    () =>
      workoutHistory(state.workoutLoadEntries, {
        programId: activeProgram?.id,
      }),
    [activeProgram?.id, state.workoutLoadEntries],
  );

  const groupedExercises = useMemo(() => {
    const groups = new Map<
      string,
      {
        exerciseId: string;
        exerciseName: string;
        dayTitle: string;
        sessions: number;
        totalSets: number;
        bestWeight: number;
        lastLoggedAt: string;
      }
    >();

    for (const entry of historyEntries) {
      const current = groups.get(entry.exerciseId);
      const bestWeight = Math.max(...entry.sets.map((set) => set.weightKg), 0);

      if (current) {
        current.sessions += 1;
        current.totalSets += entry.sets.length;
        current.bestWeight = Math.max(current.bestWeight, bestWeight);
        current.lastLoggedAt =
          new Date(entry.loggedAt) > new Date(current.lastLoggedAt)
            ? entry.loggedAt
            : current.lastLoggedAt;
        continue;
      }

      groups.set(entry.exerciseId, {
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName,
        dayTitle: entry.dayTitle,
        sessions: 1,
        totalSets: entry.sets.length,
        bestWeight,
        lastLoggedAt: entry.loggedAt,
      });
    }

    return Array.from(groups.values()).sort(
      (left, right) =>
        new Date(right.lastLoggedAt).getTime() -
        new Date(left.lastLoggedAt).getTime(),
    );
  }, [historyEntries]);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Arquivo do treino"
        title="Histórico completo"
        description="Veja todos os exercícios já registrados dentro do programa atual e abra o histórico detalhado de cada um."
        actions={
          <Link
            href="/modules/workout"
            className="praxis-button-ghost inline-flex items-center gap-2 px-4 py-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para treino
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <GlassPanel className="space-y-2">
          <p className="praxis-label text-[var(--accent)]">Exercícios com histórico</p>
          <p className="font-title text-3xl font-bold text-zinc-100">
            {groupedExercises.length}
          </p>
        </GlassPanel>
        <GlassPanel className="space-y-2">
          <p className="praxis-label text-[var(--accent)]">Sessões registradas</p>
          <p className="font-title text-3xl font-bold text-zinc-100">
            {historyEntries.length}
          </p>
        </GlassPanel>
        <GlassPanel className="space-y-2">
          <p className="praxis-label text-[var(--accent)]">Programa ativo</p>
          <p className="font-title text-lg font-bold text-zinc-100">
            {activeProgram?.name ?? "Sem programa ativo"}
          </p>
        </GlassPanel>
      </section>

      <GlassPanel className="space-y-4">
        <div className="flex items-center gap-3">
          <History className="h-5 w-5 text-[var(--accent)]" />
          <div>
            <p className="praxis-label text-[var(--accent)]">Mapa de exercícios</p>
            <h2 className="praxis-title mt-2 text-3xl">Cada exercício com sua linha do tempo</h2>
          </div>
        </div>

        {groupedExercises.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {groupedExercises.map((exercise) => (
              <Link
                key={exercise.exerciseId}
                href={`/modules/workout/history/${exercise.exerciseId}?name=${encodeURIComponent(exercise.exerciseName)}`}
                className="praxis-panel rounded-sm p-4 transition hover:border-[rgba(251,146,60,0.24)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-headline text-lg font-bold text-zinc-100">
                      {exercise.exerciseName}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">{exercise.dayTitle}</p>
                  </div>
                  <TrendingUp className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-sm border border-zinc-800 bg-black/40 px-3 py-3">
                    <p className="praxis-label text-zinc-500">Sessões</p>
                    <p className="mt-2 font-title text-xl font-bold text-zinc-100">
                      {exercise.sessions}
                    </p>
                  </div>
                  <div className="rounded-sm border border-zinc-800 bg-black/40 px-3 py-3">
                    <p className="praxis-label text-zinc-500">Séries</p>
                    <p className="mt-2 font-title text-xl font-bold text-zinc-100">
                      {exercise.totalSets}
                    </p>
                  </div>
                  <div className="rounded-sm border border-zinc-800 bg-black/40 px-3 py-3">
                    <p className="praxis-label text-zinc-500">Melhor carga</p>
                    <p className="mt-2 font-title text-xl font-bold text-zinc-100">
                      {exercise.bestWeight} kg
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-sm text-zinc-500">
                  Último registro em {formatWorkoutDateTime(exercise.lastLoggedAt)}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="praxis-panel rounded-sm border-dashed px-5 py-6 text-sm leading-6 text-zinc-500">
            Nenhum registro de treino foi salvo ainda. Use o botão de registrar séries
            dentro do módulo de treino para começar a construir seu histórico.
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
