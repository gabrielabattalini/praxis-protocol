"use client";

import { CloudOff, Loader2 } from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";

/**
 * Sutil indicador de sincronização da conta. Fica fixo no canto inferior
 * direito. Só aparece quando o estado é "saving" ou "error" — quando
 * volta pra "idle" some, indicando que tudo foi enviado pro servidor.
 */
export function RemoteSaveIndicator() {
  const { hydrated, remoteSaveStatus } = useAppStore();

  if (!hydrated) return null;
  if (remoteSaveStatus === "idle") return null;

  const isError = remoteSaveStatus === "error";
  const label = isError
    ? "Sem sincronizar — tentando de novo"
    : "Salvando…";
  const Icon = isError ? CloudOff : Loader2;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 60,
        padding: "8px 12px",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        borderRadius: 999,
        border: `1px solid ${
          isError ? "rgba(251,146,60,0.4)" : "rgba(148,163,184,0.3)"
        }`,
        background: isError
          ? "rgba(251,146,60,0.12)"
          : "rgba(15,15,15,0.85)",
        color: isError ? "var(--accent)" : "var(--fg)",
        backdropFilter: "blur(8px)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        pointerEvents: "none",
      }}
    >
      <Icon
        size={14}
        className={isError ? undefined : "animate-spin"}
        style={{ flexShrink: 0 }}
      />
      <span>{label}</span>
    </div>
  );
}
