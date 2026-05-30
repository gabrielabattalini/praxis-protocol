import test from "node:test";
import assert from "node:assert/strict";

/**
 * Reproduz a lógica do reducer "toggle-meal-item-completed" — testes
 * verificam que histórico (completedDates) e vista de hoje
 * (completed/completedAt) ficam consistentes.
 */
function migrate(item) {
  const legacyDate = item.completedAt?.slice(0, 10);
  if (!legacyDate) return item;
  const current = item.completedDates ?? [];
  if (current.includes(legacyDate)) return item;
  return { ...item, completedDates: [...current, legacyDate] };
}

function toggle(item, dateKey, todayKey) {
  const isReferenceToday = dateKey === todayKey;
  const migrated = migrate(item);
  const currentDates = migrated.completedDates ?? [];
  const wasCompleted = currentDates.includes(dateKey);
  const nextDates = wasCompleted
    ? currentDates.filter((d) => d !== dateKey)
    : [...currentDates, dateKey].sort();
  const willBeCompletedToday = nextDates.includes(todayKey);
  const referenceIso = `${dateKey}T12:00:00.000Z`;
  return {
    ...migrated,
    completedDates: nextDates,
    completed: willBeCompletedToday,
    completedAt: willBeCompletedToday
      ? isReferenceToday
        ? referenceIso
        : migrated.completedAt ?? new Date().toISOString()
      : undefined,
  };
}

const TODAY = "2026-06-01";

test("marcar item de hoje seta completed e completedAt", () => {
  const item = { id: "i1" };
  const next = toggle(item, TODAY, TODAY);
  assert.equal(next.completed, true);
  assert.equal(next.completedAt, "2026-06-01T12:00:00.000Z");
  assert.deepEqual(next.completedDates, [TODAY]);
});

test("desmarcar item de hoje limpa tudo", () => {
  const item = { id: "i1", completed: true, completedDates: [TODAY] };
  const next = toggle(item, TODAY, TODAY);
  assert.equal(next.completed, false);
  assert.equal(next.completedAt, undefined);
  assert.deepEqual(next.completedDates, []);
});

test("marcar dia passado mantém completed do dia atual intacto", () => {
  const item = { id: "i1", completed: true, completedDates: [TODAY] };
  const next = toggle(item, "2026-05-25", TODAY);
  assert.equal(next.completed, true, "hoje continua marcado");
  assert.deepEqual(next.completedDates, ["2026-05-25", TODAY]);
});

test("legacy completedAt sem completedDates é migrado", () => {
  const item = { id: "i1", completed: true, completedAt: "2026-05-30T10:00:00Z" };
  // Toggle hoje → adiciona TODAY, migra 2026-05-30 do legacy
  const next = toggle(item, TODAY, TODAY);
  assert.ok(next.completedDates.includes("2026-05-30"));
  assert.ok(next.completedDates.includes(TODAY));
});
