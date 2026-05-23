#!/usr/bin/env node
/**
 * One-off import: take the foods/supplements parsed from the user's
 * "TODAS AS PLANILHAS - Dieta.pdf" and append them to the matching
 * meal blocks already present in the account state. Blocks are matched
 * by `category`. Items already present in a block (by label,
 * case-insensitive) are skipped, so re-running is safe.
 *
 * Env:
 *   KV_REST_API_URL + KV_REST_API_TOKEN  (Upstash REST creds)
 *   USERID                                (Clerk user id; the script
 *                                          will pick the only key in
 *                                          KV if unset and there's just
 *                                          one)
 *
 * Run:  node scripts/import-diet-pdf-items.mjs
 */

// Env is expected to be sourced by the caller (e.g. set -a; . ./.env.local).
// Avoiding dotenv because it's not in the script-only dependency set.

const KV_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
let userId = process.env.USERID || process.env.PRAXIS_USERID;

if (!KV_URL || !KV_TOKEN) {
  console.error("Missing KV creds (KV_REST_API_URL + KV_REST_API_TOKEN).");
  process.exit(1);
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

if (!userId) {
  const keys = await kvKeys("praxis:account-state:*");
  if (keys.length === 1) {
    userId = keys[0].replace(/^praxis:account-state:/, "");
    console.log(`USERID not set — using the only account key: ${userId}`);
  } else {
    console.error(
      `USERID not set and KV has ${keys.length} account keys; specify USERID env.`,
    );
    process.exit(1);
  }
}

const macros = (protein, carbs, fat, fiber, sodium, calories) => ({
  protein,
  carbs,
  fat,
  fiber,
  sodium,
  calories,
});
const Z = macros(0, 0, 0, 0, 0, 0);

// Items per meal category, faithfully reproduced from the PDF. Macros
// are taken straight from the spreadsheet's per-row columns
// (PROTEÍNA / CARBO / GORDURA / FIBRAS / SÓDIO / Kcal). Supplements
// without macro data in the PDF get all-zero macros.
const itemsByCategory = {
  fasting: [
    { kind: "supplement", label: "Ioimbina", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "Picolinato de Cromo", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "Citrus Aurantium", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "Complexo Probiótico", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "SAMe 200mg", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "Rhodiola Rosea 300mg", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "L-Carnitina", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "N Acetilcisteína (NAC) 600", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "Berberina 500mg", quantityLabel: "1 caps", macros: Z },
  ],
  breakfast: [
    { kind: "supplement", label: "Whey Protein", quantityLabel: "55 g", macros: macros(38.5, 10.8, 3.5, 0, 89, 229.2) },
    { kind: "supplement", label: "Creatina", quantityLabel: "10 g", macros: Z },
    { kind: "supplement", label: "Psyllium", quantityLabel: "5 g", macros: macros(0, 0.55, 0.1, 4.05, 0, 9) },
    { kind: "supplement", label: "Multivitamínico", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "Beta-Alanina em pó", quantityLabel: "3 g", macros: Z },
    { kind: "supplement", label: "Ácido Alfa Lipóico 300mg", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "Vitamina C 1G", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "L-Tirosina 500mg", quantityLabel: "1 caps", macros: Z },
  ],
  lunch: [
    {
      kind: "food",
      label: "Proteína (acém ou atum)",
      quantityLabel: "200 g acém cru / 170 g atum sólido",
      macros: macros(39.6, 0, 11, 0, 99, 256),
    },
    {
      kind: "food",
      label: "Carboidrato (dia high / low)",
      quantityLabel: "160 g (high) / 80 g (low)",
      macros: macros(6.6, 62, 0.6, 0, 535, 287),
    },
    { kind: "food", label: "Ketchup", quantityLabel: "100 g", macros: macros(0, 25, 0, 0, 665, 99) },
    { kind: "food", label: "Alface", quantityLabel: "35 g", macros: macros(0.14, 0.52, 0.04, 0.43, 2.08, 2) },
    { kind: "food", label: "Tomate", quantityLabel: "50 g", macros: macros(0.52, 1.91, 0.09, 0.8, 1.56, 9) },
  ],
  intra: [
    { kind: "supplement", label: "Dextrose", quantityLabel: "20 g", macros: Z },
    { kind: "supplement", label: "Hidraplex", quantityLabel: "7 g", macros: Z },
    { kind: "supplement", label: "Glicerina", quantityLabel: "10 ml", macros: Z },
  ],
  dinner: [
    {
      kind: "food",
      label: "Proteína (acém ou atum)",
      quantityLabel: "200 g acém cru / 170 g atum sólido",
      macros: macros(39.6, 0, 11, 0, 99, 256),
    },
    {
      kind: "food",
      label: "Carboidrato (dia high / low)",
      quantityLabel: "160 g (high) / 80 g (low)",
      macros: macros(6.6, 62, 0.6, 0, 535, 287),
    },
    { kind: "food", label: "Ketchup", quantityLabel: "100 g", macros: macros(0, 25, 0, 0, 665, 99) },
    { kind: "food", label: "Alface", quantityLabel: "35 g", macros: macros(0.14, 0.52, 0.04, 0.43, 2.08, 2) },
    { kind: "food", label: "Tomate", quantityLabel: "50 g", macros: macros(0.52, 1.91, 0.09, 0.8, 1.56, 9) },
    { kind: "supplement", label: "Vitamina D Ultra", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "Ashwagandha + Melissa + Passiflora + Kawa Kawa", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "Ômega 3", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "Cúrcuma 450mg", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "Vitamina E", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "5-HTP", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "L-Teanina 200mg", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "Mucuna 400mg", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "Gaba 400mg", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "Glicina 3G", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "Valeriana 100mg", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "Esomeprazol 20mg", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "Tadalafila 5mg", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "Betaína + Pepsina", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "Bacopa Monnieri 250mg", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "Complexo de Enzima Digestiva", quantityLabel: "1 caps", macros: Z },
    { kind: "supplement", label: "Ginkgo Biloba 120mg", quantityLabel: "1 caps", macros: Z },
  ],
};

function makeItemId() {
  return `meal-item-pdf-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

const KEY = `praxis:account-state:${userId}`;
const envelope = await kvGet(KEY);
if (!envelope) {
  console.error(`No account state found for ${userId}.`);
  process.exit(2);
}

const state = envelope.state;
if (!state || typeof state !== "object" || !Array.isArray(state.mealPlan)) {
  console.error("State has no mealPlan array.");
  process.exit(3);
}

const report = [];
let totalAdded = 0;
let totalSkipped = 0;

for (const [category, items] of Object.entries(itemsByCategory)) {
  const block = state.mealPlan.find((b) => b && b.category === category);
  if (!block) {
    report.push(`[skip] no block with category=${category}`);
    continue;
  }
  if (!Array.isArray(block.items)) block.items = [];

  const existing = new Set(
    block.items
      .map((it) => (typeof it?.label === "string" ? it.label.trim().toLowerCase() : ""))
      .filter(Boolean),
  );

  let added = 0;
  let skipped = 0;
  for (const item of items) {
    const key = item.label.trim().toLowerCase();
    if (existing.has(key)) {
      skipped++;
      continue;
    }
    block.items.push({
      id: makeItemId(),
      label: item.label,
      quantityLabel: item.quantityLabel,
      kind: item.kind,
      macros: item.macros,
    });
    existing.add(key);
    added++;
  }
  totalAdded += added;
  totalSkipped += skipped;
  report.push(
    `[${block.title} · ${category}] +${added} added · ${skipped} skipped (already present)`,
  );
}

console.log(report.join("\n"));
console.log(`\nTotal: +${totalAdded} added · ${totalSkipped} skipped.`);

if (totalAdded === 0) {
  console.log("Nothing to write. KV untouched.");
  process.exit(0);
}

await kvSet(KEY, {
  version: (typeof envelope.version === "number" ? envelope.version : 1) + 1,
  updatedAt: new Date().toISOString(),
  state,
});
console.log("State saved.");
