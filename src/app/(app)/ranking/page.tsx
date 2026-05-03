"use client";

import { useMemo } from "react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { Avatar, RankChip } from "@/components/redesign/primitives";
import { rankingSeed } from "@/lib/mock-data";
import { formatPoints } from "@/lib/utils";

function initialsFor(name: string) {
  return (
    name
      .split(/[\s.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "OP"
  );
}

export default function RankingPage() {
  const { user } = useAppStore();

  const leaderboard = useMemo(() => {
    const list = [
      ...rankingSeed,
      {
        id: "current-user",
        name: user.name,
        username: user.username,
        totalXp: user.totalXp,
        level: user.level,
        rankTier: user.rankTier,
        rankLabel: user.rankLabel,
      },
    ];
    list.sort((left, right) => right.totalXp - left.totalXp);
    return list;
  }, [
    user.level,
    user.name,
    user.rankLabel,
    user.rankTier,
    user.totalXp,
    user.username,
  ]);

  const currentIndex = leaderboard.findIndex(
    (entry) => entry.id === "current-user",
  );

  // Top 3 for podium — order them as [2nd, 1st, 3rd]
  const podium = leaderboard.slice(0, 3);
  const podiumLayout =
    podium.length === 3
      ? [
          { entry: podium[1], pos: 2, isFirst: false },
          { entry: podium[0], pos: 1, isFirst: true },
          { entry: podium[2], pos: 3, isFirst: false },
        ]
      : podium.map((entry, idx) => ({
          entry,
          pos: idx + 1,
          isFirst: idx === 0,
        }));

  const tableRows = leaderboard.slice(0, 20);

  return (
    <div>
      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div className="page-eyebrow">Leaderboard global</div>
        <h1 className="page-title-v2">Ranking</h1>
        <p className="page-description-v2">
          {leaderboard.length} operadores · você está em{" "}
          <span style={{ color: "var(--accent)" }}>#{currentIndex + 1}</span>
        </p>
      </div>

      {/* Podium — top 3 with first centered + accent */}
      {podium.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              podium.length === 3 ? "1fr 1.2fr 1fr" : `repeat(${podium.length}, 1fr)`,
            gap: 16,
            marginBottom: 32,
            alignItems: "end",
          }}
        >
          {podiumLayout.map(({ entry, pos, isFirst }) => (
            <div
              key={entry.id}
              className={`podium-card${isFirst ? " first" : ""}`}
            >
              <div className="podium-rank">#{pos}</div>
              <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
                <Avatar
                  initials={initialsFor(entry.name)}
                  size={isFirst ? 64 : 52}
                  tier={entry.rankTier}
                  online={false}
                />
              </div>
              <div
                style={{
                  fontFamily: "var(--font-space-grotesk), sans-serif",
                  fontSize: isFirst ? 18 : 15,
                  fontWeight: 700,
                  marginTop: 12,
                  color: "var(--fg)",
                  letterSpacing: "-0.02em",
                }}
              >
                {entry.username}
              </div>
              <div style={{ marginTop: 8, display: "flex", justifyContent: "center" }}>
                <RankChip tier={`${entry.rankTier} ${entry.rankLabel ?? ""}`.trim()} />
              </div>
              <div className="podium-xp">{formatPoints(entry.totalXp)}</div>
              <div
                className="praxis-label"
                style={{
                  fontSize: 9,
                  color: "var(--fg-3)",
                  marginTop: 4,
                  letterSpacing: "0.2em",
                }}
              >
                XP TOTAL
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Leaderboard table */}
      <div className="glass" style={{ padding: 0, overflow: "hidden" }}>
        <div
          className="lb-row"
          style={{
            background: "rgba(0,0,0,0.4)",
            borderBottom: "1px solid rgba(39,39,42,0.8)",
            padding: "14px 18px",
          }}
        >
          {["RANK", "OPERADOR", "TIER", "XP TOTAL", "STREAK", "NÍVEL"].map((h) => (
            <div
              key={h}
              className="praxis-label"
              style={{
                fontSize: 9,
                color: "var(--fg-3)",
                letterSpacing: "0.22em",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              {h}
            </div>
          ))}
        </div>
        {tableRows.map((entry, index) => {
          const isSelf = entry.id === "current-user";
          return (
            <div
              key={entry.id}
              className={`lb-row${isSelf ? " me" : ""}`}
            >
              <div className="lb-pos" style={{ color: isSelf ? "var(--accent)" : undefined, fontWeight: isSelf ? 700 : 400 }}>
                #{index + 1}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <Avatar
                  initials={initialsFor(entry.name)}
                  size={32}
                  tier={entry.rankTier}
                  online={false}
                />
                <div style={{ minWidth: 0 }}>
                  <div className="lb-name" style={{ color: isSelf ? "var(--accent)" : undefined, fontWeight: isSelf ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {entry.username}
                  </div>
                  <div className="lb-sub" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {entry.name}
                  </div>
                </div>
              </div>
              <div>
                <RankChip tier={`${entry.rankTier} ${entry.rankLabel ?? ""}`.trim()} />
              </div>
              <div className="lb-xp">{formatPoints(entry.totalXp)}</div>
              <div className="lb-streak">—</div>
              <div className="lb-streak">LV {entry.level}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
