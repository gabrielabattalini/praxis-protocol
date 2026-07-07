import test from "node:test";
import assert from "node:assert/strict";

/**
 * Espelha o total de "Saídas imediatas" (pendingCashExpenses) de
 * finance/page.tsx: soma só o que AINDA FALTA pagar por linha à vista =
 * max(valor do mês − já abatido, 0). Linhas já quitadas somem do topo.
 * (@/ não resolve em node:test → replica como spec de regressão.)
 */
const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function settled(line, month) {
  const v = line.settledAmounts?.[month];
  if (typeof v === "number") return round(v);
  return line.settledMonths?.[month] ? round(line.monthly[month] ?? 0) : 0;
}

function pendingCash(lines, month) {
  return round(
    lines
      .filter((l) => l.kind === "expense" && l.paymentMethod !== "credit-card")
      .reduce((sum, line) => {
        const monthValue = round(line.monthly[month] ?? 0);
        return sum + Math.max(monthValue - settled(line, month), 0);
      }, 0),
  );
}

test("só soma o que falta pagar; linhas quitadas saem do total", () => {
  const lines = [
    // pendente: 850
    { kind: "expense", paymentMethod: "auto-debit", monthly: { july: 850 } },
    // pendente: 300
    { kind: "expense", paymentMethod: "auto-debit", monthly: { july: 300 } },
    // quitada por valor: 0 restante
    {
      kind: "expense",
      paymentMethod: "pix",
      monthly: { july: 373.35 },
      settledAmounts: { july: 373.35 },
    },
    // quitada por flag: 0 restante
    {
      kind: "expense",
      paymentMethod: "debit-card",
      monthly: { july: 500 },
      settledMonths: { july: true },
    },
  ];
  assert.equal(pendingCash(lines, "july"), 1150);
});

test("baixa parcial: soma só o restante", () => {
  const lines = [
    {
      kind: "expense",
      paymentMethod: "pix",
      monthly: { july: 1000 },
      settledAmounts: { july: 400 },
    },
  ];
  assert.equal(pendingCash(lines, "july"), 600);
});

test("cartão de crédito não entra nas saídas imediatas", () => {
  const lines = [
    { kind: "expense", paymentMethod: "credit-card", monthly: { july: 999 } },
    { kind: "expense", paymentMethod: "pix", monthly: { july: 100 } },
  ];
  assert.equal(pendingCash(lines, "july"), 100);
});
