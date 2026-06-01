import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAccountStateHistory } from "@/lib/account-state.server";
import type { PersistedState } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Lista as versões anteriores do account-state do usuário autenticado.
 * Cada save guarda a versão CORRENTE no histórico antes de sobrescrever
 * — então aqui temos as últimas 10 "fotografias" do estado.
 *
 * Útil pra recuperação após perda de dados (ex.: duplicação bugada de
 * dieta que sobrescreve mealPlan live). Não é restore — só visualização.
 * O restore tem que ser feito por uma action separada com revisão manual.
 *
 * Retorna SÓ os campos relevantes pra dieta (mealPlan, dietPlans,
 * activeDietPlanId) pra cada versão, pra evitar JSON gigante.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 });
  }

  const history = await getAccountStateHistory(userId);

  const summary = history.map((entry, index) => {
    const state = entry.state as PersistedState;
    const mealPlan = state.mealPlan ?? [];
    const dietPlans = state.dietPlans ?? [];
    return {
      index, // 0 = mais recente do histórico (penúltima versão salva)
      updatedAt: entry.updatedAt,
      activeDietPlanId: state.activeDietPlanId,
      counts: {
        mealPlanBlocks: mealPlan.length,
        dietPlans: dietPlans.length,
        tasks: (state.tasks ?? []).length,
        reminders: (state.reminders ?? []).length,
      },
      mealPlanBlocks: mealPlan.map((b) => ({
        id: b.id,
        title: b.title,
        time: b.time,
        itemCount: b.items.length,
        itemLabels: b.items.map((it) => it.label),
      })),
      dietPlans: dietPlans.map((p) => ({
        id: p.id,
        name: p.name,
        createdAt: p.createdAt,
        blockCount: (p.mealPlan ?? []).length,
        blocks: (p.mealPlan ?? []).map((b) => ({
          id: b.id,
          title: b.title,
          time: b.time,
          itemCount: b.items.length,
        })),
      })),
    };
  });

  return NextResponse.json({
    userId,
    historyCount: history.length,
    note:
      history.length === 0
        ? "Sem histórico ainda — o primeiro save após este deploy começa a registrar."
        : `Últimas ${history.length} versões antes do save atual (mais recente primeiro).`,
    versions: summary,
  });
}
