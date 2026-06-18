import test from "node:test";
import assert from "node:assert/strict";
import { threeWayMergeState } from "../../src/lib/state-merge.ts";

// Helpers pra montar um PersistedState mínimo (só as chaves usadas).
function task(id, completedDates = [], extra = {}) {
  return {
    id,
    title: `Task ${id}`,
    description: "",
    category: "fitness",
    moduleId: null,
    xp: 40,
    completed: false,
    recurrence: { kind: "daily" },
    completedDates,
    ...extra,
  };
}

function base(overrides = {}) {
  return { tasks: [], mealPlan: [], financeBudget: { lines: [] }, ...overrides };
}

test("fatias disjuntas: A edita finanças, B edita refeições → ambos preservados", () => {
  const b = base({
    financeBudget: { lines: ["x"] },
    mealPlan: [mealBlock("m0", [mealItem("a")])],
  });
  // local (dispositivo A): mexeu em finanças
  const local = base({
    financeBudget: { lines: ["x", "novo"] },
    mealPlan: [mealBlock("m0", [mealItem("a")])],
  });
  // server (dispositivo B): adicionou um bloco de refeição
  const server = base({
    financeBudget: { lines: ["x"] },
    mealPlan: [mealBlock("m0", [mealItem("a")]), mealBlock("m1", [mealItem("b")])],
  });

  const merged = threeWayMergeState(b, local, server);
  assert.deepEqual(merged.financeBudget.lines, ["x", "novo"]); // edição de A mantida
  assert.deepEqual(merged.mealPlan.map((block) => block.id).sort(), ["m0", "m1"]); // edição de B mantida
});

test("tasks: completedDates de cada lado são unidas (nenhuma baixa perdida)", () => {
  const b = base({ tasks: [task("t1", ["2026-06-01"])] });
  // A marcou dia 02
  const local = base({ tasks: [task("t1", ["2026-06-01", "2026-06-02"])] });
  // B marcou dia 03 (na mesma task)
  const server = base({ tasks: [task("t1", ["2026-06-01", "2026-06-03"])] });

  const merged = threeWayMergeState(b, local, server);
  assert.deepEqual(merged.tasks[0].completedDates, [
    "2026-06-01",
    "2026-06-02",
    "2026-06-03",
  ]);
});

test("tasks: criação em cada dispositivo não some no merge", () => {
  const b = base({ tasks: [task("t1")] });
  const local = base({ tasks: [task("t1"), task("tA")] }); // A criou tA
  const server = base({ tasks: [task("t1"), task("tB")] }); // B criou tB

  const merged = threeWayMergeState(b, local, server);
  const ids = merged.tasks.map((t) => t.id).sort();
  assert.deepEqual(ids, ["t1", "tA", "tB"]);
});

test("conflito na mesma fatia não-task: local vence", () => {
  const b = base({ financeBudget: { lines: ["x"] } });
  const local = base({ financeBudget: { lines: ["local"] } });
  const server = base({ financeBudget: { lines: ["server"] } });

  const merged = threeWayMergeState(b, local, server);
  assert.deepEqual(merged.financeBudget.lines, ["local"]);
});

test("local não mexeu numa fatia (coarse) → fica a do server", () => {
  // reminders segue merge grosseiro (não é histórico de conclusão).
  const b = base({ reminders: ["r0"] });
  const local = base({ reminders: ["r0"] }); // inalterado
  const server = base({ reminders: ["r0", "r1"] }); // outro device adicionou

  const merged = threeWayMergeState(b, local, server);
  assert.deepEqual(merged.reminders, ["r0", "r1"]);
});

test("completed (booleano de hoje) = OR dos dois lados", () => {
  const b = base({ tasks: [task("t1", [], { completed: false })] });
  const local = base({ tasks: [task("t1", [], { completed: true })] });
  const server = base({ tasks: [task("t1", [], { completed: false })] });

  const merged = threeWayMergeState(b, local, server);
  assert.equal(merged.tasks[0].completed, true);
});

// ── 3-way: pull do server NÃO ressuscita baixa removida pelo local ─────
//
// Bug reportado: usuário clicava "tirar baixa" na Agenda, toast confirmava,
// mas o pull periódico do servidor (60s) trazia o estado antigo e o merge
// por união simples re-incluía a data tirada. Solução: 3-way usa a BASE
// (último snapshot servidor) pra distinguir "ainda não tem" de "tinha e foi
// removido". Estes testes travam isso.

test("tasks: tirar baixa local NÃO é ressuscitada pelo pull do server", () => {
  const b = base({
    tasks: [
      task("t-acordar", ["2026-06-14"], {
        completed: true,
        completedAt: "2026-06-14T12:00:00.000Z",
      }),
    ],
  });
  // local: usuário tirou baixa do dia 14.
  const local = base({
    tasks: [task("t-acordar", [], { completed: false })],
  });
  // server: ainda não recebeu o save — tem o estado antigo.
  const server = base({
    tasks: [
      task("t-acordar", ["2026-06-14"], {
        completed: true,
        completedAt: "2026-06-14T12:00:00.000Z",
      }),
    ],
  });

  const merged = threeWayMergeState(b, local, server);
  // 14/06 NÃO ressuscita.
  assert.deepEqual(merged.tasks[0].completedDates, undefined);
  // Legado também zera (pra isTaskCompletedForDate não cair no fallback).
  assert.equal(merged.tasks[0].completed, false);
  assert.equal(merged.tasks[0].completedAt, undefined);
});

