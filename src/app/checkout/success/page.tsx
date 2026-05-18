import Link from "next/link";
import { ChevronRight, ShieldCheck, TriangleAlert } from "lucide-react";
import { publicBillingPlan } from "@/lib/billing-config";
import { getStripeServer } from "@/lib/stripe.server";

export const dynamic = "force-dynamic";

type VerifiedSession = {
  paid: boolean;
  email: string;
  amountLabel: string;
  reference: string;
};

async function verifyStripeSession(
  sessionId: string | undefined,
): Promise<VerifiedSession | null> {
  if (!sessionId || !process.env.STRIPE_SECRET_KEY) return null;

  try {
    const stripe = getStripeServer();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const paid =
      session.payment_status === "paid" ||
      session.payment_status === "no_payment_required" ||
      session.status === "complete";

    const email =
      session.customer_details?.email ||
      (typeof session.customer_email === "string"
        ? session.customer_email
        : "") ||
      "";

    const amountLabel =
      typeof session.amount_total === "number"
        ? new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: (session.currency || "brl").toUpperCase(),
          }).format(session.amount_total / 100)
        : publicBillingPlan.priceLabel;

    return {
      paid,
      email,
      amountLabel,
      reference: session.id.slice(-12).toUpperCase(),
    };
  } catch (error) {
    console.error("[checkout/success] session verify failed:", error);
    return null;
  }
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  const verified = await verifyStripeSession(params.session_id);

  const isPaid = verified?.paid === true;
  const paidEmail = verified?.email ?? "";
  const registerHref = paidEmail
    ? `/auth/register?email=${encodeURIComponent(paidEmail)}`
    : "/auth/register";
  const loginHref = paidEmail
    ? `/auth/login?email=${encodeURIComponent(paidEmail)}`
    : "/auth/login";

  const accentColor = isPaid ? "var(--ok)" : "var(--warn)";
  const accentRgb = isPaid ? "74,222,128" : "250,204,21";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        background: "var(--bg)",
      }}
    >
      <div style={{ maxWidth: 540, width: "100%" }}>
        <div
          className="glass"
          style={{
            borderColor: `rgba(${accentRgb},0.3)`,
            background: `linear-gradient(180deg, rgba(${accentRgb},0.06), rgba(10,10,12,0.98))`,
            textAlign: "center",
            padding: "48px 40px",
          }}
        >
          {/* Status icon tile */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              border: `2px solid ${accentColor}`,
              background: `rgba(${accentRgb},0.12)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
              fontSize: 36,
              color: accentColor,
              boxShadow: `0 0 32px rgba(${accentRgb},0.2)`,
              fontWeight: 700,
            }}
          >
            {isPaid ? (
              "✓"
            ) : (
              <TriangleAlert style={{ width: 34, height: 34 }} />
            )}
          </div>

          <div
            className="praxis-label"
            style={{ color: accentColor, marginBottom: 12 }}
          >
            {isPaid
              ? "▸ TRANSAÇÃO CONFIRMADA"
              : "▸ AGUARDANDO CONFIRMAÇÃO"}
          </div>
          <h1 className="praxis-title" style={{ fontSize: 36, marginBottom: 16 }}>
            {isPaid ? "Protocolo ativo." : "Pagamento em verificação"}
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "var(--fg-3)",
              maxWidth: 400,
              margin: "0 auto 24px",
              lineHeight: 1.6,
            }}
          >
            {isPaid ? (
              <>
                Pagamento do {publicBillingPlan.name} confirmado pelo Stripe.
                {paidEmail ? (
                  <>
                    {" "}
                    Crie sua identidade com{" "}
                    <strong style={{ color: "var(--fg)" }}>{paidEmail}</strong>{" "}
                    — o acesso completo é liberado automaticamente para esse
                    e-mail.
                  </>
                ) : (
                  " Crie sua identidade para liberar o acesso completo."
                )}
              </>
            ) : (
              <>
                Ainda não confirmamos este pagamento. Se você concluiu a
                compra, aguarde alguns segundos e atualize a página. O acesso é
                liberado automaticamente assim que o Stripe confirmar — use o
                mesmo e-mail do pagamento ao criar a conta.
              </>
            )}
          </p>

          <div
            className="item-card"
            style={{ marginBottom: 24, textAlign: "left" }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div>
                <div className="praxis-label" style={{ fontSize: 9 }}>PLANO</div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--fg)",
                    marginTop: 4,
                  }}
                >
                  {publicBillingPlan.name}
                </div>
              </div>
              <div>
                <div className="praxis-label" style={{ fontSize: 9 }}>VALOR</div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: accentColor,
                    marginTop: 4,
                  }}
                >
                  {verified?.amountLabel ?? publicBillingPlan.priceLabel}
                </div>
              </div>
              <div>
                <div className="praxis-label" style={{ fontSize: 9 }}>
                  SEGURANÇA
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--fg)",
                    marginTop: 4,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <ShieldCheck
                    className="h-3.5 w-3.5"
                    style={{ color: "var(--accent)" }}
                  />
                  Stripe
                </div>
              </div>
              <div>
                <div className="praxis-label" style={{ fontSize: 9 }}>
                  {verified?.reference ? "REF" : "STATUS"}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--fg)",
                    marginTop: 4,
                    fontFamily:
                      "var(--font-mono), ui-monospace, monospace",
                  }}
                >
                  {verified?.reference ?? (isPaid ? "Confirmado" : "Pendente")}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <Link
              href={registerHref}
              className="v2-btn v2-btn-primary"
              style={{
                width: "100%",
                padding: 14,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              Criar minha identidade <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href={loginHref}
              className="v2-btn"
              style={{
                width: "100%",
                padding: 14,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Já tenho conta · entrar
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
