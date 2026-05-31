import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAccountState } from "@/lib/account-state.server";
import { fetchCurrentPriceFromUrl } from "@/lib/shopping-search.server";
import type { PersistedState } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Diagnóstico: roda fetchCurrentPriceFromUrl em todos os itens do
 * shopping (market + supplements) do usuário autenticado e retorna um
 * relatório por item — qual estratégia do extrator pegou (ou não),
 * status HTTP, tamanho do HTML, tempo. Sequencial pra não estourar
 * memória do serverless com vários browsers headless ao mesmo tempo.
 *
 * Autenticado por Clerk (não está em isPublicRoute). Endpoint temporário
 * pra debug — remover quando o extrator estiver redondo.
 *
 * Use querystring:
 *   ?scope=market     → só mercado
 *   ?scope=supplements → só suplementos
 *   ?limit=10         → no máximo 10 itens (default 20, pra caber em 60s)
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const scopeFilter = searchParams.get("scope");
  const limitParam = Number(searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(limitParam, 30)
      : 20;

  const envelope = await getAccountState(userId);
  if (!envelope) {
    return NextResponse.json({ error: "no-account-state" }, { status: 404 });
  }
  const state = envelope.state as PersistedState;

  const scopes =
    scopeFilter === "market"
      ? ["market" as const]
      : scopeFilter === "supplements"
        ? ["supplements" as const]
        : (["market", "supplements"] as const);

  type Row = {
    scope: string;
    name: string;
    brand?: string;
    host: string;
    url: string;
    ok: boolean;
    price?: number;
    title?: string;
    fetchMode?: string;
    stage?: string;
    httpStatus?: number;
    htmlBytes?: number;
    error?: string;
    ms: number;
  };

  const results: Row[] = [];
  let totalAttempted = 0;
  let skippedNoUrl = 0;

  for (const scope of scopes) {
    const items = state.shoppingModules?.[scope]?.items ?? [];
    for (const item of items) {
      const url = item.referenceUrl?.trim();
      if (!url) {
        skippedNoUrl += 1;
        continue;
      }
      if (totalAttempted >= limit) break;
      totalAttempted += 1;

      let host = "";
      try {
        host = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        /* ignore */
      }

      const start = Date.now();
      try {
        const result = await fetchCurrentPriceFromUrl(url);
        results.push({
          scope,
          name: item.name,
          brand: item.brand || undefined,
          host,
          url,
          ok: result.ok,
          price: result.price,
          title: result.title,
          fetchMode: result.fetchMode,
          stage: result.stage,
          httpStatus: result.httpStatus,
          htmlBytes: result.htmlBytes,
          error: result.error,
          ms: Date.now() - start,
        });
      } catch (error) {
        results.push({
          scope,
          name: item.name,
          brand: item.brand || undefined,
          host,
          url,
          ok: false,
          error: error instanceof Error ? error.message : "unknown",
          ms: Date.now() - start,
        });
      }
    }
    if (totalAttempted >= limit) break;
  }

  // Resumo por loja (pra ver padrões).
  const byHost = new Map<string, { ok: number; fail: number }>();
  for (const row of results) {
    const entry = byHost.get(row.host) ?? { ok: 0, fail: 0 };
    if (row.ok) entry.ok += 1;
    else entry.fail += 1;
    byHost.set(row.host, entry);
  }
  const summary = Array.from(byHost.entries()).map(([host, counts]) => ({
    host,
    ok: counts.ok,
    fail: counts.fail,
  }));

  return NextResponse.json({
    userId,
    totalAttempted,
    skippedNoUrl,
    okCount: results.filter((r) => r.ok).length,
    failCount: results.filter((r) => !r.ok).length,
    summaryByHost: summary,
    results,
  });
}
