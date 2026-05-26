"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { RxChip } from "@/components/redesign/primitives";
import type { FriendTab } from "@/lib/types";

const tabs: Array<{ id: FriendTab; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "online", label: "Online" },
  { id: "requests", label: "Solicitações" },
];

export default function FriendsPage() {
  const { user } = useAppStore();
  const [tab, setTab] = useState<FriendTab>("all");

  // Lista de operadores sugeridos (Zenkichi, Kurama, Levi, etc.) foi
  // removida — era seed fake do mock-data. Quando a camada social
  // existir de verdade voltamos com convites e conexões reais.

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
            Nenhuma conexão ainda · você é{" "}
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

      <div className="glass" style={{ padding: 40, textAlign: "center" }}>
        <div className="praxis-label">
          {tab === "requests"
            ? "NENHUMA SOLICITAÇÃO"
            : "NENHUM OPERADOR CONECTADO"}
        </div>
        <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 8 }}>
          {tab === "requests"
            ? "Quando houver pedidos de amizade, eles aparecerão aqui."
            : "Convide operadores ou aguarde a camada social ser ativada."}
        </div>
      </div>
    </div>
  );
}
