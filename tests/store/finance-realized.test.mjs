import test from "node:test";
import assert from "node:assert/strict";

/**
 * Espelha a visão "realizado" dos cards de mês (getFinanceMonthSummaries):
 *  - receivedIncome = só o que foi dado baixa nas receitas (recebido).
 *  - realizedBalance = recebido − gastos já pagos/lançados no mês.
 * Diferente do previsto (soma dos monthly). (@/ não resolve em node:test.)
 */
const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function settled(line, month) {
  const v = line.settledAmounts?.[month];
  if (typeof v === "number") return round(v);
  return line.settledMonths?.[month] ? round(line.monthly[month] ?? 0) : 0;
}

function summary(lines, month) {
  const income = round(
    lines
      .filter((l) => l.kind === "income")
      .reduce((s, l) => s + (l.monthly[month] ?? 0), 0),
  );
  const receivedIncome = round(
    lines
      .filter((l) => l.kind === "income")
      .reduce((s, l) => s + settled(l, month), 0),
  );
  const expenses = round(
    lines
      .filter((l) => l.kind === "expense")
      .reduce((s, l) => s + settled(l, month), 0),
  );
  return {
    income,
    receivedIncome,
    expenses,
    realizedBalance: round(receivedIncome - expenses),
  };
}

test("realizado só conta receita recebida e gasto pago", () => {
  const lines = [
    { kind: "income", monthly: { july: 3000 } }, // previsto, nada recebido
    { kind: "expense", monthly: { july: 509.49 }, settledAmounts: { july: 509.49 } },
  ];
  const r = summary(lines, "july");
  assert.equal(r.income, 3000); // previsto
  assert.equal(r.receivedIncome, 0); // nada dado baixa
  assert.equal(r.expenses, 509.49); // pago
  assert.equal(r.realizedBalance, -509.49);
});

test("após receber a entrada, realizado zera/positiva", () => {
  const lines = [
    { kind: "income", monthly: { july: 3000 }, settledAmounts: { july: 3000 } },
    { kind: "expense", monthly: { july: 509.49 }, settledMonths: { july: true } },
  ];
  const r = summary(lines, "july");
  assert.equal(r.receivedIncome, 3000);
  assert.equal(r.expenses, 509.49);
  assert.equal(r.realizedBalance, round(3000 - 509.49));
});

test("recebimento parcial soma só a parte recebida", () => {
  const lines = [
    { kind: "income", monthly: { july: 1000 }, settledAmounts: { july: 400 } },
  ];
  const r = summary(lines, "july");
  assert.equal(r.receivedIncome, 400);
  assert.equal(r.realizedBalance, 400);
});
