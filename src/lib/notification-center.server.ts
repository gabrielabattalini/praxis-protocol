import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import webpush from "web-push";
import type { PushSubscription } from "web-push";
import type { PersistedState, Weekday } from "@/lib/types";
import type {
  NotificationScheduleItem,
  NotificationSyncPayload,
} from "@/lib/notification-schedule";
import { isScheduleItemEntityAlive } from "@/lib/notification-schedule";
import {
  deleteTelegramMessage,
  sendTelegramToUser,
} from "@/lib/telegram-center.server";
import { getLoadingCuePool } from "@/lib/discipline-cues";
import { getAccountState } from "@/lib/account-state.server";

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

// Mensagem de PRÉ-AVISO ("⏰ Em N min") enviada ao Telegram. Guardamos o
// message_id pra apagá-la do chat quando a notificação da hora sair —
// pedido do usuário pra não poluir o chat.
type PrewarnMessage = {
  // id do schedule item SEM o sufixo :preN (= id do item da hora).
  baseId: string;
  chatId: number;
  messageId: number;
  sentAt: string;
};

type NotificationStore = {
  subscriptions: Record<string, StoredSubscription[]>;
  schedules: Record<string, StoredSchedule>;
  dispatchLog: DispatchLogEntry[];
  // Adiamentos por usuário. Chave = userId. O dispatch processa snoozes
  // vencidas (fireAt <= now), emite a notificação e remove a entrada.
  snoozes?: Record<string, SnoozedItem[]>;
  // Pré-avisos pendentes de exclusão por usuário (modo arquivo/dev).
  prewarnMessages?: Record<string, PrewarnMessage[]>;
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
        prewarnMessages: parsed.prewarnMessages ?? {},
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

/* ─────────────────────────────────────────────────────────────────
   Storage POR USUÁRIO (multi-tenant).

   Antes TODO o estado (todos os usuários: subscriptions, schedules,
   dispatchLog, snoozes) vivia numa key Redis única (`praxis:notif:store`).
   Isso causava last-write-wins entre usuários: dois requests paralelos
   (cron + um subscribe; snooze do user A + sync do user B) se
   sobrescreviam, apagando dados de quem não estava envolvido na request.

   Agora cada usuário tem suas próprias keys + um índice (SET Redis) com
   quem o dispatch precisa checar. Writes de um usuário não tocam os
   outros. dispatchLog continua numa key separada (só o cron escreve).

   Migração lazy: na primeira chamada com KV, copia o store monolítico
   legado pras keys por-usuário (idempotente, mantém a key antiga pra
   rollback). Modo arquivo (dev) segue usando o JSON único.
   ───────────────────────────────────────────────────────────────── */

const userSubsKey = (userId: string) => `praxis:notif:u:${userId}:subs`;
const userSchedKey = (userId: string) => `praxis:notif:u:${userId}:sched`;
const userSnoozeKey = (userId: string) => `praxis:notif:u:${userId}:snooze`;
const userPrewarnKey = (userId: string) => `praxis:notif:u:${userId}:prewarn`;

// Caps anti-bloat por usuário (auditoria de segurança).
const MAX_SUBSCRIPTIONS_PER_USER = 20;
const MAX_SNOOZES_PER_USER = 100;
const USER_INDEX_KEY = "praxis:notif:userindex";
const DISPATCH_LOG_KEY = "praxis:notif:dispatchlog";
const MIGRATED_FLAG_KEY = "praxis:notif:migrated-v2";

async function kvGetJson<T>(key: string): Promise<T | null> {
  const raw = await kvCommand<string>(["GET", key]);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function kvSetJson(key: string, value: unknown): Promise<void> {
  await kvCommand(["SET", key, JSON.stringify(value)]);
}

async function kvSadd(setKey: string, member: string): Promise<void> {
  await kvCommand(["SADD", setKey, member]);
}

async function kvSmembers(setKey: string): Promise<string[]> {
  const result = await kvCommand<string[]>(["SMEMBERS", setKey]);
  return Array.isArray(result) ? result : [];
}

// Migração roda uma vez por instância serverless quente (cache de módulo)
// + flag durável no KV pra não repetir entre instâncias.
let migratedThisInstance = false;

async function ensureMigratedKv(): Promise<void> {
  if (!KV_ENABLED || migratedThisInstance) return;
  const flag = await kvCommand<string>(["GET", MIGRATED_FLAG_KEY]);
  if (flag === "1") {
    migratedThisInstance = true;
    return;
  }
  const legacyRaw = await kvCommand<string>(["GET", KV_STORE_KEY]);
  if (legacyRaw) {
    try {
      const legacy = JSON.parse(legacyRaw) as NotificationStore;
      for (const [uid, subs] of Object.entries(legacy.subscriptions ?? {})) {
        if (Array.isArray(subs) && subs.length) {
          await kvSetJson(userSubsKey(uid), subs);
        }
      }
      for (const [uid, sched] of Object.entries(legacy.schedules ?? {})) {
        await kvSetJson(userSchedKey(uid), sched);
        await kvSadd(USER_INDEX_KEY, uid);
      }
      for (const [uid, list] of Object.entries(legacy.snoozes ?? {})) {
        if (Array.isArray(list) && list.length) {
          await kvSetJson(userSnoozeKey(uid), list);
          await kvSadd(USER_INDEX_KEY, uid);
        }
      }
      if (Array.isArray(legacy.dispatchLog) && legacy.dispatchLog.length) {
        await kvSetJson(DISPATCH_LOG_KEY, legacy.dispatchLog);
      }
    } catch (error) {
      // Não seta a flag → próxima chamada re-tenta. Migração é
      // idempotente (SET/SADD com os mesmos valores).
      console.error("[notifications] migração para per-user falhou:", error);
      return;
    }
  }
  await kvCommand(["SET", MIGRATED_FLAG_KEY, "1"]);
  migratedThisInstance = true;
}

/* ── Acessores por-usuário (KV per-key OU arquivo único no dev) ──── */

async function loadUserSubs(userId: string): Promise<StoredSubscription[]> {
  if (KV_ENABLED) {
    await ensureMigratedKv();
    return (await kvGetJson<StoredSubscription[]>(userSubsKey(userId))) ?? [];
  }
  const store = await loadStore();
  return store.subscriptions[userId] ?? [];
}

async function saveUserSubs(
  userId: string,
  subs: StoredSubscription[],
): Promise<void> {
  if (KV_ENABLED) {
    await kvSetJson(userSubsKey(userId), subs);
    return;
  }
  const store = await loadStore();
  store.subscriptions[userId] = subs;
  await saveStore(store);
}

async function loadUserSchedule(
  userId: string,
): Promise<StoredSchedule | null> {
  if (KV_ENABLED) {
    await ensureMigratedKv();
    return await kvGetJson<StoredSchedule>(userSchedKey(userId));
  }
  const store = await loadStore();
  return store.schedules[userId] ?? null;
}

async function saveUserSchedule(
  userId: string,
  schedule: StoredSchedule,
): Promise<void> {
  if (KV_ENABLED) {
    await kvSetJson(userSchedKey(userId), schedule);
    await kvSadd(USER_INDEX_KEY, userId);
    return;
  }
  const store = await loadStore();
  store.schedules[userId] = schedule;
  await saveStore(store);
}

async function loadUserSnoozes(userId: string): Promise<SnoozedItem[]> {
  if (KV_ENABLED) {
    await ensureMigratedKv();
    return (await kvGetJson<SnoozedItem[]>(userSnoozeKey(userId))) ?? [];
  }
  const store = await loadStore();
  return (store.snoozes ?? {})[userId] ?? [];
}

async function saveUserSnoozes(
  userId: string,
  snoozes: SnoozedItem[],
): Promise<void> {
  if (KV_ENABLED) {
    await kvSetJson(userSnoozeKey(userId), snoozes);
    if (snoozes.length) await kvSadd(USER_INDEX_KEY, userId);
    return;
  }
  const store = await loadStore();
  const map = store.snoozes ?? {};
  map[userId] = snoozes;
  store.snoozes = map;
  await saveStore(store);
}

async function loadUserPrewarnMessages(
  userId: string,
): Promise<PrewarnMessage[]> {
  if (KV_ENABLED) {
    await ensureMigratedKv();
    return (await kvGetJson<PrewarnMessage[]>(userPrewarnKey(userId))) ?? [];
  }
  const store = await loadStore();
  return (store.prewarnMessages ?? {})[userId] ?? [];
}

async function saveUserPrewarnMessages(
  userId: string,
  messages: PrewarnMessage[],
): Promise<void> {
  if (KV_ENABLED) {
    await kvSetJson(userPrewarnKey(userId), messages);
    return;
  }
  const store = await loadStore();
  const map = store.prewarnMessages ?? {};
  map[userId] = messages;
  store.prewarnMessages = map;
  await saveStore(store);
}

// userIds que o dispatch precisa checar (têm schedule ou snooze).
async function listIndexedUserIds(): Promise<string[]> {
  if (KV_ENABLED) {
    await ensureMigratedKv();
    return await kvSmembers(USER_INDEX_KEY);
  }
  const store = await loadStore();
  return Array.from(
    new Set([
      ...Object.keys(store.schedules),
      ...Object.keys(store.snoozes ?? {}),
    ]),
  );
}

async function loadDispatchLog(): Promise<DispatchLogEntry[]> {
  if (KV_ENABLED) {
    await ensureMigratedKv();
    return (await kvGetJson<DispatchLogEntry[]>(DISPATCH_LOG_KEY)) ?? [];
  }
  const store = await loadStore();
  return store.dispatchLog;
}

async function saveDispatchLog(log: DispatchLogEntry[]): Promise<void> {
  if (KV_ENABLED) {
    await kvSetJson(DISPATCH_LOG_KEY, log);
    return;
  }
  const store = await loadStore();
  store.dispatchLog = log;
  await saveStore(store);
}

function buildNotificationStatus(
  subscriptions: StoredSubscription[],
  schedule: StoredSchedule | null,
) {
  return {
    subscriptions,
    deviceCount: subscriptions.length,
    lastSyncedAt: schedule?.syncedAt,
    timezone: schedule?.timezone,
    itemCount: schedule?.items.length ?? 0,
  };
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

// O sufixo do pré-aviso agora é ":pre<N>" com N configurável pelo
// usuário (notificationPreWarnMinutes) — o dispatch detecta via regex
// /:pre(\d+)$/, então não há mais constante fixa aqui.

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

// Minutos do botão "Adiar" do Telegram. 10min a pedido do usuário.
export const TELEGRAM_SNOOZE_MINUTES = 10;

/**
 * callback_data do botão "⏰ Adiar 10min". Carrega o id do schedule item
 * (sz:<itemId>) pra que o processUserSnoozes consiga cruzar com o
 * snapshot do schedule (título limpo + botão Concluir no re-disparo, e
 * o filtro de órfã). Limite do Telegram é 64 bytes — se estourar,
 * retorna null e o caller esconde o botão.
 */
function buildSnoozeCallbackData(item: NotificationScheduleItem): string | null {
  if (!item.id) return null;
  const cb = `sz:${item.id}`;
  return Buffer.byteLength(cb, "utf8") <= 64 ? cb : null;
}

// Remove o prefixo "⏰ Em N min: " de um título de pre-warning, pra que
// o re-disparo de um snooze use o nome limpo da tarefa.
function stripPreWarnPrefix(title: string): string {
  return title.replace(/^⏰ Em \d+ min: /, "").trim();
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

export async function getNotificationStatus(userId: string) {
  const [subscriptions, schedule] = await Promise.all([
    loadUserSubs(userId),
    loadUserSchedule(userId),
  ]);
  return buildNotificationStatus(subscriptions, schedule);
}

/**
 * Timezone que o app sincronizou pro usuário (vem do sync de notificações).
 * Usado pelas ações do Telegram pra computar "hoje" no fuso do usuário —
 * o webhook roda em UTC e, sem isso, à noite no Brasil "hoje" já teria
 * virado pro dia seguinte e a conclusão cairia na data errada.
 */
export async function getUserTimezone(userId: string): Promise<string> {
  const schedule = await loadUserSchedule(userId);
  return schedule?.timezone || "America/Sao_Paulo";
}

/**
 * Snapshot do schedule armazenado pra o usuário — usado pelo endpoint
 * de debug. Mostra exatamente o que o cron itera pra disparar.
 */
export async function getNotificationScheduleSnapshot(userId: string) {
  return await loadUserSchedule(userId);
}

export async function syncNotificationSchedule(
  userId: string,
  payload: NotificationSyncPayload,
) {
  const schedule: StoredSchedule = { ...payload, userId };
  await saveUserSchedule(userId, schedule);
  const subscriptions = await loadUserSubs(userId);
  return buildNotificationStatus(subscriptions, schedule);
}

export async function snoozeNotification(
  userId: string,
  payload: { itemId: string; minutes: number; title?: string; body?: string },
) {
  const minutes = Math.max(1, Math.min(180, Math.round(payload.minutes)));
  const fireAt = new Date(Date.now() + minutes * 60_000).toISOString();
  const list = await loadUserSnoozes(userId);
  // Substitui qualquer snooze anterior pra mesmo item — usuário clicou
  // "Adiar 15min" duas vezes seguidas, queremos que o último valha.
  const remaining = list.filter((entry) => entry.itemId !== payload.itemId);
  remaining.push({
    itemId: payload.itemId,
    fireAt,
    title: payload.title?.slice(0, 200),
    body: payload.body?.slice(0, 500),
  });
  // Cap de snoozes por usuário: itemId é controlado pelo cliente, então
  // sem limite a lista crescia sem teto (bloat de KV + dispatch O(N) por
  // minuto). Mantém os mais recentes.
  const capped = remaining.slice(-MAX_SNOOZES_PER_USER);
  await saveUserSnoozes(userId, capped);
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
  const current = await loadUserSubs(userId);
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

  const nextSubscriptions = (
    existingIndex >= 0
      ? current.map((entry, index) => (index === existingIndex ? nextEntry : entry))
      : [nextEntry, ...current]
  )
    // Cap de dispositivos por usuário: cada endpoint distinto cresce a
    // lista (subscribe não tinha limite → bloat de KV + loop de envio
    // mais caro). Mantém os 20 mais recentes (nextEntry vai pra frente).
    .slice(0, MAX_SUBSCRIPTIONS_PER_USER);

  await saveUserSubs(userId, nextSubscriptions);
  const schedule = await loadUserSchedule(userId);
  return buildNotificationStatus(nextSubscriptions, schedule);
}

export async function unsubscribeUserFromNotifications(
  userId: string,
  endpoint?: string,
) {
  const current = await loadUserSubs(userId);
  const nextSubscriptions = endpoint
    ? current.filter((entry) => entry.endpoint !== endpoint)
    : [];
  await saveUserSubs(userId, nextSubscriptions);
  const schedule = await loadUserSchedule(userId);
  return buildNotificationStatus(nextSubscriptions, schedule);
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
  const subscriptions = await loadUserSubs(userId);
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

  await saveUserSubs(userId, nextSubscriptions);

  return { sent, removed, subscriptions: nextSubscriptions.length };
}

/**
 * Lista todos os userIds com schedule de notificação registrado
 * (proxy razoável pra "usuários ativos no app"). Usado pelo cron
 * semanal pra iterar quem recebe o relatório.
 */
export async function listUsersWithNotificationSchedule(): Promise<string[]> {
  return await listIndexedUserIds();
}

export async function sendTestNotification(userId: string) {
  configureWebPush();
  const subscriptions = await loadUserSubs(userId);
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

  await saveUserSubs(userId, nextSubscriptions);

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

  if (KV_ENABLED) await ensureMigratedKv();

  const summary: DispatchSummary = {
    usersChecked: 0,
    notificationsSent: 0,
    invalidSubscriptionsRemoved: 0,
  };

  // dispatchLog vive numa key separada e só o cron escreve nela — sem
  // corrida com mutações de usuário (subscribe/sync/snooze tocam só keys
  // por-usuário). Limpa por janela (14 dias) e por capacidade (cap).
  const DISPATCH_LOG_MAX_ENTRIES = 5000;
  const cutoffMs = 1000 * 60 * 60 * 24 * 14;
  const rawLog = await loadDispatchLog();
  const recentEntries = rawLog.filter((entry) => {
    const sentAt = new Date(entry.sentAt);
    return referenceDate.getTime() - sentAt.getTime() < cutoffMs;
  });
  // Mantém as mais recentes se passar do cap.
  const dispatchLog =
    recentEntries.length > DISPATCH_LOG_MAX_ENTRIES
      ? recentEntries
          .slice()
          .sort(
            (left, right) =>
              new Date(right.sentAt).getTime() -
              new Date(left.sentAt).getTime(),
          )
          .slice(0, DISPATCH_LOG_MAX_ENTRIES)
      : recentEntries;

  const indexedUserIds = await listIndexedUserIds();

  for (const userId of indexedUserIds) {
    const schedule = await loadUserSchedule(userId);
    // Estado VIVO da conta — usado pra filtrar items órfãos no schedule
    // (tarefa deletada / concluída hoje / reminder desabilitado). O
    // schedule é um snapshot estático no KV, então sem essa checagem o
    // dispatcher continua mandando notificações de tarefas que o
    // usuário já apagou ou marcou como feita. Cross-check rodando aqui
    // (não no sync) garante que mesmo que o snapshot esteja defasado,
    // a entrega respeita o estado mais recente da conta.
    const accountEnvelope = await getAccountState(userId);
    const liveAccountState =
      (accountEnvelope?.state as PersistedState | undefined) ?? null;
    // No early-skip when there are no web-push subscriptions: a user may
    // have ONLY Telegram linked and must still receive scheduled alerts.
    const subscriptions = await loadUserSubs(userId);

    summary.usersChecked += 1;

    if (!schedule) {
      // Usuário no índice só por snooze (sem schedule). Processa as
      // snoozes vencidas mais abaixo no fluxo unificado.
      await processUserSnoozes(
        userId,
        subscriptions,
        webPushReady,
        referenceDate,
        summary,
        null,
        liveAccountState,
      );
      continue;
    }

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

      // Item órfão (tarefa apagada / já concluída hoje / reminder
      // desabilitado)? Descarta em silêncio. Sem isso, o snapshot do KV
      // continuava notificando coisas que o usuário já tirou da agenda.
      // Date construída a partir do dateKey zonado pra que a checagem
      // de "concluída hoje" respeite o timezone do usuário.
      if (liveAccountState) {
        const zonedReference = new Date(`${zonedNow.dateKey}T12:00:00`);
        if (!isScheduleItemEntityAlive(item, liveAccountState, zonedReference)) {
          continue;
        }
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

      // Pré-avisos enviados antes (deste e de runs anteriores): quando a
      // notificação da HORA sai, apagamos o pré-aviso correspondente do
      // chat — pedido do usuário pra não poluir o Telegram. Poda
      // entradas com mais de 24h (não fazem mais sentido apagar).
      let prewarnMsgs = await loadUserPrewarnMessages(userId);
      let prewarnDirty = false;
      const prewarnCutoffMs = referenceDate.getTime() - 1000 * 60 * 60 * 24;
      const freshPrewarns = prewarnMsgs.filter(
        (m) => new Date(m.sentAt).getTime() > prewarnCutoffMs,
      );
      if (freshPrewarns.length !== prewarnMsgs.length) {
        prewarnMsgs = freshPrewarns;
        prewarnDirty = true;
      }

      for (let index = 0; index < uniqueItems.length; index += 1) {
        const entry = uniqueItems[index];
        // Sufixo :preN genérico — o N agora é configurável pelo usuário
        // (notificationPreWarnMinutes), não mais fixo em 5.
        const preMatch = entry.id.match(/:pre(\d+)$/);
        const isPreWarning = Boolean(preMatch);
        const preMinutes = preMatch ? Number(preMatch[1]) : 0;
        const baseTitle = entry.title
          .replace(/^⏰ Em \d+ min: /, "")
          .replace(/^🔔 /, "");
        const prefix = isPreWarning ? "⏰" : "🔔";
        const inMin = isPreWarning ? ` (em ${preMinutes}min)` : "";
        const headerLine = `${prefix} ${entry.time} ${baseTitle}${inMin}`;

        const isLast = index === uniqueItems.length - 1;
        const message = isLast && quote ? `${headerLine}\n\n${quote}` : headerLine;

        // Botões "✓ Concluir" + "⏰ Adiar" em TODAS as mensagens,
        // inclusive no pré-aviso — concluir antecipado pelo pré-aviso
        // também SILENCIA a notificação da hora (o cross-check de
        // entidade viva descarta itens já concluídos hoje).
        const buttonRow: { text: string; callback_data: string }[] = [];
        const cbData = buildCompleteCallbackData(entry);
        if (cbData) {
          buttonRow.push({ text: "✓ Concluir", callback_data: cbData });
        }
        const szData = buildSnoozeCallbackData(entry);
        if (szData) {
          buttonRow.push({
            text: `⏰ Adiar ${TELEGRAM_SNOOZE_MINUTES}min`,
            callback_data: szData,
          });
        }
        const inlineKeyboard = buttonRow.length ? [buttonRow] : undefined;

        try {
          const tg = await sendTelegramToUser(userId, message, {
            inlineKeyboard,
          });
          if (tg.ok && !tg.skipped) {
            summary.notificationsSent += 1;

            if (isPreWarning && tg.messageId && tg.chatId) {
              // Registra o pré-aviso pra apagar quando a hora chegar.
              prewarnMsgs.push({
                baseId: entry.id.replace(/:pre\d+$/, ""),
                chatId: tg.chatId,
                messageId: tg.messageId,
                sentAt: referenceDate.toISOString(),
              });
              prewarnDirty = true;
            } else if (!isPreWarning) {
              // Notificação da hora saiu → apaga o(s) pré-aviso(s) dela.
              const toDelete = prewarnMsgs.filter(
                (m) => m.baseId === entry.id,
              );
              if (toDelete.length > 0) {
                for (const m of toDelete) {
                  try {
                    await deleteTelegramMessage(m.chatId, m.messageId);
                  } catch {
                    /* mensagem pode já não existir — ignora */
                  }
                }
                prewarnMsgs = prewarnMsgs.filter(
                  (m) => m.baseId !== entry.id,
                );
                prewarnDirty = true;
              }
            }
          }
        } catch {
          /* swallow — Telegram is a best-effort secondary channel */
        }
      }

      if (prewarnDirty) {
        await saveUserPrewarnMessages(userId, prewarnMsgs);
      }
    }

    // Só reescreve (poda assinaturas mortas 404/410) quando o web push
    // realmente rodou. Se o VAPID estava off, preservamos as assinaturas
    // como estavam — senão um erro transitório de config apagaria todos
    // os dispositivos push do usuário. Usa as assinaturas pós-poda nas
    // snoozes (endpoints mortos já foram removidos).
    const subsForSnooze =
      webPushReady && attemptedAnyPush ? validSubscriptions : subscriptions;
    if (webPushReady && attemptedAnyPush) {
      await saveUserSubs(userId, validSubscriptions);
    }

    // Snoozes vencidas do mesmo usuário, no mesmo passe.
    // Snoozes recebem o estado vivo + o snapshot do schedule pra fazer
    // o mesmo cross-check (snooze de tarefa apagada não dispara).
    await processUserSnoozes(
      userId,
      subsForSnooze,
      webPushReady,
      referenceDate,
      summary,
      schedule,
      liveAccountState,
    );
  }

  await saveDispatchLog(dispatchLog);

  return summary;
}

/**
 * Dispara as snoozes vencidas (fireAt <= agora) de um usuário e remove
 * as disparadas, preservando as futuras. Não passa por
 * isNotificationItemDue (já passou da hora original; dispara AGORA).
 *
 * Faz o mesmo cross-check do dispatcher principal: se o item original
 * (referenciado pelo itemId da snooze) não está mais no schedule, ou
 * aponta pra entidade morta no estado vivo, descarta a snooze. Cobre o
 * caso "snoozei e depois apaguei/concluí a tarefa".
 */
async function processUserSnoozes(
  userId: string,
  subscriptions: StoredSubscription[],
  webPushReady: boolean,
  referenceDate: Date,
  summary: DispatchSummary,
  scheduleSnapshot: StoredSchedule | null,
  liveAccountState: PersistedState | null,
): Promise<void> {
  const list = await loadUserSnoozes(userId);
  if (list.length === 0) return;
  const nowMs = referenceDate.getTime();
  const due = list.filter((entry) => new Date(entry.fireAt).getTime() <= nowMs);
  if (due.length === 0) return;

  const scheduleByItemId = new Map(
    (scheduleSnapshot?.items ?? []).map((item) => [item.id, item]),
  );

  for (const entry of due) {
    // Procura o item original no snapshot. Se sumiu, é porque o sync
    // já refletiu uma exclusão/conclusão — snooze órfã, descarta.
    const linkedItem = scheduleByItemId.get(entry.itemId);
    if (linkedItem) {
      if (
        liveAccountState &&
        !isScheduleItemEntityAlive(linkedItem, liveAccountState, referenceDate)
      ) {
        continue;
      }
    } else if (liveAccountState) {
      // Sem item no snapshot + temos estado vivo = órfã. Sem estado
      // vivo, fallback no comportamento antigo (mandar) pra não perder
      // snoozes em caso de problema de leitura do KV.
      continue;
    }

    // Prefere o título/corpo VIVO do schedule (sem o prefixo "Em N min")
    // ao do snooze armazenado — assim o re-disparo mostra o nome atual da
    // tarefa, não um rótulo defasado.
    const title = linkedItem
      ? stripPreWarnPrefix(linkedItem.title)
      : entry.title || "Lembrete adiado";
    const body =
      (linkedItem?.body || entry.body || "Você adiou esse lembrete.").trim();

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

    try {
      // No re-disparo, oferece os mesmos botões: Concluir (quando o item
      // vivo permite) + Adiar de novo. Sem linkedItem (item já saiu do
      // schedule mas estado vivo ausente — fallback), manda sem botões.
      const snoozeButtonRow: { text: string; callback_data: string }[] = [];
      if (linkedItem) {
        const cbData = buildCompleteCallbackData(linkedItem);
        if (cbData) {
          snoozeButtonRow.push({ text: "✓ Concluir", callback_data: cbData });
        }
        const szData = buildSnoozeCallbackData(linkedItem);
        if (szData) {
          snoozeButtonRow.push({
            text: `⏰ Adiar ${TELEGRAM_SNOOZE_MINUTES}min`,
            callback_data: szData,
          });
        }
      }
      const tg = await sendTelegramToUser(userId, `🔔 ${title}\n${body}`, {
        inlineKeyboard: snoozeButtonRow.length ? [snoozeButtonRow] : undefined,
      });
      if (tg.ok && !tg.skipped) {
        summary.notificationsSent += 1;
      }
    } catch {
      /* swallow */
    }
  }

  const remaining = list.filter(
    (entry) => new Date(entry.fireAt).getTime() > nowMs,
  );
  await saveUserSnoozes(userId, remaining);
}
