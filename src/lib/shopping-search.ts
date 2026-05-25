export type ShoppingModuleScope = "market" | "supplements";

export type ShoppingPurchaseMode = "online" | "presential";

export type ShoppingSearchSourceStatus = "idle" | "ok" | "blocked" | "error";

/** Unit of an active-substance daily dose. "serving" is a generic
 *  per-portion unit used by the market scope (e.g. 1 sachê/dia). */
export type DoseUnit = "mg" | "g" | "mcg" | "ml" | "serving";

export type DoseConfidence = "confirmed" | "unconfirmed";

export interface ShoppingTrackedItem {
  id: string;
  name: string;
  brand: string;
  quantity: string;
  mealBlockIds?: string[];
  scheduleLabel?: string;
  categoryLabel?: string;
  /** Legacy "doses por dia" count (kept for back-compat).
   *  New flow uses dailyDoseAmount + dailyDoseUnit for substance-anchored cost. */
  dailyDose: number;
  /** Substance/serving amount the user wants per day (e.g. 1000 of mg). */
  dailyDoseAmount?: number;
  /** Unit of dailyDoseAmount (e.g. "mg"). */
  dailyDoseUnit?: DoseUnit;
  monthlyUnits: number;
  includeInFinance: boolean;
  purchaseMode: ShoppingPurchaseMode;
  localStoreName?: string;
  manualUnitPrice?: number;
  referenceUrl?: string;
  preferredResultId?: string;
  /** Calendar month (1-12) of the NEXT purchase. Lets the user stagger
   *  purchases across the year so January isn't artificially loaded.
   *  Interval between purchases is derived from monthlyUnits:
   *  monthlyUnits=0.5 → every 2 months, 0.125 → every 8 months, etc. */
  nextPurchaseMonth?: number;
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
  /** Active substance per unit (capsule/tablet/serving), normalized.
   *  Only present when the parser extracted it from the title with
   *  confidence (e.g. "60 caps de 500 mg"). */
  unitStrengthAmount?: number;
  /** Unit of unitStrengthAmount, e.g. "mg" or "g". */
  unitStrengthUnit?: DoseUnit;
  /** Total number of units (capsules/comprimidos/sachês) in the package. */
  totalUnits?: number;
  /** When the search input carries a substance daily dose AND the
   *  result has a confirmed unit strength, the engine computes how many
   *  units per day the user actually needs to take. */
  unitsPerDay?: number;
  /** Reais per day at the user's target daily dose. THIS is the real
   *  cost-benefit number — replaces "R$ per capsule" comparisons. */
  dailyCost?: number;
  /** How many days the package lasts at the configured daily dose. */
  daysSupply?: number;
  /** How sure we are about per-unit strength: "confirmed" only when
   *  the title clearly stated both unit count and per-unit strength. */
  doseConfidence: DoseConfidence;
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
