// CSP base — usa 'unsafe-inline' pra script/style porque o Next.js injeta
// inline scripts (hydration, runtime config) e Tailwind injeta inline
// styles em alguns paths. O bloqueio relevante é o `default-src 'self'`
// + connect-src/img-src/frame-src restritos: impede exfil pra hosts
// arbitrários e enquadra de onde o app pode carregar/comunicar.
// Allowlist abrange Clerk (auth), Stripe (checkout), Supabase (imagens
// remotas configuradas em next.config) e t.me (link do bot Telegram).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.io https://js.stripe.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://qtrypzzcjebvfcihiynt.supabase.co https://*.clerk.com https://img.clerk.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.io https://api.stripe.com https://*.upstash.io",
  "frame-src 'self' https://js.stripe.com https://challenges.cloudflare.com https://*.clerk.accounts.dev https://*.clerk.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

export const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: csp,
  },
  {
    key: "Strict-Transport-Security",
    // 2 anos + subdomínios + preload-ready. HSTS impede downgrade pra
    // http (SSL strip) — relevante pra qualquer acesso fora da edge da
    // Vercel (mobile homescreen, dispositivos cacheados, etc).
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];
