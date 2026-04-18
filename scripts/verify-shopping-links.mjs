import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import axios from "axios";
import * as cheerio from "cheerio";

const DEFAULT_INPUT = path.resolve("src/lib/shopping-seed.raw.json");
const DEFAULT_OUTPUT = path.resolve("scripts/verify-shopping-links.report.json");
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_TIMEOUT_MS = 15000;

const BLOCKED_PATTERNS = [
  "captcha",
  "acesso negado",
  "access denied",
  "robot",
  "verifique se voce e humano",
  "verify you are human",
  "verifying your browser",
  "please wait a few seconds",
  "cloudflare",
];

const TITLE_SELECTORS = [
  'meta[property="og:title"]',
  'meta[name="twitter:title"]',
  "title",
  "h1",
  '[data-testid="product-name"]',
  ".product-name",
  ".ui-pdp-title",
  ".vtex-store-components-3-x-productNameContainer",
];

const DESCRIPTION_SELECTORS = [
  'meta[name="description"]',
  'meta[property="og:description"]',
  "h1 + p",
  ".product-description",
  ".ui-pdp-description__content",
  ".vtex-store-components-3-x-productDescriptionText",
];

const RELEVANT_TEXT_SELECTORS = [
  "h1",
  "h2",
  "main p",
  "article p",
  '[class*="product"]',
  '[class*="description"]',
  '[class*="title"]',
];

const STOPWORDS = new Set([
  "a",
  "ao",
  "aos",
  "as",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "g",
  "kg",
  "l",
  "mg",
  "ml",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "ou",
  "para",
  "por",
  "sem",
  "the",
  "um",
  "uma",
  "un",
  "und",
  "x",
]);

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    out: DEFAULT_OUTPUT,
    concurrency: DEFAULT_CONCURRENCY,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    activeOnly: false,
    noWrite: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--input" && next) {
      args.input = path.resolve(next);
      index += 1;
      continue;
    }

    if (current === "--out" && next) {
      args.out = path.resolve(next);
      index += 1;
      continue;
    }

    if (current === "--concurrency" && next) {
      args.concurrency = Math.max(1, Number.parseInt(next, 10) || DEFAULT_CONCURRENCY);
      index += 1;
      continue;
    }

    if (current === "--timeout" && next) {
      args.timeoutMs = Math.max(1000, Number.parseInt(next, 10) || DEFAULT_TIMEOUT_MS);
      index += 1;
      continue;
    }

    if (current === "--active-only") {
      args.activeOnly = true;
      continue;
    }

    if (current === "--no-write") {
      args.noWrite = true;
    }
  }

  return args;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function tokenize(value) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token && token.length > 1 && !STOPWORDS.has(token));
}

function readFirstAttr($, selector, attribute) {
  const element = $(selector).first();
  return element.length ? safeText(element.attr(attribute)) : "";
}

function readFirstText($, selector) {
  const element = $(selector).first();
  return element.length ? safeText(element.text()) : "";
}

function collectJsonLdName(node, target) {
  if (!node) {
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((child) => collectJsonLdName(child, target));
    return;
  }

  if (typeof node !== "object") {
    return;
  }

  if (typeof node.name === "string") {
    target.push(safeText(node.name));
  }

  if (node.itemListElement) {
    collectJsonLdName(node.itemListElement, target);
  }

  if (node.mainEntity) {
    collectJsonLdName(node.mainEntity, target);
  }

  if (node["@graph"]) {
    collectJsonLdName(node["@graph"], target);
  }
}

function extractJsonLdNames($) {
  const names = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).text();
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      collectJsonLdName(parsed, names);
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  });

  return dedupe(names);
}

function extractPageSignals(html, finalUrl) {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg").remove();

  const titleCandidates = [];
  for (const selector of TITLE_SELECTORS) {
    const value = selector.startsWith("meta")
      ? readFirstAttr($, selector, "content")
      : readFirstText($, selector);
    titleCandidates.push(value);
  }
  titleCandidates.push(...extractJsonLdNames($));

  const descriptionCandidates = [];
  for (const selector of DESCRIPTION_SELECTORS) {
    const value = selector.startsWith("meta")
      ? readFirstAttr($, selector, "content")
      : readFirstText($, selector);
    descriptionCandidates.push(value);
  }

  const relevantSnippets = [];
  for (const selector of RELEVANT_TEXT_SELECTORS) {
    $(selector)
      .slice(0, 12)
      .each((_, element) => {
        const text = safeText($(element).text());
        if (text.length >= 20) {
          relevantSnippets.push(text);
        }
      });
  }

  return {
    title: dedupe(titleCandidates)[0] || "",
    descriptions: dedupe(descriptionCandidates).slice(0, 3),
    snippets: dedupe(relevantSnippets).slice(0, 6),
    bodyText: safeText($("body").text()).slice(0, 6000),
    finalUrl,
  };
}

