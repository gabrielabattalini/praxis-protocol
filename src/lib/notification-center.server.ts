import fs from "node:fs";
import path from "node:path";
import webpush from "web-push";
import type { PushSubscription } from "web-push";
import type { Weekday } from "@/lib/types";
import type {
  NotificationScheduleItem,
  NotificationSyncPayload,
} from "@/lib/notification-schedule";

const dataDir = path.join(process.cwd(), ".data");
const vapidPath = path.join(dataDir, "notifications-vapid.json");
const storePath = path.join(dataDir, "notifications-store.json");

type StoredSubscription = {
  id: string;
  endpoint: string;
  expirationTime: number | null;
  keys: {
    auth: string;
    p256dh: string;
  };
  deviceLabel?: string;
  timezone?: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
};

type StoredSchedule = NotificationSyncPayload & {
  userId: string;
};

type DispatchLogEntry = {
  key: string;
  sentAt: string;
};

type NotificationStore = {
  subscriptions: Record<string, StoredSubscription[]>;
  schedules: Record<string, StoredSchedule>;
  dispatchLog: DispatchLogEntry[];
};

type DispatchSummary = {
  usersChecked: number;
  notificationsSent: number;
  invalidSubscriptionsRemoved: number;
};

type ZonedNow = {
  dateKey: string;
  weekday: Weekday;
  hourMinute: string;
  dayOfMonth: number;
};

const emptyStore = (): NotificationStore => ({
  subscriptions: {},
  schedules: {},
  dispatchLog: [],
});

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath: string, value: unknown) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function loadStore() {
  ensureDataDir();
  return readJsonFile(storePath, emptyStore());
}

function saveStore(store: NotificationStore) {
  writeJsonFile(storePath, store);
}

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function mapWeekday(value: string): Weekday {
  switch (value.toLowerCase()) {
    case "monday":
      return "monday";
    case "tuesday":
      return "tuesday";
    case "wednesday":
      return "wednesday";
    case "thursday":
      return "thursday";
    case "friday":
      return "friday";
    case "saturday":
      return "saturday";
    default:
      return "sunday";
  }
}

function getZonedNow(timezone: string, referenceDate = new Date()): ZonedNow {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "long",
    hour12: false,
  }).formatToParts(referenceDate);

  const read = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const year = read("year");
  const month = read("month");
  const day = read("day");
  const hour = read("hour");
  const minute = read("minute");

  return {
    dateKey: `${year}-${month}-${day}`,
    weekday: mapWeekday(read("weekday")),
    hourMinute: `${hour}:${minute}`,
    dayOfMonth: Number(day),
  };
}

