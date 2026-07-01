import test from "node:test";
import assert from "node:assert/strict";

/**
 * Espelha isFinanceSettledInMonth de src/lib/utils.ts.
 * Regressão: linha de valor 0 NÃO pode contar como "já lançado" só
 * porque 0 >= 0 — senão ela aparece riscada como "Já foi lançado na
 * fatura" e o "Desfazer total" nunca sai do estado lançado.
 * (@/ não resolve em node:test → replica a regra.)
 */
const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function getSettledAmount(line, month) {
  const explicit = line.settledAmounts?.[month];
  if (typeof explicit === "number") return round(explicit);
  return line.settledMonths?.[month] ? round(line.monthly[month] ?? 0) : 0;
}

function isSettledInMonth(line, month) {
  const monthValue = round(line.monthly[month] ?? 0);
  if (monthValue <= 0) return false;
  return getSettledAmount(line, month) >= monthValue;
}

test("linha de valor 0 não é considerada lançada (0 >= 0 não conta)", () => {
  const line = { monthly: { august: 0 }, settledMonths: {}, settledAmounts: {} };
  assert.equal(isSettledInMonth(line, "august"), false);
});

test("limpar o settlement de linha 0 mantém ela não-lançada", () => {
  // Antes: mesmo sem settledMonths/settledAmounts, 0 >= 0 dava true e o
  // "Desfazer total" não tinha efeito visível.
  const line = { monthly: { august: 0 }, settledMonths: {}, settledAmounts: {} };
  assert.equal(isSettledInMonth(line, "august"), false);
});

test("linha com valor totalmente lançada continua lançada", () => {
  const line = {
    monthly: { august: 300 },
    settledMonths: { august: true },
    settledAmounts: {},
  };
  assert.equal(isSettledInMonth(line, "august"), true);
});

test("linha com valor parcialmente lançada não conta como lançada", () => {
  const line = {
    monthly: { august: 300 },
    settledMonths: {},
    settledAmounts: { august: 120 },
  };
  assert.equal(isSettledInMonth(line, "august"), false);
});

test("desfazer total (settled → 0) devolve a linha com valor pra pendente", () => {
  const line = {
    monthly: { august: 300 },
    settledMonths: {},
    settledAmounts: { august: 300 },
  };
  assert.equal(isSettledInMonth(line, "august"), true);
  line.settledAmounts.august = 0; // clearFinanceSettlement
  assert.equal(isSettledInMonth(line, "august"), false);
});
