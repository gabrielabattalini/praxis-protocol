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
  const [purchaseSummaryExpanded, setPurchaseSummaryExpanded] = useState(
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
  const visibleSourceNames = sourceNames.slice(0, 4);
  const hiddenSourceCount = Math.max(0, sourceNames.length - visibleSourceNames.length);

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

  const purchaseList = useMemo(
    () => storedState.items
      .map((item) => {
        const pricingOption = getPricingOption(storedState.snapshots[item.id], item);
        if (!pricingOption) return null;
        const weeklyUnits = getWeeklyUnits(item.monthlyUnits);
        return {
          item,
          pricingOption,
          weeklyUnits,
          monthlyConsumption: getMonthlyConsumption(item.dailyDose),
          weeklyTotal: Number((pricingOption.totalPrice * weeklyUnits).toFixed(2)),
          monthlyTotal: Number((pricingOption.totalPrice * item.monthlyUnits).toFixed(2)),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((left, right) => left.item.name.localeCompare(right.item.name)),
    [storedState.items, storedState.snapshots],
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
        actions={
          <div className="flex flex-wrap gap-2">
            {visibleSourceNames.map((source) => (
              <span key={source} className="praxis-label border border-white/10 px-3 py-2 text-zinc-400">
                {source}
              </span>
            ))}
            {hiddenSourceCount ? (
              <span className="praxis-label border border-white/10 px-3 py-2 text-zinc-500">
                +{hiddenSourceCount} fontes
              </span>
            ) : null}
          </div>
        }
      />

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
                        <button
                          type="button"
                          onClick={() => replaceModuleState({ ...storedState, selectedItemId: item.id })}
                          className="min-w-0 text-left"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium text-zinc-100">{item.name}</p>
                            <span className={cn("rounded-sm border px-2 py-1 text-[10px] uppercase tracking-[0.18em]", item.includeInFinance ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-[#111113] text-zinc-500") }>
                              {item.includeInFinance ? "Ativo" : "Inativo"}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-zinc-500">
                            {[
                              item.brand || (item.purchaseMode === "presential" ? "Compra presencial" : "Compra online"),
                              item.categoryLabel,
                              scope === "supplements" ? item.scheduleLabel : item.localStoreName,
                            ].filter(Boolean).join(" • ")}
                          </p>
                        </button>

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

          <GlassPanel className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="praxis-label text-[var(--accent)]">Lista de compra</p>
                <h2 className="praxis-title text-2xl">Resumo semanal e mensal</h2>
              </div>
              <button
                type="button"
                onClick={() => setPurchaseSummaryExpanded((current) => !current)}
                className="praxis-button-ghost inline-flex items-center gap-2 px-4 py-3"
              >
                {purchaseSummaryExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {purchaseSummaryExpanded ? "Ocultar resumo" : "Expandir resumo"}
              </button>
            </div>

            {purchaseSummaryExpanded && purchaseList.length ? (
              <div className="overflow-hidden rounded-sm border border-white/10">
                <div className="grid grid-cols-[minmax(180px,1.8fr)_minmax(90px,0.8fr)_minmax(90px,0.8fr)_minmax(110px,0.9fr)_minmax(110px,0.9fr)] gap-3 border-b border-white/10 bg-[#0d0d0f] px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                  <span>Item</span><span>Uso/mes</span><span>Compra</span><span>Semanal</span><span>Mensal</span>
                </div>
                {purchaseList.map(({ item, pricingOption, monthlyConsumption, weeklyTotal, monthlyTotal }) => (
                  <div key={item.id} className="grid grid-cols-[minmax(180px,1.8fr)_minmax(90px,0.8fr)_minmax(90px,0.8fr)_minmax(110px,0.9fr)_minmax(110px,0.9fr)] gap-3 border-t border-white/10 px-4 py-4 text-sm text-zinc-300 first:border-t-0">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-100">{item.name}</p>
                      <p className="mt-1 truncate text-xs text-zinc-500">
                        {[pricingOption.sourceName, scope === "supplements" ? item.scheduleLabel : item.localStoreName].filter(Boolean).join(" • ")}
                      </p>
                    </div>
                    <span>{formatUnits(monthlyConsumption)}</span>
                    <span>{formatUnits(item.monthlyUnits)}</span>
                    <span>{formatCurrency(weeklyTotal)}</span>
                    <span className="font-semibold text-zinc-100">{formatCurrency(monthlyTotal)}</span>
                  </div>
                ))}
              </div>
            ) : purchaseSummaryExpanded ? (
              <div className="rounded-sm border border-dashed border-white/10 p-5 text-sm leading-6 text-zinc-500">
                Busque e selecione uma oferta para cada item. O resumo de compra aparece aqui.
              </div>
            ) : null}
          </GlassPanel>
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

