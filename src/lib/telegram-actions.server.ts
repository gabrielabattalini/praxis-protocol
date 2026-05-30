import { getAccountState, saveAccountState } from "@/lib/account-state.server";
import type { PersistedState } from "@/lib/types";

function readState(envelope: { state: unknown }): PersistedState {
  return envelope.state as PersistedState;
}

/**
 * Aplica a conclusão (toggle ON) de uma tarefa manual no account-state
 * do usuário. Retorna `{ ok, message }` pra ser ecoado no toast do
 * callback_query do Telegram.
 *
 * Identificação:
 *   sourceKey === id  → mais comum quando o item veio do scheduleItem
 *                       (cuja id é "task:<sourceKey-or-id>")
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
  const task =
    tasks.find((t) => t.sourceKey === target) ||
    tasks.find((t) => t.id === target);

  if (!task) {
    return { ok: false, message: "Tarefa não encontrada." };
  }
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

/**
 * Marca um item de refeição (alimento) como concluído pra hoje, no
 * account-state. Atualiza completedDates (histórico) + completed/
 * completedAt (vista atual).
 */
export async function completeMealItemForUser(
  userId: string,
  blockId: string,
  itemId: string,
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
  const item = block.items.find((i) => i.id === itemId);
  if (!item) {
    return { ok: false, message: "Item não encontrado." };
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const already =
    item.completedDates?.includes(todayKey) ||
    item.completedAt?.slice(0, 10) === todayKey;
  if (already) {
    return { ok: true, message: "Já estava concluído." };
  }

  const nextDates = Array.from(
    new Set([...(item.completedDates ?? []), todayKey]),
  ).sort();
  const nextMealPlan = mealPlan.map((b) =>
    b.id !== blockId
      ? b
      : {
          ...b,
          items: b.items.map((it) =>
            it.id !== itemId
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

  return { ok: true, message: `Concluído: ${item.label}` };
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
