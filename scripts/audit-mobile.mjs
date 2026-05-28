import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const EXECUTABLE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = "http://localhost:3000";
const OUT_DIR = "audit-artifacts";

const VIEWPORTS = [
  {
    id: "iphone-se",
    width: 375,
    height: 667,
    label: "iPhone SE",
    dpr: 2,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  },
  {
    id: "iphone-14-pro",
    width: 393,
    height: 852,
    label: "iPhone 14 Pro",
    dpr: 3,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  },
  {
    id: "pixel-7",
    width: 412,
    height: 915,
    label: "Pixel 7",
    dpr: 2.625,
    userAgent:
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  },
];

const ROUTES = [
  { module: "core", path: "/dashboard" },
  { module: "core", path: "/agenda" },
  { module: "core", path: "/tasks" },
  { module: "core", path: "/profile" },
  { module: "core", path: "/settings" },
  { module: "core", path: "/achievements" },
  { module: "core", path: "/friends" },
  { module: "core", path: "/arena" },
  { module: "core", path: "/ranking" },
  { module: "core", path: "/tools" },
  { module: "core", path: "/pages" },
  { module: "modules", path: "/modules/workout" },
  { module: "modules", path: "/modules/workout/history" },
  { module: "modules", path: "/modules/run" },
  { module: "modules", path: "/modules/work" },
  { module: "modules", path: "/modules/nutrition" },
  { module: "modules", path: "/modules/finance" },
  { module: "modules", path: "/modules/appearance" },
  { module: "modules", path: "/modules/recovery" },
  { module: "modules", path: "/modules/health" },
  { module: "modules", path: "/modules/mind" },
  { module: "modules", path: "/modules/sleep" },
  { module: "modules", path: "/modules/home" },
  { module: "modules", path: "/modules/market" },
  { module: "modules", path: "/modules/supplements" },
];

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  executablePath: EXECUTABLE,
  args: ["--no-sandbox"],
});

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE,
  viewports: VIEWPORTS.map((v) => ({
    id: v.id,
    width: v.width,
    height: v.height,
    label: v.label,
  })),
  routes: [],
};

function slugify(path) {
  return path.replace(/^\//, "").replace(/\//g, "_") || "root";
}

for (const route of ROUTES) {
  console.log(`\n=== ${route.path} ===`);
  const routeEntry = { ...route, viewports: {} };
  const routeSlug = slugify(route.path);
  const routeDir = join(OUT_DIR, routeSlug);
  await mkdir(routeDir, { recursive: true });

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.dpr,
      userAgent: viewport.userAgent,
      isMobile: true,
      hasTouch: true,
    });

    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    let status = null;
    let measurement = null;
    let screenshotPath = null;
    let error = null;

    try {
      const response = await page.goto(`${BASE}${route.path}`, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      status = response?.status() ?? null;

      try {
        await page.waitForLoadState("networkidle", { timeout: 10_000 });
      } catch {}
      await page.waitForTimeout(800);

      measurement = await page.evaluate(() => {
        const html = document.documentElement;
        const body = document.body;
        const viewportWidth = html.clientWidth;
        const scrollWidth = Math.max(html.scrollWidth, body.scrollWidth);
        const overflowsX = scrollWidth > viewportWidth;

        const offenders = [];
        if (overflowsX) {
          const nodes = document.querySelectorAll(
            "main *:not(script):not(style)",
          );
          for (const node of nodes) {
            const rect = node.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) continue;
            const right = rect.right + window.scrollX;
            const left = rect.left + window.scrollX;
            const exceeds = right - viewportWidth;
            if (exceeds <= 1) continue;
            const children = node.children?.length ?? 0;
            const tag = node.tagName.toLowerCase();
            const cls = (node.className || "").toString().slice(0, 80);
            const id = node.id ? `#${node.id}` : "";
            const text = (node.textContent || "").trim().slice(0, 50);
            offenders.push({
              selector: `${tag}${id}${cls ? "." + cls.split(/\s+/).slice(0, 2).join(".") : ""}`,
              left: Math.round(left),
              right: Math.round(right),
              exceeds: Math.round(exceeds),
              width: Math.round(rect.width),
              childCount: children,
              snippet: text,
            });
          }
          offenders.sort((a, b) => b.exceeds - a.exceeds);
        }

        return {
          viewportWidth,
          scrollWidth,
          scrollHeight: html.scrollHeight,
          overflowsX,
          overflowExceedsBy: Math.max(0, scrollWidth - viewportWidth),
          offenders: offenders.slice(0, 8),
          title: document.title,
          hasMain: !!document.querySelector("main"),
        };
      });

      screenshotPath = join(routeDir, `${viewport.id}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch (err) {
      error = err.message;
    }

    routeEntry.viewports[viewport.id] = {
      status,
      measurement,
      screenshot: screenshotPath,
      consoleErrors: consoleErrors.slice(0, 5),
      pageErrors: pageErrors.slice(0, 5),
      error,
    };

    const overflowFlag = measurement?.overflowsX
      ? `OVERFLOW +${measurement.overflowExceedsBy}px`
      : "ok";
    console.log(
      `  ${viewport.id.padEnd(14)} status=${status ?? "?"}  ${overflowFlag}${error ? `  err=${error.slice(0, 60)}` : ""}`,
    );

    await context.close();
  }

  report.routes.push(routeEntry);
}

await browser.close();

await writeFile(
  join(OUT_DIR, "report.json"),
  JSON.stringify(report, null, 2),
);

const summary = {
  totalRoutes: report.routes.length,
  routesWithOverflow: 0,
  worstOffenders: [],
};
for (const route of report.routes) {
  let anyOverflow = false;
  for (const viewport of VIEWPORTS) {
    const m = route.viewports[viewport.id]?.measurement;
    if (m?.overflowsX) {
      anyOverflow = true;
      summary.worstOffenders.push({
        path: route.path,
        viewport: viewport.id,
        exceedsBy: m.overflowExceedsBy,
      });
    }
  }
  if (anyOverflow) summary.routesWithOverflow += 1;
}
summary.worstOffenders.sort((a, b) => b.exceedsBy - a.exceedsBy);
console.log("\n========== SUMMARY ==========");
console.log(`Routes audited: ${summary.totalRoutes}`);
console.log(`Routes with overflow: ${summary.routesWithOverflow}`);
console.log("Worst offenders (top 10):");
for (const o of summary.worstOffenders.slice(0, 10)) {
  console.log(`  ${o.path.padEnd(34)} ${o.viewport.padEnd(14)} +${o.exceedsBy}px`);
}
console.log(`\nFull report: ${OUT_DIR}/report.json`);
