import test from "node:test";
import assert from "node:assert/strict";

/**
 * Modela o storage per-user de notificações (notification-center.server.ts)
 * sobre um KV em memória (Map), reproduzindo a migração do store monolítico
 * legado e os acessores por-usuário. Verifica os invariantes que motivaram
 * o split (#5 da auditoria):
 *   - migração NÃO perde dados de nenhum usuário;
 *   - write de um usuário NÃO toca os dados de outro (sem clobber);
 *   - o índice (SET) reflete quem o dispatch precisa checar.
 */

const userSubsKey = (u) => `praxis:notif:u:${u}:subs`;
const userSchedKey = (u) => `praxis:notif:u:${u}:sched`;
const userSnoozeKey = (u) => `praxis:notif:u:${u}:snooze`;
const USER_INDEX_KEY = "praxis:notif:userindex";

function makeKv() {
  const kv = new Map();
  const sets = new Map();
  return {
    get: (k) => (kv.has(k) ? JSON.parse(kv.get(k)) : null),
    set: (k, v) => kv.set(k, JSON.stringify(v)),
    sadd: (setKey, member) => {
      const s = sets.get(setKey) ?? new Set();
      s.add(member);
      sets.set(setKey, s);
    },
    smembers: (setKey) => Array.from(sets.get(setKey) ?? []),
    rawKeys: () => Array.from(kv.keys()),
  };
}

function migrate(kv, legacy) {
  for (const [uid, subs] of Object.entries(legacy.subscriptions ?? {})) {
    if (Array.isArray(subs) && subs.length) kv.set(userSubsKey(uid), subs);
  }
  for (const [uid, sched] of Object.entries(legacy.schedules ?? {})) {
    kv.set(userSchedKey(uid), sched);
    kv.sadd(USER_INDEX_KEY, uid);
  }
  for (const [uid, list] of Object.entries(legacy.snoozes ?? {})) {
    if (Array.isArray(list) && list.length) {
      kv.set(userSnoozeKey(uid), list);
      kv.sadd(USER_INDEX_KEY, uid);
    }
  }
}

const LEGACY = {
  subscriptions: {
    userA: [{ id: "d1", endpoint: "https://a" }],
    userB: [{ id: "d2", endpoint: "https://b" }],
  },
  schedules: {
    userA: { userId: "userA", timezone: "America/Sao_Paulo", items: [{ id: "t1" }] },
    userB: { userId: "userB", timezone: "Europe/Lisbon", items: [] },
  },
  snoozes: {
    userA: [{ itemId: "t1", fireAt: "2026-06-05T10:00:00Z" }],
  },
  dispatchLog: [],
};

test("migração preserva subs/sched/snooze de TODOS os usuários", () => {
  const kv = makeKv();
  migrate(kv, LEGACY);

  assert.deepEqual(kv.get(userSubsKey("userA")), LEGACY.subscriptions.userA);
  assert.deepEqual(kv.get(userSubsKey("userB")), LEGACY.subscriptions.userB);
  assert.deepEqual(kv.get(userSchedKey("userA")), LEGACY.schedules.userA);
  assert.deepEqual(kv.get(userSchedKey("userB")), LEGACY.schedules.userB);
  assert.deepEqual(kv.get(userSnoozeKey("userA")), LEGACY.snoozes.userA);
});

test("índice tem quem o dispatch checa (schedule OU snooze)", () => {
  const kv = makeKv();
  migrate(kv, LEGACY);
  assert.deepEqual(kv.smembers(USER_INDEX_KEY).sort(), ["userA", "userB"]);
});

test("write de userA NÃO afeta os dados de userB (sem clobber)", () => {
  const kv = makeKv();
  migrate(kv, LEGACY);

  // userA atualiza suas subscriptions
  kv.set(userSubsKey("userA"), [{ id: "d1", endpoint: "https://a-novo" }]);

  // userB segue intacto
  assert.deepEqual(kv.get(userSubsKey("userB")), LEGACY.subscriptions.userB);
  assert.deepEqual(kv.get(userSchedKey("userB")), LEGACY.schedules.userB);
});

test("snooze de userA não cria/afeta entrada de userB", () => {
  const kv = makeKv();
  migrate(kv, LEGACY);

  kv.set(userSnoozeKey("userA"), []); // userA consumiu a snooze
  kv.sadd(USER_INDEX_KEY, "userA");

  // userB nunca teve snooze e continua sem
  assert.equal(kv.get(userSnoozeKey("userB")), null);
});

test("migração é idempotente (rodar 2x dá o mesmo resultado)", () => {
  const kv = makeKv();
  migrate(kv, LEGACY);
  const after1 = kv.rawKeys().sort();
  migrate(kv, LEGACY);
  const after2 = kv.rawKeys().sort();
  assert.deepEqual(after1, after2);
  assert.deepEqual(kv.get(userSubsKey("userA")), LEGACY.subscriptions.userA);
});
