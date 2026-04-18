"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Target, TrendingUp } from "lucide-react";
import { ProgressBar } from "@/components/ui/progress-bar";
import { moduleCatalog } from "@/lib/mock-data";
import type { LifeAreaAssessment, ModuleId, RankTier } from "@/lib/types";
import { cn, getLifeAreaMultiplier } from "@/lib/utils";

const rankTiers: RankTier[] = ["E", "D", "C", "B", "A", "S"];

const importanceLabels: Record<RankTier, string> = {
  E: "Quase sem prioridade",
  D: "Baixa prioridade",
  C: "Importância moderada",
  B: "Bem importante",
  A: "Muito importante",
  S: "Prioridade máxima",
};

const currentLevelLabels: Record<RankTier, string> = {
  E: "Muito abaixo",
  D: "Fraco",
  C: "Intermediário",
  B: "Bom",
  A: "Avançado",
  S: "Muito avançado",
};

const lifeAreaPrompts: Record<
  ModuleId,
  {
    importanceQuestion: string;
    importanceHint: string;
    levelQuestion: string;
    levelHint: string;
  }
> = {
  run: {
    importanceQuestion: "Quanto evoluir na corrida vai fazer diferença na sua vida agora?",
    importanceHint:
      "Considere saúde cardiovascular, condicionamento, disciplina e o quanto isso te destrava.",
    levelQuestion: "Hoje, em que rank você se colocaria na corrida?",
    levelHint:
      "Olhe para consistência, técnica, fôlego e capacidade real de cumprir metas de corrida.",
  },
  workout: {
    importanceQuestion: "Quanto melhorar no treino é prioridade para você neste momento?",
    importanceHint:
      "Pense em força, físico, energia, confiança e impacto no seu estilo de vida.",
    levelQuestion: "Hoje, em que rank você se colocaria no treino?",
    levelHint:
      "Avalie consistência, execução, intensidade, progressão de carga e disciplina.",
  },
  work: {
    importanceQuestion: "Quanto evoluir no trabalho é prioridade para você agora?",
    importanceHint:
      "Considere renda, desempenho, entregas, clareza profissional e necessidade de avanço.",
    levelQuestion: "Hoje, em que rank você se colocaria no trabalho?",
    levelHint:
      "Olhe para foco, produtividade, organização e capacidade de entregar o que precisa.",
  },
  nutrition: {
    importanceQuestion: "Quanto evoluir na dieta é prioridade para você agora?",
    importanceHint:
      "Pense em composição corporal, energia, recuperação, digestão e consistência alimentar.",
    levelQuestion: "Hoje, em que rank você se colocaria na dieta?",
    levelHint:
      "Avalie sua rotina alimentar, capacidade de seguir plano e qualidade das escolhas do dia a dia.",
  },
  finance: {
    importanceQuestion: "Quanto evoluir nas finanças é prioridade para você agora?",
    importanceHint:
      "Considere controle, paz mental, previsibilidade, capacidade de crescer e reduzir pressão.",
    levelQuestion: "Hoje, em que rank você se colocaria nas finanças?",
    levelHint:
      "Olhe para organização financeira, consciência de gastos, reserva e execução do que planeja.",
  },
  appearance: {
    importanceQuestion: "Quanto evoluir na aparência é prioridade para você agora?",
    importanceHint:
      "Pense em presença, autoestima, cuidado pessoal e consistência com sua imagem.",
    levelQuestion: "Hoje, em que rank você se colocaria na aparência?",
    levelHint:
      "Avalie constância nas rotinas, autocuidado e o quanto sua imagem já está alinhada com o que deseja.",
  },
  recovery: {
    importanceQuestion: "Quanto evoluir na recuperação é prioridade para você agora?",
    importanceHint:
      "Considere dores, fadiga, rigidez, mobilidade e o quanto isso está limitando o resto.",
    levelQuestion: "Hoje, em que rank você se colocaria na recuperação?",
    levelHint:
      "Olhe para alongamento, mobilidade, descanso, liberação e cuidado pós-esforço.",
  },
  health: {
    importanceQuestion: "Quanto evoluir no cuidado com a saúde é prioridade para você agora?",
    importanceHint:
      "Considere exames, check-ups, consultas, prevenção e o quanto isso sustenta sua evolução no longo prazo.",
    levelQuestion: "Hoje, em que rank você se colocaria na sua gestão de saúde?",
    levelHint:
      "Avalie constância em exames, consultas, acompanhamento clínico e atenção preventiva ao próprio corpo.",
  },
  mind: {
    importanceQuestion: "Quanto evoluir na mente é prioridade para você agora?",
    importanceHint:
      "Pense em clareza mental, ansiedade, estabilidade emocional, atenção e paz interna.",
    levelQuestion: "Hoje, em que rank você se colocaria na mente?",
    levelHint:
      "Avalie foco, controle emocional, presença, resiliência e consistência das práticas mentais.",
  },
  sleep: {
    importanceQuestion: "Quanto evoluir no sono é prioridade para você agora?",
    importanceHint:
      "Considere energia, recuperação, humor, foco e o quanto o sono impacta sua rotina inteira.",
    levelQuestion: "Hoje, em que rank você se colocaria no sono?",
    levelHint:
      "Olhe para horário de dormir, qualidade do sono, regularidade e facilidade de acordar bem.",
  },
  home: {
    importanceQuestion: "Quanto evoluir na casa é prioridade para você agora?",
    importanceHint:
      "Pense em organização, limpeza, ordem mental, praticidade e sensação de controle.",
    levelQuestion: "Hoje, em que rank você se colocaria na gestão da casa?",
    levelHint:
      "Avalie consistência nas tarefas, manutenção do ambiente e o quanto a casa apoia ou atrapalha sua rotina.",
  },
  market: {
    importanceQuestion: "Quanto evoluir nas compras da casa é prioridade para você agora?",
    importanceHint:
      "Considere economia, reposição sem falhas, clareza de consumo e redução de desperdício.",
    levelQuestion: "Hoje, em que rank você se colocaria na gestão de compras da casa?",
    levelHint:
      "Olhe para organização da lista, comparação de preços, previsibilidade e capacidade de repor sem correria.",
  },
  supplements: {
    importanceQuestion: "Quanto evoluir na compra de suplementos é prioridade para você agora?",
    importanceHint:
      "Pense em consistência, custo-benefício, aderência ao plano e precisão nas escolhas.",
    levelQuestion: "Hoje, em que rank você se colocaria na gestão dos seus suplementos?",
    levelHint:
      "Avalie se você compra bem, repõe na hora certa e encontra o melhor custo por marca e quantidade.",
  },
};

