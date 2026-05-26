"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  LoaderCircle,
  PencilLine,
  Plus,
  Search,
  ShoppingBasket,
  Trash2,
  X,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import { PageIntro } from "@/components/ui/page-intro";
import {
  buildShoppingQueryLabel,
  type ShoppingPurchaseMode,
  type ShoppingModuleScope,
  type ShoppingModuleStoredState,
  type ShoppingSearchResponse,
  type ShoppingSearchResult,
  type ShoppingTrackedItem,
} from "@/lib/shopping-search";
import { getShoppingSeedState } from "@/lib/shopping-seed";
import { cn, formatCurrency } from "@/lib/utils";

type ShoppingModulePageProps = {
  scope: ShoppingModuleScope;
  title: string;
  description: string;
  storageKey: string;
  sourceNames: string[];
  examples: string[];
  emptyLabel: string;
  introEyebrow?: string;
};

type ShoppingItemDraft = {
  name: string;
  brand: string;
  /** Quantidade composta (número + unidade). O `quantity` string fica
   *  derivado de `quantityAmount + " " + quantityUnit` em todo change
   *  pra não quebrar o engine de parsing/preço que lê `quantity` cru. */
  quantity: string;
  quantityAmount: string;
  quantityUnit: string;
  /** Legacy total daily dose. Kept so existing items still load.
   *  saveItem now derives this from servingsPerDay × servingAmount. */
  dailyDose: string;
  /** Substance-anchored daily total. saveItem also derives this. */
  dailyDoseAmount: string;
  dailyDoseUnit: string;
  /** New "Opção 2" decomposition — tomadas × dose por tomada,
   *  com frequência configurável pra cobrir itens não-diários. */
  servingsPerDay: string;
  servingAmount: string;
  servingFrequency: "daily" | "weekly" | "monthly";
  mealBlockIds: string[];
  scheduleLabel: string;
  categoryLabel: string;
  referenceUrl: string;
  purchaseMode: ShoppingPurchaseMode;
  localStoreName: string;
  manualUnitPrice: string;
};

type ShoppingPricingOption = {
  kind: ShoppingPurchaseMode;
  sourceName: string;
  title: string;
  totalPrice: number;
  quantityLabel?: string;
  comparablePriceLabel?: string;
  comparablePrice?: number;
};

type ShoppingSortOption =
  | "monthly-cost-desc"
  | "monthly-cost-asc"
  | "base-price-desc"
  | "base-price-asc"
  | "monthly-use-desc"
  | "name-asc"
  | "name-desc"
  | "monthly-units-desc";

type ShoppingFilterOption =
  | "all"
  | "active"
  | "priced"
  | "online"
  | "presential"
  | "inactive";

const fieldClassName = "praxis-field w-full px-3 py-1.5 text-sm";

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyState(): ShoppingModuleStoredState {
  return {
    items: [],
    selectedItemId: undefined,
    snapshots: {},
    removedSeedItemIds: [],
    removedSeedNames: [],
  };
}

function normalizeSeedName(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Lista das unidades suportadas no dropdown de Qtd. — em ordem de
 *  frequência de uso pro contexto mercado/suplementos. */
const QUANTITY_UNITS = ["g", "kg", "mg", "ml", "l", "un"] as const;

/** Quebra uma string "500 g" / "1.5 kg" / "200ml" em { amount, unit }
 *  pra repopular o draft quando editar um item existente. Se não
 *  conseguir parsear (string vazia, formato esquisito), volta amount
 *  vazio + unit "g" como fallback seguro. */
function parseQuantityToParts(value: string): {
  amount: string;
  unit: string;
} {
  const normalized = value
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(",", ".");
  const match = normalized.match(
    /^(\d+(?:\.\d+)?)\s*(kg|g|mg|l|lt|ml|un|unid|unidade|unidades)$/,
  );
  if (!match) return { amount: "", unit: "g" };
  let unit = match[2];
  if (unit === "lt") unit = "l";
  if (unit === "unid" || unit === "unidade" || unit === "unidades") unit = "un";
  return { amount: match[1], unit };
}

function defaultDraft(): ShoppingItemDraft {
  return {
    name: "",
    brand: "",
    quantity: "",
    quantityAmount: "",
    quantityUnit: "g",
    dailyDose: "",
    dailyDoseAmount: "",
    dailyDoseUnit: "g",
    // 1 tomada/dia por padrão — o caso simples (Voextor, vitamina D etc.).
    servingsPerDay: "1",
    servingAmount: "",
    servingFrequency: "daily",
    mealBlockIds: [],
    scheduleLabel: "",
    categoryLabel: "",
    referenceUrl: "",
    purchaseMode: "online",
    localStoreName: "",
    manualUnitPrice: "",
  };
}

function getPreferredResult(
  snapshot: ShoppingModuleStoredState["snapshots"][string] | undefined,
  item: ShoppingTrackedItem | null,
) {
  if (!snapshot?.results.length || !item) return undefined;
  return snapshot.results.find((result) => result.id === item.preferredResultId) ?? snapshot.results[0];
}

function getWeeklyUnits(monthlyUnits: number) {
  return Number((monthlyUnits / 4).toFixed(2));
}

function formatUnits(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseTrackedQuantity(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();
  if (!normalized) return null;
  const packMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:x|por)\s*(\d+(?:[.,]\d+)?)\s*(kg|g|mg|l|lt|ml|capsulas|capsula|caps|cap|comprimidos|comprimido|tabletes|tablete|unidades|unidade|un|und|saches|sache|envelopes|envelope|doses|dose)/);
  const toNumber = (input: string) => Number(String(input).replace(",", "."));
  const convert = (amount: number, unit: string, multiplier = 1) => {
    const total = amount * multiplier;
    if (!Number.isFinite(total) || total <= 0) return null;
    if (unit === "kg") return { canonicalUnit: "g" as const, canonicalValue: total * 1000 };
    if (unit === "g") return { canonicalUnit: "g" as const, canonicalValue: total };
    if (unit === "mg") return { canonicalUnit: "g" as const, canonicalValue: total / 1000 };
    if (unit === "l" || unit === "lt") return { canonicalUnit: "ml" as const, canonicalValue: total * 1000 };
    if (unit === "ml") return { canonicalUnit: "ml" as const, canonicalValue: total };
    return { canonicalUnit: "unit" as const, canonicalValue: total };
  };
  if (packMatch) return convert(toNumber(packMatch[2]), packMatch[3], toNumber(packMatch[1]));
  const countedPortionMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(capsulas|capsula|caps|cap|comprimidos|comprimido|tabletes|tablete|unidades|unidade|un|und|saches|sache|envelopes|envelope|doses|dose)\s*(?:de)?\s*(\d+(?:[.,]\d+)?)\s*(g|mg|ml)/);
  if (countedPortionMatch) {
    return { canonicalUnit: "unit" as const, canonicalValue: toNumber(countedPortionMatch[1]) };
  }
  const simpleMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|mg|l|lt|ml|capsulas|capsula|caps|cap|comprimidos|comprimido|tabletes|tablete|unidades|unidade|un|und|saches|sache|envelopes|envelope|doses|dose)/);
  if (!simpleMatch) return null;
  return convert(toNumber(simpleMatch[1]), simpleMatch[2]);
}

function getMonthlyConsumption(dailyDose: number) {
  return Number((Math.max(0.01, dailyDose) * 30).toFixed(2));
}

function getMonthlyUnitsFromDose(quantityText: string, dailyDose: number, fallbackUnits = 1) {
  const parsedQuantity = parseTrackedQuantity(quantityText);
  if (!parsedQuantity) return Math.max(0.01, Number(fallbackUnits) || 1);
  return Math.max(0.01, Number((getMonthlyConsumption(dailyDose) / parsedQuantity.canonicalValue).toFixed(2)));
}

function getComparablePriceFromQuantity(totalPrice: number, quantityText: string) {
  const parsedQuantity = parseTrackedQuantity(quantityText);
  if (!parsedQuantity || !Number.isFinite(totalPrice) || totalPrice <= 0) return undefined;
  if (parsedQuantity.canonicalUnit === "g") {
    return { comparablePriceLabel: "100 g", comparablePrice: Number(((totalPrice / parsedQuantity.canonicalValue) * 100).toFixed(2)) };
  }
  if (parsedQuantity.canonicalUnit === "ml") {
    return { comparablePriceLabel: "100 ml", comparablePrice: Number(((totalPrice / parsedQuantity.canonicalValue) * 100).toFixed(2)) };
  }
  if (parsedQuantity.canonicalUnit === "unit") {
    return { comparablePriceLabel: "1 un", comparablePrice: Number((totalPrice / parsedQuantity.canonicalValue).toFixed(2)) };
  }
  return undefined;
}