function extractQuantityHints(text) {
  const matches = normalizeText(text).match(
    /\b\d+(?:[.,]\d+)?\s?(?:kg|g|mg|ml|l|caps|capsulas|capsula|comp|comprimidos|soft|softgels|un|und)\b/g,
  );
  return dedupe(matches || []);
}

function buildCoherence(item, page) {
  const itemTokens = dedupe(tokenize(item.name));
  const pageTokens = new Set(
    dedupe([
      ...tokenize(page.title),
      ...tokenize(page.descriptions.join(" ")),
      ...tokenize(page.snippets.join(" ")),
    ]),
  );

  const matchedTokens = itemTokens.filter((token) => pageTokens.has(token));
  const missingTokens = itemTokens.filter((token) => !pageTokens.has(token));
  const overlapRatio = itemTokens.length ? matchedTokens.length / itemTokens.length : 0;

  const normalizedItemName = normalizeText(item.name);
  const normalizedTitle = normalizeText(page.title);
  const normalizedContext = normalizeText(
    [page.title, ...page.descriptions, ...page.snippets].join(" "),
  );

  const exactNameBoost =
    normalizedItemName && normalizedContext.includes(normalizedItemName) ? 0.2 : 0;
  const titleBoost =
    normalizedItemName && normalizedTitle.includes(normalizedItemName) ? 0.25 : 0;

  const itemQuantityHints = extractQuantityHints(`${item.name} ${item.quantity || ""}`);
  const pageQuantityHints = extractQuantityHints(
    [page.title, ...page.descriptions, ...page.snippets].join(" "),
  );
  const quantityHit = itemQuantityHints.some((hint) => pageQuantityHints.includes(hint));
  const quantityBoost = quantityHit ? 0.15 : 0;

  let score = overlapRatio * 0.75 + exactNameBoost + titleBoost + quantityBoost;

  if (item.link && page.finalUrl) {
    const itemHost = new URL(item.link).hostname.replace(/^www\./, "");
    const finalHost = new URL(page.finalUrl).hostname.replace(/^www\./, "");
    if (itemHost !== finalHost) {
      score -= 0.1;
    }
  }

  return {
    score: clamp(Number(score.toFixed(3)), 0, 1),
    matchedTokens,
    missingTokens,
    quantityHit,
  };
}

function detectBlocking(page) {
  const combined = normalizeText(
    [page.title, ...page.descriptions, ...page.snippets, page.bodyText].join(" "),
  );
  return BLOCKED_PATTERNS.find((pattern) => combined.includes(pattern)) || "";
}

function buildStatus({ failureReason, blockedPattern, page, coherence }) {
  if (failureReason) {
    return "falho";
  }

  if (blockedPattern) {
    return "suspeito";
  }

  if (!page.title) {
    return "suspeito";
  }

  if (coherence.score >= 0.65) {
    return "ok";
  }

  if (coherence.score >= 0.35) {
    return "suspeito";
  }

  return "falho";
}

function buildFailureResult(item, failureReason, httpStatus = null, finalUrl = null) {
  return {
    scope: item.scope,
    row: item.row,
    name: item.name,
    link: item.link,
    status: "falho",
    score: 0,
    failureReason,
    httpStatus,
    finalUrl,
    title: "",
    snippets: [],
    matchedTokens: [],
    missingTokens: dedupe(tokenize(item.name)),
    quantityHit: false,
    reasons: failureReason ? [failureReason] : [],
  };
}

