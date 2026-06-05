import test from "node:test";
import assert from "node:assert/strict";
import { parseMoneyInputBR, formatMoneyInputBR } from "../../src/lib/utils.ts";

/**
 * Parser tolerante de valor (módulo Finanças): aceita o que o usuário
 * digitar (formato BR e variações) e converte pro número.
 */

test("aceita 5 mil de várias formas", () => {
  assert.equal(parseMoneyInputBR("5000"), 5000);
  assert.equal(parseMoneyInputBR("5.000"), 5000); // ponto = milhar BR
  assert.equal(parseMoneyInputBR("5.000,00"), 5000);
  assert.equal(parseMoneyInputBR("R$ 5.000,00"), 5000);
  assert.equal(parseMoneyInputBR("R$5000"), 5000);
});

test("5900 e 5.900 viram cinco mil e novecentos", () => {
  assert.equal(parseMoneyInputBR("5900"), 5900);
  assert.equal(parseMoneyInputBR("5.900"), 5900);
  assert.equal(parseMoneyInputBR("5.900,00"), 5900);
});

test("vírgula = decimal BR", () => {
  assert.equal(parseMoneyInputBR("5,90"), 5.9);
  assert.equal(parseMoneyInputBR("0,50"), 0.5);
  assert.equal(parseMoneyInputBR("1234,56"), 1234.56);
});

test("ponto com 1–2 casas = decimal (estilo US também aceito)", () => {
  assert.equal(parseMoneyInputBR("5.50"), 5.5);
  assert.equal(parseMoneyInputBR("5.9"), 5.9);
  assert.equal(parseMoneyInputBR("5000.00"), 5000); // re-edição do próprio display
});

test("milhar com vários pontos", () => {
  assert.equal(parseMoneyInputBR("1.234.567"), 1234567);
  assert.equal(parseMoneyInputBR("1.234.567,89"), 1234567.89);
});

test("vazio / lixo → 0", () => {
  assert.equal(parseMoneyInputBR(""), 0);
  assert.equal(parseMoneyInputBR("abc"), 0);
  assert.equal(parseMoneyInputBR("R$"), 0);
  assert.equal(parseMoneyInputBR(undefined), 0);
});

test("negativo é preservado", () => {
  assert.equal(parseMoneyInputBR("-1.500,00"), -1500);
});

test("formatMoneyInputBR exibe no padrão BR (sem R$)", () => {
  assert.equal(formatMoneyInputBR(5000), "5.000,00");
  assert.equal(formatMoneyInputBR(5.9), "5,90");
  assert.equal(formatMoneyInputBR(1234567.89), "1.234.567,89");
});

test("round-trip: parse → format → parse é estável", () => {
  for (const input of ["5.000", "5.000,00", "5900", "5,90", "1.234.567,89"]) {
    const n = parseMoneyInputBR(input);
    const formatted = formatMoneyInputBR(n);
    assert.equal(parseMoneyInputBR(formatted), n, `falhou em "${input}"`);
  }
});
