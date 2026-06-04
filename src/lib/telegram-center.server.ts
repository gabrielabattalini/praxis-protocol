import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/* ───────────────────────────────────────────────────────────────
   Telegram notification channel — account-bound & durable.

   Telegram bots CANNOT message a person by phone number. A bot can
   only deliver to a `chat_id`, which is obtained after the person
   presses "Start" on the bot. The flow:

     1. App mints a one-time linkCode bound to the Clerk userId
        (KV, 30 min TTL) and opens https://t.me/<bot>?start=<code>.
     2. User taps Start → Telegram calls our webhook with
        "/start <code>".
     3. Webhook resolves the code → stores { chatId } bound to the
        userId, durably, so any device on that account delivers here.

   Storage backend mirrors account-state.server.ts:
     1. Upstash / Vercel KV (Redis REST) — durable on serverless
     2. Local JSON file (.data/…) — dev fallback only
   No new npm dependency (plain fetch over the REST API).
   ─────────────────────────────────────────────────────────────── */

const KV_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const KV_ENABLED = Boolean(KV_URL && KV_TOKEN);

const TELEGRAM_API = "https://api.telegram.org";

const LINK_CODE_TTL_SECONDS = 30 * 60;
const BOT_USERNAME_TTL_SECONDS = 24 * 60 * 60;

export type TelegramBinding = {
  chatId: number;
  telegramUserId?: number;
  username?: string;
  firstName?: string;
  linkedAt: string;
};

export type TelegramStatus = {
  configured: boolean;
  linked: boolean;
  username?: string;
  firstName?: string;
  linkedAt?: string;
  botUsername?: string;
};

/* ── Bot credential ──────────────────────────────────────────── */

export function getTelegramBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
}

export function isTelegramConfigured() {
  return Boolean(getTelegramBotToken());
}

export function getTelegramWebhookSecret() {
  return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || "";
}

/* ── Keys ────────────────────────────────────────────────────── */

const linkCodeKey = (code: string) => `praxis:tg:link:${code}`;
const chatBindingKey = (userId: string) => `praxis:tg:chat:${userId}`;
const botUsernameKey = "praxis:tg:meta:botusername";

/* ── Generic KV via Upstash command-array root endpoint ──────── */

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
        `[telegram] KV command failed: ${response.status} ${response.statusText}`,
      );
      return null;
    }
    const payload = (await response.json()) as { result?: T };
    return payload.result ?? null;
  } catch (error) {
    console.error("[telegram] KV command error:", error);
    return null;
  }
}

/* ── Local file fallback (dev only) ──────────────────────────── */

const dataDir = path.join(process.cwd(), ".data");
const storePath = path.join(dataDir, "telegram-store.json");

type FileEntry = { value: string; expiresAt?: number };
type FileStore = { kv: Record<string, FileEntry> };

function loadFileStore(): FileStore {
  try {
    return JSON.parse(fs.readFileSync(storePath, "utf8")) as FileStore;
  } catch {
    return { kv: {} };
  }
}

function saveFileStore(store: FileStore) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
}

/* ── Backend-agnostic primitives ─────────────────────────────── */

async function kvGet(key: string): Promise<string | null> {
  if (KV_ENABLED) {
    return kvCommand<string>(["GET", key]);
  }
  const store = loadFileStore();
  const entry = store.kv[key];
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    delete store.kv[key];
    saveFileStore(store);
    return null;
  }
  return entry.value;
}

async function kvSet(
  key: string,
  value: string,
  ttlSeconds?: number,
): Promise<void> {
  if (KV_ENABLED) {
    const command: Array<string | number> = ["SET", key, value];
    if (ttlSeconds && ttlSeconds > 0) {
      command.push("EX", ttlSeconds);
    }
    await kvCommand(command);
    return;
  }
  const store = loadFileStore();
  store.kv[key] = {
    value,
    expiresAt:
      ttlSeconds && ttlSeconds > 0
        ? Date.now() + ttlSeconds * 1000
        : undefined,
  };
  saveFileStore(store);
}

async function kvDelete(key: string): Promise<void> {
  if (KV_ENABLED) {
    await kvCommand(["DEL", key]);
    return;
  }
  const store = loadFileStore();
  delete store.kv[key];
  saveFileStore(store);
}

/* ── Link codes ──────────────────────────────────────────────── */

