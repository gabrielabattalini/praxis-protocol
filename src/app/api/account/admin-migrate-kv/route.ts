import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isFounderEmail } from "@/lib/access-entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Migra todas as chaves de UM Upstash KV (legacy) pro KV atual do app.
 * Usado depois de trocar o banco do projeto na Vercel — copia os dados
 * do banco antigo pra o novo sem precisar de mexer no Vercel diretamente.
 *
 * Lê o endpoint+token do banco LEGACY de env vars (não recebe via request
 * pra não vazar token no histórico). Lê o banco DESTINO das mesmas env
 * vars que o app já usa (KV_REST_API_URL/TOKEN ou UPSTASH_REDIS_REST_*).
 *
 * Operações:
 *  GET  → dry-run: lista chaves do legacy com contagem, sem escrever.
 *  POST → migração de verdade. Body opcional:
 *         { force?: boolean }  — se true, sobrescreve chaves que já
 *         existem no destino. Default false: chaves duplicadas são
 *         puladas (preserva o que tiver no destino).
 *
 * Limitações:
 *  - Strings, listas, hashes, sets. PubSub/streams/scripts não migram.
 *  - Pode levar até 300s (limite Vercel). Banco grande precisa dividir.
 *
 * ADMIN-ONLY: gated por isFounderEmail.
 */

const LEGACY_URL = (process.env.LEGACY_KV_REST_API_URL || "").trim();
const LEGACY_TOKEN = (process.env.LEGACY_KV_REST_API_TOKEN || "").trim();

const TARGET_URL = (
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  ""
).trim();
const TARGET_TOKEN = (
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  ""
).trim();

