import "server-only";

import axios from "axios";
import * as cheerio from "cheerio";
import {
  fetchRenderedHtml,
  isShoppingHostAllowed,
} from "@/lib/shopping-browser-fetch.server";
import { shouldUseBrowserFallback } from "@/lib/shopping-browser-fallback";
import {
  buildShoppingQueryLabel,
  type DoseUnit,
  type ShoppingModuleScope,
  type ShoppingSearchResponse,
  type ShoppingSearchResult,
  type ShoppingSearchSourceState,
} from "@/lib/shopping-search";

type SearchInput = {
  name: string;
  brand?: string;
  quantity?: string;
  /** Substance daily dose the user wants (e.g. 1000 of mg).
   *  When provided, the scorer computes per-day cost and rank by it. */
  dailyDoseAmount?: number;
  dailyDoseUnit?: DoseUnit;
};

/** Per-unit active substance extracted from a product title — the
 *  missing piece that turns "60 caps de 500 mg" into a fair comparison. */
type UnitStrength = {
  totalUnits: number;
  unitAmount: number; // amount of substance per unit
  unitUnit: "mg" | "g" | "ml"; // unit of unitAmount
};

type SearchSourceDefinition = {
  id: string;
  name: string;
  kind: "mercadolivre-api" | "amazon-html" | "shopee-api" | "generic-html";
  baseUrl?: string;
  searchPatterns?: string[];
};

type RawOffer = {
  sourceId: string;
  sourceName: string;
  title: string;
  price: number;
  url: string;
  thumbnail?: string;
  freeShipping?: boolean;
  shippingPrice?: number;
  shippingDays?: number;
  available?: boolean;
};

type ParsedQuantity = {
  canonicalUnit: "g" | "ml" | "unit";
  canonicalValue: number;
  label: string;
};

const HTML_USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 Edg/133.0.0.0",
];

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
};

const stopWords = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "com",
  "para",
  "por",
  "a",
  "o",
  "os",
  "as",
]);

const genericSearchTokens = new Set([
  "kg",
  "g",
  "gr",
  "mg",
  "l",
  "lt",
  "ml",
  "capsulas",
  "capsula",
  "caps",
  "cap",
  "comprimidos",
  "comprimido",
  "tabletes",
  "tablete",
  "unidades",
  "unidade",
  "un",
  "und",
  "saches",
  "sache",
  "doses",
  "dose",
  "po",
  "sem",
]);

const marketSources: SearchSourceDefinition[] = [
  {
    id: "mercadolivre",
    name: "Mercado Livre",
    kind: "mercadolivre-api",
  },
  {
    id: "amazon",
    name: "Amazon",
    kind: "amazon-html",
    baseUrl: "https://www.amazon.com.br",
  },
  {
    id: "shopee",
    name: "Shopee",
    kind: "shopee-api",
    baseUrl: "https://shopee.com.br",
  },
  {
    id: "magalu",
    name: "Magazine Luiza",
    kind: "generic-html",
    baseUrl: "https://www.magazineluiza.com.br",
    searchPatterns: ["/busca/{query}/", "/busca/{query}"],
  },
];

const supplementSources: SearchSourceDefinition[] = [
  {
    id: "mercadolivre",
    name: "Mercado Livre",
    kind: "mercadolivre-api",
  },
  {
    id: "amazon",
    name: "Amazon",
    kind: "amazon-html",
    baseUrl: "https://www.amazon.com.br",
  },
  {
    id: "shopee",
    name: "Shopee",
    kind: "shopee-api",
    baseUrl: "https://shopee.com.br",
  },
  {
    id: "growth",
    name: "Growth",
    kind: "generic-html",
    baseUrl: "https://www.gsuplementos.com.br",
    searchPatterns: ["/busca?q={query}", "/busca/{query}", "/catalogsearch/result/?q={query}"],
  },
  {
    id: "integralmedica",
    name: "Integralmédica",
    kind: "generic-html",
    baseUrl: "https://www.integralmedica.com.br",
    searchPatterns: ["/busca?ft={query}", "/busca?q={query}", "/search?q={query}"],
  },
  {
    id: "maxtitanium",
    name: "Max Titanium",
    kind: "generic-html",
    baseUrl: "https://www.maxtitanium.com.br",
    searchPatterns: ["/busca?ft={query}", "/busca?q={query}", "/search?q={query}"],
  },
  {
    id: "oficialfarma",
    name: "Oficial Farma",
    kind: "generic-html",
    baseUrl: "https://www.oficialfarma.com.br",
    searchPatterns: ["/catalogsearch/result/?q={query}", "/busca?q={query}", "/search?q={query}"],
  },
];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeQuantityText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();
}

function tokenizeSearchText(value: string) {
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !stopWords.has(token));
}

function uniqueTokens(parts: string[]) {
  const tokens = new Set<string>();
  parts.forEach((part) => {
    tokenizeSearchText(part).forEach((token) => tokens.add(token));
  });
  return [...tokens];
}

function parsePrice(value: string) {
  if (!value) return 0;
  const cleaned = value
    .replace(/R\$\s*/gi, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");
  return Number.parseFloat(cleaned) || 0;
}

function toParsedQuantity(
  amount: number,
  unit: string,
  multiplier = 1,
): ParsedQuantity | null {
  const total = amount * multiplier;
  if (!Number.isFinite(total) || total <= 0) return null;

  if (unit === "kg") {
    return { canonicalUnit: "g", canonicalValue: total * 1000, label: `${total} kg` };
  }
  if (unit === "g") {
    return { canonicalUnit: "g", canonicalValue: total, label: `${total} g` };
  }
  if (unit === "mg") {
    return { canonicalUnit: "g", canonicalValue: total / 1000, label: `${total} mg` };
  }
  if (unit === "l" || unit === "lt") {
    return { canonicalUnit: "ml", canonicalValue: total * 1000, label: `${total} l` };
  }
  if (unit === "ml") {
    return { canonicalUnit: "ml", canonicalValue: total, label: `${total} ml` };
  }

  return {
    canonicalUnit: "unit",
    canonicalValue: total,
    label: `${total} un`,
  };
}

function parseQuantity(value: string): ParsedQuantity | null {
  const normalized = normalizeQuantityText(value);
  if (!normalized) return null;

  const packMatch = normalized.match(
    /(\d+(?:\.\d+)?)\s*(?:x|por)\s*(\d+(?:\.\d+)?)\s*(kg|g|mg|l|lt|ml|capsulas|capsula|caps|cap|comprimidos|comprimido|tabletes|tablete|unidades|unidade|un|und|saches|sache|envelopes|envelope|doses|dose)/,
  );
  if (packMatch) {
    return toParsedQuantity(
      Number(packMatch[2]),
      packMatch[3],
      Number(packMatch[1]),
    );
  }

  const countedPortionMatch = normalized.match(
    /(\d+(?:\.\d+)?)\s*(capsulas|capsula|caps|cap|comprimidos|comprimido|tabletes|tablete|unidades|unidade|un|und|saches|sache|envelopes|envelope|doses|dose)\s*(?:de)?\s*(\d+(?:\.\d+)?)\s*(g|mg|ml)/,
  );
  if (countedPortionMatch) {
    return {
      canonicalUnit: "unit",
      canonicalValue: Number(countedPortionMatch[1]),
      label: `${Number(countedPortionMatch[1])} un`,
    };
  }

  const reversePackMatch = normalized.match(
    /(\d+(?:\.\d+)?)\s*(kg|g|mg|l|lt|ml)\s*(?:x|por)\s*(\d+(?:\.\d+)?)/,
  );
  if (reversePackMatch) {
    return toParsedQuantity(
      Number(reversePackMatch[1]),
      reversePackMatch[2],
      Number(reversePackMatch[3]),
    );
  }

  const match = normalized.match(
    /(\d+(?:\.\d+)?)\s*(kg|g|mg|l|lt|ml|capsulas|capsula|caps|cap|comprimidos|comprimido|tabletes|tablete|unidades|unidade|un|und|saches|sache|envelopes|envelope|doses|dose)/,
  );
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];
  return toParsedQuantity(amount, unit);
}

