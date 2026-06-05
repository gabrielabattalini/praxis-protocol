import type { PersistedState, Task } from "@/lib/types";

/**
 * Merge 3-way do estado persistido (account-state).
 *
 * Usado quando dois dispositivos editam em paralelo: o servidor rejeita
 * o save com versão defasada (409), o cliente busca o estado do servidor
 * e reconcilia LOCAL + SERVER usando a BASE comum (o último estado que
 * ambos compartilhavam — `lastServerSnapshot`).
 *
 * Estratégia:
 *  - Granularidade por chave de topo: se só um lado mudou a fatia em
 *    relação à base, fica a versão alterada. Se os dois mudaram, o LOCAL
 *    vence (o dispositivo que está com o usuário na frente). Cobre o
 *    caso comum (A edita finanças, B edita treino → ambos preservados).
 *  - `tasks` tem merge FINO por id (é a fatia mais editada — toggle de
 *    hábito). Une `completedDates` de cada tarefa, então nenhuma baixa
 *    de hábito é perdida mesmo quando os dois dispositivos togglam tasks
 *    diferentes (ou a mesma) ao mesmo tempo.
 *
 * Função PURA — sem React/IO. Testada em tests/store/state-merge.test.mjs.
 */

function stableEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function unionSorted(a: string[] = [], b: string[] = []): string[] {
  return Array.from(new Set([...a, ...b])).sort();
}

function laterIso(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

/**
 * Une duas versões da MESMA task (mesmo id) preservando histórico de
 * conclusão dos dois lados. Campos não-temporais preferem `local`.
 */
function mergeTask(local: Task, server: Task): Task {
  const completedDates = unionSorted(
    local.completedDates ?? [],
    server.completedDates ?? [],
  );
  const completedAt = laterIso(local.completedAt, server.completedAt);
  return {
    // local vence nos campos editáveis (título, recorrência, etc.) — é o
    // dispositivo ativo. Mas o histórico de conclusão é a UNIÃO.
    ...server,
    ...local,
    completedDates: completedDates.length ? completedDates : undefined,
    completedAt,
    // `completed` (booleano de hoje) reflete qualquer lado que marcou.
    completed: Boolean(local.completed || server.completed),
  };
}

/**
 * Merge da lista de tasks por id. União dos ids presentes em local OU
 * server (não perde tarefa nem ressuscita silenciosamente o que ambos
 * apagaram). Ordem segue a do `local` primeiro, depois extras do server.
 */
function mergeTasks(localTasks: Task[], serverTasks: Task[]): Task[] {
  const serverById = new Map(serverTasks.map((task) => [task.id, task]));
  const localIds = new Set(localTasks.map((task) => task.id));

  const merged: Task[] = localTasks.map((localTask) => {
    const serverTask = serverById.get(localTask.id);
    return serverTask ? mergeTask(localTask, serverTask) : localTask;
  });

  // Tasks que só existem no server (criadas no outro dispositivo, ou
  // que o local não tem) entram no fim.
  for (const serverTask of serverTasks) {
    if (!localIds.has(serverTask.id)) {
      merged.push(serverTask);
    }
  }

  return merged;
}

export function threeWayMergeState(
  base: PersistedState,
  local: PersistedState,
  server: PersistedState,
): PersistedState {
  const baseRecord = base as unknown as Record<string, unknown>;
  const localRecord = local as unknown as Record<string, unknown>;
  const serverRecord = server as unknown as Record<string, unknown>;

  const keys = new Set<string>([
    ...Object.keys(baseRecord),
    ...Object.keys(localRecord),
    ...Object.keys(serverRecord),
  ]);

  const result: Record<string, unknown> = {};

  for (const key of keys) {
    const baseValue = baseRecord[key];
    const localValue = localRecord[key];
    const serverValue = serverRecord[key];

    // Fatia mais sensível: merge fino de tasks por id.
    if (key === "tasks") {
      result[key] = mergeTasks(
        Array.isArray(localValue) ? (localValue as Task[]) : [],
        Array.isArray(serverValue) ? (serverValue as Task[]) : [],
      );
      continue;
    }

    const localChanged = !stableEqual(localValue, baseValue);
    const serverChanged = !stableEqual(serverValue, baseValue);

    if (!localChanged) {
      // Local não mexeu nesta fatia → fica a do server (que pode ter a
      // edição do outro dispositivo).
      result[key] = serverValue;
    } else if (!serverChanged) {
      // Só o local mexeu → mantém o local.
      result[key] = localValue;
    } else {
      // Ambos mexeram na mesma fatia (conflito raro) → local vence.
      result[key] = localValue;
    }
  }

  return result as unknown as PersistedState;
}
