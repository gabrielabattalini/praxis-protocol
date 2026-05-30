import test from "node:test";
import assert from "node:assert/strict";

/**
 * Testes da lógica de "item devido". Reproduzo a função pura aqui pra
 * isolar da infra do dispatch (KV, web push, Telegram).
 */
const DISPATCH_WINDOW_MIN = 15;

function minutesOfDay(hourMinute) {
  const [h, m] = hourMinute.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return Number.NaN;
  return h * 60 + m;
}

function isDue(itemTime, nowHourMinute) {
  const itemMins = minutesOfDay(itemTime);
  const nowMins = minutesOfDay(nowHourMinute);
  if (!Number.isFinite(itemMins) || !Number.isFinite(nowMins)) return false;
  const diff = nowMins - itemMins;
  return diff >= 0 && diff <= DISPATCH_WINDOW_MIN;
}

test("item dispara no minuto exato", () => {
  assert.equal(isDue("08:00", "08:00"), true);
});

test("item dispara dentro da janela (até 15min depois)", () => {
  assert.equal(isDue("08:00", "08:15"), true);
});

test("item não dispara 16 min depois", () => {
  assert.equal(isDue("08:00", "08:16"), false);
});

test("item futuro não dispara", () => {
  assert.equal(isDue("08:30", "08:29"), false);
});

test("janela atravessa hora", () => {
  assert.equal(isDue("08:50", "09:05"), true);
  assert.equal(isDue("08:50", "09:06"), false);
});

test("horário malformado retorna false", () => {
  assert.equal(isDue("abc", "08:00"), false);
  assert.equal(isDue("08:00", "xy:zz"), false);
});
