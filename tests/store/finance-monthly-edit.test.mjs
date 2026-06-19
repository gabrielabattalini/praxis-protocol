import test from "node:test";
import assert from "node:assert/strict";

/**
 * Espelha as funções do reducer finance que mudaram pra resolver os
 * pedidos do usuário:
 *  1. Linha "fixa" criada a partir de um mês não propaga pros meses
 *     ANTERIORES (antes do initialMonth).
 *  2. Editar valor de um único mês não propaga pros 12. Se a linha era
 *     "fixed" e o novo valor destoa, vira "variable".
 *
 * Não importa o módulo direto (alias @/ não resolve em node:test).
 */

const monthOrder = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function fillFinanceMonthsFrom(value, startMonth) {
  const startIndex = monthOrder.indexOf(startMonth);
  const out = {};
  monthOrder.forEach((month, index) => {
    out[month] = index < startIndex ? 0 : round(value);
  });
  return out;
}

// Espelha update-finance-monthly-value (parte relevante).
function updateMonthlyValue(line, month, value) {
  const nextValue = round(value);
  const monthly = { ...line.monthly, [month]: nextValue };
  let nextFrequency = line.frequency;
  if (line.frequency === "fixed") {
    const otherValues = monthOrder
      .filter((m) => m !== month)
      .map((m) => round(monthly[m] ?? 0));
    const someNonZero = otherValues.find((v) => v > 0);
    if (someNonZero !== undefined && someNonZero !== nextValue) {
      nextFrequency = "variable";
    }
  }
  return { ...line, frequency: nextFrequency, monthly };
}

// ── fillFinanceMonthsFrom ───────────────────────────────────────────────

test("linha fixa lançada em agosto NÃO preenche jan-jul", () => {
  const monthly = fillFinanceMonthsFrom(600, "august");
  assert.equal(monthly.january, 0);
  assert.equal(monthly.february, 0);
  assert.equal(monthly.june, 0);
  assert.equal(monthly.july, 0);
  assert.equal(monthly.august, 600);
  assert.equal(monthly.september, 600);
  assert.equal(monthly.december, 600);
});

test("linha fixa lançada em janeiro preenche todos os meses", () => {
  const monthly = fillFinanceMonthsFrom(100, "january");
  for (const month of monthOrder) {
    assert.equal(monthly[month], 100, `${month} deveria ser 100`);
  }
});

test("linha fixa lançada em dezembro só preenche dezembro", () => {
  const monthly = fillFinanceMonthsFrom(500, "december");
  for (const month of monthOrder) {
    if (month === "december") {
      assert.equal(monthly[month], 500);
    } else {
      assert.equal(monthly[month], 0, `${month} deveria ser 0`);
    }
  }
});

// ── update-finance-monthly-value: NÃO propaga ──────────────────────────

test("editar valor de UM mês isolado em linha 'fixed' NÃO propaga", () => {
  const line = {
    id: "x",
    frequency: "fixed",
    monthly: monthOrder.reduce((acc, m) => ({ ...acc, [m]: 500 }), {}),
  };
  const next = updateMonthlyValue(line, "august", 800);
  // Só agosto mudou.
  assert.equal(next.monthly.august, 800);
  for (const m of monthOrder) {
    if (m === "august") continue;
    assert.equal(next.monthly[m], 500, `${m} não deveria ter mudado`);
  }
  // Como agora um mês destoa dos outros, vira "variable".
  assert.equal(next.frequency, "variable");
});

test("zerar o valor de UM mês em linha 'fixed' (remover deste mês) vira variable", () => {
  const line = {
    id: "x",
    frequency: "fixed",
    monthly: monthOrder.reduce((acc, m) => ({ ...acc, [m]: 600 }), {}),
  };
  const next = updateMonthlyValue(line, "july", 0);
  assert.equal(next.monthly.july, 0);
  assert.equal(next.monthly.august, 600); // continua
  assert.equal(next.frequency, "variable");
});

test("setar o MESMO valor que já existe nos outros meses mantém 'fixed'", () => {
  const line = {
    id: "x",
    frequency: "fixed",
    monthly: monthOrder.reduce((acc, m) => ({ ...acc, [m]: 500 }), {}),
  };
  // Setar agosto pro mesmo 500 que está em todos: continua fixed.
  const next = updateMonthlyValue(line, "august", 500);
  assert.equal(next.frequency, "fixed");
});

test("linha 'variable' editada continua 'variable' (não promove a fixed)", () => {
  const line = {
    id: "x",
    frequency: "variable",
    monthly: { ...monthOrder.reduce((a, m) => ({ ...a, [m]: 0 }), {}), august: 100 },
  };
  const next = updateMonthlyValue(line, "september", 200);
  assert.equal(next.frequency, "variable");
  assert.equal(next.monthly.august, 100);
  assert.equal(next.monthly.september, 200);
});

test("zerar o ÚNICO mês com valor em 'fixed' (linha vazia) — fica fixed (tudo 0)", () => {
  // Cenário borda: linha fixed criada em dezembro (só dez tem valor).
  // Setar dezembro pra 0 → todos os meses são 0 → não há "outro" destoante.
  const monthly = monthOrder.reduce((acc, m) => ({ ...acc, [m]: 0 }), {});
  monthly.december = 100;
  const line = { id: "x", frequency: "fixed", monthly };
  const next = updateMonthlyValue(line, "december", 0);
  assert.equal(next.frequency, "fixed"); // todos zerados, sem destoante
  for (const m of monthOrder) assert.equal(next.monthly[m], 0);
});
