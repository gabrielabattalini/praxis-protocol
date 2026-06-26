import test from "node:test";
import assert from "node:assert/strict";

/**
 * Defesa em camadas: a linha sincronizada (Mercado/Suplementos
 * sincronizados) é recriada pelo syncShoppingFinanceState a cada
 * hidratação. Quando o user atribui um cartão a essa linha, a escolha é
 * persistida em `shoppingFinancePreferences[scope]` (não só na linha) —
 * assim, mesmo se o KV sincronizar uma versão antiga sem cardId, o sync
 * reaplica a preferência.
 *
 * Também: ter preferência implica paymentMethod = credit-card. Sem isso,
 * o migrateFinanceBudget zerava o cardId achando que a linha não é
 * credit-card.
 */

function syncLine({ existingLine, pref, config }) {
  const resolvedPaymentMethod = pref?.cardId
    ? "credit-card"
    : existingLine?.paymentMethod ?? config.paymentMethod;
  return {
    paymentMethod: resolvedPaymentMethod,
    cardId: existingLine?.cardId ?? pref?.cardId,
    dueDay: existingLine?.dueDay ?? pref?.dueDay,
  };
}

const MARKET_CONFIG = { paymentMethod: "debit-card" };

test("sem preferência: linha sincronizada nasce com config default", () => {
  const result = syncLine({ existingLine: undefined, pref: undefined, config: MARKET_CONFIG });
  assert.equal(result.paymentMethod, "debit-card");
  assert.equal(result.cardId, undefined);
});

test("com preferência: linha vira credit-card e ganha cardId mesmo SEM existingLine", () => {
  const result = syncLine({
    existingLine: undefined,
    pref: { cardId: "inter", dueDay: 15 },
    config: MARKET_CONFIG,
  });
  assert.equal(result.paymentMethod, "credit-card", "ter preferência = credit-card");
  assert.equal(result.cardId, "inter");
  assert.equal(result.dueDay, 15);
});

test("existingLine COM cardId vence — preferência fica como fallback", () => {
  const result = syncLine({
    existingLine: { paymentMethod: "credit-card", cardId: "nubank", dueDay: 20 },
    pref: { cardId: "inter", dueDay: 15 },
    config: MARKET_CONFIG,
  });
  assert.equal(result.cardId, "nubank");
  assert.equal(result.dueDay, 20);
});

test("existingLine SEM cardId mas COM preferência: aplica preferência", () => {
  // Cenário real do bug: KV sincronizou versão antiga sem cardId; a
  // preferência protege a escolha do user.
  const result = syncLine({
    existingLine: { paymentMethod: "credit-card", cardId: undefined, dueDay: undefined },
    pref: { cardId: "inter", dueDay: 15 },
    config: MARKET_CONFIG,
  });
  assert.equal(result.paymentMethod, "credit-card");
  assert.equal(result.cardId, "inter");
  assert.equal(result.dueDay, 15);
});

// Update da preferência quando o user atribui cartão a uma linha managed.
function reducerSlice(state, action) {
  const targetLine = state.financeBudget.lines.find(
    (line) => line.id === action.payload.lineId,
  );
  let nextPrefs = state.shoppingFinancePreferences;
  const managedScope = targetLine?.managedBySystem ? targetLine.syncScope : undefined;
  if (
    managedScope &&
    (action.payload.patch.cardId !== undefined ||
      action.payload.patch.dueDay !== undefined)
  ) {
    const current = nextPrefs?.[managedScope] ?? {};
    nextPrefs = {
      ...(nextPrefs ?? {}),
      [managedScope]: {
        cardId:
          action.payload.patch.cardId !== undefined
            ? action.payload.patch.cardId
            : current.cardId,
        dueDay:
          action.payload.patch.dueDay !== undefined
            ? action.payload.patch.dueDay
            : current.dueDay,
      },
    };
  }
  return { ...state, shoppingFinancePreferences: nextPrefs };
}

test("atribuir cardId a linha sincronizada persiste preferência", () => {
  const state = {
    financeBudget: {
      lines: [{ id: "ln1", managedBySystem: true, syncScope: "market" }],
    },
  };
  const next = reducerSlice(state, {
    payload: { lineId: "ln1", patch: { cardId: "inter" } },
  });
  assert.deepEqual(next.shoppingFinancePreferences, {
    market: { cardId: "inter", dueDay: undefined },
  });
});

test("atribuir a linha NÃO sincronizada NÃO mexe nas preferências", () => {
  const state = {
    financeBudget: { lines: [{ id: "ln1" }] },
    shoppingFinancePreferences: { market: { cardId: "inter" } },
  };
  const next = reducerSlice(state, {
    payload: { lineId: "ln1", patch: { cardId: "nubank" } },
  });
  assert.deepEqual(next.shoppingFinancePreferences, { market: { cardId: "inter" } });
});
