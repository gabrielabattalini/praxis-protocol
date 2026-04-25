"use client";

import { useState } from "react";
import { Plus, Swords } from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import {
  Avatar,
  RankChip,
  RxChip,
  RxLabel,
  RxPageHeader,
  RxPanel,
} from "@/components/redesign/primitives";
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
      <RxPageHeader
        title="Operadores"
        subtitle={
          <>
            {operators.length} conexões sugeridas · {onlineCount} online · você é{" "}
            <span style={{ color: "var(--accent)" }}>{user.username}</span>
          </>
        }
        actions={
          <>
            <button
              type="button"
              className="rx-btn-primary"
              style={{ padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <Plus className="h-3 w-3" /> Convidar
            </button>
            <button
              type="button"
              className="rx-btn-ghost"
              style={{ padding: "8px 14px" }}
            >
              Pedidos · 0
            </button>
          </>
        }
      />

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
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
        <RxPanel style={{ padding: 32, textAlign: "center" }}>
          <RxLabel>NENHUMA SOLICITAÇÃO</RxLabel>
          <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 6 }}>
            Quando houver pedidos de amizade, eles aparecerão aqui.
          </div>
        </RxPanel>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {visible.map((op) => (
            <RxPanel key={op.id} style={{ padding: 18 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <Avatar
                  initials={initialsFor(op.name)}
                  size={44}
                  tier={op.rankTier}
                  online={op.online}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    className="rx-display"
                    style={{
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
                  <div style={{ marginTop: 4 }}>
                    <RankChip tier={`${op.rankTier} ${op.rankLabel ?? ""}`.trim()} />
                  </div>
                </div>
                <button
                  type="button"
                  className="rx-btn-ghost"
                  style={{ padding: 8 }}
                  aria-label="Duelar"
                >
                  <Swords className="h-3.5 w-3.5" />
                </button>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    padding: 10,
                    border: "1px solid var(--line)",
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: 12,
                  }}
                >
                  <div
                    className="rx-mono"
                    style={{
                      fontSize: 9,
                      color: "var(--fg-3)",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                    }}
                  >
                    XP TOTAL
                  </div>
                  <div
                    className="rx-display"
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "var(--accent)",
                      marginTop: 2,
                    }}
                  >
                    {formatPoints(op.totalXp)}
                  </div>
                </div>
                <div
                  style={{
                    padding: 10,
                    border: "1px solid var(--line)",
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: 12,
                  }}
                >
                  <div
                    className="rx-mono"
                    style={{
                      fontSize: 9,
                      color: "var(--fg-3)",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                    }}
                  >
                    STREAK
                  </div>
                  <div
                    className="rx-display"
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "var(--fg)",
                      marginTop: 2,
                    }}
                  >
                    {op.streakDays}d
                  </div>
                </div>
              </div>
            </RxPanel>
          ))}
        </div>
      )}

      {tab !== "requests" && visible.length === 0 ? (
        <RxPanel style={{ padding: 32, textAlign: "center", marginTop: 16 }}>
          <RxLabel>NENHUM OPERADOR ONLINE</RxLabel>
          <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 6 }}>
            Seus contatos aparecerão aqui quando estiverem ativos.
          </div>
        </RxPanel>
      ) : null}
    </div>
  );
}
