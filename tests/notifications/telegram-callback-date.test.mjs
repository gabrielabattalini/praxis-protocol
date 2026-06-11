import test from "node:test";
import assert from "node:assert/strict";
import {
  appendCallbackDate,
  encodeCallbackDateSuffix,
  resolveCompletionDateKey,
  splitCallbackDate,
} from "../../src/lib/telegram-callback-date.ts";

/**
 * Trava o fix do bug de virada de dia no Telegram: o botão "Concluir"
 * carrega o dia do DISPARO ("|YYMMDD" no callback_data) e o webhook
 * conclui pra esse dia — clique depois da meia-noite deixa de dar baixa
 * no dia seguinte.
 */

test("encodeCallbackDateSuffix: data válida vira |YYMMDD", () => {
  assert.equal(encodeCallbackDateSuffix("2026-06-11"), "|260611");
  assert.equal(encodeCallbackDateSuffix("2026-12-31"), "|261231");
});

test("encodeCallbackDateSuffix: data inválida → sem sufixo", () => {
  assert.equal(encodeCallbackDateSuffix("lixo"), "");
  assert.equal(encodeCallbackDateSuffix("2026-13-01"), "");
  assert.equal(encodeCallbackDateSuffix("2026-00-10"), "");
  assert.equal(encodeCallbackDateSuffix("2026-06-32"), "");
  assert.equal(encodeCallbackDateSuffix(""), "");
});

test("appendCallbackDate: anexa quando cabe nos 64 bytes", () => {
  assert.equal(
    appendCallbackDate("t:task-ab12cd3", "2026-06-11"),
    "t:task-ab12cd3|260611",
  );
});

test("appendCallbackDate: estouraria 64 bytes → mantém sem data (botão segue vivo)", () => {
  const longId = `t:${"x".repeat(60)}`; // 62 bytes; +7 do sufixo estoura
  assert.equal(appendCallbackDate(longId, "2026-06-11"), longId);
});

test("appendCallbackDate: data inválida → callback intacto", () => {
  assert.equal(appendCallbackDate("t:abc", "ontem"), "t:abc");
});

test("splitCallbackDate: separa sufixo e reconstrói YYYY-MM-DD", () => {
  assert.deepEqual(splitCallbackDate("t:task-ab12cd3|260611"), {
    base: "t:task-ab12cd3",
    dateKey: "2026-06-11",
  });
  // ids de reminder têm ":" no meio — o sufixo não se confunde.
  assert.deepEqual(
    splitCallbackDate("sz:reminder:meal:meal-x1:21:30|260611"),
    { base: "sz:reminder:meal:meal-x1:21:30", dateKey: "2026-06-11" },
  );
});

test("splitCallbackDate: mensagens antigas (sem sufixo) → dateKey null, base intacta", () => {
  assert.deepEqual(splitCallbackDate("t:task-ab12cd3"), {
    base: "t:task-ab12cd3",
    dateKey: null,
  });
  assert.deepEqual(splitCallbackDate("noop"), { base: "noop", dateKey: null });
});

test("splitCallbackDate: | sem exatamente 6 dígitos não é sufixo", () => {
  assert.deepEqual(splitCallbackDate("t:abc|123"), {
    base: "t:abc|123",
    dateKey: null,
  });
  assert.deepEqual(splitCallbackDate("t:abc|26061"), {
    base: "t:abc|26061",
    dateKey: null,
  });
});

test("splitCallbackDate: 6 dígitos que não formam data válida → ignora", () => {
  // 99 não é mês — trata como parte do id, não como data.
  assert.deepEqual(splitCallbackDate("t:abc|269901"), {
    base: "t:abc|269901",
    dateKey: null,
  });
});

test("round-trip: append → split devolve base e data originais", () => {
  const appended = appendCallbackDate("mb:meal-block-xy12ab9", "2026-01-02");
  assert.deepEqual(splitCallbackDate(appended), {
    base: "mb:meal-block-xy12ab9",
    dateKey: "2026-01-02",
  });
});

test("resolveCompletionDateKey: dia do disparo (ontem) vence o dia do clique", () => {
  assert.equal(
    resolveCompletionDateKey("2026-06-10", "2026-06-11"),
    "2026-06-10",
  );
});

test("resolveCompletionDateKey: mesmo dia → hoje (fluxo normal)", () => {
  assert.equal(
    resolveCompletionDateKey("2026-06-11", "2026-06-11"),
    "2026-06-11",
  );
});

test("resolveCompletionDateKey: sem data (mensagem antiga) → hoje", () => {
  assert.equal(resolveCompletionDateKey(null, "2026-06-11"), "2026-06-11");
  assert.equal(resolveCompletionDateKey(undefined, "2026-06-11"), "2026-06-11");
});

test("resolveCompletionDateKey: data futura (clock skew) → clampa em hoje", () => {
  assert.equal(
    resolveCompletionDateKey("2026-06-12", "2026-06-11"),
    "2026-06-11",
  );
});

test("resolveCompletionDateKey: data inválida → hoje", () => {
  assert.equal(resolveCompletionDateKey("lixo", "2026-06-11"), "2026-06-11");
  assert.equal(
    resolveCompletionDateKey("2026-99-99", "2026-06-11"),
    "2026-06-11",
  );
});
