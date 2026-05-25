#!/usr/bin/env node
/**
 * One-off import: parse "MERCADO + SUPLEMENTOS" sheet of
 * TODAS AS PLANILHAS (2).xlsx and write into the user's shopping
 * modules in KV.
 *
 * Two scopes:
 *   • market: rows 1–6 (top — physical purchases at Tenda Atacado)
 *             + rows 10–28 (bottom — online stores, link kept).
 *   • supplements: only the user-specified subset — WHEY, CREATINA,
 *                  VITAMINA C, NAC, VITAMINA E, GLICINA, VOEXTOR.
 *
 * Strategy:
 *   - Match by normalized name against existing items.
 *     - Existing item → patch manualUnitPrice, monthlyUnits,
 *       referenceUrl, purchaseMode = "presential" (so price sticks),
 *       localStoreName for the physical-store rows.
 *     - New item → create one with quantity guessed from product name
 *       (falls back to the "Quantidade ou Gramas" column).
 *   - DOES NOT delete existing items the user already had (e.g. other
 *     supplements like Ioimbina, Citrus Aurantium etc. stay put).
 *   - All imported items: includeInFinance = true. The shopping-sync
 *     reducer will recompute "Mercado sincronizado" / "Suplementos
 *     sincronizados" finance lines automatically on the next hydrate.
 *
 * Env: KV_REST_API_URL + KV_REST_API_TOKEN
 * Run: node scripts/import-shopping-mercado-suplementos.mjs
 */

import XLSX from "xlsx";

const KV_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const userId = process.env.USERID || process.env.PRAXIS_USERID;

if (!KV_URL || !KV_TOKEN) {
  console.error("Missing KV creds.");
  process.exit(1);
}

const XLSX_PATH =
  process.env.PRAXIS_FINANCE_XLSX ||
  "C:/Users/Usuario/Downloads/TODAS AS PLANILHAS (2).xlsx";

const SHEET = "MERCADO + SUPLEMENTOS";

function normalizeName(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

async function kvGet(key) {
  const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!r.ok) throw new Error(`KV get failed: ${r.status}`);
  const { result } = await r.json();
  return result ? JSON.parse(result) : null;
}

async function kvSet(key, value) {
  const r = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "text/plain",
    },
    body: JSON.stringify(value),
  });
  if (!r.ok) throw new Error(`KV set failed: ${r.status}`);
}

