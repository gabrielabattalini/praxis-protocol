import { NextResponse } from "next/server";
import { isUsdaDatabaseAvailable, searchUsdaFoods } from "@/lib/usda-foods.server";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  if (!isUsdaDatabaseAvailable()) {
    return NextResponse.json(
      {
        error:
          "Banco USDA não importado ainda. Rode `npm run import:usda` para gerar o SQLite local.",
      },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const limit = Number(searchParams.get("limit")) || 12;

  if (query.length < 2) {
    return NextResponse.json({ foods: [] });
  }

  return NextResponse.json({
    foods: searchUsdaFoods(query, limit),
  });
}
