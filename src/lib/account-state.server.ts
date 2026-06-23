import fs from "node:fs";
import path from "node:path";

type PersistedAccountEnvelope = {
  version: number;
  updatedAt?: string;
  state: unknown;
};

type AccountStateStore = {
  users: Record<string, PersistedAccountEnvelope>;
};

/* ───────────────────────────────────────────────────────────────
   Durable, account-bound persistence.

   State is keyed by the Clerk userId, so logging in from ANY
   device/browser loads the same account data.

   Backend selection (priority):
     1. Upstash / Vercel KV (Redis REST) — durable on serverless
        env: KV_REST_API_URL + KV_REST_API_TOKEN
          or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
     2. Local JSON file (.data/…) — dev fallback only
        (does NOT survive on Vercel: ephemeral filesystem)

   No new npm dependency — Upstash exposes a plain REST API hit with
   fetch(), the serverless-correct pattern.
   ─────────────────────────────────────────────────────────────── */

const KV_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

const KV_ENABLED = Boolean(KV_URL && KV_TOKEN);

function kvKey(userId: string) {
  return `praxis:account-state:${userId}`;
}

function kvHistoryKey(userId: string) {
  return `praxis:account-state:${userId}:history`;
}

// 30 versões (era 10) — combinado com HISTORY_THROTTLE=5 cobre ~150
// saves de retroceder. Custo no KV é o mesmo: 1 LPUSH + 1 LTRIM por
// gravação; só o LTRIM mantém 30 em vez de 10. Storage: ~30× ~30KB
// = ~900KB por usuário no pior caso, dentro do orçamento confortável.
const HISTORY_MAX_ENTRIES = 30;

// Guarda histórico só 1 a cada N saves (em vez de toda vez). Reduz pela
// metade as ops por save no KV — crítico no plano Free do Upstash. As 10
// fotografias do histórico continuam disponíveis, só ficam espaçadas em
// 5 versões cada uma (cobre ~50 versões de retroceder em vez de 10).
const HISTORY_THROTTLE = 5;

/**
 * Empilha a versão atual no histórico do usuário antes de gravar a nova.
 * Mantém as N últimas (LPUSH + LTRIM 0..N-1). Sem await crítico — falha
 * de histórico não pode bloquear o save principal.
 */
async function kvPushHistory(
  userId: string,
  envelope: PersistedAccountEnvelope,
): Promise<void> {
  try {
    const key = kvHistoryKey(userId);
    const serialized = JSON.stringify(envelope);
    // Upstash REST: pipeline POST /pipeline com [["LPUSH",key,value],["LTRIM",key,0,N-1]]
    await fetch(`${KV_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["LPUSH", key, serialized],
        ["LTRIM", key, "0", String(HISTORY_MAX_ENTRIES - 1)],
      ]),
      cache: "no-store",
    });
  } catch (error) {
    // Histórico é best-effort. Não derruba o save principal.
    console.warn("[account-state] history push failed:", error);
  }
}

/**
 * Lê as versões anteriores do account-state (mais recente primeiro).
 * Usado por endpoint de recuperação.
 */
export async function getAccountStateHistory(
  userId: string,
): Promise<PersistedAccountEnvelope[]> {
  if (!KV_ENABLED) return [];
  try {
    const response = await fetch(
      `${KV_URL}/lrange/${encodeURIComponent(kvHistoryKey(userId))}/0/${HISTORY_MAX_ENTRIES - 1}`,
      {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
        cache: "no-store",
      },
    );
    if (!response.ok) return [];
    const payload = (await response.json()) as { result?: string[] };
    if (!Array.isArray(payload.result)) return [];
    return payload.result
      .map((raw) => {
        try {
          return JSON.parse(raw) as PersistedAccountEnvelope;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is PersistedAccountEnvelope => entry !== null);
  } catch (error) {
    console.error("[account-state] history read failed:", error);
    return [];
  }
}

async function kvGet(
  userId: string,
): Promise<PersistedAccountEnvelope | null> {
  // FAIL-CLOSED: antes esta função tinha `try { … } catch { return null }`
  // e `if (!response.ok) return null`. Resultado: quando o KV estava com
  // quota exceeded (429), network blip, ou qualquer erro transitório, o
  // servidor "esquecia" o estado existente do usuário e tratava o PUT
  // seguinte como primeiro save (currentVersion=0 → aceita o body sem
  // 409 → kvSet sobrescreve com o que o cliente mandar — inclusive vazio
  // se o cliente também estava em re-hydration falha). Era a causa REAL
  // do "sumiu tudo" recorrente. Agora qualquer erro real lança — a rota
  // PUT precisa converter pra 503 e o cliente NÃO sobrescreve nada.
  const response = await fetch(
    `${KV_URL}/get/${encodeURIComponent(kvKey(userId))}`,
    {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      cache: "no-store",
    },
  );
  if (response.ok) {
    const payload = (await response.json()) as { result?: string | null };
    if (payload.result === null || payload.result === undefined) return null;
    try {
      return JSON.parse(payload.result) as PersistedAccountEnvelope;
    } catch (error) {
      // Corrupção no KV — trata como ausência pra o cliente recuperar do
      // localStorage; não silencia o log pra diagnóstico.
      console.error("[account-state] KV value corrupt:", error);
      return null;
    }
  }
  // Erro transitório (429, 5xx, etc) — propaga pra rota retornar 503.
  const detail = `${response.status} ${response.statusText}`.trim();
  throw new Error(`[account-state] KV get failed: ${detail}`);
}

async function kvSet(
  userId: string,
  envelope: PersistedAccountEnvelope,
): Promise<void> {
  // Upstash REST: POST {url}/set/{key} with the raw value as the body.
  const response = await fetch(
    `${KV_URL}/set/${encodeURIComponent(kvKey(userId))}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "text/plain",
      },
      body: JSON.stringify(envelope),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(
      `[account-state] KV set failed: ${response.status} ${response.statusText}`,
    );
  }
}

