"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Praxis · Índice de páginas — port of design bundle's pages/index.html.
// A developer/QA reference page listing every route in the app, grouped by
// section. Visual treatment matches the v2.0 redesign: rounded panels, mono
// labels, amber accent.

type IndexCard = {
  icon: string;
  label: string;
  sub: string;
  href?: string;
};

type IndexSection = {
  number: string;
  kicker: string;
  title: string;
  cards: IndexCard[];
};

const sections: IndexSection[] = [
  {
    number: "01",
    kicker: "Autenticação",
    title: "Auth e onboarding",
    cards: [
      { icon: "🔐", label: "Login", sub: "/auth/login", href: "/auth/login" },
      { icon: "✍️", label: "Cadastro", sub: "/auth/register", href: "/auth/register" },
      { icon: "🎯", label: "Onboarding", sub: "Em breve" },
    ],
  },
  {
    number: "02",
    kicker: "Páginas principais",
    title: "App core",
    cards: [
      { icon: "📊", label: "Dashboard", sub: "/dashboard", href: "/dashboard" },
      { icon: "✅", label: "Missões", sub: "/tasks", href: "/tasks" },
      { icon: "📅", label: "Agenda", sub: "/agenda", href: "/agenda" },
      { icon: "⚔️", label: "Arena", sub: "/arena", href: "/arena" },
      { icon: "🏆", label: "Ranking", sub: "/ranking", href: "/ranking" },
      { icon: "🎖️", label: "Conquistas", sub: "/achievements", href: "/achievements" },
      { icon: "👥", label: "Operadores", sub: "/friends", href: "/friends" },
      { icon: "👤", label: "Perfil", sub: "/profile", href: "/profile" },
      { icon: "⚙️", label: "Configurações", sub: "/settings", href: "/settings" },
      { icon: "🔧", label: "Utilitários", sub: "/tools", href: "/tools" },
    ],
  },
  {
    number: "03",
    kicker: "Módulos · 13 frentes",
    title: "Módulos ativos",
    cards: [
      { icon: "🍽️", label: "Nutrição", sub: "/modules/nutrition", href: "/modules/nutrition" },
      { icon: "🏋️", label: "Treino", sub: "/modules/workout", href: "/modules/workout" },
      { icon: "💰", label: "Finanças", sub: "/modules/finance", href: "/modules/finance" },
      { icon: "🌙", label: "Sono", sub: "/modules/sleep", href: "/modules/sleep" },
      { icon: "🧠", label: "Mente", sub: "/modules/mind", href: "/modules/mind" },
      { icon: "💼", label: "Trabalho", sub: "/modules/work", href: "/modules/work" },
      { icon: "🏃", label: "Corrida", sub: "/modules/run", href: "/modules/run" },
      { icon: "❤️", label: "Saúde", sub: "/modules/health", href: "/modules/health" },
      { icon: "⚡", label: "Recuperação", sub: "/modules/recovery", href: "/modules/recovery" },
      { icon: "💊", label: "Suplementos", sub: "/modules/supplements", href: "/modules/supplements" },
      { icon: "🏠", label: "Casa", sub: "/modules/home", href: "/modules/home" },
      { icon: "🛒", label: "Mercado", sub: "/modules/market", href: "/modules/market" },
      { icon: "✨", label: "Aparência", sub: "/modules/appearance", href: "/modules/appearance" },
    ],
  },
  {
    number: "04",
    kicker: "Checkout",
    title: "Pagamento",
    cards: [
      { icon: "✅", label: "Pagamento confirmado", sub: "/checkout/success", href: "/checkout/success" },
      { icon: "✕", label: "Pagamento cancelado", sub: "/checkout/cancel", href: "/checkout/cancel" },
    ],
  },
];

const totalPages = sections.reduce(
  (sum, section) => sum + section.cards.filter((c) => c.href).length,
  0,
);

const cardBaseStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "14px 16px",
  border: "1px solid rgba(39,39,42,0.8)",
  borderRadius: 14,
  background: "rgba(14,14,17,0.96)",
  textDecoration: "none",
  color: "var(--fg)",
  transition: "all 0.15s ease",
};

const cardDisabledStyle: React.CSSProperties = {
  ...cardBaseStyle,
  opacity: 0.45,
  cursor: "not-allowed",
};

