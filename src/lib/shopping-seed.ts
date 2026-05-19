import rawSeedRows from "@/lib/shopping-seed.raw.json";
import type {
  ShoppingModuleScope,
  ShoppingModuleStoredState,
  ShoppingSearchResult,
  ShoppingSearchSnapshot,
  ShoppingSearchSourceState,
  ShoppingTrackedItem,
} from "@/lib/shopping-search";

type ShoppingSeedRow = {
  scope: ShoppingModuleScope;
  row: number;
  link: string | null;
  schedule: string | null;
  category: string | null;
  active: boolean;
  name: string;
  unitPrice: string | null;
  quantity: string | null;
  monthlyNeed: string | null;
  monthlyUnits: string | null;
  monthlyPrice: string | null;
};

type ShoppingSeedLinkReview = {
  status: "ok" | "suspeito" | "falho";
  reason: string;
  allowSeedResult?: boolean;
  allowReferenceUrl?: boolean;
};

type ShoppingSeedOverride = {
  name?: string;
  brand?: string;
  quantity?: string;
  purchaseMode?: ShoppingTrackedItem["purchaseMode"];
  localStoreName?: string;
};

const seedRows = rawSeedRows as ShoppingSeedRow[];

const linkReviewByRow: Partial<
  Record<string, ShoppingSeedLinkReview>
> = {
  "market:2": {
    status: "falho",
    reason: "Link da planilha aponta para patinho, nao para acem moido.",
    allowReferenceUrl: false,
  },
  "market:6": { status: "falho", reason: "Item sem link." },
  "market:7": { status: "falho", reason: "Item sem link." },
  "market:11": { status: "suspeito", reason: "Titulo principal nao identificado." },
  "market:12": { status: "suspeito", reason: "Titulo principal nao identificado." },
  "market:13": { status: "suspeito", reason: "Titulo principal nao identificado." },
  "market:14": {
    status: "falho",
    reason: "Slug da oferta aponta para OMO Clinical 4kg, nao para Perfect White.",
    allowReferenceUrl: false,
  },
  "market:15": { status: "suspeito", reason: "Titulo principal nao identificado." },
  "market:16": { status: "suspeito", reason: "Titulo principal nao identificado." },
  "market:20": { status: "suspeito", reason: "Titulo principal nao identificado." },
  "supplements:30": {
    status: "suspeito",
    reason: "Link direto responde com challenge anti-bot.",
    allowSeedResult: false,
  },
  "supplements:36": {
    status: "suspeito",
    reason: "Link direto responde com challenge anti-bot.",
    allowSeedResult: false,
  },
  "supplements:37": {
    status: "suspeito",
    reason: "Link direto responde com challenge anti-bot.",
    allowSeedResult: false,
  },
  "supplements:38": {
    status: "suspeito",
    reason: "Link direto responde com challenge anti-bot.",
    allowSeedResult: false,
  },
  "supplements:39": {
    status: "suspeito",
    reason: "Link direto responde com challenge anti-bot.",
    allowSeedResult: false,
  },
  "supplements:40": {
    status: "suspeito",
    reason: "Link direto responde com challenge anti-bot.",
    allowSeedResult: false,
  },
  "supplements:41": {
    status: "suspeito",
    reason: "Link direto responde com challenge anti-bot.",
    allowSeedResult: false,
  },
  "supplements:44": {
    status: "suspeito",
    reason: "Link direto responde com challenge anti-bot.",
    allowSeedResult: false,
  },
  "supplements:45": {
    status: "falho",
    reason: "HTTP 403 no link direto.",
    allowSeedResult: false,
  },
  "supplements:50": {
    status: "suspeito",
    reason: "Link direto responde com challenge anti-bot.",
    allowSeedResult: false,
  },
  "supplements:51": {
    status: "suspeito",
    reason: "Link direto responde com challenge anti-bot.",
    allowSeedResult: false,
  },
  "supplements:52": {
    status: "suspeito",
    reason: "Link direto responde com challenge anti-bot.",
    allowSeedResult: false,
  },
  "supplements:55": {
    status: "suspeito",
    reason: "Titulo parece valido, mas a busca esta fraca para o item.",
    allowSeedResult: false,
  },
  "supplements:59": {
    status: "suspeito",
    reason: "Link encontrado nao reflete a dose no nome do item.",
    allowSeedResult: false,
  },
  "supplements:62": { status: "falho", reason: "Item sem link." },
};