type LifeAreaProfileEditorProps = {
  initialAreas: Record<ModuleId, LifeAreaAssessment>;
  moduleIds?: ModuleId[];
  onSave?: (areas: Record<ModuleId, LifeAreaAssessment>) => void;
  onSkip?: () => void;
  saveLabel?: string;
  title: string;
  description: string;
};

type RankSelectorProps = {
  label: string;
  helper: string;
  selected: RankTier;
  labels: Record<RankTier, string>;
  emphasis?: "importance" | "level";
  onSelect: (tier: RankTier) => void;
};

function RankSelector({
  label,
  helper,
  selected,
  labels,
  emphasis = "importance",
  onSelect,
}: RankSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-100">{label}</p>
        <p className="text-sm leading-6 text-zinc-500">{helper}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {rankTiers.map((tier) => {
          const active = selected === tier;
          return (
            <button
              key={tier}
              type="button"
              onClick={() => onSelect(tier)}
              className={cn(
                "group rounded-sm border px-3 py-3 text-left transition",
                active
                  ? emphasis === "importance"
                    ? "border-[rgba(251,146,60,0.34)] bg-[rgba(251,146,60,0.12)] text-zinc-100 shadow-[0_0_14px_rgba(251,146,60,0.14)]"
                    : "border-zinc-700 bg-zinc-950 text-zinc-100"
                  : "border-zinc-800 bg-[rgba(14,14,17,0.92)] text-zinc-400 hover:border-[rgba(251,146,60,0.2)] hover:text-zinc-200",
              )}
            >
              <p className="font-title text-xl font-bold tracking-tight">{tier}</p>
              <p className="mt-1 text-xs leading-5">{labels[tier]}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LifeAreaProfileEditor({
  initialAreas,
  moduleIds,
  onSave,
  onSkip,
  saveLabel = "Salvar perfil",
  title,
  description,
}: LifeAreaProfileEditorProps) {
  const [areas, setAreas] = useState(initialAreas);
  const [stepIndex, setStepIndex] = useState(0);
  const moduleSequence =
    moduleIds && moduleIds.length
      ? moduleCatalog.filter((module) => moduleIds.includes(module.id))
      : moduleCatalog;

  const currentModule = moduleSequence[stepIndex];
  const currentAssessment = areas[currentModule.id];
  const prompts = lifeAreaPrompts[currentModule.id];
  const multiplier = getLifeAreaMultiplier(currentAssessment);
  const progressValue = ((stepIndex + 1) / moduleSequence.length) * 100;
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === moduleSequence.length - 1;

  function updateAssessment(field: keyof LifeAreaAssessment, value: RankTier) {
    setAreas((current) => ({
      ...current,
      [currentModule.id]: {
        ...current[currentModule.id],
        [field]: value,
      },
    }));
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="praxis-label text-[var(--accent)]">{title}</p>
        <p className="max-w-4xl text-sm leading-6 text-zinc-500">{description}</p>
      </div>

      <div className="praxis-panel rounded-sm p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="praxis-label">
              Área {stepIndex + 1} de {moduleSequence.length}
            </p>
            <h2 className="praxis-title mt-2 text-3xl">{currentModule.name}</h2>
          </div>
          <div className="rounded-sm border border-[rgba(251,146,60,0.28)] bg-[rgba(251,146,60,0.1)] px-3 py-2 text-sm text-[var(--accent)]">
            Multiplicador x{multiplier.toFixed(2)}
          </div>
        </div>

        <div className="mt-4">
          <ProgressBar value={progressValue} />
        </div>

        <div className="mt-5 praxis-panel-active praxis-panel rounded-sm p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="praxis-label text-[var(--accent)]">
            Prioridade de evolução
              </p>
              <p className="mt-2 text-base leading-7 text-zinc-200">
                {currentModule.description}
              </p>
            </div>
            <div className="rounded-sm border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-zinc-400">
              {currentModule.detail}
            </div>
          </div>

          <div className="mt-6 space-y-6">
            <RankSelector
              label={prompts.importanceQuestion}
              helper={prompts.importanceHint}
              selected={currentAssessment.importance}
              labels={importanceLabels}
              emphasis="importance"
              onSelect={(tier) => updateAssessment("importance", tier)}
            />

            <RankSelector
              label={prompts.levelQuestion}
              helper={prompts.levelHint}
              selected={currentAssessment.currentLevel}
              labels={currentLevelLabels}
              emphasis="level"
              onSelect={(tier) => updateAssessment("currentLevel", tier)}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="praxis-kpi p-4">
            <div className="flex items-center gap-2 text-[var(--accent)]">
              <Target className="h-4 w-4" />
              <span className="text-sm font-medium">
                Importância atual: Rank {currentAssessment.importance}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {importanceLabels[currentAssessment.importance]}
            </p>
          </div>

          <div className="praxis-kpi p-4">
            <div className="flex items-center gap-2 text-zinc-200">
              <TrendingUp className="h-4 w-4 text-[var(--accent)]" />
              <span className="text-sm font-medium">
                Nível atual: Rank {currentAssessment.currentLevel}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {currentLevelLabels[currentAssessment.currentLevel]}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
            disabled={isFirstStep}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-3",
              isFirstStep ? "praxis-button-ghost cursor-not-allowed opacity-45" : "praxis-button-ghost",
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            Área anterior
          </button>

          {onSkip ? (
            <button
              type="button"
              onClick={onSkip}
              className="praxis-button-ghost inline-flex items-center gap-2 px-4 py-3"
            >
              Pular por agora
            </button>
          ) : null}
        </div>

        {isLastStep ? (
          <button
            type="button"
            onClick={() => onSave?.(areas)}
            className="praxis-button inline-flex items-center gap-2 px-5 py-3"
          >
            {saveLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              setStepIndex((current) => Math.min(moduleSequence.length - 1, current + 1))
            }
            className="praxis-button inline-flex items-center gap-2 px-5 py-3"
          >
            Próxima área
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
