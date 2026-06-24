"use client";

import type { CSSProperties } from "react";
import { formatCurrency } from "@/lib/utils";
import type { FinanceCard, FinanceCardBrand } from "@/lib/types";

const BRAND_LABEL: Record<FinanceCardBrand, string> = {
  visa: "VISA",
  mastercard: "MASTER",
  elo: "ELO",
  amex: "AMEX",
  other: "",
};

/**
 * Cartão de crédito visual — parece um cartão físico. Cor vem de
 * card.color (não do --accent), então cada cartão mantém identidade
 * própria independente do tema ativo. Tudo em style inline pra suportar
 * color-mix() dinâmico, igual TelegramCard e Avatar fazem no projeto.
 */
export function CreditCardTile({
  card,
  invoiceTotal,
  selected = false,
  onClick,
  className,
}: {
  card: FinanceCard;
  /** Total da fatura do mês ativo; quando definido vira um badge no cartão. */
  invoiceTotal?: number;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const color = card.color || "#fb923c";
  const brandLabel = card.brand ? BRAND_LABEL[card.brand] : "";

  const style: CSSProperties = {
    background: `linear-gradient(135deg, color-mix(in srgb, ${color} 80%, #000) 0%, color-mix(in srgb, ${color} 26%, #0a0a0c) 100%)`,
    border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
    boxShadow: selected
      ? `0 0 0 2px color-mix(in srgb, ${color} 70%, transparent), 0 0 28px color-mix(in srgb, ${color} 32%, transparent)`
      : `0 8px 24px rgba(0,0,0,0.35), 0 0 18px color-mix(in srgb, ${color} 14%, transparent)`,
  };

  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={style}
      className={`relative flex aspect-[1.586/1] w-full min-w-[240px] max-w-[340px] flex-col justify-between rounded-[20px] p-4 text-left transition ${
        onClick ? "cursor-pointer hover:-translate-y-0.5" : ""
      } ${className ?? ""}`}
    >
      {/* Topo: chip dourado + bandeira */}
      <div className="flex items-start justify-between">
        <div
          className="h-7 w-10 rounded-md"
          style={{
            background:
              "linear-gradient(135deg, #fde68a 0%, #f59e0b 55%, #b45309 100%)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)",
          }}
          aria-hidden
        />
        {brandLabel ? (
          <span className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-white/90">
            {brandLabel}
          </span>
        ) : null}
      </div>

      {/* Meio: número mascarado */}
      <p className="font-mono text-base tracking-[0.28em] text-white/85">
        ••••&nbsp;••••&nbsp;••••&nbsp;{card.last4 || "••••"}
      </p>

      {/* Rodapé: nome + vencimento */}
      <div className="flex items-end justify-between gap-2">
        <span className="truncate text-lg font-semibold text-white">
          {card.name}
        </span>
        {typeof card.dueDay === "number" ? (
          <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.2em] text-white/70">
            Venc {card.dueDay}
          </span>
        ) : null}
      </div>

      {/* Badge de fatura do mês */}
      {typeof invoiceTotal === "number" ? (
        <span
          className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
        >
          Fatura {formatCurrency(invoiceTotal)}
        </span>
      ) : null}
    </Tag>
  );
}
