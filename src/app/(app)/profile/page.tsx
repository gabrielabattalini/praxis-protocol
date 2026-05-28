"use client";

import { useState } from "react";
import { LifeAreaProfileEditor } from "@/components/life-area-profile-editor";
import { useAppStore } from "@/components/providers/app-store-provider";
import {
  RadarChart,
  RxLabel,
  RxPanel,
} from "@/components/redesign/primitives";
import type {
  ActivityLevel,
  BiologicalSex,
  CardioGoal,
  CardioPreference,
} from "@/lib/types";
import { formatPoints } from "@/lib/utils";

function createPersonalFormFromProfile(profile: {
  ageYears: number;
  bodyHeightCm: number;
  bodyWeightKg: number;
  biologicalSex: BiologicalSex;
  restingHeartRateBpm?: number;
  activityLevel: ActivityLevel;
  cardioGoal: CardioGoal;
  preferredCardio: CardioPreference;
  hasCardiovascularCondition: boolean;
  hasJointLimitation: boolean;
  usesHeartRateMedication: boolean;
  notes?: string;
}) {
  return {
    ageYears: String(profile.ageYears),
    bodyHeightCm: String(profile.bodyHeightCm),
    bodyWeightKg: String(profile.bodyWeightKg),
    biologicalSex: profile.biologicalSex,
    restingHeartRateBpm: profile.restingHeartRateBpm
      ? String(profile.restingHeartRateBpm)
      : "",
    activityLevel: profile.activityLevel,
    cardioGoal: profile.cardioGoal,
    preferredCardio: profile.preferredCardio,
    hasCardiovascularCondition: profile.hasCardiovascularCondition,
    hasJointLimitation: profile.hasJointLimitation,
    usesHeartRateMedication: profile.usesHeartRateMedication,
    notes: profile.notes ?? "",
  };
}

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

const activityLevelOptions: Array<{ value: ActivityLevel; label: string }> = [
  { value: "sedentary", label: "Baixo" },
  { value: "light", label: "Leve" },
  { value: "moderate", label: "Moderado" },
  { value: "high", label: "Alto" },
];

const cardioGoalOptions: Array<{ value: CardioGoal; label: string }> = [
  { value: "health", label: "Saúde e consistência" },
  { value: "fat-loss", label: "Secar e aumentar gasto" },
  { value: "maintenance", label: "Manter condicionamento" },
  { value: "performance", label: "Performance e ritmo" },
  { value: "muscle-gain", label: "Ganhar massa sem exagerar" },
];

const cardioPreferenceOptions: Array<{
  value: CardioPreference;
  label: string;
}> = [
  { value: "running", label: "Corrida" },
  { value: "walking", label: "Caminhada" },
  { value: "bike", label: "Bike" },
  { value: "elliptical", label: "Elíptico" },
  { value: "stairs", label: "Escada" },
];

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "rgba(0,0,0,0.4)",
  border: "1px solid var(--line)",
  borderRadius: 12,
  color: "var(--fg)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 9,
  color: "var(--fg-3)",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  marginBottom: 6,
  fontFamily: "var(--rx-mono, ui-monospace, monospace)",
};