const seedOverridesByRow: Partial<Record<string, ShoppingSeedOverride>> = {
  "market:2": {
    quantity: "1 kg",
    purchaseMode: "presential",
    localStoreName: "Compra presencial",
  },
  "supplements:26": { name: "Ioimbina 10mg", quantity: "90 caps" },
  "supplements:30": { quantity: "200 g" },
  "supplements:36": { quantity: "500 g" },
  "supplements:37": { quantity: "250 g" },
  "supplements:38": { name: "Vitamina C 1000mg", quantity: "120 comprimidos" },
  "supplements:39": { quantity: "60 caps" },
  "supplements:40": { quantity: "250 g" },
  "supplements:41": { quantity: "120 caps" },
  "supplements:44": { quantity: "1 kg" },
  "supplements:45": { name: "Hidraplex", quantity: "4 un" },
  "supplements:50": { quantity: "120 caps" },
  "supplements:51": { quantity: "120 comprimidos" },
  "supplements:52": { name: "DHA oleo de peixe", quantity: "60 caps" },
  "supplements:53": { quantity: "60 caps" },
  "supplements:55": { name: "5-HTP 200mg", quantity: "60 caps" },
  "supplements:59": { name: "Glicina", brand: "4Well", quantity: "1 kg" },
  "supplements:62": {
    name: "Vortioxetina 10mg",
    brand: "Voextor",
    quantity: "30 comprimidos",
  },
};

const quantityUnitHints = [
  { pattern: /(\d+(?:[.,]\d+)?)\s*(kg)\b/i, unit: "kg" },
  { pattern: /(\d+(?:[.,]\d+)?)\s*(g|gr)\b/i, unit: "g" },
  { pattern: /(\d+(?:[.,]\d+)?)\s*(mg)\b/i, unit: "mg" },
  { pattern: /(\d+(?:[.,]\d+)?)\s*(ml)\b/i, unit: "ml" },
  { pattern: /(\d+(?:[.,]\d+)?)\s*(l)\b/i, unit: "l" },
  {
    pattern: /(\d+(?:[.,]\d+)?)\s*(capsulas|cápsulas|caps|cap)\b/i,
    unit: "caps",
  },
  {
    pattern: /(\d+(?:[.,]\d+)?)\s*(comprimidos|comprimido)\b/i,
    unit: "comprimidos",
  },
  {
    pattern: /(\d+(?:[.,]\d+)?)\s*(unidades|unidade|un)\b/i,
    unit: "un",
  },
  {
    pattern: /(\d+(?:[.,]\d+)?)\s*(envelopes|envelope)\b/i,
    unit: "un",
  },
];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeQuantityText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1.$2");
}

function getRowKey(row: ShoppingSeedRow) {
  return `${row.scope}:${row.row}`;
}

function getLinkReview(row: ShoppingSeedRow) {
  return linkReviewByRow[getRowKey(row)];
}

function getSeedOverride(row: ShoppingSeedRow) {
  return seedOverridesByRow[getRowKey(row)];
}

function parseDecimal(value: string | null | undefined) {
  const normalized = String(value ?? "")
    .replace(",", ".")
    .trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

function inferSourceFromUrl(url: string | null) {
  if (!url) return "Compra manual";

  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    if (hostname.includes("mercadolivre")) return "Mercado Livre";
    if (hostname.includes("amazon")) return "Amazon";
    if (hostname.includes("shopee")) return "Shopee";
    if (hostname.includes("magazineluiza")) return "Magazine Luiza";
    if (hostname.includes("tendaatacado")) return "Tenda Atacado";
    if (hostname.includes("oficialfarma")) return "Oficial Farma";
    if (hostname.includes("gsuplementos")) return "Growth";
    if (hostname.includes("integralmedica")) return "Integralmédica";
    if (hostname.includes("maxtitanium")) return "Max Titanium";
    return hostname
      .split(".")[0]
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  } catch {
    return "Compra online";
  }
}

