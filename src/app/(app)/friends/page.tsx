"use client";

import { useState } from "react";
import { UserPlus, Users } from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import { PageIntro } from "@/components/ui/page-intro";
import type { FriendTab } from "@/lib/types";
import { cn } from "@/lib/utils";

const tabs: Array<{ id: FriendTab; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "online", label: "Online" },
  { id: "requests", label: "Solicitações" },
];

export default function FriendsPage() {
  const { user } = useAppStore();
  const [tab, setTab] = useState<FriendTab>("all");

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Social"
        title="Amigos"
        description="Estrutura pronta para rede social, solicitações e presença online. A tela já segue o padrão visual do Praxis."
      />

      <section className="grid gap-4 md:grid-cols-3">
        <GlassPanel className="praxis-kpi space-y-2">
          <p className="praxis-label text-[var(--accent)]">Usuário base</p>
          <p className="break-all text-2xl font-medium text-zinc-100">{user.username}</p>
          <p className="text-sm leading-6 text-zinc-500">Identificador para convites.</p>
        </GlassPanel>
        <GlassPanel className="praxis-kpi space-y-2">
          <p className="praxis-label text-[var(--accent)]">Status</p>
          <p className="font-title text-4xl font-bold text-zinc-100">0</p>
          <p className="text-sm leading-6 text-zinc-500">Amigos conectados no momento.</p>
        </GlassPanel>
        <GlassPanel className="praxis-kpi space-y-2">
          <p className="praxis-label text-[var(--accent)]">Solicitações</p>
          <p className="font-title text-4xl font-bold text-zinc-100">0</p>
          <p className="text-sm leading-6 text-zinc-500">Pendente de integração.</p>
        </GlassPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <GlassPanel className="space-y-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border border-[rgba(251,146,60,0.28)] bg-[rgba(251,146,60,0.12)] text-[var(--accent)]">
              <UserPlus className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="praxis-label text-[var(--accent)]">Adicionar amigo</p>
              <h2 className="praxis-title mt-1 text-3xl">Convites futuros</h2>
            </div>
          </div>
          <p className="text-sm leading-6 text-zinc-500">
            Compartilhe seu nome de usuário para conexões e arenas privadas. Quando a
            camada social chegar, este bloco vira busca e convite real.
          </p>
        </GlassPanel>

        <GlassPanel className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="praxis-label text-[var(--accent)]">Rede</p>
              <h2 className="praxis-title mt-1 text-3xl">Lista social</h2>
            </div>
            <Users className="h-6 w-6 text-[var(--accent)]" />
          </div>

          <div className="flex flex-wrap gap-2">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "praxis-button-ghost px-4 py-2 text-[0.68rem]",
                  tab === item.id && "border-[rgba(251,146,60,0.34)] text-[var(--accent)]",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="praxis-panel rounded-sm border-dashed px-4 py-12 text-center">
            <p className="text-lg font-medium text-zinc-100">Você ainda não tem amigos</p>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              A aba &quot;{tab}&quot; está pronta para receber resultados quando a camada
              social real entrar.
            </p>
          </div>
        </GlassPanel>
      </section>
    </div>
  );
}
