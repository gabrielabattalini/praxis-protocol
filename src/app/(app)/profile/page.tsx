"use client";

import { useState } from "react";
import { LifeAreaProfileEditor } from "@/components/life-area-profile-editor";
import { useAppStore } from "@/components/providers/app-store-provider";
import {
  Avatar,
  RadarChart,
  RankChip,
  RxLabel,
  RxPBar,
  RxPageHeader,
  RxPanel,
  XPBar,
} from "@/components/redesign/primitives";
import { themeOptions } from "@/lib/mock-data";
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
  borderRadius: 2,
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

  return (
    <div>
      <RxPageHeader
        title="Operador"
        subtitle={
          <>
            Identidade · Nível {user.level} ·{" "}
            <span style={{ color: "var(--accent)" }}>{user.username}</span>
          </>
        }
      />

      {/* Hero */}
      <RxPanel hot style={{ padding: 22, marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            gap: 20,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Avatar
            initials={initialsFor(user.name)}
            size={72}
            tier={user.rankTier}
            online
          />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div
              className="rx-display"
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: "var(--fg)",
                letterSpacing: "-0.02em",
              }}
            >
              {user.name}
            </div>
            <div
              className="rx-mono"
              style={{
                fontSize: 11,
                color: "var(--fg-3)",
                letterSpacing: "0.16em",
                marginTop: 2,
              }}
            >
              @{user.username}
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <RankChip tier={`${user.rankTier} ${user.rankLabel ?? ""}`.trim()} />
              <span
                className="rx-mono"
                style={{
                  fontSize: 10,
                  padding: "3px 8px",
                  border: "1px solid var(--line)",
                  color: "var(--fg-2)",
                  letterSpacing: "0.18em",
                  borderRadius: 2,
                  textTransform: "uppercase",
                }}
              >
                {formatPoints(user.totalXp)} XP
              </span>
            </div>
          </div>
          <div style={{ minWidth: 220, flex: 1 }}>
            <XPBar value={xpProgress} level={user.level} />
            <div
              className="rx-mono"
              style={{
                fontSize: 10,
                color: "var(--fg-3)",
                letterSpacing: "0.16em",
                marginTop: 6,
                textTransform: "uppercase",
              }}
            >
              {user.isMaxLevel
                ? "Rank S conquistado"
                : user.nextRankTier
                  ? `Próx. rank ${user.nextRankTier} · ${formatPoints(user.xpToNextRank)} XP`
                  : `${user.xp}/${user.xpToNextLevel} XP`}
            </div>
          </div>
        </div>
      </RxPanel>

      {/* Skill radar + character stats */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 0.9fr) 1.1fr",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <RxPanel style={{ padding: 20 }}>
          <RxLabel>PERFIL DE HABILIDADES</RxLabel>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "10px 0",
            }}
          >
            <RadarChart values={radarValues} size={240} />
          </div>
          <div
            className="rx-mono"
            style={{
              fontSize: 10,
              color: "var(--fg-4)",
              letterSpacing: "0.18em",
              textAlign: "center",
              textTransform: "uppercase",
              marginTop: 4,
            }}
          >
            Escala 0 · 5 normalizada
          </div>
        </RxPanel>

        <RxPanel style={{ padding: 20 }}>
          <RxLabel>ATRIBUTOS · STATUS</RxLabel>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 12,
              marginTop: 12,
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
                    alignItems: "baseline",
                    marginBottom: 8,
                  }}
                >
                  <span
                    className="rx-mono"
                    style={{
                      fontSize: 10,
                      color: "var(--fg-3)",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                    }}
                  >
                    {stat}
                  </span>
                  <span
                    className="rx-display"
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "var(--fg)",
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
      </section>

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
                borderRadius: 2,
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
                borderRadius: 2,
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
                borderRadius: 2,
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
                borderRadius: 2,
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
                borderRadius: 2,
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
                borderRadius: 2,
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
                borderRadius: 2,
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

      {/* Theme picker */}
      <RxPanel style={{ padding: 22, marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 10,
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          <RxLabel>TEMA DE CORES</RxLabel>
          <span
            className="rx-mono"
            style={{
              fontSize: 10,
              color: "var(--fg-3)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            Ativo:{" "}
            {themeOptions.find((t) => t.id === state.settings.theme)?.name ??
              "Padrão"}
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          {themeOptions.map((theme) => {
            const active = state.settings.theme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => actions.setTheme(theme.id)}
                style={{
                  padding: 12,
                  border: active
                    ? "1px solid var(--accent)"
                    : "1px solid var(--line)",
                  background: active
                    ? "rgba(251,146,60,0.08)"
                    : "rgba(0,0,0,0.3)",
                  borderRadius: 2,
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  color: "inherit",
                }}
              >
                <div
                  style={{
                    height: 52,
                    borderRadius: 2,
                    background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                    boxShadow: active ? `0 0 18px ${theme.glow}` : "none",
                    border: "1px solid rgba(255,255,255,0.04)",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--fg)",
                    }}
                  >
                    {theme.name}
                  </span>
                  {active ? (
                    <span
                      className="rx-mono"
                      style={{
                        fontSize: 9,
                        color: "var(--accent)",
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                      }}
                    >
                      ● ATIVO
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
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
