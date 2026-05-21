import assert from "node:assert/strict";
import test from "node:test";
import {
  coerceAccountEntitlement,
  defaultAccountEntitlement,
  hasLifetimeAccessEmail,
  parseLifetimeAccessEmails,
  resolveAccountEntitlement,
} from "../../src/lib/access-entitlements.ts";

test("parseLifetimeAccessEmails normalizes separated email lists", () => {
  const emails = parseLifetimeAccessEmails(
    " Dono@Praxis.app, admin@praxis.app; fundador@praxis.app\n",
  );

  assert.deepEqual([...emails].sort(), [
    "admin@praxis.app",
    "dono@praxis.app",
    "fundador@praxis.app",
  ]);
});

test("hasLifetimeAccessEmail matches emails case-insensitively", () => {
  assert.equal(
    hasLifetimeAccessEmail("DONO@PRAXIS.APP", "dono@praxis.app"),
    true,
  );
  assert.equal(
    hasLifetimeAccessEmail("outro@praxis.app", "dono@praxis.app"),
    false,
  );
});

test("resolveAccountEntitlement grants lifetime before paid state", () => {
  const entitlement = resolveAccountEntitlement({
    email: "dono@praxis.app",
    lifetimeAccessEmails: "dono@praxis.app",
    paidActive: false,
  });

  assert.equal(entitlement.hasFullAccess, true);
  assert.equal(entitlement.tier, "lifetime");
});

test("resolveAccountEntitlement keeps free accounts locked without allowlist", () => {
  assert.deepEqual(
    resolveAccountEntitlement({
      email: "visitante@praxis.app",
      lifetimeAccessEmails: "dono@praxis.app",
      paidActive: false,
    }),
    defaultAccountEntitlement,
  );
});

test("coerceAccountEntitlement rejects malformed payloads safely", () => {
  assert.deepEqual(coerceAccountEntitlement(null), defaultAccountEntitlement);
  assert.deepEqual(coerceAccountEntitlement({ tier: "owner" }), {
    ...defaultAccountEntitlement,
    hasFullAccess: false,
  });
  assert.equal(
    coerceAccountEntitlement({ tier: "owner", hasFullAccess: true }).hasFullAccess,
    false,
  );
});
