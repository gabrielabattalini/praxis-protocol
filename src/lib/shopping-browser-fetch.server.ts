import "server-only";

import { chromium, type Browser } from "playwright";
import { shouldUseBrowserFallback } from "@/lib/shopping-browser-fallback";

const DEFAULT_BROWSER_HEADERS = {
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
};

type BrowserFetchOptions = {
  referer?: string;
  timeoutMs?: number;
  waitAfterLoadMs?: number;
  waitForSelector?: string;
};

type BrowserFetchResult = {
  html: string;
  finalUrl: string;
};

let browserPromise: Promise<Browser> | null = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium
      .launch({
        headless: true,
        args: [
          "--disable-blink-features=AutomationControlled",
          "--disable-dev-shm-usage",
          "--no-sandbox",
        ],
      })
      .catch((error) => {
        browserPromise = null;
        throw error;
      });
  }

  return browserPromise;
}

export { shouldUseBrowserFallback };

// Allowlist defensiva: hoje só recebemos URLs montadas em
// shopping-search.server.ts pra um conjunto fixo de varejistas, mas se um
// caller futuro passar uma URL derivada de input do usuário (ou um host
// permitido fizer redirect aberto), sem allowlist isso vira SSRF
// (169.254.169.254/metadata, file://, hosts internos). Mantém allowlist
// próximo ao sink (page.goto) — fail-safe.
const ALLOWED_HOSTS = new Set<string>([
  "mercadolivre.com.br",
  "lista.mercadolivre.com.br",
  "produto.mercadolivre.com.br",
  "shopee.com.br",
  "www.amazon.com.br",
  "amazon.com.br",
  "www.magazineluiza.com.br",
  "magazineluiza.com.br",
  "www.americanas.com.br",
  "americanas.com.br",
  "www.casasbahia.com.br",
  "casasbahia.com.br",
  "www.kabum.com.br",
  "kabum.com.br",
  "www.netshoes.com.br",
  "netshoes.com.br",
  "www.centauro.com.br",
  "centauro.com.br",
]);

function assertAllowedUrl(rawUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`URL inválida pra browser fetch: ${rawUrl}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Esquema não permitido: ${parsed.protocol}`);
  }
  const host = parsed.hostname.toLowerCase();
  // Allowlist por sufixo de domínio raiz — cobre subdomínios novos do
  // mesmo varejista sem precisar editar a lista.
  const isAllowed = Array.from(ALLOWED_HOSTS).some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
  if (!isAllowed) {
    throw new Error(`Host não permitido pra browser fetch: ${host}`);
  }
}

export async function fetchRenderedHtml(
  url: string,
  options: BrowserFetchOptions = {},
): Promise<BrowserFetchResult> {
  assertAllowedUrl(url);
  const browser = await getBrowser();
  const context = await browser.newContext({
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    extraHTTPHeaders: {
      ...DEFAULT_BROWSER_HEADERS,
      ...(options.referer ? { Referer: options.referer } : {}),
    },
    viewport: { width: 1440, height: 980 },
  });

  const page = await context.newPage();
  page.setDefaultTimeout(options.timeoutMs ?? 20000);

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
      configurable: true,
    });
  });

  await page.route("**/*", async (route) => {
    const request = route.request();
    const resourceType = request.resourceType();
    if (resourceType === "image" || resourceType === "media" || resourceType === "font") {
      await route.abort();
      return;
    }
    // Bloqueia redirect cross-domain pra fora da allowlist (defesa em
    // profundidade contra open-redirect num host permitido).
    try {
      const reqUrl = new URL(request.url());
      if (reqUrl.protocol !== "https:" && reqUrl.protocol !== "http:") {
        await route.abort();
        return;
      }
      const host = reqUrl.hostname.toLowerCase();
      const isMain = request.isNavigationRequest() && request.frame() === page.mainFrame();
      if (isMain) {
        const isAllowed = Array.from(ALLOWED_HOSTS).some(
          (allowed) => host === allowed || host.endsWith(`.${allowed}`),
        );
        if (!isAllowed) {
          await route.abort();
          return;
        }
      }
    } catch {
      await route.abort();
      return;
    }
    await route.continue();
  });

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: options.timeoutMs ?? 20000,
    });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout: 4000 }).catch(() => {});
    }

    await page.waitForTimeout(options.waitAfterLoadMs ?? 1200);

    return {
      html: await page.content(),
      finalUrl: page.url(),
    };
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}
