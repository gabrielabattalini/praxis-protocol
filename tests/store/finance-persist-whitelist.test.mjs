import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Guarda contra uma classe de bug específica e silenciosa:
 * migrateFinanceBudget monta o retorno por WHITELIST e roda em TODO hydrate
 * (parseStateValue → hydrate), antes do sync. Campo novo do FinanceYearBudget
 * que não for copiado ali é PERDIDO a cada load — sem erro de tipo, sem teste
 * vermelho.
 *
 * Foi exatamente o que quase anulou o fix dos meses fechados:
 *  - closedMonths sumia        → o mês fechado voltava a valer no hydrate
 *  - syncPastCleanupDone sumia → a limpeza única rodava pra sempre, zerando
 *                                valor digitado à mão em mês passado
 *
 * Testes que espelham a lógica em JS puro não pegam isso, porque o furo está
 * na fronteira de persistência, não no cálculo.
 */
const PROVIDER = readFileSync(
  new URL(
    "../../src/components/providers/app-store-provider.tsx",
    import.meta.url,
  ),
  "utf8",
);
const TYPES = readFileSync(
  new URL("../../src/lib/types.ts", import.meta.url),
  "utf8",
);

/** Campos do FinanceYearBudget que precisam sobreviver ao migrate. */
const CAMPOS_PERSISTIDOS = [
  "cardInvoiceBase",
  "cardInvoiceBaseByCard",
  "sheetReportedExpenseTotal",
  "closedMonths",
  "syncPastCleanupDone",
];

function corpoDoMigrate() {
  const inicio = PROVIDER.indexOf("function migrateFinanceBudget");
  assert.ok(inicio > -1, "migrateFinanceBudget deveria existir");
  // Vai até a próxima declaração de função no nível do módulo.
  const resto = PROVIDER.slice(inicio + 1);
  const fim = resto.indexOf("\nfunction ");
  return fim === -1 ? resto : resto.slice(0, fim);
}

test("migrateFinanceBudget preserva todos os campos persistidos do budget", () => {
  const corpo = corpoDoMigrate();
  for (const campo of CAMPOS_PERSISTIDOS) {
    assert.ok(
      corpo.includes(campo),
      `migrateFinanceBudget nao copia "${campo}" — o campo some a cada hydrate`,
    );
  }
});

test("os dois ramos do migrate (novo e legado) copiam closedMonths", () => {
  const corpo = corpoDoMigrate();
  const ocorrencias = corpo.split("closedMonths").length - 1;
  assert.ok(
    ocorrencias >= 2,
    `closedMonths aparece ${ocorrencias}x no migrate; esperado >= 2 (ramo novo + ramo legado)`,
  );
});

test("todo campo opcional novo do FinanceYearBudget esta na lista deste teste", () => {
  // Se alguem adicionar um campo ao tipo e esquecer do migrate, este teste
  // obriga a decisao consciente (adicionar aqui = lembrar do migrate).
  const inicio = TYPES.indexOf("export interface FinanceYearBudget");
  const corpo = TYPES.slice(inicio, TYPES.indexOf("}", inicio));
  const declarados = [...corpo.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
  const ignorados = new Set(["year", "startCash", "lines", "cards"]);
  const faltando = declarados.filter(
    (campo) => !ignorados.has(campo) && !CAMPOS_PERSISTIDOS.includes(campo),
  );
  assert.deepEqual(
    faltando,
    [],
    `campos novos em FinanceYearBudget sem cobertura: ${faltando.join(", ")}`,
  );
});
