"use client";

import { useMemo } from "react";
import { useAppStore } from "@/components/providers/app-store-provider";
import {
  Avatar,
  RankChip,
  RxLabel,
  RxPageHeader,
  RxPanel,
} from "@/components/redesign/primitives";
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

  // Top 3 for podium — order them as [2nd, 1st, 3rd] with varied heights
  const podium = leaderboard.slice(0, 3);
  const podiumLayout =
    podium.length === 3
      ? [
          { entry: podium[1], pos: 2, height: 140, hot: false },
          { entry: podium[0], pos: 1, height: 190, hot: true },
          { entry: podium[2], pos: 3, height: 110, hot: false },
        ]
      : podium.map((entry, idx) => ({
          entry,
          pos: idx + 1,
          height: 150 - idx * 20,
          hot: idx === 0,
        }));

  const tableRows = leaderboard.slice(0, 20);

  return (
    <div>
      <RxPageHeader
        title="Leaderboard"
        subtitle={
          <>
            Global · {leaderboard.length} operadores · você está em{" "}
            <span style={{ color: "var(--accent)" }}>#{currentIndex + 1}</span>
          </>
        }
      />

      {/* Podium */}
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
          {podiumLayout.map(({ entry, pos, height, hot }) => (
            <div
              key={entry.id}
              className={hot ? "rx-panel-hot" : "rx-panel"}
              style={{
                padding: 20,
                textAlign: "center",
                height: height + 100,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                position: "relative",
              }}
            >
              <div
                className="rx-display"
                style={{
                  position: "absolute",
                  top: 8,
                  right: 12,
                  fontSize: 48,
                  fontWeight: 700,
                  color: hot ? "var(--accent)" : "var(--fg-4)",
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                  opacity: 0.8,
                }}
              >
                #{pos}
              </div>
              <Avatar
                initials={initialsFor(entry.name)}
                size={hot ? 64 : 52}
                tier={entry.rankTier}
                online={false}
              />
              <div
                className="rx-display"
                style={{
                  fontSize: hot ? 20 : 16,
                  fontWeight: 700,
                  marginTop: 12,
                  color: "var(--fg)",
                  letterSpacing: "-0.02em",
                }}
              >
                {entry.username}
              </div>
              <div style={{ marginTop: 6 }}>
                <RankChip tier={`${entry.rankTier} ${entry.rankLabel ?? ""}`.trim()} />
              </div>
              <div
                className="rx-display"
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: "var(--accent)",
                  marginTop: 10,
                  letterSpacing: "-0.02em",
                }}
              >
                {formatPoints(entry.totalXp)}
              </div>
              <div
                className="rx-mono"
                style={{
                  fontSize: 9,
                  color: "var(--fg-3)",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  marginTop: 2,
                }}
              >
                XP TOTAL
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Table */}
      <RxPanel style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "50px 1fr 120px 100px 80px",
            padding: "12px 18px",
            borderBottom: "1px solid var(--line)",
            background: "rgba(0,0,0,0.4)",
          }}
        >
          {["RANK", "OPERADOR", "TIER", "XP TOTAL", "NÍVEL"].map((h) => (
            <div
              key={h}
              className="rx-mono"
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
              style={{
                display: "grid",
                gridTemplateColumns: "50px 1fr 120px 100px 80px",
                padding: "12px 18px",
                borderBottom: "1px solid var(--line-soft)",
                background: isSelf
                  ? "rgba(251,146,60,0.08)"
                  : "transparent",
                borderLeft: isSelf
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
                alignItems: "center",
                fontSize: 13,
              }}
            >
              <div
                className="rx-mono"
                style={{
                  color: isSelf ? "var(--accent)" : "var(--fg-3)",
                  fontWeight: 600,
                }}
              >
                #{index + 1}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 0,
                }}
              >
                <Avatar
                  initials={initialsFor(entry.name)}
                  size={28}
                  tier={entry.rankTier}
                  online={false}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: isSelf ? "var(--accent)" : "var(--fg)",
                      fontWeight: isSelf ? 600 : 400,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {entry.username}
                  </div>
                  <div
                    className="rx-mono"
                    style={{
                      fontSize: 9,
                      color: "var(--fg-4)",
                      letterSpacing: "0.12em",
                      marginTop: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {entry.name}
                  </div>
                </div>
              </div>
              <div
                className="rx-mono"
                style={{
                  fontSize: 10,
                  color: "var(--accent)",
                  letterSpacing: "0.14em",
                }}
              >
                ◆ {entry.rankTier} {entry.rankLabel}
              </div>
              <div className="rx-mono" style={{ color: "var(--fg-2)" }}>
                {formatPoints(entry.totalXp)}
              </div>
              <div className="rx-mono" style={{ color: "var(--fg-3)" }}>
                LVL {entry.level}
              </div>
            </div>
          );
        })}
      </RxPanel>
    </div>
  );
}