function isNotificationItemDue(item: NotificationScheduleItem, zonedNow: ZonedNow) {
  if (!item.enabled || item.time !== zonedNow.hourMinute) {
    return false;
  }

  if (item.dayOfMonth) {
    return item.dayOfMonth === zonedNow.dayOfMonth;
  }

  if (item.intervalDays) {
    if (!item.anchorDate) return false;
    const start = new Date(`${item.anchorDate}T00:00:00`);
    const current = new Date(`${zonedNow.dateKey}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(current.getTime())) {
      return false;
    }

    const diffDays = Math.floor(
      (current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
    return diffDays >= 0 && diffDays % item.intervalDays === 0;
  }

  if (item.anchorDate && !item.weekdays?.length) {
    return item.anchorDate === zonedNow.dateKey;
  }

  if (item.weekdays?.length) {
    return item.weekdays.includes(zonedNow.weekday);
  }

  return true;
}

function dispatchKey(userId: string, itemId: string, zonedNow: ZonedNow) {
  return `${userId}:${itemId}:${zonedNow.dateKey}:${zonedNow.hourMinute}`;
}

function buildWebPushPayload(item: NotificationScheduleItem) {
  return JSON.stringify({
    title: item.title,
    body: item.body,
    url: item.route || "/tasks",
    tag: item.id,
    icon: "/logo.png",
    badge: "/logo.png",
    requireInteraction: true,
    silent: false,
    vibrate: [250, 100, 250],
  });
}

function getConfiguredVapidKeys() {
  ensureDataDir();

  const envPublic = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const envPrivate = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;

  if (envPublic && envPrivate) {
    return {
      publicKey: envPublic,
      privateKey: envPrivate,
    };
  }

  const existing = readJsonFile<{ publicKey: string; privateKey: string } | null>(
    vapidPath,
    null,
  );

  if (existing?.publicKey && existing.privateKey) {
    return existing;
  }

  const created = webpush.generateVAPIDKeys();
  writeJsonFile(vapidPath, created);
  return created;
}

function configureWebPush() {
  const keys = getConfiguredVapidKeys();
  webpush.setVapidDetails(
    process.env.WEB_PUSH_SUBJECT || "mailto:praxis@local.dev",
    keys.publicKey,
    keys.privateKey,
  );
  return keys;
}

export function getNotificationPublicKey() {
  return configureWebPush().publicKey;
}

export function getNotificationStatus(userId: string) {
  const store = loadStore();
  const subscriptions = store.subscriptions[userId] ?? [];
  const schedule = store.schedules[userId];

  return {
    subscriptions,
    deviceCount: subscriptions.length,
    lastSyncedAt: schedule?.syncedAt,
    timezone: schedule?.timezone,
    itemCount: schedule?.items.length ?? 0,
  };
}

export function syncNotificationSchedule(userId: string, payload: NotificationSyncPayload) {
  const store = loadStore();
  store.schedules[userId] = {
    ...payload,
    userId,
  };
  saveStore(store);

  return getNotificationStatus(userId);
}

export function subscribeUserToNotifications(
  userId: string,
  subscription: PushSubscription,
  options?: {
    deviceLabel?: string;
    timezone?: string;
    userAgent?: string;
  },
) {
  const store = loadStore();
  const current = store.subscriptions[userId] ?? [];
  const now = new Date().toISOString();
  const existingIndex = current.findIndex(
    (entry) => entry.endpoint === subscription.endpoint,
  );

  const nextEntry: StoredSubscription = {
    id: existingIndex >= 0 ? current[existingIndex].id : randomId("device"),
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: {
      auth: subscription.keys.auth,
      p256dh: subscription.keys.p256dh,
    },
    deviceLabel: options?.deviceLabel,
    timezone: options?.timezone,
    userAgent: options?.userAgent,
    createdAt: existingIndex >= 0 ? current[existingIndex].createdAt : now,
    updatedAt: now,
  };

  const nextSubscriptions =
    existingIndex >= 0
      ? current.map((entry, index) => (index === existingIndex ? nextEntry : entry))
      : [nextEntry, ...current];

  store.subscriptions[userId] = nextSubscriptions;
  saveStore(store);

  return getNotificationStatus(userId);
}

export function unsubscribeUserFromNotifications(userId: string, endpoint?: string) {
  const store = loadStore();
  const current = store.subscriptions[userId] ?? [];

  store.subscriptions[userId] = endpoint
    ? current.filter((entry) => entry.endpoint !== endpoint)
    : [];

  saveStore(store);
  return getNotificationStatus(userId);
}

export async function sendTestNotification(userId: string) {
  configureWebPush();
  const store = loadStore();
  const subscriptions = store.subscriptions[userId] ?? [];
  let removed = 0;
  let sent = 0;

  const nextSubscriptions: StoredSubscription[] = [];

  for (const entry of subscriptions) {
    try {
      await webpush.sendNotification(entry as PushSubscription, JSON.stringify({
        title: "Praxis Protocol",
        body: "Canal de notificações ativo neste dispositivo.",
        url: "/tasks",
        tag: "praxis-test",
        icon: "/logo.png",
        badge: "/logo.png",
        requireInteraction: true,
        silent: false,
        vibrate: [250, 100, 250],
      }));
      sent += 1;
      nextSubscriptions.push(entry);
    } catch (error) {
      const statusCode =
        typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode?: number }).statusCode)
          : 0;
      if (statusCode === 404 || statusCode === 410) {
        removed += 1;
        continue;
      }
      nextSubscriptions.push(entry);
    }
  }

  store.subscriptions[userId] = nextSubscriptions;
  saveStore(store);

  return {
    sent,
    removed,
  };
}

export async function dispatchDueNotifications(referenceDate = new Date()) {
  configureWebPush();
  const store = loadStore();
  const summary: DispatchSummary = {
    usersChecked: 0,
    notificationsSent: 0,
    invalidSubscriptionsRemoved: 0,
  };

  const dispatchLog = store.dispatchLog.filter((entry) => {
    const sentAt = new Date(entry.sentAt);
    return referenceDate.getTime() - sentAt.getTime() < 1000 * 60 * 60 * 24 * 14;
  });

  for (const [userId, schedule] of Object.entries(store.schedules)) {
    const subscriptions = store.subscriptions[userId] ?? [];
    if (!subscriptions.length) continue;

    summary.usersChecked += 1;
    const zonedNow = getZonedNow(schedule.timezone || "America/Sao_Paulo", referenceDate);
    const validSubscriptions: StoredSubscription[] = [];

    for (const item of schedule.items) {
      if (!isNotificationItemDue(item, zonedNow)) {
        continue;
      }

      const key = dispatchKey(userId, item.id, zonedNow);
      if (dispatchLog.some((entry) => entry.key === key)) {
        continue;
      }

      const payload = buildWebPushPayload(item);

      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(subscription as PushSubscription, payload);
          summary.notificationsSent += 1;
          if (!validSubscriptions.find((entry) => entry.endpoint === subscription.endpoint)) {
            validSubscriptions.push(subscription);
          }
        } catch (error) {
          const statusCode =
            typeof error === "object" && error && "statusCode" in error
              ? Number((error as { statusCode?: number }).statusCode)
              : 0;
          if (statusCode === 404 || statusCode === 410) {
            summary.invalidSubscriptionsRemoved += 1;
            continue;
          }
          if (!validSubscriptions.find((entry) => entry.endpoint === subscription.endpoint)) {
            validSubscriptions.push(subscription);
          }
        }
      }

      dispatchLog.push({
        key,
        sentAt: referenceDate.toISOString(),
      });
    }

    store.subscriptions[userId] = validSubscriptions.length
      ? validSubscriptions
      : subscriptions.filter(() => false);
  }

  store.dispatchLog = dispatchLog;
  saveStore(store);

  return summary;
}
