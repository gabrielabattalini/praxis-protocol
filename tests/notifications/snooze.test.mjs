import test from "node:test";
import assert from "node:assert/strict";

/**
 * Testes de "shape" da snoozeNotification. Não exercitam o I/O do KV
 * (rede), só a lógica de filtro/agregação. Isolei o helper puro abaixo
 * pra que o teste rode sem mock de fs/KV.
 */
function applySnooze(state, userId, payload, now) {
  const minutes = Math.max(1, Math.min(180, Math.round(payload.minutes)));
  const fireAt = new Date(now + minutes * 60_000).toISOString();
  const list = state[userId] ?? [];
  const remaining = list.filter((entry) => entry.itemId !== payload.itemId);
  remaining.push({
    itemId: payload.itemId,
    fireAt,
    title: payload.title?.slice(0, 200),
    body: payload.body?.slice(0, 500),
  });
  return { ...state, [userId]: remaining };
}

const fixedNow = new Date("2026-06-01T10:00:00.000Z").getTime();

test("snooze adiciona entrada pra novo itemId", () => {
  const state = {};
  const next = applySnooze(state, "user-1", { itemId: "task-x", minutes: 15 }, fixedNow);
  assert.equal(next["user-1"].length, 1);
  assert.equal(next["user-1"][0].itemId, "task-x");
  assert.equal(next["user-1"][0].fireAt, "2026-06-01T10:15:00.000Z");
});

test("snooze substitui entrada anterior do mesmo itemId", () => {
  const state = {
    "user-1": [{ itemId: "task-x", fireAt: "2026-06-01T10:05:00.000Z" }],
  };
  const next = applySnooze(state, "user-1", { itemId: "task-x", minutes: 30 }, fixedNow);
  assert.equal(next["user-1"].length, 1, "nao deve duplicar");
  assert.equal(next["user-1"][0].fireAt, "2026-06-01T10:30:00.000Z");
});

test("snooze respeita limite mínimo de 1 minuto", () => {
  const state = {};
  const next = applySnooze(state, "user-1", { itemId: "task-x", minutes: 0 }, fixedNow);
  assert.equal(next["user-1"][0].fireAt, "2026-06-01T10:01:00.000Z");
});

test("snooze respeita limite máximo de 180 minutos", () => {
  const state = {};
  const next = applySnooze(state, "user-1", { itemId: "task-x", minutes: 5000 }, fixedNow);
  assert.equal(next["user-1"][0].fireAt, "2026-06-01T13:00:00.000Z");
});

test("snooze trunca title e body pra evitar payloads grandes", () => {
  const state = {};
  const longTitle = "x".repeat(500);
  const longBody = "y".repeat(800);
  const next = applySnooze(
    state,
    "user-1",
    { itemId: "task-x", minutes: 15, title: longTitle, body: longBody },
    fixedNow,
  );
  assert.equal(next["user-1"][0].title.length, 200);
  assert.equal(next["user-1"][0].body.length, 500);
});