function getPricingOption(
  snapshot: ShoppingModuleStoredState["snapshots"][string] | undefined,
  item: ShoppingTrackedItem | null,
): ShoppingPricingOption | undefined {
  if (!item) return undefined;
  if (item.purchaseMode === "presential") {
    const totalPrice = Math.max(0, Number(item.manualUnitPrice) || 0);
    if (totalPrice <= 0) return undefined;
    const comparable = getComparablePriceFromQuantity(totalPrice, item.quantity);
    return {
      kind: "presential",
      sourceName: item.localStoreName?.trim() || "Compra presencial",
      title: item.name,
      totalPrice,
      quantityLabel: item.quantity || undefined,
      comparablePriceLabel: comparable?.comparablePriceLabel,
      comparablePrice: comparable?.comparablePrice,
    };
  }
  const preferredResult = getPreferredResult(snapshot, item);
  if (!preferredResult) {
    const fallbackPrice = Math.max(0, Number(item.manualUnitPrice) || 0);
    if (fallbackPrice <= 0) return undefined;
    const comparable = getComparablePriceFromQuantity(fallbackPrice, item.quantity);
    return {
      kind: "online",
      sourceName: "Planilha base",
      title: item.name,
      totalPrice: fallbackPrice,
      quantityLabel: item.quantity || undefined,
      comparablePriceLabel: comparable?.comparablePriceLabel,
      comparablePrice: comparable?.comparablePrice,
    };
  }
  return {
    kind: "online",
    sourceName: preferredResult.sourceName,
    title: preferredResult.title,
    totalPrice: preferredResult.totalPrice,
    quantityLabel: preferredResult.quantityLabel,
    comparablePriceLabel: preferredResult.comparablePriceLabel,
    comparablePrice: preferredResult.comparablePrice,
  };
}

