import { NextResponse } from "next/server";
import { searchShoppingOffers } from "@/lib/shopping-search.server";
import type { ShoppingModuleScope } from "@/lib/shopping-search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scopeParam = String(searchParams.get("scope") || "market").trim();
  const scope: ShoppingModuleScope =
    scopeParam === "supplements" ? "supplements" : "market";
  const name = String(searchParams.get("name") || "").trim();
  const brand = String(searchParams.get("brand") || "").trim();
  const quantity = String(searchParams.get("quantity") || "").trim();
  const limit = Number(searchParams.get("limit")) || 18;

  if (name.length < 2) {
    return NextResponse.json(
      {
        error: "Informe ao menos o nome do produto para buscar ofertas.",
      },
      { status: 400 },
    );
  }

  try {
    const response = await searchShoppingOffers(
      scope,
      {
        name,
        brand,
        quantity,
      },
      limit,
    );

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel consultar as lojas agora.",
      },
      { status: 500 },
    );
  }
}
