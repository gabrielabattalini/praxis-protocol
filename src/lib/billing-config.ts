export type BillingPlanId = "monthly";

export const publicBillingPlan = {
  id: "monthly" as BillingPlanId,
  name: process.env.NEXT_PUBLIC_STRIPE_PLAN_NAME || "Praxis Pro",
  priceLabel:
    // Defina NEXT_PUBLIC_STRIPE_PLAN_PRICE (ex.: "R$ 29,90/mês") pra
    // exibir o preço real na landing e no paywall.
    process.env.NEXT_PUBLIC_STRIPE_PLAN_PRICE || "R$ 29,90/mês",
  description:
    process.env.NEXT_PUBLIC_STRIPE_PLAN_DESCRIPTION ||
    "Checkout seguro com ativação imediata do acesso ao sistema.",
};

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
