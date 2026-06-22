"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type VersionSummary = {
  index: number;
  version: number;
  updatedAt?: string;
  counts: {
    tasks: number;
    mealPlanBlocks: number;
    dietPlans: number;
    reminders: number;
    workoutPrograms: number;
    workoutLoadEntries: number;
    weightEntries: number;
    financeBudgetLines: number;
    householdSupplies: number;
  };
};

type ListResponse = {
  historyCount: number;
  versions: VersionSummary[];
};

type RestoreResponse = {
  restored: {
    fromIndex: number;
    originalVersion: number;
    originalUpdatedAt?: string;
    counts: VersionSummary["counts"];
  };
  current: { version: number; updatedAt?: string };
};

function totalSignal(counts: VersionSummary["counts"]): number {
  return (
    counts.tasks +
    counts.mealPlanBlocks +
    counts.dietPlans +
    counts.reminders +
    counts.workoutPrograms +
    counts.workoutLoadEntries +
    counts.weightEntries +
    counts.financeBudgetLines +
    counts.householdSupplies
  );
}

function formatDateBR(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function RecoverPage() {
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<RestoreResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/account/recover", { cache: "no-store" });
      if (!res.ok) {
        setError(`Erro ao carregar histórico (HTTP ${res.status}).`);
        return;
      }
      const data = (await res.json()) as ListResponse;
      setVersions(data.versions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha de rede.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function restore(index: number) {
    const ok = window.confirm(
      `Restaurar a versão #${index}? Sua versão atual vai pro topo do histórico antes de ser substituída — você pode desfazer se errar.`,
    );
    if (!ok) return;
    setRestoring(index);
    setError("");
    try {
      const res = await fetch("/api/account/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index }),
      });
      const data = (await res.json()) as RestoreResponse & { error?: string };
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setSuccess(data as RestoreResponse);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao restaurar.");
    } finally {
      setRestoring(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
          Recuperação de dados
        </p>
        <h1 className="text-3xl font-semibold text-white">
          Restaurar uma versão anterior
        </h1>
        <p className="text-sm text-zinc-400">
          O servidor guarda as últimas 10 fotografias da sua conta — cada save
          empilha a versão anterior aqui antes de sobrescrever. Escolha uma
          versão que tinha seus dados e clique em <strong>Restaurar</strong>.
          Sua versão atual vai pro topo do histórico antes (dá pra desfazer).
        </p>
      </header>

      {error ? (
        <div className="rounded-sm border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-sm border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          ✓ Versão #{success.restored.fromIndex} restaurada (v
          {success.restored.originalVersion}, {success.restored.counts.tasks}{" "}
          tasks, {success.restored.counts.mealPlanBlocks} refeições,{" "}
          {success.restored.counts.financeBudgetLines} linhas de finanças). Agora
          a conta está na versão {success.current.version}. Volte pra{" "}
          <Link href="/dashboard" className="underline">
            dashboard
          </Link>{" "}
          e faça hard-refresh.
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500">Carregando histórico…</p>
      ) : !versions || versions.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Sem histórico disponível (o backup começa a partir do primeiro save
          após o deploy que adicionou essa feature).
        </p>
      ) : (
        <div className="space-y-3">
          {versions.map((entry) => {
            const total = totalSignal(entry.counts);
            const isBeingRestored = restoring === entry.index;
            return (
              <div
                key={entry.index}
                className="rounded-sm border border-zinc-800 bg-black/40 p-4"
                style={{
                  borderColor:
                    total > 0 ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)",
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                      Versão #{entry.index} · v{entry.version}
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">
                      {formatDateBR(entry.updatedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => restore(entry.index)}
                    disabled={isBeingRestored}
                    className="rounded-sm border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:opacity-50"
                  >
                    {isBeingRestored ? "Restaurando…" : "Restaurar"}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-400">
                  <span>
                    <strong className="text-white">{entry.counts.tasks}</strong>{" "}
                    tasks
                  </span>
                  <span>
                    <strong className="text-white">
                      {entry.counts.mealPlanBlocks}
                    </strong>{" "}
                    refeições
                  </span>
                  <span>
                    <strong className="text-white">
                      {entry.counts.dietPlans}
                    </strong>{" "}
                    dietas
                  </span>
                  <span>
                    <strong className="text-white">
                      {entry.counts.reminders}
                    </strong>{" "}
                    lembretes
                  </span>
                  <span>
                    <strong className="text-white">
                      {entry.counts.workoutPrograms}
                    </strong>{" "}
                    programas
                  </span>
                  <span>
                    <strong className="text-white">
                      {entry.counts.workoutLoadEntries}
                    </strong>{" "}
                    logs de carga
                  </span>
                  <span>
                    <strong className="text-white">
                      {entry.counts.weightEntries}
                    </strong>{" "}
                    pesagens
                  </span>
                  <span>
                    <strong className="text-white">
                      {entry.counts.financeBudgetLines}
                    </strong>{" "}
                    linhas $
                  </span>
                  <span>
                    <strong className="text-white">
                      {entry.counts.householdSupplies}
                    </strong>{" "}
                    casa
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <footer className="border-t border-zinc-800 pt-4 text-xs text-zinc-500">
        <Link href="/dashboard" className="text-[var(--accent)] hover:underline">
          ← Voltar pra dashboard
        </Link>
      </footer>
    </main>
  );
}
