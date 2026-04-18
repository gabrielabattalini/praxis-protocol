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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.12),transparent_24%),radial-gradient(circle_at_84%_12%,rgba(251,146,60,0.08),transparent_18%),linear-gradient(180deg,#050505_0%,#09090b_46%,#030303_100%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-amber-400/40 shadow-[0_0_18px_rgba(251,146,60,0.32)]" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(251,146,60,0.55) 0px, rgba(251,146,60,0.55) 1px, transparent 1px, transparent 6px)",
        }}
      />

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 md:px-6">
        <section className="w-full max-w-[580px] border border-zinc-800 bg-[linear-gradient(180deg,rgba(12,12,14,0.96),rgba(6,6,8,0.98))] p-5 shadow-[0_0_0_1px_rgba(251,146,60,0.06),0_28px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl md:p-7">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-4">
            <p className="font-mono text-[0.54rem] uppercase tracking-[0.28em] text-zinc-600">
              Praxis Access Core
            </p>
            <div className="inline-flex items-center gap-2 rounded-sm border border-amber-400/18 bg-amber-400/10 px-3 py-1.5 font-mono text-[0.54rem] uppercase tracking-[0.22em] text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.55)]" />
              Sessão isolada
            </div>
          </div>

          <div className="pt-5 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="border border-zinc-700 bg-[#101012] p-2">
                <Image
                  src="/logo.png"
                  alt="Praxis Protocol"
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                />
              </div>
              <div>
                {badge ? (
                  <p className="font-mono text-[0.56rem] uppercase tracking-[0.3em] text-amber-300">
                    {badge}
                  </p>
                ) : null}
                <p
                  className={`font-display text-2xl font-semibold uppercase tracking-tight text-zinc-100 md:text-3xl ${
                    badge ? "mt-2" : ""
                  }`}
                >
                  {title}
                </p>
              </div>
            </div>
          </div>

          {description ? (
            <p className="mx-auto mt-5 max-w-md text-center text-sm leading-7 text-zinc-400 md:text-base md:leading-8">
              {description}
            </p>
          ) : null}

          <div className="mt-6 border border-amber-400/18 bg-[linear-gradient(180deg,rgba(251,146,60,0.06),rgba(8,8,9,0.98))] p-4 md:p-5">
            <div className="text-center">
              <p className="font-mono text-[0.54rem] uppercase tracking-[0.22em] text-zinc-500">
                Painel de autenticação
              </p>
              <p className="mt-2 font-display text-xl font-semibold uppercase tracking-tight text-zinc-100">
                Iniciar acesso seguro
              </p>
            </div>

            <div className="mx-auto mt-5 max-w-[380px]">{children}</div>
          </div>

          <div className="mt-6 border-t border-zinc-800 pt-5 text-center">
            <p className="text-sm text-zinc-500">{alternatePrompt}</p>
            <Link
              href={alternateHref}
              className="mt-4 inline-flex h-11 items-center justify-center border border-zinc-700 bg-[#101012] px-5 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-200 transition hover:border-amber-400/35 hover:bg-amber-400/10 hover:text-amber-200"
            >
              {alternateLabel}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
