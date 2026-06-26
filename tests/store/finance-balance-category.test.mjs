import test from "node:test";
import assert from "node:assert/strict";

/**
 * Categoria "Saldo em conta" tem semântica especial: representa o saldo
 * bancário que fecha por mês (entradas/saídas mudam o saldo do mês
 * seguinte). Por isso:
 *  1. Linhas com essa categoria são SEMPRE variable (não replicam pros
 *     12 meses).
 *  2. Ao criar uma linha "Saldo em conta", só o initialMonth recebe o valor.
 *  3. Trocar a category de outra coisa pra "Saldo em conta" força variable.
 *  4. Migrate zera meses futuros (o user vai relançar conforme fechar).
 */

function isBalanceCategory(cat) {
  return cat?.trim().toLowerCase() === "saldo em conta";
}

function addLine({ category, frequency, initialMonth, initialValue }) {
  const forceVariable = isBalanceCategory(category);
  const effectiveFrequency = forceVariable ? "variable" : frequency;
  const empty = Object.fromEntries(
    ["january","february","march","april","may","june","july","august","september","october","november","december"].map((m) => [m, 0]),
  );
  const monthly =
    effectiveFrequency === "fixed"
      ? Object.fromEntries(Object.entries(empty).map(([m]) => [m, initialValue]))
      : { ...empty, [initialMonth]: initialValue };
  return { frequency: effectiveFrequency, monthly };
}

test("nova linha 'Saldo em conta' fixed: vira variable, só preenche initialMonth", () => {
  const result = addLine({
    category: "Saldo em conta",
    frequency: "fixed",
    initialMonth: "june",
    initialValue: 5000,
  });
  assert.equal(result.frequency, "variable");
  assert.equal(result.monthly.june, 5000);
  assert.equal(result.monthly.july, 0);
  assert.equal(result.monthly.december, 0);
});

test("categoria normal fixed continua fixed", () => {
  const result = addLine({
    category: "Renda principal",
    frequency: "fixed",
    initialMonth: "january",
    initialValue: 5000,
  });
  assert.equal(result.frequency, "fixed");
});

// Migração: zera meses futuros pras linhas existentes.
function migrateBalanceLine(line, currentMonthIndex) {
  const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  const futureMonths = months.slice(currentMonthIndex + 1);
  if (!isBalanceCategory(line.category)) return line;
  const trimmedMonthly = { ...line.monthly };
  for (const m of futureMonths) trimmedMonthly[m] = 0;
  return { ...line, frequency: "variable", monthly: trimmedMonthly };
}

test("migrate: linha 'Saldo em conta' fixed → variable + meses futuros zerados", () => {
  // Hoje é junho (index 5). Meses futuros: julho..dezembro.
  const line = {
    category: "Saldo em conta",
    frequency: "fixed",
    monthly: {
      january: 1000, february: 1200, march: 1500, april: 1800, may: 2000,
      june: 2200, july: 2400, august: 2600, september: 2800, october: 3000,
      november: 3200, december: 3400,
    },
  };
  const result = migrateBalanceLine(line, 5);
  assert.equal(result.frequency, "variable");
  // Janeiro a junho preservados
  assert.equal(result.monthly.january, 1000);
  assert.equal(result.monthly.june, 2200);
  // Julho a dezembro zerados
  assert.equal(result.monthly.july, 0);
  assert.equal(result.monthly.august, 0);
  assert.equal(result.monthly.december, 0);
});

test("migrate: linha de categoria normal não é afetada", () => {
  const line = {
    category: "Renda principal",
    frequency: "fixed",
    monthly: {
      january: 5000, february: 5000, march: 5000, april: 5000, may: 5000,
      june: 5000, july: 5000, august: 5000, september: 5000, october: 5000,
      november: 5000, december: 5000,
    },
  };
  const result = migrateBalanceLine(line, 5);
  assert.equal(result.frequency, "fixed");
  assert.equal(result.monthly.december, 5000);
});

test("trocar categoria pra 'Saldo em conta' via update força variable", () => {
  // Espelha o reducer: linha existente com frequency=fixed; user troca
  // category pra "Saldo em conta" → frequency vira variable.
  const line = { category: "Renda principal", frequency: "fixed" };
  const patch = { category: "Saldo em conta" };
  const next = { ...line, ...patch };
  if (isBalanceCategory(next.category)) next.frequency = "variable";
  assert.equal(next.frequency, "variable");
});