test("tasks: outro dispositivo adicionou um dia novo — ambos preservados", () => {
  const b = base({ tasks: [task("t", ["2026-06-13"])] });
  // local: tirou baixa do 13 (e nada mais)
  const local = base({ tasks: [task("t", [])] });
  // server: outro device manteve 13 E adicionou 14
  const server = base({ tasks: [task("t", ["2026-06-13", "2026-06-14"])] });

  const merged = threeWayMergeState(b, local, server);
  // 13 some (local removeu); 14 fica (server adicionou).
  assert.deepEqual(merged.tasks[0].completedDates, ["2026-06-14"]);
});

test("tasks: dia adicionado SÓ pelo server (não estava em base) entra", () => {
  const b = base({ tasks: [task("t", [])] });
  const local = base({ tasks: [task("t", [])] });
  const server = base({ tasks: [task("t", ["2026-06-15"])] });

  const merged = threeWayMergeState(b, local, server);
  assert.deepEqual(merged.tasks[0].completedDates, ["2026-06-15"]);
});

test("mealPlan: refeição parcialmente desmarcada não é ressuscitada", () => {
  const b = base({
    mealPlan: [
      mealBlock("lunch", [
        mealItem("a", ["2026-06-13", "2026-06-14"]),
        mealItem("b", ["2026-06-13"]),
      ]),
    ],
  });
  // local: tirou 14 do item a (deixou só 13); manteve b.
  const local = base({
    mealPlan: [
      mealBlock("lunch", [
        mealItem("a", ["2026-06-13"]),
        mealItem("b", ["2026-06-13"]),
      ]),
    ],
  });
  // server: ainda tem o 14 do a.
  const server = base({
    mealPlan: [
      mealBlock("lunch", [
        mealItem("a", ["2026-06-13", "2026-06-14"]),
        mealItem("b", ["2026-06-13"]),
      ]),
    ],
  });

  const merged = threeWayMergeState(b, local, server);
  const lunch = merged.mealPlan[0];
  assert.deepEqual(lunch.items[0].completedDates, ["2026-06-13"]);
  assert.deepEqual(lunch.items[1].completedDates, ["2026-06-13"]);
});

test("workoutDayCompletions: desfazer não é ressuscitado pelo pull", () => {
  const completion = (id, dayId, dateKey) => ({
    id,
    programId: "p1",
    dayId,
    dateKey,
    dayTitle: "Peito",
    completedAt: "2026-06-14T20:00:00Z",
  });
  const b = base({ workoutDayCompletions: [completion("x", "d1", "2026-06-14")] });
  const local = base({ workoutDayCompletions: [] }); // desfez
  const server = base({ workoutDayCompletions: [completion("x", "d1", "2026-06-14")] });

  const merged = threeWayMergeState(b, local, server);
  assert.equal(merged.workoutDayCompletions.length, 0);
});

test("waterEntries: zerar consumo do dia local não é ressuscitado", () => {
  const b = base({ waterEntries: [{ date: "2026-06-14", consumedMl: 2000 }] });
  // local: removeu o registro do dia 14.
  const local = base({ waterEntries: [] });
  // server: ainda tem.
  const server = base({ waterEntries: [{ date: "2026-06-14", consumedMl: 2000 }] });

  const merged = threeWayMergeState(b, local, server);
  assert.equal(merged.waterEntries.length, 0);
});

// ── mealPlan: o bug reportado (almoço/jantar/jejum "voltando") ──────────
function mealItem(id, completedDates = [], extra = {}) {
  return {
    id,
    label: `Item ${id}`,
    quantityLabel: "1x",
    kind: "food",
    macros: {},
    completedDates,
    ...extra,
  };
}
function mealBlock(id, items) {
  return { id, title: `Bloco ${id}`, time: "12:00", category: "lunch", items };
}

test("mealPlan: baixa no app + baixa no Telegram não se sobrescrevem", () => {
  // BASE: almoço com 2 itens, nenhum marcado.
  const b = base({
    mealPlan: [mealBlock("lunch", [mealItem("a"), mealItem("b")])],
  });
  // LOCAL (app): marcou o item "a" nos dias 02 e 03.
  const local = base({
    mealPlan: [
      mealBlock("lunch", [
        mealItem("a", ["2026-06-02", "2026-06-03"]),
        mealItem("b"),
      ]),
    ],
  });
  // SERVER (veio do Telegram): marcou o item "a" no dia 04 e o "b" no 02.
  const server = base({
    mealPlan: [
      mealBlock("lunch", [
        mealItem("a", ["2026-06-04"]),
        mealItem("b", ["2026-06-02"]),
      ]),
    ],
  });

  const merged = threeWayMergeState(b, local, server);
  const lunch = merged.mealPlan[0];
  // Item "a": união dos 3 dias dos dois lados.
  assert.deepEqual(lunch.items[0].completedDates, [
    "2026-06-02",
    "2026-06-03",
    "2026-06-04",
  ]);
  // Item "b": dia do server preservado mesmo o local não tendo mexido.
  assert.deepEqual(lunch.items[1].completedDates, ["2026-06-02"]);
});

