import test from "node:test";
import assert from "node:assert/strict";
import { isAuthorizedDispatchRequest } from "../../src/lib/security/dispatch-auth.ts";

test("dispatch aceita qualquer chamada fora de produção", () => {
  assert.equal(
    isAuthorizedDispatchRequest({
      nodeEnv: "development",
      configuredSecret: undefined,
      headerSecret: null,
    }),
    true,
  );
});

test("dispatch em produção exige segredo no header", () => {
  assert.equal(
    isAuthorizedDispatchRequest({
      nodeEnv: "production",
      configuredSecret: "segredo",
      headerSecret: "segredo",
    }),
    true,
  );

  assert.equal(
    isAuthorizedDispatchRequest({
      nodeEnv: "production",
      configuredSecret: "segredo",
      headerSecret: null,
    }),
    false,
  );
});

test("dispatch em produção falha quando o segredo não está configurado", () => {
  assert.equal(
    isAuthorizedDispatchRequest({
      nodeEnv: "production",
      configuredSecret: undefined,
      headerSecret: "qualquer",
    }),
    false,
  );
});

test("dispatch aceita Authorization: Bearer (formato Vercel Cron)", () => {
  assert.equal(
    isAuthorizedDispatchRequest({
      nodeEnv: "production",
      configuredSecret: "segredo",
      headerSecret: null,
      authorizationHeader: "Bearer segredo",
    }),
    true,
  );

  assert.equal(
    isAuthorizedDispatchRequest({
      nodeEnv: "production",
      configuredSecret: "segredo",
      headerSecret: null,
      authorizationHeader: "Bearer outro",
    }),
    false,
  );

  assert.equal(
    isAuthorizedDispatchRequest({
      nodeEnv: "production",
      configuredSecret: "segredo",
      headerSecret: null,
      authorizationHeader: null,
    }),
    false,
  );
});
