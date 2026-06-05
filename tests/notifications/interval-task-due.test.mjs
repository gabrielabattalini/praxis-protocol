import test from "node:test";
import assert from "node:assert/strict";
import { isTaskDueForDate } from "../../src/lib/utils.ts";

/**
 * Trava a regra que o buildNotificationSyncPayload usa pra decidir se
 * uma tarefa interval-days entra no schedule de notificação: só entra
 * quando está DUE (isTaskDueForDate) — igual à lista de Missões. Sem
 * isto, tarefa de ciclo longo já concluída continuava notificando por
 * causa de anchor defasado no cache do servidor.
 */

function intervalTask(intervalDays, completedAt) {
  return {
    id: "t-dental",
    title: "Consulta odontológica preventiva",
    description: "",
    category: "health",
    moduleId: "health",
    scheduledTime: "14:00",
    xp: 40,
    completed: false,
    completedAt,
    recurrence: { kind: "interval-days", intervalDays },
  };
}

const NOW = new Date("2026-06-05T12:00:00");

test("interval-days concluída há 10 dias (ciclo 180) → NÃO due → fora do schedule", () => {
  const task = intervalTask(180, new Date("2026-05-26T12:00:00").toISOString());
  assert.equal(isTaskDueForDate(task, NOW), false);
});

test("interval-days nunca concluída → due → entra no schedule", () => {
  const task = intervalTask(180, undefined);
  assert.equal(isTaskDueForDate(task, NOW), true);
});

test("interval-days vencida (concluída há 200 dias, ciclo 180) → due → entra", () => {
  const task = intervalTask(180, new Date("2025-11-17T12:00:00").toISOString());
  assert.equal(isTaskDueForDate(task, NOW), true);
});

test("interval-days exatamente no marco (180 dias) → due", () => {
  const task = intervalTask(180, new Date("2025-12-07T12:00:00").toISOString());
  assert.equal(isTaskDueForDate(task, NOW), true);
});
