import { NextResponse } from "next/server";
import { fetchCurrentPriceFromUrl } from "@/lib/shopping-search.server";

export const dynamic = "force-dynamic";

/**
 * Lê o preço atual de UM produto a partir do link salvo no item.
 * Autenticado pelo middleware do Clerk (não está nas rotas públicas),
 * o que evita abuso do leitor de páginas por terceiros.
 */
export async function GET(request: Request) {
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
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível ler o preço agora.",
      },
      { status: 500 },
    );
  }
}
