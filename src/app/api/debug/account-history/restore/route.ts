import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  getAccountStateHistory,
  saveAccountState,
} from "@/lib/account-state.server";
import { isDebugAllowed } from "@/lib/security/debug-gate";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Restaura uma versão anterior do account-state.
 *
 * POST { index: number } onde index 0 = mais recente do histórico
 * (penúltima salva no servidor). O histórico tem até 10 fotografias.
 *
 * Usado pra recuperar de perdas catastróficas — ex.: state vazio
 * sobrescrevendo dados por bug de rehydration. Não substitui o
 * histórico — só promove a versão escolhida pra "current" (a versão
 * atual vai pro topo do histórico antes de ser sobrescrita).
 *
 * Gated por debug-gate (404 fora de prod).
 */
export async function POST(request: Request) {
  if (!isDebugAllowed()) {
    return new NextResponse(null, { status: 404 });
  }
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 });
  }

  let payload: { index?: unknown };
  try {
    payload = (await request.json()) as { index?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  const index = Number(payload?.index);
  if (!Number.isInteger(index) || index < 0) {
    return NextResponse.json(
      { error: "index-required", message: "Body precisa de { index: number (0+) }" },
      { status: 400 },
    );
  }

  const history = await getAccountStateHistory(userId);
  if (index >= history.length) {
    return NextResponse.json(
      {
        error: "index-out-of-range",
        historyCount: history.length,
        message: `Histórico tem ${history.length} entradas; index ${index} inválido.`,
      },
      { status: 400 },
    );
  }

  const target = history[index];
  // Bump version pelo saveAccountState (que é monotônico): o estado
  // atual vai pro histórico antes de ser substituído pelo target.
  const restored = await saveAccountState(userId, {
    version: target.version,
    updatedAt: new Date().toISOString(),
    state: target.state,
  });

  return NextResponse.json({
    restored: {
      fromIndex: index,
      originalUpdatedAt: target.updatedAt,
      originalVersion: target.version,
    },
    current: {
      version: restored.version,
      updatedAt: restored.updatedAt,
    },
  });
}
