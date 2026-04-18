"use client";

import { Sword, Zap } from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import { PageIntro } from "@/components/ui/page-intro";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/utils";

export default function ArenaPage() {
  const { state, user, actions } = useAppStore();
  const combatPower =
    Object.values(user.characterStats).reduce((sum, value) => sum + value, 0) / 5;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Combate PvP"
        title="Arena"
        description="Pareamento simulado, combate com atributos e log de batalha persistido para espelhar a dinâmica competitiva do sistema."
        actions={
          <button
            type="button"
            onClick={() => actions.simulateArenaMatch()}
            className="praxis-button px-4 py-3"
          >
            Procurar adversário
          </button>
        }
      />

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        <GlassPanel className="praxis-kpi space-y-2 xl:col-span-1">
          <p className="praxis-label text-[var(--accent)]">Confrontos</p>
          <p className="font-title text-4xl font-bold text-zinc-100">
            {state.arena.matches}
          </p>
          <p className="text-sm leading-6 text-zinc-500">Batalhas já simuladas.</p>
        </GlassPanel>
        <GlassPanel className="praxis-kpi space-y-2">
          <p className="praxis-label text-[var(--accent)]">Vitórias</p>
          <p className="font-title text-4xl font-bold text-zinc-100">
            {state.arena.victories}
          </p>
          <p className="text-sm leading-6 text-zinc-500">Resultado acumulado.</p>
        </GlassPanel>
        <GlassPanel className="praxis-kpi space-y-2">
          <p className="praxis-label text-[var(--accent)]">Dano total</p>
          <p className="font-title text-4xl font-bold text-zinc-100">
            {state.arena.totalDamage}
          </p>
          <p className="text-sm leading-6 text-zinc-500">Pressão ofensiva gerada.</p>
        </GlassPanel>
        <GlassPanel className="praxis-kpi space-y-2 md:col-span-3 xl:col-span-1">
          <p className="praxis-label text-[var(--accent)]">Poder médio</p>
          <p className="font-title text-4xl font-bold text-zinc-100">
            {Math.round(combatPower)}
          </p>
          <p className="text-sm leading-6 text-zinc-500">Leitura dos atributos do operador.</p>
        </GlassPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <GlassPanel className="space-y-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border border-[rgba(251,146,60,0.28)] bg-[rgba(251,146,60,0.12)] text-[var(--accent)]">
              <Sword className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="praxis-label text-[var(--accent)]">Seus atributos de combate</p>
              <h2 className="praxis-title mt-2 text-3xl">Configuração atual</h2>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(user.characterStats).map(([stat, value]) => (
              <div key={stat} className="praxis-kpi space-y-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="capitalize text-zinc-300">{stat}</p>
                  <span className="text-sm text-zinc-500">{value}</span>
                </div>
                <ProgressBar value={value} />
              </div>
            ))}
          </div>
        </GlassPanel>

        <div className="space-y-6">
          <GlassPanel className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="praxis-label text-[var(--accent)]">Combate</p>
                <h2 className="praxis-title mt-2 text-3xl">Batalha 1v1</h2>
              </div>
              <span className="praxis-label rounded-sm border border-zinc-800 px-3 py-2 text-zinc-400">
                {state.arena.matches} partidas
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="praxis-kpi p-4">
                <p className="praxis-label">Vitórias</p>
                <p className="mt-2 font-title text-3xl font-bold text-zinc-100">
                  {state.arena.victories}
                </p>
              </div>
              <div className="praxis-kpi p-4">
                <p className="praxis-label">Dano</p>
                <p className="mt-2 font-title text-3xl font-bold text-zinc-100">
                  {state.arena.totalDamage}
                </p>
              </div>
              <div className="praxis-kpi p-4 sm:col-span-2 xl:col-span-1">
                <p className="praxis-label">Último rival</p>
                <p className="mt-2 min-w-0 truncate text-lg font-medium text-zinc-100">
                  {state.arena.lastOpponent || "--"}
                </p>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-[rgba(251,146,60,0.28)] bg-[rgba(251,146,60,0.12)] text-[var(--accent)]">
                <Zap className="h-4 w-4" />
              </span>
              <div>
                <p className="praxis-label text-[var(--accent)]">Registro</p>
                <h2 className="praxis-title mt-1 text-2xl">Log de combate</h2>
              </div>
            </div>
            <div className="space-y-3">
              {state.arena.combatLog.length ? (
                state.arena.combatLog.map((log) => (
                  <div
                    key={log}
                    className={cn(
                      "praxis-panel rounded-sm px-4 py-3 text-sm leading-6 text-zinc-300",
                      "min-w-0 break-words",
                    )}
                  >
                    {log}
                  </div>
                ))
              ) : (
                <div className="praxis-panel rounded-sm border-dashed px-4 py-8 text-center text-sm leading-6 text-zinc-500">
                  Nenhuma luta simulada ainda. Procure um adversário para gerar o
                  primeiro combate.
                </div>
              )}
            </div>
          </GlassPanel>
        </div>
      </section>
    </div>
  );
}
