"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  deleteLocalSnapshot,
  listLocalSnapshots,
  loadLocalSnapshot,
  type LocalSnapshot,
} from "@/lib/local-backup";

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

type LocalSummary = Omit<LocalSnapshot, "stateJson">;

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

function totalSignalLocal(counts: LocalSummary["counts"]): number {
  return (
    counts.tasks +
    counts.mealPlanBlocks +
    counts.dietPlans +
    counts.reminders +
    counts.workoutPrograms +
    counts.workoutLoadEntries +
    counts.weightEntries +
    counts.financeLines
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
  const [localBackups, setLocalBackups] = useState<LocalSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    // Lê servidor (histórico) e IndexedDB (backups locais) em paralelo.
    // Cada um pode falhar independente — não bloqueia o outro.
    const [serverResult, localResult] = await Promise.allSettled([
      fetch("/api/account/recover", { cache: "no-store" }).then((r) =>
        r.ok
          ? (r.json() as Promise<ListResponse>)
          : Promise.reject(`HTTP ${r.status}`),
      ),
      listLocalSnapshots(),
    ]);

    if (serverResult.status === "fulfilled") {
      setVersions(serverResult.value.versions ?? []);
    } else {
      setVersions([]);
      setError(
        typeof serverResult.reason === "string"
          ? `Erro ao carregar histórico do servidor: ${serverResult.reason}`
          : "Erro ao carregar histórico do servidor.",
      );
    }

    setLocalBackups(
      localResult.status === "fulfilled" ? localResult.value : [],
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function restoreFromServer(index: number) {
    const ok = window.confirm(
      `Restaurar a versão #${index} do servidor? Sua versão atual vai pro topo do histórico antes de ser substituída — você pode desfazer se errar.`,
    );
    if (!ok) return;
    setRestoring(`server:${index}`);
    setError("");
    setSuccess("");
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
      setSuccess(
        `✓ Versão do servidor #${data.restored.fromIndex} restaurada (v${data.restored.originalVersion}). Agora a conta está na versão ${data.current.version}. Faça hard-refresh na dashboard.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao restaurar.");
    } finally {
      setRestoring(null);
    }
  }

  async function restoreFromLocal(id: string) {
    const ok = window.confirm(
      "Subir esse backup local pro servidor? Sua versão ATUAL no servidor vai pro topo do histórico antes de ser substituída — você pode desfazer se errar.",
    );
    if (!ok) return;
    setRestoring(`local:${id}`);
    setError("");
    setSuccess("");
    try {
      const snapshot = await loadLocalSnapshot(id);
      if (!snapshot) {
        setError("Backup local não encontrado (pode ter sido apagado).");
        return;
      }
      const stateObj = JSON.parse(snapshot.stateJson) as unknown;
      // Usa o endpoint de import (já existe) — substitui o state atual
      // pelo conteúdo do backup. saveAccountState empilha o atual no
      // histórico antes (reversível via /recover servidor).
      const body = {
        backupFormat: 1,
        userId: snapshot.userId,
        exportedAt: snapshot.createdAt,
        state: stateObj,
      };
      const res = await fetch("/api/account/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setSuccess(
        `✓ Backup local de ${formatDateBR(snapshot.createdAt)} restaurado pro servidor. Faça hard-refresh na dashboard.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao restaurar.");
    } finally {
      setRestoring(null);
    }
  }

  async function downloadLocal(id: string) {
    const snapshot = await loadLocalSnapshot(id);
    if (!snapshot) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            backupFormat: 1,
            userId: snapshot.userId,
            exportedAt: snapshot.createdAt,
            state: JSON.parse(snapshot.stateJson),
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `praxis-backup-${snapshot.createdAt.slice(0, 19).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function removeLocal(id: string) {
    if (!window.confirm("Apagar esse backup local? Não dá pra desfazer.")) return;
    await deleteLocalSnapshot(id);
    await load();
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
          Duas fontes de backup: o servidor guarda até 30 fotografias (cada
          save empilha a versão anterior), e o seu navegador guarda até 30
          cópias locais em IndexedDB. Backups locais são especialmente úteis
          quando o servidor falha. Escolha a versão que tinha seus dados e
          restaure.
        </p>
      </header>

      {error ? (
        <div className="rounded-sm border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-sm border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          {success}{" "}
          <Link href="/dashboard" className="underline">
            Ir pra dashboard
          </Link>
        </div>
      ) : null}

      {/* ───────────── Backups LOCAIS (este navegador) ───────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">
          Backups locais{" "}
          <span className="text-xs font-normal text-zinc-500">
            (este navegador, IndexedDB)
          </span>
        </h2>
        {loading ? (
          <p className="text-sm text-zinc-500">Carregando…</p>
        ) : !localBackups || localBackups.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Sem backups locais ainda (primeiro save desde a v159 começa a
            registrar).
          </p>
        ) : (
          <div className="space-y-3">
            {localBackups.map((entry) => {
              const total = totalSignalLocal(entry.counts);
              const restoringId = `local:${entry.id}`;
              const isBeingRestored = restoring === restoringId;
              return (
                <div
                  key={entry.id}
                  className="rounded-sm border border-zinc-800 bg-black/40 p-4"
                  style={{
                    borderColor:
                      total > 0
                        ? "rgba(74,222,128,0.25)"
                        : "rgba(248,113,113,0.25)",
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                        Local · v{entry.serverVersion || "?"}
                      </p>
                      <p className="mt-1 text-sm text-zinc-300">
                        {formatDateBR(entry.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => downloadLocal(entry.id)}
                        className="rounded-sm border border-zinc-700 bg-black/40 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
                      >
                        Baixar JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => restoreFromLocal(entry.id)}
                        disabled={isBeingRestored}
                        className="rounded-sm border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:opacity-50"
                      >
                        {isBeingRestored ? "Restaurando…" : "Restaurar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLocal(entry.id)}
                        className="rounded-sm border border-rose-400/30 bg-rose-400/5 px-3 py-2 text-xs text-rose-300 hover:bg-rose-400/10"
                      >
                        Apagar
                      </button>
                    </div>
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
                      <strong className="text-white">{entry.counts.dietPlans}</strong>{" "}
                      dietas
                    </span>
                    <span>
                      <strong className="text-white">{entry.counts.reminders}</strong>{" "}
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
                        {entry.counts.financeLines}
                      </strong>{" "}
                      linhas $
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ───────────── Histórico do SERVIDOR ───────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">
          Histórico do servidor{" "}
          <span className="text-xs font-normal text-zinc-500">
            (Upstash KV, até 30 versões)
          </span>
        </h2>
        {loading ? (
          <p className="text-sm text-zinc-500">Carregando…</p>
        ) : !versions || versions.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Sem histórico disponível no servidor.
          </p>
        ) : (
          <div className="space-y-3">
            {versions.map((entry) => {
              const total = totalSignal(entry.counts);
              const restoringId = `server:${entry.index}`;
              const isBeingRestored = restoring === restoringId;
              return (
                <div
                  key={entry.index}
                  className="rounded-sm border border-zinc-800 bg-black/40 p-4"
                  style={{
                    borderColor:
                      total > 0
                        ? "rgba(74,222,128,0.25)"
                        : "rgba(248,113,113,0.25)",
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
                      onClick={() => restoreFromServer(entry.index)}
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
                      <strong className="text-white">{entry.counts.reminders}</strong>{" "}
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
                      logs
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <footer className="border-t border-zinc-800 pt-4 text-xs text-zinc-500">
        <Link href="/dashboard" className="text-[var(--accent)] hover:underline">
          ← Voltar pra dashboard
        </Link>
      </footer>
    </main>
  );
}