function getMeaningfulTokens(value: string) {
  const tokens = tokenizeSearchText(value).filter(
    (token) => !genericSearchTokens.has(token),
  );
  return tokens.length ? tokens : tokenizeSearchText(value);
}

function parseDecimalToken(value: string) {
  return Number(value.replace(",", "."));
}

/** Convert mg/g/mcg/ml to a common base for comparison. */
function toBaseAmount(
  amount: number,
  unit: DoseUnit,
): { value: number; base: "mg" | "ml" } | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (unit === "mg") return { value: amount, base: "mg" };
  if (unit === "g") return { value: amount * 1000, base: "mg" };
  if (unit === "mcg") return { value: amount / 1000, base: "mg" };
  if (unit === "ml") return { value: amount, base: "ml" };
  return null;
}

const STRENGTH_COUNT_WORD =
  "(?:capsulas|capsula|caps|cap|comprimidos|comprimido|tabletes|tablete|unidades|unidade|un|und|saches|sache|envelopes|envelope|doses|dose)";

/** Extracts per-unit active substance from a product title.
 *  This is the missing piece — without it the engine compares
 *  "R$ per capsule" with no clue about how strong each capsule is. */
function extractUnitStrength(title: string): UnitStrength | null {
  const normalized = normalizeQuantityText(title);
  if (!normalized) return null;

  // Pattern A — explicit "N (units) (de)? X mg/g/ml"
  const explicit = normalized.match(
    new RegExp(
      `(\\d+(?:\\.\\d+)?)\\s*${STRENGTH_COUNT_WORD}\\s*(?:de\\s*)?(\\d+(?:\\.\\d+)?)\\s*(mg|g|ml)\\b`,
    ),
  );
  if (explicit) {
    const totalUnits = parseDecimalToken(explicit[1]);
    const unitAmount = parseDecimalToken(explicit[2]);
    const unitUnit = explicit[3] as "mg" | "g" | "ml";
    if (totalUnits > 0 && unitAmount > 0) {
      return { totalUnits, unitAmount, unitUnit };
    }
  }

  // Pattern B — reversed "X mg/g/ml ... N units" (no "de"). Common on
  // marketplace titles. Guarded by plausibility checks so we don't
  // mistake a "300 g" powder weight for "300 g per cap".
  const reversed = normalized.match(
    new RegExp(
      `(\\d+(?:\\.\\d+)?)\\s*(mg|g|ml)\\b[\\s\\S]{0,40}?(\\d+(?:\\.\\d+)?)\\s*${STRENGTH_COUNT_WORD}`,
    ),
  );
  if (reversed) {
    const unitAmount = parseDecimalToken(reversed[1]);
    const unitUnit = reversed[2] as "mg" | "g" | "ml";
    const totalUnits = parseDecimalToken(reversed[3]);
    const validCount = totalUnits >= 10 && totalUnits <= 720;
    const plausiblePerUnit =
      (unitUnit === "mg" && unitAmount > 0 && unitAmount <= 2000) ||
      (unitUnit === "g" && unitAmount > 0 && unitAmount <= 5) ||
      (unitUnit === "ml" && unitAmount > 0 && unitAmount <= 50);
    if (validCount && plausiblePerUnit) {
      return { totalUnits, unitAmount, unitUnit };
    }
  }

  return null;
}

/** Substance-anchored economics: at the user's target daily dose, how
 *  many units/day are needed, how long the pack lasts, and the real
 *  daily cost — the only fair comparison across different cap sizes. */
function computeDoseEconomics(
  totalPrice: number,
  offeredQuantity: ParsedQuantity | null,
  unitStrength: UnitStrength | null,
  dailyDoseAmount: number | undefined,
  dailyDoseUnit: DoseUnit | undefined,
): {
  unitsPerDay?: number;
  daysSupply?: number;
  dailyCost: number;
} | null {
  if (!dailyDoseAmount || !dailyDoseUnit || dailyDoseAmount <= 0) return null;
  if (dailyDoseUnit === "serving") return null;
  const dailyBase = toBaseAmount(dailyDoseAmount, dailyDoseUnit);
  if (!dailyBase) return null;

  // Preferred: per-cap strength × cap count.
  if (unitStrength) {
    const perUnitBase = toBaseAmount(unitStrength.unitAmount, unitStrength.unitUnit);
    if (perUnitBase && perUnitBase.base === dailyBase.base) {
      const totalActive = unitStrength.totalUnits * perUnitBase.value;
      if (totalActive > 0) {
        const unitsPerDay = Math.max(
          1,
          Math.ceil(dailyBase.value / perUnitBase.value),
        );
        const costPerUnit = totalPrice / unitStrength.totalUnits;
        const dailyCost = Number((costPerUnit * unitsPerDay).toFixed(2));
        const daysSupply = Math.floor(unitStrength.totalUnits / unitsPerDay);
        return { unitsPerDay, daysSupply, dailyCost };
      }
    }
  }

  // Fallback: bulk mass/volume product (e.g. "300 g" creatine powder).
  if (offeredQuantity && offeredQuantity.canonicalUnit !== "unit") {
    const totalBaseValue =
      offeredQuantity.canonicalUnit === "g"
        ? offeredQuantity.canonicalValue * 1000
        : offeredQuantity.canonicalValue;
    const totalBaseUnit: "mg" | "ml" =
      offeredQuantity.canonicalUnit === "g" ? "mg" : "ml";
    if (totalBaseUnit !== dailyBase.base) return null;
    if (totalBaseValue <= 0) return null;
    const dailyCost = Number(
      ((totalPrice / totalBaseValue) * dailyBase.value).toFixed(2),
    );
    const daysSupply = Math.floor(totalBaseValue / dailyBase.value);
    return { daysSupply, dailyCost };
  }

  return null;
}

function getComparablePrice(
  totalPrice: number,
  offeredQuantity: ParsedQuantity | null,
) {
  if (!offeredQuantity || !Number.isFinite(offeredQuantity.canonicalValue) || offeredQuantity.canonicalValue <= 0) {
    return null;
  }

  if (offeredQuantity.canonicalUnit === "unit") {
    return {
      comparablePriceLabel: "1 un",
      comparablePrice: Number((totalPrice / offeredQuantity.canonicalValue).toFixed(2)),
    };
  }

  return {
    comparablePriceLabel: `100 ${offeredQuantity.canonicalUnit}`,
    comparablePrice: Number(
      ((totalPrice * 100) / offeredQuantity.canonicalValue).toFixed(2),
    ),
  };
}

function buildSearchQuery(input: SearchInput) {
  const parts: string[] = [];
  const brand = input.brand?.trim();
  const name = input.name.trim();
  const quantity = input.quantity?.trim();

  if (brand) parts.push(brand);
  if (name) parts.push(name);

  const quantityTokens = uniqueTokens([quantity ?? ""]);
  const currentTokens = uniqueTokens(parts);
  quantityTokens.forEach((token) => {
    if (!currentTokens.includes(token)) {
      parts.push(quantity ?? "");
    }
  });

  return parts.filter(Boolean).join(" ").trim();
}

