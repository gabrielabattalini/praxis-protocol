import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAccountStateHistory } from "@/lib/account-state.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Diagnóstico de presença/tamanho dos dados do usuário autenticado no
 * KV. Usado pra rastrear "minha conta sumiu":
 *  - mostra o userId/email atuais (descarta caso de "userId mudou")
 *  - existência e tamanho do account-state principal (KEY exists? size?)
 *  - quantidade de versões no histórico
 *  - existência de notificações (telegram binding, push subs) — se
 *    EXISTEM, é sinal de que o usuário JÁ usou o app sob este userId
 *    (descarta também "usuário novo do zero").
 *
 * Autenticado, scope por userId, sem debug-gate (operação leve, dados do
 * próprio dono). Não retorna nenhum conteúdo de outro usuário.
 */

const KV_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const KV_ENABLED = Boolean(KV_URL && KV_TOKEN);

async function kvCommand<T = unknown>(
  command: Array<string | number>,
): Promise<T | null> {
  if (!KV_ENABLED) return null;
  try {
    const response = await fetch(KV_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { result?: T };
    return payload.result ?? null;
  } catch {
    return null;
  }
}

async function kvSize(key: string): Promise<{
  exists: boolean;
  sizeBytes: number;
}> {
  const exists = (await kvCommand<number>(["EXISTS", key])) ?? 0;
  if (!exists) return { exists: false, sizeBytes: 0 };
  const size = (await kvCommand<number>(["STRLEN", key])) ?? 0;
  return { exists: true, sizeBytes: size };
}

async function kvListLen(key: string): Promise<number> {
  return (await kvCommand<number>(["LLEN", key])) ?? 0;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  const accountStateKey = `praxis:account-state:${userId}`;
  const historyKey = `praxis:account-state:${userId}:history`;
  const tgBindingKey = `praxis:tg:chat:${userId}`;
  const userSubsKey = `praxis:notif:u:${userId}:subs`;
  const userSchedKey = `praxis:notif:u:${userId}:sched`;
  const dispatchLogKey = `praxis:notif:u:${userId}:dispatchlog`;

  const [
    accountState,
    historyEntries,
    history,
    tgBinding,
    pushSubs,
    pushSched,
    dispatchLog,
  ] = await Promise.all([
    kvSize(accountStateKey),
    kvListLen(historyKey),
    getAccountStateHistory(userId),
    kvSize(tgBindingKey),
    kvSize(userSubsKey),
    kvSize(userSchedKey),
    kvSize(dispatchLogKey),
  ]);

  return NextResponse.json({
    kvEnabled: KV_ENABLED,
    userId,
    email,
    accountState: {
      key: accountStateKey,
      exists: accountState.exists,
      sizeBytes: accountState.sizeBytes,
    },
    history: {
      key: historyKey,
      entries: historyEntries,
      versions: history.map((entry) => ({
        version: entry.version,
        updatedAt: entry.updatedAt,
      })),
    },
    // Indicadores de "este userId já usou o app". Se nenhum existe, o
    // userId atual é genuinamente novo (não houve perda — usuário trocou
    // de identidade). Se algum existe SEM o account-state, o state foi
    // de fato apagado/perdido pra este userId.
    related: {
      telegramBinding: tgBinding.exists,
      pushSubscriptions: pushSubs.exists,
      pushSchedule: pushSched.exists,
      dispatchLog: dispatchLog.exists,
    },
  });
}
