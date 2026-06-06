import test from "node:test";
import assert from "node:assert/strict";

/**
 * Espelha `isScheduleItemEntityAlive` de src/lib/notification-schedule.ts
 * (e o ramo de "concluído hoje" do isTaskCompletedForDate de utils.ts),
 * pra travar a lógica do filtro órfão do dispatcher sem depender da
 * resolução de aliases @/ no runtime de node --test. Os outros testes de
 * notificação seguem o mesmo padrão (dispatch-window, per-user-store).
 */
function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isTaskCompletedForDate(task, referenceDate) {
  const dateKey = localDateKey(referenceDate);
  if (task.completedDates?.includes(dateKey)) return true;
  if (task.completed && task.completedAt?.slice(0, 10) === dateKey) return true;
  return false;
}

function isScheduleItemEntityAlive(item, state, referenceDate) {
  if (!state) return true;
  if (item.source === "task" && item.entityId) {
    const task = (state.tasks ?? []).find((t) => t.id === item.entityId);
    if (!task) return false;
    if (isTaskCompletedForDate(task, referenceDate)) return false;
    return true;
  }
  if (item.source === "reminder" && item.entityId) {
    const reminder = (state.reminders ?? []).find(
      (r) =>
        r.entityType === (item.entityType ?? r.entityType) &&
        r.entityId === item.entityId,
    );
    if (!reminder || !reminder.enabled) return false;
    if (reminder.entityType === "task") {
      const linkedTask = (state.tasks ?? []).find(
        (t) => t.id === reminder.entityId,
      );
      if (linkedTask && isTaskCompletedForDate(linkedTask, referenceDate)) {
        return false;
      }
    }
    return true;
  }
  return true;
}

const TODAY = new Date("2026-06-06T12:00:00");
const TODAY_KEY = "2026-06-06";
const YESTERDAY_KEY = "2026-06-05";

const taskItem = (entityId) => ({ source: "task", entityType: "task", entityId });
const reminderItem = (entityType, entityId) => ({
  source: "reminder",
  entityType,
  entityId,
});

test("task viva e não concluída → passa", () => {
  const state = {
    tasks: [{ id: "t1", title: "X", completed: false, completedDates: [] }],
    reminders: [],
  };
  assert.equal(isScheduleItemEntityAlive(taskItem("t1"), state, TODAY), true);
});

test("task DELETADA (sumiu de state.tasks) → silencia", () => {
  // Cenário do bug "Consulta odontológica preventiva continua notificando
  // mesmo após deletar": snapshot do schedule no KV ainda tem a entry,
  // dispatcher dispara — agora o filtro deve descartar em silêncio.
  const state = { tasks: [], reminders: [] };
  assert.equal(isScheduleItemEntityAlive(taskItem("t1"), state, TODAY), false);
});

test("task concluída HOJE (completedDates) → silencia", () => {
  const state = {
    tasks: [{ id: "t1", title: "X", completed: false, completedDates: [TODAY_KEY] }],
    reminders: [],
  };
  assert.equal(isScheduleItemEntityAlive(taskItem("t1"), state, TODAY), false);
});

test("task concluída ONTEM (não hoje) → passa", () => {
  const state = {
    tasks: [
      { id: "t1", title: "X", completed: false, completedDates: [YESTERDAY_KEY] },
    ],
    reminders: [],
  };
  assert.equal(isScheduleItemEntityAlive(taskItem("t1"), state, TODAY), true);
});

test("reminder vivo e enabled → passa", () => {
  const state = {
    tasks: [],
    reminders: [
      { id: "r1", entityType: "meal", entityId: "meal-1", enabled: true },
    ],
  };
  assert.equal(
    isScheduleItemEntityAlive(reminderItem("meal", "meal-1"), state, TODAY),
    true,
  );
});

test("reminder DELETADO → silencia", () => {
  const state = { tasks: [], reminders: [] };
  assert.equal(
    isScheduleItemEntityAlive(reminderItem("meal", "meal-1"), state, TODAY),
    false,
  );
});

test("reminder DESABILITADO → silencia", () => {
  const state = {
    tasks: [],
    reminders: [
      { id: "r1", entityType: "meal", entityId: "meal-1", enabled: false },
    ],
  };
  assert.equal(
    isScheduleItemEntityAlive(reminderItem("meal", "meal-1"), state, TODAY),
    false,
  );
});

test("reminder vinculado a tarefa concluída hoje → silencia", () => {
  const state = {
    tasks: [
      { id: "t1", title: "X", completed: false, completedDates: [TODAY_KEY] },
    ],
    reminders: [
      { id: "r1", entityType: "task", entityId: "t1", enabled: true },
    ],
  };
  assert.equal(
    isScheduleItemEntityAlive(reminderItem("task", "t1"), state, TODAY),
    false,
  );
});

test("sem estado vivo (envelope ausente) → passa (não regressar)", () => {
  // Fallback conservador: KV do account-state fora do ar não deve
  // silenciar todas as notificações; melhor falso positivo do que
  // canal mudo por causa de problema de leitura.
  assert.equal(isScheduleItemEntityAlive(taskItem("t1"), null, TODAY), true);
});

test("source meal/workout sem entityId → passa (não validamos)", () => {
  const state = { tasks: [], reminders: [] };
  assert.equal(
    isScheduleItemEntityAlive({ source: "meal", entityType: "meal" }, state, TODAY),
    true,
  );
});
