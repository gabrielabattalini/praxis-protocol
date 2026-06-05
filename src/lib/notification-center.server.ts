import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import webpush from "web-push";
import type { PushSubscription } from "web-push";
import type { Weekday } from "@/lib/types";
import type {
  NotificationScheduleItem,
  NotificationSyncPayload,
} from "@/lib/notification-schedule";
import { sendTelegramToUser } from "@/lib/telegram-center.server";
import { getLoadingCuePool } from "@/lib/discipline-cues";

const dataDir = path.join(process.cwd(), ".data");
const vapidPath = path.join(dataDir, "notifications-vapid.json");
const storePath = path.join(dataDir, "notifications-store.json");

/* ── KV (Upstash / Vercel KV) ─────────────────────────────────────
   File-backed storage doesn't survive cold starts on Vercel — the
   `.data` dir is ephemeral per instance. When KV creds are present
   we persist subscriptions, schedules and the dispatch log there;
   otherwise we fall back to disk for local development.
   ──────────────────────────────────────────────────────────────── */

const KV_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const KV_ENABLED = Boolean(KV_URL && KV_TOKEN);
const KV_STORE_KEY = "praxis:notif:store";

async function kvCommand<T = unknown>(
  command: Array<string | number>,
): Promise<T | null> {
  try {
    const response = await fetch(KV_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(
        `[notifications] KV command failed: ${response.status} ${response.statusText}`,
      );
      return null;
    }
    const payload = (await response.json()) as { result?: T };
    return payload.result ?? null;
  } catch (error) {
    console.error("[notifications] KV command error:", error);
    return null;
  }
}

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

type SnoozedItem = {
  // ID arbitrário recebido do SW (geralmente o id do schedule item).
  itemId: string;
  // ISO timestamp em que o re-disparo deve sair.
  fireAt: string;
  title?: string;
  body?: string;
};