function inferQuantityLabel(row: ShoppingSeedRow) {
  const sourceText = normalizeQuantityText(`${row.name} ${row.link ?? ""}`);

  for (const hint of quantityUnitHints) {
    const match = sourceText.match(hint.pattern);
    if (match) {
      return `${formatNumber(parseDecimal(match[1]))} ${hint.unit}`;
    }
  }

  const quantityValue = parseDecimal(row.quantity);
  if (quantityValue <= 0) return "";

  const normalizedName = normalizeText(row.name);

  if (row.scope === "supplements") {
    if (
      /(whey|creatina|psyllium|beta-alanina|beta alanina|dextrose|glicerina|glicina|l-carnitina)/.test(
        normalizedName,
      )
    ) {
      return `${formatNumber(quantityValue)} g`;
    }

    return `${formatNumber(quantityValue)} caps`;
  }

  if (
    /(papel higienico|desodorante|sabonete|creme dental|conjunto shampoo|hidraplex|coca-cola)/.test(
      normalizedName,
    )
  ) {
    return `${formatNumber(quantityValue)} un`;
  }

  if (quantityValue <= 10) {
    return `${formatNumber(quantityValue)} un`;
  }

  return `${formatNumber(quantityValue)} g`;
}

function toComparablePrice(totalPrice: number, quantityLabel: string) {
  const normalized = normalizeText(quantityLabel);
  const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|mg|ml|l|caps|comprimidos|un)/);
  if (!match || totalPrice <= 0) return {};

  const amount = parseDecimal(match[1]);
  const unit = match[2];
  if (!amount) return {};

  if (unit === "kg") {
    return {
      comparablePriceLabel: "100 g",
      comparablePrice: Number(((totalPrice / (amount * 1000)) * 100).toFixed(2)),
    };
  }

  if (unit === "g") {
    return {
      comparablePriceLabel: "100 g",
      comparablePrice: Number(((totalPrice / amount) * 100).toFixed(2)),
    };
  }

  if (unit === "mg") {
    return {
      comparablePriceLabel: "100 g",
      comparablePrice: Number(((totalPrice / (amount / 1000)) * 100).toFixed(2)),
    };
  }

  if (unit === "l") {
    return {
      comparablePriceLabel: "100 ml",
      comparablePrice: Number(((totalPrice / (amount * 1000)) * 100).toFixed(2)),
    };
  }

  if (unit === "ml") {
    return {
      comparablePriceLabel: "100 ml",
      comparablePrice: Number(((totalPrice / amount) * 100).toFixed(2)),
    };
  }

  return {
    comparablePriceLabel: "1 un",
    comparablePrice: Number((totalPrice / amount).toFixed(2)),
  };
}

function inferDailyDose(row: ShoppingSeedRow) {
  const monthlyNeed = parseDecimal(row.monthlyNeed);
  if (monthlyNeed <= 0) return 1;
  return Number((monthlyNeed / 30).toFixed(2));
}

function buildSeedResult(row: ShoppingSeedRow): ShoppingSearchResult | null {
  const linkReview = getLinkReview(row);
  const seedOverride = getSeedOverride(row);
  if (
    !row.link ||
    linkReview?.status === "falho" ||
    linkReview?.allowSeedResult === false
  ) {
    return null;
  }

  const totalPrice = parseDecimal(row.unitPrice);
  const title = seedOverride?.name?.trim() || row.name.trim();
  const quantityLabel = seedOverride?.quantity?.trim() || inferQuantityLabel(row);
  const comparable = toComparablePrice(totalPrice, quantityLabel);
  const sourceName = inferSourceFromUrl(row.link);

  return {
    id: `${row.scope}-seed-result-${row.row}`,
    scope: row.scope,
    sourceId: `seed-${row.row}`,
    sourceName,
    title,
    url: row.link,
    price: totalPrice,
    shippingPrice: 0,
    totalPrice,
    shippingDays: undefined,
    freeShipping: false,
    available: true,
    matchScore: 100,
    matchedBrand: true,
    matchedQuantity: true,
    matchedTokens: title.split(/\s+/).length,
    quantityLabel,
    comparablePriceLabel: comparable.comparablePriceLabel,
    comparablePrice: comparable.comparablePrice,
    doseConfidence: "unconfirmed",
    badges: linkReview?.status === "suspeito" ? ["Planilha", "Validar link"] : ["Planilha"],
  };
}

