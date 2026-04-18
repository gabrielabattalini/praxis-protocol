import { NextResponse } from "next/server";
import { isTbcaDatabaseAvailable, searchTbcaFoods } from "@/lib/tbca-foods.server";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  if (!isTbcaDatabaseAvailable()) {
    return NextResponse.json(
      {
        error:
          "Banco TBCA não importado ainda. Rode `npm run import:tbca` para gerar o SQLite local.",
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
    foods: searchTbcaFoods(query, limit),
  });
}
