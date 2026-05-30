"use client";

import { useEffect, useState } from "react";
import { PencilLine } from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { formatDateKey, formatPoints } from "@/lib/utils";

const WATER_QUICK_ACTIONS = [200, 500, 1000];

/**
 * Strip de hidratação compartilhado entre o módulo Dieta e a aba Missões.
 * Lê/grava o mesmo `waterEntries` no store, então os dois lugares ficam
 * sincronizados automaticamente. Botões de adicionar água + porcentagem
 * da meta + editar consumo manual.
 */
export function HydrationControls({ className }: { className?: string }) {
  const { state, actions } = useAppStore();

  // todayKey precisa virar quando cruza a meia-noite com o app aberto.
  // formatDateKey usa horário LOCAL — reseta à meia-noite do fuso do
  // usuário, não às 21h (que era o efeito de usar UTC no Brasil).
  const [todayKey, setTodayKey] = useState(() => formatDateKey(new Date()));
  useEffect(() => {
    const handle = window.setInterval(() => {
      const next = formatDateKey(new Date());
      setTodayKey((current) => (current === next ? current : next));
    }, 30_000);
    return () => window.clearInterval(handle);
  }, []);

  const waterTarget = state.dailyNutritionTargets?.waterMl ?? 0;
  const todayWaterConsumed =
    (state.waterEntries ?? []).find((entry) => entry.date === todayKey)
      ?.consumedMl ?? 0;
  const waterProgress =
    waterTarget > 0 ? (todayWaterConsumed / waterTarget) * 100 : 0;

  const addWater = (amountMl: number) => {
    actions.setWaterConsumed({
      date: todayKey,
      consumedMl: Math.max(0, todayWaterConsumed + amountMl),
    });
  };

  return (
    <div
      className={`rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-4 ${
        className ?? ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
          Hidratação
        </span>
        <span className="text-base font-semibold text-white">
          {formatPoints(Math.round(todayWaterConsumed))} /{" "}
          {formatPoints(waterTarget)} ml
        </span>
        <span className="rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.08)] px-2 py-0.5 text-[11px] text-[var(--accent)]">
          {Math.round(Math.min(waterProgress, 100))}%
        </span>
        <button
          type="button"
          aria-label="Editar consumo de água"
          title="Editar consumo de água"
          onClick={() => {
            const raw = window.prompt(
              "Quanto de água você consumiu hoje? (em ml)",
              String(Math.round(todayWaterConsumed)),
            );
            if (raw === null) return;
            const parsed = Number(raw.replace(",", ".").trim());
            if (!Number.isFinite(parsed) || parsed < 0) {
              window.alert("Valor inválido. Use só números, ex.: 1500");
              return;
            }
            actions.setWaterConsumed({
              date: todayKey,
              consumedMl: Math.round(parsed),
            });
          }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-zinc-700 text-zinc-400 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <PencilLine className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* Barra de progresso da meta de hidratação. */}
      <div className="mt-3 h-2 overflow-hidden rounded-sm border border-zinc-800 bg-black/50">
        <div
          className="h-full bg-[var(--accent)] transition-all duration-500"
          style={{ width: `${Math.min(waterProgress, 100)}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {WATER_QUICK_ACTIONS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => addWater(amount)}
            className="rounded-sm border border-zinc-800 bg-[rgba(18,18,20,0.96)] px-3 py-3 text-sm font-semibold text-zinc-200 transition hover:border-[rgba(251,146,60,0.24)] hover:text-[var(--accent)]"
          >
            +{formatPoints(amount)} ml
          </button>
        ))}
      </div>
    </div>
  );
}
