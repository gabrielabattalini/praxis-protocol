"use client";

import { useState } from "react";
import { achievementCatalog } from "@/lib/mock-data";
import {
  RxChip,
  RxLabel,
  RxPBar,
  RxPageHeader,
  RxPanel,
} from "@/components/redesign/primitives";
import type { AchievementCategory, Achievement } from "@/lib/types";

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

const rarityColors: Record<Achievement["rarity"], string> = {
  Comum: "var(--fg-3)",
  Incomum: "var(--ocean)",
  Raro: "var(--accent)",
  Épico: "var(--purple)",
  Lendário: "var(--warn)",
};

export default function AchievementsPage() {
  const [filter, setFilter] = useState<AchievementCategory | "all">("all");
  const visible = achievementCatalog.filter(
    (item) => filter === "all" || item.category === filter,
  );
  const unlockedCount = visible.filter((item) => item.unlocked).length;

  return (
    <div>
      <RxPageHeader
        title="Conquistas"
        subtitle={
          <>
            {unlockedCount} desbloqueadas · {visible.length} totais ·{" "}
            {visible.length - unlockedCount} em progresso
          </>
        }
      />

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        {filters.map((item) => (
          <RxChip
            key={item.id}
            as="button"
            active={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label.toUpperCase()}
          </RxChip>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        {visible.map((achievement) => {
          const color = rarityColors[achievement.rarity];
          const done = achievement.unlocked;
          return (
            <div
              key={achievement.id}
              className="rx-panel"
              style={{
                padding: 18,
                position: "relative",
                opacity: done ? 1 : 0.55,
                borderColor: done ? color : "var(--line)",
                minHeight: 180,
              }}
            >
              {done ? (
                <div
                  className="rx-mono"
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    fontSize: 9,
                    color,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                  }}
                >
                  ◆ {achievement.rarity}
                </div>
              ) : (
                <div
                  className="rx-mono"
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    fontSize: 9,
                    color: "var(--fg-4)",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                  }}
                >
                  ◇ {achievement.rarity}
                </div>
              )}
              <div
                style={{
                  width: 56,
                  height: 56,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `1.5px solid ${done ? color : "var(--line-bright)"}`,
                  background: done
                    ? `color-mix(in srgb, ${color} 15%, transparent)`
                    : "rgba(0,0,0,0.3)",
                  color: done ? color : "var(--fg-4)",
                  marginBottom: 14,
                  boxShadow: done
                    ? `0 0 20px color-mix(in srgb, ${color} 25%, transparent)`
                    : "none",
                  fontSize: 24,
                  borderRadius: 2,
                }}
              >
                {achievement.icon}
              </div>
              <div
                className="rx-display"
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 4,
                  color: "var(--fg)",
                  letterSpacing: "-0.01em",
                }}
              >
                {achievement.name}
              </div>
              <div
                className="rx-mono"
                style={{
                  fontSize: 10,
                  color: "var(--fg-4)",
                  letterSpacing: "0.1em",
                  lineHeight: 1.5,
                }}
              >
                {achievement.description}
              </div>
              {!done ? (
                <div style={{ marginTop: 12 }}>
                  <RxPBar value={38} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <RxPanel style={{ padding: 32, textAlign: "center" }}>
          <RxLabel>NENHUMA CONQUISTA</RxLabel>
          <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 6 }}>
            Ajuste o filtro para ver outras conquistas.
          </div>
        </RxPanel>
      ) : null}
    </div>
  );
}
