import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isFounderEmail } from "@/lib/access-entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Inventário do KV: DBSIZE + contagem por prefixo conhecido + amostra das
 * primeiras chaves de cada prefixo. Usado pra diagnosticar perda total:
 *  - DBSIZE = 0 → KV completamente vazio (provável: integração recriada,
 *                 banco trocado, ou TTL/limpeza geral).
 *  - DBSIZE > 0 mas accountState=0 → KV vivo, accounts foram apagados
 *                                    (ou nunca existiram nesse banco).
 *  - Algum prefixo NÃO-zerado → dados parciais preservados.
 *
 * ADMIN-ONLY: gated por isFounderEmail. Só conta keys + retorna nomes
 * (sem conteúdo). Lista até 50 amostras por prefixo pra evitar payload
 * gigante.
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

async function scanPattern(
  pattern: string,
  maxKeys = 1000,
): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";
  let safety = 0;
  while (keys.length < maxKeys) {
    const result = (await kvCommand<[string, string[]]>([
      "SCAN",
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      500,
    ])) as [string, string[]] | null;
    if (!result) break;
    const [next, batch] = result;
    keys.push(...(batch ?? []));
    cursor = String(next);
    safety += 1;
    if (cursor === "0" || safety > 200) break;
  }
  return keys.slice(0, maxKeys);
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

  const dbSize = (await kvCommand<number>(["DBSIZE"])) ?? 0;

  const knownPrefixes = [
    "praxis:account-state:*",
    "praxis:tg:chat:*",
    "praxis:tg:user:*",
    "praxis:tg:link:*",
    "praxis:notif:*",
    "praxis:notif:u:*",
    "praxis:notif:store",
  ];

  const sampledPrefixes = await Promise.all(
    knownPrefixes.map(async (pattern) => {
      const keys = await scanPattern(pattern, 200);
      return {
        pattern,
        count: keys.length,
        sample: keys.slice(0, 25),
      };
    }),
  );

  // Amostra de QUALQUER coisa no KV (até 50). Se DBSIZE > 0 mas todas
  // as contagens prefixadas batem 0, isso mostra que prefixos existem
  // que a gente não conhece (talvez a integração recriou com outro
  // prefixo).
  const anyKeys = await scanPattern("*", 50);

  return NextResponse.json({
    dbSize,
    prefixes: sampledPrefixes,
    anyKeysSample: anyKeys,
  });
}
