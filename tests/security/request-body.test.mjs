import test from "node:test";
import assert from "node:assert/strict";
import {
  PayloadTooLargeError,
  readJsonWithLimit,
} from "../../src/lib/security/request-body.ts";

test("readJsonWithLimit faz parse de payload válido", async () => {
  const value = await readJsonWithLimit(
    new Request("https://praxis.local", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
    }),
    1024,
  );

  assert.deepEqual(value, { ok: true });
});

test("readJsonWithLimit bloqueia payload acima do limite", async () => {
  await assert.rejects(
    readJsonWithLimit(
      new Request("https://praxis.local", {
        method: "POST",
        body: JSON.stringify({ data: "x".repeat(2048) }),
      }),
      64,
    ),
    PayloadTooLargeError,
  );
});
