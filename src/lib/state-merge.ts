import type {
  MealPlanBlock,
  MealPlanItem,
  NutritionWaterEntry,
  PersistedState,
  Task,
  WorkoutLoadEntry,
} from "@/lib/types";

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
 *  - Fatias de HISTÓRICO/CONCLUSÃO têm merge FINO (são as mais editadas
 *    em paralelo — toggle de hábito, dar baixa em refeição pelo app E
 *    pelo Telegram, registrar água, concluir treino). Sem isto, marcar a
 *    refeição no app e concluir pelo Telegram fazia a fatia inteira de um
 *    lado ser descartada, "voltando" a semana toda pra pendente:
 *      · tasks                 → une completedDates por id
 *      · mealPlan              → une completedDates por bloco/item
 *      · waterEntries          → maior consumo por dia
 *      · workoutDayCompletions → união por (programa, dia, data)
 *      · recoveryDayCompletions→ união por (programa, dia, data)
 *      · workoutLoadEntries    → união por id
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

/**
 * Une um item de refeição (mesmo id) preservando a conclusão dos dois
 * lados. Mesma filosofia de mergeTask: campos do plano (label, macros,
 * quantidade) preferem local; histórico de conclusão é UNIÃO.
 */
function mergeMealItem(local: MealPlanItem, server: MealPlanItem): MealPlanItem {
  const completedDates = unionSorted(
    local.completedDates ?? [],
    server.completedDates ?? [],
  );
  return {
    ...server,
    ...local,
    completedDates: completedDates.length ? completedDates : undefined,
    completedAt: laterIso(local.completedAt, server.completedAt),
    completed: Boolean(local.completed || server.completed),
  };
}

function mergeMealItems(
  localItems: MealPlanItem[] = [],
  serverItems: MealPlanItem[] = [],
): MealPlanItem[] {
  const serverById = new Map(serverItems.map((item) => [item.id, item]));
  const localIds = new Set(localItems.map((item) => item.id));

  const merged: MealPlanItem[] = localItems.map((localItem) => {
    const serverItem = serverById.get(localItem.id);
    return serverItem ? mergeMealItem(localItem, serverItem) : localItem;
  });

  for (const serverItem of serverItems) {
    if (!localIds.has(serverItem.id)) {
      merged.push(serverItem);
    }
  }

  return merged;
}

function mergeMealBlock(
  local: MealPlanBlock,
  server: MealPlanBlock,
): MealPlanBlock {
  return {
    // local vence na estrutura do plano (título, horário, categoria,
    // notas); os itens são mesclados item-a-item pra unir as conclusões.
    ...server,
    ...local,
    items: mergeMealItems(local.items ?? [], server.items ?? []),
  };
}

/**
 * Merge do mealPlan por bloco. Une as conclusões dos dois dispositivos —
 * sem isso, dar baixa no almoço pelo app e no Telegram (que salva em
 * paralelo) fazia uma das marcações sumir no merge.
 */
function mergeMealPlan(
  localBlocks: MealPlanBlock[],
  serverBlocks: MealPlanBlock[],
): MealPlanBlock[] {
  const serverById = new Map(serverBlocks.map((block) => [block.id, block]));
  const localIds = new Set(localBlocks.map((block) => block.id));

  const merged: MealPlanBlock[] = localBlocks.map((localBlock) => {
    const serverBlock = serverById.get(localBlock.id);
    return serverBlock ? mergeMealBlock(localBlock, serverBlock) : localBlock;
  });

  for (const serverBlock of serverBlocks) {
    if (!localIds.has(serverBlock.id)) {
      merged.push(serverBlock);
    }
  }

  return merged;
}

/**
 * Une as entradas de água por dia, ficando com o MAIOR consumo registrado
 * naquele dia (consumedMl é o total acumulado do dia — o dispositivo que
 * registrou mais tem o número mais verdadeiro).
 */
function mergeWaterEntries(
  localEntries: NutritionWaterEntry[],
  serverEntries: NutritionWaterEntry[],
): NutritionWaterEntry[] {
  const byDate = new Map<string, number>();
  for (const entry of [...serverEntries, ...localEntries]) {
    const previous = byDate.get(entry.date);
    byDate.set(
      entry.date,
      previous === undefined
        ? entry.consumedMl
        : Math.max(previous, entry.consumedMl),
    );
  }
  return Array.from(byDate.entries())
    .map(([date, consumedMl]) => ({ date, consumedMl }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

/**
 * União de conclusões de dia (treino/recuperação) deduplicando pela
 * tripla (programa, dia, data) — os dois dispositivos geram ids
 * diferentes pra mesma conclusão lógica, então dedupe por id criaria
 * duplicata. Local primeiro.
 */
function mergeDayCompletions<
  T extends { programId: string; dayId: string; dateKey: string },
>(local: T[], server: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const completion of [...local, ...server]) {
    const key = `${completion.programId}::${completion.dayId}::${completion.dateKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(completion);
  }
  return out;
}

/** União de registros com id único (logs append-only). Local primeiro. */
function mergeById<T extends { id: string }>(local: T[], server: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const entry of [...local, ...server]) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
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

    // Fatias de histórico/conclusão: merge fino que UNE os dois lados,
    // pra nenhuma baixa (hábito, refeição, treino, água) ser perdida
    // quando dois saves concorrem. Sem isto, marcar pelo app + Telegram
    // fazia a fatia inteira de um lado sobrescrever a do outro.
    if (key === "tasks") {
      result[key] = mergeTasks(asArray<Task>(localValue), asArray<Task>(serverValue));
      continue;
    }
    if (key === "mealPlan") {
      result[key] = mergeMealPlan(
        asArray<MealPlanBlock>(localValue),
        asArray<MealPlanBlock>(serverValue),
      );
      continue;
    }
    if (key === "waterEntries") {
      result[key] = mergeWaterEntries(
        asArray<NutritionWaterEntry>(localValue),
        asArray<NutritionWaterEntry>(serverValue),
      );
      continue;
    }
    if (key === "workoutDayCompletions" || key === "recoveryDayCompletions") {
      result[key] = mergeDayCompletions(
        asArray<{ programId: string; dayId: string; dateKey: string }>(localValue),
        asArray<{ programId: string; dayId: string; dateKey: string }>(serverValue),
      );
      continue;
    }
    if (key === "workoutLoadEntries") {
      result[key] = mergeById(
        asArray<WorkoutLoadEntry>(localValue),
        asArray<WorkoutLoadEntry>(serverValue),
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
