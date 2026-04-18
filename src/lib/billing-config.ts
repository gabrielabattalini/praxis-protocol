export type BillingPlanId = "monthly";

export const publicBillingPlan = {
  id: "monthly" as BillingPlanId,
  name: process.env.NEXT_PUBLIC_STRIPE_PLAN_NAME || "Praxis Pro",
  priceLabel:
    process.env.NEXT_PUBLIC_STRIPE_PLAN_PRICE || "Ativação via Stripe",
  description:
    process.env.NEXT_PUBLIC_STRIPE_PLAN_DESCRIPTION ||
    "Checkout seguro com ativação imediata do acesso ao sistema.",
};

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
