const BLOCKED_HTML_PATTERNS = [
  "verifying your browser",
  "verify you are human",
  "captcha",
  "robot",
  "cloudflare",
  "shieldsquare",
  "access denied",
  "acesso negado",
];

const RESULT_MARKERS = [
  "s-search-result",
  "product-item",
  "product-card",
  "produto-item",
  "listagem-item",
  "\"itemlist\"",
  "application/ld+json",
];

export function shouldUseBrowserFallback(html: string, offersCount: number) {
  if (offersCount > 0) return false;

  const normalized = String(html || "").toLowerCase();
  if (!normalized.trim()) return true;

  if (BLOCKED_HTML_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return true;
  }

  return !RESULT_MARKERS.some((marker) => normalized.includes(marker));
}
