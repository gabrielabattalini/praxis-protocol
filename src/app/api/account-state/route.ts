import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getAccountState, saveAccountState } from "@/lib/account-state.server";
import {
  PayloadTooLargeError,
  readJsonWithLimit,
} from "@/lib/security/request-body";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const ACCOUNT_STATE_MAX_BYTES = 1_000_000;

const accountStateSchema = z.object({
  version: z.coerce.number().int().min(1).max(1_000_000).optional(),
  // baseVersion = a versão do servidor sobre a qual o cliente editou.
  // Quando presente, ativa a checagem de concorrência otimista (clientes
  // antigos não enviam → caminho legado, sem checagem). min(0) cobre
  // contas que nunca foram salvas (versão 0).
  baseVersion: z.coerce.number().int().min(0).max(1_000_000).optional(),
  updatedAt: z.string().trim().min(1).max(80).optional(),
  state: z.unknown(),
});

/**
 * sourceKey prefixes for finance lines that were created OUTSIDE the
 * app (e.g. an xlsx import). The client doesn't know about them yet,
 * so a stale client PUT would silently wipe them. We preserve them
 * server-side: if the incoming PUT doesn't carry such a line, merge it
 * back in from the current KV snapshot. Same for the "Saldo em conta"
 * income category that ships with em-conta-fixed.
 */
const EXTERNAL_FINANCE_LINE_PREFIXES = ["xlsx-import-2026:", "em-conta-fixed"];
const EXTERNAL_FINANCE_CATEGORY_NAMES = new Set(["Saldo em conta"]);

function isExternalSourceKey(sourceKey: unknown): boolean {
  if (typeof sourceKey !== "string" || !sourceKey) return false;
  return EXTERNAL_FINANCE_LINE_PREFIXES.some(
    (prefix) => sourceKey === prefix || sourceKey.startsWith(prefix),
  );
}

