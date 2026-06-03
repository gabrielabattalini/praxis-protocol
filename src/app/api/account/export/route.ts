import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAccountState } from "@/lib/account-state.server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Baixa o account-state completo do usuário autenticado como JSON.
 * Envelope de backup carrega versão, userId, email (verificação) e
 * timestamp pra import safe.
 *
 * Autenticado por Clerk (não está em isPublicRoute).
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 });
  }

  const envelope = await getAccountState(userId);
  if (!envelope) {
    return NextResponse.json(
      { error: "no-account-state" },
      { status: 404 },
    );
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const exportedAt = new Date().toISOString();

  const backup = {
    backupFormat: 1,
    userId,
    email,
    exportedAt,
    accountStateUpdatedAt: envelope.updatedAt,
    state: envelope.state,
  };

  const filenameDate = exportedAt.slice(0, 19).replace(/[:T]/g, "-");
  const filename = `praxis-backup-${filenameDate}.json`;

  return new NextResponse(JSON.stringify(backup, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
