"use client";

import { useState } from "react";
import { achievementCatalog } from "@/lib/mock-data";
import { GlassPanel } from "@/components/ui/glass-panel";
import { PageIntro } from "@/components/ui/page-intro";
import type { AchievementCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const filters: Array<{ id: AchievementCategory | "all"; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "streak", label: "Sequência" },
  { id: "tasks", label: "Tarefas" },
  { id: "fitness", label: "Fitness" },
  { id: "social", label: "Social" },
  { id: "arena", label: "Arena" },
  { id: "modules", label: "Módulos" },
  { id: "ranking", label: "Ranking" },
];

export default function AchievementsPage() {
  const [filter, setFilter] = useState<AchievementCategory | "all">("all");
  const visible = achievementCatalog.filter(
    (item) => filter === "all" || item.category === filter,
  );
  const unlockedCount = visible.filter((item) => item.unlocked).length;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Progresso"
        title="Conquistas"
        description="Grade completa de conquistas do Praxis Protocol, organizada por categoria e raridade com leitura limpa no mobile."
      />

      <section className="grid gap-4 md:grid-cols-3">
        <GlassPanel className="praxis-kpi space-y-2">
          <p className="praxis-label text-[var(--accent)]">Exibidas</p>
          <p className="font-title text-4xl font-bold text-zinc-100">{visible.length}</p>
          <p className="text-sm leading-6 text-zinc-500">Conquistas filtradas no momento.</p>
        </GlassPanel>
        <GlassPanel className="praxis-kpi space-y-2">
          <p className="praxis-label text-[var(--accent)]">Desbloqueadas</p>
          <p className="font-title text-4xl font-bold text-zinc-100">{unlockedCount}</p>
          <p className="text-sm leading-6 text-zinc-500">Marcadas como concluídas.</p>
        </GlassPanel>
        <GlassPanel className="praxis-kpi space-y-2">
          <p className="praxis-label text-[var(--accent)]">Bloqueadas</p>
          <p className="font-title text-4xl font-bold text-zinc-100">
            {visible.length - unlockedCount}
          </p>
          <p className="text-sm leading-6 text-zinc-500">Ainda aguardando execução.</p>
        </GlassPanel>
      </section>

      <GlassPanel className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cn(
                "praxis-button-ghost px-4 py-2 text-[0.68rem]",
                filter === item.id && "border-[rgba(251,146,60,0.34)] text-[var(--accent)]",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((achievement) => (
            <article
              key={achievement.id}
              className={cn(
                "praxis-panel group h-full min-w-0 rounded-sm p-5 transition hover:border-[rgba(251,146,60,0.22)]",
                achievement.unlocked && "border-[rgba(251,146,60,0.28)]",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="text-4xl leading-none">{achievement.icon}</div>
                <span
                  className={cn(
                    "praxis-label shrink-0 rounded-sm border px-2 py-1",
                    achievement.unlocked
                      ? "border-[rgba(251,146,60,0.28)] text-[var(--accent)]"
                      : "border-zinc-800 text-zinc-500",
                  )}
                >
                  {achievement.rarity}
                </span>
              </div>
              <p className="mt-4 min-w-0 break-words text-lg font-medium text-zinc-100">
                {achievement.name}
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {achievement.description}
              </p>
            </article>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}
