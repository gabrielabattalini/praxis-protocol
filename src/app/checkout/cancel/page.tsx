import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { publicBillingPlan } from "@/lib/billing-config";

export default function CheckoutCancelPage() {
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
            textAlign: "center",
            padding: "48px 40px",
          }}
        >
          {/* Cancel icon tile */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              border: "2px solid rgba(113,113,122,0.5)",
              background: "rgba(39,39,42,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
              fontSize: 36,
              color: "var(--fg-3)",
              fontWeight: 700,
            }}
          >
            ✕
          </div>

          <div
            className="praxis-label"
            style={{ color: "var(--fg-3)", marginBottom: 12 }}
          >
            ▸ CHECKOUT INTERROMPIDO
          </div>
          <h1
            className="praxis-title"
            style={{ fontSize: 36, marginBottom: 16 }}
          >
            Nenhuma cobrança concluída.
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
            Você pode retomar a ativação do {publicBillingPlan.name} quando
            quiser. O fluxo do Praxis continua disponível para explorar o
            sistema antes da compra.
          </p>

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
              Criar minha identidade
            </Link>
            <Link
              href="/"
              className="v2-btn"
              style={{
                width: "100%",
                padding: 14,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <ArrowLeft className="h-4 w-4" /> Voltar ao site
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
