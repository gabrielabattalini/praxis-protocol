import test from "node:test";
import assert from "node:assert/strict";

/**
 * Espelha collectDraftSets (modules/workout/page.tsx).
 *
 * BUG: o salvamento exigia TODAS as séries previstas preenchidas
 * (`sets.some((set) => set === null) return`) e o botão ficava desabilitado
 * sem dizer por quê. Quem fez 2 de 3 séries era obrigado a inventar um "1"
 * na série que não fez, sujando o histórico.
 *
 * REGRA NOVA: série em branco (ou 0) = série PULADA. Só trava se a série
 * estiver pela metade (peso sem repetição ou vice-versa).
 */
function collectDraftSets(planned, weights, reps) {
  const done = [];
  const incomplete = [];
  let skipped = 0;

  for (let setNumber = 1; setNumber <= planned; setNumber += 1) {
    const parsedWeight = Number(weights[setNumber]);
    const parsedRepetitions = Number.parseInt(reps[setNumber] ?? "", 10);
    const hasWeight = Number.isFinite(parsedWeight) && parsedWeight > 0;
    const hasRepetitions =
      Number.isFinite(parsedRepetitions) && parsedRepetitions > 0;

    if (hasWeight && hasRepetitions) {
      done.push({ setNumber, weightKg: parsedWeight, repetitions: parsedRepetitions });
    } else if (hasWeight || hasRepetitions) {
      incomplete.push(setNumber);
    } else {
      skipped += 1;
    }
  }
  return { done, incomplete, skipped };
}

const canSave = (r) => r.done.length > 0 && r.incomplete.length === 0;

test("2 de 3 series salva, e a 3a nao entra no historico", () => {
  const r = collectDraftSets(3, { 1: "20", 2: "20" }, { 1: "10", 2: "8" });
  assert.equal(canSave(r), true);
  assert.equal(r.done.length, 2);
  assert.equal(r.skipped, 1);
  assert.deepEqual(r.done.map((s) => s.setNumber), [1, 2]);
});

test("zero explicito conta como serie pulada (nao como erro)", () => {
  const r = collectDraftSets(3, { 1: "20", 2: "20", 3: "0" }, { 1: "10", 2: "8", 3: "0" });
  assert.equal(canSave(r), true);
  assert.equal(r.done.length, 2);
  assert.equal(r.skipped, 1);
});

test("serie pela metade trava o salvamento e e apontada", () => {
  // peso sem repeticao na 2a
  const r = collectDraftSets(3, { 1: "20", 2: "20" }, { 1: "10" });
  assert.equal(canSave(r), false);
  assert.deepEqual(r.incomplete, [2]);
});

test("repeticao sem peso tambem trava", () => {
  const r = collectDraftSets(2, { 1: "20" }, { 1: "10", 2: "8" });
  assert.equal(canSave(r), false);
  assert.deepEqual(r.incomplete, [2]);
});

test("nada preenchido nao salva", () => {
  const r = collectDraftSets(3, {}, {});
  assert.equal(canSave(r), false);
  assert.equal(r.done.length, 0);
  assert.equal(r.skipped, 3);
});

test("apenas 1 serie de 3 ja permite salvar", () => {
  const r = collectDraftSets(3, { 2: "40" }, { 2: "6" });
  assert.equal(canSave(r), true);
  assert.equal(r.done.length, 1);
  // preserva o numero real da serie executada
  assert.equal(r.done[0].setNumber, 2);
});

test("todas as series preenchidas continua funcionando", () => {
  const r = collectDraftSets(
    3,
    { 1: "20", 2: "22.5", 3: "25" },
    { 1: "12", 2: "10", 3: "8" },
  );
  assert.equal(canSave(r), true);
  assert.equal(r.done.length, 3);
  assert.equal(r.skipped, 0);
  assert.equal(r.done[1].weightKg, 22.5);
});
