"use client";

import { useAppStore } from "@/components/providers/app-store-provider";
import { Avatar, RankChip } from "@/components/redesign/primitives";
import { formatPoints } from "@/lib/utils";

function initialsFor(name: string) {
  return (
    name
      .split(/[\s.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "OP"
  );
}

export default function RankingPage() {
  const { user } = useAppStore();

  // Lista global de operadores foi removida a pedido do usuário —
  // era seed fake (Zenkichi, Kurama, Levi etc.) sem sinal real.
  // Quando a camada social existir de verdade voltamos com o leaderboard.

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div className="page-eyebrow">Sua posição</div>
        <h1 className="page-title-v2">Ranking</h1>
        <p className="page-description-v2">
          Sem outros operadores conectados ainda. A lista global volta quando
          a camada social estiver ativa.
        </p>
      </div>

      <div
        className="glass"
        style={{
          padding: 28,
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "center",
          gap: 24,
        }}
      >
        <Avatar
          initials={initialsFor(user.name)}
          size={72}
          tier={user.rankTier}
          online={false}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: 22,
              fontWeight: 700,
              color: "var(--fg)",
              letterSpacing: "-0.02em",
            }}
          >
            {user.username}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              color: "var(--fg-3)",
            }}
          >
            {user.name}
          </div>
          <div style={{ marginTop: 12 }}>
            <RankChip
              tier={`${user.rankTier} ${user.rankLabel ?? ""}`.trim()}
            />
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            className="praxis-label"
            style={{ fontSize: 9, color: "var(--fg-3)" }}
          >
            XP TOTAL
          </div>
          <div
            className="praxis-title"
            style={{
              fontSize: 32,
              color: "var(--accent)",
              lineHeight: 1.05,
              marginTop: 4,
            }}
          >
            {formatPoints(user.totalXp)}
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              color: "var(--fg-3)",
            }}
          >
            LV {user.level}
          </div>
        </div>
      </div>
    </div>
  );
}
