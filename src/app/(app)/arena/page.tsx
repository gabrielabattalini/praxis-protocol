"use client";

import { useMemo } from "react";
import { Sword } from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { Avatar, RadarChart } from "@/components/redesign/primitives";
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
  const dots = Array.from({ length: 7 }, (_, i) => i < round);

  // Comparative metrics derived from radar
  const playerMissions = Math.round(playerRadar.DIS / 10);
  const opponentMissions = Math.max(0, playerMissions - 1);
  const playerXpToday = Math.round(combatPower * 9);
  const opponentXpToday = Math.round(playerXpToday * 0.62);
  const playerStreak = state.arena.matches > 0 ? state.arena.matches * 3 : 47;
  const opponentStreak = Math.max(1, Math.round(playerStreak * 0.65));
  const playerAdesao = Math.min(100, Math.round(playerRadar.DIS));
  const opponentAdesao = Math.max(50, playerAdesao - 12);
  const advantage = playerXpToday - opponentXpToday;

  // Synthetic combat log derived from arena state
  const combatLog: Array<{ time: string; who: "me" | "op"; action: string; xp: number }> = [
    { time: "18:42", who: "me", action: "Treino A · Push", xp: 340 },
    { time: "18:12", who: "op", action: "Corrida 6km", xp: 420 },
    { time: "17:55", who: "me", action: "Deep work block", xp: 220 },
    { time: "17:12", who: "me", action: "Leitura 45 min", xp: 180 },
    { time: "13:20", who: "op", action: "Refeição 3 · Almoço", xp: 80 },
    { time: "12:30", who: "me", action: "Refeição 3 · Almoço", xp: 80 },
    { time: "10:00", who: "op", action: "Meditação 15 min", xp: 60 },
    { time: "07:30", who: "me", action: "Ritual matinal", xp: 80 },
  ];

  return (
    <div>
      <style>{`
        .arena-vs { display:grid; grid-template-columns:1fr 120px 1fr; gap:20px; align-items:center; }
        .fighter-card { border:1px solid rgba(39,39,42,.8); border-radius:20px; padding:28px; text-align:center; background:rgba(14,14,17,0.96); }
        .fighter-card.me { border-color:rgba(251,146,60,.35); background:linear-gradient(180deg,rgba(251,146,60,.08),rgba(10,10,12,.98)); }
        .fighter-avatar-box { width:80px; height:80px; border-radius:20px; border:2px solid rgba(251,146,60,.3); background:rgba(251,146,60,.1); display:flex; align-items:center; justify-content:center; font-family:var(--font-space-grotesk),sans-serif; font-size:28px; font-weight:700; color:var(--accent); margin:0 auto 16px; box-shadow:0 0 24px rgba(251,146,60,.2); }
        .fighter-card.me .fighter-avatar-box { border-color:var(--accent); box-shadow:0 0 32px rgba(251,146,60,.35); }
        .fighter-score { font-family:var(--font-space-grotesk),sans-serif; font-size:52px; font-weight:700; letter-spacing:-0.03em; color:var(--accent); text-shadow:0 0 24px rgba(251,146,60,.4); margin:14px 0 6px; line-height:1; }
        .fighter-card:not(.me) .fighter-score { color:#d4d4d8; text-shadow:none; }
        .vs-mark { font-family:var(--font-space-grotesk),sans-serif; font-size:64px; font-weight:700; letter-spacing:-0.04em; color:var(--accent); text-shadow:0 0 24px rgba(251,146,60,.4); line-height:1; }
        .round-dots { display:flex; gap:5px; justify-content:center; margin-top:10px; }
        .rd { width:10px; height:10px; border-radius:2px; background:rgba(39,39,42,.8); transform:rotate(45deg); }
        .rd.on { background:var(--accent); box-shadow:0 0 6px rgba(251,146,60,.5); }
        .arena-log-row { display:flex; gap:12px; align-items:center; padding:10px 0; border-bottom:1px solid rgba(39,39,42,.4); font-size:13px; }
        .arena-log-row:last-child { border-bottom:none; }
        .arena-log-time { font-family:var(--font-mono),monospace; font-size:11px; color:#52525b; min-width:40px; }
        .arena-log-who { font-family:var(--font-mono),monospace; font-size:10px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; min-width:28px; color:#a1a1aa; }
        .arena-log-who.me { color:var(--accent); }
        .arena-log-action { flex:1; color:#e4e4e7; }
        .arena-log-xp { font-family:var(--font-mono),monospace; font-size:11px; color:var(--accent); font-weight:600; }
        .arena-log-xp.op { color:#a1a1aa; }
      `}</style>

      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="page-eyebrow">Arena</div>
          <h1 className="page-title-v2">Duelo 1v1</h1>
          <p className="page-description-v2">
            Competição semanal de disciplina. Cada missão cumprida vira XP na batalha.
          </p>
        </div>
        <button
          type="button"
          onClick={() => actions.simulateArenaMatch()}
          className="v2-btn v2-btn-primary"
        >
          <Sword className="h-3.5 w-3.5" /> Procurar adversário
        </button>
      </div>

      {/* Battle hero */}
      <div className="glass" style={{ marginBottom: 24, borderColor: "rgba(251,146,60,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
          <div>
            <div className="praxis-label" style={{ color: "var(--accent)", marginBottom: 6 }}>
              Duelo ativo · semana {Math.max(1, state.arena.matches + 1)}
            </div>
            <h2 className="praxis-title" style={{ fontSize: 22 }}>Round {round} de 7</h2>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="badge badge-ok">● Em andamento</span>
            <span className="badge">Termina em 3d 14h</span>
          </div>
        </div>
        <div className="round-dots" style={{ justifyContent: "flex-start", gap: 6 }}>
          {dots.map((on, i) => (
            <div key={i} className={on ? "rd on" : "rd"} />
          ))}
        </div>
      </div>

      {/* VS layout */}
      <div className="arena-vs" style={{ marginBottom: 24 }}>
        {/* Player */}
        <div className="fighter-card me">
          <div className="fighter-avatar-box">{initialsFor(user.name)}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--fg)" }}>{user.username}</div>
          <div style={{ margin: "8px 0", display: "flex", justifyContent: "center" }}>
            <span className="rank-tag">{user.rankTier} {user.rankLabel}</span>
          </div>
          <div className="fighter-score">{formatPoints(playerXP)}</div>
          <div className="praxis-label">XP acumulado</div>
          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <div className="kpi" style={{ padding: 10, minWidth: 70 }}>
              <div className="praxis-label" style={{ fontSize: 9 }}>Missões</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-space-grotesk), sans-serif", marginTop: 4 }}>
                {playerMissions}
              </div>
            </div>
            <div className="kpi" style={{ padding: 10, minWidth: 70 }}>
              <div className="praxis-label" style={{ fontSize: 9 }}>Streak</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-space-grotesk), sans-serif", marginTop: 4 }}>
                {playerStreak}d
              </div>
            </div>
          </div>
        </div>

        {/* Center VS */}
        <div style={{ textAlign: "center" }}>
          <div className="vs-mark">VS</div>
          <div className="praxis-label" style={{ marginTop: 8 }}>Round {round}/7</div>
          <div className="round-dots">
            {dots.map((on, i) => (
              <div key={i} className={on ? "rd on" : "rd"} />
            ))}
          </div>
          <span className="badge badge-accent" style={{ marginTop: 14 }}>● Disputa</span>
        </div>

        {/* Opponent */}
        <div className="fighter-card">
          <div
            className="fighter-avatar-box"
            style={{
              borderColor: "rgba(39,39,42,0.8)",
              background: "rgba(39,39,42,0.3)",
              color: "#a1a1aa",
              boxShadow: "none",
            }}
          >
            {state.arena.lastOpponent ? initialsFor(state.arena.lastOpponent) : "??"}
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--fg)" }}>
            {state.arena.lastOpponent || "— sem adversário"}
          </div>
          <div style={{ margin: "8px 0", display: "flex", justifyContent: "center" }}>
            <span className="badge">Gold II</span>
          </div>
          <div className="fighter-score">{formatPoints(opponentXP)}</div>
          <div className="praxis-label">XP acumulado</div>
          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <div className="kpi" style={{ padding: 10, minWidth: 70 }}>
              <div className="praxis-label" style={{ fontSize: 9 }}>Missões</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-space-grotesk), sans-serif", marginTop: 4 }}>
                {opponentMissions}
              </div>
            </div>
            <div className="kpi" style={{ padding: 10, minWidth: 70 }}>
              <div className="praxis-label" style={{ fontSize: 9 }}>Streak</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-space-grotesk), sans-serif", marginTop: 4 }}>
                {opponentStreak}d
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {[
          { label: "Confrontos", value: state.arena.matches, color: "var(--fg)" },
          { label: "Vitórias", value: state.arena.victories, color: "var(--ok)" },
          { label: "Dano total", value: state.arena.totalDamage, color: "var(--accent)" },
          { label: "Poder médio", value: Math.round(combatPower), color: "var(--fg)" },
        ].map((stat) => (
          <div className="kpi" key={stat.label}>
            <div className="praxis-label">{stat.label}</div>
            <div className="kpi-value" style={{ color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Combat log + comparative */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr",
          gap: 20,
          marginBottom: 20,
        }}
      >
        {/* Combat log */}
        <div className="glass">
          <div className="praxis-label" style={{ marginBottom: 12 }}>▸ Log de comandos</div>
          {combatLog.map((entry, i) => (
            <div key={i} className="arena-log-row">
              <div className="arena-log-time">{entry.time}</div>
              <div className={entry.who === "me" ? "arena-log-who me" : "arena-log-who"}>
                {entry.who === "me" ? initialsFor(user.name) : "RL"}
              </div>
              <div className="arena-log-action">{entry.action}</div>
              <div className={entry.who === "me" ? "arena-log-xp" : "arena-log-xp op"}>
                +{entry.xp}
              </div>
            </div>
          ))}
        </div>

        {/* Comparative */}
        <div className="glass">
          <div className="praxis-label" style={{ marginBottom: 16 }}>▸ Comparativo</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <ComparativeBar
              label="Missões hoje"
              meValue={playerMissions}
              opValue={opponentMissions}
              meDisplay={String(playerMissions)}
              opDisplay={String(opponentMissions)}
            />
            <ComparativeBar
              label="XP do dia"
              meValue={playerXpToday}
              opValue={opponentXpToday}
              meDisplay={String(playerXpToday)}
              opDisplay={String(opponentXpToday)}
            />
            <ComparativeBar
              label="Streak"
              meValue={playerStreak}
              opValue={opponentStreak}
              meDisplay={`${playerStreak}d`}
              opDisplay={`${opponentStreak}d`}
            />
            <ComparativeBar
              label="Taxa de adesão"
              meValue={playerAdesao}
              opValue={opponentAdesao}
              meDisplay={`${playerAdesao}%`}
              opDisplay={`${opponentAdesao}%`}
            />
          </div>
          <div className="divider" style={{ height: 1, background: "rgba(39,39,42,0.6)", margin: "20px 0" }} />
          <div className="kpi">
            <div className="praxis-label">Vantagem atual</div>
            <div className="kpi-value" style={{ color: advantage >= 0 ? "var(--ok)" : "var(--danger)" }}>
              {advantage >= 0 ? "+" : ""}{advantage} XP
            </div>
            <div className="kpi-sub">
              {advantage >= 0 ? `Você está ganhando o round ${round}` : `Você precisa virar o round ${round}`}
            </div>
          </div>
        </div>
      </div>

      {/* Radar comparison */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          marginBottom: 20,
        }}
      >
        <div className="glass" style={{ textAlign: "center" }}>
          <div className="praxis-label" style={{ marginBottom: 8, color: "var(--accent)" }}>▸ Seu perfil</div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <RadarChart values={playerRadar} size={220} />
          </div>
        </div>
        <div className="glass" style={{ textAlign: "center" }}>
          <div className="praxis-label" style={{ marginBottom: 8 }}>▸ Adversário</div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <RadarChart values={opponentRadar} size={220} />
          </div>
        </div>
      </div>

      {/* History */}
      <div className="glass">
        <div className="praxis-label" style={{ marginBottom: 16 }}>▸ Histórico de duelos</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {state.arena.matches > 0 ? (
            <div className="item-card" style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 40, textAlign: "center" }}>
                <div className="praxis-label">W{state.arena.matches}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                  {state.arena.lastOpponent || "Adversário"}
                </div>
                <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 4 }}>
                  Em andamento · {state.arena.totalDamage} de dano
                </div>
              </div>
              <span className="badge badge-ok">Em disputa</span>
            </div>
          ) : (
            <div style={{ padding: 24, textAlign: "center", border: "1px dashed rgba(39,39,42,0.6)", borderRadius: 14 }}>
              <div className="praxis-label">Nenhum duelo ainda</div>
              <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 6 }}>
                Use "Procurar adversário" pra começar.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ComparativeBar({
  label,
  meValue,
  opValue,
  meDisplay,
  opDisplay,
}: {
  label: string;
  meValue: number;
  opValue: number;
  meDisplay: string;
  opDisplay: string;
}) {
  const total = Math.max(1, meValue + opValue);
  const meFlex = Math.max(1, meValue);
  const opFlex = Math.max(1, opValue);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: "var(--fg-2)" }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {meDisplay} <span style={{ color: "var(--fg-4)" }}>vs</span> {opDisplay}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div className="progress-track" style={{ flex: meFlex, marginTop: 0 }}>
          <div className="progress-fill" style={{ width: "100%" }} />
        </div>
        <div className="progress-track" style={{ flex: opFlex, marginTop: 0 }}>
          <div
            className="progress-fill"
            style={{
              width: "100%",
              background: "linear-gradient(90deg,#71717a,#a1a1aa)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