function preserveExternalFinanceState(
  current: unknown,
  incoming: unknown,
): unknown {
  if (
    !current ||
    typeof current !== "object" ||
    !incoming ||
    typeof incoming !== "object"
  ) {
    return incoming;
  }

  const currentRecord = current as Record<string, unknown>;
  const incomingRecord = incoming as Record<string, unknown>;

  const currentBudget =
    (currentRecord.financeBudget as
      | { lines?: Array<Record<string, unknown>> }
      | undefined) ?? {};
  const incomingBudget =
    (incomingRecord.financeBudget as
      | { lines?: Array<Record<string, unknown>> }
      | undefined) ?? {};

  const currentLines = Array.isArray(currentBudget.lines)
    ? currentBudget.lines
    : [];
  const incomingLines = Array.isArray(incomingBudget.lines)
    ? incomingBudget.lines
    : [];

  const incomingSourceKeys = new Set(
    incomingLines
      .map((line) =>
        typeof line?.sourceKey === "string" ? line.sourceKey : null,
      )
      .filter((value): value is string => Boolean(value)),
  );
  const externalLinesToMerge = currentLines.filter(
    (line) =>
      isExternalSourceKey(line?.sourceKey) &&
      !incomingSourceKeys.has(line.sourceKey as string),
  );

  const currentCategories = Array.isArray(currentRecord.financeCategories)
    ? (currentRecord.financeCategories as Array<Record<string, unknown>>)
    : [];
  const incomingCategories = Array.isArray(incomingRecord.financeCategories)
    ? (incomingRecord.financeCategories as Array<Record<string, unknown>>)
    : [];
  // Dedup por id OU nome normalizado: se o usuário renomeou (id igual,
  // nome diferente) OU só mudou caixa/espaço (id diferente, nome ~igual),
  // ainda consideramos a categoria "presente" e NÃO re-inserimos. Antes
  // comparava só por nome exato, então renomear/variar caixa acumulava
  // várias "Saldo em conta" a cada PUT.
  const normalizeName = (value: unknown) =>
    typeof value === "string" ? value.trim().toLowerCase() : "";
  const incomingCategoryNames = new Set(
    incomingCategories
      .map((cat) => normalizeName(cat?.name))
      .filter((value) => value.length > 0),
  );
  const incomingCategoryIds = new Set(
    incomingCategories
      .map((cat) => (typeof cat?.id === "string" ? cat.id : null))
      .filter((value): value is string => Boolean(value)),
  );
  const externalCategoriesToMerge = currentCategories.filter(
    (cat) =>
      typeof cat?.name === "string" &&
      EXTERNAL_FINANCE_CATEGORY_NAMES.has(cat.name) &&
      !incomingCategoryNames.has(normalizeName(cat.name)) &&
      !(typeof cat?.id === "string" && incomingCategoryIds.has(cat.id)),
  );

  if (
    externalLinesToMerge.length === 0 &&
    externalCategoriesToMerge.length === 0
  ) {
    return incoming;
  }

  return {
    ...incomingRecord,
    financeBudget: {
      ...incomingBudget,
      lines: [...incomingLines, ...externalLinesToMerge],
    },
    financeCategories: [...incomingCategories, ...externalCategoriesToMerge],
  };
}

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let state: Awaited<ReturnType<typeof getAccountState>> = null;
  try {
    state = await getAccountState(userId);
  } catch (error) {
    // kvGet agora propaga em erro de KV (429/5xx/network) em vez de
    // mascarar como null. Devolve 503 pro cliente NÃO confundir com 404
    // (que dispararia hydrate vazio) e re-tentar mais tarde.
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("[account-state]")) {
      console.error("[account-state GET] KV error:", message);
      return NextResponse.json(
        { error: "Armazenamento temporariamente indisponível.", transient: true },
        { status: 503 },
      );
    }
    throw error;
  }

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

  // Anti-abuso: save de ~1MB + push de histórico a cada PUT é caro no KV.
  // 30 saves/min por usuário cobre o uso normal (debounce de 700ms) com
  // folga e corta loops automatizados.
  const limited = await enforceRateLimit("account-state-put", userId, 30, 60);
  if (limited) return limited;

  try {
    const body = accountStateSchema.parse(
      await readJsonWithLimit<unknown>(request, ACCOUNT_STATE_MAX_BYTES),
    );

    const currentEnvelope = await getAccountState(userId);
    const currentVersion = Number(currentEnvelope?.version ?? 0);

    // Concorrência otimista: se o cliente declara em qual versão ele
    // editou (baseVersion) e ela NÃO é a versão atual do servidor, é
    // porque outro dispositivo salvou no meio. Devolve 409 com o estado
    // atual pro cliente fazer o merge 3-way e re-tentar. Clientes antigos
    // (sem baseVersion) caem no caminho legado (last-write-wins).
    if (
      typeof body.baseVersion === "number" &&
      body.baseVersion !== currentVersion
    ) {
      return NextResponse.json(
        {
          conflict: true,
          version: currentVersion,
          updatedAt: currentEnvelope?.updatedAt,
          state: currentEnvelope?.state ?? null,
        },
        { status: 409 },
      );
    }

    // Se o cliente declarou baseVersion e ela bate com a versão atual do
    // servidor, ele editou EM CIMA do estado mais recente — ou seja, ele
    // conhecia as linhas externas e as removeu de propósito. Nesse caso o
    // conjunto de linhas dele é autoritativo e NÃO re-injetamos nada.
    //
    // Era exatamente isso que fazia a linha "Mercado" (importada da
    // planilha, sourceKey `xlsx-import-2026:`) voltar toda vez que o
    // usuário excluía na lixeira: o preserveExternalFinanceState tratava a
    // exclusão deliberada como se fosse um cliente defasado apagando uma
    // linha que ele nem conhecia, e a trazia de volta do snapshot.
    const clientIsCurrent =
      typeof body.baseVersion === "number" &&
      body.baseVersion === currentVersion;

    // Stale clients (apps loaded before an external KV write) would
    // happily wipe finance lines they don't know about. Para esses — que
    // não enviam baseVersion ou estão defasados — ainda mesclamos as
    // linhas externas de volta do snapshot atual, pra um import não se
    // perder numa corrida. Cliente comprovadamente atual pula essa rede.
    const mergedState =
      currentEnvelope?.state && !clientIsCurrent
        ? preserveExternalFinanceState(currentEnvelope.state, body.state)
        : body.state;

    // Versão monotônica: sempre incrementa a do servidor (ignora a
    // version legada do payload). Assim novos clientes leem uma versão
    // que cresce e conseguem detectar defasagem.
    const saved = await saveAccountState(userId, {
      version: currentVersion + 1,
      updatedAt: body.updatedAt,
      state: mergedState,
    });

    return NextResponse.json(saved);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json(
        { error: "Carga de estado maior do que o permitido." },
        { status: 413 },
      );
    }

    // Erros do KV (kvGet/kvSet propagam com prefix `[account-state]`)
    // viram 503, NÃO 400. Cliente sabe que é transitório e tenta de novo
    // depois — em vez de tratar como "payload inválido" e desistir. Sem
    // isto, um erro de quota do KV no meio do PUT era mascarado e o
    // cliente parava de salvar sem aviso.
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("[account-state]")) {
      console.error("[account-state PUT] KV error:", message);
      return NextResponse.json(
        { error: "Armazenamento temporariamente indisponível.", transient: true },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Carga de estado inválida." },
      { status: 400 },
    );
  }
}