export function ShoppingModulePage({
  scope,
  title,
  description,
  storageKey,
  sourceNames,
  examples,
  emptyLabel,
  introEyebrow = "Modulo",
}: ShoppingModulePageProps) {
  const { hydrated, state, actions } = useAppStore();
  const dailyLabel = scope === "supplements" ? "Dose diaria" : "Consumo diario";
  const dailyHint =
    scope === "supplements"
      ? "O sistema usa essa dose para estimar o consumo do mes e quantos potes voce precisa."
      : "O sistema usa esse consumo para estimar quanto comprar por mes e quanto isso custa.";

  const storedState = state.shoppingModules[scope] ?? createEmptyState();
  const [draft, setDraft] = useState<ShoppingItemDraft>(() => defaultDraft());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  // Controls the "new item" form visibility on the left column. The
  // form panel is shown when isAddingNew is true OR editingItemId is
  // set (edit mode). The right-side "Cadastro rápido" panel was
  // removed at the user's request — single-flow editing now.
  const [isAddingNew, setIsAddingNew] = useState(false);
  // Collapse/expand for the "Ofertas online" subsection inside the
  // draft form (next to the "Buscar agora" button).
  const [searchResultsExpanded, setSearchResultsExpanded] = useState(true);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [searchingItemId, setSearchingItemId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [searchError, setSearchError] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [sortOption, setSortOption] =
    useState<ShoppingSortOption>("monthly-cost-desc");
  const [filterOption, setFilterOption] =
    useState<ShoppingFilterOption>("all");
  const mealBlocks = useMemo(
    () =>
      [...state.mealPlan].sort((left, right) =>
        `${left.time}-${left.title}`.localeCompare(`${right.time}-${right.title}`, "pt-BR"),
      ),
    [state.mealPlan],
  );
  const mealBlockMap = useMemo(
    () =>
      mealBlocks.reduce<Record<string, (typeof mealBlocks)[number]>>((nextMap, block) => {
        nextMap[block.id] = block;
        return nextMap;
      }, {}),
    [mealBlocks],
  );

  const replaceModuleState = useCallback(
    (nextState: ShoppingModuleStoredState) => {
      actions.replaceShoppingModuleState({ scope, nextState });
    },
    [actions, scope],
  );

  function updateModuleState(
    updater: (current: ShoppingModuleStoredState) => ShoppingModuleStoredState,
  ) {
    replaceModuleState(updater(storedState));
  }

  useEffect(() => {
    if (!hydrated) return;
    if (
      storedState.items.length ||
      Object.keys(storedState.snapshots).length ||
      (storedState.removedSeedItemIds?.length ?? 0) > 0
    ) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as ShoppingModuleStoredState;
        replaceModuleState({
          items: Array.isArray(parsed.items) ? parsed.items : [],
          selectedItemId: parsed.selectedItemId,
          snapshots: parsed.snapshots ?? {},
          removedSeedItemIds: Array.isArray(parsed.removedSeedItemIds)
            ? parsed.removedSeedItemIds
            : [],
          removedSeedNames: Array.isArray(parsed.removedSeedNames)
            ? parsed.removedSeedNames
            : [],
        });
        window.localStorage.removeItem(storageKey);
        return;
      }
    } catch {
      // se falhar a leitura legada, cai para o seed padrao
    }

    replaceModuleState(getShoppingSeedState(scope));
  }, [
    hydrated,
    replaceModuleState,
    scope,
    storageKey,
    storedState.items.length,
    storedState.snapshots,
    storedState.removedSeedItemIds,
  ]);

  const selectedItem = useMemo(
    () => storedState.items.find((item) => item.id === storedState.selectedItemId) ?? storedState.items[0] ?? null,
    [storedState.items, storedState.selectedItemId],
  );

  const selectedSnapshot = selectedItem ? storedState.snapshots[selectedItem.id] : undefined;
  const bestOffer = getPricingOption(selectedSnapshot, selectedItem);

  const estimatedMonthlyTotal = useMemo(
    () => storedState.items.reduce((sum, item) => {
      if (!item.includeInFinance) return sum;
      const pricingOption = getPricingOption(storedState.snapshots[item.id], item);
      if (!pricingOption) return sum;
      return sum + pricingOption.totalPrice * item.monthlyUnits;
    }, 0),
    [storedState.items, storedState.snapshots],
  );

  const estimatedWeeklyTotal = useMemo(() => Number((estimatedMonthlyTotal / 4).toFixed(2)), [estimatedMonthlyTotal]);

  const normalizedTableSearch = useMemo(
    () => normalizeSearchText(tableSearch),
    [tableSearch],
  );

  const monitoredRows = useMemo(() => {
    const rows = storedState.items
      .map((item) => {
        const snapshot = storedState.snapshots[item.id];
        const pricingOption = getPricingOption(snapshot, item);
        const estimatedItemMonthly = pricingOption
          ? pricingOption.totalPrice * item.monthlyUnits
          : 0;
        const linkedMealBlocks = (item.mealBlockIds ?? [])
          .map((mealBlockId) => mealBlockMap[mealBlockId])
          .filter((block): block is NonNullable<typeof block> => Boolean(block));
        const linkedMealsLabel = linkedMealBlocks.length
          ? linkedMealBlocks
              .map((block) =>
                `${block.title} ${block.time ? `(${block.time})` : ""}`.trim(),
              )
              .join(" • ")
          : "";
        const monthlyConsumption = getMonthlyConsumption(item.dailyDose);

        return {
          item,
          snapshot,
          pricingOption,
          estimatedItemMonthly,
          linkedMealBlocks,
          linkedMealsLabel,
          monthlyConsumption,
        };
      })
      .filter((row) => {
        const searchableText = normalizeSearchText(
          [
            row.item.name,
            row.item.brand,
            row.item.categoryLabel,
            row.item.localStoreName,
            row.item.scheduleLabel,
            row.linkedMealsLabel,
          ]
            .filter(Boolean)
            .join(" "),
        );

        if (normalizedTableSearch && !searchableText.includes(normalizedTableSearch)) {
          return false;
        }

        switch (filterOption) {
          case "active":
            return row.item.includeInFinance;
          case "inactive":
            return !row.item.includeInFinance;
          case "priced":
            return Boolean(row.pricingOption);
          case "online":
            return row.item.purchaseMode === "online";
          case "presential":
            return row.item.purchaseMode === "presential";
          default:
            return true;
        }
      });

    rows.sort((left, right) => {
      switch (sortOption) {
        case "name-asc":
          return left.item.name.localeCompare(right.item.name, "pt-BR");
        case "name-desc":
          return right.item.name.localeCompare(left.item.name, "pt-BR");
        case "base-price-desc":
          return (right.pricingOption?.totalPrice ?? 0) - (left.pricingOption?.totalPrice ?? 0);
        case "base-price-asc":
          return (left.pricingOption?.totalPrice ?? 0) - (right.pricingOption?.totalPrice ?? 0);
        case "monthly-use-desc":
          return right.monthlyConsumption - left.monthlyConsumption;
        case "monthly-units-desc":
          return right.item.monthlyUnits - left.item.monthlyUnits;
        case "monthly-cost-asc":
          return left.estimatedItemMonthly - right.estimatedItemMonthly;
        case "monthly-cost-desc":
        default:
          return right.estimatedItemMonthly - left.estimatedItemMonthly;
      }
    });

    return rows;
  }, [
    filterOption,
    mealBlockMap,
    normalizedTableSearch,
    sortOption,
    storedState.items,
    storedState.snapshots,
  ]);

  // When scope === "market", the user wants the list visually split
  // into two physical blocks (presencial vs online). We inject section
  // marker entries between the two groups so the existing .map() can
  // emit a divider row without us extracting the 300-line row body.
  const monitoredRowsWithSections = useMemo<
    Array<
      | (typeof monitoredRows)[number]
      | { __sectionMarker: true; mode: ShoppingPurchaseMode; count: number }
    >
  >(() => {
    if (scope !== "market") return monitoredRows;

    const presentialRows = monitoredRows.filter(
      (row) => row.item.purchaseMode === "presential",
    );
    const onlineRows = monitoredRows.filter(
      (row) => row.item.purchaseMode === "online",
    );

    return [
      {
        __sectionMarker: true as const,
        mode: "presential" as ShoppingPurchaseMode,
        count: presentialRows.length,
      },
      ...presentialRows,
      {
        __sectionMarker: true as const,
        mode: "online" as ShoppingPurchaseMode,
        count: onlineRows.length,
      },
      ...onlineRows,
    ];
  }, [monitoredRows, scope]);

  // Annual purchase forecast — available for BOTH scopes (market and
  // supplements). For each calendar month (1-12), sum the cost of every
  // item whose purchase schedule lands on that month.
  //
  // Interval is derived from monthlyUnits (NOT a separate field):
  //   monthlyUnits >= 1   → interval = 1 (buy every month, multiple units)
  //   monthlyUnits = 0.5  → interval = 2 (buy 1 every 2 months)
  //   monthlyUnits = 0.125 → interval = 8 (buy 1 every 8 months)
  // Each item generates its set of purchase months by anchoring at
  // nextPurchaseMonth and walking ±interval steps inside [1, 12], so the
  // user can stagger when in the year the spikes land.
  const annualForecast = useMemo(() => {
    function intervalFromMonthlyUnits(monthlyUnits: number) {
      if (!Number.isFinite(monthlyUnits) || monthlyUnits <= 0) return 1;
      if (monthlyUnits >= 1) return 1;
      return Math.max(1, Math.round(1 / monthlyUnits));
    }

    function purchaseMonthsFor(item: ShoppingTrackedItem) {
      const interval = intervalFromMonthlyUnits(item.monthlyUnits);
      const start =
        item.nextPurchaseMonth ?? new Date().getMonth() + 1;
      const months = new Set<number>();
      for (let k = -12; k <= 12; k++) {
        const m = start + k * interval;
        if (m >= 1 && m <= 12) months.add(m);
      }
      return months;
    }

    const monthLabels = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];

    const months = monthLabels.map((label, idx) => {
      const monthIdx = idx + 1;
      let total = 0;
      const items: Array<{ name: string; cost: number }> = [];

      for (const item of storedState.items) {
        if (!item.includeInFinance) continue;
        const pricing = getPricingOption(
          storedState.snapshots[item.id],
          item,
        );
        const unitPrice = pricing?.totalPrice ?? 0;
        if (unitPrice <= 0) continue;
        const purchaseMonths = purchaseMonthsFor(item);
        if (!purchaseMonths.has(monthIdx)) continue;
        const interval = intervalFromMonthlyUnits(item.monthlyUnits);
        // Cost per purchase = enough units to cover the interval period.
        // For monthlyUnits >= 1, that's monthlyUnits × 1 = monthlyUnits.
        // For 0.5 over 2 months it's 0.5 × 2 = 1 unit. For 0.125 over
        // 8 months it's 0.125 × 8 = 1 unit. Money out = unitPrice × that.
        const cost = unitPrice * item.monthlyUnits * interval;
        if (cost <= 0) continue;
        total += cost;
        items.push({ name: item.name, cost });
      }

      return {
        label,
        monthIdx,
        total: Math.round(total * 100) / 100,
        items: items.sort((a, b) => b.cost - a.cost),
      };
    });

    const totals = months.map((m) => m.total);
    const annualTotal = totals.reduce((sum, value) => sum + value, 0);
    const monthsWithSpend = totals.filter((value) => value > 0);
    const averageMonth =
      monthsWithSpend.length > 0 ? annualTotal / monthsWithSpend.length : 0;
    const maxMonthTotal = Math.max(0, ...totals);
    const minMonthTotal =
      monthsWithSpend.length > 0 ? Math.min(...monthsWithSpend) : 0;

    return {
      months,
      annualTotal: Math.round(annualTotal * 100) / 100,
      averageMonth: Math.round(averageMonth * 100) / 100,
      maxMonthTotal: Math.round(maxMonthTotal * 100) / 100,
      minMonthTotal: Math.round(minMonthTotal * 100) / 100,
    };
  }, [storedState.items, storedState.snapshots]);

  const [forecastExpanded, setForecastExpanded] = useState(true);
  const [forecastDetailMonth, setForecastDetailMonth] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (!selectedItem && storedState.items.length) {
      replaceModuleState({ ...storedState, selectedItemId: storedState.items[0]?.id });
    }
  }, [replaceModuleState, selectedItem, storedState]);

  function resetDraft() {
    setDraft(defaultDraft());
    setEditingItemId(null);
    setIsAddingNew(false);
  }

  function openAddForm() {
    setDraft(defaultDraft());
    setEditingItemId(null);
    setIsAddingNew(true);
    setSearchError("");
    setFeedback("");
  }

  function startEditing(item: ShoppingTrackedItem) {
    // Re-read the item from the live store. Without this, the form
    // could populate from a captured stale closure (the row card binds
    // `item` from its map render) and the user would see the OLD price
    // when reopening Editar after a recent change. fresh > param.
    const fresh = storedState.items.find((entry) => entry.id === item.id) ?? item;
    setEditingItemId(fresh.id);
    setIsAddingNew(false);
    setExpandedItemId(fresh.id);
    // Backwards-compat: items saved before the Opção 2 split only have
    // dailyDose. Treat them as 1 serving/day with the dose = total.
    const inferredServings = fresh.servingsPerDay ?? 1;
    const inferredServingAmount =
      fresh.servingAmount ?? fresh.dailyDoseAmount ?? fresh.dailyDose;
    // Quantidade legada vem como string ("500 g" / "1.5 kg" / "200ml"…).
    // Quebra em amount + unit pra alimentar os dois inputs do form. Se
    // o formato for esquisito, fica com amount vazio e unit "g" (parts
    // entrega esse fallback), aí o user re-digita.
    const quantityParts = parseQuantityToParts(fresh.quantity);
    setDraft({
      name: fresh.name,
      brand: fresh.brand,
      quantity: fresh.quantity,
      quantityAmount: quantityParts.amount,
      quantityUnit: quantityParts.unit,
      dailyDose: fresh.dailyDose.toString(),
      dailyDoseAmount:
        fresh.dailyDoseAmount !== undefined ? String(fresh.dailyDoseAmount) : "",
      dailyDoseUnit: fresh.dailyDoseUnit ?? "g",
      servingsPerDay: String(inferredServings),
      servingAmount:
        inferredServingAmount && inferredServingAmount > 0
          ? String(inferredServingAmount)
          : "",
      servingFrequency: fresh.servingFrequency ?? "daily",
      mealBlockIds: fresh.mealBlockIds ?? [],
      scheduleLabel: fresh.scheduleLabel ?? "",
      categoryLabel: fresh.categoryLabel ?? "",
      referenceUrl: fresh.referenceUrl ?? "",
      purchaseMode: fresh.purchaseMode,
      localStoreName: fresh.localStoreName ?? "",
      manualUnitPrice: fresh.manualUnitPrice !== undefined ? fresh.manualUnitPrice.toString() : "",
    });
    setSearchError("");
    setFeedback("");
  }

  function saveItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.name.trim();
    // Opção 2: tomadas × dose × frequência → dose diária total.
    // Itens não-diários (alergia esporádica, IPVA, etc.) usam
    // servingFrequency "weekly" ou "monthly". A divisão pra "por dia"
    // mantém o restante do engine (custo mensal, busca, etc.)
    // funcionando sem ramificações.
    // Aceita fracionário (0.5, 0.25 etc.) — caso de "1 cápsula a cada 2
    // dias" = 0.5 tomadas/dia, ou "meio comprimido por dia" = 0.5. O
    // Math.round antigo travava qualquer valor < 1 em 1 e mandava
    // saída inteira, então 0.5 ficava 1 e dobrava o consumo calculado.
    const servingsPerDay = Math.max(0.01, Number(draft.servingsPerDay) || 1);
    const servingAmount = Math.max(0, Number(draft.servingAmount) || 0);
    const fallbackDailyDose = Math.max(0, Number(draft.dailyDose) || 0);
    const frequencyToDailyMultiplier: Record<typeof draft.servingFrequency, number> = {
      daily: 1,
      weekly: 1 / 7,
      monthly: 1 / 30,
    };
    const dailyDose =
      servingAmount > 0
        ? servingsPerDay * servingAmount * frequencyToDailyMultiplier[draft.servingFrequency]
        : fallbackDailyDose;
    const purchaseMode = scope === "market" ? draft.purchaseMode : "online";
    const manualUnitPrice = Math.max(0, Number(draft.manualUnitPrice) || 0);

    if (name.length < 2) return;
    if (!Number.isFinite(dailyDose) || dailyDose <= 0) return;
    if (purchaseMode === "presential" && manualUnitPrice <= 0) return;

    const currentEditingItem = editingItemId ? storedState.items.find((item) => item.id === editingItemId) : undefined;

    const nextItem: ShoppingTrackedItem = {
      id: editingItemId ?? makeId(scope),
      name,
      brand: draft.brand.trim(),
      quantity: draft.quantity.trim(),
      mealBlockIds: draft.mealBlockIds.filter((mealBlockId) => mealBlockMap[mealBlockId]),
      scheduleLabel: draft.scheduleLabel.trim() || undefined,
      categoryLabel: draft.categoryLabel.trim() || undefined,
      dailyDose,
      // dailyDoseAmount + dailyDoseUnit ficam espelhados pra alimentar
      // os cálculos de custo-por-dia-da-substância no search engine.
      dailyDoseAmount: dailyDose > 0 ? dailyDose : undefined,
      dailyDoseUnit: (() => {
        const valid = ["mg", "g", "mcg", "ml", "serving"];
        return valid.includes(draft.dailyDoseUnit)
          ? (draft.dailyDoseUnit as ShoppingTrackedItem["dailyDoseUnit"])
          : undefined;
      })(),
      // Novos campos da Opção 2 — fonte da verdade pra edição.
      servingsPerDay: servingsPerDay,
      servingAmount: servingAmount > 0 ? servingAmount : undefined,
      servingFrequency: draft.servingFrequency,
      // Fallback antes era currentEditingItem?.monthlyUnits — isso
      // perpetuava valores absurdos quando o item legado tinha
      // monthlyUnits ruim (ex: 12000) e a Qtd não conseguia ser
      // parseada. Agora cai sempre pra 1, então re-salvar com Qtd
      // vazia "limpa" o bug. Quando a Qtd é parseável, o getMonthly
      // calcula corretamente (consumo mensal / canonicalValue).
      monthlyUnits: getMonthlyUnitsFromDose(draft.quantity.trim(), dailyDose, 1),
      includeInFinance: currentEditingItem?.includeInFinance ?? true,
      purchaseMode,
      localStoreName: purchaseMode === "presential" ? draft.localStoreName.trim() || undefined : undefined,
      manualUnitPrice: manualUnitPrice > 0 ? manualUnitPrice : undefined,
      referenceUrl: draft.referenceUrl.trim() || undefined,
      preferredResultId: purchaseMode === "online" ? currentEditingItem?.preferredResultId : undefined,
      createdAt: currentEditingItem?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    updateModuleState((current) => ({
      ...current,
      items: editingItemId
        ? current.items.map((item) => (item.id === editingItemId ? nextItem : item))
        : [nextItem, ...current.items],
      selectedItemId: nextItem.id,
    }));

    setExpandedItemId(nextItem.id);
    setFeedback(editingItemId ? "Item atualizado." : "Item salvo na lista.");
    setSearchError("");
    resetDraft();
  }

  function removeItem(itemId: string) {
    updateModuleState((current) => {
      const nextItems = current.items.filter((item) => item.id !== itemId);
      const nextSnapshots = { ...current.snapshots };
      delete nextSnapshots[itemId];
      const removedItem = current.items.find((item) => item.id === itemId);
      const normalizedRemovedName = removedItem ? normalizeSeedName(removedItem.name) : "";
      const matchingSeedIds = normalizedRemovedName
        ? getShoppingSeedState(scope).items
            .filter((seedItem) => normalizeSeedName(seedItem.name) === normalizedRemovedName)
            .map((seedItem) => seedItem.id)
        : [];
      const nextRemovedSeedItemIds = Array.from(
        new Set([...(current.removedSeedItemIds ?? []), itemId, ...matchingSeedIds]),
      );
      const nextRemovedSeedNames = Array.from(
        new Set([
          ...(current.removedSeedNames ?? []),
          ...(normalizedRemovedName ? [normalizedRemovedName] : []),
        ]),
      );
      return {
        ...current,
        items: nextItems,
        selectedItemId: current.selectedItemId === itemId ? nextItems[0]?.id : current.selectedItemId,
        snapshots: nextSnapshots,
        removedSeedItemIds: nextRemovedSeedItemIds,
        removedSeedNames: nextRemovedSeedNames,
      };
    });

    if (expandedItemId === itemId) setExpandedItemId(null);
    if (editingItemId === itemId) resetDraft();
  }

  /**
   * The full draft form. Used both for "new item" (top-of-list card)
   * and "edit existing" (same card, pre-populated by startEditing).
   * Lives here so we have a single source of truth for every field —
   * the right-side "Cadastro rápido" panel was removed to consolidate
   * the editing flow at the user's request.
   */
  function renderDraftForm() {
    return (
      <form className="space-y-4" onSubmit={saveItem}>
        {/* SECTION 1 — Identidade + Dose + Preço (TUDO em uma linha em telas grandes)
            User pediu pra colapsar dose alvo na dose diária (são a
            mesma coisa) e jogar tudo numa linha só. saveItem espelha
            dailyDose → dailyDoseAmount pra manter os cálculos de
            custo-por-dia/dose-substância funcionando.
            Layout responsivo:
              mobile (default) → 1 col
              sm (≥640) → 2 cols
              md (≥768) → 3 cols
              lg (≥1024) → 4 cols
              xl (≥1280) → todos os 7 numa linha só */}
        <section className="space-y-2">
          <div className="praxis-label flex items-center gap-2 border-b border-white/5 pb-1 text-[10px] text-zinc-400">
            <span className="inline-block h-1 w-1 rounded-full bg-[var(--accent)]" />
            Item
          </div>
          {/* Rebalanceamento (sexto passe): Compra foi pro canto
              direito a pedido do user — Tomadas × dose volta pra
              antes dele. 7 cols em xl:
                Nome 1.2 / Marca / Qtd / Preço 0.7 / Link 0.7 /
                Tomadas × dose 1.8 / Compra 1.2
              Os outros campos continuam mais à esquerda como pedido. */}
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,1.8fr)_minmax(0,1.2fr)]">
            <label className="block space-y-1 min-w-0">
              <span className="praxis-label text-[var(--accent)]">Nome</span>
              <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder={examples[0] ?? "Ex.: detergente"} className={fieldClassName} />
            </label>
            <label className="block space-y-1 min-w-0">
              <span className="praxis-label text-[var(--accent)]">Marca</span>
              <input value={draft.brand} onChange={(event) => setDraft((current) => ({ ...current, brand: event.target.value }))} placeholder={examples[1] ?? "Ex.: Growth"} className={fieldClassName} />
            </label>
            <label className="block space-y-1 min-w-0">
              <span className="praxis-label text-[var(--accent)]">Qtd.</span>
              {/* Qtd. agora é composta: [número] + [unidade]. Mantém o
                  draft.quantity sincronizado como string "X unit" pra
                  não quebrar o engine de parsing/preço que lê esse
                  campo cru (parseTrackedQuantity / getMonthlyUnits).
                  Unit column subiu de 3.6rem pra 5.5rem — o select
                  estava cortando "kg/mg/ml" muito apertado. */}
              <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-1">
                <input
                  value={draft.quantityAmount}
                  onChange={(event) =>
                    setDraft((current) => {
                      const amount = event.target.value;
                      const quantity = amount.trim()
                        ? `${amount.trim()} ${current.quantityUnit}`
                        : "";
                      return { ...current, quantityAmount: amount, quantity };
                    })
                  }
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={examples[2]?.replace(/\s*(kg|g|mg|ml|l|un|unidade|unidades)\s*$/i, "").trim() || "Ex.: 500"}
                  className={fieldClassName}
                  aria-label="Quantidade do pacote"
                />
                <select
                  value={draft.quantityUnit}
                  onChange={(event) =>
                    setDraft((current) => {
                      const unit = event.target.value;
                      const quantity = current.quantityAmount.trim()
                        ? `${current.quantityAmount.trim()} ${unit}`
                        : "";
                      return { ...current, quantityUnit: unit, quantity };
                    })
                  }
                  className={fieldClassName}
                  aria-label="Unidade da quantidade"
                >
                  {QUANTITY_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            {/* Preço subiu pra cá ("no lugar da Categoria") — antes
                ficava na última coluna. draft.categoryLabel continua
                no state como string vazia (não tem mais input pra
                editar) pra não quebrar saveItem. */}
            <label className="block space-y-1 min-w-0">
              <span className="praxis-label text-[var(--accent)]">Preço (R$)</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-400">
                  R$
                </span>
                <input
                  value={draft.manualUnitPrice}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      manualUnitPrice: event.target.value,
                    }))
                  }
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="39,90"
                  className={`${fieldClassName} pl-8`}
                />
              </div>
            </label>
            <label className="block space-y-1 min-w-0">
              <span className="praxis-label text-[var(--accent)]">Link</span>
              <input value={draft.referenceUrl} onChange={(event) => setDraft((current) => ({ ...current, referenceUrl: event.target.value }))} placeholder="https://..." className={fieldClassName} />
            </label>
            <label className="block space-y-1 min-w-0">
              <span className="praxis-label text-[var(--accent)]">
                Tomadas × dose
              </span>
              {/* Opção 2 + frequência. Layout (5 sub-células):
                  [tomadas] / [freq] × [dose] [unit]
                  Frequência cobre itens não-diários (IPVA mensal,
                  alergia 2×/semana, etc.). saveItem normaliza tudo
                  pra dailyDose interno (× 1, ÷ 7 ou ÷ 30). */}
              {/* Sub-grid de 5 células. Tomadas/freq/×/dose/unit.
                  Frequência em 5.5rem. O dose number era minmax(0,1fr)
                  e inflava demais quando o outer column tinha muita
                  folga (user reportou "200" gigante). Capei em
                  minmax(0,6rem) pra ficar mais ou menos do tamanho dos
                  outros inputs numéricos do form. */}
              <div className="grid grid-cols-[3rem_5.5rem_auto_minmax(0,6rem)_3.6rem] items-center gap-1">
                <input
                  value={draft.servingsPerDay}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      servingsPerDay: event.target.value,
                    }))
                  }
                  type="number"
                  min="0.01"
                  step="0.5"
                  placeholder="1"
                  className={fieldClassName}
                  aria-label="Número de tomadas"
                />
                <select
                  value={draft.servingFrequency}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      servingFrequency: event.target.value as typeof current.servingFrequency,
                    }))
                  }
                  className={fieldClassName}
                  aria-label="Frequência"
                >
                  <option value="daily">/dia</option>
                  <option value="weekly">/sem</option>
                  <option value="monthly">/mês</option>
                </select>
                <span className="px-0.5 text-center text-xs text-zinc-500">×</span>
                <input
                  value={draft.servingAmount}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      servingAmount: event.target.value,
                    }))
                  }
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={scope === "supplements" ? "Ex.: 40" : "Ex.: 30"}
                  className={fieldClassName}
                  aria-label="Dose por tomada"
                />
                <select
                  value={draft.dailyDoseUnit}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      dailyDoseUnit: event.target.value,
                    }))
                  }
                  className={fieldClassName}
                  aria-label="Unidade da dose"
                >
                  <option value="g">g</option>
                  <option value="mg">mg</option>
                  <option value="mcg">mcg</option>
                  <option value="ml">ml</option>
                  <option value="serving">por.</option>
                </select>
              </div>
              {(() => {
                // Igual ao saveItem — aceita fracionário, sem Math.round.
                const sv = Math.max(0.01, Number(draft.servingsPerDay) || 1);
                const am = Number(draft.servingAmount) || 0;
                if (am <= 0) return null;
                const perPeriod = sv * am;
                const periodLabel: Record<typeof draft.servingFrequency, string> = {
                  daily: "dia",
                  weekly: "sem",
                  monthly: "mês",
                };
                const period = periodLabel[draft.servingFrequency];
                const unit =
                  draft.dailyDoseUnit === "serving" ? "" : ` ${draft.dailyDoseUnit}`;
                // Mostra também o equivalente mensal pra dar uma noção
                // do consumo total (que é o que vira custo mensal).
                const monthlyMultiplier =
                  draft.servingFrequency === "daily"
                    ? 30
                    : draft.servingFrequency === "weekly"
                      ? 4.345
                      : 1;
                const monthly = perPeriod * monthlyMultiplier;
                return (
                  <p className="text-[10px] leading-4 text-zinc-500">
                    <span className="text-zinc-300">{perPeriod}</span>
                    {unit}/{period}
                    {draft.servingFrequency !== "monthly" ? (
                      <>
                        {" "}· ≈{" "}
                        <span className="text-zinc-300">
                          {Math.round(monthly * 10) / 10}
                        </span>
                        {unit}/mês
                      </>
                    ) : null}
                  </p>
                );
              })()}
            </label>
            {/* Compra (Online/Presencial) ficou na última coluna a
                pedido do user — outros campos mais à esquerda, este
                fica no canto direito. Pra supplements fica trancado
                em Online (sempre online, não tem toggle). Local
                presencial removido. */}
            <label className="block space-y-1 min-w-0">
              <span className="praxis-label text-[var(--accent)]">Compra</span>
              {scope === "market" ? (
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setDraft((current) => ({ ...current, purchaseMode: "online", localStoreName: "" }))}
                    className={cn(
                      "rounded-sm border px-2 py-1.5 text-xs transition",
                      draft.purchaseMode === "online"
                        ? "border-[var(--accent)]/40 bg-[rgba(251,146,60,0.08)] text-zinc-100"
                        : "border-white/10 bg-[#0a0a0b] text-zinc-400",
                    )}
                  >
                    Online
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraft((current) => ({ ...current, purchaseMode: "presential" }))}
                    className={cn(
                      "rounded-sm border px-2 py-1.5 text-xs transition",
                      draft.purchaseMode === "presential"
                        ? "border-[var(--accent)]/40 bg-[rgba(251,146,60,0.08)] text-zinc-100"
                        : "border-white/10 bg-[#0a0a0b] text-zinc-400",
                    )}
                  >
                    Presencial
                  </button>
                </div>
              ) : (
                <div className="rounded-sm border border-white/10 bg-[#0a0a0b] px-3 py-1.5 text-xs text-zinc-400">
                  Online
                </div>
              )}
            </label>
          </div>
        </section>

        {/* SECTION 3 (Compra + Local presencial) removida — Compra
            subiu pro top row, Local presencial foi descontinuado a
            pedido do user. saveItem continua usando draft.localStoreName
            (sempre vazio agora) e draft.purchaseMode (controlado pelos
            buttons que subiram). */}

        {/* SECTION 4 — Ofertas online (edit mode only, online items)
            Buscar button + sources status + result picker. Was on the
            right column ("Oferta de referência"); moved here so the
            whole editing flow lives in one place. Only rendered when
            we have a real item to search against (editingItemId set
            AND the draft / item is online). */}
        {(() => {
          if (!editingItemId) return null;
          const currentItem = storedState.items.find(
            (item) => item.id === editingItemId,
          );
          if (!currentItem || currentItem.purchaseMode !== "online") return null;
          const snapshot = storedState.snapshots[currentItem.id];
          return (
            <section className="space-y-4">
              <div className="praxis-label flex items-center gap-2 border-b border-white/5 pb-2 text-zinc-400">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                Ofertas online
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    // Auto-expand results when the user kicks off a
                    // new search, so they don't have to also click
                    // the chevron to see what came back.
                    setSearchResultsExpanded(true);
                    runSearch(currentItem);
                  }}
                  disabled={searchingItemId === currentItem.id}
                  className="praxis-button inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
                >
                  {searchingItemId === currentItem.id ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Search className="h-3.5 w-3.5" />
                  )}
                  Buscar agora
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSearchResultsExpanded((current) => !current)
                  }
                  aria-expanded={searchResultsExpanded}
                  aria-label={
                    searchResultsExpanded
                      ? "Ocultar resultados de busca"
                      : "Expandir resultados de busca"
                  }
                  className="praxis-button-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
                >
                  {searchResultsExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  {searchResultsExpanded ? "Ocultar" : "Expandir"}
                </button>
              </div>

              {searchResultsExpanded && snapshot?.sources.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {snapshot.sources.map((source) => (
                    <div key={source.id} className="rounded-sm border border-white/10 bg-[#0a0a0b] p-3">
                      <p className="font-medium text-zinc-100">{source.name}</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {source.status === "ok"
                          ? `${source.count} ofertas`
                          : source.status === "blocked"
                            ? "Busca bloqueada"
                            : "Sem resposta"}
                      </p>
                      {source.note ? (
                        <p className="mt-1 text-xs leading-5 text-zinc-500">{source.note}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {searchResultsExpanded ? (
                snapshot?.results.length ? (
                  <div className="grid gap-4">
                    {snapshot.results.map((result) => (
                      <ResultCard
                        key={result.id}
                        result={result}
                        isPreferred={
                          currentItem.preferredResultId === result.id ||
                          (!currentItem.preferredResultId &&
                            snapshot.results[0]?.id === result.id)
                        }
                        onChoose={() => {
                          updateModuleState((current) => ({
                            ...current,
                            items: current.items.map((item) =>
                              item.id === currentItem.id
                                ? {
                                    ...item,
                                    preferredResultId: result.id,
                                    monthlyUnits: getMonthlyUnitsFromDose(
                                      result.quantityLabel || item.quantity,
                                      item.dailyDose,
                                      item.monthlyUnits,
                                    ),
                                    updatedAt: new Date().toISOString(),
                                  }
                                : item,
                            ),
                          }));
                          setFeedback(
                            `Oferta de ${result.sourceName} definida no calculo mensal.`,
                          );
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-sm border border-dashed border-white/10 p-5 text-sm leading-6 text-zinc-500">
                    Rode a busca para comparar preço, frete e precisão entre as lojas.
                  </div>
                )
              ) : null}
            </section>
          );
        })()}

        {/* Submit */}
        <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
          <button type="submit" className="praxis-button inline-flex items-center gap-1.5 px-3 py-1.5 text-sm">
            <Plus className="h-3.5 w-3.5" />
            {editingItemId ? "Salvar" : "Adicionar"}
          </button>
          <button type="button" onClick={resetDraft} className="praxis-button-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-sm">
            <Trash2 className="h-3.5 w-3.5" />
            Cancelar
          </button>
        </div>

        {feedback ? <p className="text-xs leading-5 text-emerald-300">{feedback}</p> : null}
        {searchError ? <p className="text-xs leading-5 text-rose-300">{searchError}</p> : null}
      </form>
    );
  }

  async function runSearch(item: ShoppingTrackedItem) {
    if (item.purchaseMode === "presential") {
      setSearchError("Itens presenciais usam o preco informado manualmente.");
      return;
    }

    setSearchingItemId(item.id);
    setSearchError("");
    setFeedback("");

    try {
      const searchParams = new URLSearchParams({ scope, name: item.name, brand: item.brand, quantity: item.quantity, limit: "18" });
      if (item.dailyDoseAmount && item.dailyDoseAmount > 0) {
        searchParams.set("dailyDoseAmount", String(item.dailyDoseAmount));
      }
      if (item.dailyDoseUnit) {
        searchParams.set("dailyDoseUnit", item.dailyDoseUnit);
      }
      const response = await fetch(`/api/shopping-search?${searchParams.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as ShoppingSearchResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Nao foi possivel buscar ofertas.");

      updateModuleState((current) => ({
        ...current,
        selectedItemId: item.id,
        items: current.items.map((currentItem) =>
          currentItem.id === item.id
            ? {
                ...currentItem,
                preferredResultId: currentItem.preferredResultId ?? payload.results[0]?.id,
                monthlyUnits: getMonthlyUnitsFromDose(payload.results[0]?.quantityLabel || currentItem.quantity, currentItem.dailyDose, currentItem.monthlyUnits),
                updatedAt: new Date().toISOString(),
              }
            : currentItem,
        ),
        snapshots: { ...current.snapshots, [item.id]: { ...payload, searchedAt: new Date().toISOString() } },
      }));

      setFeedback(payload.results.length ? `${payload.results.length} ofertas organizadas para ${item.name}.` : `Nenhuma oferta encontrada para ${item.name}.`);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Nao foi possivel buscar ofertas agora.");
    } finally {
      setSearchingItemId(null);
    }
  }

  function updateItemFinancePlan(
    itemId: string,
    patch: Partial<Pick<ShoppingTrackedItem, "dailyDose" | "monthlyUnits" | "includeInFinance" | "preferredResultId">>,
  ) {
    updateModuleState((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...patch,
              dailyDose: patch.dailyDose !== undefined ? Math.max(0.01, Number(patch.dailyDose) || 1) : item.dailyDose,
              monthlyUnits: patch.monthlyUnits !== undefined ? Math.max(0.01, Number(patch.monthlyUnits) || 1) : item.monthlyUnits,
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    }));
  }

  if (!hydrated) {
    return <div className="min-h-screen bg-[#050505]" />;
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow={introEyebrow}
        title={title}
        description={description}
      />
      {/* Source-name chips (Mercado Livre / Amazon / Shopee / Growth /
          "+N fontes") removed at user's request — they were just static
          labels and added no signal to the page header. */}

      {/* "Indicadores do módulo" is now always expanded — the collapse
          toggle (Ocultar/Expandir resumo) was removed at the user's
          request. Same 4-card grid renders for both scopes. */}
      {scope === "supplements" ? (
        <GlassPanel className="space-y-4">
          <div>
            <p className="praxis-label text-[var(--accent)]">Resumo</p>
            <h2 className="praxis-title text-2xl">Indicadores do módulo</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SheetStat label="Itens" value={String(storedState.items.length)} help={emptyLabel} />
            <SheetStat label="Ativos" value={String(storedState.items.filter((item) => item.includeInFinance).length)} help="Entram no custo mensal" />
            <SheetStat label="Custo mensal" value={formatCurrency(estimatedMonthlyTotal)} help="Soma da lista ativa" accent />
            <SheetStat label="Custo semanal" value={formatCurrency(estimatedWeeklyTotal)} help="Media do mes dividida por 4" />
          </div>
        </GlassPanel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SheetStat label="Itens" value={String(storedState.items.length)} help={emptyLabel} />
          <SheetStat label="Ativos" value={String(storedState.items.filter((item) => item.includeInFinance).length)} help="Entram no custo mensal" />
          <SheetStat label="Custo mensal" value={formatCurrency(estimatedMonthlyTotal)} help="Soma da lista ativa" accent />
          <SheetStat label="Custo semanal" value={formatCurrency(estimatedWeeklyTotal)} help="Media do mes dividida por 4" />
        </div>
      )}

      {/* Single-column layout — user removed the right side entirely
          ("Cadastro rápido" + "Oferta de referência" both consolidated
          into the inline draft form on the left). Table gets all the
          width now. */}
      <div className="space-y-6">
        <div className="space-y-6">
          <GlassPanel className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="praxis-label text-[var(--accent)]">Tabela principal</p>
                <h2 className="praxis-title text-2xl">Itens monitorados</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={openAddForm}
                  className="praxis-button inline-flex items-center gap-2 px-4 py-2 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar item
                </button>
                <span className="praxis-label border border-white/10 px-3 py-2 text-zinc-400">
                  {scope === "supplements" ? "Biblioteca de suplementos" : "Biblioteca de compras"}
                </span>
              </div>
            </div>

            {/* Form do topo: agora SÓ pra "Adicionar novo item". A
                edição inline ficou logo abaixo do item clicado em
                Editar (ver no map abaixo), pra dar a sensação de fluxo
                contínuo em vez de levar o usuário pro topo da página. */}
            {isAddingNew ? (
              <div className="rounded-sm border border-[var(--accent)]/30 bg-[rgba(251,146,60,0.04)] p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="praxis-label text-[var(--accent)]">
                    Novo {scope === "supplements" ? "suplemento" : "item"}
                  </p>
                  <button
                    type="button"
                    onClick={resetDraft}
                    className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-zinc-500 transition hover:text-red-300"
                  >
                    <X className="h-3 w-3" />
                    Fechar
                  </button>
                </div>
                {renderDraftForm()}
              </div>
            ) : null}

            {storedState.items.length ? (
              <>
                <div className="rounded-sm border border-white/10 bg-[#0d0d0f] p-4">
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_240px_240px]">
                    <label className="block space-y-2">
                      <span className="praxis-label text-zinc-500">Buscar item monitorado</span>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        <input
                          value={tableSearch}
                          onChange={(event) => setTableSearch(event.target.value)}
                          placeholder="Nome, marca, categoria ou refeição"
                          className="w-full rounded-sm border border-white/10 bg-[#09090b] py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500"
                        />
                      </div>
                    </label>

                    <label className="block space-y-2">
                      <span className="praxis-label text-zinc-500">Ordenar por</span>
                      <select
                        value={sortOption}
                        onChange={(event) =>
                          setSortOption(event.target.value as ShoppingSortOption)
                        }
                        className={fieldClassName}
                      >
                        <option value="monthly-cost-desc">Maior custo mensal</option>
                        <option value="monthly-cost-asc">Menor custo mensal</option>
                        <option value="base-price-desc">Maior preço base</option>
                        <option value="base-price-asc">Menor preço base</option>
                        <option value="monthly-use-desc">Maior uso mensal</option>
                        <option value="monthly-units-desc">Maior compra mensal</option>
                        <option value="name-asc">Ordem alfabética A-Z</option>
                        <option value="name-desc">Ordem alfabética Z-A</option>
                      </select>
                    </label>

                    <div className="space-y-2">
                      <span className="praxis-label text-zinc-500">Leitura rápida</span>
                      <div className="rounded-sm border border-white/10 bg-[#09090b] px-4 py-3 text-sm text-zinc-300">
                        {monitoredRows.length} de {storedState.items.length} itens visíveis
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      { id: "all", label: "Todos" },
                      { id: "active", label: "Ativos" },
                      { id: "priced", label: "Com preço" },
                      { id: "online", label: "Online" },
                      ...(scope === "market"
                        ? [{ id: "presential", label: "Presencial" }]
                        : []),
                      { id: "inactive", label: "Inativos" },
                    ].map((option) => {
                      const selected = filterOption === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() =>
                            setFilterOption(option.id as ShoppingFilterOption)
                          }
                          className={cn(
                            "rounded-sm border px-3 py-2 text-xs uppercase tracking-[0.18em] transition whitespace-nowrap",
                            selected
                              ? "border-[var(--accent)]/40 bg-[rgba(251,146,60,0.08)] text-[var(--accent)]"
                              : "border-white/10 bg-[#09090b] text-zinc-500",
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

              <div className="overflow-hidden rounded-sm border border-white/10">
                <div className="hidden grid-cols-[minmax(220px,1.8fr)_minmax(90px,0.75fr)_minmax(90px,0.75fr)_minmax(100px,0.8fr)_minmax(100px,0.8fr)_minmax(110px,0.85fr)_minmax(105px,0.65fr)] gap-3 border-b border-white/10 bg-[#0d0d0f] px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-zinc-500 md:grid">
                  <span>{scope === "supplements" ? "Item e uso" : "Item e compra"}</span>
                  <span>Base</span>
                  <span>{dailyLabel}</span>
                  <span>Uso/mes</span>
                  <span>Comprar</span>
                  <span>Custo/mes</span>
                  <span className="text-right">Abrir</span>
                </div>

                {monitoredRows.length ? (
                  monitoredRowsWithSections.map((entry) => {
                    if ("__sectionMarker" in entry) {
                      // Visual separator between presencial and online
                      // groups (market scope only). Reads as a header
                      // band sitting between the rows above and below.
                      const isPresential = entry.mode === "presential";
                      return (
                        <div
                          key={`section-${entry.mode}`}
                          className={cn(
                            "flex items-center justify-between gap-3 border-t bg-[#0d0d0f] px-4 py-3",
                            isPresential
                              ? "border-white/10 first:border-t-0"
                              : "border-t-2 border-[var(--accent)]/30",
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {isPresential ? (
                              <ShoppingBasket className="h-3.5 w-3.5 text-[var(--accent)]" />
                            ) : (
                              <ExternalLink className="h-3.5 w-3.5 text-[var(--accent)]" />
                            )}
                            <span className="praxis-label text-[var(--accent)]">
                              {isPresential
                                ? "Compras presenciais"
                                : "Compras online"}
                            </span>
                          </div>
                          <span className="praxis-label text-zinc-500">
                            {entry.count}{" "}
                            {entry.count === 1 ? "item" : "itens"}
                          </span>
                        </div>
                      );
                    }

                    const {
                      item,
                      pricingOption,
                      estimatedItemMonthly,
                      linkedMealBlocks,
                      linkedMealsLabel,
                    } = entry;
                    const active = item.id === selectedItem?.id;
                    const isExpanded = expandedItemId === item.id;

                    return (
                      <div key={item.id} className="border-t border-white/10 first:border-t-0">
                      <div className={cn("grid gap-3 px-4 py-4 transition md:grid-cols-[minmax(220px,1.8fr)_minmax(90px,0.75fr)_minmax(90px,0.75fr)_minmax(100px,0.8fr)_minmax(100px,0.8fr)_minmax(110px,0.85fr)_minmax(105px,0.65fr)] md:items-center", active ? "bg-[rgba(251,146,60,0.06)]" : "bg-[#09090b]") }>
                        <div className="flex min-w-0 items-start gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              replaceModuleState({
                                ...storedState,
                                selectedItemId: item.id,
                              })
                            }
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-medium text-zinc-100">
                                {item.name}
                              </p>
                              <span
                                className={cn(
                                  "rounded-sm border px-2 py-1 text-[10px] uppercase tracking-[0.18em]",
                                  item.includeInFinance
                                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                                    : "border-white/10 bg-[#111113] text-zinc-500",
                                )}
                              >
                                {item.includeInFinance ? "Ativo" : "Inativo"}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-zinc-500">
                              {[
                                item.brand ||
                                  (item.purchaseMode === "presential"
                                    ? "Compra presencial"
                                    : "Compra online"),
                                item.categoryLabel,
                                scope === "supplements"
                                  ? item.scheduleLabel
                                  : item.localStoreName,
                              ]
                                .filter(Boolean)
                                .join(" • ")}
                            </p>
                          </button>
                          {item.referenceUrl ? (
                            <a
                              href={item.referenceUrl}
                              target="_blank"
                              rel="noreferrer"
                              title={`Abrir link de ${item.name}`}
                              aria-label={`Abrir link de ${item.name}`}
                              className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-white/10 bg-[#111113] text-zinc-400 transition hover:border-[var(--accent)]/40 hover:text-[var(--accent)]"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : null}
                        </div>

                        <div className="text-sm text-zinc-300">{item.quantity || "--"}</div>
                        <div className="text-sm text-zinc-300">{formatUnits(item.dailyDose)}</div>
                        <div className="text-sm text-zinc-300">{formatUnits(getMonthlyConsumption(item.dailyDose))}</div>
                        <div className="text-sm text-zinc-300">{formatUnits(item.monthlyUnits)}</div>
                        <div className="text-sm font-semibold text-zinc-100">{pricingOption ? formatCurrency(estimatedItemMonthly) : "--"}</div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setExpandedItemId((current) => (current === item.id ? null : item.id))}
                            className="praxis-button-ghost inline-flex items-center gap-2 px-3 py-2"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            {isExpanded ? "Fechar" : "Abrir"}
                          </button>
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="border-t border-white/10 bg-[#0d0d0f] px-4 py-4">
                          <div className="grid gap-4 xl:grid-cols-[minmax(220px,1fr)_minmax(240px,1.15fr)]">
                            {/* Editable fields column removed — all editing now happens through the top-of-list Edit form (renderDraftForm). The expanded row keeps only the metrics column + action buttons for quick reference. */}
                            <div className="grid gap-3 sm:grid-cols-2">
                              <MetricCard label="Uso mensal" value={formatUnits(getMonthlyConsumption(item.dailyDose))} />
                              <MetricCard label="Media semanal" value={formatUnits(getWeeklyUnits(item.monthlyUnits))} />
                              <MetricCard label="Compra" value={item.purchaseMode === "presential" ? item.localStoreName || "Presencial" : pricingOption?.sourceName || "Online"} />
                              <MetricCard label="Preco base" value={pricingOption ? formatCurrency(pricingOption.totalPrice) : item.purchaseMode === "presential" ? "Informe o preco" : "Buscar oferta"} highlight />
                            </div>

                            <div className="space-y-3">
                              <button
                                type="button"
                                onClick={() => updateItemFinancePlan(item.id, { includeInFinance: !item.includeInFinance })}
                                className={cn("flex w-full items-center justify-between rounded-sm border px-4 py-3 text-left transition", item.includeInFinance ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100" : "border-zinc-800 bg-black/40 text-zinc-400")}
                              >
                                <div>
                                  <p className="praxis-label text-current">Sincroniza com financas</p>
                                  <p className="mt-2 text-sm leading-6">
                                    {item.includeInFinance
                                      ? pricingOption
                                        ? `Estimativa mensal: ${formatCurrency(estimatedItemMonthly)}`
                                        : item.purchaseMode === "presential"
                                          ? "Ativo, aguardando voce informar o preco local."
                                          : "Ativo, aguardando uma busca para calcular o custo."
                                      : "Desativado no total mensal do orcamento."}
                                  </p>
                                </div>
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-current/20">
                                  <Check className="h-4 w-4" />
                                </span>
                              </button>

                              <div className="flex flex-wrap gap-2">
                                {item.purchaseMode === "online" ? (
                                  <button
                                    type="button"
                                    onClick={() => runSearch(item)}
                                    disabled={searchingItemId === item.id}
                                    className="praxis-button-ghost inline-flex items-center gap-2 px-3 py-2"
                                  >
                                    {searchingItemId === item.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                    Buscar
                                  </button>
                                ) : null}
                                <button type="button" onClick={() => startEditing(item)} className="praxis-button-ghost inline-flex items-center gap-2 px-3 py-2">
                                  <PencilLine className="h-4 w-4" />
                                  Editar
                                </button>
                                <button type="button" onClick={() => removeItem(item.id)} className="praxis-button-ghost inline-flex items-center gap-2 px-3 py-2">
                                  <Trash2 className="h-4 w-4" />
                                  Remover
                                </button>
                                {item.referenceUrl ? (
                                  <a href={item.referenceUrl} target="_blank" rel="noreferrer" className="praxis-button inline-flex items-center gap-2 px-3 py-2">
                                    <ExternalLink className="h-4 w-4" />
                                    Abrir link
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {/* Edição inline — quando o user clica "Editar"
                          neste item, o form aparece logo abaixo do
                          card (não sobe pro topo da página). Mantém
                          o contexto visual de qual item está sendo
                          editado. Usa o mesmo renderDraftForm() do
                          fluxo de novo cadastro. */}
                      {editingItemId === item.id ? (
                        <div className="border-t border-[var(--accent)]/30 bg-[rgba(251,146,60,0.04)] px-4 py-4">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <p className="praxis-label text-[var(--accent)]">
                              Editando · {item.name}
                            </p>
                            <button
                              type="button"
                              onClick={resetDraft}
                              className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-zinc-500 transition hover:text-red-300"
                            >
                              <X className="h-3 w-3" />
                              Fechar
                            </button>
                          </div>
                          {renderDraftForm()}
                        </div>
                      ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="px-4 py-6 text-sm text-zinc-500">
                    Nenhum item encontrado com os filtros atuais.
                  </div>
                )}
              </div>
              </>
            ) : (
              <div className="rounded-sm border border-dashed border-white/10 p-5 text-sm leading-6 text-zinc-500">
                Cadastre o primeiro item para comecar a comparar preco, dose e custo mensal.
              </div>
            )}
          </GlassPanel>

          {annualForecast && storedState.items.length ? (
            <GlassPanel className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="praxis-label text-[var(--accent)]">
                    Simulação anual
                  </p>
                  <h2 className="praxis-title text-2xl">
                    Quanto vou gastar por mês
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Cada barra é o custo real do mês. A frequência sai
                    do campo <span className="text-zinc-300">Comprar por mês</span>:{" "}
                    valores menores que 1 viram intervalos (ex.: 0,5 = a cada
                    2 meses; 0,125 = a cada 8 meses). Use{" "}
                    <span className="text-zinc-300">Próxima compra</span> em
                    cada item pra escolher quando o ciclo começa.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForecastExpanded((current) => !current)}
                  className="praxis-button-ghost inline-flex items-center gap-2 px-4 py-3"
                >
                  {forecastExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {forecastExpanded ? "Ocultar simulação" : "Expandir simulação"}
                </button>
              </div>

              {forecastExpanded ? (
                <>
                  {/* Summary stats */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-sm border border-white/10 bg-[#0d0d0f] px-4 py-3">
                      <p className="praxis-label text-zinc-500">Ano</p>
                      <p className="mt-2 font-headline text-xl font-bold text-[var(--accent)]">
                        {formatCurrency(annualForecast.annualTotal)}
                      </p>
                    </div>
                    <div className="rounded-sm border border-white/10 bg-[#0d0d0f] px-4 py-3">
                      <p className="praxis-label text-zinc-500">Média/mês</p>
                      <p className="mt-2 font-headline text-xl font-bold text-zinc-100">
                        {formatCurrency(annualForecast.averageMonth)}
                      </p>
                    </div>
                    <div className="rounded-sm border border-white/10 bg-[#0d0d0f] px-4 py-3">
                      <p className="praxis-label text-zinc-500">Pico</p>
                      <p className="mt-2 font-headline text-xl font-bold text-rose-300">
                        {formatCurrency(annualForecast.maxMonthTotal)}
                      </p>
                    </div>
                    <div className="rounded-sm border border-white/10 bg-[#0d0d0f] px-4 py-3">
                      <p className="praxis-label text-zinc-500">Mínimo</p>
                      <p className="mt-2 font-headline text-xl font-bold text-emerald-300">
                        {formatCurrency(annualForecast.minMonthTotal)}
                      </p>
                    </div>
                  </div>

                  {/* Bar chart — 12 bars, one per month. Click a bar
                      to see the itemized breakdown below. */}
                  <div className="rounded-sm border border-white/10 bg-[#0d0d0f] p-4">
                    <div className="flex items-end gap-2 h-48">
                      {annualForecast.months.map((m) => {
                        const ratio =
                          annualForecast.maxMonthTotal > 0
                            ? m.total / annualForecast.maxMonthTotal
                            : 0;
                        const heightPct = Math.max(ratio * 100, m.total > 0 ? 4 : 0);
                        const isSelected = forecastDetailMonth === m.monthIdx;
                        const isPeak =
                          m.total === annualForecast.maxMonthTotal &&
                          m.total > 0;
                        return (
                          <button
                            key={m.monthIdx}
                            type="button"
                            onClick={() =>
                              setForecastDetailMonth((current) =>
                                current === m.monthIdx ? null : m.monthIdx,
                              )
                            }
                            className="group flex flex-1 flex-col items-center justify-end h-full"
                            title={`${m.label}: ${formatCurrency(m.total)}`}
                          >
                            <span
                              className={cn(
                                "mb-1 text-[10px] font-semibold",
                                isSelected || isPeak
                                  ? "text-[var(--accent)]"
                                  : "text-zinc-500 group-hover:text-zinc-300",
                              )}
                            >
                              {m.total > 0 ? formatCurrency(m.total) : "—"}
                            </span>
                            <div
                              className={cn(
                                "w-full rounded-sm transition",
                                isSelected
                                  ? "bg-[var(--accent)]"
                                  : isPeak
                                    ? "bg-rose-400/80 group-hover:bg-rose-400"
                                    : "bg-[var(--accent)]/40 group-hover:bg-[var(--accent)]/70",
                              )}
                              style={{ height: `${heightPct}%` }}
                            />
                            <span
                              className={cn(
                                "mt-2 text-[11px] uppercase tracking-widest",
                                isSelected
                                  ? "text-[var(--accent)]"
                                  : "text-zinc-500",
                              )}
                            >
                              {m.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Itemized breakdown for the clicked month */}
                  {forecastDetailMonth != null
                    ? (() => {
                        const detail = annualForecast.months.find(
                          (m) => m.monthIdx === forecastDetailMonth,
                        );
                        if (!detail) return null;
                        return (
                          <div className="rounded-sm border border-[var(--accent)]/30 bg-[rgba(251,146,60,0.06)] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="praxis-label text-[var(--accent)]">
                                {detail.label} — {formatCurrency(detail.total)}
                              </p>
                              <button
                                type="button"
                                onClick={() => setForecastDetailMonth(null)}
                                className="text-xs text-zinc-500 transition hover:text-zinc-300"
                              >
                                fechar
                              </button>
                            </div>
                            {detail.items.length ? (
                              <ul className="mt-3 space-y-1.5 text-sm">
                                {detail.items.map((line) => (
                                  <li
                                    key={line.name}
                                    className="flex items-center justify-between gap-3 border-b border-white/5 pb-1.5 last:border-b-0"
                                  >
                                    <span className="truncate text-zinc-300">
                                      {line.name}
                                    </span>
                                    <span className="font-semibold text-zinc-100">
                                      {formatCurrency(line.cost)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-3 text-sm text-zinc-500">
                                Nenhuma compra prevista nesse mês.
                              </p>
                            )}
                          </div>
                        );
                      })()
                    : null}
                </>
              ) : null}
            </GlassPanel>
          ) : null}

          {/* "Lista de compra · Resumo semanal e mensal" panel removed —
              the Simulação anual cobre essa info de forma mais útil
              (custo real por mês considerando frequência de compra). */}
        </div>
        {/* Entire right column (Cadastro rápido + Oferta de referência)
            removed at user's request. All editing (including the
            online "Buscar ofertas" + result picker) now lives inline
            in renderDraftForm at the top of the items table. */}
        {/* Right-column dead JSX block removed — Cadastro rápido +
            Oferta de referência both lived here. */}
      </div>
    </div>
  );
}

function ResultCard({ result, isPreferred, onChoose }: { result: ShoppingSearchResult; isPreferred?: boolean; onChoose?: () => void; }) {
  const hasDailyCost =
    result.dailyCost !== undefined && result.doseConfidence === "confirmed";
  const showUnconfirmedWarning =
    result.doseConfidence === "unconfirmed" &&
    result.dailyCost === undefined &&
    result.unitStrengthAmount === undefined &&
    result.badges.some((badge) => /não confirmada/i.test(badge));

  // Suppress badges already visible in the headline / warning panels.
  const visibleBadges = result.badges.filter((badge) => {
    if (hasDailyCost) {
      if (/^R\$\s.+\/dia$/.test(badge)) return false;
      if (/^Dura \d+/.test(badge)) return false;
      if (/^\d+(?:\.\d+)?(mg|g|ml|mcg)\/\d+\s*un$/i.test(badge)) return false;
    }
    if (showUnconfirmedWarning && /não confirmada/i.test(badge)) return false;
    return true;
  });

  return (
    <div className="overflow-hidden rounded-sm border border-white/10 bg-[#0a0a0b]">
      {/* Title + metadata */}
      <div className="border-b border-white/5 px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <p className="line-clamp-2 flex-1 text-base font-semibold leading-snug text-zinc-100">
            {result.title}
          </p>
          {isPreferred ? (
            <span className="praxis-label shrink-0 whitespace-nowrap rounded-sm border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-emerald-200">
              Em uso
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
          <span className="font-medium text-zinc-300">{result.sourceName}</span>
          <span className="text-zinc-700">·</span>
          <span>Precisão {Math.round(result.matchScore)}</span>
          {result.quantityLabel ? (
            <>
              <span className="text-zinc-700">·</span>
              <span>{result.quantityLabel}</span>
            </>
          ) : null}
          {result.unitStrengthAmount && result.unitStrengthUnit ? (
            <>
              <span className="text-zinc-700">·</span>
              <span className="font-medium text-[var(--accent)]">
                {result.unitStrengthAmount}
                {result.unitStrengthUnit}/cáp
              </span>
            </>
          ) : null}
        </div>
      </div>

      {/* HEADLINE: substance-anchored cost OR unconfirmed warning */}
      {hasDailyCost ? (
        <div
          className="border-b border-[var(--accent)]/15 px-4 py-4"
          style={{
            background:
              "linear-gradient(180deg, rgba(251,146,60,0.16), rgba(251,146,60,0.04))",
          }}
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="praxis-label text-[var(--accent)]">Custo real / dia</p>
              <p className="mt-1 font-title text-3xl font-bold leading-none text-[var(--accent)]">
                {formatCurrency(result.dailyCost!)}
              </p>
            </div>
            <div className="text-right text-xs text-zinc-300">
              {result.unitsPerDay ? (
                <p className="font-semibold text-zinc-100">
                  {result.unitsPerDay}{" "}
                  {result.unitsPerDay === 1 ? "cáp" : "cáps"}/dia
                </p>
              ) : null}
              {result.daysSupply ? (
                <p className="mt-0.5 text-zinc-500">
                  Dura {result.daysSupply}{" "}
                  {result.daysSupply === 1 ? "dia" : "dias"}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : showUnconfirmedWarning ? (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-200">
          ⚠ Dose por cápsula não confirmada no título. Verifique a embalagem —
          esse é o ponto onde &quot;1000&nbsp;mg&quot; pode na verdade vir em 2
          ou 4 cápsulas.
        </div>
      ) : null}

      {/* Price breakdown — secondary row */}
      <div className="grid grid-cols-3 divide-x divide-white/5 border-b border-white/5 text-center">
        <div className="px-3 py-2.5">
          <p className="praxis-label text-zinc-500">Preço</p>
          <p className="mt-1 text-sm font-semibold text-zinc-100">
            {formatCurrency(result.price)}
          </p>
        </div>
        <div className="px-3 py-2.5">
          <p className="praxis-label text-zinc-500">Frete</p>
          <p className="mt-1 text-sm font-semibold text-zinc-100">
            {result.freeShipping
              ? "Grátis"
              : result.shippingPrice !== undefined
                ? formatCurrency(result.shippingPrice)
                : "—"}
          </p>
        </div>
        <div className="px-3 py-2.5">
          <p className="praxis-label text-zinc-500">Total</p>
          <p
            className={cn(
              "mt-1 text-sm font-semibold",
              hasDailyCost ? "text-zinc-100" : "text-[var(--accent)]",
            )}
          >
            {formatCurrency(result.totalPrice)}
          </p>
        </div>
      </div>

      {/* Badges (compact, after the data) */}
      {visibleBadges.length ? (
        <div className="flex flex-wrap gap-1.5 border-b border-white/5 px-4 py-2.5">
          {visibleBadges.slice(0, 4).map((badge) => (
            <span
              key={badge}
              className="praxis-label whitespace-nowrap rounded-sm border border-[var(--accent)]/20 bg-[rgba(251,146,60,0.08)] px-2 py-1 text-[10px] text-[var(--accent)]"
            >
              {badge}
            </span>
          ))}
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:flex-wrap">
        {onChoose ? (
          <button
            type="button"
            onClick={onChoose}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-sm border px-4 py-2.5 text-sm font-medium transition sm:w-auto whitespace-nowrap",
              isPreferred
                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                : "border-[var(--accent)]/20 bg-[rgba(251,146,60,0.08)] text-[var(--accent)]",
            )}
          >
            <Check className="h-4 w-4" />
            {isPreferred ? "Oferta selecionada" : "Usar no cálculo mensal"}
          </button>
        ) : null}
        <a
          href={result.url}
          target="_blank"
          rel="noreferrer"
          className="praxis-button inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 sm:w-auto whitespace-nowrap"
        >
          <ExternalLink className="h-4 w-4" />
          Abrir oferta
        </a>
      </div>
    </div>
  );
}

function MetricCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean; }) {
  return (
    <div className={cn("rounded-sm border p-3", highlight ? "border-[var(--accent)]/30 bg-[rgba(251,146,60,0.08)]" : "border-white/10 bg-[#111113]") }>
      <p className="praxis-label text-zinc-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function SheetStat({ label, value, help, accent = false }: { label: string; value: string; help: string; accent?: boolean; }) {
  return (
    <GlassPanel className="space-y-1.5">
      <p className="praxis-label text-[var(--accent)]">{label}</p>
      <p className={cn("font-title text-3xl font-bold text-zinc-100", accent && "text-[var(--accent)]")}>{value}</p>
      <p className="text-xs leading-5 text-zinc-500">{help}</p>
    </GlassPanel>
  );
}

