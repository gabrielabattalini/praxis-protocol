"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

/**
 * Abre o Portal do Cliente do Stripe (cancelar, trocar cartão, faturas).
 * Só aparece pra tier "paid" — vitalício não tem assinatura pra gerir.
 */
export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function openPortal() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const payload = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Não foi possível abrir o portal.");
      }
      window.location.href = payload.url;
    } catch (portalError) {
      setError(
        portalError instanceof Error
          ? portalError.message
          : "Não foi possível abrir o portal.",
      );
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <button
        type="button"
        onClick={openPortal}
        disabled={loading}
        className="inline-flex w-fit items-center gap-2 rounded-sm border border-zinc-700 bg-black/40 px-4 py-2.5 text-sm text-zinc-200 transition hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ExternalLink className="h-4 w-4" />
        )}
        Gerenciar assinatura (cancelar, faturas, cartão)
      </button>
      {error ? (
        <p style={{ fontSize: 12, color: "#fcd34d" }}>{error}</p>
      ) : null}
    </div>
  );
}
