import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Guardas de fiação do paywall. O modelo de negócio é SEM free tier
 * (decisão do fundador: custo de infra por usuário é alto). Estes testes
 * seguram as três pontas que, se alguém soltar num refactor, reabrem o
 * app de graça em silêncio:
 *
 *  1. o layout do app envolve tudo no PaywallGate;
 *  2. as rotas de API caras chamam requireFullAccess (gate do servidor);
 *  3. o webhook invalida o cache do entitlement nos eventos de billing.
 */
const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("layout do app envolve o conteudo no PaywallGate", () => {
  const layout = read("src/app/(app)/layout.tsx");
  assert.ok(layout.includes("PaywallGate"), "PaywallGate saiu do layout");
  assert.ok(
    /<PaywallGate>\{children\}<\/PaywallGate>/.test(layout),
    "children precisa estar DENTRO do PaywallGate",
  );
});

const EXPENSIVE_ROUTES = [
  "src/app/api/shopping-search/route.ts",
  "src/app/api/shopping-price/route.ts",
  "src/app/api/tbca-foods/search/route.ts",
  "src/app/api/usda-foods/search/route.ts",
  "src/app/api/reports/weekly/pdf/route.ts",
];

test("toda rota cara tem o gate de plano no servidor", () => {
  for (const route of EXPENSIVE_ROUTES) {
    const source = read(route);
    assert.ok(
      source.includes("requireFullAccess"),
      `${route} perdeu o requireFullAccess — free voltaria a consumir API paga`,
    );
    assert.ok(
      /const deniedByPlan = await requireFullAccess\(\);\s*\n\s*if \(deniedByPlan\) return deniedByPlan;/.test(
        source,
      ),
      `${route} importa mas nao APLICA o gate`,
    );
  }
});

test("webhook invalida o cache do entitlement nos 3 eventos de billing", () => {
  const webhook = read("src/app/api/billing/webhook/route.ts");
  assert.ok(
    webhook.includes(
      'import { invalidateEntitlementCache } from "@/lib/access-entitlements.server"',
    ),
    "import da invalidacao sumiu",
  );
  // 3 chamadas: checkout completed, subscription updated/deleted, invoice
  // failed (o import nao tem parentese, entao nao entra nesta conta).
  const calls = webhook.split("await invalidateEntitlementCache(").length - 1;
  assert.ok(calls >= 3, `esperado >= 3 chamadas; achou ${calls}`);
});

test("rota de entitlement usa o resolvedor CACHEADO (nao o full)", () => {
  const route = read("src/app/api/account-entitlement/route.ts");
  assert.ok(
    route.includes("resolveAccountEntitlementCached"),
    "rota voltou pro resolvedor sem cache — cada load varre o Stripe",
  );
});

test("paginas legais existem e sao publicas no middleware", () => {
  for (const page of [
    "src/app/legal/termos/page.tsx",
    "src/app/legal/privacidade/page.tsx",
    "src/app/legal/reembolso/page.tsx",
  ]) {
    assert.ok(read(page).length > 500, `${page} vazia ou sumiu`);
  }
  const proxy = read("src/proxy.ts");
  assert.ok(
    proxy.includes('"/legal(.*)"'),
    "/legal precisa ser rota publica (Stripe exige acesso sem login)",
  );
});

test("reembolso cita o direito de arrependimento de 7 dias (CDC art. 49)", () => {
  const refund = read("src/app/legal/reembolso/page.tsx");
  assert.ok(/7 dias/.test(refund) && /art\. 49/.test(refund));
});
