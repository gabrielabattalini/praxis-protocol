import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAccountState } from "@/lib/account-state.server";
import type { PersistedState } from "@/lib/types";
import {
  buildWeeklyReport,
  weekReference,
} from "@/lib/weekly-report";
import { generateWeeklyReportPdf } from "@/lib/weekly-report-pdf";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

// GET /api/reports/weekly/pdf?weeksAgo=1
// Gera o PDF do relatório semanal do usuário autenticado para a semana
// indicada por weeksAgo (0 = atual, 1 = última fechada, padrão). Usado
// pelo botão "Baixar PDF" na página /relatorios.
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  // Geração de PDF é cara. 10/min por usuário.
  const limited = await enforceRateLimit("weekly-pdf", userId, 10, 60);
  if (limited) return limited;

  const envelope = await getAccountState(userId);
  if (!envelope) {
    return NextResponse.json(
      { error: "Estado da conta indisponível." },
      { status: 404 },
    );
  }

  const url = new URL(request.url);
  const weeksAgoRaw = Number(url.searchParams.get("weeksAgo") ?? "1");
  const weeksAgo = Number.isFinite(weeksAgoRaw) && weeksAgoRaw >= 0
    ? Math.floor(weeksAgoRaw)
    : 1;

  try {
    // envelope.state é tipado como unknown (versionamento tolerante).
    // O motor do relatório só lê campos opcionais (tasks, mealPlan,
    // workoutPlan etc.) com fallback pra arrays vazios, então o cast
    // é seguro mesmo se algum campo estiver ausente.
    const report = buildWeeklyReport(
      envelope.state as PersistedState,
      weekReference(weeksAgo),
    );
    const pdf = await generateWeeklyReportPdf(report);
    const filename = `praxis-relatorio-${report.weekStartKey}.pdf`;

    return new Response(pdf as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[reports/weekly/pdf] failed:", error);
    return NextResponse.json(
      { error: "Falha ao gerar o PDF do relatório." },
      { status: 500 },
    );
  }
}
