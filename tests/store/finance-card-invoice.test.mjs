import test from "node:test";
import assert from "node:assert/strict";

/**
 * Espelha a lógica de "fatura por cartão" (Fase 2):
 *  - getTotalCardInvoiceBaseForMonth: base legada + soma das bases por cartão.
 *  - migração da base global do cartão único → base por-cartão.
 *  - commitInvoiceDraft por cartão: base = total digitado - settled das linhas.
 *
 * O alias @/ não resolve em node:test, então a lógica é replicada como spec
 * de regressão (mesma estratégia dos outros testes do módulo finance).
 */

const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function getTotalCardInvoiceBaseForMonth(budget, month) {
  const legacy = budget.cardInvoiceBase?.[month] ?? 0;
  let perCard = 0;
  const byCard = budget.cardInvoiceBaseByCard ?? {};
  for (const cardId of Object.keys(byCard)) {
    perCard += byCard[cardId]?.[month] ?? 0;
  }
  return round(legacy + perCard);
}

test("base total = legada + soma por cartão", () => {
  const budget = {
    cardInvoiceBase: { june: 100 },
    cardInvoiceBaseByCard: {
      inter: { june: 250 },
      nubank: { june: 50 },
    },
  };
  assert.equal(getTotalCardInvoiceBaseForMonth(budget, "june"), 400);
});

test("base total sem por-cartão cai só na legada", () => {
  const budget = { cardInvoiceBase: { june: 100 } };
  assert.equal(getTotalCardInvoiceBaseForMonth(budget, "june"), 100);
});

// Migração: cartão único + base global → base por-cartão, zera a legada.
function migrateSoleCardBase(budget, soleCardId) {
  const invoiceBase = budget.cardInvoiceBase ?? {};
  const hasPerCardBase =
    budget.cardInvoiceBaseByCard &&
    Object.keys(budget.cardInvoiceBaseByCard).length > 0;
  const globalHasValue = Object.values(invoiceBase).some((v) => (v ?? 0) !== 0);
  if (soleCardId && !hasPerCardBase && globalHasValue) {
    return {
      cardInvoiceBase: {},
      cardInvoiceBaseByCard: { [soleCardId]: { ...invoiceBase } },
    };
  }
  return {
    cardInvoiceBase: invoiceBase,
    cardInvoiceBaseByCard: budget.cardInvoiceBaseByCard,
  };
}

test("cartão único: base global migra pra base do cartão e zera a legada", () => {
  const budget = { cardInvoiceBase: { april: 2387.59, may: 1250 } };
  const result = migrateSoleCardBase(budget, "inter");
  assert.deepEqual(result.cardInvoiceBaseByCard, {
    inter: { april: 2387.59, may: 1250 },
  });
  assert.deepEqual(result.cardInvoiceBase, {});
  // O total consolidado não muda após a migração.
  assert.equal(getTotalCardInvoiceBaseForMonth(result, "april"), 2387.59);
});

test("migração da base é idempotente (não roda se já há base por-cartão)", () => {
  const budget = {
    cardInvoiceBase: { april: 100 },
    cardInvoiceBaseByCard: { inter: { april: 2387.59 } },
  };
  const result = migrateSoleCardBase(budget, "inter");
  assert.deepEqual(result.cardInvoiceBaseByCard, { inter: { april: 2387.59 } });
  assert.deepEqual(result.cardInvoiceBase, { april: 100 });
});

test("com 2+ cartões a base global NÃO migra (ambíguo)", () => {
  const budget = { cardInvoiceBase: { april: 100 } };
  const result = migrateSoleCardBase(budget, undefined);
  assert.deepEqual(result.cardInvoiceBase, { april: 100 });
  assert.equal(result.cardInvoiceBaseByCard, undefined);
});

// commitInvoiceDraft por cartão: guarda base = total - settled (>= 0).
function commitCardBase(totalDigitado, settledDoCartao) {
  return Math.max(0, round(totalDigitado - settledDoCartao));
}

test("base do cartão = total digitado - settled das linhas (nunca negativa)", () => {
  assert.equal(commitCardBase(1000, 300), 700);
  assert.equal(commitCardBase(200, 300), 0);
});
