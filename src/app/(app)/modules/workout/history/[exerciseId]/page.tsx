"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  History,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import { PageIntro } from "@/components/ui/page-intro";
import { workoutHistory, type WorkoutHistoryEntry } from "@/lib/utils";

type HistoryEditDraft = {
  weightKg: string;
  repetitions: string;
};

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
  const { state, actions } = useAppStore();

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, HistoryEditDraft>>(
    {},
  );

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

  function startEdit(entry: WorkoutHistoryEntry) {
    setEditingEntryId(entry.id);
    setEditDrafts(
      entry.sets.reduce<Record<string, HistoryEditDraft>>((drafts, set) => {
        drafts[set.id] = {
          weightKg: String(set.weightKg),
          repetitions: String(set.repetitions),
        };
        return drafts;
      }, {}),
    );
  }

  function cancelEdit() {
    setEditingEntryId(null);
    setEditDrafts({});
  }

  function updateDraft(
    setId: string,
    field: keyof HistoryEditDraft,
    value: string,
  ) {
    setEditDrafts((current) => ({
      ...current,
      [setId]: {
        ...current[setId],
        [field]: value,
      },
    }));
  }

  function saveEdit(entry: WorkoutHistoryEntry) {
    const updates = entry.sets.map((set) => {
      const draft = editDrafts[set.id];
      const weightKg = Number(draft?.weightKg);
      const repetitions = Number.parseInt(draft?.repetitions ?? "", 10);

      if (
        !Number.isFinite(weightKg) ||
        weightKg <= 0 ||
        !Number.isFinite(repetitions) ||
        repetitions <= 0
      ) {
        return null;
      }

      return { id: set.id, weightKg, repetitions };
    });

    if (updates.some((item) => item === null)) {
      window.alert("Preencha peso e repetições válidos para todas as séries.");
      return;
    }

    actions.updateWorkoutLoadBatch({
      entries: updates.filter(
        (
          item,
        ): item is { id: string; weightKg: number; repetitions: number } =>
          item !== null,
      ),
    });
    cancelEdit();
  }

  function removeEntry(entry: WorkoutHistoryEntry) {
    const confirmed = window.confirm(
      "Apagar este registro do histórico? Essa ação não pode ser desfeita.",
    );
    if (!confirmed) return;

    actions.removeWorkoutLoadBatch(entry.sets.map((set) => set.id));
    if (editingEntryId === entry.id) {
      cancelEdit();
    }
  }

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
            {exerciseHistory.map((entry) => {
              const isEditing = editingEntryId === entry.id;
              return (
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
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-sm border border-zinc-800 bg-black/40 px-3 py-2 text-xs uppercase tracking-widest text-zinc-300">
                        {entry.sets.length} séries
                      </span>
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => saveEdit(entry)}
                            className="praxis-button inline-flex items-center gap-2 px-3 py-2 text-xs"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="inline-flex items-center gap-2 border border-zinc-800 bg-black/50 px-3 py-2 font-headline text-xs font-bold uppercase tracking-[0.25em] text-zinc-100 transition hover:border-[rgba(251,146,60,0.24)] hover:text-[var(--accent)]"
                          >
                            <X className="h-3.5 w-3.5" />
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(entry)}
                            className="inline-flex items-center gap-2 border border-zinc-800 bg-black/50 px-3 py-2 font-headline text-xs font-bold uppercase tracking-[0.25em] text-zinc-100 transition hover:border-[rgba(251,146,60,0.24)] hover:text-[var(--accent)]"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => removeEntry(entry)}
                            className="inline-flex items-center gap-2 border border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.08)] px-3 py-2 font-headline text-xs font-bold uppercase tracking-[0.25em] text-red-300 transition hover:border-[rgba(239,68,68,0.45)] hover:text-red-200"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Excluir
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {entry.sets.map((set) => {
                      const draft = editDrafts[set.id];
                      return (
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
                            <p className="praxis-label text-zinc-500">
                              Repetições
                            </p>
                            {isEditing ? (
                              <input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                value={draft?.repetitions ?? ""}
                                onChange={(event) =>
                                  updateDraft(
                                    set.id,
                                    "repetitions",
                                    event.target.value,
                                  )
                                }
                                className="mt-2 w-full rounded-sm border border-zinc-700 bg-black/60 px-3 py-2 font-title text-xl font-bold text-zinc-100 focus:border-[var(--accent)] focus:outline-none"
                              />
                            ) : (
                              <p className="mt-2 font-title text-xl font-bold text-zinc-100">
                                {set.repetitions}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="praxis-label text-zinc-500">Peso</p>
                            {isEditing ? (
                              <div className="mt-2 flex items-center gap-2">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step={0.5}
                                  min={0}
                                  value={draft?.weightKg ?? ""}
                                  onChange={(event) =>
                                    updateDraft(
                                      set.id,
                                      "weightKg",
                                      event.target.value,
                                    )
                                  }
                                  className="w-full rounded-sm border border-zinc-700 bg-black/60 px-3 py-2 font-title text-xl font-bold text-zinc-100 focus:border-[var(--accent)] focus:outline-none"
                                />
                                <span className="text-sm text-zinc-500">kg</span>
                              </div>
                            ) : (
                              <p className="mt-2 font-title text-xl font-bold text-zinc-100">
                                {set.weightKg} kg
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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
