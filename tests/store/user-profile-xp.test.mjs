import test from "node:test";
import assert from "node:assert/strict";

/**
 * Trava a nova regra de XP de tarefa: cada DIA em completedDates conta
 * como 1× XP — premia tarefas recorrentes que foram efetivamente feitas
 * em múltiplos dias e baixas retroativas lançadas pela Agenda.
 *
 * Retrocompat: tasks legadas sem completedDates (só com `completed:true`)
 * ainda valem 1× XP, pra não regredir nível de quem usava o app antes
 * do array existir.
 *
 * Mirror da regra (importar mock-data direto no node esbarra em alias @/).
 */

function totalTaskXp(tasks) {
  return tasks.reduce((sum, task) => {
    const dateCount = task.completedDates?.length ?? 0;
    const credits = dateCount > 0 ? dateCount : task.completed ? 1 : 0;
    return sum + task.xp * credits;
  }, 0);
}

test("tarefa daily concluída 5 dias → 5× XP (antes era 1×)", () => {
  const tasks = [
    {
      id: "t",
      xp: 20,
      completed: true,
      completedDates: [
        "2026-06-10",
        "2026-06-11",
        "2026-06-12",
        "2026-06-13",
        "2026-06-14",
      ],
    },
  ];
  assert.equal(totalTaskXp(tasks), 100);
});

test("tarefa daily nunca concluída → 0 XP", () => {
  const tasks = [{ id: "t", xp: 20, completed: false, completedDates: [] }];
  assert.equal(totalTaskXp(tasks), 0);
});

test("one-time concluída → 1× XP (uma data no array)", () => {
  const tasks = [
    { id: "t", xp: 40, completed: true, completedDates: ["2026-06-14"] },
  ];
  assert.equal(totalTaskXp(tasks), 40);
});

test("retrocompat: task legada (completed=true, sem completedDates) → 1× XP", () => {
  const tasks = [{ id: "t", xp: 30, completed: true, completedDates: [] }];
  assert.equal(totalTaskXp(tasks), 30);
});

test("retrocompat: task legada com completedDates=undefined → 1× XP se completed", () => {
  const tasks = [{ id: "t", xp: 30, completed: true }];
  assert.equal(totalTaskXp(tasks), 30);
});

test("desmarcar HOJE (completed=false) mas com baixas em dias passados → conta os dias passados", () => {
  // Cenário pós-fix do toggle: usuário tirou baixa de hoje na Agenda,
  // mas dias 13 e 14 ainda estão na lista. Deve dar 2× XP.
  const tasks = [
    {
      id: "t",
      xp: 20,
      completed: false,
      completedDates: ["2026-06-13", "2026-06-14"],
    },
  ];
  assert.equal(totalTaskXp(tasks), 40);
});

test("soma múltiplas tasks corretamente", () => {
  const tasks = [
    { id: "a", xp: 10, completed: true, completedDates: ["d1", "d2", "d3"] }, // 30
    { id: "b", xp: 25, completed: true, completedDates: ["d1"] }, // 25
    { id: "c", xp: 40, completed: false, completedDates: [] }, // 0
    { id: "d", xp: 15, completed: true }, // 15 (legado)
  ];
  assert.equal(totalTaskXp(tasks), 70);
});
