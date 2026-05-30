#!/usr/bin/env node
/**
 * Re-import: replace the entire MARKET shopping scope with the 25
 * items from "TODAS AS PLANILHAS - MERCADO + SUPLEMENTOS.pdf",
 * ALL set as purchaseMode: "online" with link + price filled.
 *
 * The SUPLEMENTOS section of the PDF is intentionally skipped per
 * the user's request. The supplements scope in KV is left untouched.
 *
 * Env: KV_REST_API_URL + KV_REST_API_TOKEN
 * Run: node scripts/reimport-shopping-market-all-online.mjs
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

/** Try to extract a quantity like "500g", "1 kg", "60 caps" from the
 *  product name. Falls back to a generic "1 un". */
function inferQuantity(name) {
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
  return "1 un";
}

// 25 items lifted verbatim from the PDF (top "MERCADO" section +
// "compras online" section). Each gets purchaseMode: "online" and
// keeps the spreadsheet's unit price as manualUnitPrice (used as a
// fallback by the shopping module when there's no live offer yet).
const PDF_ITEMS = [
  // ── Top section (originally Tenda Atacado) ────────────────────
  { name: "Acem moido kg", url: "https://www.tendaatacado.com.br/produto/patinho-bifes-bandeja-400g?region_id=000018", price: 36.00, monthlyUnits: 9 },
  { name: "Pão de forma", url: "https://www.tendaatacado.com.br/produto/pao-de-forma-pullman-480g-149?region_id=000018", price: 7.00, monthlyUnits: 6 },
  { name: "Cebolinha Maço Unidade", url: "https://www.tendaatacado.com.br/produto/cebolinha-maco-925", price: 3.49, monthlyUnits: 1 },
  { name: "Refrigerante Coca-Cola Sem Açúcar 2,5L", url: "https://www.tendaatacado.com.br/produto/refrigerante-coca-cola-sem-acucar-2-5l", price: 11.69, monthlyUnits: 6 },
  { name: "Agua sanitaria 2l", url: "https://www.tendaatacado.com.br/produto/agua-sanitaria-select-2l-20208", price: 4.90, monthlyUnits: 0.5 },
  { name: "Sabão em Pó OMO Profissional Perfect White 4 kg", url: "https://www.tendaatacado.com.br/produto/lava-roupa-po-omo-sem-perf-clinical-4kg?region_id=000018", price: 43.79, monthlyUnits: 0.125 },

  // ── Bottom section (compras online: Amazon / MercadoLivre / Drogasil) ──
  { name: "Massa C/Ovos Cabelo De Anjo 500G", url: "https://www.amazon.com.br/Adria-Massa-Ovos-Cabelo-Anjo/dp/B095TR1YD2/ref=sr_1_9", price: 5.49, monthlyUnits: 1 },
  { name: "Desodorante Cremoso Herbissimo 55G Talco", url: "https://www.amazon.com.br/Dana-Desodorante-Cremoso-Herbissimo-Talco/dp/B0BZWBH41R/ref=sr_1_7_pp", price: 6.55, monthlyUnits: 3 },
  { name: "Finish Detergente para Lava Louças em pó 700g", url: "https://www.amazon.com.br/Detergente-para-Lavar-Lou%C3%A7as-Finish/dp/B0BZWZ2385/ref=sr_1_8", price: 32.69, monthlyUnits: 0.6428571429 },
  { name: "Dove Sabonete em Barra Pele Sensível 90g 6 Unidades", url: "https://www.amazon.com.br/Dove-Sabonete-Barra-Pele-Sens%C3%ADvel/dp/B0CXB8PTML/ref=sr_1_9", price: 21.00, monthlyUnits: 0.6666666667 },
  { name: "Comfort Amaciante Lavanderia Profissional Puro Cuidado 5 L", url: "https://www.amazon.com.br/Comfort-Puro-Cuidado-Amaciante/dp/B097QCVF1K/ref=sr_1_12", price: 49.90, monthlyUnits: 0.2 },
  { name: "Jimo Secante Abrilhantador – Frasco 250 ml", url: "https://www.amazon.com.br/Jimo-Secante-Abrilhantador-Frasco-250/dp/B0DJ382QWQ/ref=sr_1_3", price: 13.75, monthlyUnits: 0.5 },
  { name: "Papel Higiênico Personal Vip Folha Dupla", url: "https://www.amazon.com.br/Papel-Higi%C3%AAnico-Personal-Branco-pacote/dp/B07D5PH2YJ/ref=sr_1_9", price: 21.75, monthlyUnits: 1 },
  { name: "Azeite de Oliva Andorinha Extra Virgem Pet 2L", url: "https://www.amazon.com.br/gp/product/B0BHTL6DJ1/ref=ox_sc_act_title_1?smid=A1H992YLX3PNN1&psc=1", price: 97.37, monthlyUnits: 0.25 },
  { name: "Creme Dental Colgate Total 12 Gengiva Reforçada 180g", url: "https://www.drogasil.com.br/creme-dental-colgate-total-12-gengiva-reforcada-90g-891126.html", price: 14.64, monthlyUnits: 0.5 },
  { name: "Kit Siàge Men Shampo 250ml + Condicionador Hidratação 200ml", url: "https://www.mercadolivre.com.br/p/MLB28084038?pdp_filters=item_id%3AMLB3509025365#polycard_client=cart_list&wid=MLB3509025365&sid=cart", price: 70.00, monthlyUnits: 0.5 },
  { name: "Darrow Actine Sabonete Dermatológico em Barra 70g", url: "https://www.mercadolivre.com.br/p/MLB19907011?pdp_filters=item_id%3AMLB3863809312#polycard_client=cart_list&wid=MLB3863809312&sid=cart", price: 33.60, monthlyUnits: 1 },
  { name: "Kit Darrow Actine: Protetor Solar Facial FPS 60 Com Cor e Gel de Limpeza", url: "https://www.mercadolivre.com.br/p/MLB19782252?pdp_filters=item_id%3AMLB6465743480#polycard_client=cart_list&wid=MLB6465743480&sid=cart", price: 68.39, monthlyUnits: 1 },
  { name: "Neutrogena Hydro Boost Water Gel Hidratante Corporal 200ml", url: "https://www.drogasil.com.br/neutrogena-hydro-boost-water-gel-hidratante-corporal-200ml-891147.html", price: 36.28, monthlyUnits: 0.5 },
  { name: "Escova de Dente Oral-B Gengiva Detox Sensitive 3 unidades", url: "https://www.drogasil.com.br/oral-b-escova-gengiva-detox-com-3-unidades.html", price: 37.90, monthlyUnits: 0.1666666667 },
  { name: "Acnezil Gel Antiacne com 20g", url: "https://www.drogasil.com.br/acnezil-50mg-g-gel-20g.html", price: 12.90, monthlyUnits: 0.2 },
  { name: "Enxaguante Bucal Colgate Total 12 Anti Tártaro 500ml", url: "https://www.amazon.com.br/gp/product/B07Q5VKTVP/ref=ox_sc_act_title_2?smid=A1ZZFT5FULY4LN", price: 22.00, monthlyUnits: 1 },
  { name: "Bepantriz Derma Regenerador Labial com 7,5ml", url: "https://www.amazon.com.br/gp/product/B07ML4ZWWY/ref=ox_sc_act_title_3?smid=A3V7XI8J0SO6I5&psc=1", price: 19.00, monthlyUnits: 0.5 },
  { name: "Sérum Principia Retinol 0,3% + Vitamina E - Rn-0,3 Skincare", url: "https://www.mercadolivre.com.br/principia-serum-facial-retinol-30ml-todo-tipo-de-pele-noite/p/MLB19132085", price: 49.00, monthlyUnits: 0.2 },
  { name: "Neutrogena Hidratante Facial Matte 3 em 1 Face Care Intensive, 100g", url: "https://www.amazon.com.br/gp/product/B08YZJZF3S/ref=ox_sc_act_title_5?smid=A1ZZFT5FULY4LN&psc=1", price: 27.35, monthlyUnits: 0.5 },
];

