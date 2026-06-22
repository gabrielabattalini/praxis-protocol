import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  getAccountStateHistory,
  saveAccountState,
} from "@/lib/account-state.server";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import type { PersistedState } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Recuperação de dados pelo PRÓPRIO dono da conta.
 *
 * Diferente de /api/debug/account-history (gated por ENABLE_DEBUG_ROUTES),
 * essa rota está sempre disponível pra qualquer usuário autenticado —
 * porque restaurar uma versão anterior do PRÓPRIO estado é função normal
 * de produto, não debug. Cada conta só vê e restaura o histórico DELA
 * (auth + scope por userId).
 *
 * GET  → lista as últimas 10 fotografias com data e contagem dos campos
 *        principais (sem JSON gigante).
 * POST { index } → promove a versão escolhida pra "current"; a atual vai
 *        pro topo do histórico antes (kvPushHistory automático).
 *
 * Rate-limit: 10 listagens/min, 3 restores/min — operação cara no KV.
 */

function summarize(state: PersistedState) {
  return {
    tasks: (state.tasks ?? []).length,
    mealPlanBlocks: (state.mealPlan ?? []).length,
    dietPlans: (state.dietPlans ?? []).length,
    reminders: (state.reminders ?? []).length,
    workoutPrograms: (state.workoutPrograms ?? []).length,
    workoutLoadEntries: (state.workoutLoadEntries ?? []).length,
    weightEntries: (state.weightEntries ?? []).length,
    financeBudgetLines: (state.financeBudget?.lines ?? []).length,
    householdSupplies: (state.householdSupplies ?? []).length,
  };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 });
  }

  const limited = await enforceRateLimit("account-recover-list", userId, 10, 60);
  if (limited) return limited;

  const history = await getAccountStateHistory(userId);
  return NextResponse.json({
    historyCount: history.length,
    versions: history.map((entry, index) => ({
      index,
      version: entry.version,
      updatedAt: entry.updatedAt,
      counts: summarize(entry.state as PersistedState),
    })),
  });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 });
  }

  const limited = await enforceRateLimit("account-recover-restore", userId, 3, 60);
  if (limited) return limited;

  let payload: { index?: unknown };
  try {
    payload = (await request.json()) as { index?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  const index = Number(payload?.index);
  if (!Number.isInteger(index) || index < 0) {
    return NextResponse.json(
      {
        error: "index-required",
        message: "Envie { index: número >= 0 }.",
      },
      { status: 400 },
    );
  }

  const history = await getAccountStateHistory(userId);
  if (index >= history.length) {
    return NextResponse.json(
      {
        error: "index-out-of-range",
        historyCount: history.length,
        message: `Histórico tem ${history.length} entradas; índice ${index} inválido.`,
      },
      { status: 400 },
    );
  }

  const target = history[index];
  const restored = await saveAccountState(userId, {
    version: target.version,
    updatedAt: new Date().toISOString(),
    state: target.state,
  });

  return NextResponse.json({
    restored: {
      fromIndex: index,
      originalVersion: target.version,
      originalUpdatedAt: target.updatedAt,
      counts: summarize(target.state as PersistedState),
    },
    current: {
      version: restored.version,
      updatedAt: restored.updatedAt,
    },
  });
}
