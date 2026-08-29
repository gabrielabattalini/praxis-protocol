"use client";

import { Lock, RefreshCcw, ShieldCheck, Sparkles } from "lucide-react";
import { StripeCheckoutButton } from "@/components/billing/stripe-checkout-button";
import { useAppStore } from "@/components/providers/app-store-provider";
import { publicBillingPlan } from "@/lib/billing-config";

/**
 * Paywall DURO do app: sem plano ativo, nenhum módulo abre.
 *
 * Decisão de produto (do fundador): não existe free tier nem trial — o
 * custo de infra por usuário (requisições de preço, buscas nutricionais,
 * notificações, Telegram) é alto demais pra sustentar uso gratuito.
 *
 * Quem decide o acesso é o servidor (access-entitlements.server.ts, com
 * Stripe como fonte de verdade + cache no KV). Este componente só
 * respeita a resposta:
 *   - carregando  → tela neutra (não pisca o cadeado à toa)
 *   - hasFullAccess → app normal
 *   - free        → tela de ativação com checkout
 *
 * Nota: isto tranca a UI; as rotas de API caras têm gate PRÓPRIO no
 * servidor (require-full-access.server.ts) — burlar o client não dá acesso.
 */
export function PaywallGate({ children }: { children: React.ReactNode }) {
  const { entitlement, entitlementLoaded } = useAppStore();

  if (entitlement.hasFullAccess) {
    return <>{children}</>;
  }

  if (!entitlementLoaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-zinc-500">Verificando sua conta…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col justify-center gap-6 px-4 py-12">
      <div className="rounded-md border border-amber-400/20 bg-[linear-gradient(180deg,rgba(22,16,8,0.96),rgba(8,8,10,0.94))] p-8">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-md border border-amber-400/25 bg-amber-400/10">
            <Lock className="h-5 w-5 text-[var(--accent)]" />
          </span>
          <div>
            <p className="praxis-label text-[var(--accent)]">
              {publicBillingPlan.name}
            </p>
            <h1 className="praxis-title mt-1 text-2xl">
              Ative sua conta para entrar no sistema
            </h1>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-zinc-400">
          O Praxis não tem plano gratuito: cada conta ativa consome buscas de
          preço em tempo real, bases nutricionais, notificações e integração
          com Telegram. A assinatura é o que mantém tudo isso ligado — e o
          acesso libera na hora em que o pagamento confirma.
        </p>

        <ul className="mt-5 space-y-2 text-sm text-zinc-300">
          {[
            "Todos os 13 módulos: finanças, treino, nutrição, mercado, sono e mais",
            "Sincronização entre dispositivos e relatórios semanais",
            "Notificações inteligentes no navegador e no Telegram",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-3">
          <p className="text-lg font-semibold text-white">
            {publicBillingPlan.priceLabel}
          </p>
          <StripeCheckoutButton
            source="paywall-gate"
            className="w-full rounded-sm border-[rgba(251,146,60,0.18)] bg-[linear-gradient(135deg,var(--accent)_0%,#fbbf24_100%)] px-4 py-3 text-sm font-semibold text-slate-950"
            noteClassName="text-zinc-500"
            errorClassName="text-amber-200"
          >
            Ativar minha conta
          </StripeCheckoutButton>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 rounded-sm border border-zinc-800 bg-black/40 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-white/20"
          >
            <RefreshCcw className="h-4 w-4" />
            Já paguei — verificar de novo
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/5 pt-4 text-xs text-zinc-600">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Pagamento seguro via Stripe
          </span>
          <a href="/legal/termos" className="underline underline-offset-2 hover:text-zinc-400">
            Termos de Uso
          </a>
          <a href="/legal/privacidade" className="underline underline-offset-2 hover:text-zinc-400">
            Privacidade
          </a>
          <a href="/legal/reembolso" className="underline underline-offset-2 hover:text-zinc-400">
            Reembolso (7 dias)
          </a>
          {/* Mesmo sem plano ativo os dados continuam sendo do usuário —
              a política de reembolso promete export, então o link fica
              acessível aqui (a rota exige só a sessão, não o plano). */}
          <a href="/api/account/export" className="underline underline-offset-2 hover:text-zinc-400">
            Exportar meus dados
          </a>
        </div>
      </div>
    </div>
  );
}
