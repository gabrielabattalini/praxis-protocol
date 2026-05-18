"use client";

import Image from "next/image";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Gauge,
  Ruler,
  Scale,
  Sparkles,
  Target,
  WandSparkles,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  ActivityLevel,
  BiologicalSex,
  CardioGoal,
  CardioPreference,
} from "@/lib/types";

const bmiBands = [
  { label: "Abaixo", min: 14, max: 18.5 },
  { label: "Ideal", min: 18.5, max: 24.9 },
  { label: "Sobre", min: 25, max: 29.9 },
  { label: "Obeso", min: 30, max: 40 },
] as const;

const analysisStages = [
  { label: "Analisando", icon: ArrowRight, threshold: 18 },
  { label: "Calculando", icon: BarChart3, threshold: 44 },
  { label: "Otimizando", icon: Target, threshold: 72 },
  { label: "Finalizando", icon: WandSparkles, threshold: 100 },
] as const;

const transformationHorizons = [30, 60, 90] as const;

const radarLabels = [
  "Disciplina",
  "Saude",
  "Foco",
  "Energia",
  "Produtividade",
  "Bem-estar",
] as const;

export type BodyMetricsPayload = {
  heightCm: number;
  weightKg: number;
  ageYears: number;
  biologicalSex: BiologicalSex;
  restingHeartRateBpm?: number;
  activityLevel: ActivityLevel;
  cardioGoal: CardioGoal;
  preferredCardio: CardioPreference;
  hasCardiovascularCondition: boolean;
  hasJointLimitation: boolean;
  usesHeartRateMedication: boolean;
  notes: string;
};

type BodyMetricsOnboardingProps = {
  initialHeightCm: number;
  initialWeightKg: number;
  initialProfile?: Partial<
    Omit<BodyMetricsPayload, "heightCm" | "weightKg">
  >;
  onSave: (payload: BodyMetricsPayload) => void;
  onSkip: () => void;
};

const activityLevelChoices: Array<{ value: ActivityLevel; label: string }> = [
  { value: "sedentary", label: "Baixo" },
  { value: "light", label: "Leve" },
  { value: "moderate", label: "Moderado" },
  { value: "high", label: "Alto" },
];

const cardioGoalChoices: Array<{ value: CardioGoal; label: string }> = [
  { value: "health", label: "Saúde e consistência" },
  { value: "fat-loss", label: "Secar e aumentar gasto" },
  { value: "maintenance", label: "Manter condicionamento" },
  { value: "performance", label: "Performance e ritmo" },
  { value: "muscle-gain", label: "Ganhar massa sem exagerar" },
];

const cardioPreferenceChoices: Array<{
  value: CardioPreference;
  label: string;
}> = [
  { value: "running", label: "Corrida" },
  { value: "walking", label: "Caminhada" },
  { value: "bike", label: "Bike" },
  { value: "elliptical", label: "Elíptico" },
  { value: "stairs", label: "Escada" },
];

const onbFieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "#0c0c0f",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#f4f4f5",
  fontSize: 14,
  outline: "none",
};

const onbLabelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-mono), monospace",
  fontSize: 11,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "#71717a",
  marginBottom: 8,
};

type SetupPhase = "metrics" | "analysis" | "transformation";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatDecimal(value: number) {
  return value.toFixed(1).replace(".", ",");
}

function resolveBmiStatus(bmi: number) {
  if (bmi < 18.5) {
    return {
      label: "Abaixo do ideal",
      summary:
        "Seu protocolo corporal sugere ganho gradual de massa e energia antes de subir a carga das missões físicas.",
    };
  }

  if (bmi < 25) {
    return {
      label: "Peso ideal",
      summary:
  "Leitura estável. O Praxis pode usar essa base para calibrar dieta, hidratação e evolução física com mais precisão.",
    };
  }

  if (bmi < 30) {
    return {
      label: "Acima do ideal",
      summary:
        "Existe margem para recomposição corporal. O sistema vai usar essa leitura para ajustar metas de consistência e gasto energético.",
    };
  }

  return {
    label: "Faixa de alerta",
    summary:
      "A leitura indica necessidade maior de controle corporal. O sistema prioriza progressão sustentável, não agressiva.",
  };
}

