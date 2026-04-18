export type ShoppingModuleScope = "market" | "supplements";

export type ShoppingPurchaseMode = "online" | "presential";

export type ShoppingSearchSourceStatus = "idle" | "ok" | "blocked" | "error";

export interface ShoppingTrackedItem {
  id: string;
  name: string;
  brand: string;
  quantity: string;
  mealBlockIds?: string[];
  scheduleLabel?: string;
  categoryLabel?: string;
  dailyDose: number;
  monthlyUnits: number;
  includeInFinance: boolean;
  purchaseMode: ShoppingPurchaseMode;
  localStoreName?: string;
  manualUnitPrice?: number;
  referenceUrl?: string;
  preferredResultId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShoppingSearchSourceState {
  id: string;
  name: string;
  status: ShoppingSearchSourceStatus;
  count: number;
  note?: string;
}

export interface ShoppingSearchResult {
  id: string;
  scope: ShoppingModuleScope;
  sourceId: string;
  sourceName: string;
  title: string;
  url: string;
  thumbnail?: string;
  price: number;
  shippingPrice?: number;
  totalPrice: number;
  shippingDays?: number;
  freeShipping: boolean;
  available: boolean;
  matchScore: number;
  matchedBrand: boolean;
  matchedQuantity: boolean;
  matchedTokens: number;
  quantityLabel?: string;
  comparablePriceLabel?: string;
  comparablePrice?: number;
  badges: string[];
}

export interface ShoppingSearchResponse {
  scope: ShoppingModuleScope;
  queryLabel: string;
  results: ShoppingSearchResult[];
  sources: ShoppingSearchSourceState[];
}

export interface ShoppingSearchSnapshot extends ShoppingSearchResponse {
  searchedAt: string;
}

export interface ShoppingModuleStoredState {
  items: ShoppingTrackedItem[];
  selectedItemId?: string;
  snapshots: Record<string, ShoppingSearchSnapshot>;
  removedSeedItemIds?: string[];
  removedSeedNames?: string[];
}

export function buildShoppingQueryLabel(input: {
  name: string;
  brand?: string;
  quantity?: string;
}) {
  return [input.name.trim(), input.brand?.trim(), input.quantity?.trim()]
    .filter(Boolean)
    .join(" | ");
}
