import { NextResponse } from "next/server";

/**
 * Rate limiter simples por janela fixa sobre o KV (Upstash REST).
 *
 * Motivação (auditoria de segurança): NENHUMA rota tinha throttle, então
 * um usuário autenticado podia martelar endpoints caros (account-state
 * PUT com payload de ~1MB, shopping-search com Playwright, geração de
 * PDF, subscribe/snooze enchendo o KV) sem qualquer limite — custo/DoS.
 *
 * Estratégia: INCR numa key `praxis:rl:<bucket>:<id>` com EXPIRE na
 * primeira batida. FAIL-OPEN: se o KV não estiver configurado (dev) ou
 * falhar, NÃO bloqueia — o limiter nunca pode derrubar o app por conta
 * própria. É proteção contra abuso, não um gate de disponibilidade.
 */

const KV_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const KV_ENABLED = Boolean(KV_URL && KV_TOKEN);

async function kvCmd<T = unknown>(
  command: Array<string | number>,
): Promise<T | null> {
  try {
    const res = await fetch(KV_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { result?: T };
    return payload.result ?? null;
  } catch {
    return null;
  }
}

export type RateLimitResult = { ok: boolean; remaining: number };

/**
 * Consome 1 do orçamento de `bucket:id`. `limit` requisições por
 * `windowSeconds`. Retorna { ok:false } quando estourou.
 */
export async function rateLimit(
  bucket: string,
  id: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (!KV_ENABLED) return { ok: true, remaining: limit };
  // Sanitiza o id pra não quebrar o namespace da key (ids do Clerk não
  // têm ':' mas IPs/strings externas podem ter caracteres estranhos).
  const safeId = String(id).replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80);
  const key = `praxis:rl:${bucket}:${safeId}`;
  const count = await kvCmd<number>(["INCR", key]);
  if (count === null) return { ok: true, remaining: limit }; // fail-open
  if (count === 1) {
    // primeira batida da janela → define expiração
    await kvCmd(["EXPIRE", key, windowSeconds]);
  }
  return { ok: count <= limit, remaining: Math.max(0, limit - count) };
}

/**
 * Açúcar pra usar dentro de uma rota: retorna uma Response 429 quando
 * estourou, ou null pra seguir. Uso:
 *   const limited = await enforceRateLimit("shopping-search", userId, 20, 60);
 *   if (limited) return limited;
 */
export async function enforceRateLimit(
  bucket: string,
  id: string,
  limit: number,
  windowSeconds: number,
): Promise<NextResponse | null> {
  const { ok } = await rateLimit(bucket, id, limit, windowSeconds);
  if (ok) return null;
  return NextResponse.json(
    { error: "Muitas requisições em pouco tempo. Tente de novo em instantes." },
    { status: 429, headers: { "Retry-After": String(windowSeconds) } },
  );
}

/** IP do cliente pra rate-limit de rotas não-autenticadas. */
export function clientIpFromRequest(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