function computeCurrentScore(bmi: number) {
  const deviation = Math.abs(bmi - 22);
  return Number(clamp(5 - deviation * 0.65, 2.8, 6.4).toFixed(1));
}

function computeProjectedScore(score: number, horizon: (typeof transformationHorizons)[number]) {
  const gainByHorizon = {
    30: 1.7,
    60: 2.9,
    90: 4.2,
  } as const;

  return Number(clamp(score + gainByHorizon[horizon], 4.2, 8.8).toFixed(1));
}

function buildRadarValues(score: number) {
  const normalized = score / 10;

  return [
    clamp(normalized + 0.02, 0.18, 0.92),
    clamp(normalized + 0.08, 0.18, 0.92),
    clamp(normalized + 0.04, 0.18, 0.92),
    clamp(normalized + 0.11, 0.18, 0.92),
    clamp(normalized - 0.06, 0.18, 0.92),
    clamp(normalized + 0.01, 0.18, 0.92),
  ];
}

function polygonPoints(values: number[], size: number) {
  const center = size / 2;
  const radius = size * 0.33;

  return values
    .map((value, index) => {
      const angle = (-Math.PI / 2) + (index / values.length) * Math.PI * 2;
      const pointRadius = radius * value;
      const x = center + Math.cos(angle) * pointRadius;
      const y = center + Math.sin(angle) * pointRadius;
      return `${x},${y}`;
    })
    .join(" ");
}

function axisLabelPosition(index: number, total: number, size: number) {
  const center = size / 2;
  const radius = size * 0.44;
  const angle = (-Math.PI / 2) + (index / total) * Math.PI * 2;

  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  };
}

function RadarChart({
  values,
  accentClassName,
}: {
  values: number[];
  accentClassName?: string;
}) {
  const size = 260;
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full">
        {rings.map((ring) => (
          <polygon
            key={ring}
            points={polygonPoints(Array(values.length).fill(ring), size)}
            fill="none"
            stroke="rgba(255,255,255,0.09)"
            strokeWidth="1"
          />
        ))}

        {values.map((_, index) => {
          const { x, y } = axisLabelPosition(index, values.length, size);
          return (
            <g key={radarLabels[index]}>
              <line
                x1={size / 2}
                y1={size / 2}
                x2={x}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
              />
              <text
                x={x}
                y={y}
                fill="rgba(255,255,255,0.48)"
                fontSize="10"
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ letterSpacing: "0.14em", textTransform: "uppercase" }}
              >
                {radarLabels[index]}
              </text>
            </g>
          );
        })}

        <polygon
          points={polygonPoints(values, size)}
          fill="rgba(53,214,180,0.22)"
          stroke="rgba(53,214,180,0.95)"
          strokeWidth="2.5"
          className={accentClassName}
        />

        {values.map((value, index) => {
          const center = size / 2;
          const radius = size * 0.33 * value;
          const angle = (-Math.PI / 2) + (index / values.length) * Math.PI * 2;
          const x = center + Math.cos(angle) * radius;
          const y = center + Math.sin(angle) * radius;
          return (
            <circle
              key={`${radarLabels[index]}-point`}
              cx={x}
              cy={y}
              r="4"
              fill="var(--accent)"
              style={{ filter: "drop-shadow(0 0 8px color-mix(in srgb, var(--accent) 50%, transparent))" }}
            />
          );
        })}
      </svg>
    </div>
  );
}

