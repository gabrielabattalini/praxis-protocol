import Link from "next/link";
import { ArrowLeft, CircleX } from "lucide-react";
import { publicBillingPlan } from "@/lib/billing-config";

export default function CheckoutCancelPage() {
  return (
    <main className="min-h-screen bg-[#050505] px-4 py-12 text-zinc-100 md:px-6">
      <div className="mx-auto max-w-3xl border border-zinc-800 bg-[linear-gradient(180deg,rgba(12,12,14,0.96),rgba(6,6,8,0.98))] p-6 md:p-8">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-sm border border-zinc-700 bg-[#121214] text-zinc-300">
          <CircleX className="h-8 w-8" />
        </div>

        <p className="mt-6 text-center font-mono text-[0.62rem] uppercase tracking-[0.28em] text-zinc-500">
          Checkout interrompido
        </p>
        <h1 className="mt-4 text-center font-display text-4xl font-bold uppercase tracking-tight text-zinc-100 md:text-5xl">
          Nenhuma cobrança foi concluída.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-center text-base leading-8 text-zinc-400">
          Você pode retomar a ativação do {publicBillingPlan.name} quando quiser.
          O fluxo do Praxis continua disponível para explorar o sistema antes da
          compra.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center gap-3 border border-zinc-700 bg-[#121214] px-5 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-zinc-100 transition hover:border-amber-400/60 hover:text-amber-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao site
          </Link>
          <Link
            href="/auth/register"
            className="inline-flex h-12 items-center justify-center gap-3 border border-amber-400 bg-amber-400 px-5 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#090909] shadow-[0_0_18px_rgba(251,146,60,0.32)] transition hover:bg-[#ffb16c] hover:shadow-[0_0_26px_rgba(251,146,60,0.42)]"
          >
            Criar minha identidade
          </Link>
        </div>
      </div>
    </main>
  );
}
