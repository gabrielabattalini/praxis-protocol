import Image from "next/image";
import Link from "next/link";

type AuthConsoleShellProps = {
  badge: string;
  title: string;
  description: string;
  alternateHref: string;
  alternateLabel: string;
  alternatePrompt: string;
  children: React.ReactNode;
};

export function AuthConsoleShell({
  badge,
  title,
  description,
  alternateHref,
  alternateLabel,
  alternatePrompt,
  children,
}: AuthConsoleShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] text-zinc-100 selection:bg-amber-400/30 selection:text-[#050505]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.12),transparent_28%),radial-gradient(circle_at_84%_12%,rgba(251,146,60,0.08),transparent_18%),linear-gradient(180deg,#050505_0%,#09090b_46%,#030303_100%)]" />
      <div className="pointer-events-none absolute inset-0 praxis-tech-grid opacity-[0.08]" />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1440px] items-center px-4 py-8 md:px-6 lg:px-10">
        <section className="grid w-full overflow-hidden border border-zinc-800 bg-[rgba(6,6,8,0.9)] lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.88fr)]">
          <div className="grid-bg hidden border-r border-zinc-800 px-8 py-10 lg:flex lg:flex-col lg:justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Praxis Protocol"
                width={28}
                height={28}
                className="h-7 w-auto"
              />
              <span className="praxis-label text-zinc-500">Praxis Protocol</span>
            </div>

            <div className="max-w-xl">
              <p className="font-mono text-[0.64rem] uppercase tracking-[0.28em] text-[var(--accent)]">
                {badge || "Operador - Gold III"}
              </p>
              <h1 className="mt-4 font-display text-4xl font-semibold leading-[0.98] tracking-[-0.03em] text-zinc-100 md:text-5xl">
                Disciplina nao e humor.
                <br />
                E sistema.
              </h1>
              <p className="mt-6 max-w-lg text-base leading-8 text-zinc-400">
                {description ||
                  "Entre no Praxis para operar tarefas, agenda, treino, dieta e progresso no mesmo nucleo."}
              </p>
              <p className="mt-8 font-mono text-[0.56rem] uppercase tracking-[0.24em] text-zinc-600">
                {"// manifesto.txt - secao 02"}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-zinc-800 pt-5">
              <span className="font-mono text-[0.56rem] uppercase tracking-[0.24em] text-zinc-600">
                Praxis/Auth/V2
              </span>
              <span className="font-mono text-[0.56rem] uppercase tracking-[0.24em] text-zinc-600">
                * Sys online
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center px-6 py-10 md:px-8 lg:px-10">
            <div className="w-full max-w-[380px]">
              <div className="mb-8 text-center lg:hidden">
                <Image
                  src="/logo.png"
                  alt="Praxis Protocol"
                  width={36}
                  height={36}
                  className="mx-auto h-9 w-auto"
                />
              </div>

              <p className="praxis-label mb-3 text-[var(--accent)]">Acesso - Operador</p>
              <h2 className="praxis-title text-3xl md:text-4xl">
                {title || "Entrar no protocolo"}
              </h2>

              {description ? (
                <p className="mt-4 text-sm leading-7 text-zinc-500 lg:hidden">
                  {description}
                </p>
              ) : null}

              <div className="mt-8">{children}</div>

              <div className="mt-8 border-t border-zinc-800 pt-6 text-center">
                <p className="text-sm text-zinc-500">{alternatePrompt}</p>
                <Link
                  href={alternateHref}
                  className="mt-4 inline-flex h-11 items-center justify-center border border-zinc-700 bg-[#101012] px-5 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-200 transition hover:border-amber-400/35 hover:bg-amber-400/10 hover:text-amber-200"
                >
                  {alternateLabel}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