/* ── Local file fallback (dev only) ──────────────────────────── */

const dataDir = path.join(process.cwd(), ".data");
const storePath = path.join(dataDir, "account-state-store.json");

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

function emptyStore(): AccountStateStore {
  return { users: {} };
}

function loadStore(): AccountStateStore {
  ensureDataDir();
  try {
    return JSON.parse(fs.readFileSync(storePath, "utf8")) as AccountStateStore;
  } catch {
    return emptyStore();
  }
}

function saveStore(store: AccountStateStore) {
  ensureDataDir();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
}

/* ── Public API (async, backend-agnostic) ────────────────────── */

export async function getAccountState(
  userId: string,
): Promise<PersistedAccountEnvelope | null> {
  if (KV_ENABLED) {
    return kvGet(userId);
  }
  const store = loadStore();
  return store.users[userId] ?? null;
}

export async function saveAccountState(
  userId: string,
  payload: PersistedAccountEnvelope,
): Promise<PersistedAccountEnvelope> {
  const requestedVersion = Number.isFinite(payload.version)
    ? payload.version
    : 1;

  if (KV_ENABLED) {
    const current = await kvGet(userId);
    const currentVersion = Number.isFinite(current?.version)
      ? (current!.version as number)
      : 0;
    const envelope: PersistedAccountEnvelope = {
      version: Math.max(requestedVersion, currentVersion + 1),
      updatedAt: payload.updatedAt || new Date().toISOString(),
      state: payload.state,
    };
    // Histórico: empilha a CORRENTE no histórico antes de sobrescrever
    // — mas só 1 a cada HISTORY_THROTTLE saves. Antes era TODA vez:
    // cada save custava ~5 commands (GET + SET + GET-corrente +
    // LPUSH + LTRIM); throttle corta pra ~2-3. As 10 fotografias do
    // histórico continuam disponíveis (só ficam mais espaçadas em
    // versão — você ganha 10×T pontos de restore em vez de 10).
    // T=5: a cada 5 saves, 1 vai pro histórico. Versão monotônica
    // crescente, então `currentVersion % T` distribui uniformemente.
    if (current && currentVersion % HISTORY_THROTTLE === 0) {
      await kvPushHistory(userId, current);
    }
    await kvSet(userId, envelope);
    return envelope;
  }

  const store = loadStore();
  const currentVersion = Number.isFinite(store.users[userId]?.version)
    ? (store.users[userId]!.version as number)
    : 0;
  const envelope: PersistedAccountEnvelope = {
    version: Math.max(requestedVersion, currentVersion + 1),
    updatedAt: payload.updatedAt || new Date().toISOString(),
    state: payload.state,
  };
  store.users[userId] = envelope;
  saveStore(store);
  return store.users[userId];
}
