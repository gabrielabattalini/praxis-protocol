import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getAccountState, saveAccountState } from "@/lib/account-state.server";
import {
  PayloadTooLargeError,
  readJsonWithLimit,
} from "@/lib/security/request-body";

export const runtime = "nodejs";

const ACCOUNT_STATE_MAX_BYTES = 1_000_000;

const accountStateSchema = z.object({
  version: z.coerce.number().int().min(1).max(1_000_000).optional(),
  updatedAt: z.string().trim().min(1).max(80).optional(),
  state: z.unknown(),
});

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const state = await getAccountState(userId);

  if (!state) {
    return NextResponse.json({ error: "Estado não encontrado." }, { status: 404 });
  }

  return NextResponse.json(state);
}

export async function PUT(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const body = accountStateSchema.parse(
      await readJsonWithLimit<unknown>(request, ACCOUNT_STATE_MAX_BYTES),
    );

    const saved = await saveAccountState(userId, {
      version: Number(body.version ?? 1),
      updatedAt: body.updatedAt,
      state: body.state,
    });

    return NextResponse.json(saved);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json(
        { error: "Carga de estado maior do que o permitido." },
        { status: 413 },
      );
    }

    return NextResponse.json(
      { error: "Carga de estado inválida." },
      { status: 400 },
    );
  }
}
