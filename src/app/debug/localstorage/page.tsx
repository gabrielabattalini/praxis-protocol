"use client";

import { useEffect, useState } from "react";

type Snapshot = {
  storageKey: string;
  raw: string;
  parsed: unknown;
  parseError?: string;
};

type DietBlockSummary = {
  id: string;
  title: string;
  time: string;
  items: string[];
};

type DietPlanSummary = {
  id: string;
  name: string;
  createdAt?: string;
  isActive: boolean;
  blocks: DietBlockSummary[];
};

type DietView = {
  storageKey: string;
  activeDietPlanId?: string;
  liveMealPlan: DietBlockSummary[];
  dietPlans: DietPlanSummary[];
};

function readSnapshots(): Snapshot[] {
  if (typeof window === "undefined") return [];
  const out: Snapshot[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    if (!/praxis|nexus/i.test(key)) continue;
    const raw = window.localStorage.getItem(key) ?? "";
    let parsed: unknown = null;
    let parseError: string | undefined;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      parseError = error instanceof Error ? error.message : String(error);
    }
    out.push({ storageKey: key, raw, parsed, parseError });
  }
  return out;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function summarizeBlocks(mealPlan: unknown): DietBlockSummary[] {
  return asArray<Record<string, unknown>>(mealPlan).map((block) => ({
    id: asString(block.id),
    title: asString(block.title),
    time: asString(block.time),
    items: asArray<Record<string, unknown>>(block.items).map((item) =>
      asString(item.label),
    ),
  }));
}

function summarize(snapshot: Snapshot): DietView | null {
  const envelope = snapshot.parsed as
    | { state?: unknown; version?: unknown }
    | null;
  // O storage pode estar no formato "envelope" ({version, state}) ou direto.
  const state = (envelope && typeof envelope === "object" && "state" in envelope
    ? envelope.state
    : envelope) as Record<string, unknown> | null;
  if (!state || typeof state !== "object") return null;
  return {
    storageKey: snapshot.storageKey,
    activeDietPlanId: asString(state.activeDietPlanId) || undefined,
    liveMealPlan: summarizeBlocks(state.mealPlan),
    dietPlans: asArray<Record<string, unknown>>(state.dietPlans).map(
      (plan) => ({
        id: asString(plan.id),
        name: asString(plan.name),
        createdAt: asString(plan.createdAt) || undefined,
        isActive: asString(plan.id) === asString(state.activeDietPlanId),
        blocks: summarizeBlocks(plan.mealPlan),
      }),
    ),
  };
}

export default function DebugLocalStoragePage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    setSnapshots(readSnapshots());
  }, []);

  const views = snapshots
    .map(summarize)
    .filter((view): view is DietView => view !== null);

  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#e4e4e7", background: "#09090b", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Cópia local da dieta (localStorage)</h1>
      <p style={{ fontSize: 13, color: "#a1a1aa", marginBottom: 24 }}>
        Página de debug temporária. Lê o seu localStorage neste navegador e
        mostra os planos de dieta encontrados. Útil pra recuperar versões
        antigas que ficaram cacheadas localmente antes do servidor sobrescrever.
        Achou a versão certa? Me copia o JSON da seção abaixo.
      </p>

      <button
        type="button"
        onClick={() => setSnapshots(readSnapshots())}
        style={{ marginRight: 12, padding: "6px 12px", background: "#27272a", border: "1px solid #3f3f46", color: "#e4e4e7", borderRadius: 4, cursor: "pointer" }}
      >
        Recarregar
      </button>
      <button
        type="button"
        onClick={() => setShowRaw((v) => !v)}
        style={{ padding: "6px 12px", background: "#27272a", border: "1px solid #3f3f46", color: "#e4e4e7", borderRadius: 4, cursor: "pointer" }}
      >
        {showRaw ? "Esconder JSON cru" : "Mostrar JSON cru completo"}
      </button>

      <hr style={{ margin: "24px 0", border: "none", borderTop: "1px solid #27272a" }} />

      {snapshots.length === 0 ? (
        <p style={{ color: "#f87171" }}>
          Nenhuma chave do Praxis encontrada no localStorage deste navegador.
          Pode significar: outro navegador, modo anônimo, ou já foi limpo.
        </p>
      ) : null}

      {views.map((view) => (
        <section key={view.storageKey} style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, marginBottom: 4 }}>{view.storageKey}</h2>
          <p style={{ fontSize: 12, color: "#a1a1aa", marginBottom: 16 }}>
            Plano ativo: <strong>{view.activeDietPlanId ?? "(nenhum)"}</strong>
          </p>

          <h3 style={{ fontSize: 14, marginTop: 16, marginBottom: 8 }}>
            mealPlan LIVE ({view.liveMealPlan.length} blocks)
          </h3>
          {view.liveMealPlan.map((b) => (
            <div key={b.id} style={{ marginLeft: 12, marginBottom: 8, fontSize: 13 }}>
              <strong style={{ color: "#fbbf24" }}>{b.time}</strong>{" "}
              <strong>{b.title}</strong> · {b.items.length} itens
              <div style={{ marginLeft: 16, color: "#a1a1aa", fontSize: 12 }}>
                {b.items.join(", ")}
              </div>
            </div>
          ))}

          <h3 style={{ fontSize: 14, marginTop: 16, marginBottom: 8 }}>
            dietPlans salvos ({view.dietPlans.length})
          </h3>
          {view.dietPlans.map((plan) => (
            <details
              key={plan.id}
              style={{ marginBottom: 12, padding: 8, background: "#18181b", borderRadius: 4 }}
              open={plan.isActive}
            >
              <summary style={{ cursor: "pointer", fontSize: 13 }}>
                {plan.isActive ? "✓ " : ""}
                <strong>{plan.name}</strong>{" "}
                <span style={{ color: "#a1a1aa", fontSize: 12 }}>
                  ({plan.blocks.length} blocks · criado{" "}
                  {plan.createdAt ? plan.createdAt.slice(0, 16).replace("T", " ") : "?"})
                </span>
              </summary>
              <div style={{ marginTop: 8 }}>
                {plan.blocks.map((b) => (
                  <div key={b.id} style={{ marginBottom: 6, fontSize: 12 }}>
                    <strong style={{ color: "#fbbf24" }}>{b.time}</strong>{" "}
                    <strong>{b.title}</strong> · {b.items.length} itens
                    <div style={{ marginLeft: 16, color: "#a1a1aa" }}>
                      {b.items.join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </section>
      ))}

      {showRaw ? (
        <section>
          <h2 style={{ fontSize: 16, marginTop: 32 }}>JSON cru de todas as chaves</h2>
          {snapshots.map((s) => (
            <details key={s.storageKey} style={{ marginBottom: 12 }}>
              <summary style={{ cursor: "pointer", fontSize: 13 }}>
                {s.storageKey}{" "}
                <span style={{ color: "#a1a1aa", fontSize: 12 }}>
                  ({s.raw.length} bytes
                  {s.parseError ? ` · parse error: ${s.parseError}` : ""})
                </span>
              </summary>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  fontSize: 11,
                  color: "#a1a1aa",
                  background: "#18181b",
                  padding: 8,
                  borderRadius: 4,
                  maxHeight: 400,
                  overflow: "auto",
                }}
              >
                {s.raw}
              </pre>
            </details>
          ))}
        </section>
      ) : null}
    </div>
  );
}
