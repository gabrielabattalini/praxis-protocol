import {
  hasLifetimeAccessEmail,
  normalizeEntitlementEmail,
  resolveAccountEntitlement,
  type AccountEntitlement,
} from "@/lib/access-entitlements";
import { getStripeServer } from "@/lib/stripe.server";

/**
 * Synchronous resolver — only the env lifetime allowlist.
 * Kept for callers that cannot await (and as the instant first pass).
 */
export function resolveAccountEntitlementFromEnv(
  email: string | null | undefined,
) {
  return resolveAccountEntitlement({
    email,
    lifetimeAccessEmails: process.env.PRAXIS_LIFETIME_ACCESS_EMAILS,
  });
}

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
  // 1. Lifetime allowlist — instant, no network.
  if (
    hasLifetimeAccessEmail(email, process.env.PRAXIS_LIFETIME_ACCESS_EMAILS)
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
  });
}
