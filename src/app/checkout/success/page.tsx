import Link from "next/link";
import { CheckCircle2, ChevronRight, ShieldCheck } from "lucide-react";
import { publicBillingPlan } from "@/lib/billing-config";

export default function CheckoutSuccessPage() {
  return (
    <main className="min-h-screen bg-[#050505] px-4 py-12 text-zinc-100 md:px-6">
      <div className="mx-auto max-w-3xl border border-zinc-800 bg-[linear-gradient(180deg,rgba(12,12,14,0.96),rgba(6,6,8,0.98))] p-6 md:p-8">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-sm border border-emerald-400/28 bg-emerald-400/10 text-emerald-300">
          <CheckCircle2 className="h-8 w-8" />
        </div>

        <p className="mt-6 text-center font-mono text-[0.62rem] uppercase tracking-[0.28em] text-emerald-300">
          Checkout confirmado
        </p>
        <h1 className="mt-4 text-center font-display text-4xl font-bold uppercase tracking-tight text-zinc-100 md:text-5xl">
          Seu acesso foi iniciado.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-center text-base leading-8 text-zinc-400">
          O pagamento do {publicBillingPlan.name} foi processado pelo Stripe. Agora
          você pode criar sua identidade no Praxis ou entrar no terminal com a conta
          já existente.
        </p>

        <div className="mt-8 grid gap-3 md:grid-cols-2">
          <div className="border border-zinc-800 bg-[#0b0b0d] p-4">
            <p className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-zinc-500">
              Plano
            </p>
            <p className="mt-3 text-2xl font-semibold text-zinc-100">
              {publicBillingPlan.name}
            </p>
            <p className="mt-2 text-sm text-zinc-400">{publicBillingPlan.priceLabel}</p>
          </div>
          <div className="border border-zinc-800 bg-[#0b0b0d] p-4">
            <p className="font-mono text-[0.56rem] uppercase tracking-[0.22em] text-zinc-500">
              Segurança
            </p>
            <p className="mt-3 inline-flex items-center gap-2 text-lg font-semibold text-zinc-100">
              <ShieldCheck className="h-5 w-5 text-amber-300" />
              Checkout Stripe seguro
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Cadastro e login continuam dentro do fluxo do Praxis.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/auth/register"
            className="inline-flex h-12 items-center justify-center gap-3 border border-amber-400 bg-amber-400 px-5 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#090909] shadow-[0_0_18px_rgba(251,146,60,0.32)] transition hover:bg-[#ffb16c] hover:shadow-[0_0_26px_rgba(251,146,60,0.42)]"
          >
            Criar minha identidade
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex h-12 items-center justify-center gap-3 border border-zinc-700 bg-[#121214] px-5 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-zinc-100 transition hover:border-amber-400/60 hover:text-amber-200"
          >
            Entrar no terminal
          </Link>
        </div>
      </div>
    </main>
  );
}
