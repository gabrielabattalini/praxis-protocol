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

// Migração: cartão único migra base global → base por-cartão; SEMPRE
// zera a base legada (base "sem cartão" não é mais permitida).
function migrateSoleCardBase(budget, soleCardId) {
  const invoiceBase = budget.cardInvoiceBase ?? {};
  const hasPerCardBase =
    budget.cardInvoiceBaseByCard &&
    Object.keys(budget.cardInvoiceBaseByCard).length > 0;
  const globalHasValue = Object.values(invoiceBase).some((v) => (v ?? 0) !== 0);
  let finalByCard = budget.cardInvoiceBaseByCard;
  if (soleCardId && !hasPerCardBase && globalHasValue) {
    finalByCard = { [soleCardId]: { ...invoiceBase } };
  }
  // SEMPRE zera a legada.
  return { cardInvoiceBase: {}, cardInvoiceBaseByCard: finalByCard };
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
  // A base legada é zerada mesmo no caso idempotente — não é permitida.
  assert.deepEqual(result.cardInvoiceBase, {});
});

test("com 2+ cartões: base legada some (não migra pra ninguém, é descartada)", () => {
  const budget = { cardInvoiceBase: { april: 1396.46 } };
  const result = migrateSoleCardBase(budget, undefined);
  assert.deepEqual(result.cardInvoiceBase, {});
  assert.equal(result.cardInvoiceBaseByCard, undefined);
  // O valor "sem cartão" some do total consolidado.
  assert.equal(getTotalCardInvoiceBaseForMonth(result, "april"), 0);
});

// Reducer: só aceita base se cardId existe e não está arquivado.
function reduceInvoiceBase(state, action) {
  const cardId = action.payload.cardId;
  if (!cardId) return state;
  const cardExists = (state.cards ?? []).some(
    (c) => c.id === cardId && !c.archived,
  );
  if (!cardExists) return state;
  const value = action.payload.value;
  const byCard = state.cardInvoiceBaseByCard ?? {};
  const cardMonths = byCard[cardId] ?? {};
  return {
    ...state,
    cardInvoiceBaseByCard: {
      ...byCard,
      [cardId]: { ...cardMonths, [action.payload.month]: value },
    },
  };
}

test("reducer rejeita base sem cardId", () => {
  const state = { cards: [{ id: "inter" }], cardInvoiceBaseByCard: {} };
  const next = reduceInvoiceBase(state, {
    payload: { month: "june", value: 100 },
  });
  assert.equal(next, state, "retorna o state intacto");
});

test("reducer rejeita base apontando pra cartão inexistente", () => {
  const state = { cards: [{ id: "inter" }], cardInvoiceBaseByCard: {} };
  const next = reduceInvoiceBase(state, {
    payload: { month: "june", value: 100, cardId: "fantasma" },
  });
  assert.equal(next, state);
});

test("reducer rejeita base apontando pra cartão arquivado", () => {
  const state = {
    cards: [{ id: "inter", archived: true }],
    cardInvoiceBaseByCard: {},
  };
  const next = reduceInvoiceBase(state, {
    payload: { month: "june", value: 100, cardId: "inter" },
  });
  assert.equal(next, state);
});

test("reducer aceita base com cardId válido", () => {
  const state = { cards: [{ id: "inter" }], cardInvoiceBaseByCard: {} };
  const next = reduceInvoiceBase(state, {
    payload: { month: "june", value: 500, cardId: "inter" },
  });
  assert.deepEqual(next.cardInvoiceBaseByCard, { inter: { june: 500 } });
});

// Regressão: o sync das linhas Mercado/Suplementos sincronizadas precisa
// preservar cardId e dueDay (escolhas do usuário sobre o lançamento) —
// senão eles somem a cada rodada de sync.
function syncShoppingLine(existingLine, scope, nextAmount) {
  if (nextAmount <= 0) return null;
  return {
    id: existingLine?.id ?? "new-id",
    name: scope === "market" ? "Mercado sincronizado" : "Suplementos sincronizados",
    kind: "expense",
    category: scope === "market" ? "Mercado" : "Saúde",
    frequency: "fixed",
    paymentMethod: existingLine?.paymentMethod ?? "credit-card",
    cardId: existingLine?.cardId,
    dueDay: existingLine?.dueDay,
    managedBySystem: true,
    syncScope: scope,
    monthly: { june: nextAmount },
  };
}

test("sync preserva cardId da linha Mercado/Suplementos sincronizada", () => {
  const existing = {
    id: "fin-1",
    cardId: "inter",
    dueDay: 15,
    paymentMethod: "credit-card",
  };
  const next = syncShoppingLine(existing, "market", 500);
  assert.equal(next.cardId, "inter", "cardId é preservado");
  assert.equal(next.dueDay, 15, "dueDay é preservado");
});

test("sync de linha nova (sem existing) cria sem cardId", () => {
  const next = syncShoppingLine(undefined, "supplements", 200);
  assert.equal(next.cardId, undefined);
  assert.equal(next.dueDay, undefined);
});

// commitInvoiceDraft por cartão: guarda base = total - settled (>= 0).
function commitCardBase(totalDigitado, settledDoCartao) {
  return Math.max(0, round(totalDigitado - settledDoCartao));
}

test("base do cartão = total digitado - settled das linhas (nunca negativa)", () => {
  assert.equal(commitCardBase(1000, 300), 700);
  assert.equal(commitCardBase(200, 300), 0);
});
