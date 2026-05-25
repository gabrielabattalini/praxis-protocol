#!/usr/bin/env node
/**
 * Emergency restore: recreate the user's "Pacho ABC" diet plan +
 * meal blocks + items + daily nutrition targets after a stale
 * browser save wiped state.dietPlans / state.mealPlan / etc.
 *
 * Idempotent: if "Pacho ABC" already exists, the script reuses its
 * id; if meal blocks for each category already exist, items just get
 * appended (already-present items skipped by label).
 *
 * Env: KV_REST_API_URL + KV_REST_API_TOKEN
 * Run: node scripts/restore-diet-structure-pacho.mjs
 */

const KV_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
let userId = process.env.USERID || process.env.PRAXIS_USERID;

if (!KV_URL || !KV_TOKEN) {
  console.error("Missing KV creds.");
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
    console.log(`USERID auto-detected: ${userId}`);
  } else {
    console.error(`USERID not set; KV has ${keys.length} accounts.`);
    process.exit(1);
  }
}

const makeId = (prefix) =>
  `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;

const macros = (protein, carbs, fat, fiber, sodium, calories) => ({
  protein,
  carbs,
  fat,
  fiber,
  sodium,
  calories,
});
const Z = macros(0, 0, 0, 0, 0, 0);

// Default meal block structure with reasonable times based on the
// xlsx "Dieta" sheet (Jejum 11:00, Café 12:30, Almoço 16:00, Intra
// 19:00, Antes de dormir 22:00).
const MEAL_BLOCKS = [
  { category: "fasting", title: "Jejum", time: "11:00" },
  { category: "breakfast", title: "Café da Manhã", time: "12:30" },
  { category: "lunch", title: "Almoço", time: "16:00" },
  { category: "intra", title: "Intra-treino", time: "19:00" },
  { category: "dinner", title: "Antes de dormir", time: "22:00" },
];

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
    { kind: "food", label: "Proteína (acém ou atum)", quantityLabel: "200 g acém cru / 170 g atum sólido", macros: macros(39.6, 0, 11, 0, 99, 256) },
    { kind: "food", label: "Carboidrato (dia high / low)", quantityLabel: "160 g (high) / 80 g (low)", macros: macros(6.6, 62, 0.6, 0, 535, 287) },
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
    { kind: "food", label: "Proteína (acém ou atum)", quantityLabel: "200 g acém cru / 170 g atum sólido", macros: macros(39.6, 0, 11, 0, 99, 256) },
    { kind: "food", label: "Carboidrato (dia high / low)", quantityLabel: "160 g (high) / 80 g (low)", macros: macros(6.6, 62, 0.6, 0, 535, 287) },
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

const KEY = `praxis:account-state:${userId}`;
const envelope = await kvGet(KEY);
if (!envelope) {
  console.error(`No account state for ${userId}.`);
  process.exit(2);
}
const state = envelope.state;

// 1) Build the meal blocks (reuse existing block by category if present).
if (!Array.isArray(state.mealPlan)) state.mealPlan = [];
const existingByCategory = new Map(
  state.mealPlan
    .filter((b) => b && typeof b.category === "string")
    .map((b) => [b.category, b]),
);
const nextMealPlan = MEAL_BLOCKS.map((spec) => {
  const existing = existingByCategory.get(spec.category);
  return existing
    ? { ...existing, title: spec.title, time: spec.time }
    : {
        id: makeId("meal-block"),
        title: spec.title,
        time: spec.time,
        category: spec.category,
        items: [],
      };
}).sort((a, b) => a.time.localeCompare(b.time));

// 2) Append items per category (skip duplicates by lowercased label).
let totalAdded = 0;
for (const block of nextMealPlan) {
  const seeds = itemsByCategory[block.category] ?? [];
  if (!Array.isArray(block.items)) block.items = [];
  const seenLabels = new Set(
    block.items
      .map((it) => (typeof it?.label === "string" ? it.label.trim().toLowerCase() : ""))
      .filter(Boolean),
  );
  for (const item of seeds) {
    const key = item.label.trim().toLowerCase();
    if (seenLabels.has(key)) continue;
    block.items.push({
      id: makeId("meal-item"),
      label: item.label,
      quantityLabel: item.quantityLabel,
      kind: item.kind,
      macros: item.macros,
    });
    seenLabels.add(key);
    totalAdded += 1;
  }
}

state.mealPlan = nextMealPlan;

// 3) Reasonable daily nutrition targets — pulled from the diet flow's
//    standard defaults so the "Leitura detalhada" panel has something
//    to compare against. User can tweak in /modules/nutrition.
if (!state.dailyNutritionTargets) {
  state.dailyNutritionTargets = {
    bodyWeightKg: 80,
    bodyHeightCm: 175,
    ageYears: 30,
    biologicalSex: "male",
    basalMetabolicRate: 1800,
    basalMetabolicRateSource: "mifflin-st-jeor",
    goalAdjustmentKcal: 0,
    waterMlPerKg: 35,
    proteinPerKg: 2,
    carbsPerKg: 3,
    fatPerKg: 0.8,
    sodiumLimitMg: 2300,
    fiberStrategy: "perKg",
    fiberPerKg: 0.35,
    fiberRatioGrams: 14,
    fiberRatioCalories: 1000,
    totals: {
      calories: 2400,
      protein: 160,
      carbs: 240,
      fat: 64,
      fiber: 28,
      sodium: 2300,
      water: 2800,
    },
  };
}

// 4) Recreate the "Pacho ABC" diet plan wrapping these blocks.
if (!Array.isArray(state.dietPlans)) state.dietPlans = [];
const existingPlan = state.dietPlans.find((p) => p && p.name === "Pacho ABC");
const planId = existingPlan ? existingPlan.id : makeId("diet");
const nextPlan = {
  id: planId,
  name: "Pacho ABC",
  createdAt: existingPlan?.createdAt ?? new Date().toISOString(),
  mealPlan: nextMealPlan.map((b) => ({
    ...b,
    items: b.items.map((it) => ({
      ...it,
      completed: false,
      completedAt: undefined,
    })),
  })),
  nutritionGoal: existingPlan?.nutritionGoal ?? "maintain",
  nutritionTargets: state.dailyNutritionTargets,
  dayTypes: existingPlan?.dayTypes ?? {
    monday: "high",
    tuesday: "low",
    wednesday: "high",
    thursday: "low",
    friday: "high",
    saturday: "low",
    sunday: "low",
  },
  workoutLinkSettings: existingPlan?.workoutLinkSettings ?? {
    enabled: false,
    workoutDayType: "high",
    restDayType: "low",
  },
  foodSubstitutions: existingPlan?.foodSubstitutions ?? [],
};
state.dietPlans = existingPlan
  ? state.dietPlans.map((p) => (p.id === planId ? nextPlan : p))
  : [nextPlan, ...state.dietPlans];

state.activeDietPlanId = planId;
state.nutritionGoal = nextPlan.nutritionGoal;

await kvSet(KEY, {
  version: (typeof envelope.version === "number" ? envelope.version : 1) + 1,
  updatedAt: new Date().toISOString(),
  state,
});

console.log(
  `Restored "Pacho ABC" (id=${planId}) with ${nextMealPlan.length} meal blocks.`,
);
console.log(`Added ${totalAdded} items across blocks:`);
for (const b of nextMealPlan) {
  console.log(`  ${b.time} ${b.title} (${b.category}) — ${b.items.length} items`);
}
