import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import webpush, {
  type PushSubscription,
  type RequestOptions,
  type WebPushError,
} from "web-push";

export type NotificationScheduleInput = {
  id: string;
  title: string;
  body?: string;
  scheduledFor: string | number | Date;
  tag?: string;
  url?: string;
  icon?: string;
  badge?: string;
  requireInteraction?: boolean;
  ttlSeconds?: number;
  metadata?: Record<string, unknown>;
};

export type StoredNotificationOccurrence = {
  id: string;
  title: string;
  body: string;
  scheduledFor: string;
  tag?: string;
  url?: string;
  icon?: string;
  badge?: string;
  requireInteraction: boolean;
  ttlSeconds?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  lastAttemptAt?: string;
  lastError?: string;
};

type StoredPushSubscription = PushSubscription & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

type UserNotificationState = {
  subscriptions: StoredPushSubscription[];
  schedule: StoredNotificationOccurrence[];
  sentOccurrenceIds: string[];
  updatedAt: string;
};

type NotificationStore = {
  version: 1;
  users: Record<string, UserNotificationState>;
  updatedAt: string;
};

type PersistedVapid = {
  publicKey: string;
  privateKey: string;
  subject: string;
  source: "env" | "file";
};

type DispatchInternalOptions = {
  userId?: string;
  occurrenceIds?: string[];
  limit?: number;
  dryRun?: boolean;
  now?: Date;
};

type DeliveryPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  icon?: string;
  badge?: string;
  requireInteraction?: boolean;
  metadata?: Record<string, unknown>;
};

type DeliveryStats = {
  attemptedCount: number;
  successCount: number;
  failureCount: number;
  invalidRemovedCount: number;
  remainingSubscriptions: number;
  results: Array<{
    endpoint: string;
    ok: boolean;
    statusCode?: number;
    error?: string;
  }>;
};

export type DispatchNotificationsResult = {
  mode: "dry-run" | "dispatch";
  usersProcessed: number;
  occurrencesMatched: number;
  occurrencesSent: number;
  occurrencesSkipped: number;
  invalidSubscriptionsRemoved: number;
  remainingSubscriptions: number;
  userSummaries: Array<{
    userId: string;
    dueCount: number;
    sentCount: number;
    skippedCount: number;
    subscriptionCount: number;
  }>;
};

export type SyncScheduleResult = {
  scheduleCount: number;
  insertedCount: number;
  updatedCount: number;
  removedCount: number;
};

const DATA_DIR = path.join(process.cwd(), ".data", "notifications");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const VAPID_PATH = path.join(DATA_DIR, "vapid.json");
const DEFAULT_SUBJECT =
  process.env.WEB_PUSH_VAPID_SUBJECT ||
  process.env.VAPID_SUBJECT ||
  "mailto:notifications@praxis-protocol.local";
const SENT_OCCURRENCE_LIMIT = 2000;
const DEFAULT_TTL_SECONDS = 60 * 15;
const MAX_TTL_SECONDS = 60 * 60 * 24 * 28;

let storeQueue: Promise<unknown> = Promise.resolve();
let configuredVapidSignature = "";

function nowIso() {
  return new Date().toISOString();
}