function buildUrlFromPattern(baseUrl: string, pattern: string, query: string) {
  const encoded = encodeURIComponent(query);
  return `${baseUrl}${pattern.replaceAll("{query}", encoded)}`;
}

function shuffledUserAgents() {
  const pool = [...HTML_USER_AGENTS];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool;
}

function parseSrcsetFirstUrl(srcset: string | undefined) {
  if (!srcset) return "";
  return (
    String(srcset)
      .split(",")
      .map((part) => String(part || "").trim().split(/\s+/)[0])
      .find(Boolean) ?? ""
  );
}

function sanitizeMercadoLivreLink(rawLink: string | undefined) {
  const value = String(rawLink || "").trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    [
      "polycard_client",
      "search_layout",
      "position",
      "type",
      "tracking_id",
      "wid",
      "sid",
      "mx_tid",
      "matt_word",
      "matt_tool",
      "matt_source",
    ].forEach((key) => url.searchParams.delete(key));
    url.hash = "";
    return url.toString();
  } catch {
    return value.split("#")[0];
  }
}

function extractMercadoLivreCurrentPrice(
  $: cheerio.CheerioAPI,
  element: Parameters<cheerio.CheerioAPI>[0],
) {
  const currentAmountSelectors = [
    ".poly-price__current .andes-money-amount",
    ".ui-search-price__part .andes-money-amount",
    ".ui-search-price__second-line .andes-money-amount",
    ".poly-component__price .andes-money-amount",
  ];

  for (const selector of currentAmountSelectors) {
    const amountElement = $(element).find(selector).first();
    if (!amountElement.length) continue;
    const fractionText = amountElement
      .find(".andes-money-amount__fraction")
      .first()
      .text()
      .trim();
    const centsText = amountElement
      .find(".andes-money-amount__cents")
      .first()
      .text()
      .trim();
    const price = parsePrice(
      `${fractionText}${centsText ? `,${centsText}` : ""}`,
    );
    if (price > 0) return price;
  }

  const fallbackFraction = $(element)
    .find(
      ".poly-price__current .andes-money-amount__fraction, .ui-search-price__part .andes-money-amount__fraction, .andes-money-amount__fraction",
    )
    .first()
    .text()
    .trim();
  const fallbackCents = $(element)
    .find(
      ".poly-price__current .andes-money-amount__cents, .ui-search-price__part .andes-money-amount__cents, .andes-money-amount__cents",
    )
    .first()
    .text()
    .trim();

  return parsePrice(
    `${fallbackFraction}${fallbackCents ? `,${fallbackCents}` : ""}`,
  );
}

