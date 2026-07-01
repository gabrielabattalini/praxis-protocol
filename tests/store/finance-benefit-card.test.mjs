import test from "node:test";
import assert from "node:assert/strict";

/**
 * Espelha a lógica de cartão-vale (benefit) de src/lib/utils.ts:
 *  - saldo ACUMULA de recharge.startMonth até o mês atual:
 *    saldo = (recarga × meses) − (gastos no período).
 *  - gastos em cartão-vale ficam FORA do orçamento.
 * (@/ não resolve em node:test → replica como spec de regressão.)
 */
const MONTHS = [
  "january","february","march","april","may","june",
  "july","august","september","october","november","december",
];
const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// settled simplificado: usa settledAmounts[m] se número, senão 0.
function settled(line, m) {
  const v = line.settledAmounts?.[m];
  return typeof v === "number" ? v : 0;
}

function getBalance(budget, cardId, month) {
  const card = (budget.cards ?? []).find((c) => c.id === cardId);
  const recharge = card?.recharge;
  const endIdx = MONTHS.indexOf(month);
  const startIdx = recharge ? Math.max(0, MONTHS.indexOf(recharge.startMonth)) : 0;
  const monthsCount = endIdx >= startIdx ? endIdx - startIdx + 1 : 0;
  const recharged = round((recharge?.amount ?? 0) * monthsCount);
  let spent = 0;
  for (let i = startIdx; i <= endIdx && i >= 0; i += 1) {
    const m = MONTHS[i];
    for (const line of budget.lines) {
      if (line.kind === "expense" && line.cardId === cardId) spent += settled(line, m);
    }
  }
  spent = round(spent);
  const adjustment = round(card?.manualBalanceAdjustment ?? 0);
  return {
    recharged,
    spent,
    adjustment,
    balance: round(recharged - spent + adjustment),
    monthsCount,
  };
}

test("saldo acumula da startMonth até o mês (recarga × meses − gastos)", () => {
  const budget = {
    cards: [
      { id: "vale", type: "benefit", recharge: { amount: 600, dayOfMonth: 5, startMonth: "may" } },
    ],
    lines: [
      {
        id: "l1",
        kind: "expense",
        cardId: "vale",
        settledAmounts: { may: 400, june: 500 },
      },
    ],
  };
  // maio→julho = 3 meses × 600 = 1800; gasto 900; saldo 900.
  const r = getBalance(budget, "vale", "july");
  assert.equal(r.recharged, 1800);
  assert.equal(r.spent, 900);
  assert.equal(r.balance, 900);
});

test("antes da startMonth: sem recarga (monthsCount 0)", () => {
  const budget = {
    cards: [
      { id: "vale", type: "benefit", recharge: { amount: 250, dayOfMonth: 5, startMonth: "june" } },
    ],
    lines: [],
  };
  const r = getBalance(budget, "vale", "may");
  assert.equal(r.monthsCount, 0);
  assert.equal(r.recharged, 0);
  assert.equal(r.balance, 0);
});

test("saldo pode ficar negativo se gastar mais que a recarga", () => {
  const budget = {
    cards: [
      { id: "vale", type: "benefit", recharge: { amount: 250, dayOfMonth: 5, startMonth: "july" } },
    ],
    lines: [
      { id: "l1", kind: "expense", cardId: "vale", settledAmounts: { july: 400 } },
    ],
  };
  const r = getBalance(budget, "vale", "july");
  assert.equal(r.recharged, 250);
  assert.equal(r.spent, 400);
  assert.equal(r.balance, -150);
});

// Exclusão do orçamento: linha em cartão-vale não conta nos gastos.
function benefitCardIds(budget) {
  return new Set((budget.cards ?? []).filter((c) => c.type === "benefit").map((c) => c.id));
}
function isBenefitLine(line, ids) {
  return Boolean(line.cardId && ids.has(line.cardId));
}

test("gasto em cartão-vale é excluído do orçamento; crédito normal não", () => {
  const budget = {
    cards: [
      { id: "vale", type: "benefit" },
      { id: "inter", type: "credit" },
    ],
    lines: [
      { id: "l1", kind: "expense", cardId: "vale" },
      { id: "l2", kind: "expense", cardId: "inter" },
      { id: "l3", kind: "expense" }, // sem cartão
    ],
  };
  const ids = benefitCardIds(budget);
  const orcamento = budget.lines.filter(
    (l) => l.kind === "expense" && !isBenefitLine(l, ids),
  );
  assert.deepEqual(orcamento.map((l) => l.id), ["l2", "l3"]);
});

test("ajuste manual soma no saldo (recarga − gastos + ajuste)", () => {
  const budget = {
    cards: [
      {
        id: "vale",
        type: "benefit",
        manualBalanceAdjustment: 180,
        recharge: { amount: 600, dayOfMonth: 5, startMonth: "july" },
      },
    ],
    lines: [
      { id: "l1", kind: "expense", cardId: "vale", settledAmounts: { july: 100 } },
    ],
  };
  // julho: recarga 600 − gasto 100 + ajuste 180 = 680.
  const r = getBalance(budget, "vale", "july");
  assert.equal(r.recharged, 600);
  assert.equal(r.spent, 100);
  assert.equal(r.adjustment, 180);
  assert.equal(r.balance, 680);
});

test("saldo desejado vira ajuste = desejado − (recarga − gastos)", () => {
  // Espelha commitBalanceDraft: usuário digita o saldo real e guardamos
  // o ajuste relativo ao calculado, pra recargas futuras entrarem por cima.
  const budget = {
    cards: [
      { id: "vale", type: "benefit", recharge: { amount: 250, dayOfMonth: 5, startMonth: "july" } },
    ],
    lines: [
      { id: "l1", kind: "expense", cardId: "vale", settledAmounts: { july: 50 } },
    ],
  };
  const before = getBalance(budget, "vale", "july"); // 250 − 50 = 200
  const desired = 430;
  const adjustment = round(desired - (before.recharged - before.spent));
  assert.equal(adjustment, 230);
  budget.cards[0].manualBalanceAdjustment = adjustment;
  const after = getBalance(budget, "vale", "july");
  assert.equal(after.balance, 430);
});

test("card sem type é tratado como crédito (retrocompat)", () => {
  const budget = { cards: [{ id: "c1" }], lines: [] };
  assert.equal(benefitCardIds(budget).has("c1"), false);
});