export default function ProfilePage() {
  const { user, state, actions } = useAppStore();
  const xpProgress = user.isMaxLevel
    ? 100
    : Math.round((user.xp / Math.max(1, user.xpToNextLevel)) * 100);
  const [saveFeedback, setSaveFeedback] = useState("");
  const [personalForm, setPersonalForm] = useState(() =>
    createPersonalFormFromProfile(state.personalProfile),
  );

  const weightKg = Number(personalForm.bodyWeightKg.replace(",", ".")) || 0;
  const heightCm = Number(personalForm.bodyHeightCm.replace(",", ".")) || 0;
  const bmi =
    weightKg > 0 && heightCm > 0 ? weightKg / (heightCm / 100) ** 2 : 0;
  const estimatedMaxHeartRate = Math.max(
    120,
    220 - (Number(personalForm.ageYears) || state.personalProfile.ageYears),
  );
  const hydrationTargetLiters =
    (state.dailyNutritionTargets.perKg.waterMl * weightKg) / 1000;
  const cardioZoneMin = Math.max(90, Math.round(estimatedMaxHeartRate * 0.6));
  const cardioZoneMax = Math.max(
    cardioZoneMin,
    Math.round(estimatedMaxHeartRate * 0.75),
  );

  // Skill scores normalized 0..5 → 0..100 for radar chart
  const radarValues = Object.fromEntries(
    Object.entries(user.skillScores).map(([k, v]) => [
      k,
      Math.min(100, Math.max(0, (Number(v) / 5) * 100)),
    ]),
  );

  function updatePersonalField<Key extends keyof typeof personalForm>(
    key: Key,
    value: (typeof personalForm)[Key],
  ) {
    setPersonalForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handlePersonalProfileSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextWeightKg = Math.max(
      1,
      Number(personalForm.bodyWeightKg.replace(",", ".")) ||
        state.personalProfile.bodyWeightKg,
    );
    const nextHeightCm = Math.max(
      1,
      Number(personalForm.bodyHeightCm.replace(",", ".")) ||
        state.personalProfile.bodyHeightCm,
    );
    const nextAgeYears = Math.max(
      1,
      Math.round(
        Number(personalForm.ageYears) || state.personalProfile.ageYears,
      ),
    );
    const nextRestingHeartRate =
      Number(personalForm.restingHeartRateBpm) > 0
        ? Number(personalForm.restingHeartRateBpm)
        : undefined;

    actions.updatePersonalProfile({
      ageYears: nextAgeYears,
      bodyHeightCm: nextHeightCm,
      bodyWeightKg: nextWeightKg,
      biologicalSex: personalForm.biologicalSex as BiologicalSex,
      restingHeartRateBpm: nextRestingHeartRate,
      activityLevel: personalForm.activityLevel,
      cardioGoal: personalForm.cardioGoal,
      preferredCardio: personalForm.preferredCardio,
      hasCardiovascularCondition: personalForm.hasCardiovascularCondition,
      hasJointLimitation: personalForm.hasJointLimitation,
      usesHeartRateMedication: personalForm.usesHeartRateMedication,
      notes: personalForm.notes,
    });

    actions.updateNutritionTargets({
      bodyWeightKg: nextWeightKg,
      bodyHeightCm: nextHeightCm,
      ageYears: nextAgeYears,
      biologicalSex: personalForm.biologicalSex as BiologicalSex,
      waterMlPerKg: state.dailyNutritionTargets.perKg.waterMl,
      proteinPerKg: state.dailyNutritionTargets.perKg.protein,
      carbsPerKg: state.dailyNutritionTargets.perKg.carbs,
      fatPerKg: state.dailyNutritionTargets.perKg.fat,
      fiberStrategy: state.dailyNutritionTargets.fiberStrategy,
      fiberPerKg: state.dailyNutritionTargets.fiberPerKg,
      fiberRatioGrams: state.dailyNutritionTargets.fiberRatioGrams,
      fiberRatioCalories: state.dailyNutritionTargets.fiberRatioCalories,
      sodiumTargetMg: state.dailyNutritionTargets.sodiumTargetMg,
      targetWeightKg: state.dailyNutritionTargets.weightGoal.targetWeightKg,
      weeklyChangeKg: state.dailyNutritionTargets.weightGoal.weeklyChangeKg,
      basalMetabolicRate:
        state.dailyNutritionTargets.basalMetabolicRateSource === "manual"
          ? state.dailyNutritionTargets.basalMetabolicRate
          : undefined,
      basalMetabolicRateSource:
        state.dailyNutritionTargets.basalMetabolicRateSource,
    });

    actions.completeBodyMetricsSetup();
    setPersonalForm(
      createPersonalFormFromProfile({
        ageYears: nextAgeYears,
        bodyHeightCm: nextHeightCm,
        bodyWeightKg: nextWeightKg,
        biologicalSex: personalForm.biologicalSex as BiologicalSex,
        restingHeartRateBpm: nextRestingHeartRate,
        activityLevel: personalForm.activityLevel,
        cardioGoal: personalForm.cardioGoal,
        preferredCardio: personalForm.preferredCardio,
        hasCardiovascularCondition: personalForm.hasCardiovascularCondition,
        hasJointLimitation: personalForm.hasJointLimitation,
        usesHeartRateMedication: personalForm.usesHeartRateMedication,
        notes: personalForm.notes,
      }),
    );
    setSaveFeedback("Dados pessoais atualizados.");
  }

  // 12-segment XP bar fill count
  const xpSegmentsFilled = Math.min(20, Math.round((xpProgress / 100) * 20));
  const xpSegments = Array.from({ length: 20 }, (_, i) => i < xpSegmentsFilled);

  return (
    <div>
      <style>{`
        .profile-layout { display: grid; grid-template-columns: 320px 1fr; gap: 24px; align-items: start; min-width: 0; }
        .profile-layout > * { min-width: 0; }
        .profile-card-v2 {
          border: 1px solid rgba(251,146,60,0.3);
          border-radius: 20px;
          padding: 28px;
          text-align: center;
          background: linear-gradient(180deg, rgba(251,146,60,0.06), rgba(10,10,12,0.98));
          min-width: 0;
          overflow: hidden;
        }
        .profile-card-v2 .xp-segs { min-width: 0; overflow: hidden; }
        .profile-card-v2 .xp-seg { min-width: 0; }
        .profile-card-v2 .rank-tag { max-width: 100%; white-space: normal; text-align: center; }
        .profile-avatar-v2 {
          width: 96px; height: 96px;
          border-radius: 24px;
          border: 2px solid var(--accent);
          background: rgba(251,146,60,0.1);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 36px; font-weight: 700; color: var(--accent);
          margin: 0 auto 16px;
          box-shadow: 0 0 32px rgba(251,146,60,0.25);
        }
        .stat-trio { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 20px; min-width: 0; }
        .stat-box {
          padding: 14px 8px;
          border: 1px solid rgba(39,39,42,0.6);
          border-radius: 12px;
          text-align: center;
          min-width: 0;
          overflow: hidden;
        }
        .stat-num { font-family: var(--font-space-grotesk), sans-serif; font-size: 24px; font-weight: 700; color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .timeline-bar { height: 60px; display: flex; align-items: flex-end; gap: 3px; }
        .tbar { flex: 1; border-radius: 3px; background: var(--accent); opacity: 0.5; transition: opacity 0.15s; }
        .tbar:last-child { opacity: 1; }
        .tbar:hover { opacity: 1; }
        @media (max-width: 900px) { .profile-layout { grid-template-columns: 1fr; } }
        @media (max-width: 768px) {
          .profile-card-v2 { padding: 20px 16px; }
          .profile-card-v2 .rank-tag { letter-spacing: 0.12em; font-size: 9px; padding: 4px 8px; }
          .stat-trio { gap: 6px; }
          .stat-box { padding: 10px 4px; }
          .stat-num { font-size: 18px; }
        }
      `}</style>

      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div className="page-eyebrow">Perfil</div>
        <h1 className="page-title-v2">{user.username}</h1>
        <p className="page-description-v2">
          Identidade · Nível {user.level} · {formatPoints(user.totalXp)} XP totais
        </p>
      </div>

      {/* Profile layout — 320px left card + right column */}
      <div className="profile-layout" style={{ marginBottom: 24 }}>
        {/* LEFT: profile card + recent achievements */}
        <div>
          <div className="profile-card-v2">
            <div className="profile-avatar-v2">{initialsFor(user.name)}</div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 600,
                fontFamily: "var(--font-space-grotesk), sans-serif",
                color: "var(--fg)",
              }}
            >
              {user.username}
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 4 }}>
              @{user.username} · {user.name}
            </div>
            <div style={{ margin: "16px 0", display: "flex", justifyContent: "center" }}>
              <span className="rank-tag">
                {user.rankTier} {user.rankLabel} · Nível {user.level}
              </span>
            </div>
            {/* XP segments */}
            <div style={{ margin: "16px 0" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span className="praxis-label">LVL {user.level}</span>
                <span className="praxis-label">
                  {user.isMaxLevel ? "MAX" : `${user.xp} / ${user.xpToNextLevel} XP`}
                </span>
              </div>
              <div className="xp-segs">
                {xpSegments.map((on, i) => (
                  <div key={i} className={on ? "xp-seg on" : "xp-seg"} />
                ))}
              </div>
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--fg-3)",
                fontStyle: "italic",
                padding: 14,
                borderTop: "1px solid rgba(39,39,42,0.4)",
                marginTop: 8,
              }}
            >
              {state.personalProfile.notes?.trim()
                ? `"${state.personalProfile.notes.trim()}"`
                : `"Execução é sistema. Não é humor."`}
            </div>
            <div className="stat-trio">
              <div className="stat-box">
                <div className="stat-num">{user.streak ?? 0}</div>
                <div className="praxis-label" style={{ fontSize: 9 }}>STREAK</div>
              </div>
              <div className="stat-box">
                <div className="stat-num">
                  {user.nextRankTier ? `→ ${user.nextRankTier}` : `Lv ${user.level}`}
                </div>
                <div className="praxis-label" style={{ fontSize: 9 }}>RANK</div>
              </div>
              <div className="stat-box">
                <div className="stat-num">
                  {Object.keys(state.settings.activeModules ?? {}).length || 0}
                </div>
                <div className="praxis-label" style={{ fontSize: 9 }}>MÓDULOS</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <a
                href="/settings"
                className="v2-btn"
                style={{ width: "100%", justifyContent: "center" }}
              >
                Editar perfil
              </a>
            </div>
          </div>

          {/* Character stats list (replaces the old "ATRIBUTOS · STATUS" panel) */}
          <div className="glass" style={{ marginTop: 16, padding: 24 }}>
            <div className="praxis-label" style={{ marginBottom: 12 }}>▸ Atributos</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {Object.entries(user.characterStats).map(([stat, value]) => (
                <div className="skill-row" key={stat}>
                  <div className="skill-name" style={{ textTransform: "capitalize" }}>{stat}</div>
                  <div style={{ flex: 1 }}>
                    <div className="progress-track" style={{ marginTop: 0 }}>
                      <div className="progress-fill" style={{ width: `${value}%` }} />
                    </div>
                  </div>
                  <div className="skill-val">{value}/100</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: radar + skills, XP timeline, modules grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Radar + skills */}
          <div className="glass" style={{ padding: 28 }}>
            <div className="praxis-label" style={{ color: "var(--accent)", marginBottom: 8 }}>
              ▸ Atributos do operador
            </div>
            <h2 className="praxis-title" style={{ fontSize: 22, marginBottom: 20 }}>
              Radar de habilidades
            </h2>
            <div
              className="grid grid-cols-1 md:grid-cols-2"
              style={{ gap: 24, alignItems: "center" }}
            >
              <div style={{ display: "flex", justifyContent: "center" }}>
                <RadarChart values={radarValues} size={220} />
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {Object.entries(user.skillScores).map(([key, value]) => {
                  const pct = Math.min(100, Math.max(0, (Number(value) / 5) * 100));
                  const labels: Record<string, string> = {
                    energy: "Energia",
                    focus: "Foco",
                    discipline: "Disciplina",
                    production: "Produção",
                    motivation: "Motivação",
                  };
                  return (
                    <div className="skill-row" key={key}>
                      <div className="skill-name">{labels[key] ?? key}</div>
                      <div style={{ flex: 1 }}>
                        <div className="progress-track" style={{ marginTop: 0 }}>
                          <div className="progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="skill-val">{Number(value).toFixed(1)}/5</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* XP timeline (synthetic 14-day from user state) */}
          <div className="glass" style={{ padding: 28 }}>
            <div className="praxis-label" style={{ color: "var(--accent)", marginBottom: 8 }}>
              ▸ Ritmo de XP
            </div>
            <h2 className="praxis-title" style={{ fontSize: 22, marginBottom: 20 }}>
              Últimos 14 dias
            </h2>
            <div className="timeline-bar">
              {Array.from({ length: 14 }, (_, i) => {
                // Synthetic shape: rising trend with noise based on user XP
                const base = 30 + (i / 13) * 50;
                const noise = ((i * 17) % 23) - 11;
                const h = Math.max(20, Math.min(95, base + noise));
                return <div key={i} className="tbar" style={{ height: `${h}%` }} />;
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
              <div>
                <div className="praxis-label" style={{ fontSize: 9 }}>TOTAL</div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    fontFamily: "var(--font-space-grotesk), sans-serif",
                    marginTop: 4,
                  }}
                >
                  {formatPoints(user.totalXp)} XP
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="praxis-label" style={{ fontSize: 9 }}>NÍVEL ATUAL</div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    fontFamily: "var(--font-space-grotesk), sans-serif",
                    color: "var(--accent)",
                    marginTop: 4,
                  }}
                >
                  {user.level}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Personal data form */}
      <RxPanel style={{ padding: 22, marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 14,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div>
            <RxLabel>DADOS PESSOAIS · CARDIO</RxLabel>
            <div
              style={{
                fontSize: 12,
                color: "var(--fg-3)",
                marginTop: 6,
                maxWidth: 520,
              }}
            >
              Esses valores alimentam a recomendação de cardio e o cálculo de
              macros. Mantenha atualizado.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div
              style={{
                padding: "10px 14px",
                border: "1px solid var(--line)",
                background: "rgba(0,0,0,0.3)",
                borderRadius: 12,
                textAlign: "right",
              }}
            >
              <div
                className="rx-mono"
                style={{
                  fontSize: 9,
                  color: "var(--fg-3)",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                }}
              >
                IMC
              </div>
              <div
                className="rx-display"
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--fg)",
                }}
              >
                {bmi > 0 ? bmi.toFixed(1) : "--"}
              </div>
            </div>
            <div
              style={{
                padding: "10px 14px",
                border: "1px solid var(--line)",
                background: "rgba(0,0,0,0.3)",
                borderRadius: 12,
                textAlign: "right",
              }}
            >
              <div
                className="rx-mono"
                style={{
                  fontSize: 9,
                  color: "var(--fg-3)",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                }}
              >
                FC MÁX
              </div>
              <div
                className="rx-display"
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--fg)",
                }}
              >
                {estimatedMaxHeartRate}
              </div>
            </div>
            <div
              style={{
                padding: "10px 14px",
                border: "1px solid var(--line)",
                background: "rgba(0,0,0,0.3)",
                borderRadius: 12,
                textAlign: "right",
              }}
            >
              <div
                className="rx-mono"
                style={{
                  fontSize: 9,
                  color: "var(--fg-3)",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                }}
              >
                ÁGUA
              </div>
              <div
                className="rx-display"
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--fg)",
                }}
              >
                {hydrationTargetLiters > 0
                  ? `${hydrationTargetLiters.toFixed(1)}L`
                  : "--"}
              </div>
            </div>
            <div
              style={{
                padding: "10px 14px",
                border: "1px solid var(--line)",
                background: "rgba(0,0,0,0.3)",
                borderRadius: 12,
                textAlign: "right",
              }}
            >
              <div
                className="rx-mono"
                style={{
                  fontSize: 9,
                  color: "var(--fg-3)",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                }}
              >
                ZONA
              </div>
              <div
                className="rx-display"
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--fg)",
                }}
              >
                {cardioZoneMin}-{cardioZoneMax}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handlePersonalProfileSave}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 14,
              marginBottom: 16,
            }}
          >
            <div>
              <label style={labelStyle}>Idade</label>
              <input
                type="number"
                min="1"
                max="120"
                inputMode="numeric"
                value={personalForm.ageYears}
                onChange={(e) =>
                  updatePersonalField("ageYears", e.target.value)
                }
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Altura (cm)</label>
              <input
                type="number"
                min="1"
                max="250"
                inputMode="decimal"
                value={personalForm.bodyHeightCm}
                onChange={(e) =>
                  updatePersonalField("bodyHeightCm", e.target.value)
                }
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Peso (kg)</label>
              <input
                type="number"
                min="1"
                max="500"
                step="0.1"
                inputMode="decimal"
                value={personalForm.bodyWeightKg}
                onChange={(e) =>
                  updatePersonalField("bodyWeightKg", e.target.value)
                }
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Sexo biológico</label>
              <select
                value={personalForm.biologicalSex}
                onChange={(e) =>
                  updatePersonalField(
                    "biologicalSex",
                    e.target.value as BiologicalSex,
                  )
                }
                style={fieldStyle}
              >
                <option value="male">Masculino</option>
                <option value="female">Feminino</option>
              </select>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 14,
              marginBottom: 16,
            }}
          >
            <div>
              <label style={labelStyle}>FC repouso (opcional)</label>
              <input
                type="number"
                min="30"
                max="220"
                inputMode="numeric"
                value={personalForm.restingHeartRateBpm}
                onChange={(e) =>
                  updatePersonalField("restingHeartRateBpm", e.target.value)
                }
                placeholder="Ex.: 60"
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Nível de atividade</label>
              <select
                value={personalForm.activityLevel}
                onChange={(e) =>
                  updatePersonalField(
                    "activityLevel",
                    e.target.value as ActivityLevel,
                  )
                }
                style={fieldStyle}
              >
                {activityLevelOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Objetivo do cardio</label>
              <select
                value={personalForm.cardioGoal}
                onChange={(e) =>
                  updatePersonalField(
                    "cardioGoal",
                    e.target.value as CardioGoal,
                  )
                }
                style={fieldStyle}
              >
                {cardioGoalOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Base do cardio</label>
              <select
                value={personalForm.preferredCardio}
                onChange={(e) =>
                  updatePersonalField(
                    "preferredCardio",
                    e.target.value as CardioPreference,
                  )
                }
                style={fieldStyle}
              >
                {cardioPreferenceOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: 12,
                border: "1px solid var(--line)",
                background: "rgba(0,0,0,0.3)",
                borderRadius: 12,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={personalForm.hasCardiovascularCondition}
                onChange={(e) =>
                  updatePersonalField(
                    "hasCardiovascularCondition",
                    e.target.checked,
                  )
                }
                style={{ accentColor: "var(--accent)", marginTop: 2 }}
              />
              <div>
                <div style={{ fontSize: 12, color: "var(--fg)", fontWeight: 600 }}>
                  Condição cardiovascular
                </div>
                <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 2 }}>
                  Volume conservador para cardio.
                </div>
              </div>
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: 12,
                border: "1px solid var(--line)",
                background: "rgba(0,0,0,0.3)",
                borderRadius: 12,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={personalForm.hasJointLimitation}
                onChange={(e) =>
                  updatePersonalField("hasJointLimitation", e.target.checked)
                }
                style={{ accentColor: "var(--accent)", marginTop: 2 }}
              />
              <div>
                <div style={{ fontSize: 12, color: "var(--fg)", fontWeight: 600 }}>
                  Limitação articular
                </div>
                <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 2 }}>
                  Reduz impacto sugerido.
                </div>
              </div>
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: 12,
                border: "1px solid var(--line)",
                background: "rgba(0,0,0,0.3)",
                borderRadius: 12,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={personalForm.usesHeartRateMedication}
                onChange={(e) =>
                  updatePersonalField(
                    "usesHeartRateMedication",
                    e.target.checked,
                  )
                }
                style={{ accentColor: "var(--accent)", marginTop: 2 }}
              />
              <div>
                <div style={{ fontSize: 12, color: "var(--fg)", fontWeight: 600 }}>
                  Medicação cardíaca
                </div>
                <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 2 }}>
                  Oculta faixa de bpm se distorcida.
                </div>
              </div>
            </label>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Observações opcionais</label>
            <textarea
              value={personalForm.notes}
              onChange={(e) => updatePersonalField("notes", e.target.value)}
              rows={3}
              placeholder="Ex.: preferência por caminhada, fase de definição..."
              style={{ ...fieldStyle, minHeight: 90, resize: "vertical" }}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <button
              type="submit"
              className="rx-btn-primary"
              style={{ padding: "10px 18px" }}
            >
              Salvar dados pessoais
            </button>
            {saveFeedback ? (
              <span
                className="rx-mono"
                style={{
                  fontSize: 11,
                  color: "var(--ok)",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                }}
              >
                ✓ {saveFeedback}
              </span>
            ) : null}
          </div>
        </form>
      </RxPanel>

      {/* Life areas */}
      <RxPanel style={{ padding: 22 }}>
        <RxLabel>PRIORIDADES DE EVOLUÇÃO</RxLabel>
        <div
          style={{
            fontSize: 12,
            color: "var(--fg-3)",
            marginTop: 6,
            marginBottom: 14,
            maxWidth: 640,
          }}
        >
          Revisite a prioridade e o nível atual de cada área. O XP é
          reponderado conforme o quanto essa frente importa e o quanto ainda
          precisa evoluir.
        </div>
        <LifeAreaProfileEditor
          key={JSON.stringify(state.lifeAreaProfile.areas)}
          title=""
          description=""
          initialAreas={state.lifeAreaProfile.areas}
          onSave={(areas) => actions.saveLifeAreaProfile(areas)}
          saveLabel="Salvar prioridades"
        />
      </RxPanel>
    </div>
  );
}
