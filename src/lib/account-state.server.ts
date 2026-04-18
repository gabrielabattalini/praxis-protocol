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

const dataDir = path.join(process.cwd(), ".data");
const storePath = path.join(dataDir, "account-state-store.json");

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

function emptyStore(): AccountStateStore {
  return {
    users: {},
  };
}

function loadStore() {
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

export function getAccountState(userId: string) {
  const store = loadStore();
  return store.users[userId] ?? null;
}

export function saveAccountState(
  userId: string,
  payload: PersistedAccountEnvelope,
) {
  const store = loadStore();
  store.users[userId] = {
    version: Number.isFinite(payload.version) ? payload.version : 1,
    updatedAt: payload.updatedAt || new Date().toISOString(),
    state: payload.state,
  };
  saveStore(store);
  return store.users[userId];
}
