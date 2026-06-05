#!/usr/bin/env node
/**
 * Protocolo de verificação de páginas — Praxis Protocol.
 *
 * Abre rota por rota e checa se a plataforma responde sem erro. Enumera
 * as rotas direto do filesystem (src/app/**\/page.tsx), então se mantém
 * em dia sozinho quando páginas novas entram.
 *
 * DOIS modos:
 *   1) HTTP (padrão) — roda em qualquer lugar, sem browser. Pega:
 *      crash de render (5xx), rota inexistente (404), overlay de erro
 *      do Next, e corpo "fino" demais (página vazia). Valida SSR +
 *      roteamento + status. NÃO executa o JS do client.
 *   2) Browser (--browser) — se Playwright + Chromium estiverem
 *      instalados, abre cada página num Chromium headless e captura
 *      erros de console, exceções não-tratadas (pageerror) e requests
 *      que falharam. Cobre os erros só-client (hydration, store,
 *      handlers) que o modo HTTP não vê.
 *
 * Uso:
 *   1. Suba o app em dev (bypass de auth liga sem chave Clerk):
 *        PORT=3100 npm run dev
 *   2. Rode o protocolo:
 *        npm run verify:pages                 # HTTP, base padrão :3100
 *        BASE_URL=http://localhost:3000 npm run verify:pages
 *        npm run verify:pages -- --browser    # + verificação client
 *
 * Sai com código 1 se achar qualquer falha (útil em CI).
 */

import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3100";
const USE_BROWSER = process.argv.includes("--browser");
const APP_DIR = path.join(process.cwd(), "src", "app");

/* ── Enumeração de rotas a partir do filesystem ─────────────────── */

function listPageRoutes(dir, prefix = "") {
  const routes = [];
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return routes;
  }
  for (const entry of entries) {
    if (entry.isFile() && entry.name === "page.tsx") {
      routes.push(prefix === "" ? "/" : prefix);
    } else if (entry.isDirectory()) {
      const seg = entry.name;
      // Route groups "(app)" não viram segmento de URL.
      const isGroup = seg.startsWith("(") && seg.endsWith(")");
      const next = isGroup ? prefix : `${prefix}/${seg}`;
      routes.push(...listPageRoutes(path.join(dir, seg), next));
    }
  }
  return routes;
}

// Rotas com segmento dinâmico OBRIGATÓRIO ([id]) precisam de valor real —
// pulamos por padrão. Catch-all opcional ([[...x]]) funciona na base.
function hasRequiredDynamic(route) {
  return /\/\[[^.\]]/.test(route) && !route.includes("[[...");
}

function normalizeOptionalCatchAll(route) {
  // /auth/login/[[...sign-in]] → /auth/login
  return route.replace(/\/\[\[\.\.\..*?\]\]/g, "");
}

/* ── Variações com parâmetros (exercita query/dynamic) ──────────── */

const EXTRA_TARGETS = [
  "/relatorios?weeksAgo=2",
  "/modules/workout?dayId=abc",
  "/checkout/success?session_id=cs_test_invalid",
  // APIs GET: pública deve dar 200; autenticadas 401 (sem userId server-side).
  "/api/notifications/public-key",
  "/api/account-state",
  "/api/telegram/status",
];

/* ── Verificação HTTP ───────────────────────────────────────────── */

const OVERLAY_RE =
  /a server-side exception has occurred|__NEXT_ERROR|nextjs-portal|"digest":/;

async function checkHttp(target) {
  const start = Date.now();
  try {
    const res = await fetch(BASE_URL + target, { redirect: "manual" });
    const ms = Date.now() - start;
    let body = "";
    try {
      body = await res.text();
    } catch {}
    const bytes = body.length;
    const s = res.status;
    let verdict = "OK";
    if (s >= 500) verdict = "FAIL-5xx";
    else if (s === 404) verdict = "FAIL-404";
    else if (OVERLAY_RE.test(body)) verdict = "FAIL-overlay";
    else if (target.startsWith("/api/"))
      verdict = [200, 401, 403].includes(s) ? `API-${s}` : `FAIL-api-${s}`;
    else if (s >= 300 && s < 400) verdict = `REDIR-${s}`;
    else if (s === 200 && bytes < 2000) verdict = "FAIL-thin";
    return { target, status: s, bytes, ms, verdict };
  } catch (error) {
    return { target, verdict: "FAIL-fetch", error: String(error) };
  }
}