async function verifyItem(item, options) {
  if (!item.link) {
    return buildFailureResult(item, "Item sem link.");
  }

  try {
    const response = await axios.get(item.link, {
      timeout: options.timeoutMs,
      maxRedirects: 5,
      responseType: "text",
      validateStatus: () => true,
      headers: {
        "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
      },
    });

    const contentType = String(response.headers["content-type"] || "").toLowerCase();
    const finalUrl = response.request?.res?.responseUrl || response.request?.path || item.link;

    if (response.status >= 400) {
      return buildFailureResult(item, `HTTP ${response.status}.`, response.status, finalUrl);
    }

    if (!contentType.includes("html")) {
      return buildFailureResult(
        item,
        `Content-Type nao HTML: ${contentType || "desconhecido"}.`,
        response.status,
        finalUrl,
      );
    }

    const page = extractPageSignals(String(response.data || ""), finalUrl);
    const coherence = buildCoherence(item, page);
    const blockedPattern = detectBlocking(page);
    const status = buildStatus({
      failureReason: "",
      blockedPattern,
      page,
      coherence,
    });

    const reasons = [];
    if (blockedPattern) {
      reasons.push(`Possivel bloqueio/anti-bot: "${blockedPattern}".`);
    }
    if (!page.title) {
      reasons.push("Titulo principal nao identificado.");
    }
    if (coherence.missingTokens.length) {
      reasons.push(`Tokens ausentes: ${coherence.missingTokens.join(", ")}.`);
    }
    if (normalizeText(item.link) !== normalizeText(finalUrl) && normalizeText(finalUrl)) {
      reasons.push("URL final difere do link original.");
    }

    return {
      scope: item.scope,
      row: item.row,
      name: item.name,
      link: item.link,
      status,
      score: coherence.score,
      failureReason: "",
      httpStatus: response.status,
      finalUrl,
      title: page.title,
      snippets: [...page.descriptions, ...page.snippets].slice(0, 5),
      matchedTokens: coherence.matchedTokens,
      missingTokens: coherence.missingTokens,
      quantityHit: coherence.quantityHit,
      reasons,
    };
  } catch (error) {
    return buildFailureResult(
      item,
      error instanceof Error ? error.message : "Falha desconhecida.",
    );
  }
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runner() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const runners = Array.from(
    { length: Math.min(concurrency, items.length || 1) },
    () => runner(),
  );

  await Promise.all(runners);
  return results;
}

function buildSummary(results) {
  const counts = {
    ok: 0,
    suspeito: 0,
    falho: 0,
  };

  const byScope = {
    market: { ok: 0, suspeito: 0, falho: 0 },
    supplements: { ok: 0, suspeito: 0, falho: 0 },
  };

  for (const result of results) {
    counts[result.status] += 1;
    if (byScope[result.scope]) {
      byScope[result.scope][result.status] += 1;
    }
  }

  return { counts, byScope };
}

function pickSuspiciousExamples(results) {
  return results
    .filter((result) => result.status !== "ok" || result.score < 0.45 || !result.link)
    .sort((left, right) => {
      const leftRank = left.status === "falho" ? 0 : left.status === "suspeito" ? 1 : 2;
      const rightRank = right.status === "falho" ? 0 : right.status === "suspeito" ? 1 : 2;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return left.score - right.score;
    })
    .slice(0, 10)
    .map((result) => ({
      row: result.row,
      scope: result.scope,
      name: result.name,
      status: result.status,
      score: result.score,
      link: result.link,
      title: result.title,
      reason: result.failureReason || result.reasons?.[0] || "Coerencia baixa.",
    }));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const raw = await fs.readFile(options.input, "utf8");
  const parsedItems = JSON.parse(raw.replace(/^\uFEFF/, ""));
  const items = options.activeOnly ? parsedItems.filter((item) => item.active) : parsedItems;

  const startedAt = Date.now();
  const results = await runWithConcurrency(items, options.concurrency, (item) =>
    verifyItem(item, options),
  );
  const summary = buildSummary(results);
  const suspiciousExamples = pickSuspiciousExamples(results);

  const report = {
    generatedAt: new Date().toISOString(),
    input: options.input,
    totalItems: results.length,
    activeOnly: options.activeOnly,
    concurrency: options.concurrency,
    timeoutMs: options.timeoutMs,
    elapsedMs: Date.now() - startedAt,
    summary,
    suspiciousExamples,
    results,
  };

  if (!options.noWrite) {
    await fs.writeFile(options.out, JSON.stringify(report, null, 2));
  }

  console.log(`Itens verificados: ${report.totalItems}`);
  console.log(
    `Status: ok=${summary.counts.ok} suspeito=${summary.counts.suspeito} falho=${summary.counts.falho}`,
  );

  if (!options.noWrite) {
    console.log(`Relatorio salvo em: ${options.out}`);
  }

  if (suspiciousExamples.length) {
    console.log("Exemplos suspeitos:");
    for (const example of suspiciousExamples) {
      console.log(
        `- [${example.scope}#${example.row}] ${example.name} => ${example.status} score=${example.score} (${example.reason})`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