function MetricStatCard({
  value,
  label,
  helper,
  active = false,
}: {
  value: string;
  label: string;
  helper: string;
  active?: boolean;
}) {
  return (
    <div
      className={`border px-4 py-5 ${
        active
          ? "border-[color:var(--accent)]/35 bg-[color:color-mix(in_srgb,var(--accent)_10%,#0d0d10)] shadow-[0_0_22px_color-mix(in_srgb,var(--accent)_18%,transparent)]"
          : "border-white/8 bg-[#0b0b0e]"
      }`}
    >
      <div className="text-center">
        <p className="font-sans text-3xl font-bold tracking-tight text-zinc-100">
          {value}
        </p>
        <p className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.24em] text-zinc-500">
          {label}
        </p>
        <p className="mt-2 text-xs text-zinc-600">{helper}</p>
      </div>
    </div>
  );
}

export function BodyMetricsOnboarding({
  initialHeightCm,
  initialWeightKg,
  initialProfile,
  onSave,
  onSkip,
}: BodyMetricsOnboardingProps) {
  const [phase, setPhase] = useState<SetupPhase>("metrics");
  const [heightCm, setHeightCm] = useState(() =>
    Math.round(clamp(initialHeightCm || 175, 140, 210)),
  );
  const [weightKg, setWeightKg] = useState(() =>
    Number(clamp(initialWeightKg || 70, 40, 150).toFixed(1)),
  );
  const [ageYears, setAgeYears] = useState<string>(() =>
    initialProfile?.ageYears && initialProfile.ageYears > 1
      ? String(initialProfile.ageYears)
      : "",
  );
  const [biologicalSex, setBiologicalSex] = useState<BiologicalSex>(
    initialProfile?.biologicalSex ?? "female",
  );
  const [restingHeartRateBpm, setRestingHeartRateBpm] = useState<string>(() =>
    initialProfile?.restingHeartRateBpm
      ? String(initialProfile.restingHeartRateBpm)
      : "",
  );
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    initialProfile?.activityLevel ?? "moderate",
  );
  const [cardioGoal, setCardioGoal] = useState<CardioGoal>(
    initialProfile?.cardioGoal ?? "health",
  );
  const [preferredCardio, setPreferredCardio] = useState<CardioPreference>(
    initialProfile?.preferredCardio ?? "running",
  );
  const [hasCardiovascularCondition, setHasCardiovascularCondition] =
    useState<boolean>(initialProfile?.hasCardiovascularCondition ?? false);
  const [hasJointLimitation, setHasJointLimitation] = useState<boolean>(
    initialProfile?.hasJointLimitation ?? false,
  );
  const [usesHeartRateMedication, setUsesHeartRateMedication] =
    useState<boolean>(initialProfile?.usesHeartRateMedication ?? false);
  const [notes, setNotes] = useState<string>(initialProfile?.notes ?? "");

  const buildPayload = (): BodyMetricsPayload => ({
    heightCm,
    weightKg,
    ageYears: Math.max(1, Math.round(Number(ageYears) || 0)) || 25,
    biologicalSex,
    restingHeartRateBpm:
      Number(restingHeartRateBpm) > 0
        ? Number(restingHeartRateBpm)
        : undefined,
    activityLevel,
    cardioGoal,
    preferredCardio,
    hasCardiovascularCondition,
    hasJointLimitation,
    usesHeartRateMedication,
    notes,
  });

  const [pendingMetrics, setPendingMetrics] = useState<BodyMetricsPayload | null>(
    null,
  );
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [selectedHorizon, setSelectedHorizon] =
    useState<(typeof transformationHorizons)[number]>(30);

  const liveBmi = Number((weightKg / Math.pow(heightCm / 100, 2)).toFixed(1));
  const liveBmiStatus = resolveBmiStatus(liveBmi);
  const bmiMarker = ((clamp(liveBmi, 14, 40) - 14) / (40 - 14)) * 100;

  const effectiveMetrics = pendingMetrics ?? { heightCm, weightKg };
  const effectiveBmi = Number(
    (
      effectiveMetrics.weightKg /
      Math.pow(effectiveMetrics.heightCm / 100, 2)
    ).toFixed(1),
  );
  const currentScore = computeCurrentScore(effectiveBmi);
  const projectedScore = computeProjectedScore(currentScore, selectedHorizon);
  const currentRadar = useMemo(() => buildRadarValues(currentScore), [currentScore]);
  const projectedRadar = useMemo(
    () => buildRadarValues(projectedScore),
    [projectedScore],
  );

  useEffect(() => {
    if (phase !== "analysis") {
      return;
    }

    const progressTick = window.setInterval(() => {
      setAnalysisProgress((previous) => {
        const increment = previous < 36 ? 7 : previous < 72 ? 5 : 3;
        const nextValue = Math.min(previous + increment, 100);
        if (nextValue >= 100) {
          window.clearInterval(progressTick);
          window.setTimeout(() => setPhase("transformation"), 500);
        }
        return nextValue;
      });
    }, 110);

    return () => window.clearInterval(progressTick);
  }, [phase]);

  if (phase === "analysis") {
    const resolvedMissionCount = Math.max(
      9,
      Math.round(effectiveMetrics.weightKg / 7),
    );
    const resolvedHabitCount = 7;
    const resolvedProtocolCount = 3;

    return (
      <div className="relative overflow-hidden border border-[color:var(--accent)]/20 bg-[#050607] px-6 py-12 text-zinc-100 sm:px-10">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--accent)_16%,transparent),transparent_55%)]" />
        </div>

        <div className="relative mx-auto flex min-h-[72vh] max-w-3xl flex-col items-center justify-center text-center">
          <div className="inline-flex items-center gap-3 border border-[color:var(--accent)]/25 bg-[#090b0c] px-5 py-3 font-mono text-[0.72rem] uppercase tracking-[0.28em] text-zinc-200">
            <Image
              src="/logo.png"
              alt="Praxis Protocol"
              width={20}
              height={20}
              className="h-5 w-auto"
            />
            Praxis Protocol
          </div>

          <div className="mt-10 space-y-3">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.3em] text-zinc-500">
              IA tática // processando perfil
            </p>
            <h2 className="font-sans text-3xl font-bold tracking-tight text-zinc-100 sm:text-5xl">
              IA analisando seu perfil
            </h2>
            <p className="mx-auto max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
              Preparando sua jornada personalizada com base nas métricas
              iniciais e nos protocolos do Praxis.
            </p>
          </div>

          <div className="mt-10 grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
            {analysisStages.map((stage) => {
              const Icon = stage.icon;
              const active = analysisProgress >= stage.threshold;
              return (
                <div
                  key={stage.label}
                  className={`border px-4 py-4 transition ${
                    active
                      ? "border-[color:var(--accent)]/45 bg-[color:color-mix(in_srgb,var(--accent)_12%,#090a0b)] text-[color:var(--accent)] shadow-[0_0_18px_color-mix(in_srgb,var(--accent)_20%,transparent)]"
                      : "border-white/8 bg-[#09090b] text-zinc-600"
                  }`}
                >
                  <div className="mx-auto grid h-12 w-12 place-items-center border border-current/30">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-3 font-mono text-[0.62rem] uppercase tracking-[0.22em]">
                    {stage.label}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 w-full space-y-3">
            <div className="flex items-center justify-between font-mono text-[0.68rem] uppercase tracking-[0.26em] text-zinc-500">
              <span>Processando</span>
              <span className="text-[color:var(--accent)]">{analysisProgress}%</span>
            </div>
            <div className="h-3 overflow-hidden border border-white/10 bg-[#09090b]">
              <div
                className="h-full bg-[color:var(--accent)] transition-all duration-200 [box-shadow:0_0_18px_color-mix(in_srgb,var(--accent)_35%,transparent)]"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
          </div>

          <div className="mt-10 grid w-full gap-3 sm:grid-cols-3">
            <MetricStatCard
              value={String(resolvedMissionCount)}
              label="Missões"
              helper="missões personalizadas"
              active
            />
            <MetricStatCard
              value={String(resolvedHabitCount)}
              label="Hábitos"
              helper="hábitos configurados"
            />
            <MetricStatCard
              value={String(resolvedProtocolCount)}
              label="Protocolos"
              helper="protocolos de evolução"
            />
          </div>
        </div>
      </div>
    );
  }

  if (phase === "transformation") {
    const deltaPercent = Math.max(
      18,
      Math.round(((projectedScore - currentScore) / currentScore) * 100),
    );

    return (
      <div className="space-y-6 text-zinc-100">
        <div className="space-y-3 border-b border-white/8 pb-5 text-center">
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.3em] text-zinc-500">
            Transformação prevista // leitura inicial
          </p>
          <h2 className="font-sans text-3xl font-bold tracking-tight text-zinc-100 sm:text-5xl">
            Sua transformação projetada
          </h2>
          <p className="mx-auto max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
            Com as métricas atuais, o Praxis desenhou uma progressão tática de
            curto, médio e longo prazo para sua evolução.
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {transformationHorizons.map((horizon) => {
              const active = selectedHorizon === horizon;
              return (
                <button
                  key={horizon}
                  type="button"
                  onClick={() => setSelectedHorizon(horizon)}
                  className={`border px-4 py-3 text-center transition ${
                    active
                      ? "border-[color:var(--accent)]/55 bg-[color:color-mix(in_srgb,var(--accent)_12%,#090a0b)] shadow-[0_0_20px_color-mix(in_srgb,var(--accent)_18%,transparent)]"
                      : "border-white/8 bg-[#09090b] hover:border-white/16 hover:bg-[#0d0d10]"
                  }`}
                >
                  <p className="font-sans text-2xl font-bold tracking-tight text-zinc-100">
                    {horizon}
                  </p>
                  <p className="font-mono text-[0.62rem] uppercase tracking-[0.24em] text-zinc-500">
                    dias
                  </p>
                </button>
              );
            })}
          </div>

          <div className="h-3 overflow-hidden border border-white/10 bg-[#09090b]">
            <div
              className="h-full bg-[color:var(--accent)] transition-all duration-300 [box-shadow:0_0_18px_color-mix(in_srgb,var(--accent)_35%,transparent)]"
              style={{
                width: `${
                  selectedHorizon === 30 ? 33.3 : selectedHorizon === 60 ? 66.6 : 100
                }%`,
              }}
            />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="border border-white/8 bg-[#09090b] p-5">
            <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-zinc-500">
              Você hoje
            </p>
            <div className="mt-4">
              <RadarChart values={currentRadar} />
            </div>
            <div className="mt-4 text-center">
              <p className="font-sans text-5xl font-bold tracking-tight text-zinc-100">
                {formatDecimal(currentScore)}
                <span className="ml-1 text-lg text-zinc-500">/10</span>
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                Leitura inicial baseada em composição, energia e estabilidade.
              </p>
            </div>
          </section>

          <section className="border border-[color:var(--accent)]/25 bg-[color:color-mix(in_srgb,var(--accent)_10%,#080a09)] p-5 shadow-[0_0_22px_color-mix(in_srgb,var(--accent)_10%,transparent)]">
            <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-[color:var(--accent)]">
              Você em {selectedHorizon} dias
            </p>
            <div className="mt-4">
              <RadarChart values={projectedRadar} accentClassName="opacity-95" />
            </div>
            <div className="mt-4 text-center">
              <p className="font-sans text-5xl font-bold tracking-tight text-[color:var(--accent)]">
                {formatDecimal(projectedScore)}
                <span className="ml-1 text-lg text-zinc-500">/10</span>
              </p>
              <p className="mt-2 text-sm text-zinc-400">
                    Escore projetado com consistência operacional, dieta guiada e
                execução das rotinas certas.
              </p>
            </div>
          </section>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <MetricStatCard
            value={`+${deltaPercent}%`}
            label="Melhoria"
            helper="projeção de ganho geral"
            active
          />
          <MetricStatCard
            value="6/6"
            label="Metas"
            helper="frentes táticas cobertas"
          />
          <MetricStatCard
            value={`${selectedHorizon}d`}
            label="Streak"
            helper="janela mínima de consolidação"
          />
        </div>

        <div className="rounded-sm border border-white/8 bg-[#09090b] p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center border border-[color:var(--accent)]/35 bg-[color:color-mix(in_srgb,var(--accent)_12%,#090a0b)] text-[color:var(--accent)]">
              <Zap className="h-4 w-4" />
            </div>
            <div className="space-y-2">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-[color:var(--accent)]">
                O que o Praxis vai priorizar
              </p>
              <p className="text-sm leading-6 text-zinc-300">
                O protocolo inicial vai enfatizar energia, saúde corporal,
                constância e missões de baixa fricção para acelerar a entrada no
                sistema sem criar desgaste logo no primeiro ciclo.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 pt-2">
          <button
            type="button"
            onClick={() => onSave(pendingMetrics ?? buildPayload())}
            className="w-full border border-[color:var(--accent)]/35 bg-[color:var(--accent)] px-6 py-4 font-mono text-[0.72rem] uppercase tracking-[0.28em] text-black transition hover:brightness-110 [box-shadow:0_0_26px_color-mix(in_srgb,var(--accent)_35%,transparent)]"
          >
            Quero essa transformação
          </button>
          <button
            type="button"
            onClick={() => setPhase("metrics")}
            className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-zinc-500 transition hover:text-zinc-200"
          >
            Ajustar métricas antes de continuar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-zinc-100">
      <div className="flex flex-col gap-4 border-b border-white/8 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.3em] text-zinc-500">
            Pergunta final // métricas corporais
          </p>
          <div className="space-y-2">
            <h2 className="border-l-2 border-[color:var(--accent)] pl-4 font-sans text-3xl font-bold uppercase tracking-tight text-zinc-100 sm:text-4xl">
              Última etapa: suas métricas
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
              A IA precisa disso para calcular seu plano inicial com água,
                  dieta, gasto energético e protocolo corporal.
            </p>
          </div>
        </div>

        <div className="inline-flex w-fit items-center gap-3 border border-[color:var(--accent)]/35 bg-[color:color-mix(in_srgb,var(--accent)_10%,#090a0b)] px-4 py-2 font-mono text-[0.68rem] uppercase tracking-[0.24em] text-[color:var(--accent)] [box-shadow:0_0_18px_color-mix(in_srgb,var(--accent)_16%,transparent)]">
          <Sparkles className="h-3.5 w-3.5" />
          Criando seu plano personalizado
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between font-mono text-[0.62rem] uppercase tracking-[0.24em] text-zinc-500">
          <span>Pergunta 6 de 6</span>
          <span>100%</span>
        </div>
        <div className="h-1 w-full overflow-hidden bg-white/5">
          <div className="h-full w-full bg-[color:var(--accent)] [box-shadow:0_0_18px_color-mix(in_srgb,var(--accent)_35%,transparent)]" />
        </div>
      </div>

      <div className="grid gap-4">
        <section className="border border-white/8 bg-[#0c0c0f] p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.28em] text-zinc-500">
                <Ruler className="h-3.5 w-3.5 text-[color:var(--accent)]" />
                Altura
              </div>
              <p className="text-sm text-zinc-500">
                Informe sua altura atual para leitura corporal inicial.
              </p>
            </div>

            <div className="flex items-end gap-1 font-sans text-4xl font-bold tracking-tight text-zinc-100">
              <span>{heightCm}</span>
              <span className="pb-1 text-base font-medium text-zinc-500">cm</span>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <input
              type="range"
              min={140}
              max={210}
              step={1}
              value={heightCm}
              onChange={(event) => setHeightCm(Number(event.target.value))}
              className="h-2 w-full cursor-pointer appearance-none bg-transparent accent-[var(--accent)]"
              style={{ accentColor: "var(--accent)" }}
            />
            <div className="flex items-center justify-between font-mono text-[0.62rem] uppercase tracking-[0.24em] text-zinc-600">
              <span>140 cm</span>
              <span>210 cm</span>
            </div>
          </div>
        </section>

        <section className="border border-white/8 bg-[#0c0c0f] p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.28em] text-zinc-500">
                <Scale className="h-3.5 w-3.5 text-[color:var(--accent)]" />
                Peso
              </div>
              <p className="text-sm text-zinc-500">
                Essa leitura ajusta metas de calorias, água e progressão física.
              </p>
            </div>

            <div className="flex items-end gap-1 font-sans text-4xl font-bold tracking-tight text-zinc-100">
              <span>{formatDecimal(weightKg)}</span>
              <span className="pb-1 text-base font-medium text-zinc-500">kg</span>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <input
              type="range"
              min={40}
              max={150}
              step={0.5}
              value={weightKg}
              onChange={(event) => setWeightKg(Number(event.target.value))}
              className="h-2 w-full cursor-pointer appearance-none bg-transparent accent-[var(--accent)]"
              style={{ accentColor: "var(--accent)" }}
            />
            <div className="flex items-center justify-between font-mono text-[0.62rem] uppercase tracking-[0.24em] text-zinc-600">
              <span>40 kg</span>
              <span>150 kg</span>
            </div>
          </div>
        </section>

        <section className="border border-white/8 bg-[#0c0c0f] p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.28em] text-[color:var(--accent)]">
            <Activity className="h-3.5 w-3.5" />
            Perfil pessoal
          </div>
          <p className="mb-5 text-sm text-zinc-500">
            Esses dados calibram cardio (Corrida), macros e leituras de saúde.
            Você pode ajustar tudo depois no Perfil.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 14,
              marginBottom: 14,
            }}
          >
            <div>
              <label style={onbLabelStyle}>Idade</label>
              <input
                type="number"
                min={1}
                max={120}
                inputMode="numeric"
                value={ageYears}
                onChange={(e) => setAgeYears(e.target.value)}
                placeholder="Ex.: 28"
                style={onbFieldStyle}
              />
            </div>
            <div>
              <label style={onbLabelStyle}>Sexo biológico</label>
              <select
                value={biologicalSex}
                onChange={(e) =>
                  setBiologicalSex(e.target.value as BiologicalSex)
                }
                style={onbFieldStyle}
              >
                <option value="female">Feminino</option>
                <option value="male">Masculino</option>
              </select>
            </div>
            <div>
              <label style={onbLabelStyle}>FC repouso (opcional)</label>
              <input
                type="number"
                min={30}
                max={220}
                inputMode="numeric"
                value={restingHeartRateBpm}
                onChange={(e) => setRestingHeartRateBpm(e.target.value)}
                placeholder="Ex.: 60"
                style={onbFieldStyle}
              />
            </div>
            <div>
              <label style={onbLabelStyle}>Nível de atividade</label>
              <select
                value={activityLevel}
                onChange={(e) =>
                  setActivityLevel(e.target.value as ActivityLevel)
                }
                style={onbFieldStyle}
              >
                {activityLevelChoices.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={onbLabelStyle}>Objetivo do cardio</label>
              <select
                value={cardioGoal}
                onChange={(e) => setCardioGoal(e.target.value as CardioGoal)}
                style={onbFieldStyle}
              >
                {cardioGoalChoices.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={onbLabelStyle}>Base do cardio</label>
              <select
                value={preferredCardio}
                onChange={(e) =>
                  setPreferredCardio(e.target.value as CardioPreference)
                }
                style={onbFieldStyle}
              >
                {cardioPreferenceChoices.map((o) => (
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
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
              marginBottom: 14,
            }}
          >
            {[
              {
                checked: hasCardiovascularCondition,
                set: setHasCardiovascularCondition,
                label: "Condição cardiovascular",
              },
              {
                checked: hasJointLimitation,
                set: setHasJointLimitation,
                label: "Limitação articular",
              },
              {
                checked: usesHeartRateMedication,
                set: setUsesHeartRateMedication,
                label: "Medicação cardíaca",
              },
            ].map((row) => (
              <label
                key={row.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "#0c0c0f",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "#d4d4d8",
                }}
              >
                <input
                  type="checkbox"
                  checked={row.checked}
                  onChange={(e) => row.set(e.target.checked)}
                  style={{ accentColor: "var(--accent)" }}
                />
                {row.label}
              </label>
            ))}
          </div>

          <div>
            <label style={onbLabelStyle}>Observações (opcional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: preferência por caminhada, fase de definição..."
              style={{ ...onbFieldStyle, minHeight: 64, resize: "vertical" }}
            />
          </div>
        </section>

        <section className="border border-[color:var(--accent)]/25 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--accent)_10%,transparent),rgba(12,12,15,0.94))] p-4 sm:p-5">
          <div className="flex flex-col gap-4 border-b border-[color:var(--accent)]/15 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.28em] text-[color:var(--accent)]">
                <Activity className="h-3.5 w-3.5" />
                Seu IMC
              </div>
              <p className="text-sm text-zinc-400">
                Leitura rápida de composição corporal para a primeira calibragem
                do sistema.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-sans text-4xl font-bold tracking-tight text-[color:var(--accent)]">
                  {formatDecimal(liveBmi)}
                </p>
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.24em] text-zinc-500">
                  Índice corporal
                </p>
              </div>
              <div className="border border-[color:var(--accent)]/35 bg-[#09090b] px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.24em] text-zinc-200">
                {liveBmiStatus.label}
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className="relative h-3 overflow-hidden border border-white/10 bg-[#09090b]">
              <div className="flex h-full w-full">
                {bmiBands.map((band) => (
                  <div
                    key={band.label}
                    className="h-full border-r border-black/30 last:border-r-0"
                    style={{
                      width: `${((band.max - band.min) / (40 - 14)) * 100}%`,
                      background:
                        band.label === "Ideal"
                          ? "color-mix(in srgb, var(--accent) 40%, transparent)"
                          : "rgba(255,255,255,0.08)",
                    }}
                  />
                ))}
              </div>
              <div
                className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 border-2 border-zinc-950 bg-zinc-100"
                style={{
                  left: `${bmiMarker}%`,
                  boxShadow:
                    "0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent)",
                }}
              />
            </div>

            <div className="grid grid-cols-4 gap-2 font-mono text-[0.58rem] uppercase tracking-[0.24em] text-zinc-500">
              {bmiBands.map((band) => (
                <span key={band.label} className="text-center">
                  {band.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="border border-white/8 bg-[#0c0c0f] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="mt-1 grid h-10 w-10 shrink-0 place-items-center border border-[color:var(--accent)]/35 bg-[color:color-mix(in_srgb,var(--accent)_12%,#090a0b)] text-[color:var(--accent)]">
              <Gauge className="h-4 w-4" />
            </div>
            <div className="space-y-2">
              <div className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-[color:var(--accent)]">
                Análise Praxis IA
              </div>
              <p className="text-sm leading-6 text-zinc-300">
                {liveBmiStatus.summary}
              </p>
              <p className="text-sm leading-6 text-zinc-500">
                Você poderá ajustar tudo isso mais tarde no módulo de dieta.
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="flex flex-col items-center gap-4 pt-2">
        <button
          type="button"
          onClick={() => {
            setPendingMetrics(buildPayload());
            setAnalysisProgress(0);
            setPhase("analysis");
          }}
          className="w-full max-w-xl border border-[color:var(--accent)]/35 bg-[#111114] px-6 py-4 font-mono text-[0.7rem] uppercase tracking-[0.28em] text-zinc-100 transition hover:bg-[color:var(--accent)] hover:text-black [box-shadow:0_0_15px_color-mix(in_srgb,var(--accent)_18%,transparent)] hover:[box-shadow:0_0_28px_color-mix(in_srgb,var(--accent)_40%,transparent)]"
        >
          Confirmar métricas e gerar meu plano
        </button>

        <button
          type="button"
          onClick={onSkip}
          className="font-mono text-[0.68rem] uppercase tracking-[0.26em] text-zinc-500 transition hover:text-[color:var(--accent)]"
        >
          Prefiro não informar
        </button>
      </div>
    </div>
  );
}
