import { getAccountState, saveAccountState } from "@/lib/account-state.server";
import { getUserTimezone } from "@/lib/notification-center.server";
import { isTaskCompletedForDate } from "@/lib/utils";
import type { PersistedState, Task } from "@/lib/types";

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

function markTaskDone(task: Task, todayKey: string): Task {
  const nextDates = Array.from(
    new Set([...(task.completedDates ?? []), todayKey]),
  ).sort();
  return {
    ...task,
    completed: true,
    completedAt: new Date().toISOString(),
    completedDates: nextDates,
  };
}

function markItemDone(item: MealItem, todayKey: string): MealItem {
  const nextDates = Array.from(
    new Set([...(item.completedDates ?? []), todayKey]),
  ).sort();
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
): Promise<{ ok: boolean; message: string }> {
  const envelope = await getAccountState(userId);
  if (!envelope) {
    return { ok: false, message: "Conta não encontrada." };
  }
  const timezone = await getUserTimezone(userId);
  const todayKey = todayKeyInTimezone(timezone);
  const today = new Date(`${todayKey}T12:00:00`);

  const state = readState(envelope);
  const tasks = state.tasks ?? [];
  const mealPlan = state.mealPlan ?? [];

  // 1) Task em state.tasks (id ou sourceKey)
  const task =
    tasks.find((t) => t.id === target) ||
    tasks.find((t) => t.sourceKey === target);

  if (task) {
    // Date-aware: recorrentes guardam completed=true de outros dias.
    if (isTaskCompletedForDate(task, today)) {
      return {
        ok: true,
        message: "✓ Essa tarefa já estava concluída hoje no sistema.",
      };
    }
    const nextTasks = tasks.map((t) =>
      t.id === task.id ? markTaskDone(t, todayKey) : t,
    );
    await saveAccountState(userId, {
      ...envelope,
      state: { ...state, tasks: nextTasks } as PersistedState,
      updatedAt: new Date().toISOString(),
    });
    return { ok: true, message: `Concluída: ${task.title}` };
  }

  // 2) Meal block inteiro
  const block = mealPlan.find((b) => b.id === target);
  if (block) {
    return completeBlock(userId, envelope, state, mealPlan, block, todayKey);
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
    if (isMealItemDoneOn(targetItem, todayKey)) {
      return {
        ok: true,
        message: "✓ Esse item já estava concluído hoje no sistema.",
      };
    }
    const nextMealPlan = mealPlan.map((b) =>
      b.id !== parentBlock!.id
        ? b
        : {
            ...b,
            items: b.items.map((it) =>
              it.id !== targetItem!.id ? it : markItemDone(it, todayKey),
            ),
          },
    );
    await saveAccountState(userId, {
      ...envelope,
      state: { ...state, mealPlan: nextMealPlan } as PersistedState,
      updatedAt: new Date().toISOString(),
    });
    return { ok: true, message: `Concluído: ${targetItem.label}` };
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
): Promise<{ ok: boolean; message: string }> {
  const envelope = await getAccountState(userId);
  if (!envelope) {
    return { ok: false, message: "Conta não encontrada." };
  }
  const timezone = await getUserTimezone(userId);
  const todayKey = todayKeyInTimezone(timezone);
  const state = readState(envelope);
  const mealPlan = state.mealPlan ?? [];
  const block = mealPlan.find((b) => b.id === blockId);
  if (!block) {
    // Pode ser que o callback aponte pra uma Task (rotina) cujo id é o
    // blockId — tenta a rota de task antes de desistir.
    return completeTaskForUser(userId, blockId);
  }
  return completeBlock(userId, envelope, state, mealPlan, block, todayKey);
}

/**
 * Núcleo compartilhado: marca todos os itens de um bloco como concluídos
 * pra hoje. Date-aware — só itens ainda pendentes hoje são marcados.
 */
async function completeBlock(
  userId: string,
  envelope: { version: number; state: unknown; updatedAt?: string },
  state: PersistedState,
  mealPlan: MealBlock[],
  block: MealBlock,
  todayKey: string,
): Promise<{ ok: boolean; message: string }> {
  // Já concluído hoje? (todos os itens marcados pra hoje). Bloco sem
  // itens cai aqui — não há o que marcar.
  const allDone =
    block.items.length === 0 ||
    block.items.every((it) => isMealItemDoneOn(it, todayKey));
  if (allDone) {
    return {
      ok: true,
      message: "✓ Isso já estava concluído hoje no sistema.",
    };
  }

  const nextMealPlan = mealPlan.map((b) =>
    b.id !== block.id
      ? b
      : {
          ...b,
          items: b.items.map((it) =>
            isMealItemDoneOn(it, todayKey) ? it : markItemDone(it, todayKey),
          ),
        },
  );

  await saveAccountState(userId, {
    ...envelope,
    state: { ...state, mealPlan: nextMealPlan } as PersistedState,
    updatedAt: new Date().toISOString(),
  });

  return { ok: true, message: `Concluído: ${block.title}` };
}
