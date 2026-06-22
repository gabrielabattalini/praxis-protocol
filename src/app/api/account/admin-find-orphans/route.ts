import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isFounderEmail } from "@/lib/access-entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Lista TODAS as chaves `praxis:account-state:*` (sem `:history`) no KV,
 * com tamanho de cada. Usado pra rastrear estado órfão de usuários cujo
 * Clerk userId mudou (mesmo email → identidade nova, dados antigos
 * presos no userId antigo).
 *
 * ADMIN-ONLY: gated por isFounderEmail (gabrielabattalini@gmail.com),
 * porque expõe metadados das chaves de OUTROS usuários (não conteúdo —
 * só userId+tamanho). Sem isso, qualquer logado conseguiria enumerar
 * userIds da plataforma.
 *
 * Não retorna conteúdo dos states — só userId, sizeBytes, e timestamp
 * do envelope (lido via GET separado pra cada chave grande).
 */

const KV_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

async function kvCommand<T = unknown>(
  command: Array<string | number>,
): Promise<T | null> {
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

async function scanAll(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string = "0";
  let safety = 0;
  while (true) {
    const result = (await kvCommand<[string, string[]]>([
      "SCAN",
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      500,
    ])) as [string, string[]] | null;
    if (!result) break;
    const [nextCursor, batch] = result;
    keys.push(...(batch ?? []));
    cursor = String(nextCursor);
    safety += 1;
    if (cursor === "0" || safety > 200) break;
  }
  return keys;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 });
  }
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  if (!(await isFounderEmail(email))) {
    return new NextResponse(null, { status: 404 });
  }

  const allKeys = await scanAll("praxis:account-state:*");
  // Só as chaves principais (sem `:history`).
  const stateKeys = allKeys.filter((k) => !k.endsWith(":history"));

  const entries = await Promise.all(
    stateKeys.map(async (key) => {
      const size = (await kvCommand<number>(["STRLEN", key])) ?? 0;
      const raw = (await kvCommand<string>(["GET", key])) ?? null;
      let updatedAt: string | undefined;
      let version: number | undefined;
      let countsSummary: Record<string, number> | undefined;
      if (raw) {
        try {
          const env = JSON.parse(raw) as {
            version?: number;
            updatedAt?: string;
            state?: Record<string, unknown>;
          };
          updatedAt = env.updatedAt;
          version = env.version;
          const s = env.state ?? {};
          countsSummary = {
            tasks: Array.isArray((s as { tasks?: unknown[] }).tasks)
              ? ((s as { tasks: unknown[] }).tasks.length as number)
              : 0,
            mealPlanBlocks: Array.isArray((s as { mealPlan?: unknown[] }).mealPlan)
              ? ((s as { mealPlan: unknown[] }).mealPlan.length as number)
              : 0,
            financeLines: Array.isArray(
              (s as { financeBudget?: { lines?: unknown[] } }).financeBudget?.lines,
            )
              ? ((s as { financeBudget: { lines: unknown[] } }).financeBudget.lines
                  .length as number)
              : 0,
          };
        } catch {
          /* ignora envelope corrompido */
        }
      }
      const userIdFromKey = key.replace("praxis:account-state:", "");
      return {
        key,
        userId: userIdFromKey,
        isCurrent: userIdFromKey === userId,
        sizeBytes: size,
        version,
        updatedAt,
        counts: countsSummary,
      };
    }),
  );

  // Ordena: maior primeiro (provável estado lotado do usuário antigo).
  entries.sort((a, b) => b.sizeBytes - a.sizeBytes);

  return NextResponse.json({
    currentUserId: userId,
    totalKeys: entries.length,
    entries,
  });
}
