import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAccountState, saveAccountState } from "@/lib/account-state.server";
import {
  PayloadTooLargeError,
  readJsonWithLimit,
} from "@/lib/security/request-body";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BACKUP_MAX_BYTES = 5_000_000; // 5 MB de margem do envelope
// O state em si tem o MESMO teto do PUT normal (account-state) — sem
// isto, o import era um bypass do cap de 1MB → bloat de KV (cada save
// empilha até 10 versões no histórico). Mantém os dois caminhos iguais.
const STATE_MAX_BYTES = 1_000_000;

type BackupPayload = {
  backupFormat?: number;
  userId?: string;
  email?: string | null;
  exportedAt?: string;
  accountStateUpdatedAt?: string;
  state?: unknown;
};

/**
 * Restaura o account-state a partir de um arquivo de backup.
 * Substitui o estado atual no servidor pelo conteúdo do backup.
 *
 * Validações:
 * - O userId no backup deve bater com o userId logado (não permite
 *   importar backup de outra conta).
 * - state deve existir e ser objeto.
 * - Antes de sobrescrever, o save existente é empilhado no histórico
 *   automaticamente (saveAccountState já faz isso).
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 });
  }

  // Import é caro (sobrescreve + empilha histórico). 10/min basta.
  const limited = await enforceRateLimit("account-import", userId, 10, 60);
  if (limited) return limited;

  let body: BackupPayload;
  try {
    body = await readJsonWithLimit<BackupPayload>(request, BACKUP_MAX_BYTES);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json(
        { error: "backup-too-large", maxBytes: BACKUP_MAX_BYTES },
        { status: 413 },
      );
    }
    return NextResponse.json(
      { error: "invalid-json" },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid-backup" }, { status: 400 });
  }

  if (body.userId && body.userId !== userId) {
    // Backup é de outra conta — recusa, não confunde os dois.
    return NextResponse.json(
      {
        error: "user-mismatch",
        message: "Esse backup é de outra conta — abra-o no mesmo login que o gerou.",
      },
      { status: 403 },
    );
  }

  if (!body.state || typeof body.state !== "object") {
    return NextResponse.json(
      { error: "invalid-state", message: "Backup sem campo 'state'." },
      { status: 400 },
    );
  }

  // Mesmo teto do PUT normal pro state — fecha o bypass do cap de 1MB.
  if (Buffer.byteLength(JSON.stringify(body.state), "utf8") > STATE_MAX_BYTES) {
    return NextResponse.json(
      { error: "state-too-large", maxBytes: STATE_MAX_BYTES },
      { status: 413 },
    );
  }

  // Pega versão atual pra preservar o version number (saveAccountState
  // também empilha esta versão no histórico antes de sobrescrever).
  const current = await getAccountState(userId);
  const saved = await saveAccountState(userId, {
    version: Number.isFinite(current?.version) ? current!.version : 1,
    updatedAt: new Date().toISOString(),
    state: body.state,
  });

  const user = await currentUser();
  return NextResponse.json({
    ok: true,
    restoredAt: saved.updatedAt,
    backupExportedAt: body.exportedAt,
    backupAccountStateUpdatedAt: body.accountStateUpdatedAt,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
  });
}
