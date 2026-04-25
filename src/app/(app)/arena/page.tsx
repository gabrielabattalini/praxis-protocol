"use client";

import { useMemo } from "react";
import { Sword, Zap } from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import {
  Avatar,
  RadarChart,
  RankChip,
  RxLabel,
  RxPageHeader,
  RxPanel,
  RxPBar,
} from "@/components/redesign/primitives";
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

export default function ArenaPage() {
  const { state, user, actions } = useAppStore();

  const combatPower = useMemo(() => {
    const values = Object.values(user.characterStats);
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [user.characterStats]);

  // Player radar — normalize skill scores (0..5) to 0..100
  const playerRadar = useMemo(
    () => ({
      ENE: Math.round(user.skillScores.energy * 20),
      FOC: Math.round(user.skillScores.focus * 20),
      DIS: Math.round(user.skillScores.discipline * 20),
      PRO: Math.round(user.skillScores.production * 20),
      MOT: Math.round(user.skillScores.motivation * 20),
    }),
    [
      user.skillScores.discipline,
      user.skillScores.energy,
      user.skillScores.focus,
      user.skillScores.motivation,
      user.skillScores.production,
    ],
  );

  // Opponent radar — slightly weaker profile
  const opponentRadar = useMemo(
    () => ({
      ENE: Math.max(40, playerRadar.ENE - 8),
      FOC: Math.max(40, playerRadar.FOC - 6),
      DIS: Math.max(40, playerRadar.DIS - 15),
      PRO: Math.min(100, playerRadar.PRO + 10),
      MOT: Math.max(40, playerRadar.MOT - 10),
    }),
    [playerRadar],
  );

  const playerXP = user.totalXp;
  const opponentXP = Math.round(playerXP * 0.85);
  const round = Math.max(1, Math.min(7, state.arena.matches % 8));
  const filled = Array.from({ length: 7 }, (_, i) => (i < round ? 1 : 0));

  return (
    <div>
      <RxPageHeader
        title="Arena · Duelo 1v1"
        subtitle={
          state.arena.matches > 0
            ? `${state.arena.matches} partidas · ${state.arena.victories} vitórias · dano acumulado ${state.arena.totalDamage}`
            : "Nenhuma partida ainda · simule um adversário para começar"
        }
        actions={
          <button
            type="button"
            onClick={() => actions.simulateArenaMatch()}
            className="rx-btn-primary"
            style={{
              padding: "8px 14px",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Sword className="h-3 w-3" /> Procurar adversário
          </button>
        }
      />

      {/* Duel header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 120px 1fr",
          gap: 20,
          marginBottom: 24,
        }}
      >
        {/* Player */}
        <RxPanel hot style={{ padding: 24, textAlign: "center" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Avatar
              initials={initialsFor(user.name)}
              size={80}
              tier={user.rankTier}
              online={false}
            />
          </div>
          <div
            className="rx-display"
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--fg)",
              letterSpacing: "-0.02em",
            }}
          >
            {user.username}
          </div>
          <div style={{ marginTop: 8 }}>
            <RankChip tier={`${user.rankTier} ${user.rankLabel}`} />
          </div>
          <div
            className="rx-display"
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: "var(--accent)",
              marginTop: 20,
              textShadow: "0 0 20px var(--accent-glow)",
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            {formatPoints(playerXP)}
          </div>
          <div
            className="rx-mono"
            style={{
              fontSize: 10,
              color: "var(--fg-3)",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              marginTop: 4,
            }}
          >
            XP ACUMULADO · RD {round}
          </div>
        </RxPanel>

        {/* VS */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
          }}
        >
          <div
            className="rx-display"
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: "var(--accent)",
              letterSpacing: "-0.04em",
              textShadow: "0 0 30px var(--accent-glow)",
              lineHeight: 1,
            }}
          >
            VS
          </div>
          <div
            className="rx-mono"
            style={{
              fontSize: 10,
              color: "var(--fg-3)",
              letterSpacing: "0.24em",
            }}
          >
            ROUND {round} / 7
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {filled.map((d, i) => (
              <div
                key={i}
                style={{
                  width: 10,
                  height: 10,
                  background: d ? "var(--accent)" : "var(--line-bright)",
                  transform: "rotate(45deg)",
                }}
              />
            ))}
          </div>
          <span className="rx-chip-accent" style={{ marginTop: 8 }}>
            ● EM DISPUTA
          </span>
        </div>

        {/* Opponent */}
        <RxPanel style={{ padding: 24, textAlign: "center" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Avatar
              initials={
                state.arena.lastOpponent
                  ? initialsFor(state.arena.lastOpponent)
                  : "??"
              }
              size={80}
              tier="SILVER"
              online={false}
            />
          </div>
          <div
            className="rx-display"
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--fg)",
              letterSpacing: "-0.02em",
            }}
          >
            {state.arena.lastOpponent || "— sem adversário"}
          </div>
          <div style={{ marginTop: 8 }}>
            <RankChip tier="GOLD II" />
          </div>
          <div
            className="rx-display"
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: "var(--fg-2)",
              marginTop: 20,
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            {formatPoints(opponentXP)}
          </div>
          <div
            className="rx-mono"
            style={{
              fontSize: 10,
              color: "var(--fg-3)",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              marginTop: 4,
            }}
          >
            XP ACUMULADO
          </div>
        </RxPanel>
      </div>

      {/* Stats summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {[
          { label: "CONFRONTOS", value: state.arena.matches },
          { label: "VITÓRIAS", value: state.arena.victories },
          { label: "DANO TOTAL", value: state.arena.totalDamage },
          { label: "PODER MÉDIO", value: Math.round(combatPower) },
        ].map((stat) => (
          <RxPanel key={stat.label} style={{ padding: 16 }}>
            <div
              className="rx-mono"
              style={{
                fontSize: 9,
                color: "var(--fg-3)",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              {stat.label}
            </div>
            <div
              className="rx-display"
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "var(--fg)",
                marginTop: 6,
                letterSpacing: "-0.02em",
              }}
            >
              {stat.value}
            </div>
          </RxPanel>
        ))}
      </div>

      {/* Combat log + radars */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <RxPanel style={{ padding: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <RxLabel>LOG DE COMBATE</RxLabel>
            <Zap className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
          </div>
          {state.arena.combatLog.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {state.arena.combatLog.slice(0, 10).map((log, i) => (
                <div
                  key={`${log}-${i}`}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom: "1px solid var(--line-soft)",
                    fontSize: 12,
                    color: "var(--fg-2)",
                    wordBreak: "break-word",
                  }}
                >
                  <span
                    className="rx-mono"
                    style={{
                      fontSize: 10,
                      color: "var(--fg-4)",
                      letterSpacing: "0.12em",
                      minWidth: 36,
                    }}
                  >
                    #{i + 1}
                  </span>
                  <span style={{ flex: 1 }}>{log}</span>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="rx-mono"
              style={{
                padding: 24,
                textAlign: "center",
                fontSize: 10,
                letterSpacing: "0.18em",
                color: "var(--fg-4)",
                textTransform: "uppercase",
              }}
            >
              NENHUMA LUTA SIMULADA AINDA
            </div>
          )}
        </RxPanel>

        <div
          style={{
            display: "grid",
            gridTemplateRows: "1fr 1fr",
            gap: 16,
          }}
        >
          <RxPanel style={{ padding: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <RxLabel>{user.username.toUpperCase()} · RADAR</RxLabel>
              <span
                className="rx-mono"
                style={{ fontSize: 10, color: "var(--accent)" }}
              >
                VOCÊ
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <RadarChart values={playerRadar} size={160} />
            </div>
          </RxPanel>
          <RxPanel style={{ padding: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <RxLabel>OPONENTE · RADAR</RxLabel>
              <span
                className="rx-mono"
                style={{ fontSize: 10, color: "var(--fg-3)" }}
              >
                SIMULADO
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <RadarChart values={opponentRadar} size={160} />
            </div>
          </RxPanel>
        </div>
      </div>

      {/* Character stats */}
      <RxPanel style={{ padding: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <RxLabel>ATRIBUTOS DE COMBATE</RxLabel>
          <span
            className="rx-mono"
            style={{
              fontSize: 10,
              color: "var(--fg-3)",
              letterSpacing: "0.18em",
            }}
          >
            PODER · {Math.round(combatPower)}
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {Object.entries(user.characterStats).map(([stat, value]) => (
            <div
              key={stat}
              style={{
                padding: 12,
                border: "1px solid var(--line)",
                background: "rgba(0,0,0,0.3)",
                borderRadius: 2,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <span
                  className="rx-mono"
                  style={{
                    fontSize: 10,
                    color: "var(--fg-3)",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                  }}
                >
                  {stat}
                </span>
                <span
                  className="rx-mono"
                  style={{
                    fontSize: 10,
                    color: "var(--accent)",
                    letterSpacing: "0.12em",
                  }}
                >
                  {value}
                </span>
              </div>
              <RxPBar value={value} />
            </div>
          ))}
        </div>
      </RxPanel>
    </div>
  );
}