function IndexCardComponent({ card }: { card: IndexCard }) {
  const content = (
    <>
      <span style={{ fontSize: 22, flexShrink: 0 }}>{card.icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, color: "var(--fg)" }}>{card.label}</div>
        <div
          style={{
            fontSize: 11,
            color: "var(--fg-3)",
            marginTop: 2,
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            letterSpacing: "0.06em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {card.sub}
        </div>
      </div>
    </>
  );

  if (!card.href) {
    return <div style={cardDisabledStyle}>{content}</div>;
  }

  return (
    <Link href={card.href} style={cardBaseStyle} className="rx-index-card">
      {content}
    </Link>
  );
}

export default function PagesIndex() {
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 48 }}>
      <style>{`
        .rx-index-card:hover {
          border-color: rgba(251,146,60,0.3) !important;
          background: rgba(251,146,60,0.04) !important;
          transform: translateY(-1px);
        }
      `}</style>

      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 24,
          marginBottom: 48,
          paddingBottom: 28,
          borderBottom: "1px solid rgba(39,39,42,0.6)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
              <path
                d="M16 2 L28 9 L28 23 L16 30 L4 23 L4 9 Z"
                stroke="#fb923c"
                strokeWidth="1.2"
                fill="none"
                opacity="0.4"
              />
              <path
                d="M10 8 h7 a5 5 0 0 1 0 10 h-7 M10 8 v16"
                stroke="#fb923c"
                strokeWidth="2.2"
                fill="none"
                strokeLinecap="square"
              />
            </svg>
            <span
              className="rx-display"
              style={{
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--fg)",
              }}
            >
              praxis<span style={{ color: "var(--accent)" }}>.</span>
            </span>
          </div>
          <div
            className="rx-display"
            style={{
              fontSize: 48,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
              color: "var(--fg)",
            }}
          >
            Índice de páginas
          </div>
          <div
            style={{
              fontSize: 15,
              color: "var(--fg-3)",
              marginTop: 10,
              maxWidth: 580,
              lineHeight: 1.6,
            }}
          >
            Todas as rotas do app — pra navegar rápido entre dashboard, módulos
            e fluxos durante revisão. Cada card abre a página real do Next.js.
          </div>
        </div>
        <div
          className="rx-mono"
          style={{
            fontSize: 10,
            color: "var(--fg-4)",
            letterSpacing: "0.2em",
            lineHeight: 1.8,
            textAlign: "right",
            textTransform: "uppercase",
          }}
        >
          <div>PRAXIS PROTOCOL</div>
          <div>REDESIGN v2.0</div>
          <div>PÁGINAS · {totalPages}</div>
          <div>ABR 2026</div>
        </div>
      </div>

      {/* Sections */}
      {sections.map((section) => (
        <div key={section.number} style={{ marginBottom: 40 }}>
          <div
            className="rx-mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--accent)",
              marginBottom: 8,
            }}
          >
            {section.number} · {section.kicker}
          </div>
          <h2
            className="rx-display"
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              margin: "0 0 16px",
              color: "var(--fg)",
            }}
          >
            {section.title}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 10,
            }}
          >
            {section.cards.map((card) => (
              <IndexCardComponent key={`${section.number}-${card.label}`} card={card} />
            ))}
          </div>
        </div>
      ))}

      {/* Resources note */}
      <div style={{ marginBottom: 40 }}>
        <div
          className="rx-mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--accent)",
            marginBottom: 8,
          }}
        >
          05 · Arquivos base
        </div>
        <h2
          className="rx-display"
          style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            margin: "0 0 16px",
            color: "var(--fg)",
          }}
        >
          Recursos compartilhados
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 10,
          }}
        >
          <div style={cardDisabledStyle}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>🎨</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, color: "var(--fg)" }}>globals.css</div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--fg-3)",
                  marginTop: 2,
                  fontFamily: "var(--font-mono), ui-monospace, monospace",
                  letterSpacing: "0.06em",
                }}
              >
                Tokens, classes, componentes
              </div>
            </div>
          </div>
          <div style={cardDisabledStyle}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>⚙️</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, color: "var(--fg)" }}>primitives.tsx</div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--fg-3)",
                  marginTop: 2,
                  fontFamily: "var(--font-mono), ui-monospace, monospace",
                  letterSpacing: "0.06em",
                }}
              >
                Rx primitives compartilhados
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: 48,
          paddingTop: 24,
          borderTop: "1px solid rgba(39,39,42,0.4)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          className="rx-mono"
          style={{
            fontSize: 10,
            color: "var(--fg-4)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          PRAXIS / REDESIGN / v2.0 · FIM
        </div>
        <Link
          href="/dashboard"
          className="rx-btn-primary"
          style={{ padding: "10px 20px", display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          Abrir dashboard <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
