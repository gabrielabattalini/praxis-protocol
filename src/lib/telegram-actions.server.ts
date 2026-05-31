import { getAccountState, saveAccountState } from "@/lib/account-state.server";
import type { PersistedState } from "@/lib/types";

function readState(envelope: { state: unknown }): PersistedState {
  return envelope.state as PersistedState;
}

/**
 * Aplica a conclusão (toggle ON) de uma tarefa a partir do callback do
 * Telegram. Retorna `{ ok, message }` pra ser ecoado no toast.
 *
 * O `target` que chega no callback `t:<id>` pode ser:
 *   1. ID/sourceKey de uma Task em state.tasks (caso primário)
 *   2. ID de um meal block (rotina renderizada como "task" na agenda —
 *      o caso "Banho/hidratação", "Intra treino" etc.)
 *   3. ID de um item dentro de um meal block (suplemento, refeição
 *      individual marcada via lembrete)
 *
 * Antes só cobríamos (1) e qualquer reminder pra rotinas/refeições
 * caía em "Tarefa não encontrada" — agora a gente tenta (2)/(3) antes
 * de desistir.
 */
export async function completeTaskForUser(
  userId: string,
  target: string,
): Promise<{ ok: boolean; message: string }> {
  const envelope = await getAccountState(userId);
  if (!envelope) {
    return { ok: false, message: "Conta não encontrada." };
  }
  const state = readState(envelope);
  const tasks = state.tasks ?? [];
  const mealPlan = state.mealPlan ?? [];

  // 1) Task manual em state.tasks
  const task =
    tasks.find((t) => t.id === target) ||
    tasks.find((t) => t.sourceKey === target);

  if (task) {
    if (task.completed) {
      return { ok: true, message: "Já estava concluída." };
    }
    const todayKey = new Date().toISOString().slice(0, 10);
    const nextDates = Array.from(
      new Set([...(task.completedDates ?? []), todayKey]),
    ).sort();
    const nextTasks = tasks.map((t) =>
      t.id === task.id
        ? {
            ...t,
            completed: true,
            completedAt: new Date().toISOString(),
            completedDates: nextDates,
          }
        : t,
    );
    await saveAccountState(userId, {
      ...envelope,
      state: { ...state, tasks: nextTasks } as PersistedState,
      updatedAt: new Date().toISOString(),
    });
    return { ok: true, message: `Concluída: ${task.title}` };
  }

  // 2) Meal block inteiro (rotinas que aparecem na agenda como "task")
  const block = mealPlan.find((b) => b.id === target);
  if (block) {
    return completeMealBlockForUser(userId, target);
  }

  // 3) Item específico dentro de algum meal block
  let parentBlock: (typeof mealPlan)[number] | undefined;
  let targetItem: (typeof mealPlan)[number]["items"][number] | undefined;
  for (const b of mealPlan) {
    const found = b.items.find((it) => it.id === target);
    if (found) {
      parentBlock = b;
      targetItem = found;
      break;
    }
  }
  if (parentBlock && targetItem) {
    const todayKey = new Date().toISOString().slice(0, 10);
    const alreadyDone =
      targetItem.completedDates?.includes(todayKey) ||
      targetItem.completedAt?.slice(0, 10) === todayKey;
    if (alreadyDone) {
      return { ok: true, message: "Já estava concluído." };
    }
    const nextDates = Array.from(
      new Set([...(targetItem.completedDates ?? []), todayKey]),
    ).sort();
    const nextMealPlan = mealPlan.map((b) =>
      b.id !== parentBlock!.id
        ? b
        : {
            ...b,
            items: b.items.map((it) =>
              it.id !== targetItem!.id
                ? it
                : {
                    ...it,
                    completed: true,
                    completedAt: new Date().toISOString(),
                    completedDates: nextDates,
                  },
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

  // Não bateu em nada. Log pra debug nos próximos cliques.
  console.warn(
    `[telegram-actions] task-not-found userId=${userId} target=${target} tasksCount=${tasks.length} blocksCount=${mealPlan.length}`,
  );
  return {
    ok: false,
    message: "Não encontrei essa tarefa — abra o app e marque por lá.",
  };
}

/**
 * Marca um bloco inteiro (todos os itens) como concluído.
 */
export async function completeMealBlockForUser(
  userId: string,
  blockId: string,
): Promise<{ ok: boolean; message: string }> {
  const envelope = await getAccountState(userId);
  if (!envelope) {
    return { ok: false, message: "Conta não encontrada." };
  }
  const state = readState(envelope);
  const mealPlan = state.mealPlan ?? [];
  const block = mealPlan.find((b) => b.id === blockId);
  if (!block) {
    return { ok: false, message: "Refeição não encontrada." };
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const nextMealPlan = mealPlan.map((b) =>
    b.id !== blockId
      ? b
      : {
          ...b,
          items: b.items.map((it) => ({
            ...it,
            completed: true,
            completedAt: now,
            completedDates: Array.from(
              new Set([...(it.completedDates ?? []), todayKey]),
            ).sort(),
          })),
        },
  );

  await saveAccountState(userId, {
    ...envelope,
    state: { ...state, mealPlan: nextMealPlan } as PersistedState,
    updatedAt: new Date().toISOString(),
  });

  return { ok: true, message: `Concluído: ${block.title}` };
}
