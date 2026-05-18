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

async function kvGet(
  userId: string,
): Promise<PersistedAccountEnvelope | null> {
  try {
    const response = await fetch(
      `${KV_URL}/get/${encodeURIComponent(kvKey(userId))}`,
      {
        headers: { Authorization: `Bearer ${KV_TOKEN}` },
        cache: "no-store",
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { result?: string | null };
    if (!payload.result) return null;
    return JSON.parse(payload.result) as PersistedAccountEnvelope;
  } catch (error) {
    console.error("[account-state] KV get failed:", error);
    return null;
  }
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
  const envelope: PersistedAccountEnvelope = {
    version: Number.isFinite(payload.version) ? payload.version : 1,
    updatedAt: payload.updatedAt || new Date().toISOString(),
    state: payload.state,
  };

  if (KV_ENABLED) {
    await kvSet(userId, envelope);
    return envelope;
  }

  const store = loadStore();
  store.users[userId] = envelope;
  saveStore(store);
  return store.users[userId];
}

/** True when a durable cross-device backend is configured. */
export function isDurableAccountStoreEnabled() {
  return KV_ENABLED;
}
