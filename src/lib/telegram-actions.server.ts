import { getAccountState, saveAccountState } from "@/lib/account-state.server";
import { getUserTimezone } from "@/lib/notification-center.server";
import { resolveCompletionDateKey } from "@/lib/telegram-callback-date";
import { isTaskCompletedForDate, isTaskDueForDate, makeId } from "@/lib/utils";
import type {
  PersistedState,
  ReminderItem,
  Task,
  WorkoutDayCompletion,
} from "@/lib/types";

function readState(envelope: { state: unknown }): PersistedState {
  return envelope.state as PersistedState;
}

type MealBlock = NonNullable<PersistedState["mealPlan"]>[number];
type MealItem = MealBlock["items"][number];

/**
 * "Hoje" no fuso do usuário (YYYY-MM-DD). O webhook do Telegram roda em
 * UTC: à noite no Brasil (UTC-3) o `toISOString().slice(0,10)` já estaria
 * no dia seguinte, gravando a conclusão na data errada e fazendo o app
 * (que usa data LOCAL) discordar do bot.
 */
function todayKeyInTimezone(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function isMealItemDoneOn(item: MealItem, todayKey: string): boolean {
  return Boolean(
    item.completedDates?.includes(todayKey) ||
      item.completedAt?.slice(0, 10) === todayKey,
  );
}

// "DD/MM" pra mensagens de conclusão em dia anterior.
function formatDayMonth(dateKey: string): string {
  return `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
}

/**
 * `fullMark=false` = conclusão de DIA PASSADO (clique depois da
 * meia-noite numa notificação do dia anterior): grava só em
 * completedDates, como o toggle por data do app. Setar completed/
 * completedAt aqui carimbaria o instante do clique (já no dia seguinte)
 * e a lógica date-aware do app marcaria o dia 2 como concluído também —
 * exatamente o bug que este parâmetro corrige.
 */
function markTaskDone(task: Task, dateKey: string, fullMark: boolean): Task {
  const nextDates = Array.from(
    new Set([...(task.completedDates ?? []), dateKey]),
  ).sort();
  if (!fullMark) {
    return { ...task, completedDates: nextDates };
  }
  return {
    ...task,
    completed: true,
    completedAt: new Date().toISOString(),
    completedDates: nextDates,
  };
}

function markItemDone(item: MealItem, dateKey: string, fullMark: boolean): MealItem {
  const nextDates = Array.from(
    new Set([...(item.completedDates ?? []), dateKey]),
  ).sort();
  if (!fullMark) {
    return { ...item, completedDates: nextDates };
  }
  return {
    ...item,
    completed: true,
    completedAt: new Date().toISOString(),
    completedDates: nextDates,
  };
}

/**
 * Aplica a conclusão (toggle ON) de uma tarefa a partir do callback do
 * Telegram. Retorna `{ ok, message }` pra ser ecoado no toast.
 *
 * O `target` que chega no callback `t:<id>` pode ser:
 *   1. ID/sourceKey de uma Task em state.tasks (tasks manuais, rotinas
 *      de aparência, treino — tudo que vira Task)
 *   2. ID de um meal block (rotina/refeição renderizada na agenda)
 *   3. ID de um item dentro de um meal block
 *
 * A conclusão é DATE-AWARE no fuso do usuário: tarefas recorrentes
 * carregam `completed: true` de dias anteriores, então checar só esse
 * booleano dava falso "já concluída". Usamos isTaskCompletedForDate /
 * completedDates[hoje] como o app faz.
 */
export async function completeTaskForUser(
  userId: string,
  target: string,
  targetDateKey?: string,
): Promise<{ ok: boolean; message: string }> {
  const envelope = await getAccountState(userId);
  if (!envelope) {
    return { ok: false, message: "Conta não encontrada." };
  }
  const timezone = await getUserTimezone(userId);
  const todayKey = todayKeyInTimezone(timezone);
  // Dia EFETIVO da baixa: o dia em que a notificação foi disparada
  // (sufixo do callback), não o dia do clique. Clique 00:10 numa
  // notificação de ontem 23:50 → conclui ONTEM. Sem sufixo (mensagens
  // antigas) ou data futura/inválida → hoje.
  const effectiveKey = resolveCompletionDateKey(targetDateKey, todayKey);
  const isPastCompletion = effectiveKey !== todayKey;
  const targetDate = new Date(`${effectiveKey}T12:00:00`);

  const state = readState(envelope);
  const tasks = state.tasks ?? [];
  const mealPlan = state.mealPlan ?? [];

  // 1) Task em state.tasks (id ou sourceKey)
  let task: Task | undefined =
    tasks.find((t) => t.id === target) ||
    tasks.find((t) => t.sourceKey === target);

  // 1b) Fallback órfão: reminders carregam taskId, mas se a task foi
  // recriada (delete + create) o id muda e o reminder fica apontando
  // pro fantasma. Tenta achar a task pelo (title + scheduledTime)
  // do reminder cujo entityId é o target. Acontece bastante em rotinas
  // recriadas (sono, cardio etc.).
  if (!task) {
    const reminders = state.reminders ?? [];
    const orphanReminder: ReminderItem | undefined = reminders.find(
      (r) => r.entityType === "task" && r.entityId === target,
    );
    if (orphanReminder) {
      const candidates = tasks.filter(
        (t) =>
          t.title.trim() === orphanReminder.title.trim() &&
          t.scheduledTime === orphanReminder.time &&
          isTaskDueForDate(t, targetDate),
      );
      // Prefere uma ainda pendente no dia-alvo; se todas concluídas,
      // pega a primeira (vai cair em "já concluída").
      task =
        candidates.find((t) => !isTaskCompletedForDate(t, targetDate)) ||
        candidates[0];
      if (task) {
        console.info(
          `[telegram-actions] orphan-resolved userId=${userId} orphanId=${target} → ${task.id} (${task.title})`,
        );
      }
    }
  }

  if (task) {
    const resolvedTask = task;
    // Date-aware: recorrentes guardam completed=true de outros dias.
    if (isTaskCompletedForDate(resolvedTask, targetDate)) {
      return {
        ok: true,
        message: isPastCompletion
          ? `✓ Essa tarefa já estava concluída no dia ${formatDayMonth(effectiveKey)}.`
          : "✓ Essa tarefa já estava concluída hoje no sistema.",
      };
    }
    // Dia passado + recorrente → só completedDates (igual ao toggle por
    // data do app). One-time pode receber a marcação completa: o array
    // não-vazio é autoritativo por data, então o dia do clique não é
    // contaminado, e completed=true tira a tarefa do schedule futuro.
    const fullMark =
      !isPastCompletion || resolvedTask.recurrence.kind === "one-time";
    const nextTasks = tasks.map((t) =>
      t.id === resolvedTask.id ? markTaskDone(t, effectiveKey, fullMark) : t,
    );

    // Auto-heal: se chegou aqui via lookup órfão (target ≠ resolvedTask.id),
    // reapontamos o reminder pra task atual. Próximo clique vai pelo
    // caminho rápido e a base se limpa sozinha.
    let nextReminders = state.reminders;
    if (target !== resolvedTask.id && state.reminders) {
      nextReminders = state.reminders.map((r) =>
        r.entityType === "task" && r.entityId === target
          ? { ...r, entityId: resolvedTask.id }
          : r,
      );
    }

    await saveAccountState(userId, {
      ...envelope,
      // Versão BUMPADA: sem isto, save do app em paralelo (com baseVersion
      // antigo) bateria igual no servidor e sobrescreveria a marcação
      // feita aqui pelo Telegram. Incrementando, o save do app vira 409
      // → merge 3-way → conclusão é preservada.
      version: envelope.version + 1,
      state: {
        ...state,
        tasks: nextTasks,
        ...(nextReminders !== state.reminders ? { reminders: nextReminders } : {}),
      } as PersistedState,
      updatedAt: new Date().toISOString(),
    });
    return {
      ok: true,
      message: isPastCompletion
        ? `Concluída (dia ${formatDayMonth(effectiveKey)}): ${resolvedTask.title}`
        : `Concluída: ${resolvedTask.title}`,
    };
  }

  // 2) Meal block inteiro
  const block = mealPlan.find((b) => b.id === target);
  if (block) {
    return completeBlock(
      userId,
      envelope,
      state,
      mealPlan,
      block,
      effectiveKey,
      isPastCompletion,
    );
  }

  // 3) Item específico dentro de algum meal block
  let parentBlock: MealBlock | undefined;
  let targetItem: MealItem | undefined;
  for (const b of mealPlan) {
    const found = b.items.find((it) => it.id === target);
    if (found) {
      parentBlock = b;
      targetItem = found;
      break;
    }
  }
  if (parentBlock && targetItem) {
    if (isMealItemDoneOn(targetItem, effectiveKey)) {
      return {
        ok: true,
        message: isPastCompletion
          ? `✓ Esse item já estava concluído no dia ${formatDayMonth(effectiveKey)}.`
          : "✓ Esse item já estava concluído hoje no sistema.",
      };
    }
    const nextMealPlan = mealPlan.map((b) =>
      b.id !== parentBlock!.id
        ? b
        : {
            ...b,
            items: b.items.map((it) =>
              it.id !== targetItem!.id
                ? it
                : markItemDone(it, effectiveKey, !isPastCompletion),
            ),
          },
    );
    await saveAccountState(userId, {
      ...envelope,
      version: envelope.version + 1,
      state: { ...state, mealPlan: nextMealPlan } as PersistedState,
      updatedAt: new Date().toISOString(),
    });
    return {
      ok: true,
      message: isPastCompletion
        ? `Concluído (dia ${formatDayMonth(effectiveKey)}): ${targetItem.label}`
        : `Concluído: ${targetItem.label}`,
    };
  }

  // Não bateu em nada. Loga os ids disponíveis pra diagnosticar o
  // mismatch (callback id × o que existe no account-state).
  console.warn(
    `[telegram-actions] target-not-found userId=${userId} target=${target} ` +
      `taskIds=[${tasks.map((t) => t.id).join(",")}] ` +
      `taskSourceKeys=[${tasks.map((t) => t.sourceKey ?? "").filter(Boolean).join(",")}] ` +
      `blockIds=[${mealPlan.map((b) => b.id).join(",")}]`,
  );
  return {
    ok: false,
    message: "Não encontrei essa tarefa — abra o app e marque por lá.",
  };
}

/**
 * Conclui um meal block a partir do callback `mb:<blockId>`.
 */
export async function completeMealBlockForUser(
  userId: string,
  blockId: string,
  targetDateKey?: string,
): Promise<{ ok: boolean; message: string }> {
  const envelope = await getAccountState(userId);
  if (!envelope) {
    return { ok: false, message: "Conta não encontrada." };
  }
  const timezone = await getUserTimezone(userId);
  const todayKey = todayKeyInTimezone(timezone);
  const effectiveKey = resolveCompletionDateKey(targetDateKey, todayKey);
  const isPastCompletion = effectiveKey !== todayKey;
  const state = readState(envelope);
  const mealPlan = state.mealPlan ?? [];
  const block = mealPlan.find((b) => b.id === blockId);
  if (!block) {
    // Pode ser que o callback aponte pra uma Task (rotina) cujo id é o
    // blockId — tenta a rota de task antes de desistir.
    return completeTaskForUser(userId, blockId, targetDateKey);
  }
  return completeBlock(
    userId,
    envelope,
    state,
    mealPlan,
    block,
    effectiveKey,
    isPastCompletion,
  );
}

/**
 * Núcleo compartilhado: marca todos os itens de um bloco como concluídos
 * pro DIA-ALVO (`targetKey` — o dia do disparo da notificação; hoje no
 * fluxo normal). Date-aware — só itens ainda pendentes nesse dia são
 * marcados. `isPastCompletion` grava só em completedDates, sem carimbar
 * completedAt com o instante do clique (que já seria o dia seguinte).
 */
async function completeBlock(
  userId: string,
  envelope: { version: number; state: unknown; updatedAt?: string },
  state: PersistedState,
  mealPlan: MealBlock[],
  block: MealBlock,
  targetKey: string,
  isPastCompletion: boolean,
): Promise<{ ok: boolean; message: string }> {
  // Já concluído no dia-alvo? (todos os itens marcados). Bloco sem
  // itens cai aqui — não há o que marcar.
  const allDone =
    block.items.length === 0 ||
    block.items.every((it) => isMealItemDoneOn(it, targetKey));
  if (allDone) {
    return {
      ok: true,
      message: isPastCompletion
        ? `✓ Isso já estava concluído no dia ${formatDayMonth(targetKey)}.`
        : "✓ Isso já estava concluído hoje no sistema.",
    };
  }

  const nextMealPlan = mealPlan.map((b) =>
    b.id !== block.id
      ? b
      : {
          ...b,
          items: b.items.map((it) =>
            isMealItemDoneOn(it, targetKey)
              ? it
              : markItemDone(it, targetKey, !isPastCompletion),
          ),
        },
  );

  await saveAccountState(userId, {
    ...envelope,
    version: envelope.version + 1,
    state: { ...state, mealPlan: nextMealPlan } as PersistedState,
    updatedAt: new Date().toISOString(),
  });

  return {
    ok: true,
    message: isPastCompletion
      ? `Concluído (dia ${formatDayMonth(targetKey)}): ${block.title}`
      : `Concluído: ${block.title}`,
  };
}

/**
 * Marca um dia de treino como concluído (callback `wd:<dayId>` do
 * Telegram). Cria entry em workoutDayCompletions com a mesma estrutura
 * que o app gera no toggleWorkoutDayCompleted — assim o dashboard de
 * treino reflete a conclusão automaticamente.
 *
 * Date-aware no fuso do usuário. Se já existe completion pra
 * (programId, dayId, hoje), retorna "já concluído".
 */
export async function completeWorkoutDayForUser(
  userId: string,
  dayId: string,
  targetDateKey?: string,
): Promise<{ ok: boolean; message: string }> {
  const envelope = await getAccountState(userId);
  if (!envelope) {
    return { ok: false, message: "Conta não encontrada." };
  }
  const timezone = await getUserTimezone(userId);
  const todayKey = todayKeyInTimezone(timezone);
  const effectiveKey = resolveCompletionDateKey(targetDateKey, todayKey);
  const isPastCompletion = effectiveKey !== todayKey;
  const state = readState(envelope);

  // Acha o programa ativo e o dia. Tenta primeiro nos workoutPrograms
  // (estrutura nova), depois no workoutPlan legacy.
  const programs = state.workoutPrograms ?? [];
  const activeProgram =
    programs.find((p) => p.id === state.activeWorkoutProgramId) ?? programs[0];
  const day =
    activeProgram?.workoutPlan?.find((d) => d.id === dayId) ??
    state.workoutPlan?.find((d) => d.id === dayId);

  if (!day) {
    console.warn(
      `[telegram-actions] workout-day-not-found userId=${userId} dayId=${dayId} ` +
        `activeProgramId=${state.activeWorkoutProgramId} ` +
        `daysAvailable=[${(activeProgram?.workoutPlan ?? state.workoutPlan ?? []).map((d) => d.id).join(",")}]`,
    );
    return {
      ok: false,
      message: "Não encontrei esse treino — abra o app e marque por lá.",
    };
  }

  const programId =
    activeProgram?.id ?? state.activeWorkoutProgramId ?? "";
  const completions = state.workoutDayCompletions ?? [];
  const alreadyDone = completions.some(
    (c) =>
      c.programId === programId &&
      c.dayId === dayId &&
      c.dateKey === effectiveKey,
  );
  if (alreadyDone) {
    return {
      ok: true,
      message: isPastCompletion
        ? `✓ Esse treino já estava concluído no dia ${formatDayMonth(effectiveKey)}.`
        : "✓ Esse treino já estava concluído hoje no sistema.",
    };
  }

  // dateKey = dia do disparo da notificação (não o do clique): a entrada
  // de conclusão já é date-aware por natureza, então basta o dia certo.
  // completedAt segue sendo o instante real do clique (metadado).
  const newCompletion: WorkoutDayCompletion = {
    id: makeId("workout-day"),
    programId,
    dayId,
    dayTitle: day.title,
    dateKey: effectiveKey,
    completedAt: new Date().toISOString(),
  };

  await saveAccountState(userId, {
    ...envelope,
    version: envelope.version + 1,
    state: {
      ...state,
      workoutDayCompletions: [newCompletion, ...completions],
    } as PersistedState,
    updatedAt: new Date().toISOString(),
  });

  return {
    ok: true,
    message: isPastCompletion
      ? `Concluído (dia ${formatDayMonth(effectiveKey)}): ${day.title}`
      : `Concluído: ${day.title}`,
  };
}
