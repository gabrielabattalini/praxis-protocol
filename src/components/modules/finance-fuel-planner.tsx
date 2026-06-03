"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Fuel, Plus, RotateCcw, Trash2 } from "lucide-react";
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

type FuelType = "etanol" | "gasolina" | "diesel" | "gnv" | "flex";

type Vehicle = {
  id: string;
  name: string;
  fuelType: FuelType;
  /** km rodados por dia da semana (compartilhado entre combustíveis no flex). */
  daysKm: Record<DayKey, number>;
  /** Single-fuel config (etanol, gasolina, diesel, gnv). */
  kmpl: number;
  pricePerLiter: number;
  /** Flex extra config: rodar a 2 combustíveis pra comparar. */
  flexAlt?: {
    kmpl: number;
    pricePerLiter: number;
  };
};

type FuelPlannerState = {
  vehicles: Vehicle[];
  activeVehicleId: string;
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

const FUEL_LABELS: Record<FuelType, string> = {
  etanol: "Etanol",
  gasolina: "Gasolina",
  diesel: "Diesel",
  gnv: "GNV",
  flex: "Flex (Etanol + Gasolina)",
};

// Flex: combustível principal = etanol, alt = gasolina (convenção).
// O usuário ajusta km/L e preço de cada um separadamente.
function defaultDaysKm(): Record<DayKey, number> {
  return {
    monday: 6,
    tuesday: 6,
    wednesday: 6,
    thursday: 6,
    friday: 6,
    saturday: 6,
    sunday: 6,
  };
}

function makeVehicleId() {
  return `vehicle-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function defaultVehicle(
  name = "Veículo principal",
  fuelType: FuelType = "flex",
): Vehicle {
  const base: Vehicle = {
    id: makeVehicleId(),
    name,
    fuelType,
    daysKm: defaultDaysKm(),
    kmpl: fuelType === "etanol" ? 8 : 12,
    pricePerLiter:
      fuelType === "etanol" ? 4.2 : fuelType === "diesel" ? 6.5 : fuelType === "gnv" ? 4.5 : 6,
  };
  if (fuelType === "flex") {
    base.kmpl = 8; // etanol (principal)
    base.pricePerLiter = 4.2;
    base.flexAlt = { kmpl: 12, pricePerLiter: 6 }; // gasolina
  }
  return base;
}

const DEFAULT_STATE: FuelPlannerState = (() => {
  const v = defaultVehicle("Veículo principal", "flex");
  return { vehicles: [v], activeVehicleId: v.id };
})();

// Legacy localStorage key — migrated into state.moduleState[fuelModuleKey]
// on first load, then cleaned up so KV is the only source of truth.
const STORAGE_KEY = "praxis-fuel-plan-v1";
const fuelModuleKey = "fuel-planner-v1";

/* ── State migration ──────────────────────────────────────────── */

function normalizeFuelState(raw: unknown): FuelPlannerState | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;

  // Formato novo: tem `vehicles`.
  if (Array.isArray(candidate.vehicles) && candidate.vehicles.length > 0) {
    const vehicles = candidate.vehicles
      .map((entry) => normalizeVehicle(entry))
      .filter((v): v is Vehicle => v !== null);
    if (vehicles.length === 0) return null;
    const activeId =
      typeof candidate.activeVehicleId === "string" &&
      vehicles.some((v) => v.id === candidate.activeVehicleId)
        ? candidate.activeVehicleId
        : vehicles[0].id;
    return { vehicles, activeVehicleId: activeId };
  }

  // Formato legado: { activeFuelType, etanol: {...}, gasolina: {...} }.
  // Converte em um único veículo flex preservando km/preço dos dois.
  if (
    candidate.etanol &&
    candidate.gasolina &&
    typeof candidate.activeFuelType === "string"
  ) {
    const legacyEtanol = candidate.etanol as Record<string, unknown>;
    const legacyGas = candidate.gasolina as Record<string, unknown>;
    const days = legacyEtanol.days as
      | Record<string, { km?: unknown; kmpl?: unknown }>
      | undefined;
    const daysKm = defaultDaysKm();
    if (days) {
      for (const d of dayOrder) {
        const km = Number(days[d]?.km);
        if (Number.isFinite(km) && km >= 0) daysKm[d] = km;
      }
    }
    const etanolKmpl = (() => {
      if (!days) return 8;
      const vals = dayOrder
        .map((d) => Number(days[d]?.kmpl))
        .filter((n) => Number.isFinite(n) && n > 0);
      return vals.length > 0 ? vals[0] : 8;
    })();
    const gasDays = legacyGas.days as
      | Record<string, { km?: unknown; kmpl?: unknown }>
      | undefined;
    const gasKmpl = (() => {
      if (!gasDays) return 12;
      const vals = dayOrder
        .map((d) => Number(gasDays[d]?.kmpl))
        .filter((n) => Number.isFinite(n) && n > 0);
      return vals.length > 0 ? vals[0] : 12;
    })();
    const vehicle: Vehicle = {
      id: makeVehicleId(),
      name: "Veículo principal",
      fuelType: "flex",
      daysKm,
      kmpl: etanolKmpl,
      pricePerLiter: Number(legacyEtanol.pricePerLiter) || 4.2,
      flexAlt: {
        kmpl: gasKmpl,
        pricePerLiter: Number(legacyGas.pricePerLiter) || 6,
      },
    };
    return { vehicles: [vehicle], activeVehicleId: vehicle.id };
  }

  return null;
}

function normalizeVehicle(raw: unknown): Vehicle | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  const id = typeof candidate.id === "string" ? candidate.id : makeVehicleId();
  const name =
    typeof candidate.name === "string" && candidate.name.trim()
      ? candidate.name
      : "Veículo";
  const fuelType: FuelType =
    candidate.fuelType === "etanol" ||
    candidate.fuelType === "gasolina" ||
    candidate.fuelType === "diesel" ||
    candidate.fuelType === "gnv" ||
    candidate.fuelType === "flex"
      ? candidate.fuelType
      : "gasolina";
  const daysKm = defaultDaysKm();
  if (candidate.daysKm && typeof candidate.daysKm === "object") {
    const src = candidate.daysKm as Record<string, unknown>;
    for (const d of dayOrder) {
      const km = Number(src[d]);
      if (Number.isFinite(km) && km >= 0) daysKm[d] = km;
    }
  }
  const vehicle: Vehicle = {
    id,
    name,
    fuelType,
    daysKm,
    kmpl: Number(candidate.kmpl) > 0 ? Number(candidate.kmpl) : 10,
    pricePerLiter:
      Number(candidate.pricePerLiter) > 0
        ? Number(candidate.pricePerLiter)
        : 6,
  };
  if (fuelType === "flex") {
    const alt = candidate.flexAlt as Record<string, unknown> | undefined;
    vehicle.flexAlt = {
      kmpl: alt && Number(alt.kmpl) > 0 ? Number(alt.kmpl) : 12,
      pricePerLiter:
        alt && Number(alt.pricePerLiter) > 0 ? Number(alt.pricePerLiter) : 6,
    };
  }
  return vehicle;
}

/* ── Calculation ──────────────────────────────────────────────── */

function calcWeeklyCost(
  daysKm: Record<DayKey, number>,
  kmpl: number,
  pricePerLiter: number,
) {
  const safeKmpl = Math.max(0.1, kmpl);
  const litersWeek = dayOrder.reduce(
    (sum, d) => sum + Math.max(0, daysKm[d] || 0) / safeKmpl,
    0,
  );
  return {
    weeklyLiters: litersWeek,
    weeklyCost: litersWeek * Math.max(0, pricePerLiter),
    monthlyCost: litersWeek * Math.max(0, pricePerLiter) * (52 / 12),
  };
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

  // actions é objeto literal recriado a cada render do provider — pôr
  // como dep do useEffect criava loop infinito (fix PR #96). Ref absorve.
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const lastSavedRef = useRef<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const serialized = JSON.stringify(state);
    if (lastSavedRef.current === serialized) return;
    lastSavedRef.current = serialized;
    actionsRef.current.setModuleState(fuelModuleKey, state);
  }, [hydrated, state]);

  const active =
    state.vehicles.find((v) => v.id === state.activeVehicleId) ??
    state.vehicles[0];

  const primaryCalc = useMemo(
    () => calcWeeklyCost(active.daysKm, active.kmpl, active.pricePerLiter),
    [active],
  );
  const flexCalc = useMemo(() => {
    if (active.fuelType !== "flex" || !active.flexAlt) return null;
    return calcWeeklyCost(
      active.daysKm,
      active.flexAlt.kmpl,
      active.flexAlt.pricePerLiter,
    );
  }, [active]);

  // km rodados depende só dos km/dia (igual pros dois combustíveis no flex).
  const weeklyKm = useMemo(
    () => dayOrder.reduce((sum, d) => sum + Math.max(0, active.daysKm[d] || 0), 0),
    [active],
  );
  const monthlyKm = weeklyKm * (52 / 12);

  function updateActiveVehicle(patch: Partial<Vehicle>) {
    setState((current) => ({
      ...current,
      vehicles: current.vehicles.map((v) =>
        v.id === current.activeVehicleId ? { ...v, ...patch } : v,
      ),
    }));
  }

  function updateDayKm(day: DayKey, km: number) {
    setState((current) => ({
      ...current,
      vehicles: current.vehicles.map((v) =>
        v.id === current.activeVehicleId
          ? { ...v, daysKm: { ...v.daysKm, [day]: km } }
          : v,
      ),
    }));
  }

  function setActiveVehicle(id: string) {
    setState((current) => ({ ...current, activeVehicleId: id }));
  }

  function addVehicle() {
    const v = defaultVehicle(`Veículo ${state.vehicles.length + 1}`, "gasolina");
    setState((current) => ({
      vehicles: [...current.vehicles, v],
      activeVehicleId: v.id,
    }));
  }

  function removeActiveVehicle() {
    if (state.vehicles.length <= 1) {
      window.alert("Mantenha ao menos 1 veículo cadastrado.");
      return;
    }
    if (
      !window.confirm(
        `Excluir o veículo "${active.name}"? Essa ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    setState((current) => {
      const remaining = current.vehicles.filter(
        (v) => v.id !== current.activeVehicleId,
      );
      return {
        vehicles: remaining,
        activeVehicleId: remaining[0].id,
      };
    });
  }

  function changeFuelType(nextType: FuelType) {
    if (nextType === "flex" && !active.flexAlt) {
      updateActiveVehicle({
        fuelType: "flex",
        flexAlt: { kmpl: 12, pricePerLiter: 6 },
      });
      return;
    }
    if (nextType !== "flex" && active.flexAlt) {
      updateActiveVehicle({ fuelType: nextType, flexAlt: undefined });
      return;
    }
    updateActiveVehicle({ fuelType: nextType });
  }

  function lineNameForVehicle(vehicleName: string) {
    return `Combustível — ${vehicleName.trim()}`;
  }

  function findVehicleLineId(vehicleName: string) {
    const target = lineNameForVehicle(vehicleName).trim().toLowerCase();
    return appState.financeBudget.lines.find(
      (l) => l.kind === "expense" && l.name.trim().toLowerCase() === target,
    )?.id;
  }

  // Pra flex: usa o MENOR custo dos dois (etanol vs gasolina) como
  // representação no orçamento — assume o user vai escolher o mais barato.
  // Pra outros: usa o cálculo direto.
  function getMonthlyCostForBudget(): number {
    if (active.fuelType === "flex" && flexCalc) {
      return Math.min(primaryCalc.monthlyCost, flexCalc.monthlyCost);
    }
    return primaryCalc.monthlyCost;
  }

  function applyToBudgetLine() {
    const rounded = Number(getMonthlyCostForBudget().toFixed(2));
    const lineName = lineNameForVehicle(active.name);
    const existingId = findVehicleLineId(active.name);
    if (existingId) {
      const ok = window.confirm(
        `Aplicar R$ ${rounded.toFixed(2)}/mês à linha "${lineName}" em todos os 12 meses?`,
      );
      if (!ok) return;
      for (const m of allFinanceMonths) {
        actions.updateFinanceMonthlyValue({
          lineId: existingId,
          month: m,
          value: rounded,
        });
      }
      return;
    }
    // Não existe — cria nova linha com este nome.
    const ok = window.confirm(
      `Criar nova linha "${lineName}" no orçamento com R$ ${rounded.toFixed(2)}/mês?`,
    );
    if (!ok) return;
    actions.addFinanceLine({
      name: lineName,
      kind: "expense",
      category: "Transporte",
      frequency: "variable",
      paymentMethod: "credit-card",
      initialMonth: "january",
      initialValue: rounded,
    });
    // O initialMonth só cobre janeiro; replica nos demais 11 meses.
    // Espera o estado se atualizar — usa o nome pra achar o id em setTimeout.
    window.setTimeout(() => {
      const newId = findVehicleLineId(active.name);
      if (!newId) return;
      for (const m of allFinanceMonths) {
        if (m === "january") continue;
        actions.updateFinanceMonthlyValue({
          lineId: newId,
          month: m,
          value: rounded,
        });
      }
    }, 50);
  }

  function resetDefaults() {
    if (
      !window.confirm(
        `Restaurar a configuração de "${active.name}" para os valores padrão?`,
      )
    )
      return;
    const fresh = defaultVehicle(active.name, active.fuelType);
    updateActiveVehicle({
      daysKm: fresh.daysKm,
      kmpl: fresh.kmpl,
      pricePerLiter: fresh.pricePerLiter,
      flexAlt: fresh.flexAlt,
    });
  }

  /* ── Render ────────────────────────────────────────────────── */

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
              Cadastre seus veículos com tipo de combustível (Etanol /
              Gasolina / Flex / Diesel / GNV). Pra flex, configure km/L e
              preço de cada um — o sistema mostra qual sai mais barato.
              Cada veículo vai pra uma linha própria no orçamento.
            </p>
          </div>
        </div>
      </GlassPanel>

      {/* Vehicle selector */}
      <GlassPanel className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="praxis-label text-zinc-500">Veículo</p>
          {state.vehicles.map((v) => {
            const selected = v.id === state.activeVehicleId;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setActiveVehicle(v.id)}
                className={
                  "rounded-sm border px-3 py-1.5 text-sm font-medium transition " +
                  (selected
                    ? "border-[var(--accent)]/50 bg-[rgba(251,146,60,0.12)] text-[var(--accent)]"
                    : "border-zinc-800 bg-black/40 text-zinc-300 hover:border-white/20")
                }
              >
                {v.name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={addVehicle}
            className="inline-flex items-center gap-1.5 rounded-sm border border-zinc-800 bg-black/40 px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:border-white/20"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar veículo
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 text-sm text-zinc-400">
            Nome
            <input
              type="text"
              value={active.name}
              onChange={(event) =>
                updateActiveVehicle({ name: event.target.value })
              }
              className="mt-1 w-full rounded-sm border border-zinc-800 bg-black/60 px-3 py-2 text-white"
              placeholder="Ex.: Carro, Moto, Caminhonete"
            />
          </label>
          <label className="text-sm text-zinc-400">
            Combustível
            <select
              value={active.fuelType}
              onChange={(event) =>
                changeFuelType(event.target.value as FuelType)
              }
              className="mt-1 w-full rounded-sm border border-zinc-800 bg-black/60 px-3 py-2 text-white [color-scheme:dark]"
            >
              {(Object.keys(FUEL_LABELS) as FuelType[]).map((t) => (
                <option key={t} value={t}>
                  {FUEL_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          {state.vehicles.length > 1 ? (
            <button
              type="button"
              onClick={removeActiveVehicle}
              className="inline-flex items-center gap-1.5 rounded-sm border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-500/15"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir veículo
            </button>
          ) : null}
        </div>
      </GlassPanel>

      {/* Day km grid */}
      <GlassPanel className="space-y-5">
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
                value={active.daysKm[d]}
                onChange={(event) =>
                  updateDayKm(d, Math.max(0, Number(event.target.value) || 0))
                }
                className="rounded-sm border border-zinc-800 bg-black/60 px-2 py-2 text-center text-sm text-white"
              />
            ))}
          </div>
        </div>

        {/* km rodados — independente do combustível */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-sm border border-zinc-800 bg-black/40 p-4">
            <p className="praxis-label text-zinc-500">km rodados / semana</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {weeklyKm.toFixed(1)}{" "}
              <span className="text-base font-normal text-zinc-500">km</span>
            </p>
          </div>
          <div className="rounded-sm border border-zinc-800 bg-black/40 p-4">
            <p className="praxis-label text-zinc-500">km rodados / mês</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {monthlyKm.toFixed(1)}{" "}
              <span className="text-base font-normal text-zinc-500">km</span>
            </p>
          </div>
        </div>

        {/* Per-fuel config — single OR flex */}
        {active.fuelType === "flex" && active.flexAlt ? (
          <FlexConfig
            primary={{
              label: "Etanol",
              kmpl: active.kmpl,
              pricePerLiter: active.pricePerLiter,
              onKmplChange: (v) => updateActiveVehicle({ kmpl: v }),
              onPriceChange: (v) =>
                updateActiveVehicle({ pricePerLiter: v }),
              calc: primaryCalc,
            }}
            alt={{
              label: "Gasolina",
              kmpl: active.flexAlt.kmpl,
              pricePerLiter: active.flexAlt.pricePerLiter,
              onKmplChange: (v) =>
                updateActiveVehicle({
                  flexAlt: { ...active.flexAlt!, kmpl: v },
                }),
              onPriceChange: (v) =>
                updateActiveVehicle({
                  flexAlt: { ...active.flexAlt!, pricePerLiter: v },
                }),
              calc: flexCalc!,
            }}
          />
        ) : (
          <SingleFuelConfig
            label={FUEL_LABELS[active.fuelType]}
            kmpl={active.kmpl}
            pricePerLiter={active.pricePerLiter}
            onKmplChange={(v) => updateActiveVehicle({ kmpl: v })}
            onPriceChange={(v) => updateActiveVehicle({ pricePerLiter: v })}
            calc={primaryCalc}
          />
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={applyToBudgetLine}
            className="inline-flex items-center gap-2 rounded-sm border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/15"
          >
            <Fuel className="h-4 w-4" />
            Aplicar R$ {getMonthlyCostForBudget().toFixed(2)}/mês ao orçamento
            <span className="text-xs text-emerald-300/80">
              ({lineNameForVehicle(active.name)})
            </span>
          </button>
          <button
            type="button"
            onClick={resetDefaults}
            className="inline-flex items-center gap-2 rounded-sm border border-zinc-800 bg-black/40 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-white/20"
          >
            <RotateCcw className="h-4 w-4" />
            Restaurar padrão deste veículo
          </button>
        </div>
      </GlassPanel>
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────────── */

type CalcResult = ReturnType<typeof calcWeeklyCost>;

function SingleFuelConfig(props: {
  label: string;
  kmpl: number;
  pricePerLiter: number;
  onKmplChange: (value: number) => void;
  onPriceChange: (value: number) => void;
  calc: CalcResult;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm text-zinc-400">
          km/L de {props.label}
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={props.kmpl}
            onChange={(event) =>
              props.onKmplChange(
                Math.max(0.1, Number(event.target.value) || 0.1),
              )
            }
            className="mt-1 w-28 rounded-sm border border-zinc-800 bg-black/60 px-3 py-2 text-right font-semibold text-white"
          />
        </label>
        <label className="text-sm text-zinc-400">
          Preço por litro de combustível
          <input
            type="number"
            min="0"
            step="0.01"
            value={props.pricePerLiter}
            onChange={(event) =>
              props.onPriceChange(Math.max(0, Number(event.target.value) || 0))
            }
            className="mt-1 w-28 rounded-sm border border-zinc-800 bg-black/60 px-3 py-2 text-right font-semibold text-white"
          />
        </label>
      </div>
      <TotalsRow label={props.label} calc={props.calc} highlight />
    </div>
  );
}

function FlexConfig(props: {
  primary: {
    label: string;
    kmpl: number;
    pricePerLiter: number;
    onKmplChange: (v: number) => void;
    onPriceChange: (v: number) => void;
    calc: CalcResult;
  };
  alt: {
    label: string;
    kmpl: number;
    pricePerLiter: number;
    onKmplChange: (v: number) => void;
    onPriceChange: (v: number) => void;
    calc: CalcResult;
  };
}) {
  const cheaperLabel =
    props.primary.calc.monthlyCost <= props.alt.calc.monthlyCost
      ? props.primary.label
      : props.alt.label;
  const savings = Math.abs(
    props.primary.calc.monthlyCost - props.alt.calc.monthlyCost,
  );
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {[props.primary, props.alt].map((side) => (
          <div
            key={side.label}
            className={
              "space-y-3 rounded-sm border p-4 " +
              (side.label === cheaperLabel
                ? "border-[var(--accent)]/40 bg-[rgba(251,146,60,0.05)]"
                : "border-zinc-800 bg-black/30")
            }
          >
            <p className="praxis-label text-zinc-500">{side.label}</p>
            <div className="flex flex-wrap gap-3">
              <label className="text-sm text-zinc-400">
                km/L
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={side.kmpl}
                  onChange={(event) =>
                    side.onKmplChange(
                      Math.max(0.1, Number(event.target.value) || 0.1),
                    )
                  }
                  className="mt-1 w-24 rounded-sm border border-zinc-800 bg-black/60 px-3 py-2 text-right font-semibold text-white"
                />
              </label>
              <label className="text-sm text-zinc-400">
                Preço por litro de combustível
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={side.pricePerLiter}
                  onChange={(event) =>
                    side.onPriceChange(
                      Math.max(0, Number(event.target.value) || 0),
                    )
                  }
                  className="mt-1 w-24 rounded-sm border border-zinc-800 bg-black/60 px-3 py-2 text-right font-semibold text-white"
                />
              </label>
            </div>
            <TotalsRow
              label={side.label}
              calc={side.calc}
              highlight={side.label === cheaperLabel}
            />
          </div>
        ))}
      </div>
      <div className="rounded-sm border border-zinc-800 bg-black/30 p-3 text-sm text-zinc-400">
        <span className="praxis-label text-zinc-500">Comparativo · </span>
        <span className="font-semibold text-[var(--accent)]">
          {cheaperLabel}
        </span>{" "}
        sai mais barato — economia de{" "}
        <span className="font-semibold text-white">
          R$ {savings.toFixed(2)}/mês
        </span>
        .
      </div>
    </div>
  );
}

function TotalsRow(props: {
  label: string;
  calc: CalcResult;
  highlight?: boolean;
}) {
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-3">
      <div className="rounded-sm border border-zinc-800 bg-black/40 p-3">
        <p className="text-xs text-zinc-500">Litros/semana</p>
        <p className="mt-1 font-semibold text-white">
          {props.calc.weeklyLiters.toFixed(2)} L
        </p>
      </div>
      <div className="rounded-sm border border-zinc-800 bg-black/40 p-3">
        <p className="text-xs text-zinc-500">Custo/semana</p>
        <p className="mt-1 font-semibold text-zinc-100">
          R$ {props.calc.weeklyCost.toFixed(2)}
        </p>
      </div>
      <div
        className={
          "rounded-sm border p-3 " +
          (props.highlight
            ? "border-[rgba(251,146,60,0.3)] bg-[rgba(251,146,60,0.08)]"
            : "border-zinc-800 bg-black/40")
        }
      >
        <p
          className={
            "text-xs " + (props.highlight ? "text-[var(--accent)]" : "text-zinc-500")
          }
        >
          Custo/mês
        </p>
        <p
          className={
            "mt-1 text-lg font-bold " +
            (props.highlight ? "text-[var(--accent)]" : "text-zinc-100")
          }
        >
          R$ {props.calc.monthlyCost.toFixed(2)}
        </p>
      </div>
    </div>
  );
}