async function kvKeys(pattern) {
  const r = await fetch(`${KV_URL}/keys/${encodeURIComponent(pattern)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!r.ok) throw new Error(`KV keys failed: ${r.status}`);
  const { result } = await r.json();
  return result ?? [];
}

const makeId = (prefix) =>
  `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;

let resolvedUserId = userId;
if (!resolvedUserId) {
  const keys = await kvKeys("praxis:account-state:*");
  if (keys.length === 1) {
    resolvedUserId = keys[0].replace(/^praxis:account-state:/, "");
    console.log(`USERID not set — using ${resolvedUserId}`);
  } else {
    console.error(`USERID not set, KV has ${keys.length} accounts.`);
    process.exit(1);
  }
}

const wb = XLSX.readFile(XLSX_PATH, { cellDates: true });
const sheet = wb.Sheets[SHEET];
if (!sheet) {
  console.error(`Sheet "${SHEET}" not found.`);
  process.exit(2);
}
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

// Sheet layout (column index):
//   0 = link/URL (or marker like "SUPLEMENTOS" for headers)
//   1 = "hora de usar"
//   2 = "Categoria"
//   3 = product name (this is the key field)
//   4 = preço unitário
//   5 = Quantidade ou Gramas
//   6 = total mensal que preciso
//   7 = quantos comprar?  ← monthlyUnits
//   8 = preço total

/** Try to extract a quantity like "500g", "1 kg", "60 caps" from the
 *  product name. Falls back to the raw column-5 value. */
function inferQuantity(name, rawCol5) {
  if (typeof name === "string") {
    const m = name.match(
      /(\d+(?:[,.]\d+)?)\s*(kg|g|mg|mcg|ml|l|caps?|cápsulas?|comprimidos?|unidades?|un|sach[eê]s?)\b/i,
    );
    if (m) {
      const num = m[1].replace(",", ".");
      const unit = m[2].toLowerCase().replace(/ê/, "e");
      const normalized = unit.startsWith("cap")
        ? "caps"
        : unit.startsWith("cápsul") || unit.startsWith("capsul")
          ? "caps"
          : unit.startsWith("comprimido")
            ? "comprimidos"
            : unit.startsWith("unidad") || unit === "un"
              ? "un"
              : unit.startsWith("sach")
                ? "sachês"
                : unit;
      return `${num} ${normalized}`;
    }
  }
  if (rawCol5 != null && Number.isFinite(Number(rawCol5))) {
    return `${rawCol5} un`;
  }
  return "1 un";
}

function buildItem({ row, scope, purchaseMode, localStoreName }) {
  const link = typeof row[0] === "string" ? row[0].trim() : "";
  const name = typeof row[3] === "string" ? row[3].trim() : "";
  const unitPrice = Number(row[4]);
  const rawCol5 = row[5];
  const monthlyUnits = Number(row[7]);

  return {
    name,
    brand: "",
    quantity: inferQuantity(name, rawCol5),
    dailyDose: 1,
    monthlyUnits:
      Number.isFinite(monthlyUnits) && monthlyUnits > 0 ? monthlyUnits : 1,
    includeInFinance: true,
    purchaseMode,
    localStoreName: localStoreName ?? undefined,
    manualUnitPrice:
      Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : undefined,
    referenceUrl: link.startsWith("http") ? link : undefined,
  };
}

// Top section — physical purchases at "Tenda Atacado".
// Header is row 0; "MERCADO TOTAL MENSAL" is row 8. So rows 1..6 are
// products.
const marketPhysical = [];
for (let i = 1; i <= 6; i++) {
  const row = rows[i];
  if (!row || !row[3]) continue;
  marketPhysical.push(
    buildItem({
      row,
      scope: "market",
      purchaseMode: "presential",
      localStoreName: "Tenda Atacado",
    }),
  );
}

// Bottom section — online stores, rows 10..28.
const marketOnline = [];
for (let i = 10; i <= 28; i++) {
  const row = rows[i];
  if (!row || !row[3]) continue;
  // The "compras online TOTAL MENSAL" footer sits in row 30.
  marketOnline.push(
    buildItem({
      row,
      scope: "market",
      // The user said "comprados pela internet", but our shopping
      // module's "online" mode discards manualUnitPrice (it expects
      // live search results to provide it). We use "presential" so the
      // xlsx price sticks. The referenceUrl preserves the source link.
      purchaseMode: "presential",
      localStoreName: undefined,
    }),
  );
}

// Supplements — only the 7 the user named.
// Match against rows 33..67 by normalized name fragment.
const SUPP_KEYWORDS = [
  { match: "whey", label: "WHEY" },
  { match: "creatina", label: "CREATINA" },
  { match: "vitamina c", label: "VITAMINA C" },
  { match: "nac", label: "NAC" },
  { match: "vitamina e", label: "VITAMINA E" },
  { match: "glicina", label: "GLICINA" },
  { match: "voextor", label: "VOEXTOR" },
];

const suppRows = [];
for (let i = 33; i <= 67; i++) {
  const row = rows[i];
  if (!row || !row[3]) continue;
  const normalized = normalizeName(row[3]);
  // Skip the second VITAMINA E entry (the one that is actually
  // calcio+vitD+vitK — a labeling mistake in the spreadsheet). Pick the
  // pure VITAMINA E from gsuplementos.com.br.
  if (
    normalized.includes("vitamina e") &&
    typeof row[0] === "string" &&
    row[0].includes("calcio-vitamina-d-vitamina-k")
  ) {
    continue;
  }
  for (const kw of SUPP_KEYWORDS) {
    if (normalized.includes(kw.match)) {
      suppRows.push({ row, label: kw.label });
      break;
    }
  }
}

const supplementsToImport = suppRows.map(({ row }) =>
  buildItem({
    row,
    scope: "supplements",
    purchaseMode: "presential",
    localStoreName: undefined,
  }),
);

console.log(`Parsed market physical: ${marketPhysical.length}`);
console.log(`Parsed market online: ${marketOnline.length}`);
console.log(`Parsed supplements: ${supplementsToImport.length}`);
console.log("");

// Pull state, patch items, save.
const KEY = `praxis:account-state:${resolvedUserId}`;
const envelope = await kvGet(KEY);
if (!envelope) {
  console.error(`No account state for ${resolvedUserId}.`);
  process.exit(3);
}
const state = envelope.state;

function upsertItems(currentItems, incoming) {
  const indexByName = new Map();
  for (let i = 0; i < currentItems.length; i++) {
    indexByName.set(normalizeName(currentItems[i].name), i);
  }

  const result = currentItems.map((item) => ({ ...item }));
  const created = [];
  const updated = [];

  for (const inc of incoming) {
    const key = normalizeName(inc.name);
    const existingIdx = indexByName.get(key);
    const nowIso = new Date().toISOString();

    if (existingIdx != null) {
      const prev = result[existingIdx];
      result[existingIdx] = {
        ...prev,
        // Adopt the spreadsheet values.
        manualUnitPrice: inc.manualUnitPrice ?? prev.manualUnitPrice,
        monthlyUnits: inc.monthlyUnits ?? prev.monthlyUnits,
        referenceUrl: inc.referenceUrl ?? prev.referenceUrl,
        purchaseMode: "presential",
        localStoreName: inc.localStoreName ?? prev.localStoreName,
        includeInFinance: true,
        updatedAt: nowIso,
      };
      updated.push(inc.name);
    } else {
      const item = {
        id: makeId("shopping-item"),
        ...inc,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      result.push(item);
      created.push(inc.name);
    }
  }

  return { result, created, updated };
}

if (!state.shoppingModules) {
  state.shoppingModules = {};
}
if (!state.shoppingModules.market) {
  state.shoppingModules.market = { items: [], snapshots: {} };
}
if (!state.shoppingModules.supplements) {
  state.shoppingModules.supplements = { items: [], snapshots: {} };
}

const marketAll = [...marketPhysical, ...marketOnline];
const marketResult = upsertItems(
  state.shoppingModules.market.items ?? [],
  marketAll,
);
state.shoppingModules.market.items = marketResult.result;

const suppResult = upsertItems(
  state.shoppingModules.supplements.items ?? [],
  supplementsToImport,
);
state.shoppingModules.supplements.items = suppResult.result;

await kvSet(KEY, {
  version: (typeof envelope.version === "number" ? envelope.version : 1) + 1,
  updatedAt: new Date().toISOString(),
  state,
});

console.log("=== MARKET ===");
console.log(`Created ${marketResult.created.length}:`);
for (const n of marketResult.created) console.log(`  + ${n}`);
console.log(`Updated ${marketResult.updated.length}:`);
for (const n of marketResult.updated) console.log(`  ~ ${n}`);
console.log("");
console.log("=== SUPPLEMENTS ===");
console.log(`Created ${suppResult.created.length}:`);
for (const n of suppResult.created) console.log(`  + ${n}`);
console.log(`Updated ${suppResult.updated.length}:`);
for (const n of suppResult.updated) console.log(`  ~ ${n}`);