type NotificationStore = {
  subscriptions: Record<string, StoredSubscription[]>;
  schedules: Record<string, StoredSchedule>;
  dispatchLog: DispatchLogEntry[];
  // Adiamentos por usuário. Chave = userId. O dispatch processa snoozes
  // vencidas (fireAt <= now), emite a notificação e remove a entrada.
  snoozes?: Record<string, SnoozedItem[]>;
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

async function loadStore(): Promise<NotificationStore> {
  if (KV_ENABLED) {
    const raw = await kvCommand<string>(["GET", KV_STORE_KEY]);
    if (!raw) return emptyStore();
    try {
      const parsed = JSON.parse(raw) as NotificationStore;
      return {
        subscriptions: parsed.subscriptions ?? {},
        schedules: parsed.schedules ?? {},
        dispatchLog: parsed.dispatchLog ?? [],
        // snoozes precisa ser preservado — sem isto toda leitura do KV
        // dropava o campo e o save seguinte apagava as snoozes de TODOS
        // os usuários (o "Adiar 15min" do push nunca re-disparava).
        snoozes: parsed.snoozes ?? {},
      };
    } catch {
      return emptyStore();
    }
  }
  ensureDataDir();
  return readJsonFile(storePath, emptyStore());
}

async function saveStore(store: NotificationStore): Promise<void> {
  if (KV_ENABLED) {
    await kvCommand(["SET", KV_STORE_KEY, JSON.stringify(store)]);
    return;
  }
  writeJsonFile(storePath, store);
}

function randomId(prefix: string) {
  // CSPRNG em vez de Math.random — IDs de subscription não são segredo,
  // mas evita colisões e mantém consistência com telegram-center.
  return `${prefix}-${crypto.randomBytes(8).toString("hex")}`;
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

// Mesma janela usada em notification-schedule.ts pra construir os ids
// "<base>:pre5". Mudou lá, mude aqui.
const PRE_WARNING_MIN = 5;

// Janela em minutos: depois do horário marcado, ainda consideramos o item
// "due" por até DISPATCH_WINDOW_MIN. Cobre delays normais de cron (1 min)
// + cold start, sem despejar tarefas de horas atrás quando o cron fica
// fora por um tempo. Combinado com dispatchKey por dia, garante 1 disparo
// por (user, item, dia) mesmo se o cron rodar várias vezes na janela.
const DISPATCH_WINDOW_MIN = 15;

// Seleção determinística por seed — mesma frase pro mesmo (user, dia,
// horário), variando entre disparos. Evita repetir sempre a primeira.
function pickBySeed<T>(items: readonly T[], seed: string): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return items[hash % items.length];
}

/**
 * Codifica callback_data pro botão "✓ Concluir" do Telegram. Limite é
 * 64 bytes total — id de meal block + item pode estourar. Retorna null
 * quando não conseguimos codificar (caller esconde o botão).
 *
 * Usa os campos entityType/entityId do schedule item (não parseia a
 * string do id). O id de reminder é "reminder:<type>:<entityId>:<HH>:<MM>"
 * — o time tem ":" no meio, então parsear a string deixava o "HH" grudado
 * no entityId e o callback vinha errado (ex.: "t:meal-intra:21").
 *
 *  - task                → callback "t:<entityId>"
 *  - meal / supplement   → callback "mb:<entityId>"
 *  - workout / cardio    → sem botão (sem action mapeada)
 */
function buildCompleteCallbackData(
  item: NotificationScheduleItem,
): string | null {
  // Fallback pros ids de task/meal "puros" (sem campos entityType/Id),
  // caso algum schedule item antigo não os traga.
  const entityType =
    item.entityType ??
    (item.id.startsWith("task:")
      ? "task"
      : item.id.startsWith("meal:")
        ? "meal"
        : undefined);
  const entityId =
    item.entityId ??
    (item.id.startsWith("task:")
      ? item.id.slice("task:".length)
      : item.id.startsWith("meal:")
        ? item.id.slice("meal:".length)
        : undefined);

  if (!entityType || !entityId) return null;

  if (entityType === "task") {
    const cb = `t:${entityId}`;
    return cb.length <= 64 ? cb : null;
  }
  if (entityType === "meal" || entityType === "supplement") {
    const cb = `mb:${entityId}`;
    return cb.length <= 64 ? cb : null;
  }
  if (entityType === "workout") {
    // wd: = workout day completion. Marca o dia inteiro como concluído
    // (mesma entrada que toggleWorkoutDayCompleted gera no app).
    const cb = `wd:${entityId}`;
    return cb.length <= 64 ? cb : null;
  }
  // cardio: ainda sem ação dedicada — o reminder de cardio sempre vem
  // como entityType="task" no usuário típico (cardio-target-* é Task),
  // então o caminho "task" já cobre. Reservado pra futuro.
  return null;
}

function minutesOfDay(hourMinute: string) {
  const [h, m] = hourMinute.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return Number.NaN;
  return h * 60 + m;
}

function isNotificationItemDue(item: NotificationScheduleItem, zonedNow: ZonedNow) {
  if (!item.enabled) return false;

  // Item dispara assim que zonedNow >= item.time, mas só por DISPATCH_WINDOW_MIN
  // minutos depois (pra não disparar uma tarefa de 8h às 23h só porque o cron
  // ficou fora ao longo do dia).
  const itemMins = minutesOfDay(item.time);
  const nowMins = minutesOfDay(zonedNow.hourMinute);
  if (!Number.isFinite(itemMins) || !Number.isFinite(nowMins)) return false;
  const diff = nowMins - itemMins;
  if (diff < 0 || diff > DISPATCH_WINDOW_MIN) return false;

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

// Dedup por (user, item, dia) — não por minuto. Antes a chave incluía
// hourMinute atual, então cada chamada do cron criava uma key nova e a
// mesma notificação podia ir várias vezes dentro da janela de 60 min.
function dispatchKey(userId: string, itemId: string, zonedNow: ZonedNow) {
  return `${userId}:${itemId}:${zonedNow.dateKey}`;
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
  // Env keys first — must work WITHOUT touching the filesystem, because
  // Vercel's serverless fs is read-only and ensureDataDir() would throw.
  const envPublic = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const envPrivate = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;

  if (envPublic && envPrivate) {
    return {
      publicKey: envPublic,
      privateKey: envPrivate,
    };
  }

  // Em produção exigimos as env vars — gerar e gravar a chave PRIVADA do
  // VAPID em disco (.data/) num ambiente serverless é vazamento de
  // material criptográfico (fs efêmero + legível dentro do container).
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[notifications] WEB_PUSH_VAPID_PUBLIC_KEY/PRIVATE_KEY ausentes em produção",
    );
  }

  // File fallback (local dev only) — now safe to touch the data dir.
  ensureDataDir();

  const existing = readJsonFile<{ publicKey: string; privateKey: string } | null>(
    vapidPath,
    null,
  );

  if (existing?.publicKey && existing.privateKey) {
    return existing;
  }

  const created = webpush.generateVAPIDKeys();
  // Só dev (em prod a chave vem de env). Grava com permissão restrita
  // (0o600 = só o dono lê/escreve) pra não deixar a chave privada VAPID
  // legível em ambientes de dev compartilhados (CI, dev container).
  ensureDataDir();
  fs.writeFileSync(vapidPath, JSON.stringify(created, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
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

function statusFromStore(store: NotificationStore, userId: string) {
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

export async function getNotificationStatus(userId: string) {
  const store = await loadStore();
  return statusFromStore(store, userId);
}

/**
 * Timezone que o app sincronizou pro usuário (vem do sync de notificações).
 * Usado pelas ações do Telegram pra computar "hoje" no fuso do usuário —
 * o webhook roda em UTC e, sem isso, à noite no Brasil "hoje" já teria
 * virado pro dia seguinte e a conclusão cairia na data errada.
 */
export async function getUserTimezone(userId: string): Promise<string> {
  const store = await loadStore();
  return store.schedules[userId]?.timezone || "America/Sao_Paulo";
}

/**
 * Snapshot do schedule armazenado pra o usuário — usado pelo endpoint
 * de debug. Mostra exatamente o que o cron itera pra disparar.
 */
export async function getNotificationScheduleSnapshot(userId: string) {
  const store = await loadStore();
  return store.schedules[userId] ?? null;
}

export async function syncNotificationSchedule(
  userId: string,
  payload: NotificationSyncPayload,
) {
  const store = await loadStore();
  store.schedules[userId] = {
    ...payload,
    userId,
  };
  await saveStore(store);
  return statusFromStore(store, userId);
}

export async function snoozeNotification(
  userId: string,
  payload: { itemId: string; minutes: number; title?: string; body?: string },
) {
  const store = await loadStore();
  const minutes = Math.max(1, Math.min(180, Math.round(payload.minutes)));
  const fireAt = new Date(Date.now() + minutes * 60_000).toISOString();
  const snoozes = store.snoozes ?? {};
  const list = snoozes[userId] ?? [];
  // Substitui qualquer snooze anterior pra mesmo item — usuário clicou
  // "Adiar 15min" duas vezes seguidas, queremos que o último valha.
  const remaining = list.filter((entry) => entry.itemId !== payload.itemId);
  remaining.push({
    itemId: payload.itemId,
    fireAt,
    title: payload.title?.slice(0, 200),
    body: payload.body?.slice(0, 500),
  });
  snoozes[userId] = remaining;
  store.snoozes = snoozes;
  await saveStore(store);
  return { fireAt };
}

export async function subscribeUserToNotifications(
  userId: string,
  subscription: PushSubscription,
  options?: {
    deviceLabel?: string;
    timezone?: string;
    userAgent?: string;
  },
) {
  const store = await loadStore();
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
  await saveStore(store);
  return statusFromStore(store, userId);
}

export async function unsubscribeUserFromNotifications(
  userId: string,
  endpoint?: string,
) {
  const store = await loadStore();
  const current = store.subscriptions[userId] ?? [];

  store.subscriptions[userId] = endpoint
    ? current.filter((entry) => entry.endpoint !== endpoint)
    : [];

  await saveStore(store);
  return statusFromStore(store, userId);
}

/**
 * Envia uma notificação push customizada pra todos os endpoints
 * registrados de um usuário. Limpa subscriptions inválidas
 * (404/410 = Endpoint expirado) automaticamente. Mesmo padrão do
 * sendTestNotification — extraído pra reuso (relatório semanal etc).
 */
export async function sendCustomPushNotification(
  userId: string,
  payload: {
    title: string;
    body: string;
    url?: string;
    tag?: string;
    requireInteraction?: boolean;
  },
): Promise<{ sent: number; removed: number; subscriptions: number }> {
  configureWebPush();
  const store = await loadStore();
  const subscriptions = store.subscriptions[userId] ?? [];
  let removed = 0;
  let sent = 0;

  const nextSubscriptions: StoredSubscription[] = [];

  for (const entry of subscriptions) {
    try {
      await webpush.sendNotification(
        entry as PushSubscription,
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          url: payload.url ?? "/tasks",
          tag: payload.tag ?? "praxis-custom",
          icon: "/logo.png",
          badge: "/logo.png",
          requireInteraction: payload.requireInteraction ?? true,
          silent: false,
          vibrate: [250, 100, 250],
        }),
      );
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
  await saveStore(store);

  return { sent, removed, subscriptions: nextSubscriptions.length };
}

/**
 * Lista todos os userIds com schedule de notificação registrado
 * (proxy razoável pra "usuários ativos no app"). Usado pelo cron
 * semanal pra iterar quem recebe o relatório.
 */
export async function listUsersWithNotificationSchedule(): Promise<string[]> {
  const store = await loadStore();
  return Object.keys(store.schedules);
}

export async function sendTestNotification(userId: string) {
  configureWebPush();
  const store = await loadStore();
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
  await saveStore(store);

  return {
    sent,
    removed,
  };
}

export async function dispatchDueNotifications(referenceDate = new Date()) {
  // VAPID config pode lançar se as chaves estiverem malformadas/ausentes.
  // Isso NÃO pode derrubar o dispatch inteiro — senão o canal Telegram
  // (que não depende de VAPID) também para, e o endpoint retorna 500
  // (página HTML grande que estoura crons externos como cron-job.org).
  let webPushReady = false;
  try {
    configureWebPush();
    webPushReady = true;
  } catch (error) {
    console.error(
      "[dispatch] web push desabilitado (VAPID inválido/ausente):",
      error instanceof Error ? error.message : error,
    );
  }

  const store = await loadStore();
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
    // No early-skip when there are no web-push subscriptions: a user may
    // have ONLY Telegram linked and must still receive scheduled alerts.
    const subscriptions = store.subscriptions[userId] ?? [];

    summary.usersChecked += 1;
    const zonedNow = getZonedNow(schedule.timezone || "America/Sao_Paulo", referenceDate);
    const validSubscriptions: StoredSubscription[] = [];
    // Só poda assinaturas mortas quando houve PELO MENOS uma tentativa
    // de envio neste run. Sem isto, um run sem nenhum item due (caso
    // comum no cron 04:00 UTC) zerava validSubscriptions e apagava todas
    // as assinaturas do usuário.
    let attemptedAnyPush = false;
    // Coleta items que disparam neste run pra mandar UMA mensagem só
    // no Telegram (web push continua individual — mobile precisa de
    // notificações separadas pra agrupar/expand no system tray).
    const telegramBatch: NotificationScheduleItem[] = [];

    for (const item of schedule.items) {
      if (!isNotificationItemDue(item, zonedNow)) {
        continue;
      }

      const key = dispatchKey(userId, item.id, zonedNow);
      if (dispatchLog.some((entry) => entry.key === key)) {
        continue;
      }

      const payload = buildWebPushPayload(item);

      // Só tenta web push quando o VAPID configurou OK. Quando não, nem
      // entra no loop — assim validSubscriptions não fica vazio à toa e
      // não disparamos a poda destrutiva lá embaixo.
      if (webPushReady) {
        attemptedAnyPush = true;
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
      }

      telegramBatch.push(item);

      dispatchLog.push({
        key,
        sentAt: referenceDate.toISOString(),
      });
    }

    // Envia UMA mensagem Telegram POR item que disparou — cada uma com
    // seu próprio botão "✓ Concluir". Antes mandava tudo agrupado numa
    // mensagem só, e o botão só aparecia quando havia exatamente 1 item;
    // com 2+ no mesmo horário o usuário ficava sem como concluir.
    if (telegramBatch.length > 0) {
      // Dedup por (título + horário): tarefas/lembretes idênticos (ex.:
      // cardio duplicado no schedule) não viram 2 mensagens.
      const seen = new Set<string>();
      const uniqueItems = telegramBatch.filter((entry) => {
        const baseTitle = entry.title
          .replace(/^⏰ Em \d+ min: /, "")
          .replace(/^🔔 /, "");
        const dedupKey = `${entry.time}|${baseTitle.trim().toLowerCase()}`;
        if (seen.has(dedupKey)) return false;
        seen.add(dedupKey);
        return true;
      });

      // Frase motivacional vai só na ÚLTIMA mensagem do lote, pra não
      // repetir a mesma citação em cada item.
      const hiddenSet = new Set(schedule.hiddenQuotes ?? []);
      const quotePool = [
        ...getLoadingCuePool()
          .filter((cue) => !hiddenSet.has(cue.text))
          .map((cue) => `${cue.text} — ${cue.eyebrow}`),
        ...(schedule.customQuotes ?? []),
      ];
      const quote =
        quotePool.length > 0
          ? pickBySeed(
              quotePool,
              `${userId}|${zonedNow.dateKey}|${zonedNow.hourMinute}`,
            )
          : "";

      for (let index = 0; index < uniqueItems.length; index += 1) {
        const entry = uniqueItems[index];
        const isPreWarning = entry.id.endsWith(`:pre${PRE_WARNING_MIN}`);
        const baseTitle = entry.title
          .replace(/^⏰ Em \d+ min: /, "")
          .replace(/^🔔 /, "");
        const prefix = isPreWarning ? "⏰" : "🔔";
        const inMin = isPreWarning ? ` (em ${PRE_WARNING_MIN}min)` : "";
        const headerLine = `${prefix} ${entry.time} ${baseTitle}${inMin}`;

        const isLast = index === uniqueItems.length - 1;
        const message = isLast && quote ? `${headerLine}\n\n${quote}` : headerLine;

        // Botão "✓ Concluir" por item — exceto em pre-warning (marcar
        // como feito 5min antes do horário é esquisito).
        let inlineKeyboard;
        if (!isPreWarning) {
          const cbData = buildCompleteCallbackData(entry);
          if (cbData) {
            inlineKeyboard = [[{ text: "✓ Concluir", callback_data: cbData }]];
          }
        }

        try {
          const tg = await sendTelegramToUser(userId, message, {
            inlineKeyboard,
          });
          if (tg.ok && !tg.skipped) {
            summary.notificationsSent += 1;
          }
        } catch {
          /* swallow — Telegram is a best-effort secondary channel */
        }
      }
    }

    // Só reescreve (poda assinaturas mortas 404/410) quando o web push
    // realmente rodou. Se o VAPID estava off, preservamos as assinaturas
    // como estavam — senão um erro transitório de config apagaria todos
    // os dispositivos push do usuário.
    if (webPushReady && attemptedAnyPush) {
      store.subscriptions[userId] = validSubscriptions;
    }
  }

  // Processa snoozes vencidas — reenvia push + Telegram para cada uma e
  // remove a entrada. Não passa pelo isNotificationItemDue (já passou da
  // hora original; queremos disparar AGORA).
  const allSnoozes = store.snoozes ?? {};
  const nowMs = referenceDate.getTime();
  for (const [userId, list] of Object.entries(allSnoozes)) {
    const due = list.filter((entry) => new Date(entry.fireAt).getTime() <= nowMs);
    if (due.length === 0) continue;

    const subscriptions = store.subscriptions[userId] ?? [];
    for (const entry of due) {
      const title = entry.title || "Lembrete adiado";
      const body = entry.body || "Você adiou esse lembrete.";

      // Web push
      if (webPushReady) {
        const payload = JSON.stringify({
          title,
          body,
          url: "/tasks",
          tag: `${entry.itemId}:snoozed`,
          icon: "/logo.png",
          badge: "/logo.png",
          requireInteraction: true,
          silent: false,
          vibrate: [250, 100, 250],
        });
        for (const subscription of subscriptions) {
          try {
            await webpush.sendNotification(subscription as PushSubscription, payload);
            summary.notificationsSent += 1;
          } catch {
            /* swallow */
          }
        }
      }

      // Telegram
      try {
        const tg = await sendTelegramToUser(userId, `🔔 ${title}\n${body}`);
        if (tg.ok && !tg.skipped) {
          summary.notificationsSent += 1;
        }
      } catch {
        /* swallow */
      }
    }

    // Remove os disparados, mantém os ainda futuros.
    allSnoozes[userId] = list.filter(
      (entry) => new Date(entry.fireAt).getTime() > nowMs,
    );
  }
  store.snoozes = allSnoozes;

  store.dispatchLog = dispatchLog;
  await saveStore(store);

  return summary;
}
