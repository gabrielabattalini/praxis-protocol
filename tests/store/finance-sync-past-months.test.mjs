import test from "node:test";
import assert from "node:assert/strict";

/**
 * Espelha buildSyncedMonthly (app-store-provider.tsx).
 *
 * BUG ORIGINAL: o sync de Mercado/Suplementos fazia fillFinanceMonths(valor),
 * gravando o MESMO valor nos 12 meses a cada hydrate (todo load/foco). Meses
 * já fechados voltavam a valer — era a origem do "-509,49 em todos os meses".
 *
 * REGRAS NOVAS: passado congelado, mês fechado preservado, atual/futuro
 * recebe o valor novo. Mais uma limpeza única do resíduo do fan-out antigo.
 */
const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function buildSyncedMonthly(value, previous, closedMonths, cleanupPastResidue, currentIndex) {
  return MONTHS.reduce((monthly, month, index) => {
    const previousValue = round(previous?.[month] ?? 0);
    if (index < currentIndex) {
      monthly[month] = cleanupPastResidue ? 0 : previousValue;
    } else if (closedMonths?.[month]) {
      monthly[month] = previousValue;
    } else {
      monthly[month] = round(value);
    }
    return monthly;
  }, {});
}

const JULY = 6;

test("nao reescreve meses passados (passado congelado)", () => {
  // Usuario fechou jan-jun (zerados) e tem 509,49 em jul.
  const previous = {};
  MONTHS.forEach((m, i) => { previous[m] = i < JULY ? 0 : 509.49; });

  const next = buildSyncedMonthly(509.49, previous, undefined, false, JULY);

  for (let i = 0; i < JULY; i += 1) {
    assert.equal(next[MONTHS[i]], 0, `${MONTHS[i]} nao pode ressuscitar`);
  }
  assert.equal(next.july, 509.49);
});

test("limpeza unica zera o residuo do fan-out antigo nos meses passados", () => {
  // Estado sujo: 509,49 nos 12 meses (fan-out antigo).
  const previous = {};
  MONTHS.forEach((m) => { previous[m] = 509.49; });

  const next = buildSyncedMonthly(509.49, previous, undefined, true, JULY);

  for (let i = 0; i < JULY; i += 1) {
    assert.equal(next[MONTHS[i]], 0, `${MONTHS[i]} devia ser limpo`);
  }
  assert.equal(next.july, 509.49);
  assert.equal(next.december, 509.49);
});

test("mes fechado no presente/futuro nao volta a valer", () => {
  const previous = {};
  MONTHS.forEach((m) => { previous[m] = 0; });

  const next = buildSyncedMonthly(
    509.49,
    previous,
    { july: true, august: true },
    false,
    JULY,
  );

  assert.equal(next.july, 0, "julho fechado deve continuar zerado");
  assert.equal(next.august, 0, "agosto fechado deve continuar zerado");
  assert.equal(next.september, 509.49, "setembro (aberto) recebe o valor");
});

test("hydrate repetido e idempotente (nao acumula nem ressuscita)", () => {
  const previous = {};
  MONTHS.forEach((m, i) => { previous[m] = i < JULY ? 0 : 509.49; });

  let atual = buildSyncedMonthly(509.49, previous, undefined, false, JULY);
  for (let i = 0; i < 5; i += 1) {
    atual = buildSyncedMonthly(509.49, atual, undefined, false, JULY);
  }

  assert.equal(atual.january, 0);
  assert.equal(atual.june, 0);
  assert.equal(atual.july, 509.49);
});

test("mudanca na lista de compras atualiza mes atual e futuros, nao o passado", () => {
  const previous = {};
  MONTHS.forEach((m, i) => { previous[m] = i < JULY ? 0 : 509.49; });

  const next = buildSyncedMonthly(700, previous, undefined, false, JULY);

  assert.equal(next.june, 0, "passado intocado");
  assert.equal(next.july, 700, "mes atual atualiza");
  assert.equal(next.december, 700, "futuro atualiza");
});
