import test from "node:test";
import assert from "node:assert/strict";

/**
 * Trava o fix do bug "consigo concluir, mas não consigo tirar":
 * toggle-task-completion-for-date precisa também sincronizar
 * completed/completedAt — senão o fallback legado de isTaskCompletedForDate
 * continuava dizendo "concluído", e a UI da Agenda seguia mostrando ✓.
 *
 * Espelho o reducer (módulos com alias @/ não importam direto no node).
 */

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toggleForDate(task, dateKey, today = new Date()) {
  const currentList = task.completedDates ?? [];
  const alreadyComplete = currentList.includes(dateKey);
  const nextList = alreadyComplete
    ? currentList.filter((entry) => entry !== dateKey)
    : [...currentList, dateKey].sort();
  const todayKey = formatDateKey(today);
  const willBeCompletedToday = nextList.includes(todayKey);
  const latestRemainingKey = nextList.length
    ? nextList[nextList.length - 1]
    : null;
  const nextCompletedAt = willBeCompletedToday
    ? new Date().toISOString()
    : latestRemainingKey
      ? new Date(`${latestRemainingKey}T12:00:00`).toISOString()
      : undefined;
  return {
    ...task,
    completedDates: nextList,
    completed: willBeCompletedToday,
    completedAt: nextCompletedAt,
  };
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Espelha a parte relevante de isTaskCompletedForDate (pra recurrence
// "daily") pra confirmar que a UI vai ler "false" após o toggle desmarcar.
function isCompletedForDate(task, refDate) {
  if (task.completedDates && task.completedDates.length > 0) {
    const dateKey = formatDateKey(refDate);
    if (task.completedDates.includes(dateKey)) return true;
    // não-one-time cai no fallback legado
  }
  if (!task.completed) return false;
  if (!task.completedAt) return task.completed;
  const completionDate = new Date(task.completedAt);
  if (Number.isNaN(completionDate.getTime())) return task.completed;
  return isSameDay(completionDate, refDate);
}

test("desmarcar dia passado: completedAt legado é limpo, UI vê false", () => {
  // Bug-cenário: task daily marcada ontem (14) — tanto via completedDates
  // quanto via completed/completedAt legados.
  const yesterday = "2026-06-14";
  const task = {
    id: "t-sleep",
    recurrence: { kind: "daily" },
    completed: true,
    completedAt: `${yesterday}T22:00:00.000Z`,
    completedDates: [yesterday],
  };
  const today = new Date("2026-06-15T12:00:00");

  // Usuário clica pra tirar baixa do dia 14.
  const next = toggleForDate(task, yesterday, today);

  // completedDates esvaziou ✓
  assert.deepEqual(next.completedDates, []);
  // legado também limpo — sem isto, fallback de isTaskCompletedForDate
  // ainda diria true e a UI ficaria como ✓.
  assert.equal(next.completed, false);
  assert.equal(next.completedAt, undefined);
  // E a leitura agora dá false (UI mostra ○ pendente).
  assert.equal(isCompletedForDate(next, new Date(`${yesterday}T12:00:00`)), false);
});

test("marcar dia passado quando lista estava vazia: completedAt aponta pra esse dia", () => {
  const task = {
    id: "t",
    recurrence: { kind: "daily" },
    completed: false,
    completedAt: undefined,
    completedDates: [],
  };
  const today = new Date("2026-06-15T12:00:00");
  const next = toggleForDate(task, "2026-06-13", today);
  assert.deepEqual(next.completedDates, ["2026-06-13"]);
  // 13 não é hoje → completed=false (legado), mas completedAt aponta
  // pra última conclusão (13) pra leitores legados não regredirem.
  assert.equal(next.completed, false);
  assert.equal(next.completedAt?.slice(0, 10), "2026-06-13");
});

test("marcar HOJE via toggle-by-date: completed=true e completedAt aponta pra hoje", () => {
  const task = {
    id: "t",
    recurrence: { kind: "daily" },
    completed: false,
    completedAt: undefined,
    completedDates: [],
  };
  const now = new Date();
  const todayKey = formatDateKey(now);
  const next = toggleForDate(task, todayKey, now);
  assert.deepEqual(next.completedDates, [todayKey]);
  assert.equal(next.completed, true);
  // completedAt = new Date().toISOString() — checamos só o dia local.
  assert.equal(formatDateKey(new Date(next.completedAt)), todayKey);
});

test("desmarcar um dia quando ainda restam outras conclusões: completedAt aponta pra última", () => {
  const task = {
    id: "t",
    recurrence: { kind: "daily" },
    completed: true,
    completedAt: "2026-06-14T22:00:00.000Z",
    completedDates: ["2026-06-13", "2026-06-14"],
  };
  const today = new Date("2026-06-15T12:00:00");
  const next = toggleForDate(task, "2026-06-14", today);
  assert.deepEqual(next.completedDates, ["2026-06-13"]);
  // 13 não é hoje → completed=false; legado aponta pro último remanescente.
  assert.equal(next.completed, false);
  assert.equal(next.completedAt?.slice(0, 10), "2026-06-13");
});
