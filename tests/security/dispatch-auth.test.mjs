import test from "node:test";
import assert from "node:assert/strict";
import { isAuthorizedDispatchRequest } from "../../src/lib/security/dispatch-auth.ts";

test("fora de produção SÓ libera com allowOpenDispatch explícito", () => {
  // Sem a flag → exige segredo mesmo fora de produção (fecha o buraco
  // de staging/self-host com NODE_ENV != production exposto).
  assert.equal(
    isAuthorizedDispatchRequest({
      nodeEnv: "development",
      configuredSecret: undefined,
      headerSecret: null,
    }),
    false,
  );
  // Com a flag → libera (conveniência de dev local consciente).
  assert.equal(
    isAuthorizedDispatchRequest({
      nodeEnv: "development",
      configuredSecret: undefined,
      headerSecret: null,
      allowOpenDispatch: true,
    }),
    true,
  );
  // allowOpenDispatch NÃO vale em produção.
  assert.equal(
    isAuthorizedDispatchRequest({
      nodeEnv: "production",
      configuredSecret: "segredo",
      headerSecret: null,
      allowOpenDispatch: true,
    }),
    false,
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
