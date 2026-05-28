#!/usr/bin/env node
/**
 * Registers (or removes) the Telegram bot webhook.
 *
 * Run once after every deploy that changes the webhook URL, OR after
 * rotating TELEGRAM_WEBHOOK_SECRET.
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN        — required, from BotFather
 *   TELEGRAM_WEBHOOK_URL      — required, e.g. https://praxis.app/api/telegram/webhook
 *   TELEGRAM_WEBHOOK_SECRET   — optional but recommended; the bot will echo
 *                               this in the `x-telegram-bot-api-secret-token`
 *                               header on each call.
 *
 * Usage:
 *   node scripts/setup-telegram-webhook.mjs
 *   node scripts/setup-telegram-webhook.mjs --delete       # unregister
 *   node scripts/setup-telegram-webhook.mjs --info         # inspect current
 */

const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const url = (process.env.TELEGRAM_WEBHOOK_URL || "").trim();
const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();

if (!token) {
  console.error("Missing TELEGRAM_BOT_TOKEN.");
  process.exit(1);
}

const api = (method, body) =>
  fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      console.error(`[telegram] ${method} failed:`, payload);
      process.exit(1);
    }
    return payload;
  });

const mode = process.argv[2];

if (mode === "--info") {
  const info = await api("getWebhookInfo");
  console.log(JSON.stringify(info.result, null, 2));
  process.exit(0);
}

if (mode === "--delete") {
  await api("deleteWebhook", { drop_pending_updates: true });
  console.log("Webhook removido.");
  process.exit(0);
}

if (!url) {
  console.error("Missing TELEGRAM_WEBHOOK_URL.");
  process.exit(1);
}

const body = {
  url,
  allowed_updates: ["message"],
  drop_pending_updates: true,
};
if (secret) body.secret_token = secret;

await api("setWebhook", body);

const info = await api("getWebhookInfo");
console.log("Webhook registrado:");
console.log(JSON.stringify(info.result, null, 2));
