import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { searchShoppingOffers } from "@/lib/shopping-search.server";
import type { DoseUnit, ShoppingModuleScope } from "@/lib/shopping-search";

export const dynamic = "force-dynamic";

const VALID_DOSE_UNITS: DoseUnit[] = ["mg", "g", "mcg", "ml", "serving"];

export async function GET(request: Request) {
  // Defesa em profundidade — não confiar só no middleware (o leitor de
  // ofertas usa axios + Playwright e seria alvo de abuso se exposto).
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const scopeParam = String(searchParams.get("scope") || "market").trim();
  const scope: ShoppingModuleScope =
    scopeParam === "supplements" ? "supplements" : "market";
  const name = String(searchParams.get("name") || "").trim();
  const brand = String(searchParams.get("brand") || "").trim();
  const quantity = String(searchParams.get("quantity") || "").trim();
  const limit = Number(searchParams.get("limit")) || 18;

  const doseAmountRaw = searchParams.get("dailyDoseAmount");
  const doseUnitRaw = searchParams.get("dailyDoseUnit");
  const dailyDoseAmount = doseAmountRaw
    ? Number(String(doseAmountRaw).replace(",", "."))
    : undefined;
  const dailyDoseUnit =
    doseUnitRaw && VALID_DOSE_UNITS.includes(doseUnitRaw as DoseUnit)
      ? (doseUnitRaw as DoseUnit)
      : undefined;

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
        dailyDoseAmount:
          dailyDoseAmount && dailyDoseAmount > 0 ? dailyDoseAmount : undefined,
        dailyDoseUnit,
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
