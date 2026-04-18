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

export async function fetchRenderedHtml(
  url: string,
  options: BrowserFetchOptions = {},
): Promise<BrowserFetchResult> {
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
    const resourceType = route.request().resourceType();
    if (resourceType === "image" || resourceType === "media" || resourceType === "font") {
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
