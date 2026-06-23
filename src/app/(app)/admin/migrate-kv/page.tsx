"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type DryRun = {
  legacyEndpoint?: string;
  targetEndpoint?: string;
  totalKeys?: number;
  prefixes?: Array<{ prefix: string; count: number }>;
  sample?: string[];
  ok?: false;
  reason?: string;
};

type MigrationResult = {
  ok: boolean;
  totalKeys: number;
  copied: number;
  skipped: number;
  failed: number;
  failedSample: string[];
  durationMs: number;
  reason?: string;
};

export default function MigrateKvPage() {
  const [dry, setDry] = useState<DryRun | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [force, setForce] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadDry = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/account/admin-migrate-kv", { cache: "no-store" });
      if (res.status === 404) {
        setError("Acesso negado (rota gated por isFounderEmail).");
        return;
      }
      const data = (await res.json()) as DryRun;
      setDry(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha de rede.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDry();
  }, [loadDry]);

  async function runMigration() {
    if (
      !window.confirm(
        force
          ? "SOBRESCREVER tudo? Chaves existentes no banco novo serão substituídas pelas do antigo. Sem volta."
          : "Iniciar migração? Chaves já existentes no banco novo serão preservadas (skip).",
      )
    )
      return;
    setRunning(true);
    setResult(null);
    setError("");
    try {
      const res = await fetch("/api/account/admin-migrate-kv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = (await res.json()) as MigrationResult;
      setResult(data);
      await loadDry();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao migrar.");
    } finally {
      setRunning(false);
    }
  }

  const configError = dry && dry.ok === false ? dry.reason : null;
  const hasData = !!dry && typeof dry.totalKeys === "number" && dry.totalKeys > 0;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
          Admin · Migração KV
        </p>
        <h1 className="text-3xl font-semibold text-white">
          Migrar banco antigo → banco novo
        </h1>
        <p className="text-sm text-zinc-400">
          Copia todas as chaves de um Upstash KV pra o KV atual do app. Usado
          quando você trocou o banco do projeto na Vercel e precisa trazer os
          dados do antigo. Operação idempotente — pode rodar de novo se algo
          falhar no meio.
        </p>
      </header>

      {error ? (
        <div className="rounded-sm border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {configError ? (
        <div className="rounded-sm border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          <p className="font-semibold">⚙️ Configuração pendente</p>
          <p className="mt-1">{configError}</p>
          <p className="mt-3 text-xs text-amber-100/80">
            Passo a passo:
            <br />1. Vercel → projeto <code>praxis-protocol</code> → Settings →
            Environment Variables.
            <br />2. Adicione <code>LEGACY_KV_REST_API_URL</code> com a URL REST
            do banco ANTIGO (algo como{" "}
            <code>https://xxx-yyy-12345.upstash.io</code>).
            <br />3. Adicione <code>LEGACY_KV_REST_API_TOKEN</code> com o token
            (KV_REST_API_TOKEN do banco antigo).
            <br />4. Marque as 3 envs (Production, Preview, Development).
            <br />5. Volte em Deployments → Redeploy do último deploy.
            <br />6. Recarregue esta página.
          </p>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500">Carregando…</p>
      ) : dry && !configError ? (
        <section className="space-y-3 rounded-sm border border-zinc-800 bg-black/40 p-5">
          <div className="grid gap-2 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="text-zinc-500">Banco ANTIGO (origem):</span>
              <code className="text-zinc-300">{dry.legacyEndpoint}</code>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <span className="text-zinc-500">Banco NOVO (destino):</span>
              <code className="text-zinc-300">{dry.targetEndpoint}</code>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <span className="text-zinc-500">Total de chaves no antigo:</span>
              <strong className="text-[var(--accent)]">{dry.totalKeys ?? 0}</strong>
            </div>
          </div>
          {dry.prefixes && dry.prefixes.length > 0 ? (
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                Distribuição por prefixo
              </p>
              <ul className="space-y-1 text-xs text-zinc-400">
                {dry.prefixes.map((p) => (
                  <li key={p.prefix} className="flex justify-between gap-2">
                    <code className="text-zinc-300">{p.prefix}</code>
                    <span>{p.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {!configError && !loading ? (
        <section className="space-y-3 rounded-sm border border-zinc-800 bg-black/40 p-5">
          <div className="flex items-center gap-2 text-sm">
            <input
              id="force"
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="force" className="text-zinc-300">
              Sobrescrever chaves já existentes no destino (force)
            </label>
          </div>
          <p className="text-xs text-zinc-500">
            Sem force: chaves duplicadas no destino são preservadas (recomendado
            quando o destino já tem dados que NÃO quer perder). Com force: as
            do antigo vencem.
          </p>
          <button
            type="button"
            onClick={runMigration}
            disabled={running || !hasData}
            className="rounded-sm border border-[var(--accent)] bg-[var(--accent)]/10 px-6 py-3 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:opacity-50"
          >
            {running
              ? "Migrando…"
              : !hasData
                ? "Sem chaves pra migrar"
                : `Migrar ${dry?.totalKeys ?? 0} chaves agora`}
          </button>
        </section>
      ) : null}

      {result ? (
        <section className="rounded-sm border border-emerald-400/30 bg-emerald-400/10 p-5">
          <h2 className="text-lg font-semibold text-emerald-200">
            Resultado da migração
          </h2>
          <div className="mt-3 grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-emerald-100/80">Total no antigo:</span>
              <strong className="text-emerald-100">{result.totalKeys}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-100/80">Copiadas:</span>
              <strong className="text-emerald-100">{result.copied}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-100/80">Puladas (já existiam):</span>
              <strong className="text-emerald-100">{result.skipped}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-100/80">Falharam:</span>
              <strong className="text-emerald-100">{result.failed}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-100/80">Duração:</span>
              <strong className="text-emerald-100">
                {(result.durationMs / 1000).toFixed(1)}s
              </strong>
            </div>
          </div>
          {result.failedSample.length > 0 ? (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-emerald-100/80">
                Amostra das chaves que falharam ({result.failedSample.length})
              </summary>
              <ul className="mt-2 space-y-1">
                {result.failedSample.map((k) => (
                  <li key={k}>
                    <code className="text-emerald-100">{k}</code>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <p className="mt-4 text-sm text-emerald-100">
            ✓ Pronto. Faça hard-refresh na{" "}
            <Link href="/dashboard" className="underline">
              dashboard
            </Link>
            . Depois, REMOVA as env vars LEGACY_KV_* da Vercel pra não deixar
            tokens órfãos.
          </p>
        </section>
      ) : null}

      <footer className="border-t border-zinc-800 pt-4 text-xs text-zinc-500">
        <Link href="/dashboard" className="text-[var(--accent)] hover:underline">
          ← Voltar pra dashboard
        </Link>
      </footer>
    </main>
  );
}