function buildSeedItem(row: ShoppingSeedRow): ShoppingTrackedItem {
  const dailyDose = inferDailyDose(row);
  const linkReview = getLinkReview(row);
  const seedOverride = getSeedOverride(row);
  const purchaseMode =
    seedOverride?.purchaseMode ??
    (row.scope === "market" && !row.link ? "presential" : "online");
  const unitPrice = parseDecimal(row.unitPrice);
  const quantityLabel = seedOverride?.quantity?.trim() || inferQuantityLabel(row);
  const referenceUrl =
    row.link && linkReview?.allowReferenceUrl !== false ? row.link : undefined;
  const hasSeedResult =
    Boolean(row.link) &&
    linkReview?.status !== "falho" &&
    linkReview?.allowSeedResult !== false;

  return {
    id: `${row.scope}-seed-item-${row.row}`,
    name: seedOverride?.name?.trim() || row.name.trim(),
    brand: seedOverride?.brand?.trim() || "",
    quantity: quantityLabel,
    scheduleLabel: row.schedule?.trim() || undefined,
    categoryLabel: row.category?.trim() || undefined,
    dailyDose,
    monthlyUnits: Math.max(0.01, parseDecimal(row.monthlyUnits) || 1),
    includeInFinance: row.active,
    purchaseMode,
    localStoreName:
      purchaseMode === "presential"
        ? seedOverride?.localStoreName?.trim() || "Compra presencial"
        : undefined,
    manualUnitPrice: unitPrice || undefined,
    referenceUrl,
    preferredResultId: hasSeedResult
      ? `${row.scope}-seed-result-${row.row}`
      : undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildSeedSnapshot(row: ShoppingSeedRow): ShoppingSearchSnapshot | undefined {
  const result = buildSeedResult(row);
  if (!result) return undefined;

  const linkReview = getLinkReview(row);
  const sourceName = inferSourceFromUrl(row.link);
  const sources: ShoppingSearchSourceState[] = [
    {
      id: `seed-${row.row}`,
      name: sourceName,
      status: "ok",
      count: 1,
      note: linkReview?.status === "suspeito"
        ? `Oferta trazida da planilha base. ${linkReview.reason}`
        : "Oferta trazida da planilha base.",
    },
  ];

  return {
    scope: row.scope,
    queryLabel: row.name.trim(),
    results: [result],
    sources,
    searchedAt: new Date().toISOString(),
  };
}

function buildSeedModuleState(scope: ShoppingModuleScope): ShoppingModuleStoredState {
  const scopeRows = seedRows.filter((row) => row.scope === scope);
  const items = scopeRows.map(buildSeedItem);
  const snapshots = scopeRows.reduce<ShoppingModuleStoredState["snapshots"]>(
    (nextSnapshots, row) => {
      const snapshot = buildSeedSnapshot(row);
      if (snapshot) {
        nextSnapshots[`${row.scope}-seed-item-${row.row}`] = snapshot;
      }
      return nextSnapshots;
    },
    {},
  );

  return {
    items,
    selectedItemId: items[0]?.id,
    snapshots,
  };
}

export const shoppingSeedStates: Record<
  ShoppingModuleScope,
  ShoppingModuleStoredState
> = {
  market: buildSeedModuleState("market"),
  supplements: buildSeedModuleState("supplements"),
};

export function getShoppingSeedState(scope: ShoppingModuleScope) {
  const state = shoppingSeedStates[scope];
  return {
    items: state.items.map((item) => ({ ...item })),
    selectedItemId: state.selectedItemId,
    snapshots: Object.fromEntries(
      Object.entries(state.snapshots).map(([itemId, snapshot]) => [
        itemId,
        {
          ...snapshot,
          results: snapshot.results.map((result) => ({ ...result })),
          sources: snapshot.sources.map((source) => ({ ...source })),
        },
      ]),
    ),
  };
}
