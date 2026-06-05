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
    mealPlan: ["m0"],
  });
  // local (dispositivo A): mexeu em finanças
  const local = base({
    financeBudget: { lines: ["x", "novo"] },
    mealPlan: ["m0"],
  });
  // server (dispositivo B): mexeu em refeições
  const server = base({
    financeBudget: { lines: ["x"] },
    mealPlan: ["m0", "m1"],
  });

  const merged = threeWayMergeState(b, local, server);
  assert.deepEqual(merged.financeBudget.lines, ["x", "novo"]); // edição de A mantida
  assert.deepEqual(merged.mealPlan, ["m0", "m1"]); // edição de B mantida
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

test("local não mexeu numa fatia → fica a do server", () => {
  const b = base({ mealPlan: ["m0"] });
  const local = base({ mealPlan: ["m0"] }); // inalterado
  const server = base({ mealPlan: ["m0", "m1"] }); // outro device adicionou

  const merged = threeWayMergeState(b, local, server);
  assert.deepEqual(merged.mealPlan, ["m0", "m1"]);
});

test("completed (booleano de hoje) = OR dos dois lados", () => {
  const b = base({ tasks: [task("t1", [], { completed: false })] });
  const local = base({ tasks: [task("t1", [], { completed: true })] });
  const server = base({ tasks: [task("t1", [], { completed: false })] });

  const merged = threeWayMergeState(b, local, server);
  assert.equal(merged.tasks[0].completed, true);
});
