import test from "node:test";
import assert from "node:assert/strict";

/**
 * Espelha o reducer "clear-finance-card-invoice-month": marcar a fatura
 * de UM cartão como paga zera as linhas daquele cartão SÓ naquele mês
 * (valor, baixa e flag) e a base manual da fatura desse cartão no mês.
 * Outros meses e outros cartões ficam intactos.
 */
function clearCardInvoiceMonth(budget, cardId, month) {
  const lines = budget.lines.map((line) => {
    if (line.cardId !== cardId) return line;
    return {
      ...line,
      monthly: { ...line.monthly, [month]: 0 },
      settledAmounts: { ...(line.settledAmounts ?? {}), [month]: 0 },
      settledMonths: { ...(line.settledMonths ?? {}), [month]: false },
    };
  });
  const byCard = { ...(budget.cardInvoiceBaseByCard ?? {}) };
  if (byCard[cardId]) byCard[cardId] = { ...byCard[cardId], [month]: 0 };
  return { ...budget, lines, cardInvoiceBaseByCard: byCard };
}

test("zera valor, baixa e base do cartão só no mês alvo", () => {
  const budget = {
    lines: [
      {
        id: "l1",
        cardId: "inter",
        monthly: { june: 500, july: 500 },
        settledAmounts: { july: 500 },
        settledMonths: { july: true },
      },
    ],
    cardInvoiceBaseByCard: { inter: { june: 100, july: 300 } },
  };
  const next = clearCardInvoiceMonth(budget, "inter", "july");
  const l = next.lines[0];
  assert.equal(l.monthly.july, 0);
  assert.equal(l.settledAmounts.july, 0);
  assert.equal(l.settledMonths.july, false);
  assert.equal(next.cardInvoiceBaseByCard.inter.july, 0);
  // Junho intacto.
  assert.equal(l.monthly.june, 500);
  assert.equal(next.cardInvoiceBaseByCard.inter.june, 100);
});

test("não mexe em outros cartões", () => {
  const budget = {
    lines: [
      { id: "a", cardId: "inter", monthly: { july: 500 } },
      { id: "b", cardId: "nubank", monthly: { july: 200 }, settledMonths: { july: true } },
    ],
    cardInvoiceBaseByCard: { inter: { july: 50 }, nubank: { july: 80 } },
  };
  const next = clearCardInvoiceMonth(budget, "inter", "july");
  const nubank = next.lines.find((l) => l.id === "b");
  assert.equal(nubank.monthly.july, 200);
  assert.equal(nubank.settledMonths.july, true);
  assert.equal(next.cardInvoiceBaseByCard.nubank.july, 80);
  assert.equal(next.cardInvoiceBaseByCard.inter.july, 0);
});