function pickMercadoLivreThumbnail(
  $: cheerio.CheerioAPI,
  element: Parameters<cheerio.CheerioAPI>[0],
) {
  const image = $(element).find("img").first();
  const source = $(element).find("source").first();
  const candidates = [
    image.attr("src"),
    image.attr("data-src"),
    image.attr("data-lazy-src"),
    parseSrcsetFirstUrl(image.attr("srcset")),
    parseSrcsetFirstUrl(image.attr("data-srcset")),
    parseSrcsetFirstUrl(source.attr("srcset")),
    parseSrcsetFirstUrl(source.attr("data-srcset")),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const thumbnail =
    candidates.find(
      (value) => /^https?:\/\//i.test(value) || value.startsWith("//"),
    ) ?? "";
  return thumbnail.startsWith("//") ? `https:${thumbnail}` : thumbnail;
}

function collectMercadoLivreShippingText(
  $: cheerio.CheerioAPI,
  element: Parameters<cheerio.CheerioAPI>[0],
  selector: string,
) {
  const direct = $(element)
    .find(selector)
    .map((_, node) => $(node).text())
    .get()
    .join(" ");
  const hints = $(element)
    .find(
      '[aria-label*="Frete"], [aria-label*="grátis"], [aria-label*="gratis"], [aria-label*="FULL"], [title*="Frete"], [title*="grátis"], [title*="gratis"], [title*="FULL"]',
    )
    .map(
      (_, node) =>
        `${$(node).attr("aria-label") || ""} ${$(node).attr("title") || ""}`,
    )
    .get()
    .join(" ");
  return `${direct} ${hints}`.replace(/\s+/g, " ").trim().toLowerCase();
}

function detectFreeOrFull(shippingText: string) {
  const text = String(shippingText || "").toLowerCase();
  if (!text) return false;
  return (
    /frete\s*gr[aá]tis|envio\s*gr[aá]tis|chega(?:r[aá])?\s*gr[aá]tis/i.test(
      text,
    ) || /\bfull\b/i.test(text)
  );
}

function parseMercadoLivreResults(
  html: string,
  source: SearchSourceDefinition,
) {
  const $ = cheerio.load(html || "");
  const results: RawOffer[] = [];

  const selectors = [
    {
      container: ".ui-search-layout__item",
      title: ".ui-search-item__title, .poly-component__title",
      link: "a.ui-search-link, a.poly-component__title",
      shipping: ".ui-search-item__shipping, .poly-component__shipping",
    },
    {
      container: ".poly-card",
      title: ".poly-component__title",
      link: "a",
      shipping: ".poly-component__shipping",
    },
  ];

  for (const selector of selectors) {
    $(selector.container).each((_, element) => {
      const title = $(element).find(selector.title).first().text().trim();
      const linkElement = $(element).find(selector.link).first();
      const url = sanitizeMercadoLivreLink(linkElement.attr("href"));
      const shippingText = collectMercadoLivreShippingText(
        $,
        element,
        selector.shipping,
      );
      const thumbnail = pickMercadoLivreThumbnail($, element);
      const price = extractMercadoLivreCurrentPrice($, element);

      if (!title || price <= 0 || !url) return;

      const duplicate = results.find(
        (entry) => entry.title === title && entry.price === price,
      );
      if (duplicate) {
        if (!duplicate.thumbnail && thumbnail) {
          duplicate.thumbnail = thumbnail;
        }
        return;
      }

      results.push({
        sourceId: source.id,
        sourceName: source.name,
        title,
        price,
        url,
        thumbnail: thumbnail || undefined,
        freeShipping: detectFreeOrFull(shippingText),
        available: !/indisponível|indisponivel|esgotado|sem estoque/i.test(
          $(element).text().replace(/\s+/g, " ").trim().toLowerCase(),
        ),
      });
    });

    if (results.length > 0) break;
  }

  return results;
}

function parseJsonLdOffers(
  html: string,
  source: SearchSourceDefinition,
) {
  const $ = cheerio.load(html);
  const results: RawOffer[] = [];
  $("script[type='application/ld+json']").each((_, element) => {
    const text = $(element).text().trim();
    if (!text) return;
    try {
      const parsed = JSON.parse(text);
      const stack = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (stack.length) {
        const current = stack.shift();
        if (!current || typeof current !== "object") continue;

        const currentRecord = current as Record<string, unknown>;
        if (currentRecord["@type"] === "ItemList" && Array.isArray(currentRecord.itemListElement)) {
          currentRecord.itemListElement.forEach((entry: Record<string, unknown>) => {
            const entryRecord = entry as Record<string, unknown>;
            const item =
              typeof entryRecord.item === "object" && entryRecord.item
                ? (entryRecord.item as Record<string, unknown>)
                : entryRecord;
            const offers =
              typeof item.offers === "object" && item.offers
                ? (item.offers as Record<string, unknown>)
                : {};
            const title = String(item.name || "").trim();
            const price = Number(offers.lowPrice || offers.price || 0);
            let url = String(item.url || item["@id"] || "").trim();
            if (url && !url.startsWith("http") && source.baseUrl) {
              url = `${source.baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
            }
            const imageValue = item.image;
            const thumbnail = Array.isArray(imageValue)
              ? String(imageValue[0] || "").trim()
              : String(imageValue || "").trim();
            const shippingDetails =
              typeof offers.shippingDetails === "object" && offers.shippingDetails
                ? (offers.shippingDetails as Record<string, unknown>)
                : null;
            const shippingDetailsRate =
              shippingDetails &&
              typeof shippingDetails.shippingRate === "object" &&
              shippingDetails.shippingRate
                ? (shippingDetails.shippingRate as Record<string, unknown>)
                : null;
            const directShippingRate =
              typeof offers.shippingRate === "object" && offers.shippingRate
                ? (offers.shippingRate as Record<string, unknown>)
                : null;
            const shippingRaw = Number(
              shippingDetailsRate?.value ||
                directShippingRate?.value ||
                offers.shippingRate ||
                0,
            );
            const freeShipping =
              shippingRaw === 0 ||
              /frete\s*gratis/i.test(
                String(offers.description || offers.name || item.description || ""),
              );

            if (title && price > 0 && url) {
              results.push({
                sourceId: source.id,
                sourceName: source.name,
                title,
                price,
                url,
                thumbnail: thumbnail || undefined,
                freeShipping,
                shippingPrice:
                  freeShipping || !Number.isFinite(shippingRaw) ? undefined : shippingRaw,
                available:
                  String(offers.availability || "").toLowerCase() !==
                  "https://schema.org/outofstock",
              });
            }
          });
        }

        Object.values(current).forEach((value) => {
          if (!value || typeof value !== "object") return;
          if (Array.isArray(value)) {
            value.forEach((entry) => {
              if (entry && typeof entry === "object") {
                stack.push(entry);
              }
            });
            return;
          }
          stack.push(value);
        });
      }
    } catch {
      // Ignora blocos inválidos.
    }
  });

  return results;
}

function parseGenericHtmlOffers(
  html: string,
  source: SearchSourceDefinition,
) {
  const results = parseJsonLdOffers(html, source);
  if (results.length) return results;

  const $ = cheerio.load(html);
  const cards = [
    "div[data-component-type='s-search-result']",
    ".product-item",
    ".product-card",
    ".produto-item",
    ".listagem-item",
    "li.product",
  ];

  let selected = $("body").find(".__no-results") as ReturnType<typeof $>;
  for (const selector of cards) {
    selected = $(selector);
    if (selected.length) break;
  }

  const found: RawOffer[] = [];
  selected.each((_, element) => {
    const title =
      $(element).find("h2 a span, h2 span, h3, .product-name, .nome-produto").first().text().trim() ||
      $(element).find("img").first().attr("alt")?.trim() ||
      "";
    const price =
      parsePrice($(element).find(".a-price .a-offscreen").first().text()) ||
      parsePrice($(element).find(".price, .preco, .sales-price").first().text());
    let url =
      $(element).find("h2 a").first().attr("href") ||
      $(element).find("a").first().attr("href") ||
      "";
    const thumbnail =
      $(element).find("img").first().attr("src") ||
      $(element).find("img").first().attr("data-src") ||
      "";
    const text = $(element).text().replace(/\s+/g, " ").trim().toLowerCase();
    const freeShipping = /frete\s*gratis|frete\s*grátis/.test(text);

    if (url && !url.startsWith("http") && source.baseUrl) {
      url = `${source.baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
    }

    if (title && price > 0 && url) {
      found.push({
        sourceId: source.id,
        sourceName: source.name,
        title,
        price,
        url,
        thumbnail: thumbnail || undefined,
        freeShipping,
        available: !/indisponivel|indisponível|esgotado|sem estoque/.test(text),
      });
    }
  });

  return found;
}

async function searchMercadoLivre(
  source: SearchSourceDefinition,
  query: string,
) {
  const searchUrl = `https://lista.mercadolivre.com.br/${encodeURIComponent(query).replace(/%20/g, "-")}`;
  const userAgents = shuffledUserAgents();
  let lastError: Error | null = null;
  let blockedByVerification = false;
  let browserFallbackNeeded = false;

  for (const userAgent of userAgents) {
    try {
      const response = await axios.get(searchUrl, {
        timeout: 15000,
        headers: {
          "User-Agent": userAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
          "Accept-Encoding": "gzip, deflate",
          "Cache-Control": "no-cache",
        },
      });

      const html = String(response.data || "");
      const parsed = parseMercadoLivreResults(html, source);
      if (parsed.length > 0) return parsed;

      const normalizedHtml = html.toLowerCase();
      const hasCards =
        normalizedHtml.includes("ui-search-layout__item") ||
        normalizedHtml.includes("poly-card");
      const noResults =
        /n[aã]o encontramos publica[cç][oõ]es|no hay publicaciones/.test(
          normalizedHtml,
        );
      const blocked = /account-verification|captcha|robot|human verification/.test(
        normalizedHtml,
      );

      if (noResults) return [];
      browserFallbackNeeded = true;
      if (!hasCards && blocked) {
        blockedByVerification = true;
        continue;
      }
      break;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error("Falha ao consultar o Mercado Livre.");
      browserFallbackNeeded = true;
    }
  }

  if (browserFallbackNeeded) {
    try {
      const browserResponse = await fetchRenderedHtml(searchUrl, {
        referer: "https://www.mercadolivre.com.br/",
        waitAfterLoadMs: 1800,
      });
      const browserParsed = parseMercadoLivreResults(browserResponse.html, source);
      if (browserParsed.length > 0) return browserParsed;
    } catch (error) {
      if (!lastError && error instanceof Error) {
        lastError = error;
      }
    }
  }

  if (blockedByVerification) {
    throw new Error("Mercado Livre bloqueou a automação da busca neste momento.");
  }
  if (lastError) {
    throw lastError;
  }
  return [];
}

async function searchAmazon(
  source: SearchSourceDefinition,
  query: string,
) {
  const searchUrl = `${source.baseUrl}/s?k=${encodeURIComponent(query)}`;

  try {
    const response = await axios.get(`${source.baseUrl}/s`, {
      timeout: 15000,
      params: { k: query },
      headers: {
        ...DEFAULT_HEADERS,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: source.baseUrl,
      },
    });

    const html = String(response.data || "");
    const offers = parseGenericHtmlOffers(html, source);
    if (offers.length > 0) {
      return offers;
    }
  } catch {
    // Cai para o fallback com navegador real.
  }

  const browserResponse = await fetchRenderedHtml(searchUrl, {
    referer: source.baseUrl,
    waitAfterLoadMs: 1800,
  });
  return parseGenericHtmlOffers(browserResponse.html, source);
}

async function searchShopee(
  source: SearchSourceDefinition,
  query: string,
) {
  const keyword = encodeURIComponent(query);
  const response = await axios.get(
    `https://shopee.com.br/api/v4/search/search_items?by=relevancy&keyword=${keyword}&limit=20&newest=0&order=desc&page_type=search`,
    {
      timeout: 15000,
      validateStatus: (status) => status >= 200 && status < 500,
      headers: {
        ...DEFAULT_HEADERS,
        Accept: "application/json",
        Referer: `https://shopee.com.br/search?keyword=${keyword}`,
        "X-Requested-With": "XMLHttpRequest",
        "x-api-source": "pc",
      },
    },
  );

  if (response.status === 403) {
    const fallback = await axios.get(
      `https://shopee.com.br/search?keyword=${keyword}`,
      {
        timeout: 15000,
        headers: {
          ...DEFAULT_HEADERS,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: "https://shopee.com.br/",
        },
      },
    );
    const html = String(fallback.data || "");
    const map = new Map<string, RawOffer>();
    const regex =
      /"itemid":(\d+).*?"shopid":(\d+).*?"name":"([^"]{2,}?)".*?"price(?:_min(?:_before_discount)?)?":(\d+)/g;
    let match = regex.exec(html);
    while (match) {
      const itemId = Number(match[1] || 0);
      const shopId = Number(match[2] || 0);
      const rawName = String(match[3] || "").replace(/\\"/g, '"').trim();
      const rawPrice = Number(match[4] || 0);
      const price = rawPrice > 0 ? rawPrice / 100000 : 0;
      const key = `${shopId}|${itemId}`;
      if (!map.has(key) && itemId && shopId && rawName && price > 0) {
        map.set(key, {
          sourceId: source.id,
          sourceName: source.name,
          title: rawName,
          price,
          url: `https://shopee.com.br/product/${shopId}/${itemId}`,
          freeShipping: false,
          available: true,
        });
      }
      match = regex.exec(html);
    }
    if (map.size > 0) {
      return [...map.values()];
    }
    throw new Error("Shopee bloqueou a automação da busca neste momento.");
  }
  if (response.status !== 200) {
    throw new Error(`Shopee retornou status ${response.status}.`);
  }

  const items = Array.isArray(response.data?.items) ? response.data.items : [];
  return items
    .map((entry: Record<string, unknown>) => {
      const entryRecord = entry as Record<string, unknown>;
      const item =
        typeof entryRecord.item_basic === "object" && entryRecord.item_basic
          ? (entryRecord.item_basic as Record<string, unknown>)
          : entryRecord;
      const rawPrice = Number(
        item.price_min_before_discount || item.price_min || item.price || item.price_max || 0,
      );
      const price = rawPrice > 0 ? rawPrice / 100000 : 0;
      const shopId = Number(item.shopid || 0);
      const itemId = Number(item.itemid || 0);
      return {
        sourceId: source.id,
        sourceName: source.name,
        title: String(item.name || "").trim(),
        price,
        url:
          shopId && itemId
            ? `https://shopee.com.br/product/${shopId}/${itemId}`
            : "",
        thumbnail: item.image
          ? `https://cf.shopee.com.br/file/${String(item.image).trim()}`
          : undefined,
        freeShipping: Boolean(item.is_free_shipping) || Boolean(item.free_shipping),
        available: String(item.item_status || "normal").trim() === "normal",
      } satisfies RawOffer;
    })
    .filter((item: RawOffer) => item.title && item.price > 0 && item.url);
}

function buildGenericSearchUrls(source: SearchSourceDefinition, query: string) {
  if (!source.baseUrl) return [];
  const patterns =
    source.searchPatterns?.length
      ? source.searchPatterns
      : ["/busca?q={query}", "/search?q={query}", "/?s={query}"];
  return patterns.map((pattern) => buildUrlFromPattern(source.baseUrl!, pattern, query));
}

async function searchGenericSource(
  source: SearchSourceDefinition,
  query: string,
) {
  const urls = buildGenericSearchUrls(source, query);
  let lastError = "";

  for (const url of urls) {
    try {
      const response = await axios.get(url, {
        timeout: 15000,
        maxRedirects: 5,
        headers: {
          ...DEFAULT_HEADERS,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          Referer: source.baseUrl,
        },
      });
      const html = String(response.data || "");
      const lowerHtml = html.toLowerCase();
      if (
        lowerHtml.includes("verifying your browser") ||
        lowerHtml.includes("captcha") ||
        lowerHtml.includes("robot") ||
        lowerHtml.includes("shieldsquare")
      ) {
        throw new Error(`${source.name} bloqueou a automação da busca.`);
      }
      const offers = parseGenericHtmlOffers(html, source);
      if (offers.length) return offers;

      if (shouldUseBrowserFallback(html, offers.length)) {
        const browserResponse = await fetchRenderedHtml(url, {
          referer: source.baseUrl,
          waitAfterLoadMs: 1800,
        });
        const browserOffers = parseGenericHtmlOffers(browserResponse.html, source);
        if (browserOffers.length) return browserOffers;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "falha ao consultar";
      lastError = message;
      if (/status code 403|status code 429/i.test(message)) {
        try {
          const browserResponse = await fetchRenderedHtml(url, {
            referer: source.baseUrl,
            waitAfterLoadMs: 1800,
          });
          const browserOffers = parseGenericHtmlOffers(browserResponse.html, source);
          if (browserOffers.length) return browserOffers;
        } catch (browserError) {
          lastError =
            browserError instanceof Error ? browserError.message : "falha ao consultar";
        }
      }
      if (/bloqueou a automação/i.test(message)) {
        try {
          const browserResponse = await fetchRenderedHtml(url, {
            referer: source.baseUrl,
            waitAfterLoadMs: 1800,
          });
          const browserOffers = parseGenericHtmlOffers(browserResponse.html, source);
          if (browserOffers.length) return browserOffers;
        } catch (browserError) {
          lastError =
            browserError instanceof Error ? browserError.message : "falha ao consultar";
        }
      }
    }
  }

  if (lastError) {
    throw new Error(lastError);
  }

  return [];
}

function dedupeOffers(offers: RawOffer[]) {
  const map = new Map<string, RawOffer>();
  offers.forEach((offer) => {
    const key = `${offer.sourceId}|${normalizeText(offer.title)}|${offer.url}`;
    const current = map.get(key);
    if (!current || offer.price < current.price) {
      map.set(key, offer);
    }
  });
  return [...map.values()];
}

function scoreOffer(
  offer: RawOffer,
  input: SearchInput,
): ShoppingSearchResult | null {
  const normalizedTitle = normalizeText(offer.title);
  const nameTokens = tokenizeSearchText(input.name);
  const meaningfulNameTokens = getMeaningfulTokens(input.name);
  const brandTokens = tokenizeSearchText(input.brand || "");
  const requestedQuantity = parseQuantity(input.quantity || "");
  const offeredQuantity = parseQuantity(offer.title);

  const matchedTokens = nameTokens.filter((token) => normalizedTitle.includes(token)).length;
  const matchedMeaningfulTokens = meaningfulNameTokens.filter((token) =>
    normalizedTitle.includes(token),
  ).length;
  const brandMatches = brandTokens.filter((token) => normalizedTitle.includes(token)).length;
  const matchedBrand = brandTokens.length > 0 ? brandMatches === brandTokens.length : false;
  const primaryAnchor = meaningfulNameTokens[0];

  if (nameTokens.length > 0 && matchedTokens === 0 && !matchedBrand) {
    return null;
  }
  if (primaryAnchor && !normalizedTitle.includes(primaryAnchor) && !matchedBrand) {
    return null;
  }

  let matchScore = matchedTokens * 18;
  matchScore += matchedMeaningfulTokens * 10;
  if (nameTokens.length > 0 && matchedTokens === nameTokens.length) {
    matchScore += 14;
  }
  if (
    meaningfulNameTokens.length > 1 &&
    matchedMeaningfulTokens === meaningfulNameTokens.length
  ) {
    matchScore += 10;
  }
  if (matchedBrand) {
    matchScore += 18;
  } else if (brandMatches > 0) {
    matchScore += brandMatches * 6;
  }

  let matchedQuantity = false;
  if (requestedQuantity && offeredQuantity) {
    if (requestedQuantity.canonicalUnit === offeredQuantity.canonicalUnit) {
      const ratio =
        Math.abs(offeredQuantity.canonicalValue - requestedQuantity.canonicalValue) /
        requestedQuantity.canonicalValue;
      if (ratio <= 0.05) {
        matchScore += 18;
        matchedQuantity = true;
      } else if (ratio <= 0.12) {
        matchScore += 12;
      } else if (ratio <= 0.2) {
        matchScore += 8;
      }
    }
  }

  if (offer.freeShipping) {
    matchScore += 6;
  }
  if (offer.available === false) {
    matchScore -= 40;
  }
  if (/\bkit|combo|leve\s+\d+\s+pague\s+\d+/i.test(offer.title)) {
    matchScore -= 6;
  }

  const badges: string[] = [];
  if (offer.freeShipping) {
    badges.push("Frete grátis");
  }
  if (matchedBrand) {
    badges.push("Marca confirmada");
  }
  if (matchedQuantity) {
    badges.push("Quantidade confirmada");
  } else if (offeredQuantity?.label) {
    badges.push(offeredQuantity.label);
  }

  const shippingPrice =
    typeof offer.shippingPrice === "number" && Number.isFinite(offer.shippingPrice)
      ? Math.max(0, Number(offer.shippingPrice.toFixed(2)))
      : undefined;
  const totalPrice = Number(
    (offer.price + (shippingPrice ?? 0)).toFixed(2),
  );
  const comparablePrice = getComparablePrice(totalPrice, offeredQuantity);

  const unitStrength = extractUnitStrength(offer.title);
  const economics = computeDoseEconomics(
    totalPrice,
    offeredQuantity,
    unitStrength,
    input.dailyDoseAmount,
    input.dailyDoseUnit,
  );

  // Substance-aware confidence: only "confirmed" when we either pinned
  // unit strength from the title OR are reading a clean bulk product.
  const userWantsDose = Boolean(input.dailyDoseAmount && input.dailyDoseUnit);
  const doseConfidence: "confirmed" | "unconfirmed" =
    economics ? "confirmed" : "unconfirmed";

  if (userWantsDose) {
    if (doseConfidence === "confirmed") {
      matchScore += 10;
      if (economics?.dailyCost !== undefined) {
        badges.push(
          `R$ ${economics.dailyCost.toFixed(2).replace(".", ",")}/dia`,
        );
      }
      if (economics?.daysSupply && economics.daysSupply > 0) {
        badges.push(
          `Dura ${economics.daysSupply} ${economics.daysSupply === 1 ? "dia" : "dias"}`,
        );
      }
      if (unitStrength && economics?.unitsPerDay) {
        const strengthLabel = `${unitStrength.unitAmount}${unitStrength.unitUnit}/${unitStrength.totalUnits} un`;
        badges.push(strengthLabel);
      }
    } else {
      // Don't mislead — flag it. Penalize lightly so confirmed items rank above.
      matchScore -= 8;
      badges.push("Dose por cápsula não confirmada");
    }
  }

  return {
    id: `${offer.sourceId}-${Buffer.from(offer.url).toString("base64url").slice(0, 18)}`,
    scope: "market",
    sourceId: offer.sourceId,
    sourceName: offer.sourceName,
    title: offer.title,
    url: offer.url,
    thumbnail: offer.thumbnail,
    price: Number(offer.price.toFixed(2)),
    shippingPrice,
    totalPrice,
    shippingDays: offer.shippingDays,
    freeShipping: Boolean(offer.freeShipping),
    available: offer.available !== false,
    matchScore,
    matchedBrand,
    matchedQuantity,
    matchedTokens,
    quantityLabel: offeredQuantity?.label,
    comparablePriceLabel: comparablePrice?.comparablePriceLabel,
    comparablePrice: comparablePrice?.comparablePrice,
    unitStrengthAmount: unitStrength?.unitAmount,
    unitStrengthUnit: unitStrength?.unitUnit,
    totalUnits: unitStrength?.totalUnits,
    unitsPerDay: economics?.unitsPerDay,
    dailyCost: economics?.dailyCost,
    daysSupply: economics?.daysSupply,
    doseConfidence,
    badges,
  };
}

async function searchSource(
  source: SearchSourceDefinition,
  query: string,
) {
  switch (source.kind) {
    case "mercadolivre-api":
      return searchMercadoLivre(source, query);
    case "amazon-html":
      return searchAmazon(source, query);
    case "shopee-api":
      return searchShopee(source, query);
    case "generic-html":
    default:
      return searchGenericSource(source, query);
  }
}

function sortResults(left: ShoppingSearchResult, right: ShoppingSearchResult) {
  const scoreDiff = right.matchScore - left.matchScore;
  if (scoreDiff !== 0) return scoreDiff;

  // Substance-anchored cost wins when both sides confirmed it — that's
  // the actual answer to "qual é o melhor custo-benefício".
  if (
    typeof left.dailyCost === "number" &&
    typeof right.dailyCost === "number"
  ) {
    const dailyDiff = left.dailyCost - right.dailyCost;
    if (dailyDiff !== 0) return dailyDiff;
  } else if (typeof left.dailyCost === "number") {
    return -1;
  } else if (typeof right.dailyCost === "number") {
    return 1;
  }

  if (left.freeShipping !== right.freeShipping) {
    return left.freeShipping ? -1 : 1;
  }

  const priceDiff = left.totalPrice - right.totalPrice;
  if (priceDiff !== 0) return priceDiff;

  return left.title.localeCompare(right.title);
}

function sourceGroup(scope: ShoppingModuleScope) {
  return scope === "supplements" ? supplementSources : marketSources;
}

export async function searchShoppingOffers(
  scope: ShoppingModuleScope,
  input: SearchInput,
  limit = 18,
): Promise<ShoppingSearchResponse> {
  const query = buildSearchQuery(input);
  if (!query) {
    return {
      scope,
      queryLabel: buildShoppingQueryLabel(input),
      results: [],
      sources: [],
    };
  }

  const sources = sourceGroup(scope);
  const settled = await Promise.allSettled(
    sources.map((source) => searchSource(source, query)),
  );

  const sourceStates: ShoppingSearchSourceState[] = [];
  const rawOffers: RawOffer[] = [];

  settled.forEach((result, index) => {
    const source = sources[index];
    if (result.status === "fulfilled") {
      rawOffers.push(...result.value);
      sourceStates.push({
        id: source.id,
        name: source.name,
        status: "ok",
        count: result.value.length,
      });
      return;
    }

    const message = result.reason instanceof Error ? result.reason.message : "Falha ao buscar";
    sourceStates.push({
      id: source.id,
      name: source.name,
      status: /bloqueou|captcha|verifying/i.test(message) ? "blocked" : "error",
      count: 0,
      note: message,
    });
  });

  const deduped = dedupeOffers(rawOffers);
  const scored = deduped
    .map((offer) => {
      const scoredOffer = scoreOffer(offer, input);
      if (!scoredOffer) return null;
      return {
        ...scoredOffer,
        scope,
      };
    })
    .filter(
      (offer): offer is ShoppingSearchResult =>
        offer !== null && offer.available,
    )
    .sort(sortResults)
    .slice(0, Math.max(6, Math.min(36, limit)));

  return {
    scope,
    queryLabel: buildShoppingQueryLabel(input),
    results: scored,
    sources: sourceStates,
  };
}

/* ───────────────────────────────────────────────────────────────
   Refresh de preço a partir do LINK do produto.

   Diferente da busca (que varre listagens de várias lojas), aqui a
   gente já tem a URL exata de UM produto e só quer o preço atual.
   A maioria das lojas (Mercado Livre, Amazon, Magalu, Drogasil…)
   expõe o preço de forma padronizada via JSON-LD (schema.org/Product),
   Open Graph (product:price:amount) ou itemprop="price" — então um
   extrator genérico cobre quase todas sem código por loja.
   ─────────────────────────────────────────────────────────────── */

export interface PriceFromUrlResult {
  ok: boolean;
  price?: number;
  currency?: string;
  title?: string;
  sourceName?: string;
  finalUrl?: string;
  error?: string;
  /** Caminho que carregou o HTML: axios (rápido) ou playwright (com JS). */
  fetchMode?: "axios" | "playwright";
  /** Estratégia do extrator que achou o preço. Útil pra diagnosticar. */
  stage?:
    | "json-ld"
    | "meta-og"
    | "meta-itemprop"
    | "itemprop-element"
    | "next-data"
    | "data-attribute"
    | "css-class"
    | "regex-html"
    | "none";
  /** HTTP status do fetch axios, quando aplicável. */
  httpStatus?: number;
  /** Tamanho do HTML lido (caracteres). 0 = não conseguiu ler. */
  htmlBytes?: number;
}

/**
 * Parser pra valores em formato "máquina" (JSON-LD / meta), onde o ponto
 * é separador decimal: "129.90" → 129.9, "1299" → 1299. Se vier em
 * formato BR de exibição ("1.234,56" / "R$ 99,90"), cai no parsePrice.
 */
function parseMachineNumber(raw: unknown): number {
  if (raw == null) return 0;
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? raw : 0;
  const value = String(raw).trim();
  if (!value) return 0;
  // Formato máquina: dígitos com no máximo um ponto decimal, sem vírgula.
  if (/^\d+(\.\d{1,2})?$/.test(value)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  return parsePrice(value);
}

function prettifyStoreHost(hostname: string): string {
  return hostname.replace(/^www\./, "").replace(/^lista\.|^produto\./, "");
}

type ExtractStage = NonNullable<PriceFromUrlResult["stage"]>;

function deepFindPrice(
  node: unknown,
  depth = 0,
): { price: number; currency?: string } | null {
  // Procura recursiva em estruturas JSON arbitrárias (__NEXT_DATA__,
  // window.__INITIAL_STATE__) por chaves de preço. Limitado em
  // profundidade pra não explodir em estruturas circulares/grandes.
  if (depth > 8 || !node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = deepFindPrice(child, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const record = node as Record<string, unknown>;
  // Chaves comuns que carregam preço numérico nas SPAs brasileiras.
  const priceKeys = [
    "price",
    "currentPrice",
    "salePrice",
    "sellingPrice",
    "finalPrice",
    "bestPrice",
    "listPrice",
    "preco",
    "precoAtual",
    "precoFinal",
    "valor",
  ];
  for (const key of priceKeys) {
    const candidate = record[key];
    if (candidate != null) {
      const parsed = parseMachineNumber(candidate);
      if (parsed > 0) {
        const currency =
          typeof record.priceCurrency === "string"
            ? record.priceCurrency
            : typeof record.currency === "string"
              ? record.currency
              : undefined;
        return { price: parsed, currency };
      }
    }
  }
  for (const value of Object.values(record)) {
    const found = deepFindPrice(value, depth + 1);
    if (found) return found;
  }
  return null;
}

/**
 * Regex de fallback final: procura "R$ 99,90" no HTML cru, próximo a
 * marcadores que sugerem preço atual (não preço "de" / riscado / parcelado).
 * Conservador — só usa se nenhuma estratégia estruturada achou.
 */
function extractByRegex(html: string): number {
  // Normaliza espaços e remove tags pra ler texto bruto.
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  // R$ seguido de número em formato BR. Captura tanto "R$ 99,90" como "R$99,90".
  const matches = Array.from(text.matchAll(/R\$\s*([\d.]+,\d{2})/gi));
  if (matches.length === 0) return 0;
  // Heurística: pega o MENOR preço (geralmente é o de venda, não o "de" riscado).
  // Filtra valores absurdos (< 1 ou > 100k).
  const prices = matches
    .map((m) => parsePrice(`R$ ${m[1]}`))
    .filter((p) => p >= 1 && p <= 100000);
  if (prices.length === 0) return 0;
  return Math.min(...prices);
}

function extractProductPriceFromHtml(html: string): {
  price: number;
  currency?: string;
  title?: string;
  stage: ExtractStage;
} {
  const $ = cheerio.load(html || "");
  let price = 0;
  let currency: string | undefined;
  let title: string | undefined;
  let stage: ExtractStage = "none";

  // 1. JSON-LD (schema.org/Product / Offer) — caminho mais confiável.
  $("script[type='application/ld+json']").each((_, element) => {
    if (price > 0) return;
    let data: unknown;
    try {
      // Alguns sites incluem "//<![CDATA[ ... //]]>" ou comentários — limpa.
      const raw = $(element)
        .text()
        .replace(/^\s*\/\/<!\[CDATA\[/, "")
        .replace(/\/\/\]\]>\s*$/, "")
        .trim();
      if (!raw) return;
      data = JSON.parse(raw);
    } catch {
      return;
    }
    const queue: unknown[] = Array.isArray(data) ? [...data] : [data];
    let guard = 0;
    while (queue.length && guard < 200) {
      guard += 1;
      const node = queue.shift();
      if (!node || typeof node !== "object") continue;
      const record = node as Record<string, unknown>;
      if (Array.isArray(record["@graph"])) queue.push(...record["@graph"]);
      const types = ([] as unknown[]).concat(record["@type"] ?? []);
      const isProduct = types.includes("Product");
      if (isProduct && !title && typeof record.name === "string") {
        title = record.name;
      }
      const offers = record.offers;
      const offerList = Array.isArray(offers)
        ? offers
        : offers
          ? [offers]
          : [];
      for (const offer of offerList) {
        if (!offer || typeof offer !== "object") continue;
        const offerRecord = offer as Record<string, unknown>;
        const parsed = parseMachineNumber(
          offerRecord.price ?? offerRecord.lowPrice ?? offerRecord.highPrice,
        );
        if (parsed > 0) {
          price = parsed;
          if (typeof offerRecord.priceCurrency === "string") {
            currency = offerRecord.priceCurrency;
          }
          break;
        }
      }
      if (price === 0 && record.price != null) {
        const parsed = parseMachineNumber(record.price);
        if (parsed > 0) {
          price = parsed;
          if (typeof record.priceCurrency === "string") {
            currency = record.priceCurrency;
          }
        }
      }
    }
  });
  if (price > 0) stage = "json-ld";

  // 2. Meta tags Open Graph.
  if (price === 0) {
    const metaPrice =
      $("meta[property='product:price:amount']").attr("content") ||
      $("meta[property='og:price:amount']").attr("content");
    const parsed = parseMachineNumber(metaPrice);
    if (parsed > 0) {
      price = parsed;
      stage = "meta-og";
      currency =
        $("meta[property='product:price:currency']").attr("content") ||
        $("meta[property='og:price:currency']").attr("content") ||
        currency;
    }
  }

  // 3. Meta itemprop="price".
  if (price === 0) {
    const parsed = parseMachineNumber(
      $("meta[itemprop='price']").attr("content"),
    );
    if (parsed > 0) {
      price = parsed;
      stage = "meta-itemprop";
    }
  }

  // 4. itemprop="price" no corpo (content/value/texto).
  if (price === 0) {
    const element = $("[itemprop='price']").first();
    const parsed =
      parseMachineNumber(element.attr("content") || element.attr("value")) ||
      parsePrice(element.text());
    if (parsed > 0) {
      price = parsed;
      stage = "itemprop-element";
    }
  }

  // 5. __NEXT_DATA__ / __INITIAL_STATE__ — SPAs Next.js / SSR (Magalu novo,
  //    gsuplementos, integralmedica). O JSON serializado tem o preço no
  //    pageProps em algum nível.
  if (price === 0) {
    const nextDataRaw =
      $("script#__NEXT_DATA__").first().text() ||
      $("script#__NUXT_DATA__").first().text();
    if (nextDataRaw) {
      try {
        const found = deepFindPrice(JSON.parse(nextDataRaw));
        if (found) {
          price = found.price;
          currency = currency ?? found.currency;
          stage = "next-data";
        }
      } catch {
        /* json inválido — ignora */
      }
    }
  }

  // 6. data-attributes comuns em e-commerces (Magalu antigo, VTEX, etc.).
  if (price === 0) {
    const selectors = [
      "[data-price]",
      "[data-product-price]",
      "[data-testid*='price' i]",
      "[data-cy*='price' i]",
      "[data-qa*='price' i]",
    ];
    for (const sel of selectors) {
      const el = $(sel).first();
      if (el.length === 0) continue;
      const attrVal =
        el.attr("data-price") ||
        el.attr("data-product-price") ||
        el.attr("content");
      const parsed = parseMachineNumber(attrVal) || parsePrice(el.text());
      if (parsed > 0) {
        price = parsed;
        stage = "data-attribute";
        break;
      }
    }
  }

  // 7. Classes comuns de preço (Amazon BR, VTEX, lojas genéricas).
  if (price === 0) {
    const selectors = [
      ".a-price .a-offscreen", // Amazon
      ".andes-money-amount__fraction", // Mercado Livre
      ".price-tag-fraction", // Mercado Livre antigo
      ".product-price", // genérico
      ".sales-price",
      ".current-price",
      ".price-value",
      ".preco-de-por .preco",
      ".price__sales-value",
      ".vtex-product-price-1-x-sellingPriceValue",
      ".price",
      ".preco",
      "[class*='price' i]",
      "[class*='preco' i]",
    ];
    for (const sel of selectors) {
      const el = $(sel).first();
      if (el.length === 0) continue;
      const parsed = parsePrice(el.text());
      if (parsed > 0) {
        price = parsed;
        stage = "css-class";
        break;
      }
    }
  }

  // 8. Fallback final: regex de R$ no HTML cru.
  if (price === 0) {
    const parsed = extractByRegex(html);
    if (parsed > 0) {
      price = parsed;
      stage = "regex-html";
    }
  }

  if (!title) {
    title =
      $("meta[property='og:title']").attr("content") ||
      $("title").first().text().trim() ||
      undefined;
  }

  return { price, currency, title, stage };
}

/**
 * Abre o link de um produto e tenta ler o preço atual. Tenta primeiro um
 * fetch simples (rápido); se não achar preço, cai pro browser headless
 * (lojas com muito JS / anti-bot). A allowlist de hosts é a mesma da
 * busca — host fora dela retorna ok:false com mensagem amigável.
 */
export async function fetchCurrentPriceFromUrl(
  rawUrl: string,
): Promise<PriceFromUrlResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: "Link inválido." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Link inválido." };
  }
  if (!isShoppingHostAllowed(rawUrl)) {
    return {
      ok: false,
      error: `Leitura automática ainda não é suportada para ${parsed.hostname}.`,
    };
  }

  const sourceName = prettifyStoreHost(parsed.hostname.toLowerCase());
  let lastHttpStatus: number | undefined;
  let lastHtmlBytes = 0;

  // 1. Fetch simples (rápido).
  try {
    const response = await axios.get<string>(rawUrl, {
      timeout: 12000,
      maxRedirects: 5,
      responseType: "text",
      headers: {
        "User-Agent": shuffledUserAgents()[0],
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      validateStatus: (status) => status >= 200 && status < 400,
      // SSRF: valida CADA hop de redirect contra a allowlist, não só o
      // host final. Sem isto, uma página de host permitido podia redirecionar
      // 302 pra http://169.254.169.254/... (metadata) ou hosts internos —
      // o servidor já teria feito o request antes da revalidação do finalUrl.
      beforeRedirect: (options: {
        protocol?: string;
        host?: string;
        hostname?: string;
        path?: string;
        href?: string;
      }) => {
        const nextUrl =
          options.href ||
          `${options.protocol || "https:"}//${
            options.host || options.hostname || ""
          }${options.path || ""}`;
        if (!isShoppingHostAllowed(nextUrl)) {
          throw new Error(
            `Redirect bloqueado para host não permitido: ${
              options.hostname || options.host || "desconhecido"
            }`,
          );
        }
      },
    });
    lastHttpStatus = response.status;
    const html =
      typeof response.data === "string" ? response.data : "";
    lastHtmlBytes = html.length;
    // Revalida o host final (defesa contra open-redirect cross-domain).
    const finalUrl = (response.request?.res?.responseUrl as string) || rawUrl;
    if (isShoppingHostAllowed(finalUrl)) {
      const { price, currency, title, stage } =
        extractProductPriceFromHtml(html);
      if (price > 0) {
        return {
          ok: true,
          price,
          currency,
          title,
          sourceName,
          finalUrl,
          fetchMode: "axios",
          stage,
          httpStatus: lastHttpStatus,
          htmlBytes: lastHtmlBytes,
        };
      }
    }
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "response" in error &&
      error.response &&
      typeof error.response === "object" &&
      "status" in error.response
    ) {
      lastHttpStatus = Number(
        (error.response as { status: unknown }).status,
      );
    }
  }

  // 2. Browser headless (JS-pesado / anti-bot). fetchRenderedHtml já
  //    reforça a allowlist e bloqueia redirect de navegação pra fora.
  try {
    const { html, finalUrl } = await fetchRenderedHtml(rawUrl, {
      timeoutMs: 25000,
      waitAfterLoadMs: 2000,
    });
    lastHtmlBytes = html.length;
    const { price, currency, title, stage } = extractProductPriceFromHtml(html);
    if (price > 0) {
      return {
        ok: true,
        price,
        currency,
        title,
        sourceName,
        finalUrl,
        fetchMode: "playwright",
        stage,
        htmlBytes: lastHtmlBytes,
      };
    }
    return {
      ok: false,
      sourceName,
      fetchMode: "playwright",
      stage: "none",
      htmlBytes: lastHtmlBytes,
      error: "Não encontrei o preço nessa página (HTML carregou).",
    };
  } catch (error) {
    return {
      ok: false,
      sourceName,
      fetchMode: "playwright",
      httpStatus: lastHttpStatus,
      htmlBytes: lastHtmlBytes,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível ler a página agora.",
    };
  }
}
