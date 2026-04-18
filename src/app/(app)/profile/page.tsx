"use client";

import { useState } from "react";
import { LifeAreaProfileEditor } from "@/components/life-area-profile-editor";
import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import { PageIntro } from "@/components/ui/page-intro";
import { ProgressBar } from "@/components/ui/progress-bar";
import { themeOptions } from "@/lib/mock-data";
import type {
  ActivityLevel,
  BiologicalSex,
  CardioGoal,
  CardioPreference,
} from "@/lib/types";
import { cn, formatPoints } from "@/lib/utils";

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
  { value: "muscle-gain", label: "Ganhar massa sem exagerar no cardio" },
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

export default function ProfilePage() {
  const { user, state, actions } = useAppStore();
  const xpProgress = user.isMaxLevel
    ? 100
    : (user.xp / Math.max(1, user.xpToNextLevel)) * 100;
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
  const cardioZoneMax = Math.max(cardioZoneMin, Math.round(estimatedMaxHeartRate * 0.75));
  const currentBodyWeight =
    Number(personalForm.bodyWeightKg) || state.personalProfile.bodyWeightKg;
  const currentBodyHeight =
    Number(personalForm.bodyHeightCm) || state.personalProfile.bodyHeightCm;

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
    setSaveFeedback("Dados pessoais atualizados no perfil.");
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Identidade"
        title="Perfil"
        description="Centralize seus dados pessoais, o visual do sistema e as prioridades de evolução em uma única leitura."
      />

      <GlassPanel className="space-y-6 border-l-2 border-l-[var(--accent)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="praxis-label text-[var(--accent)]">
              Perfil físico e cardio
            </p>
            <h2 className="praxis-title mt-2 text-3xl">Dados pessoais</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
              Esse é o primeiro bloco do seu perfil porque ele alimenta a
              recomendação de cardio na corrida e também vai servir de base para
              outras leituras do sistema, como o acompanhamento de peso.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="praxis-kpi space-y-2 p-4">
              <p className="praxis-label text-zinc-500">IMC atual</p>
              <p className="font-title text-3xl font-bold text-zinc-100">
                {bmi > 0 ? bmi.toFixed(1) : "--"}
              </p>
            </div>
            <div className="praxis-kpi space-y-2 p-4">
              <p className="praxis-label text-zinc-500">FC máx. estimada</p>
              <p className="font-title text-3xl font-bold text-zinc-100">
                {estimatedMaxHeartRate} bpm
              </p>
            </div>
            <div className="praxis-kpi space-y-2 p-4">
              <p className="praxis-label text-zinc-500">Meta de água</p>
              <p className="font-title text-3xl font-bold text-zinc-100">
                {hydrationTargetLiters > 0
                  ? `${hydrationTargetLiters.toFixed(1)} L`
                  : "--"}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handlePersonalProfileSave} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2">
              <span className="praxis-label text-zinc-500">Idade</span>
              <input
                type="number"
                min="1"
                max="120"
                inputMode="numeric"
                value={personalForm.ageYears}
                onChange={(event) =>
                  updatePersonalField("ageYears", event.target.value)
                }
                className="praxis-field w-full px-4 py-3 text-sm text-white"
              />
            </label>

            <label className="space-y-2">
              <span className="praxis-label text-zinc-500">Altura (cm)</span>
              <input
                type="number"
                min="1"
                max="250"
                inputMode="decimal"
                value={personalForm.bodyHeightCm}
                onChange={(event) =>
                  updatePersonalField("bodyHeightCm", event.target.value)
                }
                className="praxis-field w-full px-4 py-3 text-sm text-white"
              />
            </label>

            <label className="space-y-2">
              <span className="praxis-label text-zinc-500">Peso atual (kg)</span>
              <input
                type="number"
                min="1"
                max="500"
                step="0.1"
                inputMode="decimal"
                value={personalForm.bodyWeightKg}
                onChange={(event) =>
                  updatePersonalField("bodyWeightKg", event.target.value)
                }
                className="praxis-field w-full px-4 py-3 text-sm text-white"
              />
            </label>

            <label className="space-y-2">
              <span className="praxis-label text-zinc-500">
                Sexo biológico
              </span>
              <select
                value={personalForm.biologicalSex}
                onChange={(event) =>
                  updatePersonalField(
                    "biologicalSex",
                    event.target.value as BiologicalSex,
                  )
                }
                className="praxis-field w-full px-4 py-3 text-sm text-white"
              >
                <option value="male">Masculino</option>
                <option value="female">Feminino</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2">
              <span className="praxis-label text-zinc-500">
                FC em repouso (opcional)
              </span>
              <input
                type="number"
                min="30"
                max="220"
                inputMode="numeric"
                value={personalForm.restingHeartRateBpm}
                onChange={(event) =>
                  updatePersonalField("restingHeartRateBpm", event.target.value)
                }
                placeholder="Ex.: 60"
                className="praxis-field w-full px-4 py-3 text-sm text-white placeholder:text-zinc-500"
              />
            </label>

            <label className="space-y-2">
              <span className="praxis-label text-zinc-500">
                Nível de atividade
              </span>
              <select
                value={personalForm.activityLevel}
                onChange={(event) =>
                  updatePersonalField(
                    "activityLevel",
                    event.target.value as ActivityLevel,
                  )
                }
                className="praxis-field w-full px-4 py-3 text-sm text-white"
              >
                {activityLevelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="praxis-label text-zinc-500">
                Objetivo do cardio
              </span>
              <select
                value={personalForm.cardioGoal}
                onChange={(event) =>
                  updatePersonalField(
                    "cardioGoal",
                    event.target.value as CardioGoal,
                  )
                }
                className="praxis-field w-full px-4 py-3 text-sm text-white"
              >
                {cardioGoalOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="praxis-label text-zinc-500">Base do cardio</span>
              <select
                value={personalForm.preferredCardio}
                onChange={(event) =>
                  updatePersonalField(
                    "preferredCardio",
                    event.target.value as CardioPreference,
                  )
                }
                className="praxis-field w-full px-4 py-3 text-sm text-white"
              >
                {cardioPreferenceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <label className="praxis-panel flex items-center gap-3 rounded-sm p-4">
              <input
                type="checkbox"
                checked={personalForm.hasCardiovascularCondition}
                onChange={(event) =>
                  updatePersonalField(
                    "hasCardiovascularCondition",
                    event.target.checked,
                  )
                }
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <div>
                <p className="font-medium text-zinc-100">
                  Condição cardiovascular
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  Faz a recomendação começar com volume mais conservador.
                </p>
              </div>
            </label>

            <label className="praxis-panel flex items-center gap-3 rounded-sm p-4">
              <input
                type="checkbox"
                checked={personalForm.hasJointLimitation}
                onChange={(event) =>
                  updatePersonalField("hasJointLimitation", event.target.checked)
                }
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <div>
                <p className="font-medium text-zinc-100">Limitação articular</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Reduz o impacto sugerido nas metas de cardio.
                </p>
              </div>
            </label>

            <label className="praxis-panel flex items-center gap-3 rounded-sm p-4">
              <input
                type="checkbox"
                checked={personalForm.usesHeartRateMedication}
                onChange={(event) =>
                  updatePersonalField(
                    "usesHeartRateMedication",
                    event.target.checked,
                  )
                }
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <div>
                <p className="font-medium text-zinc-100">
                  Usa medicação para frequência cardíaca
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  Oculta a faixa de bpm quando ela pode ficar distorcida.
                </p>
              </div>
            </label>
          </div>

          <label className="space-y-2">
            <span className="praxis-label text-zinc-500">
              Observações opcionais
            </span>
            <textarea
              value={personalForm.notes}
              onChange={(event) =>
                updatePersonalField("notes", event.target.value)
              }
              rows={3}
              placeholder="Ex.: preferência por caminhada, dor no joelho, fase de definição..."
              className="praxis-field min-h-[112px] w-full px-4 py-3 text-sm text-white placeholder:text-zinc-500"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="praxis-button px-5 py-3">
              Salvar dados pessoais
            </button>
            {saveFeedback ? (
              <span className="text-sm text-zinc-400">{saveFeedback}</span>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="praxis-kpi space-y-2 p-4">
              <p className="praxis-label text-zinc-500">Base corporal</p>
              <p className="font-title text-2xl font-bold text-zinc-100">
                {currentBodyWeight.toFixed(1)} kg
              </p>
              <p className="text-xs text-zinc-500">
                {currentBodyHeight.toFixed(0)} cm,{" "}
                {personalForm.biologicalSex === "male" ? "masculino" : "feminino"}.
              </p>
            </div>
            <div className="praxis-kpi space-y-2 p-4">
              <p className="praxis-label text-zinc-500">Corrida</p>
              <p className="font-title text-2xl font-bold text-zinc-100">
                {cardioZoneMin}-{cardioZoneMax} bpm
              </p>
              <p className="text-xs text-zinc-500">
                {personalForm.cardioGoal === "fat-loss"
                  ? "Zona mais agressiva para gasto."
                  : "Zona base para evolução sustentável."}
              </p>
            </div>
            <div className="praxis-kpi space-y-2 p-4">
              <p className="praxis-label text-zinc-500">Nutrição</p>
              <p className="font-title text-2xl font-bold text-zinc-100">
                {hydrationTargetLiters > 0 ? `${hydrationTargetLiters.toFixed(1)} L` : "--"}
              </p>
              <p className="text-xs text-zinc-500">
                Água diária estimada para o peso atual.
              </p>
            </div>
            <div className="praxis-kpi space-y-2 p-4">
              <p className="praxis-label text-zinc-500">Saúde</p>
              <p className="font-title text-2xl font-bold text-zinc-100">
                {personalForm.hasCardiovascularCondition ||
                personalForm.hasJointLimitation
                  ? "Atenção"
                  : "OK"}
              </p>
              <p className="text-xs text-zinc-500">
                Recomendação ajustada por limitações informadas.
              </p>
            </div>
          </div>
        </form>
      </GlassPanel>

      <section className="grid gap-6 xl:grid-cols-[0.94fr_1.06fr]">
        <GlassPanel className="space-y-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-sm border border-[rgba(251,146,60,0.34)] bg-[linear-gradient(135deg,rgba(251,146,60,0.18)_0%,rgba(18,18,20,0.96)_100%)] font-title text-2xl font-bold text-[var(--accent)] shadow-[0_0_18px_rgba(251,146,60,0.15)]">
              {user.name?.slice(0, 1) || "P"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-2xl font-medium text-zinc-100">
                {user.name}
              </p>
              <p className="truncate text-sm text-zinc-500">{user.username}</p>
              <p className="praxis-label mt-2 text-[var(--accent)]">
                Rank {user.rankTier}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-zinc-500">
                {user.isMaxLevel
                  ? "Nível máximo atingido"
                  : `Progresso para o nível ${user.level + 1}`}
              </span>
              <span className="text-zinc-300">
                {user.isMaxLevel ? "MAX" : `${user.xp}/${user.xpToNextLevel} XP`}
              </span>
            </div>
            <ProgressBar value={xpProgress} />
            <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
              <span>{formatPoints(user.totalXp)} XP totais</span>
              <span>
                {user.nextRankTier
                  ? `Próximo rank ${user.nextRankTier} em ${formatPoints(user.xpToNextRank)} XP`
                  : "Rank S conquistado"}
              </span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(user.skillScores).map(([label, value]) => (
              <div key={label} className="praxis-kpi space-y-2 p-4">
                <p className="praxis-label text-[var(--accent)] capitalize">
                  {label}
                </p>
                <p className="font-title text-3xl font-bold text-zinc-100">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </GlassPanel>

        <div className="space-y-6">
          <GlassPanel className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="praxis-label text-[var(--accent)]">
                  Tema de cores
                </p>
                <h2 className="praxis-title mt-2 text-3xl">Ajuste visual</h2>
              </div>
              <span className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                tema atual: {themeOptions.find((theme) => theme.id === state.settings.theme)?.name ?? "Padrão"}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {themeOptions.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => actions.setTheme(theme.id)}
                  className={cn(
                    "praxis-panel rounded-sm p-4 text-left transition hover:border-[rgba(251,146,60,0.22)]",
                    state.settings.theme === theme.id &&
                      "border-[rgba(251,146,60,0.42)] bg-[rgba(251,146,60,0.12)] shadow-[0_0_20px_var(--glow)]",
                  )}
                >
                  <div
                    className="h-14 rounded-sm border border-zinc-800"
                    style={{
                      background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
                      boxShadow:
                        state.settings.theme === theme.id
                          ? `0 0 22px ${theme.glow}`
                          : "none",
                    }}
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="truncate font-medium text-zinc-100">
                      {theme.name}
                    </p>
                    {state.settings.theme === theme.id ? (
                      <span className="text-xs uppercase tracking-[0.25em] text-[var(--accent)]">
                        ativo
                      </span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </GlassPanel>

          <GlassPanel className="space-y-4">
            <div>
              <p className="praxis-label text-[var(--accent)]">
                Seus status
              </p>
              <h2 className="praxis-title mt-2 text-3xl">Atributos</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(user.characterStats).map(([stat, value]) => (
                <div key={stat} className="praxis-kpi space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="capitalize text-zinc-300">{stat}</p>
                    <span className="text-sm text-zinc-500">{value}/100</span>
                  </div>
                  <ProgressBar value={value} />
                </div>
              ))}
            </div>
          </GlassPanel>

          <GlassPanel>
            <LifeAreaProfileEditor
              key={JSON.stringify(state.lifeAreaProfile.areas)}
              title="Prioridades de evolução"
              description="Revisite a prioridade e o nível atual de cada área. O XP continua sendo ajustado conforme o quanto essa frente é importante e o quanto ela ainda precisa evoluir."
              initialAreas={state.lifeAreaProfile.areas}
              onSave={(areas) => actions.saveLifeAreaProfile(areas)}
              saveLabel="Salvar prioridades de evolução"
            />
          </GlassPanel>
        </div>
      </section>
    </div>
  );
}


