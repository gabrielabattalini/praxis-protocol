"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Check,
  Clock,
  FolderPlus,
  History,
  Pencil,
  Plus,
  TimerReset,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import { ProgressCurveChart } from "@/components/ui/progress-curve-chart";
import type {
  SavedWorkoutProgram,
  Weekday,
  WorkoutDayPlan,
  WorkoutExercise,
  WorkoutMuscleGroup,
} from "@/lib/types";
import {
  latestWorkoutLoad,
  makeId,
  weekdayLongLabel,
  weeklyVolumeByMuscle,
  workoutHistory,
} from "@/lib/utils";

type WorkoutExerciseDraft = {
  id: string;
  name: string;
  muscleGroup: WorkoutMuscleGroup;
  bodyArea: string;
  sets: string;
  repRange: string;
  notes: string;
};

type WorkoutSessionDraft = {
  id: string;
  weekday: Weekday;
  title: string;
  focus: string;
  summary: string;
  accessoryText: string;
  exercises: WorkoutExerciseDraft[];
};

type WorkoutProgramDraft = {
  name: string;
  startDate: string;
  endDate: string;
  notes: string;
  sessions: WorkoutSessionDraft[];
};

const weekdayOptions: Array<{ id: Weekday; label: string }> = [
  { id: "monday", label: "Segunda" },
  { id: "tuesday", label: "Terça" },
  { id: "wednesday", label: "Quarta" },
  { id: "thursday", label: "Quinta" },
  { id: "friday", label: "Sexta" },
  { id: "saturday", label: "Sábado" },
  { id: "sunday", label: "Domingo" },
];

const sessionCountOptions = [1, 2, 3, 4, 5, 6, 7];
const seriesOrdinalLabels = [
  "Primeira série",
  "Segunda série",
  "Terceira série",
  "Quarta série",
  "Quinta série",
  "Sexta série",
  "Sétima série",
  "Oitava série",
];

const muscleGroupOptions: WorkoutMuscleGroup[] = [
  "Peito",
  "Ombro",
  "Tríceps",
  "Costas",
  "Bíceps",
  "Quadríceps",
  "Posterior",
  "Glúteos",
  "Panturrilha",
  "Core",
];

const fieldClassName =
  "praxis-field w-full px-4 py-3 text-white placeholder:text-zinc-500";
const subtleFieldClassName =
  "praxis-field w-full px-4 py-3 text-sm text-white placeholder:text-zinc-500";
const compactFieldClassName =
  "praxis-field w-full px-3 py-2.5 text-sm text-white placeholder:text-zinc-500";
const workoutEditorDraftStorageKey = "praxis-protocol:workout-editor-draft";
const workoutEditorDraftStorageKeySuffix = "workout-editor-draft";

type PersistedWorkoutEditorDraft = {
  draft: WorkoutProgramDraft;
  isOpenEnded: boolean;
  sourceProgramId: string | null;
};

type WorkoutHistoryEditDraft = {
  weightKg: string;
  repetitions: string;
};

function createExerciseDraft(
  overrides?: Partial<WorkoutExerciseDraft>,
): WorkoutExerciseDraft {
  return {
    id: makeId("draft-exercise"),
    name: "",
    muscleGroup: "Peito",
    bodyArea: "",
    sets: "3",
    repRange: "8-12",
    notes: "",
    ...overrides,
  };
}

function nextWeekday(index: number): Weekday {
  return weekdayOptions[index % weekdayOptions.length]?.id ?? "monday";
}

function createSessionDraft(
  weekday: Weekday,
  overrides?: Partial<WorkoutSessionDraft>,
): WorkoutSessionDraft {
  return {
    id: makeId("draft-session"),
    weekday,
    title: "",
    focus: "",
    summary: "",
    accessoryText: "",
    exercises: [createExerciseDraft()],
    ...overrides,
  };
}

function createProgramDraft(): WorkoutProgramDraft {
  return {
    name: "",
    startDate: "",
    endDate: "",
    notes: "",
    sessions: [createSessionDraft("monday")],
  };
}

function createProgramDraftFromSaved(
  program?: SavedWorkoutProgram,
): WorkoutProgramDraft {
  if (!program) return createProgramDraft();

  return {
    name: program.name,
    startDate: program.startDate ?? "",
    endDate: program.endDate ?? "",
    notes: program.notes ?? "",
    sessions:
      program.workoutPlan.length > 0
        ? program.workoutPlan.map((day) => ({
            id: day.id,
            weekday: day.weekday,
            title: day.title,
            focus: day.focus,
            summary: day.summary,
            accessoryText: day.accessoryWork.join("\n"),
            exercises:
              day.exercises.length > 0
                ? day.exercises.map((exercise) => ({
                    id: exercise.id,
                    name: exercise.name,
                    muscleGroup: exercise.muscleGroup,
                    bodyArea: exercise.bodyArea,
                    sets: String(exercise.sets),
                    repRange: exercise.repRange,
                    notes: exercise.notes ?? "",
                  }))
                : [createExerciseDraft()],
          }))
        : [createSessionDraft("monday")],
  };
}

function buildWorkoutPlan(draft: WorkoutProgramDraft): WorkoutDayPlan[] {
  const nextPlan = draft.sessions.map((session, sessionIndex) => {
    const exercises: WorkoutExercise[] = session.exercises
      .map((exercise, exerciseIndex) => ({
        id: exercise.id || makeId(`exercise-${exerciseIndex + 1}`),
        name: exercise.name.trim(),
        muscleGroup: exercise.muscleGroup,
        bodyArea: exercise.bodyArea.trim() || "Sem Área definida",
        sets: Math.max(1, Number.parseInt(exercise.sets, 10) || 1),
        repRange: exercise.repRange.trim() || "8-12",
        notes: exercise.notes.trim() || undefined,
      }))
      .filter((exercise) => exercise.name.length > 0);
    const accessoryWork = session.accessoryText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    if (
      !session.title.trim() &&
      !session.focus.trim() &&
      exercises.length === 0 &&
      accessoryWork.length === 0
    ) {
      return null;
    }

    return {
      id: session.id || makeId(`workout-day-${sessionIndex + 1}`),
      weekday: session.weekday,
      title: session.title.trim() || `Sessão ${sessionIndex + 1}`,
      focus: session.focus.trim() || "Treino principal",
      summary:
        session.summary.trim() ||
        "Sessão registrada para acompanhar progresso e histórico.",
      isRestDay: false,
      exercises,
      accessoryWork,
    } as WorkoutDayPlan;
  });

  return nextPlan
    .filter((day): day is WorkoutDayPlan => day !== null)
    .slice(0, 7);
}

function formatWorkoutDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatWorkoutDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatWorkoutSetSummary(
  sets: Array<{ setNumber: number; weightKg: number; repetitions: number }>,
) {
  return sets
    .map((set) => `${set.setNumber}a ${set.weightKg} kg x ${set.repetitions}`)
    .join(" / ");
}

function seriesLabel(setNumber: number) {
  return seriesOrdinalLabels[setNumber - 1] ?? `${setNumber}a série`;
}

function readPersistedWorkoutEditorDraft(
  sourceProgramId: string | null,
): PersistedWorkoutEditorDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const legacyKey = Object.keys(window.localStorage).find(
      (key) =>
        key !== workoutEditorDraftStorageKey &&
        key.endsWith(workoutEditorDraftStorageKeySuffix),
    );
    const raw =
      window.localStorage.getItem(workoutEditorDraftStorageKey) ??
      (legacyKey ? window.localStorage.getItem(legacyKey) : null);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedWorkoutEditorDraft;

    if ((parsed.sourceProgramId ?? null) !== sourceProgramId) {
      return null;
    }

    if (!parsed.draft || !Array.isArray(parsed.draft.sessions)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writePersistedWorkoutEditorDraft(
  payload: PersistedWorkoutEditorDraft,
) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    workoutEditorDraftStorageKey,
    JSON.stringify(payload),
  );
  Object.keys(window.localStorage)
    .filter(
      (key) =>
        key !== workoutEditorDraftStorageKey &&
        key.endsWith(workoutEditorDraftStorageKeySuffix),
    )
    .forEach((key) => window.localStorage.removeItem(key));
}

