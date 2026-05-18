import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AuthConsoleShell } from "@/components/auth/auth-console-shell";
import { StripeCheckoutButton } from "@/components/billing/stripe-checkout-button";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";
import { publicBillingPlan } from "@/lib/billing-config";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email: paidEmail } = await searchParams;
  const initialValues = paidEmail
    ? { emailAddress: paidEmail }
    : undefined;

  if (isLocalAuthBypassEnabled) {
    return (
      <AuthConsoleShell
        badge="Modo local"
        title="Despertar autorizado"
        description="A tela de cadastro segue disponível para revisão visual no ambiente local. Sem Clerk configurado, o acesso segue direto para o painel."
        alternateHref="/auth/login"
        alternateLabel="Ver tela de login"
        alternatePrompt="Quer comparar com a entrada do protocolo?"
      >
        <div className="space-y-4">
          <div className="glass" style={{ padding: 20 }}>
            <div className="praxis-label" style={{ color: "var(--accent)", marginBottom: 10 }}>
              CADASTRO LOCAL
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--fg-3)", marginBottom: 18 }}>
              O checkout e o formulário real voltam automaticamente quando o Clerk estiver
              ativo. Enquanto isso, mantemos a composição visual desta página para revisão.
            </p>
            <div className="kpi" style={{ padding: 14, marginBottom: 14 }}>
              <div className="praxis-label">Plano público</div>
              <div style={{ marginTop: 6, fontSize: 15, fontWeight: 600, color: "var(--fg)" }}>
                {publicBillingPlan.name} · {publicBillingPlan.priceLabel}
              </div>
            </div>
            <Link href="/dashboard" className="v2-btn v2-btn-primary" style={{ width: "100%" }}>
              Continuar em modo local
            </Link>
          </div>
        </div>
      </AuthConsoleShell>
    );
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
        {paidEmail ? (
          <div
            className="glass"
            style={{
              padding: 16,
              textAlign: "center",
              borderColor: "rgba(74,222,128,0.3)",
              background:
                "linear-gradient(180deg, rgba(74,222,128,0.06), rgba(10,10,12,0.98))",
            }}
          >
            <div
              className="praxis-label"
              style={{ color: "var(--ok)", marginBottom: 8 }}
            >
              ▸ PAGAMENTO VINCULADO
            </div>
            <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.6 }}>
              Crie a conta com{" "}
              <strong style={{ color: "var(--fg)" }}>{paidEmail}</strong> para
              liberar o acesso completo automaticamente.
            </p>
          </div>
        ) : (
          <div
            className="glass"
            style={{ padding: 16, textAlign: "center" }}
          >
            <div
              className="praxis-label"
              style={{ color: "var(--accent)", marginBottom: 8 }}
            >
              CHECKOUT STRIPE
            </div>
            <p
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "var(--fg)",
              }}
            >
              {publicBillingPlan.name}
            </p>
            <p
              style={{
                fontSize: 13,
                color: "var(--fg-3)",
                marginTop: 4,
              }}
            >
              {publicBillingPlan.priceLabel}
            </p>
            <div
              style={{
                marginTop: 16,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <StripeCheckoutButton
                source="auth-register"
                className="w-full max-w-[320px]"
                noteClassName="text-center"
              >
                Ativar com Stripe
              </StripeCheckoutButton>
            </div>
          </div>
        )}

        <SignUp
          path="/auth/register"
          routing="path"
          signInUrl="/auth/login"
          fallbackRedirectUrl="/dashboard"
          initialValues={initialValues}
        />
      </div>
    </AuthConsoleShell>
  );
}