test("mealPlan: item novo criado em cada lado é preservado", () => {
  const b = base({ mealPlan: [mealBlock("lunch", [mealItem("a")])] });
  const local = base({
    mealPlan: [mealBlock("lunch", [mealItem("a"), mealItem("loc")])],
  });
  const server = base({
    mealPlan: [mealBlock("lunch", [mealItem("a"), mealItem("srv")])],
  });
  const merged = threeWayMergeState(b, local, server);
  const ids = merged.mealPlan[0].items.map((i) => i.id).sort();
  assert.deepEqual(ids, ["a", "loc", "srv"]);
});

test("mealPlan: bloco só no server (outro device) entra no merge", () => {
  const b = base({ mealPlan: [mealBlock("lunch", [mealItem("a")])] });
  const local = base({ mealPlan: [mealBlock("lunch", [mealItem("a")])] });
  const server = base({
    mealPlan: [
      mealBlock("lunch", [mealItem("a")]),
      mealBlock("dinner", [mealItem("d", ["2026-06-02"])]),
    ],
  });
  const merged = threeWayMergeState(b, local, server);
  assert.equal(merged.mealPlan.length, 2);
  assert.deepEqual(
    merged.mealPlan.find((b) => b.id === "dinner").items[0].completedDates,
    ["2026-06-02"],
  );
});

// ── waterEntries: maior consumo por dia, união de dias ──────────────────
test("waterEntries: fica o maior consumo por dia e une as datas", () => {
  const b = base({ waterEntries: [{ date: "2026-06-01", consumedMl: 500 }] });
  const local = base({
    waterEntries: [
      { date: "2026-06-01", consumedMl: 2000 }, // bebeu mais no app
      { date: "2026-06-02", consumedMl: 1500 },
    ],
  });
  const server = base({
    waterEntries: [
      { date: "2026-06-01", consumedMl: 1000 },
      { date: "2026-06-03", consumedMl: 800 }, // dia só no server
    ],
  });
  const merged = threeWayMergeState(b, local, server);
  const byDate = Object.fromEntries(
    merged.waterEntries.map((e) => [e.date, e.consumedMl]),
  );
  assert.deepEqual(byDate, {
    "2026-06-01": 2000,
    "2026-06-02": 1500,
    "2026-06-03": 800,
  });
});

// ── conclusões de treino: dedupe por (programa, dia, data) ──────────────
test("workoutDayCompletions: une sem duplicar a mesma conclusão lógica", () => {
  const completion = (id, dayId, dateKey) => ({
    id,
    programId: "p1",
    dayId,
    dateKey,
    dayTitle: "Peito",
    completedAt: "2026-06-02T10:00:00Z",
  });
  const b = base({ workoutDayCompletions: [] });
  // Mesma conclusão lógica (p1/d1/02) marcada nos dois lados com ids
  // diferentes — não pode virar duplicata.
  const local = base({
    workoutDayCompletions: [completion("x1", "d1", "2026-06-02")],
  });
  const server = base({
    workoutDayCompletions: [
      completion("y1", "d1", "2026-06-02"), // duplicata lógica
      completion("y2", "d2", "2026-06-03"), // outro dia, do server
    ],
  });
  const merged = threeWayMergeState(b, local, server);
  assert.equal(merged.workoutDayCompletions.length, 2);
  const keys = merged.workoutDayCompletions
    .map((c) => `${c.dayId}:${c.dateKey}`)
    .sort();
  assert.deepEqual(keys, ["d1:2026-06-02", "d2:2026-06-03"]);
});

// ── workoutLoadEntries: união por id ────────────────────────────────────
test("workoutLoadEntries: logs dos dois lados são unidos por id", () => {
  const entry = (id) => ({ id, key: id, programId: "p", dayId: "d", dayTitle: "x", exerciseId: "e", exerciseName: "Supino", setNumber: 1, weightKg: 80, repetitions: 10, loggedAt: "2026-06-02T10:00:00Z" });
  const b = base({ workoutLoadEntries: [entry("l0")] });
  const local = base({ workoutLoadEntries: [entry("l0"), entry("l1")] });
  const server = base({ workoutLoadEntries: [entry("l0"), entry("l2")] });
  const merged = threeWayMergeState(b, local, server);
  assert.deepEqual(
    merged.workoutLoadEntries.map((e) => e.id).sort(),
    ["l0", "l1", "l2"],
  );
});
