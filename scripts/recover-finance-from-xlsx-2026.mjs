#!/usr/bin/env node
/**
 * Recovery: rebuild the user's finance-line monthly values for the
 * 2026 sheet after the close-month bug (commit 5306246) zeroed out
 * every month of every fixed-frequency line.
 *
 * Source of truth: the "2026" sheet of TODAS AS PLANILHAS.xlsx (jun-dec).
 *
 * Strategy:
 *   - Only restore lines whose sourceKey starts with "xlsx-import-2026:"
 *     (plus the special "em-conta-fixed" income line). Those have clear
 *     provenance from the spreadsheet. The user also has duplicate
 *     in-app lines with the same names — those stay at 0 and can be
 *     deleted later if the user wants.
 *   - Match by normalized line name to the spreadsheet row.
 *   - Write directly to KV (one PUT, no client roundtrip).
 *
 * Env: KV_REST_API_URL + KV_REST_API_TOKEN
 * Run: node scripts/recover-finance-from-xlsx-2026.mjs
 */

import XLSX from "xlsx";

const KV_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const userId = process.env.USERID || process.env.PRAXIS_USERID;

if (!KV_URL || !KV_TOKEN) {
  console.error("Missing KV creds (KV_REST_API_URL + KV_REST_API_TOKEN).");
  process.exit(1);
}

const XLSX_PATH =
  process.env.PRAXIS_FINANCE_XLSX ||
  "C:/Users/Usuario/Downloads/TODAS AS PLANILHAS.xlsx";

const FINANCE_MONTH_ORDER = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

// "2026" sheet has only jun-dec. Jan-May stay at 0 for the year.
const SHEET_2026_COLUMNS = [
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

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

let resolvedUserId = userId;
if (!resolvedUserId) {
  const keys = await kvKeys("praxis:account-state:*");
  if (keys.length === 1) {
    resolvedUserId = keys[0].replace(/^praxis:account-state:/, "");
    console.log(`USERID not set — using the only account: ${resolvedUserId}`);
  } else {
    console.error(`USERID not set; KV has ${keys.length} account keys.`);
    process.exit(1);
  }
}

// 1) Parse the spreadsheet
const wb = XLSX.readFile(XLSX_PATH, { cellDates: true });
if (!wb.Sheets["2026"]) {
  console.error('Sheet "2026" not found in xlsx.');
  process.exit(2);
}
const sheet2026 = XLSX.utils.sheet_to_json(wb.Sheets["2026"], {
  header: 1,
  defval: null,
});

// Find the row containing the month header so we know which columns
// map to jun-dec.
const headerRowIdx = sheet2026.findIndex(
  (row) =>
    Array.isArray(row) &&
    row.some(
      (cell) =>
        typeof cell === "string" && normalizeName(cell) === "junho",
    ),
);
if (headerRowIdx === -1) {
  console.error("Could not locate the 'junho' header row in the 2026 sheet.");
  process.exit(3);
}
const headerRow = sheet2026[headerRowIdx];
const monthCol = {};
headerRow.forEach((cell, idx) => {
  const n = normalizeName(cell);
  if (n === "junho") monthCol.june = idx;
  if (n === "julho") monthCol.july = idx;
  if (n === "agosto") monthCol.august = idx;
  if (n === "setembro") monthCol.september = idx;
  if (n === "outubro") monthCol.october = idx;
  if (n === "novembro") monthCol.november = idx;
  if (n === "dezembro") monthCol.december = idx;
});

// Build a name → { jun..dec } map. Skip header/summary rows
// (Receita total, Resultado dos cartões, Gastos dinheiro, GASTO TOTAL,
//  RECEITA, Saldo de sobra).
const SKIP_NAMES = new Set(
  [
    "receita total",
    "resultado dos cartoes",
    "gastos dinheiro",
    "gasto total",
    "receita",
    "saldo de sobra",
  ].map((n) => normalizeName(n)),
);

const sheetByName = new Map();
for (let i = headerRowIdx + 1; i < sheet2026.length; i++) {
  const row = sheet2026[i];
  if (!Array.isArray(row)) continue;
  // The name lives in column 1 in this sheet (column 0 holds a "due day"
  // or marker symbol like "X").
  const rawName = row[1];
  const name = normalizeName(rawName);
  if (!name || SKIP_NAMES.has(name)) continue;
  const values = {};
  for (const month of SHEET_2026_COLUMNS) {
    const col = monthCol[month];
    if (col == null) continue;
    const cell = row[col];
    const num = typeof cell === "number" ? cell : Number(cell);
    values[month] = Number.isFinite(num) ? num : 0;
  }
  sheetByName.set(name, values);
}

console.log(`Sheet 2026: parsed ${sheetByName.size} budget lines.`);

// 2) Pull current state
const KEY = `praxis:account-state:${resolvedUserId}`;
const envelope = await kvGet(KEY);
if (!envelope) {
  console.error(`No account state for ${resolvedUserId}.`);
  process.exit(4);
}

const state = envelope.state;
if (!state?.financeBudget?.lines) {
  console.error("financeBudget.lines missing from state.");
  process.exit(5);
}

// 3) Patch only xlsx-imported lines (+ em-conta) that match by name
const RESTORE_PREFIXES = ["xlsx-import-2026:", "em-conta-fixed"];

let touched = 0;
const skipped = [];
const restored = [];
const nextLines = state.financeBudget.lines.map((line) => {
  const sourceKey = typeof line.sourceKey === "string" ? line.sourceKey : "";
  const isRestoreCandidate = RESTORE_PREFIXES.some(
    (prefix) => sourceKey === prefix || sourceKey.startsWith(prefix),
  );
  if (!isRestoreCandidate) {
    skipped.push(`${line.id} (${line.name}) — sourceKey '${sourceKey}'`);
    return line;
  }

  const match = sheetByName.get(normalizeName(line.name));
  if (!match) {
    skipped.push(`${line.id} (${line.name}) — no spreadsheet match`);
    return line;
  }

  const nextMonthly = {};
  for (const month of FINANCE_MONTH_ORDER) {
    nextMonthly[month] =
      month in match ? Math.round(match[month] * 100) / 100 : 0;
  }

  // Clamp settledAmounts to monthly so they stay valid.
  const settledAmounts = {};
  for (const month of FINANCE_MONTH_ORDER) {
    const prev = line.settledAmounts?.[month] ?? 0;
    settledAmounts[month] = Math.min(prev, nextMonthly[month]);
  }

  touched += 1;
  restored.push(
    `${line.name} (${line.frequency}/${line.kind}/${line.paymentMethod}) — ${SHEET_2026_COLUMNS.map((m) => nextMonthly[m]).join(", ")}`,
  );
  return {
    ...line,
    monthly: nextMonthly,
    settledAmounts,
  };
});

state.financeBudget.lines = nextLines;

await kvSet(KEY, {
  version: (typeof envelope.version === "number" ? envelope.version : 1) + 1,
  updatedAt: new Date().toISOString(),
  state,
});

console.log(`\nRestored ${touched} lines from the 2026 sheet:`);
for (const line of restored) console.log(`  ✓ ${line}`);
console.log(`\nSkipped ${skipped.length} lines:`);
for (const line of skipped.slice(0, 50)) console.log(`  · ${line}`);
if (skipped.length > 50) {
  console.log(`  · ...and ${skipped.length - 50} more`);
}
