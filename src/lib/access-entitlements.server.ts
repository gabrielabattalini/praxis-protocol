import "server-only";
import {
  hasLifetimeAccessEmail,
  normalizeEntitlementEmail,
  resolveAccountEntitlement,
  type AccountEntitlement,
} from "@/lib/access-entitlements";
import { getStripeServer } from "@/lib/stripe.server";

/**
 * Built-in lifetime allowlist — sempre tem acesso vitalício, mas NÃO
 * recebem dados pré-seeded (não passam por isFounderEmail()). Antes
 * morava em access-entitlements.ts (client + server), o que vazava os
 * emails de usuários reais pro bundle JS público. Agora vive aqui (só
 * server), e é injetado em resolveAccountEntitlementFull. Aceita override
 * via env (PRAXIS_BUILT_IN_LIFETIME_EMAILS, separadores: vírgula/espaço/
 * ponto-e-vírgula) — útil pra ambientes onde o operador quer alterar
 * sem mexer no código.
 */
const BUILT_IN_LIFETIME_EMAILS_DEFAULT: readonly string[] = [
  "alberto1998.lima@gmail.com",
  "kadinefernandq@gmail.com",
  "valdemir.887787@gmail.com",
];

function getBuiltInLifetimeEmails(): readonly string[] {
  const override = process.env.PRAXIS_BUILT_IN_LIFETIME_EMAILS?.trim();
  if (override) {
    return override
      .split(/[\s,;]+/)
      .map((email) => email.trim())
      .filter(Boolean);
  }
  return BUILT_IN_LIFETIME_EMAILS_DEFAULT;
}

/**
 * Email(s) do fundador/operador em texto puro. Vive aqui (server-only),
 * NÃO em access-entitlements.ts (módulo client-safe, que só guarda o HASH
 * pra não vazar o email no bundle JS público). Sempre entra na allowlist de
 * lifetime — mesmo que PRAXIS_BUILT_IN_LIFETIME_EMAILS sobrescreva a lista
 * de vitalícios — garantindo que o acesso admin nunca quebra por env.
 */
const FOUNDER_LIFETIME_EMAILS: readonly string[] = [
  "gabrielabattalini@gmail.com",
];

/**
 * Returns true if the given email has paid — checked LIVE against Stripe.
 *
 * No database needed: Stripe itself is the source of truth. We look the
 * customer up by email and check for either:
 *   - subscription mode: an active/trialing/past_due subscription, or
 *   - payment mode: at least one succeeded payment intent.
 *
 * Safe by default: any Stripe/config error returns false (no access),
 * never throws to the caller.
 */
async function hasActiveStripeAccess(
  email: string | null | undefined,
): Promise<boolean> {
  const normalized = normalizeEntitlementEmail(email);
  if (!normalized) return false;

  // If Stripe isn't configured in this environment, skip silently.
  if (!process.env.STRIPE_SECRET_KEY) return false;

  try {
    const stripe = getStripeServer();

    const customers = await stripe.customers.list({
      email: normalized,
      limit: 10,
    });

    if (customers.data.length === 0) return false;

    for (const customer of customers.data) {
      if (customer.deleted) continue;

      // (1) Subscription mode — any live subscription.
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 10,
      });

      const hasLiveSubscription = subscriptions.data.some((subscription) =>
        ["active", "trialing", "past_due"].includes(subscription.status),
      );

      if (hasLiveSubscription) return true;

      // (2) One-time payment mode — any succeeded payment intent.
      const paymentIntents = await stripe.paymentIntents.list({
        customer: customer.id,
        limit: 20,
      });

      const hasSucceededPayment = paymentIntents.data.some(
        (intent) => intent.status === "succeeded",
      );

      if (hasSucceededPayment) return true;
    }

    return false;
  } catch (error) {
    console.error("[entitlement] Stripe lookup failed:", error);
    return false;
  }
}

/**
 * Full entitlement resolution, async.
 *
 * Order:
 *   1. Env lifetime allowlist  (instant, founder/operator emails)
 *   2. Live Stripe check       (automatic — the moment they pay, this flips)
 *   3. Free tier               (default)
 */