function clearPersistedWorkoutEditorDraft() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(workoutEditorDraftStorageKey);
  Object.keys(window.localStorage)
    .filter((key) => key.endsWith(workoutEditorDraftStorageKeySuffix))
    .forEach((key) => window.localStorage.removeItem(key));
}

export default function WorkoutModulePage() {
  const searchParams = useSearchParams();
  const { state, user, actions } = useAppStore();
  const activeProgram =
    state.workoutPrograms.find(
      (program) => program.id === state.activeWorkoutProgramId,
    ) ?? state.workoutPrograms[0];
  const initialPersistedDraft = readPersistedWorkoutEditorDraft(
    activeProgram?.id ?? null,
  );
  const trainingDays = useMemo(
    () => state.workoutPlan.filter((day) => !day.isRestDay),
    [state.workoutPlan],
  );
  const [activeDayId, setActiveDayId] = useState("");
  const [programDraft, setProgramDraft] = useState<WorkoutProgramDraft>(() =>
    initialPersistedDraft?.draft ?? createProgramDraftFromSaved(activeProgram),
  );
  const [draftSourceProgramId, setDraftSourceProgramId] = useState<string | null>(
    initialPersistedDraft?.sourceProgramId ?? (activeProgram?.id ?? null),
  );
  const [draftLoads, setDraftLoads] = useState<Record<string, string>>({});
  const [draftLoadRepetitions, setDraftLoadRepetitions] = useState<Record<string, string>>({});
  const [expandedExerciseKey, setExpandedExerciseKey] = useState<string | null>(
    null,
  );
  const [selectedCurveExerciseId, setSelectedCurveExerciseId] = useState<
    string | null
  >(null);
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [historyEditDrafts, setHistoryEditDrafts] = useState<
    Record<string, WorkoutHistoryEditDraft>
  >({});
  const [showEditor, setShowEditor] = useState(false);
  const [showSavedWorkouts, setShowSavedWorkouts] = useState(false);
  const [showWeeklyVolume, setShowWeeklyVolume] = useState(false);
  const [showGlobalHistory, setShowGlobalHistory] = useState(false);
  const [isOpenEnded, setIsOpenEnded] = useState(
    initialPersistedDraft?.isOpenEnded ?? !activeProgram?.endDate,
  );
  const [renamingProgramId, setRenamingProgramId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const requestedDayId = searchParams.get("dayId");
  const selectedDayId = trainingDays.some((day) => day.id === activeDayId)
    ? activeDayId
    : trainingDays.some((day) => day.id === requestedDayId)
      ? (requestedDayId ?? "")
      : (trainingDays[0]?.id ?? "");
  const activeDay =
    trainingDays.find((day) => day.id === selectedDayId) ?? trainingDays[0];
  const weeklyVolume = useMemo(
    () => weeklyVolumeByMuscle(trainingDays),
    [trainingDays],
  );
  const totalSets = trainingDays.reduce(
    (sum, day) =>
      sum +
      day.exercises.reduce((daySum, exercise) => daySum + exercise.sets, 0),
    0,
  );
  const totalExercises = trainingDays.reduce(
    (sum, day) => sum + day.exercises.length,
    0,
  );
  const activeProgramHistory = useMemo(
    () =>
      workoutHistory(
        state.workoutLoadEntries,
        { programId: activeProgram?.id },
      ),
    [activeProgram, state.workoutLoadEntries],
  );
  const recentLogs = activeProgramHistory.slice(0, 8);
  const latestExerciseLogMap = useMemo(() => {
    const nextMap = new Map<string, ReturnType<typeof latestWorkoutLoad>>();

    for (const day of trainingDays) {
      for (const exercise of day.exercises) {
        nextMap.set(
          exercise.id,
          latestWorkoutLoad(state.workoutLoadEntries, {
            programId: activeProgram?.id,
            exerciseId: exercise.id,
            exerciseName: exercise.name,
          }),
        );
      }
    }

    return nextMap;
  }, [activeProgram, state.workoutLoadEntries, trainingDays]);
  const dayExerciseIds = useMemo(
    () => (activeDay?.exercises ?? []).map((exercise) => exercise.id),
    [activeDay],
  );
  const dayExerciseIdsKey = dayExerciseIds.join("|");
  const exerciseIdsWithHistory = useMemo(
    () => new Set(activeProgramHistory.map((entry) => entry.exerciseId)),
    [activeProgramHistory],
  );
  const resolvedCurveExerciseId = useMemo(() => {
    if (
      selectedCurveExerciseId &&
      dayExerciseIds.includes(selectedCurveExerciseId)
    ) {
      return selectedCurveExerciseId;
    }
    const firstWithHistory = dayExerciseIds.find((id) =>
      exerciseIdsWithHistory.has(id),
    );
    return firstWithHistory ?? dayExerciseIds[0] ?? null;
  }, [dayExerciseIds, exerciseIdsWithHistory, selectedCurveExerciseId]);

  useEffect(() => {
    if (selectedCurveExerciseId && !dayExerciseIds.includes(selectedCurveExerciseId)) {
      setSelectedCurveExerciseId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayExerciseIdsKey]);

  const selectedCurveExercise = useMemo(() => {
    if (!resolvedCurveExerciseId) return null;
    return (
      activeDay?.exercises.find(
        (exercise) => exercise.id === resolvedCurveExerciseId,
      ) ?? null
    );
  }, [activeDay, resolvedCurveExerciseId]);

  const recentLoadCurve = useMemo(
    () => {
      if (!resolvedCurveExerciseId) return [];
      return activeProgramHistory
        .filter((entry) => entry.exerciseId === resolvedCurveExerciseId)
        .slice(0, 6)
        .reverse()
        .map((entry) => {
          const totalLoad = entry.sets.reduce(
            (sum, set) => sum + set.weightKg * set.repetitions,
            0,
          );

          return {
            label: formatWorkoutDate(entry.loggedAt).slice(0, 5),
            value: totalLoad,
            helper: `${entry.sets.length} séries • ${Math.round(totalLoad)} kg`,
          };
        });
    },
    [activeProgramHistory, resolvedCurveExerciseId],
  );
  const lastSevenDaysLoad = useMemo(() => {
    const referenceDate = new Date();
    const startDate = new Date(referenceDate);
    startDate.setDate(referenceDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    return state.workoutLoadEntries
      .filter((entry) => new Date(entry.loggedAt) >= startDate)
      .reduce((sum, entry) => sum + entry.weightKg * entry.repetitions, 0);
  }, [state.workoutLoadEntries]);
  const lastSevenDaysSets = useMemo(() => {
    const referenceDate = new Date();
    const startDate = new Date(referenceDate);
    startDate.setDate(referenceDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    return state.workoutLoadEntries.filter(
      (entry) => new Date(entry.loggedAt) >= startDate,
    ).length;
  }, [state.workoutLoadEntries]);
  const exercisesWithHistory = new Set(
    activeProgramHistory.map((entry) => entry.exerciseId),
  ).size;
  const lastHistoryEntry = activeProgramHistory[0] ?? null;

  const activeDayReminder = useMemo(() => {
    if (!activeDay) return null;
    return (
      state.reminders.find(
        (reminder) =>
          reminder.entityType === "workout" && reminder.entityId === activeDay.id,
      ) ?? null
    );
  }, [activeDay, state.reminders]);
  const activeDayTime = activeDayReminder?.time ?? "";
  // Effective weekdays selection for the chip row. If the user has set
  // reminder.weekdays, use that; otherwise fall back to the day's
  // canonical weekday. agenda.ts uses the same precedence to decide
  // which calendar days this workout fires on.
  const activeDayWeekdays = useMemo<Weekday[]>(() => {
    if (
      Array.isArray(activeDayReminder?.weekdays) &&
      activeDayReminder!.weekdays!.length > 0
    ) {
      return activeDayReminder!.weekdays!;
    }
    return activeDay ? [activeDay.weekday] : [];
  }, [activeDay, activeDayReminder]);

  function handleWorkoutTimeChange(value: string) {
    if (!activeDay) return;
    const trimmed = value.trim();

    if (!trimmed) {
      if (activeDayReminder) {
        actions.updateReminder({
          reminderId: activeDayReminder.id,
          patch: { time: "" },
        });
      }
      return;
    }

    if (activeDayReminder) {
      actions.updateReminder({
        reminderId: activeDayReminder.id,
        patch: { time: trimmed, enabled: true },
      });
      return;
    }

    actions.addReminder({
      entityType: "workout",
      entityId: activeDay.id,
      title: activeDay.title,
      time: trimmed,
      weekdays: [activeDay.weekday],
    });
  }

  // Toggle a weekday in/out of the reminder.weekdays array. Creates the
  // reminder if it doesn't exist yet (lets the user pick days even
  // before setting a time — but agenda only fires if time is non-empty
  // via the existing reminder flow).
  function handleWorkoutWeekdayToggle(day: Weekday) {
    if (!activeDay) return;
    const current = activeDayWeekdays;
    const isSelected = current.includes(day);
    // Don't let the user clear ALL days — keep at least one selected.
    const next = isSelected
      ? current.filter((entry) => entry !== day)
      : [...current, day];
    const nextNormalized = next.length > 0 ? next : [activeDay.weekday];

    if (activeDayReminder) {
      actions.updateReminder({
        reminderId: activeDayReminder.id,
        patch: { weekdays: nextNormalized },
      });
      return;
    }

    actions.addReminder({
      entityType: "workout",
      entityId: activeDay.id,
      title: activeDay.title,
      time: "",
      weekdays: nextNormalized,
    });
  }

  useEffect(() => {
    if (!draftSourceProgramId) {
      clearPersistedWorkoutEditorDraft();
      return;
    }

    writePersistedWorkoutEditorDraft({
      draft: programDraft,
      isOpenEnded,
      sourceProgramId: draftSourceProgramId,
    });
  }, [draftSourceProgramId, isOpenEnded, programDraft]);

  function draftSetKey(dayId: string, exerciseId: string, setNumber: number) {
    return `${dayId}:${exerciseId}:${setNumber}`;
  }

  function updateDraftWeight(
    dayId: string,
    exerciseId: string,
    setNumber: number,
    value: string,
  ) {
    const key = draftSetKey(dayId, exerciseId, setNumber);
    setDraftLoads((current) => ({ ...current, [key]: value }));
  }

  function updateDraftRepetitions(
    dayId: string,
    exerciseId: string,
    setNumber: number,
    value: string,
  ) {
    const key = draftSetKey(dayId, exerciseId, setNumber);
    setDraftLoadRepetitions((current) => ({ ...current, [key]: value }));
  }

  function canSaveLoad(dayId: string, exercise: WorkoutExercise) {
    return Array.from({ length: exercise.sets }, (_, index) => {
      const setNumber = index + 1;
      const key = draftSetKey(dayId, exercise.id, setNumber);
      const parsedWeight = Number(draftLoads[key]);
      const parsedRepetitions = Number.parseInt(
        draftLoadRepetitions[key] ?? "",
        10,
      );

      return (
        Number.isFinite(parsedWeight) &&
        parsedWeight > 0 &&
        Number.isFinite(parsedRepetitions) &&
        parsedRepetitions > 0
      );
    }).every(Boolean);
  }

  function exerciseHistoryHref(exercise: WorkoutExercise) {
    return `/modules/workout/history/${exercise.id}?name=${encodeURIComponent(exercise.name)}`;
  }

  function updateProgramField<K extends keyof WorkoutProgramDraft>(
    field: K,
    value: WorkoutProgramDraft[K],
  ) {
    setProgramDraft((current) => ({ ...current, [field]: value }));
  }

  function updateSession<K extends keyof WorkoutSessionDraft>(
    sessionId: string,
    field: K,
    value: WorkoutSessionDraft[K],
  ) {
    setProgramDraft((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === sessionId ? { ...session, [field]: value } : session,
      ),
    }));
  }

  function setSessionCount(targetCount: number) {
    setProgramDraft((current) => {
      if (targetCount === current.sessions.length) return current;
      if (targetCount < current.sessions.length) {
        return {
          ...current,
          sessions: current.sessions.slice(0, targetCount),
        };
      }

      const sessionsToAdd = Array.from(
        { length: targetCount - current.sessions.length },
        (_, index) =>
          createSessionDraft(nextWeekday(current.sessions.length + index)),
      );

      return {
        ...current,
        sessions: [...current.sessions, ...sessionsToAdd],
      };
    });
  }

  function addExercise(sessionId: string) {
    setProgramDraft((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              exercises: [...session.exercises, createExerciseDraft()],
            }
          : session,
      ),
    }));
  }

  function removeExercise(sessionId: string, exerciseId: string) {
    setProgramDraft((current) => ({
      ...current,
      sessions: current.sessions.map((session) => {
        if (session.id !== sessionId || session.exercises.length <= 1) {
          return session;
        }
        return {
          ...session,
          exercises: session.exercises.filter(
            (exercise) => exercise.id !== exerciseId,
          ),
        };
      }),
    }));
  }

  function updateExercise<K extends keyof WorkoutExerciseDraft>(
    sessionId: string,
    exerciseId: string,
    field: K,
    value: WorkoutExerciseDraft[K],
  ) {
    setProgramDraft((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              exercises: session.exercises.map((exercise) =>
                exercise.id === exerciseId
                  ? { ...exercise, [field]: value }
                  : exercise,
              ),
            }
          : session,
      ),
    }));
  }

  function resetEditor() {
    setProgramDraft(createProgramDraft());
    setDraftSourceProgramId(null);
    setIsOpenEnded(true);
  }

  function saveProgram() {
    const nextPlan = buildWorkoutPlan(programDraft);
    if (!programDraft.name.trim() || nextPlan.length === 0) return;
    const programId = draftSourceProgramId ?? makeId("workout-program");

    actions.saveCurrentWorkoutProgram({
      programId,
      name: programDraft.name.trim(),
      splitLabel: `${nextPlan.length}x / semana`,
      startDate: programDraft.startDate || undefined,
      endDate: programDraft.endDate || undefined,
      notes: programDraft.notes.trim() || undefined,
      workoutPlan: nextPlan,
    });
    setDraftSourceProgramId(programId);
    setActiveDayId(nextPlan[0]?.id ?? "");
  }

  function beginRename(program: SavedWorkoutProgram) {
    setRenamingProgramId(program.id);
    setRenameDraft(program.name);
  }

  function cancelRename() {
    setRenamingProgramId(null);
    setRenameDraft("");
  }

  function submitRename(program: SavedWorkoutProgram) {
    const nextName = renameDraft.trim();
    if (!nextName) return;

    actions.saveCurrentWorkoutProgram({
      programId: program.id,
      name: nextName,
      splitLabel: program.splitLabel,
      startDate: program.startDate,
      endDate: program.endDate,
      notes: program.notes,
      workoutPlan: program.workoutPlan,
    });

    if (draftSourceProgramId === program.id) {
      setProgramDraft((current) => ({
        ...current,
        name: nextName,
      }));
    }

    cancelRename();
  }

  function saveLoad(dayId: string, exercise: WorkoutExercise) {
    const sets = Array.from({ length: exercise.sets }, (_, index) => {
      const setNumber = index + 1;
      const key = draftSetKey(dayId, exercise.id, setNumber);
      const parsedWeight = Number(draftLoads[key]);
      const parsedRepetitions = Number.parseInt(
        draftLoadRepetitions[key] ?? "",
        10,
      );

      if (
        !Number.isFinite(parsedWeight) ||
        parsedWeight <= 0 ||
        !Number.isFinite(parsedRepetitions) ||
        parsedRepetitions <= 0
      ) {
        return null;
      }

      return {
        setNumber,
        weightKg: parsedWeight,
        repetitions: parsedRepetitions,
      };
    });

    if (sets.some((set) => set === null)) return;

    actions.saveWorkoutLoad({
      dayId,
      exerciseId: exercise.id,
      sets: sets.filter(
        (
          set,
        ): set is { setNumber: number; weightKg: number; repetitions: number } =>
          set !== null,
      ),
    });
    setDraftLoads((current) => {
      const next = { ...current };
      for (let setNumber = 1; setNumber <= exercise.sets; setNumber += 1) {
        delete next[draftSetKey(dayId, exercise.id, setNumber)];
      }
      return next;
    });
    setDraftLoadRepetitions((current) => {
      const next = { ...current };
      for (let setNumber = 1; setNumber <= exercise.sets; setNumber += 1) {
        delete next[draftSetKey(dayId, exercise.id, setNumber)];
      }
      return next;
    });
    setExpandedExerciseKey(null);
  }

  function removeProgram(program: SavedWorkoutProgram) {
    const confirmed = window.confirm(
      `Apagar o treino "${program.name}" da sua lista?`,
    );
    if (!confirmed) return;

    const remainingPrograms = state.workoutPrograms.filter(
      (item) => item.id !== program.id,
    );
    const fallbackProgram =
      program.id === state.activeWorkoutProgramId
        ? remainingPrograms[0]
        : remainingPrograms.find(
            (item) => item.id === state.activeWorkoutProgramId,
          ) ?? remainingPrograms[0];

    actions.removeWorkoutProgram(program.id);

    if (
      program.id === state.activeWorkoutProgramId ||
      program.id === draftSourceProgramId
    ) {
      const persistedDraft = fallbackProgram
        ? readPersistedWorkoutEditorDraft(fallbackProgram.id)
        : null;

      if (!fallbackProgram) {
        clearPersistedWorkoutEditorDraft();
        setProgramDraft(createProgramDraft());
        setDraftSourceProgramId(null);
        setIsOpenEnded(true);
        setActiveDayId("");
        return;
      }

      setProgramDraft(
        persistedDraft?.draft ?? createProgramDraftFromSaved(fallbackProgram),
      );
      setDraftSourceProgramId(fallbackProgram.id);
      setIsOpenEnded(persistedDraft?.isOpenEnded ?? !fallbackProgram.endDate);
      setActiveDayId(fallbackProgram.workoutPlan[0]?.id ?? "");
    }
  }

  function startHistoryEdit(
    entry: ReturnType<typeof workoutHistory>[number],
  ) {
    setEditingHistoryId(entry.id);
    setHistoryEditDrafts(
      entry.sets.reduce<Record<string, WorkoutHistoryEditDraft>>(
        (drafts, set) => {
          drafts[set.id] = {
            weightKg: String(set.weightKg),
            repetitions: String(set.repetitions),
          };
          return drafts;
        },
        {},
      ),
    );
  }

  function cancelHistoryEdit() {
    setEditingHistoryId(null);
    setHistoryEditDrafts({});
  }

  function saveHistoryEdit(
    entry: ReturnType<typeof workoutHistory>[number],
  ) {
    const updates = entry.sets.map((set) => {
      const draft = historyEditDrafts[set.id];
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

      return {
        id: set.id,
        weightKg,
        repetitions,
      };
    });

    if (updates.some((item) => item === null)) return;

    actions.updateWorkoutLoadBatch({
      entries: updates.filter(
        (
          item,
        ): item is { id: string; weightKg: number; repetitions: number } =>
          item !== null,
      ),
    });
    cancelHistoryEdit();
  }

  function removeHistoryEntry(
    entry: ReturnType<typeof workoutHistory>[number],
  ) {
    const confirmed = window.confirm("Apagar esse registro do histórico?");
    if (!confirmed) return;

    actions.removeWorkoutLoadBatch(entry.sets.map((set) => set.id));
    if (editingHistoryId === entry.id) {
      cancelHistoryEdit();
    }
  }

  function toggleEditorPanel() {
    if (!showEditor) {
      setProgramDraft(createProgramDraftFromSaved(activeProgram));
      setDraftSourceProgramId(activeProgram?.id ?? null);
      setIsOpenEnded(!activeProgram?.endDate);
    }
    setShowEditor((current) => !current);
  }

  function openEditorForProgram(program?: SavedWorkoutProgram) {
    setProgramDraft(createProgramDraftFromSaved(program ?? activeProgram));
    setDraftSourceProgramId(program?.id ?? activeProgram?.id ?? null);
    setIsOpenEnded(!(program ?? activeProgram)?.endDate);
    setShowSavedWorkouts(false);
    setShowEditor(true);
  }

  function openWorkoutLibrary() {
    setShowEditor(false);
    setShowSavedWorkouts(true);
  }

  function closeWorkoutLibrary() {
    setShowSavedWorkouts(false);
  }

  function startNewWorkout() {
    resetEditor();
    setShowSavedWorkouts(false);
    setShowEditor(true);
  }

  const editorPanel = showEditor ? (
    <GlassPanel className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">Editor de treino</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">
            {activeProgram ? "Treino atual no editor" : "Novo treino"}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            O treino em uso já aparece aqui automaticamente. Se quiser
            criar outro do zero, abra um treino em branco e salve.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            O rascunho deste treino fica salvo automaticamente no navegador.
          </p>
        </div>
        <div className="rounded-sm border border-[rgba(251,146,60,0.22)] bg-[rgba(251,146,60,0.12)] px-3 py-2 text-xs text-[var(--accent)]">
          {programDraft.sessions.length} sessões
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <input
          value={programDraft.name}
          onChange={(event) => updateProgramField("name", event.target.value)}
          placeholder="Nome do treino"
          className={fieldClassName}
        />
        <div className="rounded-sm border border-zinc-800 bg-black/50 px-4 py-3">
          <p className="text-sm text-slate-400">Treinos por semana</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {sessionCountOptions.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setSessionCount(count)}
                className={`rounded-sm px-3 py-2 text-sm font-medium transition ${
                  programDraft.sessions.length === count
                    ? "bg-[rgba(251,146,60,0.12)] text-[var(--accent)]"
                    : "border border-zinc-800 bg-black/50 text-zinc-300 hover:border-[rgba(251,146,60,0.22)] hover:text-white"
                }`}
              >
                {count}x
              </button>
            ))}
          </div>
        </div>
        <input
          value={programDraft.startDate}
          onChange={(event) =>
            updateProgramField("startDate", event.target.value)
          }
          type="date"
          className={fieldClassName}
        />
        <div className="space-y-3 rounded-sm border border-zinc-800 bg-black/50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">Término do treino</p>
            <button
              type="button"
              onClick={() => {
                setIsOpenEnded((current) => {
                  const nextValue = !current;
                  if (nextValue) {
                    updateProgramField("endDate", "");
                  }
                  return nextValue;
                });
              }}
              className={`rounded-sm px-3 py-2 text-xs font-medium transition ${
                isOpenEnded
                  ? "bg-[rgba(251,146,60,0.12)] text-[var(--accent)]"
                  : "border border-zinc-800 bg-black/50 text-zinc-300 hover:border-[rgba(251,146,60,0.22)] hover:text-white"
              }`}
            >
              Sem término previsto
            </button>
          </div>
          <input
            value={programDraft.endDate}
            onChange={(event) =>
              updateProgramField("endDate", event.target.value)
            }
            type="date"
            disabled={isOpenEnded}
            className={`${fieldClassName} ${
              isOpenEnded ? "cursor-not-allowed opacity-50" : ""
            }`}
          />
          <p className="text-xs text-slate-500">
            {isOpenEnded
              ? "Esse treino fica ativo sem data final."
              : "Defina quando esse treino deixa de valer."}
          </p>
        </div>
        <textarea
          value={programDraft.notes}
          onChange={(event) => updateProgramField("notes", event.target.value)}
          rows={3}
          placeholder="Objetivo do bloco, observações ou estratégia do treino"
          className={`${fieldClassName} md:col-span-2`}
        />
      </div>

      <div className="space-y-4">
        {programDraft.sessions.map((session, sessionIndex) => (
          <div
            key={session.id}
            className="rounded-sm border border-zinc-800 bg-black/40 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">
                  Sessão {sessionIndex + 1}
                </p>
                <input
                  value={session.title}
                  onChange={(event) =>
                    updateSession(session.id, "title", event.target.value)
                  }
                  placeholder="Nome da sessão"
                  className="mt-1 w-full border border-transparent bg-transparent px-0 py-0 text-lg font-semibold text-white placeholder:text-zinc-500 focus:border-zinc-800 focus:bg-black/50 focus:px-3 focus:py-2 focus:outline-none"
                />
              </div>
              <div className="rounded-sm border border-zinc-800 bg-black/50 px-3 py-2 text-xs text-zinc-300">
                {weekdayLongLabel(session.weekday)}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <select
                value={session.weekday}
                onChange={(event) =>
                  updateSession(
                    session.id,
                    "weekday",
                    event.target.value as Weekday,
                  )
                }
                className={subtleFieldClassName}
              >
                {weekdayOptions.map((weekday) => (
                  <option
                    key={weekday.id}
                    value={weekday.id}
                    className="bg-slate-900"
                  >
                    {weekday.label}
                  </option>
                ))}
              </select>
              <input
                value={session.focus}
                onChange={(event) =>
                  updateSession(session.id, "focus", event.target.value)
                }
                placeholder="Foco da sessão"
                className={subtleFieldClassName}
              />
              <input
                value={session.summary}
                onChange={(event) =>
                  updateSession(session.id, "summary", event.target.value)
                }
                placeholder="Resumo rápido do dia"
                className={subtleFieldClassName}
              />
              <textarea
                value={session.accessoryText}
                onChange={(event) =>
                  updateSession(session.id, "accessoryText", event.target.value)
                }
                rows={3}
                placeholder="Acessórios e observações, uma linha por item"
                className={`${subtleFieldClassName} md:col-span-2`}
              />
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">
                  Exercícios da sessão
                </p>
                <button
                  type="button"
                  onClick={() => addExercise(session.id)}
                  className="inline-flex items-center gap-2 rounded-sm border border-[rgba(251,146,60,0.22)] bg-[rgba(251,146,60,0.12)] px-3 py-2 text-xs font-medium text-[var(--accent)]"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar exercício
                </button>
              </div>

              {session.exercises.map((exercise, exerciseIndex) => (
                <div
                  key={exercise.id}
                  className="rounded-sm border border-zinc-800 bg-black/40 p-3"
                >
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)_minmax(0,1fr)_88px_140px_minmax(0,1.35fr)_44px] xl:items-center">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        Exercício {exerciseIndex + 1}
                      </p>
                      <input
                        value={exercise.name}
                        onChange={(event) =>
                          updateExercise(
                            session.id,
                            exercise.id,
                            "name",
                            event.target.value,
                          )
                        }
                        placeholder="Nome do exercício"
                        className={compactFieldClassName}
                      />
                    </div>
                    <select
                      value={exercise.muscleGroup}
                      onChange={(event) =>
                        updateExercise(
                          session.id,
                          exercise.id,
                          "muscleGroup",
                          event.target.value as WorkoutMuscleGroup,
                        )
                      }
                      className={compactFieldClassName}
                    >
                      {muscleGroupOptions.map((muscle) => (
                        <option
                          key={muscle}
                          value={muscle}
                          className="bg-slate-900"
                        >
                          {muscle}
                        </option>
                      ))}
                    </select>
                    <input
                      value={exercise.bodyArea}
                      onChange={(event) =>
                        updateExercise(
                          session.id,
                          exercise.id,
                          "bodyArea",
                          event.target.value,
                        )
                      }
                      placeholder="Área"
                      className={compactFieldClassName}
                    />
                    <input
                      value={exercise.sets}
                      onChange={(event) =>
                        updateExercise(
                          session.id,
                          exercise.id,
                          "sets",
                          event.target.value,
                        )
                      }
                      type="number"
                      min={1}
                      placeholder="Séries"
                      className={compactFieldClassName}
                    />
                    <input
                      value={exercise.repRange}
                      onChange={(event) =>
                        updateExercise(
                          session.id,
                          exercise.id,
                          "repRange",
                          event.target.value,
                        )
                      }
                      placeholder="Repetições"
                      className={compactFieldClassName}
                    />
                    <input
                      value={exercise.notes}
                      onChange={(event) =>
                        updateExercise(
                          session.id,
                          exercise.id,
                          "notes",
                          event.target.value,
                        )
                      }
                      placeholder="Observação"
                      className={compactFieldClassName}
                    />
                    <button
                      type="button"
                      onClick={() => removeExercise(session.id, exercise.id)}
                      className="inline-flex h-11 items-center justify-center rounded-sm border border-zinc-800 bg-black/50 text-zinc-300 transition hover:border-[rgba(251,146,60,0.22)] hover:text-white"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={resetEditor}
          className="rounded-sm border border-zinc-800 bg-black/50 px-4 py-3 font-medium text-zinc-200 transition hover:border-[rgba(251,146,60,0.22)]"
        >
          Novo treino em branco
        </button>
        <button
          type="button"
          onClick={saveProgram}
          className="praxis-button px-5 py-3"
        >
          Salvar treino
        </button>
      </div>
    </GlassPanel>
  ) : null;

  return (
    <main className="mx-auto max-w-7xl space-y-10 px-4 pb-32 pt-4">
      <div className="mod-hero">
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div className="mod-icon" style={{ width: 56, height: 56, borderRadius: 14, fontSize: 24 }}>🏋️</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="praxis-label" style={{ color: "var(--accent)", marginBottom: 4 }}>▸ MÓDULO · TREINO</div>
            <div className="praxis-title" style={{ fontSize: 26 }}>
              Registro de séries
            </div>
            <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
              Anote cargas, acompanhe progressão e consulte histórico completo do treino.
            </div>
          </div>
          <div className="mod-hero-side" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div
              className="mod-hero-side-stat"
              style={{
                textAlign: "right",
                borderLeft: "1px solid rgba(39,39,42,0.6)",
                paddingLeft: 16,
                minWidth: 220,
              }}
            >
              <div className="praxis-label" style={{ fontSize: 9 }}>NÍVEL · {user?.level || 1}</div>
              <div className="progress-track" style={{ marginTop: 6 }}>
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(100, ((user?.xp || 0) / Math.max(1, user?.xpToNextLevel || 1000)) * 100)}%`,
                  }}
                />
              </div>
              <div className="praxis-label" style={{ fontSize: 9, marginTop: 6 }}>
                {user?.xp || 0}/{user?.xpToNextLevel || 1000} XP
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <section className="space-y-6 md:col-span-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-headline text-lg font-bold uppercase tracking-widest text-[var(--accent)]">
              <span className="h-2 w-2 bg-[var(--accent)]" />
              Treino ativo
            </h2>
            <button
              onClick={toggleEditorPanel}
              className="praxis-button px-4 py-2 active:scale-95"
            >
              {showEditor
                ? "Fechar editor"
                : activeProgram
                  ? "Editar treino"
                  : "Criar treino"}
            </button>
          </div>

          {!showEditor ? (
            <div className="praxis-panel relative overflow-hidden border-t border-zinc-800/60 p-6">
              <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
                {trainingDays.map((day) => (
                  <button
                    key={day.id}
                    onClick={() => setActiveDayId(day.id)}
                    className={`font-label whitespace-nowrap rounded-sm border px-4 py-2 text-xs uppercase tracking-widest transition-colors ${
                      activeDay?.id === day.id
                        ? "border-[rgba(251,146,60,0.28)] bg-[rgba(251,146,60,0.08)] text-[var(--accent)]"
                        : "border-zinc-800 text-zinc-500 hover:border-[rgba(251,146,60,0.18)] hover:text-zinc-100"
                    }`}
                  >
                    {day.title}
                  </button>
                ))}
                {trainingDays.length === 0 ? (
                  <span className="text-xs uppercase tracking-widest text-zinc-500">
                    Nenhum treino ativo
                  </span>
                ) : null}
              </div>

              <div className="space-y-4">
                {activeDay?.exercises.map((exercise, idx) => {
                  const isExpanded = expandedExerciseKey === exercise.id;
                  const latestEntry = latestExerciseLogMap.get(exercise.id);
                  const isCurveSelected =
                    resolvedCurveExerciseId === exercise.id;

                  return (
                    <div
                      key={exercise.id}
                      className={`rounded-sm border bg-black/40 p-4 transition ${
                        isCurveSelected
                          ? "border-[rgba(251,146,60,0.4)]"
                          : "border-zinc-800"
                      }`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedCurveExerciseId(exercise.id)
                          }
                          className="flex min-w-0 gap-4 text-left transition hover:opacity-90"
                          title="Ver curva deste exercício"
                        >
                          <div className="flex h-10 w-10 min-w-10 items-center justify-center border border-[rgba(251,146,60,0.2)] bg-black/50 font-headline text-[var(--accent)]">
                            {String(idx + 1).padStart(2, "0")}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-headline text-sm font-bold uppercase text-zinc-100">
                                {exercise.name}
                              </h4>
                              {isCurveSelected ? (
                                <span className="rounded-sm border border-[rgba(251,146,60,0.45)] bg-[rgba(251,146,60,0.16)] px-2 py-0.5 font-label text-[0.55rem] uppercase tracking-widest text-[var(--accent)]">
                                  Curva ativa
                                </span>
                              ) : null}
                            </div>
                            <p className="font-label text-[0.55rem] uppercase tracking-wider text-zinc-500">
                              {exercise.muscleGroup} / {exercise.bodyArea}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              <span className="rounded-sm border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-300">
                                {exercise.sets} séries
                              </span>
                              <span className="rounded-sm border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-300">
                                Repetições {exercise.repRange}
                              </span>
                            </div>
                            {latestEntry ? (
                              <div className="mt-3 text-xs leading-5 text-zinc-500">
                                <p>
                                  Último registro em{" "}
                                  <span className="text-zinc-400">
                                    {formatWorkoutDateTime(latestEntry.loggedAt)}
                                  </span>
                                </p>
                                <ul className="mt-1 space-y-0.5 font-mono tabular-nums">
                                  {latestEntry.sets.map((set) => (
                                    <li
                                      key={set.setNumber}
                                      className="flex gap-3 text-[11px] text-zinc-400"
                                    >
                                      <span className="w-6 text-zinc-500">
                                        {set.setNumber}ª
                                      </span>
                                      <span>
                                        {set.weightKg} kg{" "}
                                        <span className="text-zinc-600">×</span>{" "}
                                        {set.repetitions}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : (
                              <p className="mt-3 text-sm leading-6 text-zinc-500">
                                Ainda sem registro salvo para este exercício.
                              </p>
                            )}
                          </div>
                        </button>

                        <div className="flex w-full flex-col gap-2 lg:w-[220px]">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedExerciseKey((current) =>
                                current === exercise.id ? null : exercise.id,
                              )
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-3 py-2.5 text-xs font-medium text-[var(--accent)]"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {isExpanded ? "Fechar lançamento" : "Registrar séries"}
                          </button>
                          <Link
                            href={exerciseHistoryHref(exercise)}
                            className="inline-flex items-center justify-center gap-2 rounded-sm border border-zinc-800 bg-[rgba(18,18,20,0.98)] px-3 py-2.5 text-xs text-zinc-300 transition hover:border-[rgba(251,146,60,0.24)] hover:text-zinc-100"
                          >
                            <History className="h-3.5 w-3.5" />
                            Ver histórico
                          </Link>
                        </div>
                      </div>

                      {isExpanded && activeDay ? (
                        <div className="mt-4 border-t border-zinc-800 pt-4">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <p className="text-sm text-zinc-400">
                              Preencha as séries executadas e salve no histórico do exercício.
                            </p>
                            <span className="font-label text-[0.55rem] uppercase tracking-widest text-zinc-500">
                              {exercise.sets} séries previstas
                            </span>
                          </div>

                          <div className="space-y-3">
                            {Array.from({ length: exercise.sets }, (_, index) => {
                              const setNumber = index + 1;
                              const key = draftSetKey(activeDay.id, exercise.id, setNumber);

                              return (
                                <div
                                  key={key}
                                  className="grid gap-3 rounded-sm border border-zinc-800 bg-[rgba(18,18,20,0.94)] p-4 md:grid-cols-[120px_1fr_1fr]"
                                >
                                  <div>
                                    <label className="font-label text-[0.55rem] uppercase tracking-widest text-zinc-500">
                                      Série
                                    </label>
                                    <div
                                      aria-label={`Série ${setNumber}`}
                                      className="mt-2 flex h-10 w-full select-none items-center justify-center rounded-sm bg-[var(--accent)] font-headline text-lg font-bold text-black"
                                    >
                                      {setNumber}
                                    </div>
                                  </div>
                                  <div>
                                    <label className="font-label text-[0.55rem] uppercase tracking-widest text-zinc-500">
                                      Peso (kg)
                                    </label>
                                    <input
                                      value={draftLoads[key] ?? ""}
                                      onChange={(event) =>
                                        updateDraftWeight(
                                          activeDay.id,
                                          exercise.id,
                                          setNumber,
                                          event.target.value,
                                        )
                                      }
                                      type="number"
                                      min={0}
                                      step="0.5"
                                      placeholder="Ex.: 20"
                                      className={`${compactFieldClassName} mt-2`}
                                    />
                                  </div>
                                  <div>
                                    <label className="font-label text-[0.55rem] uppercase tracking-widest text-zinc-500">
                                      Repetições
                                    </label>
                                    <input
                                      value={draftLoadRepetitions[key] ?? ""}
                                      onChange={(event) =>
                                        updateDraftRepetitions(
                                          activeDay.id,
                                          exercise.id,
                                          setNumber,
                                          event.target.value,
                                        )
                                      }
                                      type="number"
                                      min={1}
                                      placeholder="Ex.: 10"
                                      className={`${compactFieldClassName} mt-2`}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-zinc-500">
                              O sistema salva data, séries, repetições e carga de cada execução.
                            </p>
                            <button
                              type="button"
                              onClick={() => saveLoad(activeDay.id, exercise)}
                              disabled={!canSaveLoad(activeDay.id, exercise)}
                              className="praxis-button px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Salvar no histórico
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {!activeDay?.exercises.length ? (
                  <div className="p-8 text-center text-zinc-500 text-xs uppercase tracking-widest">
                    Sem exercícios cadastrados neste dia.
                  </div>
                ) : null}
              </div>

              <div className="mb-8 flex flex-col gap-6 border-b border-zinc-800/60 pb-6 md:flex-row md:items-end md:justify-between">
                <div className="flex-1">
                  {activeDay && !activeDay.isRestDay ? (
                    <div className="mt-4 space-y-2 rounded-sm border border-zinc-800 bg-black/40 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 text-zinc-400">
                          <Clock className="h-4 w-4 text-[var(--accent)]" />
                          <p className="font-label text-[0.55rem] uppercase tracking-widest text-zinc-500">
                            Horário do treino
                          </p>
                        </div>
                        <input
                          type="time"
                          value={activeDayTime}
                          onChange={(event) =>
                            handleWorkoutTimeChange(event.target.value)
                          }
                          className="rounded-sm border border-zinc-700 bg-black/60 px-3 py-2 font-headline text-sm font-bold text-zinc-100 focus:border-[var(--accent)] focus:outline-none"
                        />
                        {activeDayTime ? (
                          <>
                            <span className="text-xs text-zinc-500">
                              Aparece na agenda às {activeDayTime}.
                            </span>
                            <button
                              type="button"
                              onClick={() => handleWorkoutTimeChange("")}
                              className="ml-auto inline-flex items-center gap-1 text-xs uppercase tracking-widest text-zinc-500 transition hover:text-red-300"
                            >
                              <X className="h-3 w-3" />
                              Limpar
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-zinc-500">
                            Defina o horário para sincronizar com a agenda do dia.
                          </span>
                        )}
                      </div>

                      {/* Multi-select weekday chips — clique pra ativar
                          múltiplos dias da semana pro MESMO treino. A
                          agenda usa reminder.weekdays como prioridade
                          sobre o day.weekday canônico (ver agenda.ts). */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <p className="font-label text-[0.55rem] uppercase tracking-widest text-zinc-500">
                          Dias na semana
                        </p>
                        {(
                          [
                            { id: "monday" as Weekday, label: "Seg" },
                            { id: "tuesday" as Weekday, label: "Ter" },
                            { id: "wednesday" as Weekday, label: "Qua" },
                            { id: "thursday" as Weekday, label: "Qui" },
                            { id: "friday" as Weekday, label: "Sex" },
                            { id: "saturday" as Weekday, label: "Sáb" },
                            { id: "sunday" as Weekday, label: "Dom" },
                          ]
                        ).map((item) => {
                          const isActive = activeDayWeekdays.includes(item.id);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() =>
                                handleWorkoutWeekdayToggle(item.id)
                              }
                              className={`rounded-sm border px-3 py-1.5 font-headline text-[10px] font-bold uppercase tracking-[0.2em] transition ${
                                isActive
                                  ? "border-[rgba(251,146,60,0.5)] bg-[rgba(251,146,60,0.18)] text-[var(--accent)]"
                                  : "border-zinc-800 bg-black/40 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                              }`}
                              aria-pressed={isActive}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                        <span className="text-xs text-zinc-500">
                          {activeDayWeekdays.length === 1
                            ? "Selecione mais dias pra repetir o treino na semana."
                            : `${activeDayWeekdays.length} dias ativos`}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-3 md:w-[360px]">
                  <div className="rounded-sm border border-zinc-800 bg-black/40 px-4 py-3">
                    <p className="font-label text-[0.55rem] uppercase tracking-widest text-zinc-500">
                      Exercícios
                    </p>
                    <p className="mt-2 font-headline text-xl font-bold text-zinc-100">
                      {activeDay?.exercises.length ?? 0}
                    </p>
                  </div>
                  <div className="rounded-sm border border-zinc-800 bg-black/40 px-4 py-3">
                    <p className="font-label text-[0.55rem] uppercase tracking-widest text-zinc-500">
                      Séries
                    </p>
                    <p className="mt-2 font-headline text-xl font-bold text-zinc-100">
                      {activeDay?.exercises.reduce((sum, exercise) => sum + exercise.sets, 0) ?? 0}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleEditorPanel}
                    className="rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-4 py-3 text-left transition hover:border-[rgba(251,146,60,0.34)]"
                  >
                    <p className="font-label text-[0.55rem] uppercase tracking-widest text-[var(--accent)]">
                      Ação
                    </p>
                    <p className="mt-2 font-headline text-sm font-bold text-zinc-100">
                      Editar treino
                    </p>
                  </button>
                </div>
              </div>

              <div className="mb-8 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-sm border border-zinc-800 bg-black/30 p-4">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="font-label text-[0.6rem] uppercase tracking-widest text-[var(--accent)]">
                        Evolução
                      </p>
                      <h4 className="mt-2 font-headline text-lg font-bold uppercase text-zinc-100">
                        {selectedCurveExercise
                          ? `Curva — ${selectedCurveExercise.name}`
                          : "Curva das últimas execuções"}
                      </h4>
                      {selectedCurveExercise ? (
                        <p className="mt-1 text-xs text-zinc-500">
                          Carga total (peso × reps) das últimas execuções deste exercício.
                        </p>
                      ) : null}
                    </div>
                    <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                      {recentLoadCurve.length} pontos
                    </span>
                  </div>

                  {activeDay?.exercises.length ? (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {activeDay.exercises.map((exercise) => {
                        const isActive =
                          exercise.id === resolvedCurveExerciseId;
                        const hasHistory = exerciseIdsWithHistory.has(
                          exercise.id,
                        );
                        return (
                          <button
                            key={exercise.id}
                            type="button"
                            onClick={() =>
                              setSelectedCurveExerciseId(exercise.id)
                            }
                            className={`rounded-sm border px-3 py-1.5 text-xs font-medium transition ${
                              isActive
                                ? "border-[rgba(251,146,60,0.45)] bg-[rgba(251,146,60,0.16)] text-[var(--accent)]"
                                : hasHistory
                                  ? "border-zinc-800 bg-black/40 text-zinc-200 hover:border-[rgba(251,146,60,0.24)] hover:text-[var(--accent)]"
                                  : "border-dashed border-zinc-800 bg-black/30 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                            }`}
                            title={
                              hasHistory
                                ? "Ver curva deste exercício"
                                : "Sem histórico ainda"
                            }
                          >
                            {exercise.name}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <ProgressCurveChart
                    points={recentLoadCurve}
                    valueFormatter={(value) => `${Math.round(value)} kg`}
                    emptyLabel={
                      selectedCurveExercise
                        ? `Sem histórico salvo para ${selectedCurveExercise.name}. Registre séries para desenhar a curva.`
                        : "Salve algumas séries para desenhar a curva de carga."
                    }
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-sm border border-zinc-800 bg-black/30 p-4">
                    <p className="font-label text-[0.55rem] uppercase tracking-widest text-zinc-500">
                      Carga em 7 dias
                    </p>
                    <p className="mt-2 font-headline text-3xl font-bold text-[var(--accent)]">
                      {Math.round(lastSevenDaysLoad)} kg
                    </p>
                    <p className="mt-2 text-sm text-zinc-500">
                      Soma de peso x repetições da semana recente
                    </p>
                  </div>
                  <div className="rounded-sm border border-zinc-800 bg-black/30 p-4">
                    <p className="font-label text-[0.55rem] uppercase tracking-widest text-zinc-500">
                      Séries lançadas
                    </p>
                    <p className="mt-2 font-headline text-3xl font-bold text-zinc-100">
                      {lastSevenDaysSets}
                    </p>
                    <p className="mt-2 text-sm text-zinc-500">
                      Séries efetivamente registradas nos últimos 7 dias
                    </p>
                  </div>
                  <div className="rounded-sm border border-zinc-800 bg-black/30 p-4">
                    <p className="font-label text-[0.55rem] uppercase tracking-widest text-zinc-500">
                      Exercícios com histórico
                    </p>
                    <p className="mt-2 font-headline text-3xl font-bold text-zinc-100">
                      {exercisesWithHistory}
                    </p>
                    <p className="mt-2 text-sm text-zinc-500">
                      Exercícios deste bloco que já têm carga salva
                    </p>
                  </div>
                  <div className="rounded-sm border border-zinc-800 bg-black/30 p-4">
                    <p className="font-label text-[0.55rem] uppercase tracking-widest text-zinc-500">
                      Último log
                    </p>
                    <p className="mt-2 font-headline text-2xl font-bold text-zinc-100">
                      {lastHistoryEntry
                        ? formatWorkoutDateTime(lastHistoryEntry.loggedAt)
                        : "--"}
                    </p>
                    <p className="mt-2 text-sm text-zinc-500">
                      {lastHistoryEntry
                        ? `${lastHistoryEntry.exerciseName} • ${lastHistoryEntry.dayTitle}`
                        : "Sem histórico ativo neste treino"}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            editorPanel
          )}
        </section>

        <aside className="space-y-6 md:col-span-4">
          <div className="praxis-panel relative overflow-hidden p-6">
            <h2 className="flex items-center gap-2 font-headline text-sm font-bold uppercase tracking-widest text-[var(--accent)]">
              <span className="h-2 w-2 bg-[var(--accent)]" />
              Matriz de volume semanal
            </h2>
            <div className="relative z-10 mt-5 space-y-4">
              {weeklyVolume.length ? (
                weeklyVolume.map((item) => {
                  const maxSets = Math.max(1, ...weeklyVolume.map((entry) => entry.sets));
                  const percentage = (item.sets / maxSets) * 100;

                  return (
                    <div key={item.muscle} className="space-y-1">
                      <div className="flex justify-between font-label text-[0.55rem] uppercase tracking-widest">
                        <span className="text-zinc-500">{item.muscle}</span>
                        <span className="text-[var(--accent)]">{item.sets} séries</span>
                      </div>
                      <div className="h-1 overflow-hidden bg-black/50">
                        <div
                          className="h-full bg-[var(--accent)] transition-all duration-700"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-zinc-500">
                  Sem volume registrado ainda para calcular a matriz semanal.
                </p>
              )}
            </div>
          </div>

          <div className="praxis-panel space-y-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-headline text-sm font-bold uppercase tracking-widest text-zinc-400">
                <History className="h-4 w-4 text-[var(--accent)]" />
                Histórico recente
              </h2>
              <Link
                href="/modules/workout/history"
                className="rounded-sm border border-zinc-800 px-3 py-2 text-[0.65rem] uppercase tracking-widest text-zinc-300 transition hover:border-[rgba(251,146,60,0.24)] hover:text-zinc-100"
              >
                Ver histórico completo
              </Link>
            </div>
            <div className="space-y-2">
              {recentLogs.length ? (
                recentLogs.map((entry, idx) => {
                  const colorClass =
                    idx % 3 === 0
                      ? "border-[rgba(251,146,60,0.4)]"
                      : idx % 3 === 1
                        ? "border-zinc-700"
                        : "border-[rgba(251,146,60,0.22)]";

                  return (
                    <Link
                      key={entry.id}
                      href={`/modules/workout/history/${entry.exerciseId}?name=${encodeURIComponent(entry.exerciseName)}`}
                      className={`block border-l-2 bg-black/70 p-3 transition-all hover:bg-black/80 ${colorClass}`}
                    >
                      <div className="mb-1 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h5 className="truncate font-headline text-[0.65rem] font-bold uppercase text-zinc-100">
                            {entry.exerciseName}
                          </h5>
                          <p className="mt-1 text-[0.65rem] text-zinc-500">
                            {entry.dayTitle}
                          </p>
                        </div>
                        <span className="whitespace-nowrap font-label text-[0.55rem] text-zinc-500">
                          {formatWorkoutDate(entry.loggedAt).slice(0, 5)}
                        </span>
                      </div>
                      <p className="font-label text-[0.55rem] uppercase text-zinc-400">
                        {formatWorkoutSetSummary(entry.sets)}
                      </p>
                    </Link>
                  );
                })
              ) : (
                <p className="py-4 text-center text-xs italic text-zinc-500">
                  Sistema aguardando dados operacionais.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>

      <section className="mx-auto max-w-4xl border border-[rgba(251,146,60,0.18)] bg-[rgba(5,5,5,0.92)] p-5 shadow-[0_0_32px_rgba(251,146,60,0.08)] md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-3">
            <p className="font-label text-[0.65rem] uppercase tracking-[0.35em] text-[var(--accent)]">
              Central de treinos
            </p>
            <h2 className="font-headline text-2xl font-bold uppercase tracking-tighter text-zinc-100 md:text-3xl">
              Biblioteca operacional
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-zinc-400">
              Acesse seus programas salvos, abra um novo treino em branco ou
              exclua um plano antigo sem sair do módulo.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[420px]">
            <div className="border border-zinc-800 bg-black/50 px-4 py-3">
              <p className="font-label text-[0.55rem] uppercase tracking-widest text-zinc-500">
                Treinos salvos
              </p>
              <p className="mt-2 font-headline text-2xl font-bold text-[var(--accent)]">
                {state.workoutPrograms.length}
              </p>
            </div>
            <div className="border border-zinc-800 bg-black/50 px-4 py-3">
              <p className="font-label text-[0.55rem] uppercase tracking-widest text-zinc-500">
                Treino ativo
              </p>
              <p className="mt-2 truncate font-headline text-sm font-bold text-zinc-100">
                {activeProgram?.name ?? "Nenhum selecionado"}
              </p>
            </div>
            <button
              type="button"
              onClick={openWorkoutLibrary}
              className="group flex min-h-[96px] flex-col justify-center border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.08)] px-4 py-3 text-left transition hover:border-[rgba(251,146,60,0.42)] hover:bg-[rgba(251,146,60,0.14)]"
            >
              <span className="inline-flex items-center gap-2 font-label text-[0.55rem] uppercase tracking-widest text-[var(--accent)]">
                <BookOpen className="h-3.5 w-3.5" />
                Abrir lista
              </span>
              <span className="mt-2 font-headline text-sm font-bold text-zinc-100">
                Ver treinos, ativar ou excluir
              </span>
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={openWorkoutLibrary}
            className="praxis-button px-5 py-3"
          >
            Ver treinos salvos
          </button>
          <button
            type="button"
            onClick={startNewWorkout}
            className="inline-flex items-center gap-2 border border-zinc-800 bg-black/50 px-5 py-3 font-headline text-xs font-bold uppercase tracking-[0.25em] text-zinc-100 transition hover:border-[rgba(251,146,60,0.24)] hover:text-[var(--accent)]"
          >
            <FolderPlus className="h-4 w-4" />
            Criar novo treino
          </button>
        </div>
      </section>

      {showSavedWorkouts ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm">
          <div className="flex max-h-[88vh] w-full max-w-5xl flex-col border border-[rgba(251,146,60,0.24)] bg-[#050505] shadow-[0_0_40px_rgba(0,0,0,0.65)]">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4 md:px-6">
              <div className="min-w-0">
                <p className="font-label text-[0.6rem] uppercase tracking-[0.35em] text-[var(--accent)]">
                  Biblioteca de treinos
                </p>
                <h3 className="mt-2 font-headline text-2xl font-bold uppercase tracking-tighter text-zinc-100">
                  Treinos salvos
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                  Escolha um treino para ativar, abrir no editor ou excluir
                  da sua lista operacional.
                </p>
              </div>
              <button
                type="button"
                onClick={closeWorkoutLibrary}
                className="inline-flex h-10 w-10 items-center justify-center border border-zinc-800 bg-black/50 text-zinc-400 transition hover:border-[rgba(251,146,60,0.24)] hover:text-white"
                aria-label="Fechar biblioteca de treinos"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6">
              {state.workoutPrograms.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {state.workoutPrograms.map((program) => {
                    const isActive = program.id === state.activeWorkoutProgramId;

                    return (
                      <article
                        key={program.id}
                        className={`border p-4 transition ${
                          isActive
                            ? "border-[rgba(251,146,60,0.34)] bg-[rgba(251,146,60,0.06)]"
                            : "border-zinc-800 bg-black/60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-label text-[0.55rem] uppercase tracking-[0.3em] text-zinc-500">
                              {isActive ? "Ativo" : "Salvo"}
                            </p>
                            <h4 className="mt-2 truncate font-headline text-lg font-bold text-zinc-100">
                              {program.name}
                            </h4>
                          </div>
                          <span className="whitespace-nowrap border border-[rgba(251,146,60,0.18)] px-2 py-1 font-label text-[0.55rem] uppercase tracking-[0.25em] text-[var(--accent)]">
                            {program.splitLabel}
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="border border-zinc-800 bg-black/40 px-2 py-1 font-label text-[0.55rem] uppercase tracking-[0.25em] text-zinc-500">
                            {program.workoutPlan.length} sessões
                          </span>
                          {program.startDate ? (
                            <span className="border border-zinc-800 bg-black/40 px-2 py-1 font-label text-[0.55rem] uppercase tracking-[0.25em] text-zinc-500">
                              Início {program.startDate}
                            </span>
                          ) : null}
                          {program.endDate ? (
                            <span className="border border-zinc-800 bg-black/40 px-2 py-1 font-label text-[0.55rem] uppercase tracking-[0.25em] text-zinc-500">
                              Fim {program.endDate}
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-4 min-h-[3rem] text-sm leading-6 text-zinc-400">
                          {program.notes?.trim()
                            ? program.notes
                            : "Sem observações adicionais para este treino."}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              actions.activateWorkoutProgram(program.id);
                              setActiveDayId(program.workoutPlan[0]?.id ?? "");
                              closeWorkoutLibrary();
                            }}
                            className="praxis-button px-4 py-2 text-xs"
                          >
                            Ativar
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditorForProgram(program)}
                            className="border border-zinc-800 bg-black/50 px-4 py-2 font-headline text-xs font-bold uppercase tracking-[0.25em] text-zinc-100 transition hover:border-[rgba(251,146,60,0.24)] hover:text-[var(--accent)]"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => removeProgram(program)}
                            className="inline-flex items-center gap-2 border border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.08)] px-4 py-2 font-headline text-xs font-bold uppercase tracking-[0.25em] text-red-300 transition hover:border-[rgba(239,68,68,0.45)] hover:text-red-200"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Excluir
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-[220px] flex-col items-center justify-center border border-dashed border-zinc-800 bg-black/30 px-6 text-center">
                  <p className="font-label text-[0.65rem] uppercase tracking-[0.35em] text-zinc-500">
                    Nenhum treino salvo
                  </p>
                  <h4 className="mt-3 font-headline text-xl font-bold text-zinc-100">
                    Crie seu primeiro plano
                  </h4>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                    Quando você salvar um treino, ele vai aparecer aqui para
                    ativar, editar ou excluir.
                  </p>
                  <button
                    type="button"
                    onClick={startNewWorkout}
                    className="praxis-button mt-5 px-5 py-3"
                  >
                    Criar treino agora
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}



