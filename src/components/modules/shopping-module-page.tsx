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
  quantity: string;
  dailyDose: string;
  /** Substance-anchored daily dose (e.g. "1000" of "mg"). */
  dailyDoseAmount: string;
  dailyDoseUnit: string;
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

const fieldClassName = "praxis-field w-full px-4 py-3 text-sm";

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

function defaultDraft(): ShoppingItemDraft {
  return {
    name: "",
    brand: "",
    quantity: "",
    dailyDose: "",
    dailyDoseAmount: "",
    dailyDoseUnit: "mg",
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
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [searchingItemId, setSearchingItemId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [searchError, setSearchError] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [sortOption, setSortOption] =
    useState<ShoppingSortOption>("monthly-cost-desc");
  const [filterOption, setFilterOption] =
    useState<ShoppingFilterOption>("all");
  const [summaryCardsExpanded, setSummaryCardsExpanded] = useState(
    () => scope !== "supplements",
  );
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
  }

  function startEditing(item: ShoppingTrackedItem) {
    setEditingItemId(item.id);
    setExpandedItemId(item.id);
    setDraft({
      name: item.name,
      brand: item.brand,
      quantity: item.quantity,
      dailyDose: item.dailyDose.toString(),
      dailyDoseAmount:
        item.dailyDoseAmount !== undefined ? String(item.dailyDoseAmount) : "",
      dailyDoseUnit: item.dailyDoseUnit ?? "mg",
      mealBlockIds: item.mealBlockIds ?? [],
      scheduleLabel: item.scheduleLabel ?? "",
      categoryLabel: item.categoryLabel ?? "",
      referenceUrl: item.referenceUrl ?? "",
      purchaseMode: item.purchaseMode,
      localStoreName: item.localStoreName ?? "",
      manualUnitPrice: item.manualUnitPrice !== undefined ? item.manualUnitPrice.toString() : "",
    });
    setSearchError("");
    setFeedback("");
  }

  function saveItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.name.trim();
    const dailyDose = Math.max(0.01, Number(draft.dailyDose) || 0);
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
      dailyDoseAmount: (() => {
        const parsed = Number(String(draft.dailyDoseAmount).replace(",", "."));
        return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
      })(),
      dailyDoseUnit: (() => {
        const valid = ["mg", "g", "mcg", "ml", "serving"];
        return valid.includes(draft.dailyDoseUnit)
          ? (draft.dailyDoseUnit as ShoppingTrackedItem["dailyDoseUnit"])
          : undefined;
      })(),
      monthlyUnits: getMonthlyUnitsFromDose(draft.quantity.trim(), dailyDose, currentEditingItem?.monthlyUnits ?? 1),
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

      {scope === "supplements" ? (
        <GlassPanel className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="praxis-label text-[var(--accent)]">Resumo</p>
              <h2 className="praxis-title text-2xl">Indicadores do módulo</h2>
            </div>
            <button
              type="button"
              onClick={() => setSummaryCardsExpanded((current) => !current)}
              className="praxis-button-ghost inline-flex items-center gap-2 px-4 py-3"
            >
              {summaryCardsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {summaryCardsExpanded ? "Ocultar resumo" : "Expandir resumo"}
            </button>
          </div>
          {summaryCardsExpanded ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SheetStat label="Itens" value={String(storedState.items.length)} help={emptyLabel} />
              <SheetStat label="Ativos" value={String(storedState.items.filter((item) => item.includeInFinance).length)} help="Entram no custo mensal" />
              <SheetStat label="Custo mensal" value={formatCurrency(estimatedMonthlyTotal)} help="Soma da lista ativa" accent />
              <SheetStat label="Custo semanal" value={formatCurrency(estimatedWeeklyTotal)} help="Media do mes dividida por 4" />
            </div>
          ) : null}
        </GlassPanel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SheetStat label="Itens" value={String(storedState.items.length)} help={emptyLabel} />
          <SheetStat label="Ativos" value={String(storedState.items.filter((item) => item.includeInFinance).length)} help="Entram no custo mensal" />
          <SheetStat label="Custo mensal" value={formatCurrency(estimatedMonthlyTotal)} help="Soma da lista ativa" accent />
          <SheetStat label="Custo semanal" value={formatCurrency(estimatedWeeklyTotal)} help="Media do mes dividida por 4" />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <GlassPanel className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="praxis-label text-[var(--accent)]">Tabela principal</p>
                <h2 className="praxis-title text-2xl">Itens monitorados</h2>
              </div>
              <span className="praxis-label border border-white/10 px-3 py-2 text-zinc-400">
                {scope === "supplements" ? "Biblioteca de suplementos" : "Biblioteca de compras"}
              </span>
            </div>

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
                          <div className="grid gap-4 xl:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_minmax(240px,1.15fr)]">
                            <div className="space-y-3">
                              {scope === "market" ? (
                                <div className="rounded-sm border border-white/10 bg-[#111113] p-3">
                                  <p className="praxis-label text-zinc-500">Forma de compra</p>
                                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateModuleState((current) => ({
                                          ...current,
                                          items: current.items.map((currentItem) =>
                                            currentItem.id === item.id
                                              ? {
                                                  ...currentItem,
                                                  purchaseMode: "online",
                                                  localStoreName: undefined,
                                                  updatedAt: new Date().toISOString(),
                                                }
                                              : currentItem,
                                          ),
                                        }))
                                      }
                                      className={cn(
                                        "rounded-sm border px-3 py-3 text-left transition",
                                        item.purchaseMode === "online"
                                          ? "border-[var(--accent)]/40 bg-[rgba(251,146,60,0.08)] text-zinc-100"
                                          : "border-white/10 bg-[#0a0a0b] text-zinc-400",
                                      )}
                                    >
                                      <p className="font-medium">Online</p>
                                      <p className="mt-1 text-xs text-zinc-500">Usa busca e comparação de ofertas.</p>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateModuleState((current) => ({
                                          ...current,
                                          items: current.items.map((currentItem) =>
                                            currentItem.id === item.id
                                              ? {
                                                  ...currentItem,
                                                  purchaseMode: "presential",
                                                  updatedAt: new Date().toISOString(),
                                                }
                                              : currentItem,
                                          ),
                                        }))
                                      }
                                      className={cn(
                                        "rounded-sm border px-3 py-3 text-left transition",
                                        item.purchaseMode === "presential"
                                          ? "border-[var(--accent)]/40 bg-[rgba(251,146,60,0.08)] text-zinc-100"
                                          : "border-white/10 bg-[#0a0a0b] text-zinc-400",
                                      )}
                                    >
                                      <p className="font-medium">Presencial</p>
                                      <p className="mt-1 text-xs text-zinc-500">Usa local e preço digitados por você.</p>
                                    </button>
                                  </div>
                                </div>
                              ) : null}

                              <label className="block space-y-2">
                                <span className="praxis-label text-zinc-500">{dailyLabel}</span>
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={item.dailyDose}
                                  onChange={(event) => {
                                    const dailyDose = Math.max(0.01, Number(event.target.value) || 0.01);
                                    updateModuleState((current) => ({
                                      ...current,
                                      items: current.items.map((currentItem) =>
                                        currentItem.id === item.id
                                          ? {
                                              ...currentItem,
                                              dailyDose,
                                              monthlyUnits: getMonthlyUnitsFromDose(((current.snapshots[currentItem.id]?.results.find((result) => result.id === currentItem.preferredResultId)) ?? current.snapshots[currentItem.id]?.results[0])?.quantityLabel || currentItem.quantity, dailyDose, currentItem.monthlyUnits),
                                              updatedAt: new Date().toISOString(),
                                            }
                                          : currentItem,
                                      ),
                                    }));
                                  }}
                                  className={fieldClassName}
                                />
                              </label>

                              <label className="block space-y-2">
                                <span className="praxis-label text-zinc-500">Preço manual</span>
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={item.manualUnitPrice ?? ""}
                                  onChange={(event) => {
                                    const rawValue = event.target.value;
                                    updateModuleState((current) => ({
                                      ...current,
                                      items: current.items.map((currentItem) =>
                                        currentItem.id === item.id
                                          ? {
                                              ...currentItem,
                                              manualUnitPrice:
                                                rawValue.trim() === ""
                                                  ? undefined
                                                  : Math.max(0, Number(rawValue) || 0),
                                              updatedAt: new Date().toISOString(),
                                            }
                                          : currentItem,
                                      ),
                                    }));
                                  }}
                                  placeholder="Ex.: 39.90"
                                  className={fieldClassName}
                                />
                                <p className="text-xs leading-5 text-zinc-500">
                                  No online, serve como preço base manual. No presencial, vira o preço principal do item.
                                </p>
                              </label>

                              {scope === "market" && item.purchaseMode === "presential" ? (
                                <label className="block space-y-2">
                                  <span className="praxis-label text-zinc-500">Local presencial</span>
                                  <input
                                    value={item.localStoreName ?? ""}
                                    onChange={(event) =>
                                      updateModuleState((current) => ({
                                        ...current,
                                        items: current.items.map((currentItem) =>
                                          currentItem.id === item.id
                                            ? {
                                                ...currentItem,
                                                localStoreName: event.target.value.trim() || undefined,
                                                updatedAt: new Date().toISOString(),
                                              }
                                            : currentItem,
                                        ),
                                      }))
                                    }
                                    placeholder="Ex.: açougue do bairro"
                                    className={fieldClassName}
                                  />
                                </label>
                              ) : null}

                              {item.purchaseMode === "online" ? (
                                <label className="block space-y-2">
                                  <span className="praxis-label text-zinc-500">
                                    Link de compra
                                  </span>
                                  <input
                                    type="url"
                                    inputMode="url"
                                    value={item.referenceUrl ?? ""}
                                    onChange={(event) =>
                                      updateModuleState((current) => ({
                                        ...current,
                                        items: current.items.map((currentItem) =>
                                          currentItem.id === item.id
                                            ? {
                                                ...currentItem,
                                                referenceUrl:
                                                  event.target.value.trim() ||
                                                  undefined,
                                                updatedAt:
                                                  new Date().toISOString(),
                                              }
                                            : currentItem,
                                        ),
                                      }))
                                    }
                                    placeholder="https://..."
                                    className={fieldClassName}
                                  />
                                </label>
                              ) : null}

                              <label className="block space-y-2">
                                <span className="praxis-label text-zinc-500">Comprar por mes</span>
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={item.monthlyUnits}
                                  onChange={(event) => updateItemFinancePlan(item.id, { monthlyUnits: Number(event.target.value) || 1 })}
                                  className={fieldClassName}
                                />
                              </label>

                              {/* Stagger control for the annual forecast.
                                  Available for both market and supplements
                                  scopes. The interval between purchases is
                                  derived from monthlyUnits (e.g. 0.5 = every
                                  2 months, 0.125 = every 8 months) — see
                                  the "Simulação anual" panel.
                                  nextPurchaseMonth controls WHERE in the
                                  year the cycle anchors, so items don't
                                  all spike in the same month. */}
                              <label className="block space-y-2">
                                <span className="praxis-label text-zinc-500">
                                  Próxima compra (mês)
                                </span>
                                <select
                                  value={
                                    item.nextPurchaseMonth ??
                                    new Date().getMonth() + 1
                                  }
                                  onChange={(event) => {
                                    const next = Number(event.target.value);
                                    updateModuleState((current) => ({
                                      ...current,
                                      items: current.items.map(
                                        (currentItem) =>
                                          currentItem.id === item.id
                                            ? {
                                                ...currentItem,
                                                nextPurchaseMonth:
                                                  Number.isFinite(next) &&
                                                  next >= 1 &&
                                                  next <= 12
                                                    ? next
                                                    : undefined,
                                                updatedAt:
                                                  new Date().toISOString(),
                                              }
                                            : currentItem,
                                      ),
                                    }));
                                  }}
                                  className={fieldClassName}
                                >
                                  {[
                                    "Janeiro",
                                    "Fevereiro",
                                    "Março",
                                    "Abril",
                                    "Maio",
                                    "Junho",
                                    "Julho",
                                    "Agosto",
                                    "Setembro",
                                    "Outubro",
                                    "Novembro",
                                    "Dezembro",
                                  ].map((label, idx) => (
                                    <option key={label} value={idx + 1}>
                                      {label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>

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
        <div className="space-y-6">
          <GlassPanel className="space-y-5">
            <div className="flex items-center gap-3">
              <ShoppingBasket className="h-6 w-6 text-[var(--accent)]" />
              <div>
                <p className="praxis-label text-[var(--accent)]">Cadastro rapido</p>
                <h2 className="praxis-title text-2xl">Adicionar ou editar item</h2>
              </div>
            </div>

            <form className="space-y-7" onSubmit={saveItem}>
              {/* SECTION 1 — Identidade do produto */}
              <section className="space-y-4">
                <div className="praxis-label flex items-center gap-2 border-b border-white/5 pb-2 text-zinc-400">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                  Identidade do produto
                </div>
                <label className="block space-y-2">
                  <span className="praxis-label text-[var(--accent)]">Nome do produto</span>
                  <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder={examples[0] ?? "Ex.: detergente"} className={fieldClassName} />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="praxis-label text-[var(--accent)]">Marca</span>
                    <input value={draft.brand} onChange={(event) => setDraft((current) => ({ ...current, brand: event.target.value }))} placeholder={examples[1] ?? "Ex.: Growth"} className={fieldClassName} />
                  </label>
                  <label className="block space-y-2">
                    <span className="praxis-label text-[var(--accent)]">Quantidade</span>
                    <input value={draft.quantity} onChange={(event) => setDraft((current) => ({ ...current, quantity: event.target.value }))} placeholder={examples[2] ?? "Ex.: 900 g"} className={fieldClassName} />
                  </label>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="praxis-label text-[var(--accent)]">Categoria</span>
                    <input value={draft.categoryLabel} onChange={(event) => setDraft((current) => ({ ...current, categoryLabel: event.target.value }))} placeholder={scope === "supplements" ? "Ex.: massa muscular, sono, saúde" : "Ex.: carnes, higiene, limpeza"} className={fieldClassName} />
                  </label>
                  <label className="block space-y-2">
                    <span className="praxis-label text-[var(--accent)]">Link de referência</span>
                    <input value={draft.referenceUrl} onChange={(event) => setDraft((current) => ({ ...current, referenceUrl: event.target.value }))} placeholder="https://..." className={fieldClassName} />
                  </label>
                </div>
              </section>

              {/* SECTION 2 — Dose & rotina */}
              <section className="space-y-4">
                <div className="praxis-label flex items-center gap-2 border-b border-white/5 pb-2 text-zinc-400">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                  Dose &amp; rotina
                </div>
                {scope === "supplements" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="praxis-label text-[var(--accent)]">{dailyLabel}</span>
                      <input value={draft.dailyDose} onChange={(event) => setDraft((current) => ({ ...current, dailyDose: event.target.value }))} type="number" min="0.01" step="0.01" placeholder="Ex.: 2 (cáps/dia)" className={fieldClassName} />
                      <p className="text-xs leading-5 text-zinc-500">{dailyHint}</p>
                    </label>
                    <label className="block space-y-2">
                      <span className="praxis-label text-[var(--accent)]">Hora de usar</span>
                      <input value={draft.scheduleLabel} onChange={(event) => setDraft((current) => ({ ...current, scheduleLabel: event.target.value }))} placeholder="Ex.: Café da manhã" className={fieldClassName} />
                    </label>
                  </div>
                ) : (
                  <label className="block space-y-2">
                    <span className="praxis-label text-[var(--accent)]">{dailyLabel}</span>
                    <input value={draft.dailyDose} onChange={(event) => setDraft((current) => ({ ...current, dailyDose: event.target.value }))} type="number" min="0.01" step="0.01" placeholder="Use a mesma unidade da quantidade. Ex.: 30" className={fieldClassName} />
                    <p className="text-xs leading-5 text-zinc-500">{dailyHint}</p>
                  </label>
                )}
                {/* "Dose alvo do dia (substância)" — supplements only.
                    User asked to drop it from the market scope: groceries
                    don't have a per-capsule substance to anchor a cost-
                    per-day calculation. */}
                {scope === "supplements" ? (
                  <label className="block space-y-2">
                    <span className="praxis-label text-[var(--accent)]">Dose alvo do dia (substância)</span>
                    <div className="flex gap-2">
                      <input
                        value={draft.dailyDoseAmount}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            dailyDoseAmount: event.target.value,
                          }))
                        }
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Ex.: 1000"
                        className={`${fieldClassName} flex-1`}
                      />
                      <select
                        value={draft.dailyDoseUnit}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            dailyDoseUnit: event.target.value,
                          }))
                        }
                        className={`${fieldClassName} w-28`}
                      >
                        <option value="mg">mg</option>
                        <option value="g">g</option>
                        <option value="mcg">mcg</option>
                        <option value="ml">ml</option>
                        <option value="serving">por porção</option>
                      </select>
                    </div>
                    <p className="text-xs leading-5 text-zinc-500">
                      Ex.: <span className="text-zinc-300">1000&nbsp;mg de Vitamina&nbsp;C</span> por dia. Com isso o sistema lê a dose por cápsula direto do título do produto e calcula o <span className="text-[var(--accent)]">custo real por dia</span> — não cai mais na pegadinha de &quot;1000&nbsp;mg em 4&nbsp;cápsulas&quot;.
                    </p>
                  </label>
                ) : null}
              </section>

              {/* SECTION 3 — Compra (market only) */}
              {scope === "market" ? (
                <section className="space-y-4">
                  <div className="praxis-label flex items-center gap-2 border-b border-white/5 pb-2 text-zinc-400">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                    Compra
                  </div>
                  <div className="space-y-3">
                    <span className="praxis-label text-[var(--accent)]">Local da compra</span>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setDraft((current) => ({ ...current, purchaseMode: "online", localStoreName: "", manualUnitPrice: "" }))}
                        className={cn("rounded-sm border px-4 py-3 text-left transition", draft.purchaseMode === "online" ? "border-[var(--accent)]/40 bg-[rgba(251,146,60,0.08)] text-zinc-100" : "border-white/10 bg-[#0a0a0b] text-zinc-400")}
                      >
                        <p className="font-medium">Online</p>
                        <p className="mt-1 text-sm text-zinc-500">Busca ofertas e compara o custo nas lojas.</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraft((current) => ({ ...current, purchaseMode: "presential" }))}
                        className={cn("rounded-sm border px-4 py-3 text-left transition", draft.purchaseMode === "presential" ? "border-[var(--accent)]/40 bg-[rgba(251,146,60,0.08)] text-zinc-100" : "border-white/10 bg-[#0a0a0b] text-zinc-400")}
                      >
                        <p className="font-medium">Presencial</p>
                        <p className="mt-1 text-sm text-zinc-500">Informe o local e o preço que você encontrou pessoalmente.</p>
                      </button>
                    </div>
                  </div>
                  {draft.purchaseMode === "presential" ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block space-y-2">
                        <span className="praxis-label text-[var(--accent)]">Local presencial</span>
                        <input value={draft.localStoreName} onChange={(event) => setDraft((current) => ({ ...current, localStoreName: event.target.value }))} placeholder="Ex.: Açougue do bairro" className={fieldClassName} />
                      </label>
                      <label className="block space-y-2">
                        <span className="praxis-label text-[var(--accent)]">Preço encontrado</span>
                        <input value={draft.manualUnitPrice} onChange={(event) => setDraft((current) => ({ ...current, manualUnitPrice: event.target.value }))} type="number" min="0.01" step="0.01" placeholder="Ex.: 39.90" className={fieldClassName} />
                      </label>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {/* SECTION 4 — Refeições vinculadas removida a pedido do
                  usuário (não queria mais cruzar item de mercado com
                  refeição da dieta). mealBlockIds continua no schema
                  pra retrocompatibilidade — vazio por padrão a partir
                  daqui. */}

              {/* Submit */}
              <div className="flex flex-wrap gap-3 border-t border-white/10 pt-4">
                <button type="submit" className="praxis-button inline-flex items-center gap-2 px-4 py-3">
                  <Plus className="h-4 w-4" />
                  {editingItemId ? "Salvar item" : "Adicionar item"}
                </button>
                {editingItemId ? (
                  <button type="button" onClick={resetDraft} className="praxis-button-ghost inline-flex items-center gap-2 px-4 py-3">
                    <Trash2 className="h-4 w-4" />
                    Cancelar edição
                  </button>
                ) : null}
              </div>
            </form>

            {feedback ? <p className="text-sm leading-6 text-emerald-300">{feedback}</p> : null}
            {searchError ? <p className="text-sm leading-6 text-rose-300">{searchError}</p> : null}
          </GlassPanel>

          <GlassPanel className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="praxis-label text-[var(--accent)]">Oferta de referencia</p>
                <h2 className="praxis-title text-2xl">{selectedItem ? buildShoppingQueryLabel(selectedItem) : "Selecione um item"}</h2>
              </div>
              {selectedItem?.purchaseMode === "online" ? (
                <button type="button" onClick={() => runSearch(selectedItem)} disabled={searchingItemId === selectedItem.id} className="praxis-button inline-flex items-center gap-2 px-4 py-3">
                  {searchingItemId === selectedItem.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Buscar agora
                </button>
              ) : null}
            </div>

            {selectedItem?.purchaseMode === "online" && selectedSnapshot?.sources.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {selectedSnapshot.sources.map((source) => (
                  <div key={source.id} className="rounded-sm border border-white/10 bg-[#0a0a0b] p-3">
                    <p className="font-medium text-zinc-100">{source.name}</p>
                    <p className="mt-1 text-sm text-zinc-500">{source.status === "ok" ? `${source.count} ofertas` : source.status === "blocked" ? "Busca bloqueada" : "Sem resposta"}</p>
                    {source.note ? <p className="mt-1 text-xs leading-5 text-zinc-500">{source.note}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}

            {selectedItem?.purchaseMode === "presential" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <MetricCard label="Local da compra" value={selectedItem.localStoreName || "Compra presencial"} />
                <MetricCard label="Preco informado" value={selectedItem.manualUnitPrice ? formatCurrency(selectedItem.manualUnitPrice) : "--"} highlight />
                <MetricCard label="Quantidade base" value={selectedItem.quantity || "--"} />
                <MetricCard label={bestOffer?.comparablePriceLabel ? `Preco / ${bestOffer.comparablePriceLabel}` : "Preco proporcional"} value={bestOffer?.comparablePrice ? formatCurrency(bestOffer.comparablePrice) : "--"} />
              </div>
            ) : selectedSnapshot?.results.length ? (
              <div className="grid gap-4">
                {selectedSnapshot.results.map((result) => (
                  <ResultCard
                    key={result.id}
                    result={result}
                    isPreferred={selectedItem?.preferredResultId === result.id || (!selectedItem?.preferredResultId && selectedSnapshot.results[0]?.id === result.id)}
                    onChoose={() => {
                      if (!selectedItem) return;
                      updateModuleState((current) => ({
                        ...current,
                        items: current.items.map((item) =>
                          item.id === selectedItem.id
                            ? {
                                ...item,
                                preferredResultId: result.id,
                                monthlyUnits: getMonthlyUnitsFromDose(result.quantityLabel || item.quantity, item.dailyDose, item.monthlyUnits),
                                updatedAt: new Date().toISOString(),
                              }
                            : item,
                        ),
                      }));
                      setFeedback(`Oferta de ${result.sourceName} definida no calculo mensal.`);
                    }}
                  />
                ))}
              </div>
            ) : selectedItem ? (
              <div className="rounded-sm border border-dashed border-white/10 p-5 text-sm leading-6 text-zinc-500">Rode a busca para comparar preco, frete e precisao entre as lojas do item selecionado.</div>
            ) : (
              <div className="rounded-sm border border-dashed border-white/10 p-5 text-sm leading-6 text-zinc-500">Selecione uma linha da tabela para ver a oferta usada no calculo.</div>
            )}
          </GlassPanel>
        </div>
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