const KEY = `praxis:account-state:${userId}`;
const envelope = await kvGet(KEY);
if (!envelope) {
  console.error(`No account state for ${userId}.`);
  process.exit(2);
}
const state = envelope.state;

if (!state.shoppingModules) state.shoppingModules = {};
if (!state.shoppingModules.market) {
  state.shoppingModules.market = { items: [], snapshots: {} };
}

const nowIso = new Date().toISOString();
const nextItems = PDF_ITEMS.map((entry) => ({
  id: makeId("shopping-item"),
  name: entry.name,
  brand: "",
  quantity: inferQuantity(entry.name),
  dailyDose: 1,
  monthlyUnits: entry.monthlyUnits,
  includeInFinance: true,
  // All as ONLINE per the user's request. manualUnitPrice still
  // sticks (the store now keeps it as a fallback for online items).
  purchaseMode: "online",
  localStoreName: undefined,
  manualUnitPrice: entry.price,
  referenceUrl: entry.url,
  createdAt: nowIso,
  updatedAt: nowIso,
}));

// Clean slate — replace the entire market scope items list. snapshots
// kept (live-search results from before, mostly harmless if stale).
state.shoppingModules.market.items = nextItems;
state.shoppingModules.market.selectedItemId = nextItems[0]?.id;

await kvSet(KEY, {
  version: (typeof envelope.version === "number" ? envelope.version : 1) + 1,
  updatedAt: new Date().toISOString(),
  state,
});

let monthlyTotal = 0;
for (const item of nextItems) {
  monthlyTotal += item.manualUnitPrice * item.monthlyUnits;
}

console.log(`Replaced market scope with ${nextItems.length} items (all online):`);
for (const item of nextItems) {
  const subtotal = item.manualUnitPrice * item.monthlyUnits;
  console.log(
    `  ${item.name.padEnd(60)} R$ ${item.manualUnitPrice.toFixed(2).padStart(7)} × ${String(item.monthlyUnits).padStart(6)} = R$ ${subtotal.toFixed(2)}`,
  );
}
console.log(`\nMonthly total: R$ ${monthlyTotal.toFixed(2)}`);
console.log(`Supplements scope: untouched.`);
