import test from "node:test";
import assert from "node:assert/strict";
import { securityHeaders } from "../../src/lib/security/headers.ts";

test("securityHeaders inclui proteções HTTP básicas", () => {
  const headerMap = new Map(
    securityHeaders.map((header) => [header.key, header.value]),
  );

  assert.equal(headerMap.get("X-Frame-Options"), "DENY");
  assert.equal(headerMap.get("X-Content-Type-Options"), "nosniff");
  assert.equal(
    headerMap.get("Referrer-Policy"),
    "strict-origin-when-cross-origin",
  );
});