/* ── Verificação no browser (opcional) ──────────────────────────── */

async function checkBrowser(targets) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.warn(
      "[verify] Playwright não instalado — pulei o modo browser. (npm i -D playwright && npx playwright install chromium)",
    );
    return null;
  }
  let browser;
  try {
    browser = await chromium.launch();
  } catch (error) {
    console.warn(
      `[verify] Chromium indisponível — pulei o modo browser. (npx playwright install chromium)\n  ${error}`,
    );
    return null;
  }
  const results = [];
  for (const target of targets) {
    const page = await browser.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    page.on("requestfailed", (req) =>
      failedRequests.push(`${req.method()} ${req.url()}`),
    );
    let verdict = "OK";
    try {
      await page.goto(BASE_URL + target, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      // Ignora ruído conhecido (ex.: favicon, extensões) se necessário.
      const realConsole = consoleErrors.filter(
        (text) => !/favicon|ResizeObserver loop/.test(text),
      );
      if (pageErrors.length) verdict = "FAIL-pageerror";
      else if (realConsole.length) verdict = "WARN-console";
      results.push({
        target,
        verdict,
        pageErrors,
        consoleErrors: realConsole,
        failedRequests,
      });
    } catch (error) {
      results.push({ target, verdict: "FAIL-goto", error: String(error) });
    } finally {
      await page.close();
    }
  }
  await browser.close();
  return results;
}

/* ── Main ───────────────────────────────────────────────────────── */

async function main() {
  const rawRoutes = Array.from(new Set(listPageRoutes(APP_DIR)));
  const pageRoutes = rawRoutes
    .map(normalizeOptionalCatchAll)
    .filter((route) => !hasRequiredDynamic(route));
  const skipped = rawRoutes.filter(hasRequiredDynamic);
  const targets = Array.from(new Set([...pageRoutes, ...EXTRA_TARGETS])).sort();

  console.log(
    `\n▸ Protocolo de verificação — base ${BASE_URL} · ${targets.length} alvos · modo ${USE_BROWSER ? "HTTP+browser" : "HTTP"}\n`,
  );

  const httpResults = [];
  for (const target of targets) {
    const r = await checkHttp(target);
    httpResults.push(r);
    const sz = r.bytes != null ? `${String(r.bytes).padStart(7)}b` : "    ----";
    const ms = r.ms != null ? `${String(r.ms + "ms").padStart(7)}` : "  -----";
    console.log(`${r.verdict.padEnd(13)} ${String(r.status ?? "--").padEnd(4)} ${sz} ${ms}  ${r.target}`);
  }

  let browserResults = null;
  if (USE_BROWSER) {
    console.log("\n▸ Modo browser (Chromium headless)…\n");
    // Só páginas (não APIs) no browser.
    const pageTargets = targets.filter((t) => !t.startsWith("/api/"));
    browserResults = await checkBrowser(pageTargets);
    if (browserResults) {
      for (const r of browserResults) {
        console.log(`${r.verdict.padEnd(15)} ${r.target}`);
        for (const e of r.pageErrors ?? []) console.log(`    pageerror: ${e}`);
        for (const e of r.consoleErrors ?? []) console.log(`    console:   ${e}`);
        for (const e of r.failedRequests ?? []) console.log(`    req-fail:  ${e}`);
      }
    }
  }

  const httpFails = httpResults.filter((r) => r.verdict.startsWith("FAIL"));
  const browserFails = (browserResults ?? []).filter((r) =>
    r.verdict.startsWith("FAIL"),
  );

  console.log(
    `\n=== RESUMO ===\n  HTTP:    ${httpResults.length} alvos · ${httpFails.length} falhas`,
  );
  if (browserResults) {
    const warns = browserResults.filter((r) => r.verdict.startsWith("WARN"));
    console.log(
      `  Browser: ${browserResults.length} páginas · ${browserFails.length} falhas · ${warns.length} avisos de console`,
    );
  }
  if (skipped.length) {
    console.log(
      `  Pulados (segmento dinâmico obrigatório): ${skipped.join(", ")}`,
    );
  }

  const totalFails = httpFails.length + browserFails.length;
  if (totalFails > 0) {
    console.log(`\n✗ ${totalFails} falha(s) encontrada(s).`);
    process.exit(1);
  }
  console.log(`\n✓ Tudo verde.`);
}

main().catch((error) => {
  console.error("[verify] erro fatal:", error);
  process.exit(1);
});
