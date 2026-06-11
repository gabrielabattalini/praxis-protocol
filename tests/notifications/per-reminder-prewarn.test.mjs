import test from "node:test";
import assert from "node:assert/strict";

/**
 * Trava a regra do pré-aviso INDIVIDUAL por lembrete usada no
 * buildNotificationSyncPayload: se o reminder define preWarnMinutes (um
 * número), usa ele (sanitizado 0–120); senão cai no padrão global. Isso é
 * o que permite o "timer por tarefa" no Telegram. Espelha a lógica porque
 * notification-schedule.ts importa com alias @/ (não resolve no node test).
 */

const DEFAULT = 5;

function sanitizePreWarnMinutes(value) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT;
  return Math.min(120, Math.max(0, parsed));
}

function resolveReminderPreWarn(reminderPreWarnMinutes, globalPreWarnRaw) {
  const globalPreWarn = sanitizePreWarnMinutes(globalPreWarnRaw);
  return typeof reminderPreWarnMinutes === "number"
    ? sanitizePreWarnMinutes(reminderPreWarnMinutes)
    : globalPreWarn;
}

test("sem override (undefined) → usa o padrão global", () => {
  assert.equal(resolveReminderPreWarn(undefined, 30), 30);
  assert.equal(resolveReminderPreWarn(undefined, 5), 5);
});

test("override numérico vence o global", () => {
  assert.equal(resolveReminderPreWarn(10, 30), 10);
  assert.equal(resolveReminderPreWarn(45, 5), 45);
});

test("override 0 desliga o pré-aviso (avisa só na hora) — não vira o global", () => {
  assert.equal(resolveReminderPreWarn(0, 30), 0);
});

test("override é sanitizado: clamp 0–120 e arredonda", () => {
  assert.equal(resolveReminderPreWarn(999, 5), 120);
  assert.equal(resolveReminderPreWarn(-5, 5), 0);
  assert.equal(resolveReminderPreWarn(12.6, 5), 13);
});

test("global inválido cai no padrão quando não há override", () => {
  assert.equal(resolveReminderPreWarn(undefined, "lixo"), DEFAULT);
});
