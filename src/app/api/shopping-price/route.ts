import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchCurrentPriceFromUrl } from "@/lib/shopping-search.server";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireFullAccess } from "@/lib/require-full-access.server";

export const dynamic = "force-dynamic";

/**
 * Lê o preço atual de UM produto a partir do link salvo no item.
 * Defesa em profundidade: além do middleware, exige sessão no handler —
 * assim um eventual bypass do middleware não deixa o leitor de páginas
 * (axios + Playwright) aberto pra abuso/SSRF por terceiros.
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  }

  // Recurso CARO (chamadas externas por request) → exclusivo do plano
  // pago. O gate roda no servidor: trancar só a UI não segura custo.
  const deniedByPlan = await requireFullAccess();
  if (deniedByPlan) return deniedByPlan;

  const limited = await enforceRateLimit("shopping-price", userId, 30, 60);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const url = String(searchParams.get("url") || "").trim();

  if (!url) {
    return NextResponse.json(
      { ok: false, error: "Informe o link do produto." },
      { status: 400 },
    );
  }

  try {
    const result = await fetchCurrentPriceFromUrl(url);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    console.error(
      "[shopping-price] erro:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: false, error: "Não foi possível ler o preço agora." },
      { status: 500 },
    );
  }
}
