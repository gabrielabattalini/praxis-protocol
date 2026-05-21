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
  const incomingCategoryNames = new Set(
    incomingCategories
      .map((cat) => (typeof cat?.name === "string" ? cat.name : null))
      .filter((value): value is string => Boolean(value)),
  );
  const externalCategoriesToMerge = currentCategories.filter(
    (cat) =>
      typeof cat?.name === "string" &&
      EXTERNAL_FINANCE_CATEGORY_NAMES.has(cat.name) &&
      !incomingCategoryNames.has(cat.name),
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

    // Stale clients (apps loaded before an external KV write) would
    // happily wipe finance lines they don't know about. Merge them in
    // from the current snapshot so external imports survive the race.
    const currentEnvelope = await getAccountState(userId);
    const mergedState = currentEnvelope?.state
      ? preserveExternalFinanceState(currentEnvelope.state, body.state)
      : body.state;

    const saved = await saveAccountState(userId, {
      version: Number(body.version ?? 1),
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

    return NextResponse.json(
      { error: "Carga de estado inválida." },
      { status: 400 },
    );
  }
}