export async function resolveAccountEntitlementFull(
  email: string | null | undefined,
): Promise<AccountEntitlement> {
  const builtInLifetime = [
    ...FOUNDER_LIFETIME_EMAILS,
    ...getBuiltInLifetimeEmails(),
  ];

  // 1. Lifetime allowlist — instant, no network.
  if (
    hasLifetimeAccessEmail(
      email,
      process.env.PRAXIS_LIFETIME_ACCESS_EMAILS,
      builtInLifetime,
    )
  ) {
    return {
      hasFullAccess: true,
      tier: "lifetime",
      label: "Acesso vitalicio",
      reason: "E-mail autorizado como fundador/operador do projeto.",
    };
  }

  // 2. Live Stripe verification — this is the automatic payment check.
  const paidActive = await hasActiveStripeAccess(email);

  return resolveAccountEntitlement({
    email,
    lifetimeAccessEmails: process.env.PRAXIS_LIFETIME_ACCESS_EMAILS,
    paidActive,
    extraBuiltInLifetimeEmails: builtInLifetime,
  });
}

/* ───────────────────────────────────────────────────────────────
   Cache do entitlement (KV) — o resolvedor acima consulta o Stripe
   AO VIVO (até ~21 chamadas por resolução). Sem cache, cada load de
   página paga esse custo e, com volume, vira lentidão + rate limit
   na API do Stripe. Regras:

     - resultado PAGO/vitalício: cacheia 5 min (revogação pode
       esperar; o webhook invalida antes disso quando algo muda)
     - resultado FREE: cacheia 60s (quem acabou de pagar não pode
       esperar 5 min pra entrar — e o webhook também invalida)

   Mesmo padrão fetch/REST do account-state.server.ts (Upstash),
   sem dependência nova. Sem KV configurado, degrada pro resolvedor
   direto — comportamento idêntico ao de antes.
   ─────────────────────────────────────────────────────────────── */

const ENTITLEMENT_KV_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const ENTITLEMENT_KV_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const ENTITLEMENT_KV_ENABLED = Boolean(
  ENTITLEMENT_KV_URL && ENTITLEMENT_KV_TOKEN,
);

const ENTITLEMENT_TTL_PAID_SECONDS = 300;
const ENTITLEMENT_TTL_FREE_SECONDS = 60;

function entitlementCacheKey(email: string) {
  return `praxis:entitlement:${email}`;
}

async function kvGetEntitlement(
  email: string,
): Promise<AccountEntitlement | null> {
  if (!ENTITLEMENT_KV_ENABLED) return null;
  try {
    const response = await fetch(
      `${ENTITLEMENT_KV_URL}/get/${encodeURIComponent(entitlementCacheKey(email))}`,
      {
        headers: { Authorization: `Bearer ${ENTITLEMENT_KV_TOKEN}` },
        cache: "no-store",
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { result?: string | null };
    if (!payload.result) return null;
    const parsed = JSON.parse(payload.result) as AccountEntitlement;
    if (typeof parsed?.hasFullAccess !== "boolean") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function kvSetEntitlement(
  email: string,
  entitlement: AccountEntitlement,
): Promise<void> {
  if (!ENTITLEMENT_KV_ENABLED) return;
  try {
    const ttl = entitlement.hasFullAccess
      ? ENTITLEMENT_TTL_PAID_SECONDS
      : ENTITLEMENT_TTL_FREE_SECONDS;
    await fetch(
      `${ENTITLEMENT_KV_URL}/set/${encodeURIComponent(entitlementCacheKey(email))}?EX=${ttl}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ENTITLEMENT_KV_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(entitlement),
        cache: "no-store",
      },
    );
  } catch {
    // Cache é otimização — falha silenciosa mantém o fluxo vivo.
  }
}

/**
 * Invalida o cache de um email (chamado pelo webhook do Stripe quando
 * checkout/assinatura muda — ativação instantânea apesar do TTL).
 */
export async function invalidateEntitlementCache(
  email: string | null | undefined,
): Promise<void> {
  const normalized = normalizeEntitlementEmail(email);
  if (!normalized || !ENTITLEMENT_KV_ENABLED) return;
  try {
    await fetch(
      `${ENTITLEMENT_KV_URL}/del/${encodeURIComponent(entitlementCacheKey(normalized))}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${ENTITLEMENT_KV_TOKEN}` },
        cache: "no-store",
      },
    );
  } catch {
    // TTL curto cobre o pior caso.
  }
}

/**
 * Versão cacheada do resolvedor — use ESTA em rotas de API.
 * Allowlist vitalícia nem passa pelo cache (é instantânea e local).
 */
export async function resolveAccountEntitlementCached(
  email: string | null | undefined,
): Promise<AccountEntitlement> {
  const normalized = normalizeEntitlementEmail(email);
  if (!normalized) return resolveAccountEntitlementFull(email);

  const cached = await kvGetEntitlement(normalized);
  if (cached) return cached;

  const resolved = await resolveAccountEntitlementFull(email);
  await kvSetEntitlement(normalized, resolved);
  return resolved;
}
