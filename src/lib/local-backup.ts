/**
 * Backup local em IndexedDB — sobrevive ao que localStorage não sobrevive.
 *
 * Por que IndexedDB e não localStorage?
 *  - Cota muito maior (~50× em browsers desktop).
 *  - Não é apagado por "clear cookies"/limpeza de site light.
 *  - Não compete com o storage principal do app (localStorage), que
 *    pode ser sobrescrito por cleanup de outros userIds.
 *  - Permite múltiplos snapshots organizados por timestamp.
 *
 * Cada snapshot guarda: timestamp, userId, version e o state inteiro.
 * Pesa ~30KB por snapshot — caber bem em 30 entradas por usuário.
 *
 * A página /recover lê esse store e oferece restaurar de uma versão local.
 */

const DB_NAME = "praxis-local-backups";
const STORE = "snapshots";
const DB_VERSION = 1;
const MAX_SNAPSHOTS_PER_USER = 30;

export type LocalSnapshot = {
  /** Chave única: `${userId}::${createdAt}` */
  id: string;
  userId: string;
  /** ISO timestamp da criação do backup. */
  createdAt: string;
  /** Versão do servidor (se vier do auto-save bem-sucedido) ou 0. */
  serverVersion: number;
  /** Estado serializado. Guardar como string evita validações IndexedDB. */
  stateJson: string;
  /** Contagens resumidas pra UI sem precisar parsear o stateJson. */
  counts: {
    tasks: number;
    mealPlanBlocks: number;
    dietPlans: number;
    reminders: number;
    workoutPrograms: number;
    workoutLoadEntries: number;
    weightEntries: number;
    financeLines: number;
  };
};

function isSupported(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase | null> {
  if (!isSupported()) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("userId", "userId", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
      };
      request.onsuccess = () => {
        if (settled) return;
        settled = true;
        resolve(request.result);
      };
      request.onerror = () => {
        if (settled) return;
        settled = true;
        resolve(null);
      };
      request.onblocked = () => {
        if (settled) return;
        settled = true;
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

function countsFromState(state: unknown): LocalSnapshot["counts"] {
  const s = (state ?? {}) as Record<string, unknown>;
  const arrLen = (key: string) =>
    Array.isArray(s[key]) ? (s[key] as unknown[]).length : 0;
  const finance =
    (s.financeBudget as { lines?: unknown[] } | undefined) ?? undefined;
  return {
    tasks: arrLen("tasks"),
    mealPlanBlocks: arrLen("mealPlan"),
    dietPlans: arrLen("dietPlans"),
    reminders: arrLen("reminders"),
    workoutPrograms: arrLen("workoutPrograms"),
    workoutLoadEntries: arrLen("workoutLoadEntries"),
    weightEntries: arrLen("weightEntries"),
    financeLines: Array.isArray(finance?.lines) ? finance!.lines!.length : 0,
  };
}

/**
 * Salva um snapshot e descarta os mais antigos do MESMO userId acima do
 * limite. Falhas (cota cheia, IDB indisponível) são silenciosas — backup
 * local é best-effort, não bloqueia o save remoto.
 */
export async function saveLocalSnapshot(input: {
  userId: string;
  state: unknown;
  serverVersion: number;
}): Promise<void> {
  if (!input.userId || !input.state) return;
  const db = await openDb();
  if (!db) return;
  try {
    const createdAt = new Date().toISOString();
    const snapshot: LocalSnapshot = {
      id: `${input.userId}::${createdAt}`,
      userId: input.userId,
      createdAt,
      serverVersion: input.serverVersion,
      stateJson: JSON.stringify(input.state),
      counts: countsFromState(input.state),
    };

    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(snapshot);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    /* swallow — backup local é best-effort */
  } finally {
    db.close();
  }

  // Prune: mantém só os MAX_SNAPSHOTS_PER_USER mais recentes do user.
  try {
    const all = await listLocalSnapshots(input.userId);
    const excess = all.slice(MAX_SNAPSHOTS_PER_USER);
    if (excess.length === 0) return;
    const dbPrune = await openDb();
    if (!dbPrune) return;
    await new Promise<void>((resolve) => {
      const tx = dbPrune.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      for (const entry of excess) store.delete(entry.id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
    dbPrune.close();
  } catch {
    /* swallow */
  }
}

/**
 * Lista snapshots de UM userId (ou de todos, se omitir), ordenados do
 * mais recente pro mais antigo. Sem stateJson — economiza memória; pra
 * ler o conteúdo, usa loadLocalSnapshot.
 */
export async function listLocalSnapshots(
  userId?: string,
): Promise<Omit<LocalSnapshot, "stateJson">[]> {
  const db = await openDb();
  if (!db) return [];
  try {
    const all = await new Promise<LocalSnapshot[]>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as LocalSnapshot[]) ?? []);
      req.onerror = () => resolve([]);
    });
    const filtered = userId ? all.filter((s) => s.userId === userId) : all;
    return filtered
      .map((entry) => {
        // Descarta o stateJson (pesado) — listagem só precisa de
        // metadados+counts. Quem quiser o conteúdo pega via
        // loadLocalSnapshot.
        const { stateJson: _drop, ...rest } = entry;
        void _drop;
        return rest;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  } finally {
    db.close();
  }
}

/** Lê o conteúdo completo (com stateJson) de UM snapshot por id. */
export async function loadLocalSnapshot(
  id: string,
): Promise<LocalSnapshot | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    return await new Promise<LocalSnapshot | null>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve((req.result as LocalSnapshot | null) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  } finally {
    db.close();
  }
}

/** Apaga um snapshot por id (usado pela UI). */
export async function deleteLocalSnapshot(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } finally {
    db.close();
  }
}
