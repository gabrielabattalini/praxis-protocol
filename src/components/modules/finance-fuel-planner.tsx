"use client";

import { useEffect, useMemo, useState } from "react";
import { Fuel, RotateCcw } from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { useAppStore } from "@/components/providers/app-store-provider";
import type { FinanceMonthId } from "@/lib/types";

/* ── Types ────────────────────────────────────────────────────── */

type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

type FuelType = "etanol" | "gasolina";

type DayConfig = { km: number; kmpl: number };

type FuelTypeConfig = {
  pricePerLiter: number;
  days: Record<DayKey, DayConfig>;
};

type FuelPlannerState = {
  activeFuelType: FuelType;
  etanol: FuelTypeConfig;
  gasolina: FuelTypeConfig;
};

const dayOrder: DayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const dayLabels: Record<DayKey, string> = {
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
  sunday: "Domingo",
};

const allFinanceMonths: FinanceMonthId[] = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/* ── Defaults seeded from the user's "Combustivel" spreadsheet ─── */

const DEFAULT_STATE: FuelPlannerState = {
  activeFuelType: "etanol",
  etanol: {
    pricePerLiter: 4.2,
    days: {
      monday: { km: 5, kmpl: 15 }, // estrada
      tuesday: { km: 5, kmpl: 8 },
      wednesday: { km: 5, kmpl: 8 },
      thursday: { km: 5, kmpl: 8 },
      friday: { km: 5, kmpl: 8 },
      saturday: { km: 5, kmpl: 8 },
      sunday: { km: 5, kmpl: 8 },
    },
  },
  gasolina: {
    pricePerLiter: 6,
    days: {
      monday: { km: 6, kmpl: 15 },
      tuesday: { km: 6, kmpl: 15 },
      wednesday: { km: 6, kmpl: 15 },
      thursday: { km: 6, kmpl: 15 },
      friday: { km: 6, kmpl: 15 },
      saturday: { km: 6, kmpl: 15 },
      sunday: { km: 6, kmpl: 15 },
    },
  },
};

// Legacy localStorage key — migrated into state.moduleState[fuelModuleKey]
// on first load, then cleaned up so KV is the only source of truth.
const STORAGE_KEY = "praxis-fuel-plan-v1";
const fuelModuleKey = "fuel-planner-v1";

function normalizeFuelState(raw: unknown): FuelPlannerState | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as Partial<FuelPlannerState>;
  if (
    !parsed.etanol ||
    !parsed.gasolina ||
    typeof parsed.activeFuelType !== "string"
  ) {
    return null;
  }
  return parsed as FuelPlannerState;
}

/* ── Component ────────────────────────────────────────────────── */

