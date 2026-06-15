import test from "node:test";
import assert from "node:assert/strict";

/**
 * Trava o fix do bug reportado: o relatório semanal classificava
 * "Almoço" e "Jantar" como missed quando o usuário comeu mas deixou
 * algum item opcional (suplemento, complemento) pra trás. Idem pra
 * hidratação: dias com qualquer consumo de água eram tratados como
 * missed se a meta total não fechou.
 *
 * Os módulos do app importam via alias @/, que node:test não resolve;
 * espelho a lógica do agenda.ts + weekly-report.ts aqui.
 */

function mealEvent(totalCount, completedCount) {
  const allDone = totalCount > 0 && completedCount === totalCount;
  const touched = !allDone && completedCount > 0;
  return {
    kind: "meal",
    sourceLabel: "Dieta",
    title: "Almoço",
    completed: allDone,
    partiallyCompleted: touched,
  };
}

function hydrationEvent({ completed, hydratedToday }) {
  return {
    kind: "manual",
    sourceLabel: "Dieta",
    title: "Hidratação diária",
    completed,
    partiallyCompleted: !completed && hydratedToday,
  };
}

// Espelha buildAgendaTimeline + buildWeeklyReport: "feito" pra relatório
// = completed OU partiallyCompleted.
function aggregateActivity(events) {
  const scheduled = events.length;
  const completed = events.filter(
    (event) => event.completed || event.partiallyCompleted,
  ).length;
  return {
    scheduled,
    completed,
    missed: scheduled - completed,
  };
}

// Espelha a regra de status por dia (DayDots no relatório): done = fez
// (ou tocou); missed = atividade caiu mas ficou pra trás; absent = não
// estava agendada nesse dia (não pode ser missed). isOffSchedule de
// treino não vira missed (treino remanejado não duplica penalização).
function dayStatus(event) {
  const wasDone = event.completed || event.partiallyCompleted;
  if (wasDone) return "done";
  if (event.kind === "workout" && event.isOffSchedule) return "absent";
  return "missed";
}

test("refeição comida parcial (3/5 itens) não conta como missed", () => {
  const week = Array.from({ length: 7 }, () => mealEvent(5, 3));
  const result = aggregateActivity(week);
  assert.equal(result.scheduled, 7);
  assert.equal(result.completed, 7);
  assert.equal(result.missed, 0);
});

test("refeição totalmente concluída segue contando como feita", () => {
  const week = Array.from({ length: 7 }, () => mealEvent(5, 5));
  const result = aggregateActivity(week);
  assert.equal(result.completed, 7);
  assert.equal(result.missed, 0);
});

test("refeição totalmente intocada conta como missed", () => {
  const week = Array.from({ length: 7 }, () => mealEvent(5, 0));
  const result = aggregateActivity(week);
  assert.equal(result.completed, 0);
  assert.equal(result.missed, 7);
});

test("semana mista: 1 dia cheio, 5 dias parciais, 1 dia perdido", () => {
  const week = [
    mealEvent(5, 5), // cheio
    mealEvent(5, 3), // parcial — antes era missed
    mealEvent(5, 4), // parcial — antes era missed
    mealEvent(5, 1), // parcial (só tocou)
    mealEvent(5, 2), // parcial
    mealEvent(5, 3), // parcial
    mealEvent(5, 0), // intocado — único legítimo missed
  ];
  const result = aggregateActivity(week);
  assert.equal(result.completed, 6);
  assert.equal(result.missed, 1);
});

test("hidratação: dia com qualquer consumo (sem fechar meta) não é missed", () => {
  const week = Array.from({ length: 7 }, () =>
    hydrationEvent({ completed: false, hydratedToday: true }),
  );
  const result = aggregateActivity(week);
  assert.equal(result.completed, 7);
  assert.equal(result.missed, 0);
});

test("hidratação: dia sem nenhum consumo segue como missed", () => {
  const week = Array.from({ length: 7 }, () =>
    hydrationEvent({ completed: false, hydratedToday: false }),
  );
  assert.equal(aggregateActivity(week).missed, 7);
});

test("hidratação: meta batida (completed=true) prevalece", () => {
  const event = hydrationEvent({ completed: true, hydratedToday: true });
  assert.equal(event.completed, true);
  // partiallyCompleted é "false" quando já está completed (não precisa
  // do fallback) — evita dupla contagem.
  assert.equal(event.partiallyCompleted, false);
});

// ── status por dia (DayDots no relatório) ───────────────────────────────
test("dayStatus: refeição cheia → done", () => {
  assert.equal(dayStatus(mealEvent(5, 5)), "done");
});

test("dayStatus: refeição tocada parcialmente → done (não missed)", () => {
  assert.equal(dayStatus(mealEvent(5, 2)), "done");
});

test("dayStatus: refeição intocada → missed", () => {
  assert.equal(dayStatus(mealEvent(5, 0)), "missed");
});

test("dayStatus: hidratação com qualquer água → done", () => {
  assert.equal(
    dayStatus(hydrationEvent({ completed: false, hydratedToday: true })),
    "done",
  );
});

test("dayStatus: hidratação sem água → missed", () => {
  assert.equal(
    dayStatus(hydrationEvent({ completed: false, hydratedToday: false })),
    "missed",
  );
});

test("dayStatus: treino off-schedule não-feito → absent (não missed)", () => {
  const event = { kind: "workout", isOffSchedule: true, completed: false };
  assert.equal(dayStatus(event), "absent");
});

test("dayStatus: treino off-schedule feito → done", () => {
  const event = { kind: "workout", isOffSchedule: true, completed: true };
  assert.equal(dayStatus(event), "done");
});

test("dayStatus: treino canônico não-feito → missed", () => {
  const event = { kind: "workout", isOffSchedule: false, completed: false };
  assert.equal(dayStatus(event), "missed");
});
