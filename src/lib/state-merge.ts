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
 * Usado em dois lugares:
 *  - save 409 (servidor rejeita versão defasada → cliente reconcilia)
 *  - pull periódico (cross-device sync): a cada 60s o cliente puxa o
 *    estado do servidor e, se tem edições locais não-salvas, reconcilia.
 *
 * BASE = último snapshot que cliente e servidor compartilhavam
 * (`lastServerSnapshotRef`). LOCAL = estado atual do cliente. SERVER =
 * estado novo que veio do servidor.
 *
 * Estratégia:
 *  - Granularidade por chave de topo (fatias não-histórico: reminders,
 *    finanças, plano de treino, settings): se só um lado mudou em relação
 *    à base, fica a versão alterada; se os dois mudaram, LOCAL vence (é o
 *    dispositivo ativo na frente do usuário).
 *  - Fatias de HISTÓRICO/CONCLUSÃO têm merge FINO 3-way que respeita
 *    REMOÇÕES. Antes era união simples (local ∪ server), o que ressuscitava
 *    silenciosamente baixas que o usuário tirou — bug do "ele fala que
 *    remove mas continua" no toggle da Agenda: o pull de 60s trazia o
 *    estado antigo do server, a união voltava a baixa, e a UI revertia.
 *
 *  Regra de inclusão 3-way (pra cada item identificável):
 *      base │ local │ server │ resultado
 *      ─────┼───────┼────────┼─────────────────────────────────
 *       —   │   ✓   │   —    │ ✓  (adicionado pelo local)
 *       —   │   —   │   ✓    │ ✓  (adicionado pelo server)
 *       ✓   │   ✓   │   ✓    │ ✓  (mantido nos dois lados)
 *       ✓   │   —   │   ✓    │ —  (REMOVIDO pelo local, respeita)
 *       ✓   │   ✓   │   —    │ —  (REMOVIDO pelo server, respeita)
 *       ✓   │   —   │   —    │ —  (removido nos dois)
 *
 *  Resumo: incluir se está em local OR server, MENOS o que estava em base
 *  mas sumiu de pelo menos um lado (= foi removido intencionalmente).
 *  Se ambos editam a MESMA conclusão em paralelo, prevalece o "removido"
 *  (escolha conservadora: melhor exigir um clique a mais do que ressuscitar
 *  algo que o usuário tirou).
 *
 *  Função PURA — sem React/IO. Testada em tests/store/state-merge.test.mjs.
 */

function stableEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function laterIso(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

/**
 * 3-way merge de uma lista de strings que age como SET (datas, ids).
 * Respeita remoções pelo lado que removeu — sem isto, união simples
 * fazia o pull do servidor ressuscitar conclusões removidas localmente.
 */
function mergeStringSet(
  base: string[] = [],
  local: string[] = [],
  server: string[] = [],
): string[] {
  const baseSet = new Set(base);
  const localSet = new Set(local);
  const serverSet = new Set(server);
  const result = new Set<string>();
  for (const value of new Set([...localSet, ...serverSet])) {
    const wasInBase = baseSet.has(value);
    const removedByLocal = wasInBase && !localSet.has(value);
    const removedByServer = wasInBase && !serverSet.has(value);
    if (removedByLocal || removedByServer) continue;
    result.add(value);
  }
  return Array.from(result).sort();
}

/**
 * 3-way merge genérico de coleções identificáveis (tasks, mealItems,
 * blocks, completions, logs). Inclusão segue a tabela do header:
 *   - itens só em local OU server (não estavam em base) → adicionados
 *   - itens em base mas removidos por algum lado → tirados
 *   - itens em ambos → reconciliados via `mergeItem`
 *
 * `keyOf` extrai a chave de identidade (id pra tasks/items, tripla
 * (programa, dia, data) pra completions). Quando ambos os lados têm o
 * mesmo item, `mergeItem` decide o que fazer com os campos internos.
 */
function mergeCollection<T>(
  base: T[],
  local: T[],
  server: T[],
  keyOf: (item: T) => string,
  mergeItem: (
    localItem: T | undefined,
    serverItem: T | undefined,
    baseItem: T | undefined,
  ) => T,
): T[] {
  const baseByKey = new Map(base.map((item) => [keyOf(item), item]));
  const localByKey = new Map(local.map((item) => [keyOf(item), item]));
  const serverByKey = new Map(server.map((item) => [keyOf(item), item]));
  const localOrder = local.map(keyOf);

  const allKeys = new Set<string>([
    ...localByKey.keys(),
    ...serverByKey.keys(),
  ]);

  const merged: T[] = [];
  const seen = new Set<string>();

  // Mantém ordem do local pros que existem nele; resto entra no fim.
  for (const key of localOrder) {
    if (!allKeys.has(key)) continue;
    const localItem = localByKey.get(key);
    const serverItem = serverByKey.get(key);
    const baseItem = baseByKey.get(key);
    const wasInBase = baseByKey.has(key);
    const removedByLocal = wasInBase && !localByKey.has(key);
    const removedByServer = wasInBase && !serverByKey.has(key);
    if (removedByLocal || removedByServer) {
      seen.add(key);
      continue;
    }
    merged.push(mergeItem(localItem, serverItem, baseItem));
    seen.add(key);
  }
  for (const key of allKeys) {
    if (seen.has(key)) continue;
    const localItem = localByKey.get(key);
    const serverItem = serverByKey.get(key);
    const baseItem = baseByKey.get(key);
    const wasInBase = baseByKey.has(key);
    const removedByLocal = wasInBase && !localByKey.has(key);
    const removedByServer = wasInBase && !serverByKey.has(key);
    if (removedByLocal || removedByServer) continue;
    merged.push(mergeItem(localItem, serverItem, baseItem));
  }

  return merged;
}

/**
 * Reconcilia uma task que existe nos dois lados. Campos de plano (título,
 * recorrência, descrição) preferem local — é o dispositivo ativo. Histórico
 * de conclusão (completedDates) usa o merge 3-way que respeita remoção:
 * desmarcar um dia no app não é "ressuscitado" pelo pull do servidor.
 */
function mergeTaskPair(
  local: Task | undefined,
  server: Task | undefined,
  base: Task | undefined,
): Task {
  if (!local) return server as Task;
  if (!server) return local;
  const completedDates = mergeStringSet(
    base?.completedDates,
    local.completedDates,
    server.completedDates,
  );
  const hasAnyDate = completedDates.length > 0;
  // Se há datas: completed reflete a OR (algum lado marcou). Se NÃO há
  // datas mas base também não tinha (task legada que usa só o booleano
  // completed): preserva OR pra não regredir marcação antiga. Se base
  // TINHA e agora está vazio: foi REMOVIDO de propósito → zera tudo.
  const baseHadDates = (base?.completedDates?.length ?? 0) > 0;
  const datesWereRemoved = baseHadDates && !hasAnyDate;
  const completed = datesWereRemoved
    ? false
    : Boolean(local.completed || server.completed);
  const completedAt = datesWereRemoved
    ? undefined
    : laterIso(local.completedAt, server.completedAt);
  return {
    ...server,
    ...local,
    completedDates: hasAnyDate ? completedDates : undefined,
    completedAt,
    completed,
  };
}

function mergeMealItemPair(
  local: MealPlanItem | undefined,
  server: MealPlanItem | undefined,
  base: MealPlanItem | undefined,
): MealPlanItem {
  if (!local) return server as MealPlanItem;
  if (!server) return local;
  const completedDates = mergeStringSet(
    base?.completedDates,
    local.completedDates,
    server.completedDates,
  );
  const hasAnyDate = completedDates.length > 0;
  const baseHadDates = (base?.completedDates?.length ?? 0) > 0;
  const datesWereRemoved = baseHadDates && !hasAnyDate;
  return {
    ...server,
    ...local,
    completedDates: hasAnyDate ? completedDates : undefined,
    completedAt: datesWereRemoved
      ? undefined
      : laterIso(local.completedAt, server.completedAt),
    completed: datesWereRemoved
      ? false
      : Boolean(local.completed || server.completed),
  };
}

function mergeMealBlockPair(
  local: MealPlanBlock | undefined,
  server: MealPlanBlock | undefined,
  base: MealPlanBlock | undefined,
): MealPlanBlock {
  if (!local) return server as MealPlanBlock;
  if (!server) return local;
  return {
    ...server,
    ...local,
    items: mergeCollection<MealPlanItem>(
      base?.items ?? [],
      local.items ?? [],
      server.items ?? [],
      (item) => item.id,
      mergeMealItemPair,
    ),
  };
}

/**
 * waterEntries: 3-way por data. Respeita remoção (zerar consumo em algum
 * lado de fato remove a entrada). Quando os dois lados têm o mesmo dia,
 * vence o MAIOR consumo (consumedMl é total acumulado; o dispositivo que
 * registrou mais tem a verdade mais completa).
 */
function mergeWaterEntries(
  base: NutritionWaterEntry[],
  local: NutritionWaterEntry[],
  server: NutritionWaterEntry[],
): NutritionWaterEntry[] {
  const baseSet = new Set(base.map((entry) => entry.date));
  const localByDate = new Map(local.map((entry) => [entry.date, entry.consumedMl]));
  const serverByDate = new Map(server.map((entry) => [entry.date, entry.consumedMl]));
  const dates = new Set<string>([...localByDate.keys(), ...serverByDate.keys()]);
  const result: NutritionWaterEntry[] = [];
  for (const date of dates) {
    const wasInBase = baseSet.has(date);
    const inLocal = localByDate.has(date);
    const inServer = serverByDate.has(date);
    const removedByLocal = wasInBase && !inLocal;
    const removedByServer = wasInBase && !inServer;
    if (removedByLocal || removedByServer) continue;
    const localMl = inLocal ? (localByDate.get(date) ?? 0) : -Infinity;
    const serverMl = inServer ? (serverByDate.get(date) ?? 0) : -Infinity;
    result.push({ date, consumedMl: Math.max(localMl, serverMl) });
  }
  return result.sort((left, right) => left.date.localeCompare(right.date));
}

/**
 * Conclusões de dia (treino/recuperação): chave lógica = (programa, dia,
 * data). 3-way mantendo o registro de QUEM (id) preferindo o local; se só
 * o server tinha, mantém esse id.
 */
function mergeDayCompletions<
  T extends { id: string; programId: string; dayId: string; dateKey: string },
>(base: T[], local: T[], server: T[]): T[] {
  return mergeCollection<T>(
    base,
    local,
    server,
    (entry) => `${entry.programId}::${entry.dayId}::${entry.dateKey}`,
    (localItem, serverItem) => (localItem ?? (serverItem as T)),
  );
}

/** Logs append-only (workoutLoadEntries): 3-way por id. */
function mergeById<T extends { id: string }>(
  base: T[],
  local: T[],
  server: T[],
): T[] {
  return mergeCollection<T>(
    base,
    local,
    server,
    (entry) => entry.id,
    (localItem, serverItem) => (localItem ?? (serverItem as T)),
  );
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

    // Fatias de HISTÓRICO/CONCLUSÃO: merge 3-way que respeita remoção.
    // Sem o base aqui, união simples ressuscitava baixas removidas (bug
    // do "ele fala que remove mas continua").
    if (key === "tasks") {
      result[key] = mergeCollection<Task>(
        asArray<Task>(baseValue),
        asArray<Task>(localValue),
        asArray<Task>(serverValue),
        (task) => task.id,
        mergeTaskPair,
      );
      continue;
    }
    if (key === "mealPlan") {
      result[key] = mergeCollection<MealPlanBlock>(
        asArray<MealPlanBlock>(baseValue),
        asArray<MealPlanBlock>(localValue),
        asArray<MealPlanBlock>(serverValue),
        (block) => block.id,
        mergeMealBlockPair,
      );
      continue;
    }
    if (key === "waterEntries") {
      result[key] = mergeWaterEntries(
        asArray<NutritionWaterEntry>(baseValue),
        asArray<NutritionWaterEntry>(localValue),
        asArray<NutritionWaterEntry>(serverValue),
      );
      continue;
    }
    if (key === "workoutDayCompletions" || key === "recoveryDayCompletions") {
      result[key] = mergeDayCompletions(
        asArray<{
          id: string;
          programId: string;
          dayId: string;
          dateKey: string;
        }>(baseValue),
        asArray<{
          id: string;
          programId: string;
          dayId: string;
          dateKey: string;
        }>(localValue),
        asArray<{
          id: string;
          programId: string;
          dayId: string;
          dateKey: string;
        }>(serverValue),
      );
      continue;
    }
    if (key === "workoutLoadEntries") {
      result[key] = mergeById(
        asArray<WorkoutLoadEntry>(baseValue),
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