export function FinanceFuelPlanner() {
  const { state: appState, actions } = useAppStore();
  const [state, setState] = useState<FuelPlannerState>(() => {
    const fromStore = normalizeFuelState(appState.moduleState?.[fuelModuleKey]);
    if (fromStore) return fromStore;
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = normalizeFuelState(JSON.parse(raw));
          if (parsed) return parsed;
        }
      } catch {}
    }
    return DEFAULT_STATE;
  });
  const [hydrated, setHydrated] = useState(false);

  // On mount, migrate any legacy localStorage data into KV and clean up.
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror every state change into the central KV bucket (debounced
  // save fires automatically). Skip until hydrated to avoid clobbering
  // remote data with our initial-state default.
  useEffect(() => {
    if (!hydrated) return;
    actions.setModuleState(fuelModuleKey, state);
  }, [actions, hydrated, state]);

  const active = state[state.activeFuelType];

  const dailyLiters = useMemo(() => {
    const map = {} as Record<DayKey, number>;
    for (const d of dayOrder) {
      const cfg = active.days[d];
      const km = Math.max(0, Number(cfg.km) || 0);
      const kmpl = Math.max(0.1, Number(cfg.kmpl) || 0.1);
      map[d] = km / kmpl;
    }
    return map;
  }, [active]);

  const weeklyLiters = dayOrder.reduce((s, d) => s + dailyLiters[d], 0);
  const weeklyCost = weeklyLiters * active.pricePerLiter;
  // 52 weeks / 12 months ≈ 4.333… weeks per month
  const monthlyCost = weeklyCost * (52 / 12);

  function updateDay(day: DayKey, patch: Partial<DayConfig>) {
    setState((current) => ({
      ...current,
      [current.activeFuelType]: {
        ...current[current.activeFuelType],
        days: {
          ...current[current.activeFuelType].days,
          [day]: { ...current[current.activeFuelType].days[day], ...patch },
        },
      },
    }));
  }

  function updatePrice(value: number) {
    setState((current) => ({
      ...current,
      [current.activeFuelType]: {
        ...current[current.activeFuelType],
        pricePerLiter: value,
      },
    }));
  }

  function setFuelType(type: FuelType) {
    setState((current) => ({ ...current, activeFuelType: type }));
  }

  function resetActiveDefaults() {
    if (
      !window.confirm(
        `Voltar a configuração de ${state.activeFuelType === "etanol" ? "Etanol" : "Gasolina"} para os valores padrão da planilha?`,
      )
    )
      return;
    setState((current) => ({
      ...current,
      [current.activeFuelType]: { ...DEFAULT_STATE[current.activeFuelType] },
    }));
  }

  function applyToCombustivelLine() {
    const line = appState.financeBudget.lines.find(
      (l) => /[Cc]ombust/.test(l.name) && l.kind === "expense",
    );
    if (!line) {
      window.alert(
        'Nenhuma linha de "Combustível" encontrada no orçamento. Crie uma despesa com esse nome primeiro.',
      );
      return;
    }
    const rounded = Number(monthlyCost.toFixed(2));
    const ok = window.confirm(
      `Aplicar R$ ${rounded.toFixed(2)}/mês à linha "${line.name}" em todos os 12 meses?`,
    );
    if (!ok) return;
    for (const m of allFinanceMonths) {
      actions.updateFinanceMonthlyValue({
        lineId: line.id,
        month: m,
        value: rounded,
      });
    }
  }

  // Side-by-side compare with the other fuel
  const otherType: FuelType =
    state.activeFuelType === "etanol" ? "gasolina" : "etanol";
  const otherWeeklyLiters = dayOrder.reduce((sum, d) => {
    const cfg = state[otherType].days[d];
    const km = Math.max(0, Number(cfg.km) || 0);
    const kmpl = Math.max(0.1, Number(cfg.kmpl) || 0.1);
    return sum + km / kmpl;
  }, 0);
  const otherMonthlyCost =
    otherWeeklyLiters * state[otherType].pricePerLiter * (52 / 12);
  const cheaperOption: FuelType =
    monthlyCost <= otherMonthlyCost ? state.activeFuelType : otherType;
  const savings = Math.abs(monthlyCost - otherMonthlyCost);

  return (
    <div className="mt-6 space-y-4">
      <GlassPanel className="border-l-2 border-l-[var(--accent)]">
        <div className="flex items-center gap-3">
          <Fuel className="h-6 w-6 text-[var(--accent)]" />
          <div>
            <p className="praxis-label text-[var(--accent)]/80">
              Combustível // Planejamento
            </p>
            <h3 className="praxis-title text-2xl">
              Calculadora de consumo e custo
            </h3>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              Configure dia a dia:{" "}
              <span className="text-zinc-300">km rodados</span> e{" "}
              <span className="text-zinc-300">km/L do carro</span>. Compare
              etanol e gasolina lado a lado, e aplique o valor mensal direto na
              linha de Combustível do orçamento.
            </p>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel className="space-y-5">
        {/* Fuel type selector + price */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <p className="praxis-label text-zinc-500">Combustível ativo</p>
            {(["etanol", "gasolina"] as const).map((t) => {
              const selected = state.activeFuelType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFuelType(t)}
                  className={
                    "rounded-sm border px-4 py-2 text-sm font-medium transition " +
                    (selected
                      ? "border-[var(--accent)]/50 bg-[rgba(251,146,60,0.12)] text-[var(--accent)]"
                      : "border-zinc-800 bg-black/40 text-zinc-300 hover:border-white/20")
                  }
                >
                  {t === "etanol" ? "Etanol" : "Gasolina"}
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            Preço por litro
            <input
              type="number"
              min="0"
              step="0.01"
              value={active.pricePerLiter}
              onChange={(event) =>
                updatePrice(Number(event.target.value) || 0)
              }
              className="w-28 rounded-sm border border-zinc-800 bg-black/60 px-3 py-2 text-right font-semibold text-white"
            />
          </label>
        </div>

        {/* Day grid */}
        <div className="overflow-x-auto">
          <div className="grid min-w-[640px] grid-cols-[140px_repeat(7,minmax(72px,1fr))] gap-2">
            <div></div>
            {dayOrder.map((d) => (
              <div
                key={d}
                className="praxis-label pb-1 text-center text-zinc-500"
              >
                {dayLabels[d].slice(0, 3)}
              </div>
            ))}

            <div className="flex items-center text-sm font-medium text-zinc-300">
              km rodados/dia
            </div>
            {dayOrder.map((d) => (
              <input
                key={d}
                type="number"
                min="0"
                step="0.5"
                value={active.days[d].km}
                onChange={(event) =>
                  updateDay(d, { km: Number(event.target.value) || 0 })
                }
                className="rounded-sm border border-zinc-800 bg-black/60 px-2 py-2 text-center text-sm text-white"
              />
            ))}

            <div className="flex items-center text-sm font-medium text-zinc-300">
              km/L do carro
            </div>
            {dayOrder.map((d) => (
              <input
                key={d}
                type="number"
                min="0.1"
                step="0.1"
                value={active.days[d].kmpl}
                onChange={(event) =>
                  updateDay(d, { kmpl: Number(event.target.value) || 0.1 })
                }
                className="rounded-sm border border-zinc-800 bg-black/60 px-2 py-2 text-center text-sm text-white"
              />
            ))}

            <div className="flex items-center text-sm text-zinc-500">
              Litros / dia
            </div>
            {dayOrder.map((d) => (
              <div
                key={d}
                className="rounded-sm border border-zinc-900 bg-black/30 px-2 py-2 text-center text-sm font-semibold text-[var(--accent)]"
              >
                {dailyLiters[d].toFixed(2)}
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-sm border border-zinc-800 bg-black/40 p-4">
            <p className="praxis-label text-zinc-500">Litros / semana</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {weeklyLiters.toFixed(2)}
            </p>
          </div>
          <div className="rounded-sm border border-zinc-800 bg-black/40 p-4">
            <p className="praxis-label text-zinc-500">Custo / semana</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">
              R$ {weeklyCost.toFixed(2)}
            </p>
          </div>
          <div className="rounded-sm border border-[rgba(251,146,60,0.3)] bg-[rgba(251,146,60,0.08)] p-4">
            <p className="praxis-label text-[var(--accent)]">Custo / mês</p>
            <p className="mt-2 text-3xl font-bold text-[var(--accent)]">
              R$ {monthlyCost.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Compare */}
        <div className="rounded-sm border border-zinc-800 bg-black/30 p-4 text-sm leading-6 text-zinc-400">
          <span className="praxis-label text-zinc-500">Comparativo · </span>
          Com esta configuração,{" "}
          <span className="font-semibold text-[var(--accent)]">
            {cheaperOption === "etanol" ? "Etanol" : "Gasolina"}
          </span>{" "}
          sai mais barato — diferença de{" "}
          <span className="font-semibold text-white">
            R$ {savings.toFixed(2)}/mês
          </span>{" "}
          vs.{" "}
          <span className="text-zinc-300">
            {state.activeFuelType === "etanol" ? "Gasolina" : "Etanol"}
          </span>{" "}
          (R$ {otherMonthlyCost.toFixed(2)}/mês). Troque o seletor pra editar e
          comparar os dois lados independentemente — cada configuração é salva
          separadamente neste dispositivo.
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={applyToCombustivelLine}
            className="inline-flex items-center gap-2 rounded-sm border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/15"
          >
            <Fuel className="h-4 w-4" />
            Aplicar R$ {monthlyCost.toFixed(2)}/mês ao orçamento
          </button>
          <button
            type="button"
            onClick={resetActiveDefaults}
            className="inline-flex items-center gap-2 rounded-sm border border-zinc-800 bg-black/40 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-white/20"
          >
            <RotateCcw className="h-4 w-4" />
            Restaurar padrão da planilha
          </button>
        </div>
      </GlassPanel>
    </div>
  );
}
