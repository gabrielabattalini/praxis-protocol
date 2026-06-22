import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { saveAccountState } from "@/lib/account-state.server";
import { isFounderEmail } from "@/lib/access-entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Migra o account-state de um userId ORIGEM pro userId atual logado.
 * Usado quando o Clerk regerou o userId do mesmo email (vide print do
 * /api/account/diagnose: related.* todos false → identidade nova) e os
 * dados ficaram presos numa chave órfã.
 *
 * ADMIN-ONLY: gated por isFounderEmail. Operação destrutiva potencial
 * (sobrescreve o state atual, mas o saveAccountState empilha o atual
 * no histórico antes — dá pra reverter via /recover).
 *
 * Body: { fromUserId: "user_xxx..." }
 */

const KV_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

async function kvGetRaw(key: string): Promise<string | null> {
  try {
    const response = await fetch(KV_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["GET", key]),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { result?: string | null };
    return payload.result ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 });
  }
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  if (!(await isFounderEmail(email))) {
    return new NextResponse(null, { status: 404 });
  }

  let body: { fromUserId?: unknown };
  try {
    body = (await request.json()) as { fromUserId?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  const fromUserId = typeof body?.fromUserId === "string" ? body.fromUserId.trim() : "";
  if (!/^user_[A-Za-z0-9]+$/.test(fromUserId)) {
    return NextResponse.json(
      {
        error: "fromUserId-required",
        message: "Envie { fromUserId: 'user_xxx...' }.",
      },
      { status: 400 },
    );
  }
  if (fromUserId === userId) {
    return NextResponse.json(
      { error: "same-user", message: "Origem é igual ao destino." },
      { status: 400 },
    );
  }

  const sourceKey = `praxis:account-state:${fromUserId}`;
  const raw = await kvGetRaw(sourceKey);
  if (!raw) {
    return NextResponse.json(
      { error: "source-not-found", sourceKey },
      { status: 404 },
    );
  }

  let envelope: { version?: number; updatedAt?: string; state?: unknown };
  try {
    envelope = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "source-corrupt" }, { status: 500 });
  }
  if (!envelope.state || typeof envelope.state !== "object") {
    return NextResponse.json({ error: "source-empty" }, { status: 422 });
  }

  // saveAccountState empilha o atual no histórico antes de sobrescrever
  // → restore acidental reversível via /recover.
  const saved = await saveAccountState(userId, {
    version: Number(envelope.version ?? 1),
    updatedAt: new Date().toISOString(),
    state: envelope.state,
  });

  return NextResponse.json({
    migrated: {
      fromUserId,
      sourceVersion: envelope.version,
      sourceUpdatedAt: envelope.updatedAt,
    },
    current: {
      userId,
      version: saved.version,
      updatedAt: saved.updatedAt,
    },
  });
}
