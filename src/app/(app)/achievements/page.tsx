"use client";

import { useState } from "react";
import { achievementCatalog } from "@/lib/mock-data";
import { RxChip, RxPBar } from "@/components/redesign/primitives";
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

// Map achievement rarity → v2.0 rarity class
const rarityClass: Record<Achievement["rarity"], string> = {
  Comum: "",
  Incomum: "rare",
  Raro: "rare",
  Épico: "epic",
  Lendário: "legendary",
};

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
      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div className="page-eyebrow">Registro de méritos</div>
        <h1 className="page-title-v2">Conquistas</h1>
        <p className="page-description-v2">
          {unlockedCount} desbloqueadas · {visible.length} totais ·{" "}
          {visible.length - unlockedCount} em progresso
        </p>
      </div>

      {/* Filter chips */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 24,
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

      {/* Achievement grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        {visible.map((achievement) => {
          const color = rarityColors[achievement.rarity];
          const rarityCls = rarityClass[achievement.rarity];
          const stateCls = achievement.unlocked ? "unlocked" : "locked";
          return (
            <div
              key={achievement.id}
              className={`achievement-card ${rarityCls} ${stateCls}`.trim()}
            >
              {/* Rarity badge — top-right */}
              <div
                className="praxis-label"
                style={{
                  position: "absolute",
                  top: 12,
                  right: 14,
                  fontSize: 9,
                  color: achievement.unlocked ? color : "var(--fg-4)",
                  letterSpacing: "0.18em",
                }}
              >
                {achievement.unlocked ? "◆" : "◇"} {achievement.rarity}
              </div>

              {/* Icon tile */}
              <div
                className="achievement-icon"
                style={{
                  border: `1.5px solid ${achievement.unlocked ? color : "rgba(39,39,42,0.8)"}`,
                  background: achievement.unlocked
                    ? `color-mix(in srgb, ${color} 15%, transparent)`
                    : "rgba(0,0,0,0.3)",
                  color: achievement.unlocked ? color : "var(--fg-4)",
                  boxShadow: achievement.unlocked
                    ? `0 0 20px color-mix(in srgb, ${color} 25%, transparent)`
                    : "none",
                  fontSize: 24,
                }}
              >
                {achievement.icon}
              </div>

              {/* Title + desc */}
              <div
                style={{
                  fontFamily: "var(--font-space-grotesk), sans-serif",
                  fontSize: 15,
                  fontWeight: 600,
                  marginBottom: 6,
                  color: "var(--fg)",
                  letterSpacing: "-0.01em",
                }}
              >
                {achievement.name}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--fg-3)",
                  lineHeight: 1.55,
                }}
              >
                {achievement.description}
              </div>

              {/* Progress for locked items */}
              {!achievement.unlocked ? (
                <div style={{ marginTop: 14 }}>
                  <RxPBar value={38} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="glass" style={{ padding: 40, textAlign: "center", marginTop: 16 }}>
          <div className="praxis-label">NENHUMA CONQUISTA</div>
          <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 8 }}>
            Ajuste o filtro para ver outras conquistas.
          </div>
        </div>
      ) : null}
    </div>
  );
}
