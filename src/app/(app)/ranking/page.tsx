"use client";

import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import { PageIntro } from "@/components/ui/page-intro";
import { rankingSeed } from "@/lib/mock-data";
import { cn, formatPoints } from "@/lib/utils";

export default function RankingPage() {
  const { user } = useAppStore();
  const leaderboard = [...rankingSeed];

  leaderboard.push({
    id: "current-user",
    name: user.name,
    username: user.username,
    totalXp: user.totalXp,
    level: user.level,
    rankTier: user.rankTier,
    rankLabel: user.rankLabel,
  });

  leaderboard.sort((left, right) => right.totalXp - left.totalXp);
  const currentIndex = leaderboard.findIndex((entry) => entry.id === "current-user");

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Competição"
        title="Ranking"
        description="Escala gamificada de rank E a S, progressão de nível e leitura geral do sistema com destaque para o operador atual."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-[0.82fr_1.18fr]">
        <GlassPanel className="space-y-4">
          <div>
            <p className="praxis-label text-[var(--accent)]">Sua posição</p>
            <h2 className="praxis-title mt-2 text-4xl">#{currentIndex + 1}</h2>
          </div>
          <div className="praxis-kpi space-y-3 p-4">
            <p className="truncate text-2xl font-medium text-zinc-100">{user.name}</p>
            <p className="truncate text-sm text-zinc-500">{user.username}</p>
            <p className="font-title text-4xl font-bold text-zinc-100">
              {formatPoints(user.totalXp)} XP
            </p>
            <p className="praxis-label text-[var(--accent)]">
              Rank {user.rankTier} | Nível {user.level}
            </p>
          </div>
        </GlassPanel>

        <GlassPanel className="space-y-4">
          <div>
            <p className="praxis-label text-[var(--accent)]">Top geral</p>
            <h2 className="praxis-title mt-2 text-3xl">Tabela principal</h2>
          </div>
          <div className="space-y-3">
            {leaderboard.slice(0, 10).map((entry, index) => (
              <div
                key={entry.id}
                className={cn(
                  "flex min-w-0 flex-col items-stretch justify-between gap-4 rounded-sm border px-4 py-4 sm:flex-row sm:items-center",
                  entry.id === "current-user"
                    ? "border-[rgba(251,146,60,0.32)] bg-[rgba(251,146,60,0.08)]"
                    : "border-zinc-800 bg-[linear-gradient(180deg,rgba(18,18,20,0.96),rgba(10,10,12,0.98))]",
                )}
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border border-zinc-800 bg-black/60 text-sm font-semibold text-zinc-200">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-100">{entry.name}</p>
                    <p className="truncate text-sm text-zinc-500">{entry.username}</p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-semibold text-zinc-100">
                    {formatPoints(entry.totalXp)} XP
                  </p>
                  <p className="text-sm text-zinc-500">
                    Rank {entry.rankTier} | Nível {entry.level}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </section>
    </div>
  );
}
