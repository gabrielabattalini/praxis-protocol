"use client";

import { useState } from "react";
import { Plus, Swords } from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { Avatar, RankChip, RxChip } from "@/components/redesign/primitives";
import { rankingSeed } from "@/lib/mock-data";
import type { FriendTab } from "@/lib/types";
import { formatPoints } from "@/lib/utils";

const tabs: Array<{ id: FriendTab; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "online", label: "Online" },
  { id: "requests", label: "Solicitações" },
];

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

export default function FriendsPage() {
  const { user } = useAppStore();
  const [tab, setTab] = useState<FriendTab>("all");

  // Use top-ranking operators as suggested connections until real social layer lands
  const operators = rankingSeed.slice(0, 9).map((entry, index) => ({
    ...entry,
    streakDays: 44 - index * 3,
    online: index % 3 !== 2,
  }));

  const visible = tab === "online" ? operators.filter((op) => op.online) : operators;
  const onlineCount = operators.filter((op) => op.online).length;

  return (
    <div>
      {/* Page header */}
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 28,
        }}
      >
        <div>
          <div className="page-eyebrow">Rede ativa</div>
          <h1 className="page-title-v2">Operadores</h1>
          <p className="page-description-v2">
            {operators.length} conexões sugeridas · {onlineCount} online · você é{" "}
            <span style={{ color: "var(--accent)" }}>{user.username}</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="v2-btn v2-btn-primary">
            <Plus className="h-3.5 w-3.5" /> Convidar
          </button>
          <button type="button" className="v2-btn v2-btn-ghost">
            Pedidos · 0
          </button>
        </div>
      </div>

      {/* Tab chips */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {tabs.map((item) => (
          <RxChip
            key={item.id}
            as="button"
            active={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label.toUpperCase()}
          </RxChip>
        ))}
      </div>

      {tab === "requests" ? (
        <div className="glass" style={{ padding: 40, textAlign: "center" }}>
          <div className="praxis-label">NENHUMA SOLICITAÇÃO</div>
          <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 8 }}>
            Quando houver pedidos de amizade, eles aparecerão aqui.
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {visible.map((op) => (
            <div key={op.id} className="item-card">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div style={{ position: "relative" }}>
                  <Avatar
                    initials={initialsFor(op.name)}
                    size={48}
                    tier={op.rankTier}
                    online={op.online}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-space-grotesk), sans-serif",
                      fontSize: 15,
                      fontWeight: 600,
                      color: "var(--fg)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {op.username}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <RankChip tier={`${op.rankTier} ${op.rankLabel ?? ""}`.trim()} />
                  </div>
                </div>
                <button
                  type="button"
                  className="v2-btn v2-btn-icon"
                  aria-label="Duelar"
                  title="Duelar"
                >
                  <Swords className="h-4 w-4" />
                </button>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <div className="kpi" style={{ padding: 12 }}>
                  <div className="praxis-label" style={{ fontSize: 9 }}>XP TOTAL</div>
                  <div
                    className="kpi-value"
                    style={{ fontSize: 18, color: "var(--accent)", marginTop: 2 }}
                  >
                    {formatPoints(op.totalXp)}
                  </div>
                </div>
                <div className="kpi" style={{ padding: 12 }}>
                  <div className="praxis-label" style={{ fontSize: 9 }}>STREAK</div>
                  <div
                    className="kpi-value"
                    style={{ fontSize: 18, marginTop: 2 }}
                  >
                    {op.streakDays}d
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab !== "requests" && visible.length === 0 ? (
        <div className="glass" style={{ padding: 40, textAlign: "center", marginTop: 16 }}>
          <div className="praxis-label">NENHUM OPERADOR ONLINE</div>
          <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 8 }}>
            Seus contatos aparecerão aqui quando estiverem ativos.
          </div>
        </div>
      ) : null}
    </div>
  );
}