async function kvCmd<T = unknown>(
  baseUrl: string,
  token: string,
  command: Array<string | number>,
): Promise<T | null> {
  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
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

async function scanAll(
  baseUrl: string,
  token: string,
  pattern = "*",
  maxKeys = 100_000,
): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";
  let safety = 0;
  while (keys.length < maxKeys) {
    const result = (await kvCmd<[string, string[]]>(baseUrl, token, [
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
    if (cursor === "0" || safety > 1000) break;
  }
  return keys.slice(0, maxKeys);
}

function isConfigured(): { ok: true } | { ok: false; reason: string } {
  if (!LEGACY_URL || !LEGACY_TOKEN) {
    return {
      ok: false,
      reason:
        "Configure as env vars LEGACY_KV_REST_API_URL e LEGACY_KV_REST_API_TOKEN no Vercel com as credenciais do banco ANTIGO, depois redeploy.",
    };
  }
  if (!TARGET_URL || !TARGET_TOKEN) {
    return {
      ok: false,
      reason: "Banco de DESTINO não configurado (KV_REST_API_*).",
    };
  }
  if (LEGACY_URL === TARGET_URL) {
    return {
      ok: false,
      reason: "LEGACY e TARGET apontam pro MESMO banco. Configure o LEGACY pra apontar pro banco ANTIGO.",
    };
  }
  return { ok: true };
}

async function ensureAuthorized() {
  const { userId } = await auth();
  if (!userId) {
    return {
      err: NextResponse.json({ error: "not-authenticated" }, { status: 401 }),
    };
  }
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  if (!(await isFounderEmail(email))) {
    return { err: new NextResponse(null, { status: 404 }) };
  }
  return { err: null };
}

export async function GET() {
  const guard = await ensureAuthorized();
  if (guard.err) return guard.err;
  const config = isConfigured();
  if (!config.ok) {
    return NextResponse.json({ ok: false, reason: config.reason }, { status: 400 });
  }

  // Dry-run: lista chaves do legacy + alguns counts por prefixo.
  const keys = await scanAll(LEGACY_URL, LEGACY_TOKEN, "*");
  const byPrefix = new Map<string, number>();
  for (const k of keys) {
    const prefix = k.split(":").slice(0, 2).join(":") + ":*";
    byPrefix.set(prefix, (byPrefix.get(prefix) ?? 0) + 1);
  }
  return NextResponse.json({
    legacyEndpoint: LEGACY_URL.replace(/https?:\/\//, ""),
    targetEndpoint: TARGET_URL.replace(/https?:\/\//, ""),
    totalKeys: keys.length,
    prefixes: Array.from(byPrefix.entries())
      .map(([prefix, count]) => ({ prefix, count }))
      .sort((a, b) => b.count - a.count),
    sample: keys.slice(0, 25),
  });
}

type MigrationResult = {
  ok: boolean;
  totalKeys: number;
  copied: number;
  skipped: number;
  failed: number;
  failedSample: string[];
  durationMs: number;
};

export async function POST(request: Request) {
  const guard = await ensureAuthorized();
  if (guard.err) return guard.err;
  const config = isConfigured();
  if (!config.ok) {
    return NextResponse.json({ ok: false, reason: config.reason }, { status: 400 });
  }

  let body: { force?: unknown };
  try {
    body = (await request.json().catch(() => ({}))) as { force?: unknown };
  } catch {
    body = {};
  }
  const force = body?.force === true;

  const startedAt = Date.now();
  const keys = await scanAll(LEGACY_URL, LEGACY_TOKEN, "*");
  const result: MigrationResult = {
    ok: true,
    totalKeys: keys.length,
    copied: 0,
    skipped: 0,
    failed: 0,
    failedSample: [],
    durationMs: 0,
  };

  // Processa em batches sequenciais — limita carga concorrente nos KVs
  // (rate limit do Upstash REST API é por endpoint). Pra cada chave,
  // detecta o tipo (TYPE) e copia preservando a estrutura.
  for (const key of keys) {
    try {
      if (!force) {
        const existsInTarget = await kvCmd<number>(TARGET_URL, TARGET_TOKEN, [
          "EXISTS",
          key,
        ]);
        if (existsInTarget === 1) {
          result.skipped += 1;
          continue;
        }
      }
      const type = await kvCmd<string>(LEGACY_URL, LEGACY_TOKEN, ["TYPE", key]);
      if (!type || type === "none") {
        result.skipped += 1;
        continue;
      }

      if (type === "string") {
        const value = await kvCmd<string>(LEGACY_URL, LEGACY_TOKEN, [
          "GET",
          key,
        ]);
        if (value === null) {
          result.skipped += 1;
          continue;
        }
        // PEXPIRE-aware: copia TTL se houver. PTTL retorna ms.
        const pttl = await kvCmd<number>(LEGACY_URL, LEGACY_TOKEN, ["PTTL", key]);
        if (typeof pttl === "number" && pttl > 0) {
          await kvCmd(TARGET_URL, TARGET_TOKEN, [
            "SET",
            key,
            value,
            "PX",
            pttl,
          ]);
        } else {
          await kvCmd(TARGET_URL, TARGET_TOKEN, ["SET", key, value]);
        }
        result.copied += 1;
      } else if (type === "list") {
        const items = await kvCmd<string[]>(LEGACY_URL, LEGACY_TOKEN, [
          "LRANGE",
          key,
          0,
          -1,
        ]);
        if (!items || items.length === 0) {
          result.skipped += 1;
          continue;
        }
        // DEL antes pra evitar duplicar se force=true. Pra force=false já
        // pulamos antes (EXISTS), então DEL aqui só roda em criação real.
        await kvCmd(TARGET_URL, TARGET_TOKEN, ["DEL", key]);
        // RPUSH preserva a ordem do LRANGE 0..-1.
        await kvCmd(TARGET_URL, TARGET_TOKEN, ["RPUSH", key, ...items]);
        result.copied += 1;
      } else if (type === "hash") {
        const flat = await kvCmd<Record<string, string>>(
          LEGACY_URL,
          LEGACY_TOKEN,
          ["HGETALL", key],
        );
        if (!flat || Object.keys(flat).length === 0) {
          result.skipped += 1;
          continue;
        }
        const args: (string | number)[] = ["HSET", key];
        for (const [field, value] of Object.entries(flat)) {
          args.push(field, value);
        }
        await kvCmd(TARGET_URL, TARGET_TOKEN, ["DEL", key]);
        await kvCmd(TARGET_URL, TARGET_TOKEN, args);
        result.copied += 1;
      } else if (type === "set") {
        const members = await kvCmd<string[]>(LEGACY_URL, LEGACY_TOKEN, [
          "SMEMBERS",
          key,
        ]);
        if (!members || members.length === 0) {
          result.skipped += 1;
          continue;
        }
        await kvCmd(TARGET_URL, TARGET_TOKEN, ["DEL", key]);
        await kvCmd(TARGET_URL, TARGET_TOKEN, ["SADD", key, ...members]);
        result.copied += 1;
      } else if (type === "zset") {
        const flat = await kvCmd<string[]>(LEGACY_URL, LEGACY_TOKEN, [
          "ZRANGE",
          key,
          0,
          -1,
          "WITHSCORES",
        ]);
        if (!flat || flat.length === 0) {
          result.skipped += 1;
          continue;
        }
        await kvCmd(TARGET_URL, TARGET_TOKEN, ["DEL", key]);
        const args: (string | number)[] = ["ZADD", key];
        for (let i = 0; i < flat.length; i += 2) {
          args.push(flat[i + 1], flat[i]);
        }
        await kvCmd(TARGET_URL, TARGET_TOKEN, args);
        result.copied += 1;
      } else {
        result.skipped += 1;
      }
    } catch {
      result.failed += 1;
      if (result.failedSample.length < 25) result.failedSample.push(key);
    }
  }

  result.durationMs = Date.now() - startedAt;
  return NextResponse.json(result);
}