function randomCode() {
  // CSPRNG — esse code é o único segredo que vincula um chat do Telegram
  // a uma conta Clerk. Math.random() é previsível: um atacante que adivinhe
  // um code ativo (TTL 30 min) sequestra o canal de notificações da vítima
  // e pode marcar as tarefas dela como concluídas via o botão inline.
  // 32 bytes = 256 bits de entropia.
  return crypto.randomBytes(32).toString("base64url");
}

export async function createTelegramLinkCode(userId: string) {
  const code = randomCode();
  await kvSet(linkCodeKey(code), userId, LINK_CODE_TTL_SECONDS);
  const botUsername = await getBotUsername();
  return {
    code,
    botUsername,
    url: botUsername
      ? `https://t.me/${botUsername}?start=${code}`
      : null,
  };
}

export async function consumeTelegramLinkCode(
  code: string,
): Promise<string | null> {
  const userId = await kvGet(linkCodeKey(code));
  if (userId) {
    await kvDelete(linkCodeKey(code));
  }
  return userId;
}

/* ── Chat binding ────────────────────────────────────────────── */

// Reverse lookup: chatId → userId. Preenchido em bindTelegramChat pra
// que o webhook (callback_query) consiga resolver o user a partir do
// chat que clicou no botão "Concluir".
const chatToUserKey = (chatId: number) => `telegram:chat:${chatId}`;

export async function bindTelegramChat(
  userId: string,
  binding: TelegramBinding,
): Promise<void> {
  await kvSet(chatBindingKey(userId), JSON.stringify(binding));
  await kvSet(chatToUserKey(binding.chatId), userId);
}

export async function getUserIdByChatId(chatId: number): Promise<string | null> {
  return kvGet(chatToUserKey(chatId));
}

/**
 * Grava a chave reversa pra um chatId já bindado. Usado pelo endpoint
 * de migração `/api/telegram/rebuild-bind` (rodado uma vez por conta
 * que tenha conectado antes do PR do botão inline).
 */
export async function rebuildReverseBinding(
  userId: string,
  chatId: number,
): Promise<void> {
  await kvSet(chatToUserKey(chatId), userId);
}

export async function getTelegramBinding(
  userId: string,
): Promise<TelegramBinding | null> {
  const raw = await kvGet(chatBindingKey(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TelegramBinding;
  } catch {
    return null;
  }
}

export async function unlinkTelegram(userId: string): Promise<void> {
  const binding = await getTelegramBinding(userId);
  if (binding?.chatId) {
    await kvDelete(chatToUserKey(binding.chatId));
  }
  await kvDelete(chatBindingKey(userId));
}

export async function getTelegramStatus(
  userId: string,
): Promise<TelegramStatus> {
  const configured = isTelegramConfigured();
  const binding = await getTelegramBinding(userId);
  if (binding) {
    // Self-heal silencioso: o reverse lookup chat→user só foi criado
    // pra binds feitos depois da feature do botão inline. Pra contas
    // antigas, repomos a chave em toda checada de status (idempotente).
    void rebuildReverseBinding(userId, binding.chatId).catch(() => undefined);
  }
  const botUsername = configured
    ? (await getBotUsername()) ?? undefined
    : undefined;
  return {
    configured,
    linked: Boolean(binding),
    username: binding?.username,
    firstName: binding?.firstName,
    linkedAt: binding?.linkedAt,
    botUsername,
  };
}

/* ── Telegram Bot API ────────────────────────────────────────── */

async function telegramApi<T = unknown>(
  method: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; result?: T; description?: string }> {
  const token = getTelegramBotToken();
  if (!token) {
    return { ok: false, description: "Bot do Telegram não configurado." };
  }
  try {
    const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      ok: boolean;
      result?: T;
      description?: string;
    };
    return payload;
  } catch (error) {
    return {
      ok: false,
      description:
        error instanceof Error ? error.message : "Falha de rede com o Telegram.",
    };
  }
}

let cachedBotUsername: string | null = null;

export async function getBotUsername(): Promise<string | null> {
  const envOverride = process.env.TELEGRAM_BOT_USERNAME?.trim();
  if (envOverride) return envOverride;
  if (cachedBotUsername) return cachedBotUsername;

  const stored = await kvGet(botUsernameKey);
  if (stored) {
    cachedBotUsername = stored;
    return stored;
  }

  if (!isTelegramConfigured()) return null;

  const me = await telegramApi<{ username?: string }>("getMe");
  const username = me.ok ? me.result?.username ?? null : null;
  if (username) {
    cachedBotUsername = username;
    await kvSet(botUsernameKey, username, BOT_USERNAME_TTL_SECONDS);
  }
  return username;
}

