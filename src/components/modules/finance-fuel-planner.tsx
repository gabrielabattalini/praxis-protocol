"use client";

import { Fuel, Gauge, MapPinned, ShieldCheck } from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";

const highlights = [
  {
    icon: Fuel,
    label: "Abastecimentos",
    value: "Planejamento ativo",
    hint: "Centralize previsao de gasto com combustivel e rotina de abastecimento.",
  },
  {
    icon: Gauge,
    label: "Consumo medio",
    value: "Acompanhe por semana",
    hint: "Use este painel para comparar variacao de custo e uso ao longo do mes.",
  },
  {
    icon: MapPinned,
    label: "Rotas e deslocamentos",
    value: "Leitura consolidada",
    hint: "Organize deslocamentos recorrentes e entenda o impacto no orcamento.",
  },
];

export function FinanceFuelPlanner() {
  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
      <GlassPanel className="border-l-2 border-l-[var(--accent)]">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="praxis-label text-[var(--accent)]/80">
              Combustivel // Planejamento
            </p>
            <h3 className="praxis-title text-2xl">
              Controle de deslocamento e custo recorrente
            </h3>
            <p className="max-w-2xl text-sm leading-6 text-zinc-400">
              Esta area foi preservada para o modulo de combustivel. Ela resume
              abastecimento, custo medio e leitura operacional sem quebrar o
              restante da pagina de financas.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {highlights.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="rounded-sm border border-white/10 bg-black/30 p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-sm border border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="praxis-label text-zinc-500">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-zinc-100">
                        {item.value}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    {item.hint}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </GlassPanel>

      <GlassPanel>
        <div className="flex h-full flex-col justify-between gap-4">
          <div className="space-y-2">
            <p className="praxis-label text-zinc-500">Status do modulo</p>
            <div className="flex items-center gap-3 text-[var(--accent)]">
              <ShieldCheck className="h-5 w-5" />
              <p className="text-sm font-medium text-zinc-100">
                Estrutura restaurada e pronta para expansao.
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-zinc-400">
            <p>
              Se voce quiser, depois podemos reconstruir esta aba com lancamento
              por abastecimento, consumo por km e historico mensal completo.
            </p>
            <div className="rounded-sm border border-white/10 bg-black/30 p-4">
              <p className="praxis-label text-zinc-500">Leitura atual</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                O modulo foi mantido estavel para que a pagina de financas volte
                a abrir normalmente sem comprometer o restante do sistema.
              </p>
            </div>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
