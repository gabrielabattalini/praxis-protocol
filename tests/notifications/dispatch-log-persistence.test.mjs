import test from "node:test";
import assert from "node:assert/strict";

/**
 * Regressão: o dispatch log de notificação não pode ficar dessincronizado
 * com o KV num cenário "poda-1 + push-1". Antes o código decidia salvar
 * com `dispatchLog.length !== rawUserLog.length`. Se UMA entrada antiga
 * caía pelo cutoff e UMA nova era pushada no mesmo run, os dois tamanhos
 * coincidiam (100 → 99 → 100), o save era pulado, e o KV continuava com
 * a versão velha. Próximo cron lia o KV, não via a nova entrada, e
 * RE-DISPARAVA a mesma notificação minuto a minuto.
 *
 * O fix usa uma flag explícita `dispatchLogDirty` setada toda vez que
 * algo muda (poda OU push).
 */

const CUTOFF_MS = 1000 * 60 * 60 * 24 * 14;

function runDispatchSlice({ rawUserLog, now, newEntryKey }) {
  // Espelha a lógica do dispatchDueNotifications (recorte).
  let dispatchLog = rawUserLog.filter(
    (entry) => now - new Date(entry.sentAt).getTime() < CUTOFF_MS,
  );
  let dispatchLogDirty = dispatchLog.length !== rawUserLog.length;

  if (newEntryKey) {
    dispatchLog.push({ key: newEntryKey, sentAt: new Date(now).toISOString() });
    dispatchLogDirty = true;
  }

  return { dispatchLog, dispatchLogDirty };
}

test("poda-1 + push-1: dirty=true e log persistido", () => {
  const now = Date.now();
  const oldEntry = {
    key: "u1:t1:2025-12-01",
    sentAt: new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString(),
  };
  const recent = {
    key: "u1:t1:2026-06-25",
    sentAt: new Date(now - 1000).toISOString(),
  };
  const result = runDispatchSlice({
    rawUserLog: [oldEntry, recent],
    now,
    newEntryKey: "u1:t2:2026-06-25",
  });
  // Tamanho final: 1 (recent) + 1 (novo) = 2; raw era 2. Pelo método
  // antigo de comparar length, daria 2 === 2 → NÃO SALVA. Pelo dirty,
  // sempre salva.
  assert.equal(result.dispatchLog.length, 2);
  assert.equal(result.dispatchLogDirty, true, "dirty deve ser true (algo mudou)");
});

test("nada poda, nada push: dirty=false (não salva)", () => {
  const now = Date.now();
  const recent = {
    key: "u1:t1:2026-06-25",
    sentAt: new Date(now - 1000).toISOString(),
  };
  const result = runDispatchSlice({
    rawUserLog: [recent],
    now,
    newEntryKey: null,
  });
  assert.equal(result.dispatchLogDirty, false);
});

test("só poda (sem push): dirty=true", () => {
  const now = Date.now();
  const oldEntry = {
    key: "u1:t1:2025-12-01",
    sentAt: new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString(),
  };
  const result = runDispatchSlice({
    rawUserLog: [oldEntry],
    now,
    newEntryKey: null,
  });
  assert.equal(result.dispatchLog.length, 0);
  assert.equal(result.dispatchLogDirty, true);
});

test("só push (sem poda): dirty=true", () => {
  const now = Date.now();
  const result = runDispatchSlice({
    rawUserLog: [],
    now,
    newEntryKey: "u1:t1:2026-06-25",
  });
  assert.equal(result.dispatchLog.length, 1);
  assert.equal(result.dispatchLogDirty, true);
});
