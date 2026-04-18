export type StripeBillingPlanId = "monthly";

export type StripeBillingPlan = {
  id: StripeBillingPlanId;
  stripePriceId: string;
  mode: "payment" | "subscription";
};

export function getStripeBillingPlan(
  requestedPlan?: string | null,
): StripeBillingPlan {
  const id: StripeBillingPlanId = requestedPlan === "monthly" ? "monthly" : "monthly";
  const stripePriceId = process.env.STRIPE_PRICE_ID_MONTHLY || "";
  const mode =
    process.env.STRIPE_CHECKOUT_MODE === "payment" ? "payment" : "subscription";

  return {
    id,
    stripePriceId,
    mode,
  };
}
