import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { publicBillingPlan } from "@/lib/billing-config";

export default function CheckoutSuccessPage() {
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
            borderColor: "rgba(74,222,128,0.3)",
            background:
              "linear-gradient(180deg, rgba(74,222,128,0.06), rgba(10,10,12,0.98))",
            textAlign: "center",
            padding: "48px 40px",
          }}
        >
          {/* Big OK icon tile */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              border: "2px solid var(--ok)",
              background: "rgba(74,222,128,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
              fontSize: 36,
              color: "var(--ok)",
              boxShadow: "0 0 32px rgba(74,222,128,0.2)",
              fontWeight: 700,
            }}
          >
            ✓
          </div>

          <div
            className="praxis-label"
            style={{ color: "var(--ok)", marginBottom: 12 }}
          >
            ▸ TRANSAÇÃO CONFIRMADA
          </div>
          <h1
            className="praxis-title"
            style={{ fontSize: 36, marginBottom: 16 }}
          >
            Protocolo ativo.
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "var(--fg-3)",
              maxWidth: 380,
              margin: "0 auto 24px",
              lineHeight: 1.6,
            }}
          >
            O pagamento do {publicBillingPlan.name} foi processado pelo Stripe.
            Agora você pode criar sua identidade no Praxis ou entrar com a conta
            existente.
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
                    color: "var(--ok)",
                    marginTop: 4,
                  }}
                >
                  {publicBillingPlan.priceLabel}
                </div>
              </div>
              <div>
                <div className="praxis-label" style={{ fontSize: 9 }}>SEGURANÇA</div>
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
                <div className="praxis-label" style={{ fontSize: 9 }}>FLUXO</div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--fg)",
                    marginTop: 4,
                  }}
                >
                  Praxis interno
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <Link
              href="/auth/register"
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
              href="/auth/login"
              className="v2-btn"
              style={{
                width: "100%",
                padding: 14,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Entrar no terminal
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