export type InlineButton = { text: string; callback_data: string };
export type SendOpts = {
  html?: boolean;
  inlineKeyboard?: InlineButton[][];
};

export async function sendTelegramMessage(
  chatId: number,
  text: string,
  opts?: SendOpts,
): Promise<{ ok: boolean; error?: string }> {
  const result = await telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    // Default to plain text — safe for arbitrary task/reminder content.
    // Controlled, hand-written messages opt into HTML.
    ...(opts?.html ? { parse_mode: "HTML" } : {}),
    disable_web_page_preview: true,
    ...(opts?.inlineKeyboard
      ? { reply_markup: { inline_keyboard: opts.inlineKeyboard } }
      : {}),
  });
  return result.ok
    ? { ok: true }
    : { ok: false, error: result.description || "Falha ao enviar." };
}

/**
 * Envia um documento (arquivo) ao chat. Usa multipart/form-data direto
 * via fetch porque telegramApi é JSON. Pensado pro PDF do relatório
 * semanal mas serve pra qualquer arquivo binário.
 */
export async function sendTelegramDocument(
  chatId: number,
  document: Buffer,
  filename: string,
  caption?: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = getTelegramBotToken();
  if (!token) {
    return { ok: false, error: "Bot do Telegram não configurado." };
  }
  try {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    if (caption) form.append("caption", caption);
    // Cast to Uint8Array → File: o FormData do undici (Node 20+, runtime
    // do Next route serverless) aceita Blob/File; PDF é binary octet.
    const file = new File(
      [new Uint8Array(document)] as BlobPart[],
      filename,
      { type: "application/pdf" },
    );
    form.append("document", file);

    const response = await fetch(
      `${TELEGRAM_API}/bot${token}/sendDocument`,
      { method: "POST", body: form, cache: "no-store" },
    );
    const payload = (await response.json()) as {
      ok: boolean;
      description?: string;
    };
    return payload.ok
      ? { ok: true }
      : { ok: false, error: payload.description || "Falha ao enviar documento." };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Falha de rede com o Telegram.",
    };
  }
}

/**
 * Envia documento ao chat vinculado ao userId. Skip se sem binding.
 */
export async function sendTelegramDocumentToUser(
  userId: string,
  document: Buffer,
  filename: string,
  caption?: string,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!isTelegramConfigured()) {
    return { ok: false, error: "Bot do Telegram não configurado." };
  }
  const binding = await getTelegramBinding(userId);
  if (!binding) {
    return { ok: true, skipped: true };
  }
  return sendTelegramDocument(binding.chatId, document, filename, caption);
}

/**
 * Deliver a message to a user's linked Telegram chat.
 * Silently skips (ok:true, skipped:true) when the account has no
 * Telegram linked — so callers can fan out to every channel safely.
 */
export async function sendTelegramToUser(
  userId: string,
  text: string,
  opts?: SendOpts,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!isTelegramConfigured()) {
    return { ok: false, error: "Bot do Telegram não configurado." };
  }
  const binding = await getTelegramBinding(userId);
  if (!binding) {
    return { ok: true, skipped: true };
  }
  return sendTelegramMessage(binding.chatId, text, opts);
}

/**
 * Confirma um callback_query do Telegram (faz o spinner do botão sumir
 * e mostra um toast curto pra quem clicou).
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  await telegramApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text, show_alert: false } : {}),
  });
}

/**
 * Edita a marcação inline de uma mensagem já enviada — usamos pra trocar
 * o botão "Concluir" por um "✓ Concluído" indelével após o user marcar.
 */
export async function editMessageReplyMarkup(
  chatId: number,
  messageId: number,
  inlineKeyboard: InlineButton[][] | null,
): Promise<void> {
  await telegramApi("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    ...(inlineKeyboard
      ? { reply_markup: { inline_keyboard: inlineKeyboard } }
      : { reply_markup: { inline_keyboard: [] } }),
  });
}

export async function sendTelegramTest(
  userId: string,
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const now = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
  const message = [
    "<b>✅ Praxis Protocol</b>",
    "",
    "Canal do Telegram conectado com sucesso.",
    "Você vai receber aqui seus lembretes de tarefas, hábitos e eventos.",
    "",
    `<i>Teste enviado em ${now}</i>`,
  ].join("\n");

  const result = await sendTelegramToUser(userId, message, { html: true });
  if (result.skipped) {
    return {
      ok: false,
      error: "Telegram ainda não conectado nesta conta.",
      skipped: true,
    };
  }
  return result;
}
