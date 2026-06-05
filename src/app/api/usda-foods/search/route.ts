import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isUsdaDatabaseAvailable, searchUsdaFoods } from "@/lib/usda-foods.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Dado é público (banco de alimentos), mas exigir sessão evita abuso
  // do endpoint por terceiros — defesa em profundidade.
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

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
