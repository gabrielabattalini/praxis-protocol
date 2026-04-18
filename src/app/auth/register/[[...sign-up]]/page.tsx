import { SignUp } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AuthConsoleShell } from "@/components/auth/auth-console-shell";
import { StripeCheckoutButton } from "@/components/billing/stripe-checkout-button";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";
import { publicBillingPlan } from "@/lib/billing-config";

export default async function RegisterPage() {
  if (isLocalAuthBypassEnabled) {
    redirect("/dashboard");
  }

  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <AuthConsoleShell
      badge="Criação de identidade"
      title="Despertar autorizado"
      description="Crie sua identidade para entrar no sistema com progresso protegido, sessão isolada e leitura persistente da sua evolução."
      alternateHref="/auth/login"
      alternateLabel="Já tenho acesso"
      alternatePrompt="Já possui uma conta?"
    >
      <div className="space-y-4">
        <div className="border border-zinc-800 bg-[#0d0d0f] p-4 text-center">
          <p className="font-mono text-[0.54rem] uppercase tracking-[0.22em] text-amber-300">
            Checkout Stripe
          </p>
          <p className="mt-2 text-lg font-semibold text-zinc-100">
            {publicBillingPlan.name}
          </p>
          <p className="mt-1 text-sm text-zinc-400">{publicBillingPlan.priceLabel}</p>
          <div className="mt-4 flex justify-center">
            <StripeCheckoutButton
              source="auth-register"
              className="w-full max-w-[320px]"
              noteClassName="text-center"
            >
              Ativar com Stripe
            </StripeCheckoutButton>
          </div>
        </div>

        <SignUp
          path="/auth/register"
          routing="path"
          signInUrl="/auth/login"
          fallbackRedirectUrl="/dashboard"
        />
      </div>
    </AuthConsoleShell>
  );
}