function defaultStore(): NotificationStore {
  return {
    version: 1,
    users: {},
    updatedAt: nowIso(),
  };
}

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function writeJsonAtomic(filePath: string, value: unknown) {
  await ensureDataDir();
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

function withStoreLock<T>(work: () => Promise<T>): Promise<T> {
  const run = storeQueue.then(work, work);
  storeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function sanitizeUrl(value: string | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return undefined;
  try {
    return new URL(trimmed).toString();
  } catch {
    return undefined;
  }
}

function clampTtlSeconds(value: number | undefined) {
  if (!Number.isFinite(value)) return undefined;
  const rounded = Math.round(Number(value));
  if (rounded <= 0) return undefined;
  return Math.min(rounded, MAX_TTL_SECONDS);
}

function parseScheduledFor(value: NotificationScheduleInput["scheduledFor"]) {
  const date =
    value instanceof Date ? value : new Date(typeof value === "number" ? value : String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error("scheduledFor precisa ser uma data válida.");
  }
  return date.toISOString();
}

function getUserState(store: NotificationStore, userId: string): UserNotificationState {
  if (!store.users[userId]) {
    store.users[userId] = {
      subscriptions: [],
      schedule: [],
      sentOccurrenceIds: [],
      updatedAt: nowIso(),
    };
  }

  return store.users[userId];
}

function trimSentOccurrences(state: UserNotificationState) {
  if (state.sentOccurrenceIds.length > SENT_OCCURRENCE_LIMIT) {
    state.sentOccurrenceIds = state.sentOccurrenceIds.slice(-SENT_OCCURRENCE_LIMIT);
  }
}

async function loadStore() {
  const stored = await readJsonFile<NotificationStore>(STORE_PATH);
  if (!stored || stored.version !== 1 || typeof stored.users !== "object") {
    const initial = defaultStore();
    await writeJsonAtomic(STORE_PATH, initial);
    return initial;
  }
  return stored;
}

async function saveStore(store: NotificationStore) {
  store.updatedAt = nowIso();
  await writeJsonAtomic(STORE_PATH, store);
}

async function getPersistedVapid(): Promise<PersistedVapid> {
  const envPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const envPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const envSubject = process.env.WEB_PUSH_VAPID_SUBJECT || process.env.VAPID_SUBJECT;

  if (envPublicKey && envPrivateKey) {
    return {
      publicKey: envPublicKey,
      privateKey: envPrivateKey,
      subject: envSubject || DEFAULT_SUBJECT,
      source: "env",
    };
  }

  const stored = await readJsonFile<PersistedVapid>(VAPID_PATH);
  if (stored?.publicKey && stored.privateKey) {
    return {
      ...stored,
      subject: stored.subject || DEFAULT_SUBJECT,
      source: "file",
    };
  }

  const generated = webpush.generateVAPIDKeys();
  const nextVapid: PersistedVapid = {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
    subject: DEFAULT_SUBJECT,
    source: "file",
  };
  await writeJsonAtomic(VAPID_PATH, nextVapid);
  return nextVapid;
}

async function configureWebPush() {
  const vapid = await getPersistedVapid();
  const signature = `${vapid.subject}|${vapid.publicKey}|${vapid.privateKey}`;
  if (signature !== configuredVapidSignature) {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    configuredVapidSignature = signature;
  }
  return vapid;
}

function normalizeSubscription(
  subscription: PushSubscription,
  existing?: StoredPushSubscription,
): StoredPushSubscription {
  const timestamp = nowIso();
  return {
    ...subscription,
    id: existing?.id || randomUUID(),
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
  };
}

function normalizeOccurrence(
  input: NotificationScheduleInput,
  existing?: StoredNotificationOccurrence,
): StoredNotificationOccurrence {
  const timestamp = nowIso();
  return {
    id: input.id.trim(),
    title: input.title.trim(),
    body: String(input.body || "").trim(),
    scheduledFor: parseScheduledFor(input.scheduledFor),
    tag: String(input.tag || "").trim() || undefined,
    url: sanitizeUrl(input.url),
    icon: sanitizeUrl(input.icon),
    badge: sanitizeUrl(input.badge),
    requireInteraction: Boolean(input.requireInteraction),
    ttlSeconds: clampTtlSeconds(input.ttlSeconds),
    metadata: input.metadata,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
    sentAt: existing?.sentAt,
    lastAttemptAt: existing?.lastAttemptAt,
    lastError: existing?.lastError,
  };
}

function sortSchedule(schedule: StoredNotificationOccurrence[]) {
  schedule.sort((left, right) => {
    const leftTime = new Date(left.scheduledFor).getTime();
    const rightTime = new Date(right.scheduledFor).getTime();
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.title.localeCompare(right.title);
  });
}

export async function getNotificationPublicConfig() {
  const vapid = await configureWebPush();
  return {
    publicKey: vapid.publicKey,
    subject: vapid.subject,
    source: vapid.source,
  };
}

export async function subscribeUser(
  userId: string,
  subscription: PushSubscription,
) {
  await configureWebPush();

  return withStoreLock(async () => {
    const store = await loadStore();
    const state = getUserState(store, userId);
    const current = state.subscriptions.find(
      (entry) => entry.endpoint === subscription.endpoint,
    );
    const normalized = normalizeSubscription(subscription, current);

    if (current) {
      state.subscriptions = state.subscriptions.map((entry) =>
        entry.endpoint === normalized.endpoint ? normalized : entry,
      );
    } else {
      state.subscriptions.push(normalized);
    }

    state.updatedAt = nowIso();
    await saveStore(store);

    return {
      subscriptionCount: state.subscriptions.length,
      subscriptionId: normalized.id,
    };
  });
}

export async function unsubscribeUser(userId: string, endpoint: string) {
  return withStoreLock(async () => {
    const store = await loadStore();
    const state = getUserState(store, userId);
    const before = state.subscriptions.length;
    state.subscriptions = state.subscriptions.filter((entry) => entry.endpoint !== endpoint);
    state.updatedAt = nowIso();
    await saveStore(store);

    return {
      removed: before !== state.subscriptions.length,
      subscriptionCount: state.subscriptions.length,
    };
  });
}

export async function syncUserNotificationSchedule(
  userId: string,
  occurrences: NotificationScheduleInput[],
  options?: { replace?: boolean },
): Promise<SyncScheduleResult> {
  return withStoreLock(async () => {
    const store = await loadStore();
    const state = getUserState(store, userId);
    const existingById = new Map(state.schedule.map((entry) => [entry.id, entry]));
    const incomingById = new Map<string, StoredNotificationOccurrence>();

    for (const occurrence of occurrences) {
      const id = occurrence.id.trim();
      if (!id) continue;
      if (!occurrence.title.trim()) {
        throw new Error(`A ocorrência ${id} precisa de um título.`);
      }
      incomingById.set(id, normalizeOccurrence(occurrence, existingById.get(id)));
    }

    const insertedCount = [...incomingById.values()].filter(
      (entry) => !existingById.has(entry.id),
    ).length;
    const updatedCount = [...incomingById.values()].filter((entry) =>
      existingById.has(entry.id),
    ).length;

    const nextSchedule = options?.replace
      ? [...incomingById.values()]
      : [
          ...state.schedule.filter((entry) => !incomingById.has(entry.id)),
          ...incomingById.values(),
        ];

    const removedCount = options?.replace
      ? state.schedule.filter((entry) => !incomingById.has(entry.id)).length
      : 0;

    sortSchedule(nextSchedule);
    state.schedule = nextSchedule;
    state.sentOccurrenceIds = state.sentOccurrenceIds.filter(
      (occurrenceId) =>
        incomingById.has(occurrenceId) ||
        state.schedule.some((entry) => entry.id === occurrenceId),
    );
    trimSentOccurrences(state);
    state.updatedAt = nowIso();
    await saveStore(store);

    return {
      scheduleCount: state.schedule.length,
      insertedCount,
      updatedCount,
      removedCount,
    };
  });
}

export async function getUserNotificationStateSummary(userId: string) {
  const store = await loadStore();
  const state = getUserState(store, userId);

  return {
    subscriptionCount: state.subscriptions.length,
    scheduleCount: state.schedule.length,
    sentCount: state.sentOccurrenceIds.length,
    subscriptions: state.subscriptions.map((entry) => ({
      id: entry.id,
      endpoint: entry.endpoint,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    })),
    schedule: state.schedule.map((entry) => ({
      id: entry.id,
      title: entry.title,
      scheduledFor: entry.scheduledFor,
      sentAt: entry.sentAt,
      tag: entry.tag,
      url: entry.url,
    })),
  };
}

function isInvalidSubscriptionError(error: unknown) {
  const pushError = error as Partial<WebPushError> & { body?: string };
  const statusCode = Number(pushError?.statusCode || 0);
  const message = String(pushError?.body || pushError?.message || "").toLowerCase();

  if (statusCode === 404 || statusCode === 410) return true;
  if (statusCode === 400) {
    return (
      message.includes("invalid") ||
      message.includes("expired") ||
      message.includes("unsubscribe") ||
      message.includes("p256dh") ||
      message.includes("auth")
    );
  }

  return false;
}

async function deliverToSubscriptions(
  state: UserNotificationState,
  payload: DeliveryPayload,
  options?: { ttlSeconds?: number },
): Promise<DeliveryStats> {
  const serializedPayload = JSON.stringify(payload);
  const requestOptions: RequestOptions = {
    TTL: clampTtlSeconds(options?.ttlSeconds) ?? DEFAULT_TTL_SECONDS,
  };

  const invalidEndpoints = new Set<string>();
  const results: DeliveryStats["results"] = [];
  let attemptedCount = 0;
  let successCount = 0;
  let failureCount = 0;

  for (const subscription of state.subscriptions) {
    attemptedCount += 1;
    try {
      await webpush.sendNotification(subscription, serializedPayload, requestOptions);
      successCount += 1;
      results.push({
        endpoint: subscription.endpoint,
        ok: true,
      });
    } catch (error) {
      failureCount += 1;
      const pushError = error as Partial<WebPushError> & { body?: string };
      const statusCode = Number(pushError?.statusCode || 0) || undefined;
      const message = String(pushError?.body || pushError?.message || "Falha ao enviar.");
      if (isInvalidSubscriptionError(error)) {
        invalidEndpoints.add(subscription.endpoint);
      }
      results.push({
        endpoint: subscription.endpoint,
        ok: false,
        statusCode,
        error: message,
      });
    }
  }

  if (invalidEndpoints.size > 0) {
    state.subscriptions = state.subscriptions.filter(
      (entry) => !invalidEndpoints.has(entry.endpoint),
    );
  }

  return {
    attemptedCount,
    successCount,
    failureCount,
    invalidRemovedCount: invalidEndpoints.size,
    remainingSubscriptions: state.subscriptions.length,
    results,
  };
}

function buildOccurrencePayload(
  occurrence: StoredNotificationOccurrence,
): DeliveryPayload {
  return {
    title: occurrence.title,
    body: occurrence.body,
    tag: occurrence.tag || occurrence.id,
    url: occurrence.url,
    icon: occurrence.icon,
    badge: occurrence.badge,
    requireInteraction: occurrence.requireInteraction,
    metadata: {
      occurrenceId: occurrence.id,
      scheduledFor: occurrence.scheduledFor,
      ...occurrence.metadata,
    },
  };
}

export async function sendUserTestNotification(
  userId: string,
  payload?: Partial<DeliveryPayload>,
) {
  await configureWebPush();

  return withStoreLock(async () => {
    const store = await loadStore();
    const state = getUserState(store, userId);
    const result = await deliverToSubscriptions(
      state,
      {
        title: payload?.title?.trim() || "Praxis Protocol",
        body:
          payload?.body?.trim() ||
          "Notificação de teste enviada com sucesso para validar o canal web push.",
        tag: payload?.tag || `test-${Date.now()}`,
        url: sanitizeUrl(payload?.url),
        icon: sanitizeUrl(payload?.icon),
        badge: sanitizeUrl(payload?.badge),
        requireInteraction: Boolean(payload?.requireInteraction),
        metadata: payload?.metadata,
      },
      {},
    );

    state.updatedAt = nowIso();
    await saveStore(store);

    return result;
  });
}

export async function dispatchDueNotifications(
  options?: DispatchInternalOptions,
): Promise<DispatchNotificationsResult> {
  await configureWebPush();

  return withStoreLock(async () => {
    const store = await loadStore();
    const now = options?.now || new Date();
    const nowTime = now.getTime();
    const maxCount =
      Number.isFinite(options?.limit) && Number(options?.limit) > 0
        ? Math.max(1, Math.floor(Number(options?.limit)))
        : Number.POSITIVE_INFINITY;
    const targetUserIds = options?.userId
      ? [options.userId]
      : Object.keys(store.users);
    const requestedOccurrenceIds = new Set(options?.occurrenceIds || []);
    const dryRun = Boolean(options?.dryRun);

    const result: DispatchNotificationsResult = {
      mode: dryRun ? "dry-run" : "dispatch",
      usersProcessed: 0,
      occurrencesMatched: 0,
      occurrencesSent: 0,
      occurrencesSkipped: 0,
      invalidSubscriptionsRemoved: 0,
      remainingSubscriptions: 0,
      userSummaries: [],
    };

    let remainingGlobal = maxCount;

    for (const userId of targetUserIds) {
      if (remainingGlobal <= 0) break;
      const state = getUserState(store, userId);
      const due = state.schedule.filter((occurrence) => {
        const occurrenceTime = new Date(occurrence.scheduledFor).getTime();
        const alreadySent =
          Boolean(occurrence.sentAt) || state.sentOccurrenceIds.includes(occurrence.id);
        const explicitlyRequested =
          requestedOccurrenceIds.size === 0 || requestedOccurrenceIds.has(occurrence.id);
        return explicitlyRequested && !alreadySent && occurrenceTime <= nowTime;
      });

      sortSchedule(due);
      const batch = Number.isFinite(remainingGlobal) ? due.slice(0, remainingGlobal) : due;
      let userSentCount = 0;
      let userSkippedCount = 0;

      result.usersProcessed += 1;
      result.occurrencesMatched += batch.length;

      for (const occurrence of batch) {
        if (dryRun) {
          userSkippedCount += 1;
          result.occurrencesSkipped += 1;
          remainingGlobal -= 1;
          continue;
        }

        if (state.subscriptions.length === 0) {
          occurrence.lastAttemptAt = nowIso();
          occurrence.lastError = "Sem assinaturas ativas para este usuário.";
          userSkippedCount += 1;
          result.occurrencesSkipped += 1;
          remainingGlobal -= 1;
          continue;
        }

        const delivery = await deliverToSubscriptions(
          state,
          buildOccurrencePayload(occurrence),
          { ttlSeconds: occurrence.ttlSeconds },
        );
        result.invalidSubscriptionsRemoved += delivery.invalidRemovedCount;

        occurrence.lastAttemptAt = nowIso();
        if (delivery.successCount > 0) {
          occurrence.sentAt = nowIso();
          occurrence.lastError = undefined;
          if (!state.sentOccurrenceIds.includes(occurrence.id)) {
            state.sentOccurrenceIds.push(occurrence.id);
            trimSentOccurrences(state);
          }
          userSentCount += 1;
          result.occurrencesSent += 1;
        } else {
          occurrence.lastError =
            delivery.results.find((entry) => !entry.ok)?.error ||
            "Falha ao enviar a ocorrência.";
          userSkippedCount += 1;
          result.occurrencesSkipped += 1;
        }
        remainingGlobal -= 1;
      }

      state.updatedAt = nowIso();
      result.remainingSubscriptions += state.subscriptions.length;
      result.userSummaries.push({
        userId,
        dueCount: batch.length,
        sentCount: userSentCount,
        skippedCount: userSkippedCount,
        subscriptionCount: state.subscriptions.length,
      });
    }

    if (!dryRun) {
      await saveStore(store);
    }

    return result;
  });
}

export function assertDispatchToken(request: Request) {
  const expectedToken = process.env.NOTIFICATIONS_DISPATCH_TOKEN;
  if (!expectedToken) return false;
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  return token.length > 0 && token === expectedToken;
}
