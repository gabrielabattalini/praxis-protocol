"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  PencilLine,
  Plus,
  Save,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import { initialPersistedState, nutritionGoals } from "@/lib/mock-data";
import type {
  BasalMetabolicRateSource,
  BiologicalSex,
  DailyNutritionTargets,
  FoodDatabaseItem,
  FoodKind,
  MealCategory,
  NutritionMacros,
  NutritionGoalId,
  TbcaFoodSearchResult,
  UsdaFoodSearchResult,
  Weekday,
} from "@/lib/types";
import {
  addMacros,
  describeTrainingActivity,
  emptyMacros,
  estimateBasalMetabolicRate,
  formatPoints,
  getActivityMultiplierFromTrainingDays,
  weekdayLongLabel,
} from "@/lib/utils";

type UsdaSearchStatus = "idle" | "loading" | "ready" | "error" | "missing";

// Per-macro guidance notes shown when the user expands a card in the
// "Leitura detalhada da meta" panel. The keys match the labels used in
// dietComparisonItems so the lookup is a plain string match.
const nutritionMacroNotes: Record<string, string> = {
  "Proteína": "Hipertrofia e atletas: 1,6 a 2,2 g/kg. Corte e definição: pode subir até 2,5 g/kg.",
  "Carboidratos": "Leve: 3 a 5 g/kg. Moderado: 5 a 7 g/kg. Intenso: 7 a 10 g/kg. Picos: até 12 g/kg.",
  "Gorduras": "Faixa prática: cerca de 0,5 a 1 g/kg. Ajuste conforme calorias totais e adesão.",
  "Fibras": "Referência: 10 g a cada 1000 kcal consumidas. Boa fonte: vegetais, leguminosas e grãos integrais.",
  "Sódio": "Máximo recomendado: 3000 mg por dia. Reduza alimentos ultraprocessados e tempere com ervas.",
  "Calorias": "Resultado do BMR ajustado pelo nível de atividade e pelo ajuste de fase (déficit ou superávit).",
};

const weekdayOrder: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const mealCategoryOptions: Array<{
  id: MealCategory;
  label: string;
}> = [
  { id: "fasting", label: "Jejum" },
  { id: "breakfast", label: "Café da manhã" },
  { id: "lunch", label: "Almoço" },
  { id: "intra", label: "Intra treino" },
  { id: "dinner", label: "Jantar" },
  { id: "supplements", label: "Suplementos" },
];

function inferMealCategory(title: string, time: string): MealCategory {
  const normalizedTitle = title.trim().toLowerCase();

  if (
    normalizedTitle.includes("jejum") ||
    normalizedTitle.includes("fast")
  ) {
    return "fasting";
  }

  if (
    normalizedTitle.includes("suplement") ||
    normalizedTitle.includes("remédio") ||
    normalizedTitle.includes("remedio") ||
    normalizedTitle.includes("vitamina")
  ) {
    return "supplements";
  }

  if (normalizedTitle.includes("intra")) {
    return "intra";
  }

  if (
    normalizedTitle.includes("café") ||
    normalizedTitle.includes("cafe") ||
    normalizedTitle.includes("manhã") ||
    normalizedTitle.includes("manha") ||
    normalizedTitle.includes("desjejum")
  ) {
    return "breakfast";
  }

  if (
    normalizedTitle.includes("almoço") ||
    normalizedTitle.includes("almoco") ||
    normalizedTitle.includes("moço") ||
    normalizedTitle.includes("moco")
  ) {
    return "lunch";
  }

  if (
    normalizedTitle.includes("jantar") ||
    normalizedTitle.includes("ceia") ||
    normalizedTitle.includes("noite")
  ) {
    return "dinner";
  }

  const [hourText] = time.split(":");
  const hour = Number(hourText);

  if (Number.isNaN(hour)) return "lunch";
  if (hour < 10) return "breakfast";
  if (hour < 16) return "lunch";
  return "dinner";
}

function formatWaterTargetLiters(amountMl: number) {
  const liters = amountMl / 1000;
  const hasFraction = Math.abs(liters % 1) > 0.001;

  return liters.toLocaleString("pt-BR", {
    minimumFractionDigits: hasFraction ? 1 : 0,
    maximumFractionDigits: hasFraction ? 1 : 0,
  });
}

const usdaDataTypeLabels: Record<string, string> = {
  branded_food: "produto de marca",
  foundation_food: "alimento base",
  sr_legacy_food: "tabela legada",
  survey_fndds_food: "pesquisa alimentar",
  experimental_food: "alimento experimental",
};

const usdaTermReplacements: Array<[RegExp, string]> = [
  [/\bservings\b/gi, "porções"],
  [/\bserving\b/gi, "porção"],
  [/\bcups\b/gi, "xícaras"],
  [/\bcup\b/gi, "xícara"],
  [/\btablespoons\b/gi, "colheres de sopa"],
  [/\btablespoon\b/gi, "colher de sopa"],
  [/\bteaspoons\b/gi, "colheres de chá"],
  [/\bteaspoon\b/gi, "colher de chá"],
  [/\bslices\b/gi, "fatias"],
  [/\bslice\b/gi, "fatia"],
  [/\bpackages\b/gi, "pacotes"],
  [/\bpackage\b/gi, "pacote"],
  [/\bcontainers\b/gi, "potes"],
  [/\bcontainer\b/gi, "pote"],
  [/\bbottles\b/gi, "garrafas"],
  [/\bbottle\b/gi, "garrafa"],
  [/\bcans\b/gi, "latas"],
  [/\bcan\b/gi, "lata"],
  [/\bbars\b/gi, "barras"],
  [/\bbar\b/gi, "barra"],
  [/\bounces\b/gi, "onças"],
  [/\bounce\b/gi, "onça"],
  [/\bpieces\b/gi, "unidades"],
  [/\bpiece\b/gi, "unidade"],
];

type QuantityUnit = "g" | "ml" | "unit";

type ParsedQuantity = {
  amount: number;
  canonicalAmount: number;
  canonicalUnit: QuantityUnit;
  shortLabel: string;
};

type ManualFoodDraft = {
  name: string;
  servingLabel: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  sodium: string;
  calories: string;
};

type ShoppingItemWithMealBlocks = {
  id: string;
  name: string;
  quantity: string;
  scheduleLabel?: string;
  localStoreName?: string;
  mealBlockIds?: string[];
};

type LinkedShoppingItem = {
  id: string;
  originLabel: "Mercado" | "Suplementos";
  name: string;
  quantity: string;
  scheduleLabel?: string;
  localStoreName?: string;
};

const quantityUnitDefinitions: Array<{
  aliases: string[];
  canonicalUnit: QuantityUnit;
  multiplier: number;
  shortLabel: string;
}> = [
  {
    aliases: ["g", "gr", "grama", "gramas"],
    canonicalUnit: "g",
    multiplier: 1,
    shortLabel: "g",
  },
  {
    aliases: ["kg", "quilo", "quilos", "kilograma", "kilogramas"],
    canonicalUnit: "g",
    multiplier: 1000,
    shortLabel: "kg",
  },
  {
    aliases: ["mg", "miligramas", "miligrama"],
    canonicalUnit: "g",
    multiplier: 0.001,
    shortLabel: "mg",
  },
  {
    aliases: ["ml", "mililitro", "mililitros"],
    canonicalUnit: "ml",
    multiplier: 1,
    shortLabel: "ml",
  },
  {
    aliases: ["l", "lt", "litro", "litros"],
    canonicalUnit: "ml",
    multiplier: 1000,
    shortLabel: "l",
  },
  {
    aliases: [
      "un",
      "und",
      "unid",
      "unidade",
      "unidades",
      "dose",
      "doses",
      "scoop",
      "scoops",
      "caps",
      "cap",
      "capsula",
      "capsulas",
      "tablete",
      "tabletes",
      "pacote",
      "pacotes",
      "sache",
      "saches",
    ],
    canonicalUnit: "unit",
    multiplier: 1,
    shortLabel: "un",
  },
];

function normalizeQuantityText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/,/g, ".");
}

function extractQuantities(value: string): ParsedQuantity[] {
  const normalized = normalizeQuantityText(value);
  const regex = /(\d+(?:\.\d+)?)\s*([a-z]+)/g;
  const quantities: ParsedQuantity[] = [];

  let match = regex.exec(normalized);
  while (match) {
    const amount = Number(match[1]);
    const unitToken = match[2];
    const unitDefinition = quantityUnitDefinitions.find((item) =>
      item.aliases.includes(unitToken),
    );

    if (unitDefinition && Number.isFinite(amount) && amount > 0) {
      quantities.push({
        amount,
        canonicalAmount: amount * unitDefinition.multiplier,
        canonicalUnit: unitDefinition.canonicalUnit,
        shortLabel: unitDefinition.shortLabel,
      });
    }

    match = regex.exec(normalized);
  }

  return quantities;
}

function extractBareQuantityAmount(value: string) {
  const normalized = normalizeQuantityText(value).trim();
  const match = normalized.match(/^(\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const amount = Number(match[1]);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function resolveQuantityScaling(baseLabel: string, desiredLabel: string) {
  if (!desiredLabel.trim()) return null;

  const baseQuantities = extractQuantities(baseLabel);
  const desiredQuantities = extractQuantities(desiredLabel);

  if (!desiredQuantities.length && baseQuantities.length) {
    const bareAmount = extractBareQuantityAmount(desiredLabel);

    if (bareAmount) {
      const baseQuantity = baseQuantities[0];
      const unitMultiplier = baseQuantity.canonicalAmount / baseQuantity.amount;
      const desiredQuantity = {
        amount: bareAmount,
        canonicalAmount: bareAmount * unitMultiplier,
        canonicalUnit: baseQuantity.canonicalUnit,
        shortLabel: baseQuantity.shortLabel,
      };

      return {
        multiplier: desiredQuantity.canonicalAmount / baseQuantity.canonicalAmount,
        baseQuantity,
        desiredQuantity,
      };
    }
  }

  for (const desiredQuantity of desiredQuantities) {
    const baseQuantity = baseQuantities.find(
      (item) => item.canonicalUnit === desiredQuantity.canonicalUnit,
    );

    if (baseQuantity && baseQuantity.canonicalAmount > 0) {
      return {
        multiplier: desiredQuantity.canonicalAmount / baseQuantity.canonicalAmount,
        baseQuantity,
        desiredQuantity,
      };
    }
  }

  return null;
}

function scaleNutritionMacros(macros: NutritionMacros, multiplier: number): NutritionMacros {
  return {
    protein: Number((macros.protein * multiplier).toFixed(1)),
    carbs: Number((macros.carbs * multiplier).toFixed(1)),
    fat: Number((macros.fat * multiplier).toFixed(1)),
    fiber: Number((macros.fiber * multiplier).toFixed(1)),
    sodium: Number((macros.sodium * multiplier).toFixed(0)),
    calories: Number((macros.calories * multiplier).toFixed(0)),
  };
}

function localizeUsdaText(value: string) {
  return usdaTermReplacements.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value,
  );
}

function normalizeFoodSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getDisplayServingLabel(servingLabel: string, source?: string) {
  return source === "usda" ? localizeUsdaText(servingLabel) : servingLabel;
}

function getDisplayUsdaServingLabel(servingLabel: string) {
  return localizeUsdaText(servingLabel);
}

function getUsdaSourceLabel(dataType: string) {
  return usdaDataTypeLabels[dataType] ?? dataType.replaceAll("_", " ");
}

function formatUsdaFoodMeta(food: UsdaFoodSearchResult) {
  const parts: string[] = [];

  if (food.brandName) {
    parts.push(`Marca: ${food.brandName}`);
  } else if (food.brandOwner) {
    parts.push(`Empresa: ${food.brandOwner}`);
  }

  parts.push(`Origem: ${getUsdaSourceLabel(food.dataType)}`);

  return parts.join(" ? ");
}

function formatTbcaFoodMeta(food: TbcaFoodSearchResult) {
  if (food.category) {
    return `Classe: ${food.category} ? Origem: TBCA`;
  }

  return "Origem: TBCA";
}

function getFoodSourceLabel(source?: string) {
  switch (source) {
    case "tbca":
      return "TBCA";
    case "usda":
      return "USDA";
    case "custom":
      return "Manual";
    case "database":
      return "Base local";
    default:
      return "Banco";
  }
}

function createEmptyManualFoodDraft(name = ""): ManualFoodDraft {
  return {
    name,
    servingLabel: "100 g",
    protein: "0",
    carbs: "0",
    fat: "0",
    fiber: "0",
    sodium: "0",
    calories: "0",
  };
}

function buildLinkedShoppingItemsByBlock(
  marketItems: ShoppingItemWithMealBlocks[],
  supplementItems: ShoppingItemWithMealBlocks[],
) {
  const linkedItemsByBlock: Record<string, LinkedShoppingItem[]> = {};

  function appendItems(
    items: ShoppingItemWithMealBlocks[],
    originLabel: LinkedShoppingItem["originLabel"],
  ) {
    items.forEach((item) => {
      const mealBlockIds = Array.isArray(item.mealBlockIds)
        ? [...new Set(item.mealBlockIds.filter((blockId) => Boolean(blockId?.trim?.())))]
        : [];

      mealBlockIds.forEach((blockId) => {
        (linkedItemsByBlock[blockId] ??= []).push({
          id: item.id,
          originLabel,
          name: item.name,
          quantity: item.quantity,
          scheduleLabel: item.scheduleLabel,
          localStoreName: item.localStoreName,
        });
      });
    });
  }

  appendItems(marketItems, "Mercado");
  appendItems(supplementItems, "Suplementos");

  Object.values(linkedItemsByBlock).forEach((items) => {
    items.sort((left, right) => {
      if (left.originLabel !== right.originLabel) {
        return left.originLabel.localeCompare(right.originLabel, "pt-BR");
      }

      return left.name.localeCompare(right.name, "pt-BR");
    });
  });

  return linkedItemsByBlock;
}

function getFoodKindForMealCategory(category: MealCategory): FoodKind {
  return category === "supplements" ? "supplement" : "food";
}

function normalizeFoodIdentity(value: string) {
  return normalizeFoodSearchText(value).replace(/\s+/g, " ").trim();
}

function isSameFoodEntry(
  food: FoodDatabaseItem,
  candidate: Pick<FoodDatabaseItem, "name" | "servingLabel" | "source">,
) {
  return (
    food.source === candidate.source &&
    normalizeFoodIdentity(food.name) === normalizeFoodIdentity(candidate.name) &&
    normalizeFoodIdentity(food.servingLabel) === normalizeFoodIdentity(candidate.servingLabel)
  );
}

function makeFoodDraftId() {
  return `food-${crypto.randomUUID()}`;
}

function sortFoodsByRelevance(foods: FoodDatabaseItem[], normalizedQuery: string) {
  return [...foods].sort((left, right) => {
    const leftFavorite = Boolean(left.favorite);
    const rightFavorite = Boolean(right.favorite);
    if (leftFavorite !== rightFavorite) {
      return leftFavorite ? -1 : 1;
    }

    const leftName = normalizeFoodSearchText(left.name);
    const rightName = normalizeFoodSearchText(right.name);

    if (normalizedQuery) {
      const leftStartsWith = leftName.startsWith(normalizedQuery);
      const rightStartsWith = rightName.startsWith(normalizedQuery);
      if (leftStartsWith !== rightStartsWith) {
        return leftStartsWith ? -1 : 1;
      }
    }

    return left.name.localeCompare(right.name, "pt-BR");
  });
}

function MetricInput({
  label,
  unit,
  value,
  onChange,
  helperText,
  step,
  min,
  disabled,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
  step?: string;
  min?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
        <p>{label}</p>
        <p>{unit}</p>
      </div>
      <div className="relative">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type="number"
          step={step}
          min={min}
          disabled={disabled}
          className="w-full rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-4 py-3 pr-20 text-white disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-zinc-500">
          {unit}
        </span>
      </div>
      {helperText ? <p className="px-1 text-xs text-zinc-500">{helperText}</p> : null}
    </div>
  );
}

function formatGoalAdjustment(adjustmentKcal: number) {
  if (adjustmentKcal === 0) return "Manutenção calórica";
  return adjustmentKcal > 0
    ? `Superávit de ${Math.abs(adjustmentKcal)} kcal`
    : `Déficit de ${Math.abs(adjustmentKcal)} kcal`;
}

function NutritionTargetsEditor({
  targets,
  onApply,
  isCollapsed,
  onToggle,
  embedded = false,
  activityMultiplier = 1,
}: {
  targets: DailyNutritionTargets;
  activityMultiplier?: number;
  onApply: (payload: {
    bodyWeightKg: number;
    bodyHeightCm: number;
    ageYears: number;
    biologicalSex: BiologicalSex;
    waterMlPerKg: number;
    proteinPerKg: number;
    carbsPerKg: number;
    fatPerKg: number;
    fiberStrategy: "per-calories" | "per-kg";
    fiberPerKg: number;
    fiberRatioGrams: number;
    fiberRatioCalories: number;
    sodiumTargetMg: number;
    targetWeightKg: number;
    weeklyChangeKg: number;
    basalMetabolicRate?: number;
    basalMetabolicRateSource: BasalMetabolicRateSource;
  }) => void;
  isCollapsed: boolean;
  onToggle: () => void;
  // When embedded, the editor renders its body without the outer
  // GlassPanel + header + toggle button. The parent owns the collapse
  // state and the wrapping panel — used by the unified "Meta ativa +
  // Referência diária" section so we don't end up with nested panels.
  embedded?: boolean;
}) {
  const [bodyWeightKg, setBodyWeightKg] = useState(targets.bodyWeightKg.toString());
  const [bodyHeightCm, setBodyHeightCm] = useState(targets.bodyHeightCm.toString());
  const [ageYears, setAgeYears] = useState(targets.ageYears.toString());
  const [biologicalSex, setBiologicalSex] = useState<BiologicalSex>(targets.biologicalSex);
  const [waterMlPerKg, setWaterMlPerKg] = useState(targets.perKg.waterMl.toString());
  const [proteinPerKg, setProteinPerKg] = useState(targets.perKg.protein.toFixed(2));
  const [carbsPerKg, setCarbsPerKg] = useState(targets.perKg.carbs.toFixed(2));
  const [fatPerKg, setFatPerKg] = useState(targets.perKg.fat.toFixed(2));
  const [fiberStrategy, setFiberStrategy] = useState<"per-calories" | "per-kg">(
    targets.fiberStrategy,
  );
  const [fiberPerKg, setFiberPerKg] = useState(targets.fiberPerKg.toFixed(2));
  const [fiberRatioGrams, setFiberRatioGrams] = useState(
    targets.fiberRatioGrams.toFixed(1),
  );
  const [fiberRatioCalories, setFiberRatioCalories] = useState(
    targets.fiberRatioCalories.toFixed(0),
  );
  const [sodiumTargetMg, setSodiumTargetMg] = useState(
    targets.sodiumTargetMg.toFixed(0),
  );
  const [basalMetabolicRateSource, setBasalMetabolicRateSource] =
    useState<BasalMetabolicRateSource>(targets.basalMetabolicRateSource);
  const [manualBasalMetabolicRate, setManualBasalMetabolicRate] = useState(
    targets.basalMetabolicRate.toString(),
  );
  // Toast efêmero "Metas salvas" disparado pelo botão Aplicar metas.
  // Não persiste estado — só feedback visual de 2.5s. Limpa o timer no
  // unmount pra evitar setState após unmount.
  const [showSavedToast, setShowSavedToast] = useState(false);
  useEffect(() => {
    if (!showSavedToast) return;
    const timer = window.setTimeout(() => setShowSavedToast(false), 2500);
    return () => window.clearTimeout(timer);
  }, [showSavedToast]);

  const bodyWeightValue = Number(bodyWeightKg) || 0;
  const bodyHeightValue = Number(bodyHeightCm) || 0;
  const ageValue = Number(ageYears) || 0;
  const waterPerKgValue = Number(waterMlPerKg) || 0;
  const proteinPerKgValue = Number(proteinPerKg) || 0;
  const carbsPerKgValue = Number(carbsPerKg) || 0;
  const fatPerKgValue = Number(fatPerKg) || 0;
  const fiberPerKgValue = Number(fiberPerKg) || 0;
  const fiberRatioGramsValue = Number(fiberRatioGrams) || 0;
  const fiberRatioCaloriesValue = Number(fiberRatioCalories) || 1;
  const sodiumTargetValue = Number(sodiumTargetMg) || 0;
  const macroBasedCaloriesTarget = Math.round(
    bodyWeightValue * proteinPerKgValue * 4 +
      bodyWeightValue * carbsPerKgValue * 4 +
      bodyWeightValue * fatPerKgValue * 9,
  );
  const estimatedBasalMetabolicRate = estimateBasalMetabolicRate({
    bodyWeightKg: bodyWeightValue || targets.bodyWeightKg,
    bodyHeightCm: bodyHeightValue || targets.bodyHeightCm,
    ageYears: ageValue || targets.ageYears,
    biologicalSex,
  });
  const displayedBasalMetabolicRate =
    basalMetabolicRateSource === "manual"
      ? Number(manualBasalMetabolicRate) || targets.basalMetabolicRate
      : estimatedBasalMetabolicRate;
  // Daily calorie target uses TDEE (BMR × activity multiplier) + adjustment,
  // not raw BMR — otherwise sedentary calculation gets baked in and the
  // displayed target is way below what the user actually needs.
  const tdeeForTargets = Math.round(
    displayedBasalMetabolicRate * activityMultiplier,
  );
  const adjustedCaloriesTarget = Math.max(
    0,
    Math.round(tdeeForTargets + targets.goalAdjustmentKcal),
  );
  const resolvedFiberTarget =
    fiberStrategy === "per-kg"
      ? Number((bodyWeightValue * fiberPerKgValue).toFixed(1))
      : Number(
          (
            (adjustedCaloriesTarget / Math.max(1, fiberRatioCaloriesValue)) *
            fiberRatioGramsValue
          ).toFixed(1),
        );

  const editorBody = (
    <>
      {isCollapsed ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-4">
            <p className="text-sm text-zinc-500">Água</p>
            <p className="mt-2 text-xl font-semibold text-white">
              {formatPoints(Math.round(bodyWeightValue * waterPerKgValue))} ml
            </p>
          </div>
          <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-4">
            <p className="text-sm text-zinc-500">Calorias</p>
            <p className="mt-2 text-xl font-semibold text-white">
              {adjustedCaloriesTarget} kcal
            </p>
          </div>
          <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-4">
            <p className="text-sm text-zinc-500">Fibra</p>
            <p className="mt-2 text-xl font-semibold text-white">
              {resolvedFiberTarget.toFixed(1)} g
            </p>
          </div>
          <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-4">
            <p className="text-sm text-zinc-500">Sódio</p>
            <p className="mt-2 text-xl font-semibold text-white">
              {sodiumTargetValue.toFixed(0)} mg
            </p>
          </div>
        </div>
      ) : (
        <>

      <div className="grid gap-3 xl:grid-cols-2">
        <MetricInput
          label="Peso corporal"
          unit="kg"
          value={bodyWeightKg}
          onChange={setBodyWeightKg}
          helperText="Informe o peso atual em quilos."
          step="0.1"
          min="1"
        />
        <MetricInput
          label="Água por kg"
          unit="ml/kg"
          value={waterMlPerKg}
          onChange={setWaterMlPerKg}
          helperText="Cada ponto equivale a 1 ml por kg corporal."
          step="1"
          min="0"
        />
        <MetricInput
          label="Altura"
          unit="cm"
          value={bodyHeightCm}
          onChange={setBodyHeightCm}
          step="1"
          min="1"
        />
        <MetricInput
          label="Idade"
          unit="anos"
          value={ageYears}
          onChange={setAgeYears}
          step="1"
          min="1"
        />
        <MetricInput
          label="Proteína por kg"
          unit="g/kg"
          value={proteinPerKg}
          onChange={setProteinPerKg}
          helperText="Meta diária de proteína por kg corporal."
          step="0.1"
          min="0"
        />
        <MetricInput
          label="Carbo por kg"
          unit="g/kg"
          value={carbsPerKg}
          onChange={setCarbsPerKg}
          helperText="Use a intensidade do treino para definir sua faixa."
          step="0.1"
          min="0"
        />
        <MetricInput
          label="Gordura por kg"
          unit="g/kg"
          value={fatPerKg}
          onChange={setFatPerKg}
          helperText="Faixa prática comum: cerca de 0,5 a 1 g/kg."
          step="0.1"
          min="0"
        />
        <MetricInput
          label="Sódio diário"
          unit="mg"
          value={sodiumTargetMg}
          onChange={setSodiumTargetMg}
          helperText="Base sugerida: 3000 mg por dia, mas você pode ajustar."
          step="1"
          min="0"
        />
      </div>

      <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] p-4">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-zinc-500">Estratégia de fibra</p>
            <p className="mt-2 text-sm text-zinc-500">
              Escolha se a meta de fibra será calculada por peso corporal ou por calorias.
            </p>
          </div>
            <div className="flex flex-wrap gap-2">
            {([
              { id: "per-calories", label: "Por calorias" },
              { id: "per-kg", label: "Por kg" },
            ] as const).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFiberStrategy(option.id)}
                className={`flex-1 rounded-sm border px-4 py-3 text-sm ${
                  fiberStrategy === option.id
                    ? "border-[rgba(251,146,60,0.32)] bg-[rgba(251,146,60,0.12)] text-white"
                    : "border-zinc-800 bg-[rgba(14,14,17,0.96)] text-zinc-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {fiberStrategy === "per-kg" ? (
            <MetricInput
              label="Fibra por kg"
              unit="g/kg"
              value={fiberPerKg}
              onChange={setFiberPerKg}
              helperText="Exemplo: 0,3 g/kg."
              step="0.01"
              min="0"
            />
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              <MetricInput
                label="Fibra"
                unit="g"
                value={fiberRatioGrams}
                onChange={setFiberRatioGrams}
                helperText="Exemplo: 10 g."
                step="0.1"
                min="0"
              />
              <MetricInput
                label="Base calórica"
                unit="kcal"
                value={fiberRatioCalories}
                onChange={setFiberRatioCalories}
                helperText="Exemplo: a cada 1000 kcal."
                step="1"
                min="1"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            Sexo biológico
          </p>
          <div className="flex flex-wrap gap-2">
            {([
              { id: "male", label: "Masculino" },
              { id: "female", label: "Feminino" },
            ] as const).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setBiologicalSex(option.id)}
                className={`flex-1 rounded-sm border px-4 py-3 text-sm ${
                  biologicalSex === option.id
                    ? "border-[rgba(251,146,60,0.32)] bg-[rgba(251,146,60,0.12)] text-white"
                    : "border-zinc-800 bg-[rgba(14,14,17,0.96)] text-zinc-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            Metabolismo basal
          </p>
          <div className="flex flex-wrap gap-2">
            {([
              { id: "estimated", label: "Calcular" },
              { id: "manual", label: "Preencher" },
            ] as const).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setBasalMetabolicRateSource(option.id)}
                className={`flex-1 rounded-sm border px-4 py-3 text-sm ${
                  basalMetabolicRateSource === option.id
                    ? "border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] text-white"
                    : "border-zinc-800 bg-[rgba(14,14,17,0.96)] text-zinc-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-4">
          <p className="text-sm text-zinc-500">Taxa de metabolismo basal</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {displayedBasalMetabolicRate.toFixed(0)} kcal
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            {basalMetabolicRateSource === "manual"
              ? "Valor manual informado por você."
              : "Estimativa automática com base em peso, altura, idade e sexo biológico."}
          </p>
        </div>
        <MetricInput
          label="Meta basal"
          unit="kcal"
          value={manualBasalMetabolicRate}
          onChange={setManualBasalMetabolicRate}
          helperText="Use este campo apenas se você já souber sua taxa basal."
          step="1"
          min="0"
          disabled={basalMetabolicRateSource !== "manual"}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
        <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-4">
          <p className="text-sm text-zinc-500">Meta de água</p>
          <p className="mt-2 text-xl font-semibold text-white">
            {formatPoints(Math.round(bodyWeightValue * waterPerKgValue))} ml
          </p>
        </div>
        <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-4">
          <p className="text-sm text-zinc-500">Meta de proteína</p>
          <p className="mt-2 text-xl font-semibold text-white">
            {(bodyWeightValue * proteinPerKgValue).toFixed(1)} g
          </p>
        </div>
        <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-4">
          <p className="text-sm text-zinc-500">Meta de carbo</p>
          <p className="mt-2 text-xl font-semibold text-white">
            {(bodyWeightValue * carbsPerKgValue).toFixed(1)} g
          </p>
        </div>
        <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-4">
          <p className="text-sm text-zinc-500">Meta de gordura</p>
          <p className="mt-2 text-xl font-semibold text-white">
            {(bodyWeightValue * fatPerKgValue).toFixed(1)} g
          </p>
        </div>
        <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-4">
          <p className="text-sm text-zinc-500">Meta de fibra</p>
          <p className="mt-2 text-xl font-semibold text-white">
            {resolvedFiberTarget.toFixed(1)} g
          </p>
        </div>
        <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-4">
          <p className="text-sm text-zinc-500">Meta de sódio</p>
          <p className="mt-2 text-xl font-semibold text-white">
            {sodiumTargetValue.toFixed(0)} mg
          </p>
        </div>
        <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-4">
          <p className="text-sm text-zinc-500">Meta calórica</p>
          <p className="mt-2 text-xl font-semibold text-white">
            {adjustedCaloriesTarget} kcal
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            TDEE {tdeeForTargets} kcal (basal{" "}
            {displayedBasalMetabolicRate.toFixed(0)} × {activityMultiplier.toFixed(3)})
            {" "}com {formatGoalAdjustment(targets.goalAdjustmentKcal).toLowerCase()}.
          </p>
        </div>
        <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-4">
          <p className="text-sm text-zinc-500">Calorias pelos macros</p>
          <p className="mt-2 text-xl font-semibold text-white">
            {macroBasedCaloriesTarget} kcal
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Soma de proteína, carboidrato e gordura configurados por kg.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          onApply({
            bodyWeightKg: bodyWeightValue || targets.bodyWeightKg,
            bodyHeightCm: bodyHeightValue || targets.bodyHeightCm,
            ageYears: ageValue || targets.ageYears,
            biologicalSex,
            waterMlPerKg: waterPerKgValue || targets.perKg.waterMl,
            proteinPerKg: proteinPerKgValue || targets.perKg.protein,
            carbsPerKg: carbsPerKgValue || targets.perKg.carbs,
            fatPerKg: fatPerKgValue || targets.perKg.fat,
            fiberStrategy,
            fiberPerKg: fiberPerKgValue || targets.fiberPerKg,
            fiberRatioGrams: fiberRatioGramsValue || targets.fiberRatioGrams,
            fiberRatioCalories:
              fiberRatioCaloriesValue || targets.fiberRatioCalories,
            sodiumTargetMg: sodiumTargetValue || targets.sodiumTargetMg,
            targetWeightKg: targets.weightGoal.targetWeightKg,
            weeklyChangeKg: targets.weightGoal.weeklyChangeKg,
            basalMetabolicRate: displayedBasalMetabolicRate,
            basalMetabolicRateSource,
          });
          setShowSavedToast(true);
        }}
        className="w-full rounded-sm bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-2)_100%)] px-4 py-3 font-semibold text-slate-950"
      >
        Aplicar metas
      </button>
      {showSavedToast && typeof document !== "undefined"
        ? createPortal(
            <div
              role="status"
              aria-live="polite"
              className="fixed left-1/2 top-6 z-[100] -translate-x-1/2 rounded-sm border border-emerald-500/40 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-100 shadow-xl backdrop-blur"
            >
              ✓ Metas salvas com sucesso
            </div>,
            document.body,
          )
        : null}
        </>
      )}
    </>
  );

  // Embedded mode skips the GlassPanel + header + collapse toggle so
  // the parent can stitch this editor next to other content inside a
  // single unified panel without nesting borders.
  if (embedded) {
    return editorBody;
  }

  return (
    <GlassPanel className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">Metas por peso</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">
            Ajuste peso e referência diária
          </h2>
          {!isCollapsed ? (
            <p className="mt-2 text-sm text-zinc-500">
              Defina metas por kg, sódio diário e estratégia de fibra para esta dieta.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-2 text-xs text-zinc-300"
        >
          {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          {isCollapsed ? "Expandir" : "Ocultar"}
        </button>
      </div>
      {editorBody}
    </GlassPanel>
  );
}

export default function NutritionModulePage() {
  const { state, actions } = useAppStore();
  const [dietName, setDietName] = useState("");
  const [dietStartDate, setDietStartDate] = useState("");
  const [dietEndDate, setDietEndDate] = useState("");
  const [dietNotes, setDietNotes] = useState("");
  const [editingDietPlanId, setEditingDietPlanId] = useState<string | null>(null);
  // Unified collapse state: the Meta ativa goal selector and the
  // NutritionTargetsEditor live inside the same GlassPanel now, so one
  // shared flag controls them both. Default closed because both blocks
  // are dense and most users only open them when reconfiguring.
  const [isMetricsPanelCollapsed, setIsMetricsPanelCollapsed] = useState(true);
  // isReferencesCollapsed state removed — the panel it controlled is gone.
  // Macro reference notes used to live as per-card expand panels in
  // Leitura detalhada (expandedMacroNote state). Moved into a static
  // section inside the unified Meta ativa panel, so the state is gone too.
  const [isDietLibraryCollapsed, setIsDietLibraryCollapsed] = useState(false);
  // isCreateDietPanelOpen is reused for the new top-of-page "Nova dieta"
  // inline form. newDietGoal stores the goal preset the user picks for
  // the brand-new plan (initialized lazily once state.nutritionGoal is
  // available — see the effect below if we ever need to reset on switch).
  const [isCreateDietPanelOpen, setIsCreateDietPanelOpen] = useState(false);
  const [newDietGoal, setNewDietGoal] = useState<NutritionGoalId>("maintain");
  // Inline rename for the active diet — pencil button on the header
  // swaps the name h2 for an editable input. Keeping it local (vs the
  // existing dietPlanEditDraft used by the deeper edit form) so the
  // shortcut stays light: name only, no startDate / endDate / notes.
  const [isRenamingActiveDiet, setIsRenamingActiveDiet] = useState(false);
  const [activeDietRenameDraft, setActiveDietRenameDraft] = useState("");
  const [dietPlanEditDraft, setDietPlanEditDraft] = useState({
    name: "",
    startDate: "",
    endDate: "",
    notes: "",
  });
  const [newMealTitle, setNewMealTitle] = useState("");
  const [newMealTime, setNewMealTime] = useState("");
  const [editingMealBlockId, setEditingMealBlockId] = useState<string | null>(null);
  const [mealBlockEditDrafts, setMealBlockEditDrafts] = useState<
    Record<
      string,
      {
        title: string;
        time: string;
        category: MealCategory;
        notes: string;
      }
    >
  >({});
  const [editingMealItemId, setEditingMealItemId] = useState<string | null>(null);
  const [mealItemDrafts, setMealItemDrafts] = useState<
    Record<
      string,
      {
        foodId: string;
        quantityLabel: string;
      }
    >
  >({});
  const [mealItemEditDrafts, setMealItemEditDrafts] = useState<
    Record<
      string,
      {
        label: string;
        quantityLabel: string;
        notes: string;
        protein: string;
        carbs: string;
        fat: string;
        fiber: string;
        sodium: string;
        calories: string;
      }
    >
  >({});
  const [mealFoodLookups, setMealFoodLookups] = useState<Record<string, string>>({});
  const [mealSearchBlockId, setMealSearchBlockId] = useState<string | null>(null);
  // Form local pra adicionar um extra esporádico de hoje (pão de queijo, etc.)
  const [extraDraft, setExtraDraft] = useState({
    label: "",
    quantityLabel: "",
    protein: "",
    carbs: "",
    fat: "",
    fiber: "",
    sodium: "",
    calories: "",
  });
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(true);
  const [manualFoodDrafts, setManualFoodDrafts] = useState<
    Record<string, ManualFoodDraft>
  >({});
  const [manualFoodFormOpenByBlock, setManualFoodFormOpenByBlock] = useState<
    Record<string, boolean>
  >({});
  const [expandedMealBlocks, setExpandedMealBlocks] = useState<Record<string, boolean>>({});
  const [mealFoodComposerOpenByBlock, setMealFoodComposerOpenByBlock] = useState<
    Record<string, boolean>
  >({});
  const [isAddMealPanelOpen, setIsAddMealPanelOpen] = useState(false);
  const [isQuickAddFoodPanelOpen, setIsQuickAddFoodPanelOpen] = useState(false);
  const [libraryFoodDraft, setLibraryFoodDraft] = useState<ManualFoodDraft>(
    createEmptyManualFoodDraft(),
  );
  const [tbcaFoods, setTbcaFoods] = useState<TbcaFoodSearchResult[]>([]);
  const [tbcaSearchStatus, setTbcaSearchStatus] = useState<UsdaSearchStatus>("idle");
  const [tbcaSearchMessage, setTbcaSearchMessage] = useState("");
  const [usdaFoods, setUsdaFoods] = useState<UsdaFoodSearchResult[]>([]);
  const [usdaSearchStatus, setUsdaSearchStatus] =
    useState<UsdaSearchStatus>("idle");
  const [usdaSearchMessage, setUsdaSearchMessage] = useState("");
  const dailyNutritionTargets =
    state.dailyNutritionTargets ?? initialPersistedState.dailyNutritionTargets;
  const dietPlans = useMemo(() => state.dietPlans ?? [], [state.dietPlans]);
  const mealPlan = useMemo(
    () =>
      (state.mealPlan ?? []).map((block) => ({
        ...block,
        items: block.items ?? [],
      })),
    [state.mealPlan],
  );
  const foodDatabase = useMemo(() => state.foodDatabase ?? [], [state.foodDatabase]);
  const tasks = useMemo(() => state.tasks ?? [], [state.tasks]);
  const waterEntries = useMemo(() => state.waterEntries ?? [], [state.waterEntries]);
  const [goalAdjustmentDraftState, setGoalAdjustmentDraftState] = useState(() => ({
    planId: state.activeDietPlanId,
    value: dailyNutritionTargets.goalAdjustmentKcal.toString(),
  }));
  const activeDietPlan =
    dietPlans.find((plan) => plan.id === state.activeDietPlanId) ?? dietPlans[0];
  const activeGoalId =
    activeDietPlan?.nutritionGoal &&
    Object.prototype.hasOwnProperty.call(nutritionGoals, activeDietPlan.nutritionGoal)
      ? activeDietPlan.nutritionGoal
      : state.nutritionGoal &&
          Object.prototype.hasOwnProperty.call(nutritionGoals, state.nutritionGoal)
        ? state.nutritionGoal
        : "maintain";
  const currentGoal = nutritionGoals[activeGoalId] ?? nutritionGoals.maintain;
  const activeMealLookup = mealSearchBlockId ? mealFoodLookups[mealSearchBlockId] ?? "" : "";
  const deferredMealLookup = useDeferredValue(activeMealLookup.trim());
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayWaterConsumed =
    waterEntries.find((entry) => entry.date === todayKey)?.consumedMl ?? 0;
  // Single source of truth for "is this item consumed today?". The reducer
  // wipes both `completed` and `completedAt` on undo, but we trust the
  // *completedAt* timestamp as the authoritative marker — if the date
  // doesn't match today (or completedAt was cleared), the item does NOT
  // contribute to today's consumption, regardless of any stale `completed`
  // boolean. This lets the "Desfazer refeição" block-level action drop
  // the macro percentages immediately.
  const isMealItemConsumedToday = (item: { completed?: boolean; completedAt?: string }) =>
    item.completedAt?.slice(0, 10) === todayKey;
  const consumedDietTotals = useMemo(
    () =>
      mealPlan.reduce(
        (total, block) =>
          block.items.reduce(
            (blockTotal, item) =>
              isMealItemConsumedToday(item)
                ? addMacros(blockTotal, item.macros)
                : blockTotal,
            total,
          ),
        emptyMacros(),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mealPlan, todayKey],
  );
  // Planned totals sum every item in the active meal plan, regardless of
  // completion state. The "Leitura detalhada da meta" panel uses these so
  // freshly added foods show up in the macro readout immediately — user
  // feedback was that items added to refeições weren't reflecting there
  // because the panel was only counting completed items.
  const plannedDietTotals = mealPlan.reduce(
    (total, block) =>
      block.items.reduce(
        (blockTotal, item) => addMacros(blockTotal, item.macros),
        total,
      ),
    emptyMacros(),
  );

  // Extras esporádicos — alimentos consumidos fora do plano, registrados por
  // data. Agrupa por YYYY-MM-DD para mostrar consumo de hoje + histórico.
  const nutritionDailyExtras = state.nutritionDailyExtras ?? [];
  const extrasByDate = useMemo(() => {
    const groups: Record<string, typeof nutritionDailyExtras> = {};
    for (const extra of nutritionDailyExtras) {
      const bucket = groups[extra.date] ?? [];
      bucket.push(extra);
      groups[extra.date] = bucket;
    }
    return groups;
  }, [nutritionDailyExtras]);
  const extrasTodayList = extrasByDate[todayKey] ?? [];
  const extrasTodayTotals = useMemo(
    () =>
      extrasTodayList.reduce(
        (total, extra) => addMacros(total, extra.macros),
        emptyMacros(),
      ),
    [extrasTodayList],
  );
  // Consumo total do dia = items completados hoje no plano + extras do dia
  const consumedTodayTotalsIncludingExtras = useMemo(
    () => addMacros(consumedDietTotals, extrasTodayTotals),
    [consumedDietTotals, extrasTodayTotals],
  );
  // Histórico agregado por data: junta itens completados naquela data +
  // extras daquela data. Lista ordenada do dia mais recente pro mais antigo.
  const nutritionDailyHistory = useMemo(() => {
    const buckets: Record<
      string,
      { date: string; totals: NutritionMacros; itemsCount: number; extrasCount: number }
    > = {};
    for (const block of mealPlan) {
      for (const item of block.items) {
        const dateKey = item.completedAt?.slice(0, 10);
        if (!dateKey) continue;
        const bucket = buckets[dateKey] ?? {
          date: dateKey,
          totals: emptyMacros(),
          itemsCount: 0,
          extrasCount: 0,
        };
        bucket.totals = addMacros(bucket.totals, item.macros);
        bucket.itemsCount += 1;
        buckets[dateKey] = bucket;
      }
    }
    for (const extra of nutritionDailyExtras) {
      const bucket = buckets[extra.date] ?? {
        date: extra.date,
        totals: emptyMacros(),
        itemsCount: 0,
        extrasCount: 0,
      };
      bucket.totals = addMacros(bucket.totals, extra.macros);
      bucket.extrasCount += 1;
      buckets[extra.date] = bucket;
    }
    return Object.values(buckets).sort((left, right) =>
      right.date.localeCompare(left.date),
    );
  }, [mealPlan, nutritionDailyExtras]);
  // completedMealItemsCount removed — its only consumer (the "X itens
  // concluídos" badge on the Leitura detalhada panel header) was deleted
  // along with that header.
  // linkedShoppingItemsByBlock removed — its only consumer (the per-block
  // "Itens vinculados de mercado e suplementos" panel) was deleted at the
  // user's request. Helper function buildLinkedShoppingItemsByBlock stays
  // defined for now in case we wire this surface back in later.

  useEffect(() => {
    if (!mealSearchBlockId || deferredMealLookup.length < 2) return;

    const controller = new AbortController();
    let ignore = false;

    async function runSearch() {
      try {
        setUsdaSearchStatus("loading");
        setUsdaSearchMessage("");
        const response = await fetch(
          `/api/usda-foods/search?q=${encodeURIComponent(deferredMealLookup)}&limit=8`,
          {
            signal: controller.signal,
          },
        );

        const payload = (await response.json()) as
          | { foods: UsdaFoodSearchResult[]; error?: string }
          | undefined;

        if (ignore) return;

        if (!response.ok) {
          setUsdaFoods([]);
          setUsdaSearchStatus(response.status === 503 ? "missing" : "error");
          setUsdaSearchMessage(
            payload?.error ?? "Não foi possível consultar o banco USDA agora.",
          );
          return;
        }

        setUsdaFoods(payload?.foods ?? []);
        setUsdaSearchStatus("ready");
      } catch {
        if (ignore || controller.signal.aborted) return;
        setUsdaFoods([]);
        setUsdaSearchStatus("error");
        setUsdaSearchMessage("Não foi possível consultar o banco USDA agora.");
      }
    }

    runSearch();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [deferredMealLookup, mealSearchBlockId]);

  useEffect(() => {
    if (!mealSearchBlockId || deferredMealLookup.length < 2) return;

    const controller = new AbortController();
    let ignore = false;

    async function runSearch() {
      try {
        setTbcaSearchStatus("loading");
        setTbcaSearchMessage("");
        const response = await fetch(
          `/api/tbca-foods/search?q=${encodeURIComponent(deferredMealLookup)}&limit=8`,
          {
            signal: controller.signal,
          },
        );

        const payload = (await response.json()) as
          | { foods: TbcaFoodSearchResult[]; error?: string }
          | undefined;

        if (ignore) return;

        if (!response.ok) {
          setTbcaFoods([]);
          setTbcaSearchStatus(response.status === 503 ? "missing" : "error");
          setTbcaSearchMessage(
            payload?.error ?? "Não foi possível consultar o banco TBCA agora.",
          );
          return;
        }

        setTbcaFoods(payload?.foods ?? []);
        setTbcaSearchStatus("ready");
      } catch {
        if (ignore || controller.signal.aborted) return;
        setTbcaFoods([]);
        setTbcaSearchStatus("error");
        setTbcaSearchMessage("Não foi possível consultar o banco TBCA agora.");
      }
    }

    runSearch();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [deferredMealLookup, mealSearchBlockId]);

  const effectiveTbcaFoods =
    mealSearchBlockId && deferredMealLookup.length >= 2 ? tbcaFoods : [];
  const effectiveTbcaSearchStatus =
    mealSearchBlockId && deferredMealLookup.length >= 2 ? tbcaSearchStatus : "idle";
  const effectiveTbcaSearchMessage =
    mealSearchBlockId && deferredMealLookup.length >= 2 ? tbcaSearchMessage : "";
  const effectiveUsdaFoods =
    mealSearchBlockId && deferredMealLookup.length >= 2 ? usdaFoods : [];
  const effectiveUsdaSearchStatus =
    mealSearchBlockId && deferredMealLookup.length >= 2 ? usdaSearchStatus : "idle";
  const effectiveUsdaSearchMessage =
    mealSearchBlockId && deferredMealLookup.length >= 2 ? usdaSearchMessage : "";
  const proteinTarget = dailyNutritionTargets.totals.protein;
  const carbsTarget = dailyNutritionTargets.totals.carbs;
  const fatTarget = dailyNutritionTargets.totals.fat;
  const caloriesTarget = dailyNutritionTargets.totals.calories;
  const waterTarget = dailyNutritionTargets.waterMl;
  const goalAdjustmentKcal = dailyNutritionTargets.goalAdjustmentKcal;
  // TDEE breakdown — surfaced in the Meta ativa panel so the user can
  // see how the daily calorie target is being assembled:
  //   BMR × activityMultiplier (from training days/week) + adjustment.
  const activeWorkoutProgramForActivity = state.workoutPrograms.find(
    (program) => program.id === state.activeWorkoutProgramId,
  );
  const trainingDaysPerWeek = activeWorkoutProgramForActivity
    ? activeWorkoutProgramForActivity.workoutPlan.filter((d) => !d.isRestDay)
        .length
    : 0;
  const activityMultiplier =
    getActivityMultiplierFromTrainingDays(trainingDaysPerWeek);
  const tdeeKcal = Math.round(
    dailyNutritionTargets.basalMetabolicRate * activityMultiplier,
  );
  const hydrationTaskSourceKey = "nutrition-hydration-daily";
  const hydrationTaskEntries = useMemo(
    () =>
      tasks.filter(
        (task) =>
          (task.moduleId === "nutrition" &&
            task.title.trim().toLocaleLowerCase("pt-BR").includes("hidratação diária")) ||
          task.sourceKey === hydrationTaskSourceKey,
      ),
    [tasks],
  );
  const syncedHydrationTask = hydrationTaskEntries.find(
    (task) => task.sourceKey === hydrationTaskSourceKey,
  );
  const legacyHydrationTasks = hydrationTaskEntries.filter(
    (task) => task.sourceKey !== hydrationTaskSourceKey,
  );
  const fiberTarget = dailyNutritionTargets.totals.fiber;
  const sodiumTarget = dailyNutritionTargets.sodiumTargetMg;
  const waterQuickActions = [200, 500, 1000];
  const activeDietDuration =
    activeDietPlan?.startDate && activeDietPlan?.endDate
      ? Math.max(
          1,
          Math.ceil(
            (new Date(activeDietPlan.endDate).getTime() -
              new Date(activeDietPlan.startDate).getTime()) /
              (1000 * 60 * 60 * 24),
          ) + 1,
        )
      : null;
  const dietPlanAssignedDays = dietPlans.reduce<Record<string, Weekday[]>>(
    (groups, plan) => {
      groups[plan.id] = weekdayOrder.filter(
        (weekday) => state.dietWeekSchedule[weekday] === plan.id,
      );
      return groups;
    },
    {},
  );
  // dietComparisonItems is back to consumedDietTotals — user only wants
  // the bars to fill after an item is actually marked as Concluído in
  // Missões. plannedDietTotals stays defined above in case we want a
  // separate "planned vs consumed" comparison view later.
  const dietComparisonItems = [
    {
      label: "Proteína",
      current: consumedDietTotals.protein,
      target: proteinTarget,
      unit: "g",
      decimals: 1,
      mode: "target" as const,
    },
    {
      label: "Carboidratos",
      current: consumedDietTotals.carbs,
      target: carbsTarget,
      unit: "g",
      decimals: 1,
      mode: "target" as const,
    },
    {
      label: "Gorduras",
      current: consumedDietTotals.fat,
      target: fatTarget,
      unit: "g",
      decimals: 1,
      mode: "target" as const,
    },
    {
      label: "Fibras",
      current: consumedDietTotals.fiber,
      target: fiberTarget,
      unit: "g",
      decimals: 1,
      mode: "target" as const,
    },
    {
      label: "Sódio",
      current: consumedDietTotals.sodium,
      target: sodiumTarget,
      unit: "mg",
      decimals: 0,
      mode: "limit" as const,
    },
    {
      label: "Calorias",
      current: consumedDietTotals.calories,
      target: caloriesTarget,
      unit: "kcal",
      decimals: 0,
      mode: "target" as const,
    },
  ];
  const goalAdjustmentDraft =
    goalAdjustmentDraftState.planId === state.activeDietPlanId
      ? goalAdjustmentDraftState.value
      : dailyNutritionTargets.goalAdjustmentKcal.toString();

  useEffect(() => {
    legacyHydrationTasks.forEach((task) => {
      actions.removeTask(task.id);
    });

    const hydrationTargetLiters = formatWaterTargetLiters(waterTarget);
    const hydrationTitle = `Hidratação diária: ${hydrationTargetLiters} L de água`;
    const hydrationDescription = `Mantenha seu corpo hidratado consumindo ${formatPoints(
      waterTarget,
    )} ml de água ao longo do dia.`;
    const hydrationProgressLabel = `Sua hidratação está em ${formatPoints(
      Math.min(todayWaterConsumed, waterTarget),
    )}/${formatPoints(waterTarget)} ml.`;
    const hydrationPayload = {
      title: hydrationTitle,
      description: hydrationDescription,
      category: "nutrition" as const,
      moduleId: "nutrition" as const,
      difficulty: "easy" as const,
      recurrence: { kind: "daily" as const },
    };
    const hydrationCompleted = waterTarget > 0 && todayWaterConsumed >= waterTarget;
    const hydrationCompletedAt = hydrationCompleted
      ? syncedHydrationTask?.completed && syncedHydrationTask.completedAt
        ? syncedHydrationTask.completedAt
        : new Date().toISOString()
      : undefined;

    if (!syncedHydrationTask) {
      actions.addTask({
        ...hydrationPayload,
        sourceKey: hydrationTaskSourceKey,
        progressLabel: hydrationProgressLabel,
        completed: hydrationCompleted,
        completedAt: hydrationCompletedAt,
      });
      return;
    }

    const shouldUpdateTask =
      syncedHydrationTask.title !== hydrationTitle ||
      syncedHydrationTask.description !== hydrationDescription ||
      syncedHydrationTask.category !== hydrationPayload.category ||
      syncedHydrationTask.moduleId !== hydrationPayload.moduleId ||
      syncedHydrationTask.difficulty !== hydrationPayload.difficulty ||
      syncedHydrationTask.recurrence.kind !== hydrationPayload.recurrence.kind ||
      syncedHydrationTask.progressLabel !== hydrationProgressLabel ||
      syncedHydrationTask.completed !== hydrationCompleted ||
      syncedHydrationTask.completedAt !== hydrationCompletedAt;

    if (shouldUpdateTask) {
      actions.updateTask({
        taskId: syncedHydrationTask.id,
        patch: {
          ...hydrationPayload,
          progressLabel: hydrationProgressLabel,
          completed: hydrationCompleted,
          completedAt: hydrationCompletedAt,
        },
      });
    }
  }, [
    actions,
    hydrationTaskSourceKey,
    legacyHydrationTasks,
    syncedHydrationTask,
    todayWaterConsumed,
    waterTarget,
  ]);

  function addWater(amountMl: number) {
    actions.setWaterConsumed({
      date: todayKey,
      consumedMl: Math.max(0, todayWaterConsumed + amountMl),
    });
  }

  function updateManualFoodDraft(
    blockId: string,
    patch: Partial<ManualFoodDraft>,
  ) {
    setManualFoodDrafts((current) => ({
      ...current,
      [blockId]: {
        ...(current[blockId] ?? createEmptyManualFoodDraft()),
        ...patch,
      },
    }));
  }

  function openManualFoodForm(blockId: string) {
    setManualFoodFormOpenByBlock((current) => ({
      ...current,
      [blockId]: true,
    }));
    setManualFoodDrafts((current) => ({
      ...current,
      [blockId]:
        current[blockId] ??
        createEmptyManualFoodDraft((mealFoodLookups[blockId] ?? "").trim()),
    }));
  }

  function closeManualFoodForm(blockId: string) {
    setManualFoodFormOpenByBlock((current) => ({
      ...current,
      [blockId]: false,
    }));
  }

  function importUsdaFoodToMeal(
    block: Pick<{ id: string; category: MealCategory }, "id" | "category">,
    food: UsdaFoodSearchResult,
  ) {
    const serving = getDisplayUsdaServingLabel(food.servingLabel);
    const existingFood = foodDatabase.find((item) =>
      isSameFoodEntry(item, {
        name: food.name,
        servingLabel: serving,
        source: "usda",
      }),
    );

    if (existingFood) {
      selectMealFood(block.id, existingFood);
      return;
    }

    const nextFoodId = makeFoodDraftId();
    actions.addCustomFood({
      id: nextFoodId,
      name: food.name,
      servingLabel: serving,
      kind: getFoodKindForMealCategory(block.category),
      source: "usda",
      macros: food.macros,
    });
    updateMealItemDraft(block.id, {
      foodId: nextFoodId,
    });
    setMealFoodLookups((current) => ({
      ...current,
      [block.id]: food.name,
    }));
    setMealSearchBlockId(block.id);
  }

  function importTbcaFoodToMeal(
    block: Pick<{ id: string; category: MealCategory }, "id" | "category">,
    food: TbcaFoodSearchResult,
  ) {
    const existingFood = foodDatabase.find((item) =>
      isSameFoodEntry(item, {
        name: food.name,
        servingLabel: food.servingLabel,
        source: "tbca",
      }),
    );

    if (existingFood) {
      selectMealFood(block.id, existingFood);
      return;
    }

    const nextFoodId = makeFoodDraftId();
    actions.addCustomFood({
      id: nextFoodId,
      name: food.name,
      servingLabel: food.servingLabel,
      kind: getFoodKindForMealCategory(block.category),
      source: "tbca",
      macros: food.macros,
    });
    updateMealItemDraft(block.id, {
      foodId: nextFoodId,
    });
    setMealFoodLookups((current) => ({
      ...current,
      [block.id]: food.name,
    }));
    setMealSearchBlockId(block.id);
  }

  function saveManualFoodForMeal(
    block: Pick<{ id: string; category: MealCategory }, "id" | "category">,
  ) {
    const draft = manualFoodDrafts[block.id] ?? createEmptyManualFoodDraft();
    if (!draft.name.trim() || !draft.servingLabel.trim()) return;

    const trimmedName = draft.name.trim();
    const trimmedServingLabel = draft.servingLabel.trim();
    const existingFood = foodDatabase.find((item) =>
      isSameFoodEntry(item, {
        name: trimmedName,
        servingLabel: trimmedServingLabel,
        source: "custom",
      }),
    );

    if (existingFood) {
      selectMealFood(block.id, existingFood);
      closeManualFoodForm(block.id);
      return;
    }

    const nextFoodId = makeFoodDraftId();
    actions.addCustomFood({
      id: nextFoodId,
      name: trimmedName,
      servingLabel: trimmedServingLabel,
      kind: getFoodKindForMealCategory(block.category),
      source: "custom",
      macros: {
        protein: Number(draft.protein) || 0,
        carbs: Number(draft.carbs) || 0,
        fat: Number(draft.fat) || 0,
        fiber: Number(draft.fiber) || 0,
        sodium: Number(draft.sodium) || 0,
        calories: Number(draft.calories) || 0,
      },
    });
    updateMealItemDraft(block.id, {
      foodId: nextFoodId,
    });
    setMealFoodLookups((current) => ({
      ...current,
      [block.id]: trimmedName,
    }));
    setMealSearchBlockId(block.id);
    closeManualFoodForm(block.id);
    setManualFoodDrafts((current) => ({
      ...current,
      [block.id]: createEmptyManualFoodDraft(),
    }));
  }

  function updateLibraryFoodDraft(patch: Partial<ManualFoodDraft>) {
    setLibraryFoodDraft((current) => ({
      ...current,
      ...patch,
    }));
  }

  function saveLibraryFood() {
    const trimmedName = libraryFoodDraft.name.trim();
    const trimmedServingLabel = libraryFoodDraft.servingLabel.trim();
    if (!trimmedName || !trimmedServingLabel) return;

    const existingFood = foodDatabase.find((item) =>
      isSameFoodEntry(item, {
        name: trimmedName,
        servingLabel: trimmedServingLabel,
        source: "custom",
      }),
    );

    if (existingFood) {
      window.alert("Esse alimento já existe na sua base.");
      return;
    }

    actions.addCustomFood({
      id: makeFoodDraftId(),
      name: trimmedName,
      servingLabel: trimmedServingLabel,
      kind: "food",
      source: "custom",
      macros: {
        protein: Number(libraryFoodDraft.protein) || 0,
        carbs: Number(libraryFoodDraft.carbs) || 0,
        fat: Number(libraryFoodDraft.fat) || 0,
        fiber: Number(libraryFoodDraft.fiber) || 0,
        sodium: Number(libraryFoodDraft.sodium) || 0,
        calories: Number(libraryFoodDraft.calories) || 0,
      },
    });

    setLibraryFoodDraft(createEmptyManualFoodDraft());
    setIsQuickAddFoodPanelOpen(false);
  }

  function startEditingDietPlan() {
    if (!activeDietPlan) return;
    setEditingDietPlanId(activeDietPlan.id);
    setDietPlanEditDraft({
      name: activeDietPlan.name,
      startDate: activeDietPlan.startDate ?? "",
      endDate: activeDietPlan.endDate ?? "",
      notes: activeDietPlan.notes ?? "",
    });
  }

  function cancelDietPlanEdit() {
    setEditingDietPlanId(null);
    setDietPlanEditDraft({
      name: "",
      startDate: "",
      endDate: "",
      notes: "",
    });
  }

  function saveDietPlanEdit() {
    if (!editingDietPlanId || !dietPlanEditDraft.name.trim()) return;
    actions.updateDietPlan({
      planId: editingDietPlanId,
      patch: {
        name: dietPlanEditDraft.name.trim(),
        startDate: dietPlanEditDraft.startDate || undefined,
        endDate: dietPlanEditDraft.endDate || undefined,
        notes: dietPlanEditDraft.notes.trim() || undefined,
      },
    });
    cancelDietPlanEdit();
  }

  function saveCurrentDiet() {
    if (!dietName.trim()) return;
    actions.saveCurrentDietPlan({
      name: dietName.trim(),
      startDate: dietStartDate || undefined,
      endDate: dietEndDate || undefined,
      notes: dietNotes.trim() || undefined,
    });
    setDietName("");
    setDietStartDate("");
    setDietEndDate("");
    setDietNotes("");
  }

  // Creates a brand-new EMPTY diet plan with name + objective and makes
  // it active immediately. The follow-up steps (Estrutura do dia, add
  // food/recipe) all operate against the active plan, so this is the
  // entry point of the creation flow.
  function createNewDietPlan() {
    const trimmedName = dietName.trim();
    if (!trimmedName) return;
    actions.createBlankDietPlan({
      name: trimmedName,
      nutritionGoal: newDietGoal,
    });
    setDietName("");
    setNewDietGoal("maintain");
    setIsCreateDietPanelOpen(false);
  }

  function startRenamingActiveDiet() {
    if (!activeDietPlan) return;
    setActiveDietRenameDraft(activeDietPlan.name);
    setIsRenamingActiveDiet(true);
  }

  function commitActiveDietRename() {
    if (!activeDietPlan) {
      setIsRenamingActiveDiet(false);
      return;
    }
    const trimmed = activeDietRenameDraft.trim();
    if (!trimmed || trimmed === activeDietPlan.name) {
      setIsRenamingActiveDiet(false);
      return;
    }
    actions.updateDietPlan({
      planId: activeDietPlan.id,
      patch: { name: trimmed },
    });
    setIsRenamingActiveDiet(false);
  }

  function cancelActiveDietRename() {
    setIsRenamingActiveDiet(false);
    setActiveDietRenameDraft("");
  }

  function updateMealItemDraft(
    blockId: string,
    patch: Partial<{
      foodId: string;
      quantityLabel: string;
    }>,
  ) {
    setMealItemDrafts((current) => ({
      ...current,
      [blockId]: {
        foodId: current[blockId]?.foodId ?? "",
        quantityLabel: current[blockId]?.quantityLabel ?? "",
        ...patch,
      },
    }));
  }

  function updateMealFoodLookup(blockId: string, value: string) {
    setMealSearchBlockId(blockId);
    setMealFoodLookups((current) => ({
      ...current,
      [blockId]: value,
    }));
    setMealItemDrafts((current) => {
      const draft = current[blockId];
      if (!draft?.foodId) return current;

      const selectedFood = foodDatabase.find((food) => food.id === draft.foodId);
      if (!selectedFood) return current;

      const normalizedValue = normalizeFoodSearchText(value.trim());
      const normalizedSelectedFoodName = normalizeFoodSearchText(selectedFood.name);

      if (normalizedValue === normalizedSelectedFoodName) {
        return current;
      }

      return {
        ...current,
        [blockId]: {
          foodId: "",
          quantityLabel: draft.quantityLabel,
        },
      };
    });
  }

  function selectMealFood(blockId: string, food: FoodDatabaseItem) {
    updateMealItemDraft(blockId, {
      foodId: food.id,
    });
    setMealFoodLookups((current) => ({
      ...current,
      [blockId]: food.name,
    }));
    setManualFoodFormOpenByBlock((current) => ({
      ...current,
      [blockId]: false,
    }));
  }

  function toggleMealBlockExpanded(blockId: string) {
    setExpandedMealBlocks((current) => ({
      ...current,
      [blockId]: !(current[blockId] ?? false),
    }));
  }

  function openMealFoodComposer(blockId: string) {
    setExpandedMealBlocks((current) => ({
      ...current,
      [blockId]: true,
    }));
    setMealFoodComposerOpenByBlock((current) => ({
      ...current,
      [blockId]: true,
    }));
  }

  function addMealBlock() {
    if (!newMealTitle.trim() || !newMealTime) return;
    actions.addMealBlock({
      title: newMealTitle.trim(),
      time: newMealTime,
      category: inferMealCategory(newMealTitle, newMealTime),
    });
    setNewMealTitle("");
    setNewMealTime("");
    setIsAddMealPanelOpen(false);
  }

  function removeMealBlock(blockId: string, title: string) {
    if (!window.confirm(`Excluir a refeição "${title}" da dieta?`)) return;
    actions.removeMealBlock(blockId);
  }

  function startEditingMealBlock(block: {
    id: string;
    title: string;
    time: string;
    category: MealCategory;
    notes?: string;
  }) {
    setEditingMealBlockId(block.id);
    setMealBlockEditDrafts((current) => ({
      ...current,
      [block.id]: {
        title: block.title,
        time: block.time,
        category: block.category,
        notes: block.notes ?? "",
      },
    }));
  }

  function updateMealBlockEditDraft(
    blockId: string,
    patch: Partial<{
      title: string;
      time: string;
      category: MealCategory;
      notes: string;
    }>,
  ) {
    setMealBlockEditDrafts((current) => ({
      ...current,
      [blockId]: {
        title: current[blockId]?.title ?? "",
        time: current[blockId]?.time ?? "",
        category: current[blockId]?.category ?? "lunch",
        notes: current[blockId]?.notes ?? "",
        ...patch,
      },
    }));
  }

  function cancelEditingMealBlock(blockId: string) {
    setEditingMealBlockId((current) => (current === blockId ? null : current));
  }

  function saveMealBlockEdit(blockId: string) {
    const draft = mealBlockEditDrafts[blockId];
    if (!draft || !draft.title.trim() || !draft.time.trim()) return;

    actions.updateMealBlock({
      blockId,
      patch: {
        title: draft.title.trim(),
        time: draft.time,
        category: draft.category,
        notes: draft.notes.trim() || undefined,
      },
    });

    setEditingMealBlockId((current) => (current === blockId ? null : current));
  }

  function applyGoalAdjustment() {
    const nextAdjustment = Math.round(Number(goalAdjustmentDraft) || 0);
    setGoalAdjustmentDraftState({
      planId: state.activeDietPlanId,
      value: nextAdjustment.toString(),
    });
    actions.setNutritionGoalAdjustment(nextAdjustment);
  }

  function startEditingMealItem(item: {
    id: string;
    label: string;
    quantityLabel: string;
    notes?: string;
    macros: {
      protein: number;
      carbs: number;
      fat: number;
      fiber: number;
      sodium: number;
      calories: number;
    };
  }) {
    setEditingMealItemId(item.id);
    setMealItemEditDrafts((current) => ({
      ...current,
      [item.id]: {
        label: item.label,
        quantityLabel: item.quantityLabel,
        notes: item.notes ?? "",
        protein: item.macros.protein.toString(),
        carbs: item.macros.carbs.toString(),
        fat: item.macros.fat.toString(),
        fiber: item.macros.fiber.toString(),
        sodium: item.macros.sodium.toString(),
        calories: item.macros.calories.toString(),
      },
    }));
  }

  function updateMealItemEditDraft(
    itemId: string,
    patch: Partial<{
      label: string;
      quantityLabel: string;
      notes: string;
      protein: string;
      carbs: string;
      fat: string;
      fiber: string;
      sodium: string;
      calories: string;
    }>,
  ) {
    setMealItemEditDrafts((current) => ({
      ...current,
      [itemId]: {
        label: current[itemId]?.label ?? "",
        quantityLabel: current[itemId]?.quantityLabel ?? "",
        notes: current[itemId]?.notes ?? "",
        protein: current[itemId]?.protein ?? "0",
        carbs: current[itemId]?.carbs ?? "0",
        fat: current[itemId]?.fat ?? "0",
        fiber: current[itemId]?.fiber ?? "0",
        sodium: current[itemId]?.sodium ?? "0",
        calories: current[itemId]?.calories ?? "0",
        ...patch,
      },
    }));
  }

  function getScaledMealItemMacros(foodId: string | undefined, quantityLabel: string) {
    if (!foodId || !quantityLabel.trim()) return null;

    const food = foodDatabase.find((item) => item.id === foodId);
    if (!food) return null;

    const scaling = resolveQuantityScaling(food.servingLabel, quantityLabel.trim());
    if (!scaling) return null;

    return scaleNutritionMacros(food.macros, Math.max(0.001, scaling.multiplier));
  }

  function getMealItemDraftMacroPatch(macros: NutritionMacros) {
    return {
      protein: macros.protein.toString(),
      carbs: macros.carbs.toString(),
      fat: macros.fat.toString(),
      fiber: macros.fiber.toString(),
      sodium: macros.sodium.toString(),
      calories: macros.calories.toString(),
    };
  }

  function saveMealItemEdit(blockId: string, itemId: string) {
    const draft = mealItemEditDrafts[itemId];
    if (!draft || !draft.label.trim() || !draft.quantityLabel.trim()) return;

    const currentItem = state.mealPlan
      .find((block) => block.id === blockId)
      ?.items.find((item) => item.id === itemId);
    const scaledMacros = getScaledMealItemMacros(currentItem?.foodId, draft.quantityLabel);

    actions.updateMealItem({
      blockId,
      itemId,
      patch: {
        label: draft.label.trim(),
        quantityLabel: draft.quantityLabel.trim(),
        notes: draft.notes.trim() || undefined,
        macros:
          scaledMacros ??
          {
            protein: Number(draft.protein) || 0,
            carbs: Number(draft.carbs) || 0,
            fat: Number(draft.fat) || 0,
            fiber: Number(draft.fiber) || 0,
            sodium: Number(draft.sodium) || 0,
            calories: Number(draft.calories) || 0,
          },
      },
    });
    setEditingMealItemId(null);
  }

  function addFoodToMeal(blockId: string) {
    const draft = mealItemDrafts[blockId];
    const food = foodDatabase.find((item) => item.id === draft?.foodId);
    if (!food) return;
    if (!draft?.quantityLabel.trim()) {
      window.alert("Informe a quantidade para calcular os macros desse alimento.");
      return;
    }

    const quantityScaling = resolveQuantityScaling(
      food.servingLabel,
      draft?.quantityLabel ?? "",
    );
    if (!quantityScaling) {
      window.alert(
        `Não consegui calcular essa quantidade. Digite só o número ou use o mesmo padrão da base ${getDisplayServingLabel(
          food.servingLabel,
          food.source,
        )}.`,
      );
      return;
    }
    const scaledMacros = scaleNutritionMacros(
      food.macros,
      Math.max(0.001, quantityScaling.multiplier),
    );

    actions.addMealItem({
      blockId,
      foodId: food.id,
      label: food.name,
      quantityLabel: draft.quantityLabel.trim(),
      kind: food.kind,
      macros: scaledMacros,
    });

    setMealItemDrafts((current) => ({
      ...current,
      [blockId]: {
        foodId: "",
        quantityLabel: "",
      },
    }));
    setMealFoodLookups((current) => ({
      ...current,
      [blockId]: "",
    }));
    setMealSearchBlockId((current) => (current === blockId ? null : current));
  }

  const nutritionCompletionTolerance = 0.05;
  const getNutritionProgressPercent = (
    current: number,
    target: number,
    mode: "target" | "limit" = "target",
  ) => {
    if (target <= 0) return 0;
    const ratio = current / target;

    if (mode === "limit") {
      return Math.max(0, Math.min(ratio * 100, 100));
    }

    if (ratio >= 1 - nutritionCompletionTolerance) {
      return 100;
    }

    return Math.max(0, Math.min(ratio * 100, 100));
  };

  const calorieProgress = getNutritionProgressPercent(
    consumedDietTotals.calories,
    caloriesTarget,
  );
  // Per-macro progress vars (proteinProgress / carbsProgress / etc) were
  // removed alongside the deleted "Progresso da meta" panel. The Leitura
  // detalhada cards compute their own percent from current/target inline.
  const waterProgress = waterTarget > 0 ? (todayWaterConsumed / waterTarget) * 100 : 0;
  const mealBlocksCount = mealPlan.length;
  const totalMealItemsCount = mealPlan.reduce(
    (sum, block) => sum + block.items.length,
    0,
  );
  const weeklyPlanAssignmentsCount = weekdayOrder.filter(
    (weekday) => Boolean(state.dietWeekSchedule[weekday]),
  ).length;

  return (
    <div className="space-y-6 pb-32 px-4 max-w-7xl mx-auto pt-4 hud-scanline">
      {state.mealPlan.length === 0 ? (
        <GlassPanel className="border border-[var(--accent)]/30 bg-[var(--accent)]/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="praxis-label text-[var(--accent)]">Plano vazio</p>
              <h3 className="praxis-title mt-1 text-xl">
                Aplicar plano IF 16:8 padrão?
              </h3>
              <p className="mt-1 text-sm leading-6 text-zinc-300">
                Restaura o cardápio base de Cutting Low Carb com Jejum
                Intermitente: Jejum 08h (termogênicos) · Almoço 12h · Pré-treino
                16h · Intra 18:15 · Jantar 19:30 · Pré-sono 19:50. Mantém suas
                metas configuradas e adiciona ao banco os alimentos novos (pão
                de forma, azeite, banana, panqueca) se faltarem.
              </p>
            </div>
            <button
              type="button"
              className="praxis-button shrink-0 px-4 py-2"
              onClick={() => {
                if (
                  window.confirm(
                    "Aplicar o plano IF 16:8 padrão? Isso substitui completamente seu cardápio atual.",
                  )
                ) {
                  actions.restoreDefaultMealPlan();
                }
              }}
            >
              Aplicar plano
            </button>
          </div>
        </GlassPanel>
      ) : null}


      {/* 
        <GlassPanel>
          <p className="text-sm text-zinc-500">Água diária</p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {formatPoints(waterTarget)} ml
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            {dailyNutritionTargets.perKg.waterMl.toFixed(0)} ml/kg corporal
          </p>
        </GlassPanel>
        <GlassPanel>
          <p className="text-sm text-zinc-500">Proteína alvo</p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {proteinTarget.toFixed(1)} g
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            {dailyNutritionTargets.perKg.protein.toFixed(2)} g/kg
          </p>
        </GlassPanel>
        <GlassPanel>
          <p className="text-sm text-zinc-500">Carbo alvo</p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {carbsTarget.toFixed(1)} g
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            {dailyNutritionTargets.perKg.carbs.toFixed(2)} g/kg
          </p>
        </GlassPanel>
        <GlassPanel>
          <p className="text-sm text-zinc-500">Gordura alvo</p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {fatTarget.toFixed(1)} g
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            {dailyNutritionTargets.perKg.fat.toFixed(2)} g/kg
          </p>
        </GlassPanel>
        <GlassPanel>
          <p className="text-sm text-zinc-500">Calorias alvo</p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {caloriesTarget.toFixed(0)} kcal
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Basal {basalMetabolicRate.toFixed(0)} kcal com{" "}
            {formatGoalAdjustment(goalAdjustmentKcal).toLowerCase()}
          </p>
        </GlassPanel>
        <GlassPanel>
          <p className="text-sm text-zinc-500">Peso corporal</p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {dailyNutritionTargets.bodyWeightKg.toFixed(1)} kg
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Suplementos ativos: {supplementCount}
          </p>
        </GlassPanel>
        <GlassPanel>
          <p className="text-sm text-zinc-500">Metabolismo basal</p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {basalMetabolicRate.toFixed(0)} kcal
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            {dailyNutritionTargets.basalMetabolicRateSource === "manual"
              ? "Meta manual"
              : "Estimativa automática"}
          </p>
        </GlassPanel>
      </div>

      */}

      <div className="mod-hero">
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div className="mod-icon" style={{ width: 56, height: 56, borderRadius: 14, fontSize: 24 }}>🍽️</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="praxis-label" style={{ color: "var(--accent)", marginBottom: 4 }}>▸ MÓDULO · NUTRIÇÃO</div>
            <div className="praxis-title" style={{ fontSize: 26 }}>Dieta</div>
          </div>
        </div>
      </div>

      {/* Dieta em edição — sits at the top of the page so the user
          always knows which plan the structure + food-add actions
          below will target. Provides three primitives:
            1. read the active diet's name + objective at a glance
            2. switch active diet (select)
            3. create a brand-new EMPTY diet (name + objective form
               toggled via the "Nova dieta" chip)
          Building the structure (meal blocks) and adding food/recipes
          all happen in the panels below, against the active plan. */}
      <GlassPanel className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
              Dieta em edição
            </p>
            {/* Inline rename: pencil button next to the name swaps the h2
                for an input. Enter / blur saves via updateDietPlan; Esc
                cancels. Pencil is hidden when no diet is active because
                there's nothing to rename yet. */}
            {isRenamingActiveDiet && activeDietPlan ? (
              <div className="mt-1 flex items-center gap-2">
                <input
                  value={activeDietRenameDraft}
                  onChange={(event) => setActiveDietRenameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitActiveDietRename();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      cancelActiveDietRename();
                    }
                  }}
                  onBlur={commitActiveDietRename}
                  autoFocus
                  className="min-w-0 flex-1 rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-3 py-1.5 text-lg font-semibold text-white"
                  aria-label="Nome da dieta"
                />
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={commitActiveDietRename}
                  className="inline-flex items-center justify-center rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-2.5 py-1.5 text-[var(--accent)]"
                  aria-label="Salvar novo nome"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={cancelActiveDietRename}
                  className="inline-flex items-center justify-center rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-2.5 py-1.5 text-zinc-400"
                  aria-label="Cancelar edição do nome"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <h2 className="text-xl font-semibold text-white">
                  {activeDietPlan?.name ?? "Sem dieta criada"}
                </h2>
                {activeDietPlan ? (
                  <button
                    type="button"
                    onClick={startRenamingActiveDiet}
                    className="inline-flex items-center justify-center rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-2 py-1 text-zinc-400 transition hover:border-[rgba(251,146,60,0.24)] hover:text-[var(--accent)]"
                    aria-label="Renomear dieta ativa"
                    title="Renomear dieta"
                  >
                    <PencilLine className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            )}
            <p className="mt-1 text-sm text-zinc-500">
              Objetivo:{" "}
              {nutritionGoals[
                (activeDietPlan?.nutritionGoal ?? state.nutritionGoal) as NutritionGoalId
              ]?.name ?? "Manutenção"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dietPlans.length > 0 ? (
              <select
                value={state.activeDietPlanId ?? ""}
                onChange={(event) => actions.activateDietPlan(event.target.value)}
                className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-2 text-sm text-white"
                aria-label="Trocar dieta ativa"
              >
                {dietPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            ) : null}
            {activeDietPlan ? (
              <button
                type="button"
                onClick={() => actions.duplicateDietPlan(activeDietPlan.id)}
                className="inline-flex items-center gap-1.5 rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-[rgba(251,146,60,0.24)] hover:text-[var(--accent)]"
                title={`Duplicar "${activeDietPlan.name}" como uma nova dieta`}
              >
                <Copy className="h-4 w-4" />
                Duplicar
              </button>
            ) : null}
            {activeDietPlan ? (
              <button
                type="button"
                onClick={() => {
                  const confirmed = window.confirm(
                    `Excluir a dieta "${activeDietPlan.name}"? Essa ação não pode ser desfeita.`,
                  );
                  if (!confirmed) return;
                  actions.removeDietPlan(activeDietPlan.id);
                }}
                className="inline-flex items-center gap-1.5 rounded-sm border border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-sm font-medium text-red-300 transition hover:border-[rgba(239,68,68,0.45)] hover:text-red-200"
                title={`Excluir "${activeDietPlan.name}"`}
              >
                <Trash2 className="h-4 w-4" />
                Excluir
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setIsCreateDietPanelOpen((current) => !current)}
              className="inline-flex items-center gap-1.5 rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-3 py-2 text-sm font-medium text-[var(--accent)]"
            >
              {isCreateDietPanelOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {isCreateDietPanelOpen ? "Fechar" : "Nova dieta"}
            </button>
          </div>
        </div>

        {isCreateDietPanelOpen ? (
          <div className="rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.72)] p-4 space-y-3">
            <p className="text-xs text-zinc-500">
              Comece pela identidade da dieta — depois você adiciona refeições e
              alimentos pelas seções abaixo.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Nome da dieta
                </span>
                <input
                  value={dietName}
                  onChange={(event) => setDietName(event.target.value)}
                  placeholder="Ex.: Cutting Q1 2026"
                  className="w-full rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-3 py-2.5 text-white placeholder:text-zinc-500"
                  autoFocus
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Objetivo
                </span>
                <select
                  value={newDietGoal}
                  onChange={(event) =>
                    setNewDietGoal(event.target.value as NutritionGoalId)
                  }
                  className="w-full rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-3 py-2.5 text-white"
                >
                  {(
                    Object.entries(nutritionGoals) as Array<
                      [NutritionGoalId, (typeof nutritionGoals)[NutritionGoalId]]
                    >
                  ).map(([goalId, goal]) => (
                    <option key={goalId} value={goalId}>
                      {goal.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              onClick={createNewDietPlan}
              disabled={!dietName.trim()}
              className="w-full rounded-sm bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-2)_100%)] px-4 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Criar dieta e ativar
            </button>
          </div>
        ) : null}
      </GlassPanel>

      {/* Plano semanal — compact vertical list of weekdays mapping to a
          diet plan each. Pinned right after the module hero per user
          request: this is the first interaction they want when opening
          nutrition. The richer library UI (create/edit/duplicate
          plans + assigned-days summary) lives further down in another
          edit; only the per-day selector is up here to keep the
          attention surface tight. */}
      <GlassPanel className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-500">Plano semanal</p>
            <h2 className="mt-0.5 text-xl font-semibold text-white">
              Dieta por dia
            </h2>
          </div>
          <span className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-1.5 text-xs text-zinc-300">
            {weeklyPlanAssignmentsCount}/7 dias
          </span>
        </div>
        {/* Horizontal weekday strip — 7 columns reading left-to-right.
            Full weekday names (Segunda / Terca / ...) instead of the
            three-letter abbreviation per user request. Bumped the inner
            min-width to 770px so each cell gets ~110px — comfortable for
            "Segunda" / "Domingo" without needing to scroll on desktop.
            Phones still scroll horizontally below ~770px. */}
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="grid min-w-[770px] grid-cols-7 gap-2">
            {weekdayOrder.map((weekday) => (
              <div
                key={weekday}
                className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] p-2"
              >
                <p className="text-center text-xs font-medium text-zinc-300 capitalize">
                  {weekdayLongLabel(weekday)}
                </p>
                <select
                  value={state.dietWeekSchedule[weekday] ?? activeDietPlan?.id ?? ""}
                  onChange={(event) =>
                    actions.setDietWeekPlan({
                      weekday,
                      planId: event.target.value,
                    })
                  }
                  className="mt-2 w-full rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-1.5 py-1.5 text-xs text-white"
                  aria-label={`Dieta para ${weekdayLongLabel(weekday)}`}
                >
                  {dietPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      </GlassPanel>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 border-l-2 border-tertiary-dim pl-5 pt-4 md:flex-row md:items-end md:justify-between" style={{ display: "none" }}>
          <div className="space-y-1">
            <p className="font-label text-[0.6875rem] uppercase tracking-[0.3em] text-tertiary">
              Protocolo alimentar tático
            </p>
            <h2 className="font-headline text-3xl font-bold tracking-tighter text-on-surface md:text-4xl">
              Registro da dieta
            </h2>
            <p className="text-sm text-zinc-500">
              Biblioteca, metas e refeições no mesmo fluxo.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-sm border border-zinc-800 bg-surface-container-low px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                Meta diária
              </p>
              <p className="mt-2 font-headline text-2xl font-bold text-primary">
                {caloriesTarget.toFixed(0)}
                <span className="ml-1 text-xs text-zinc-500">kcal</span>
              </p>
            </div>
            <div className="rounded-sm border border-zinc-800 bg-surface-container-low px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                Consumido
              </p>
              <p className="mt-2 font-headline text-2xl font-bold text-white">
                {consumedDietTotals.calories.toFixed(0)}
                <span className="ml-1 text-xs text-zinc-500">kcal</span>
              </p>
            </div>
            <div className="rounded-sm border border-zinc-800 bg-surface-container-low px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                Hidratação
              </p>
              <p className="mt-2 font-headline text-2xl font-bold text-white">
                {formatPoints(Math.round(todayWaterConsumed))}
                <span className="ml-1 text-xs text-zinc-500">
                  / {formatPoints(waterTarget)} ml
                </span>
              </p>
            </div>
            <div className="rounded-sm border border-zinc-800 bg-surface-container-low px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                Refeições
              </p>
              <p className="mt-2 font-headline text-2xl font-bold text-white">
                {mealBlocksCount}
                <span className="ml-1 text-xs text-zinc-500">
                  / {totalMealItemsCount} itens
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Hydration strip — user feedback: previous version had buttons
            too thin to tap comfortably and the content drifted to the
            right via ml-auto. Bumped: top label + count row centered;
            quick-add buttons each ~84px tall-equivalent (py-3 px-5,
            text-sm) and laid out in a centered 3-up grid that stacks on
            very narrow phones. */}
        <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-4">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
              Hidratação
            </span>
            <span className="text-base font-semibold text-white">
              {formatPoints(Math.round(todayWaterConsumed))} /{" "}
              {formatPoints(waterTarget)} ml
            </span>
            <span className="rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.08)] px-2 py-0.5 text-[11px] text-[var(--accent)]">
              {Math.round(Math.min(waterProgress, 100))}%
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {waterQuickActions.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => addWater(amount)}
                className="rounded-sm border border-zinc-800 bg-[rgba(18,18,20,0.96)] px-3 py-3 text-sm font-semibold text-zinc-200 transition hover:border-[rgba(251,146,60,0.24)] hover:text-[var(--accent)]"
              >
                +{formatPoints(amount)} ml
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* "Faixas para montar a dieta" + "Progresso da meta" panels were
          removed — macro notes moved inline into Leitura detalhada (with
          per-card expand). Hydration kept above as a thin strip. */}

      <GlassPanel className="space-y-4">
        {/* Header removed — was "Consumo do dia / Leitura detalhada da
            meta" + a "X itens concluídos" pill. The macro grid below
            speaks for itself; the user asked for no preamble here. */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {dietComparisonItems.map((item) => {
            const progress =
              item.mode === "limit"
                ? getNutritionProgressPercent(item.current, item.target, "limit") / 100
                : getNutritionProgressPercent(item.current, item.target) / 100;

            return (
              <div
                key={item.label}
                className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-zinc-500">{item.label}</p>
                  <span className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-2 py-1 text-[11px] text-zinc-300">
                    Meta {item.target.toFixed(item.decimals)} {item.unit}
                  </span>
                </div>
                <p className="mt-2 text-xl font-semibold text-white">
                  {item.current.toFixed(item.decimals)} {item.unit}
                </p>
                <div className="mt-2 h-2 rounded-sm bg-slate-900/80">
                  <div
                    className="h-full rounded-sm bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-2)_100%)]"
                    style={{ width: `${Math.max(progress * 100, 4)}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-zinc-500">
                  {Math.round(progress * 100)}% da meta
                </p>
              </div>
            );
          })}
        </div>
      </GlassPanel>

        <div className="space-y-6">
          <GlassPanel className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-zinc-500">Refeições da dieta</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">
                  Estrutura do dia
                </h2>
                <p className="mt-2 text-sm text-zinc-500">
                  Monte a dieta, ajuste refeições e só expanda o que estiver usando.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  title="Ir para Extras esporádicos (alimentos comidos hoje fora do plano)"
                  onClick={() => {
                    const target =
                      typeof document !== "undefined"
                        ? document.getElementById("extras-esporadicos")
                        : null;
                    target?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }}
                  className="praxis-button px-3 py-2 text-xs uppercase tracking-wider"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar alimento extra
                </button>
                <span className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-2 text-xs text-zinc-300">
                  {mealBlocksCount} refeições
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-zinc-500">Nova refeição</p>
                      <h3 className="mt-1 text-lg font-semibold text-white">
                        Monte a estrutura da dieta
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddMealPanelOpen((current) => !current)}
                      className="inline-flex items-center gap-2 rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.08)] px-4 py-3 text-sm font-medium text-[var(--accent)]"
                    >
                      {isAddMealPanelOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      {isAddMealPanelOpen ? "Fechar formulário" : "Adicionar refeição"}
                    </button>
                  </div>
                  {isAddMealPanelOpen ? (
                    <div className="mt-4 rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.72)] p-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          value={newMealTitle}
                          onChange={(event) => setNewMealTitle(event.target.value)}
                          placeholder="Nome da refeição"
                          className="rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-4 py-3 text-white placeholder:text-zinc-500"
                        />
                        <input
                          value={newMealTime}
                          onChange={(event) => setNewMealTime(event.target.value)}
                          type="time"
                          className="rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-4 py-3 text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={addMealBlock}
                        className="mt-4 w-full rounded-sm bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-2)_100%)] px-4 py-3 font-semibold text-slate-950"
                      >
                        Salvar refeição na dieta
                      </button>
                    </div>
                  ) : null}
                </div>

              </div>

              {mealPlan.map((block) => {
                  const mealBlockEditDraft = mealBlockEditDrafts[block.id] ?? {
                    title: block.title,
                    time: block.time,
                    category: block.category,
                    notes: block.notes ?? "",
                  };
                  const blockTotals = block.items.reduce(
                    (sum, item) => addMacros(sum, item.macros),
                    emptyMacros(),
                  );
                  const draft = mealItemDrafts[block.id] ?? {
                    foodId: "",
                    quantityLabel: "",
                  };
                  const mealFoodLookup = mealFoodLookups[block.id] ?? "";
                  const normalizedMealFoodLookup = normalizeFoodSearchText(
                    mealFoodLookup.trim(),
                  );
                  const manualFoodDraft =
                    manualFoodDrafts[block.id] ??
                    createEmptyManualFoodDraft(mealFoodLookup.trim());
                  const isManualFoodFormOpen = manualFoodFormOpenByBlock[block.id] ?? false;
                  const selectedFood = foodDatabase.find(
                    (food) => food.id === draft.foodId,
                  );
                  const favoriteMealFoods = sortFoodsByRelevance(
                    foodDatabase.filter((food) => Boolean(food.favorite)),
                    "",
                  ).slice(0, 6);
                  const visibleMealFoods = normalizedMealFoodLookup
                    ? sortFoodsByRelevance(
                        foodDatabase.filter((food) =>
                          normalizeFoodSearchText(food.name).includes(
                            normalizedMealFoodLookup,
                          ),
                        ),
                        normalizedMealFoodLookup,
                      ).slice(0, 8)
                    : favoriteMealFoods;
                  const isActiveRemoteSearch =
                    block.id === mealSearchBlockId &&
                    deferredMealLookup.length >= 2 &&
                    normalizeFoodSearchText(deferredMealLookup) === normalizedMealFoodLookup;
                  const visibleTbcaFoods = isActiveRemoteSearch
                    ? effectiveTbcaFoods.filter(
                        (food) =>
                          !foodDatabase.some((item) =>
                            isSameFoodEntry(item, {
                              name: food.name,
                              servingLabel: food.servingLabel,
                              source: "tbca",
                            }),
                          ),
                      )
                    : [];
                  const visibleUsdaFoods = isActiveRemoteSearch
                    ? effectiveUsdaFoods.filter((food) => {
                        const localizedServingLabel = getDisplayUsdaServingLabel(
                          food.servingLabel,
                        );

                        return !foodDatabase.some((item) =>
                          isSameFoodEntry(item, {
                            name: food.name,
                            servingLabel: localizedServingLabel,
                            source: "usda",
                          }),
                        );
                      })
                    : [];
                  const hasUnifiedSearchResults =
                    visibleMealFoods.length > 0 ||
                    visibleTbcaFoods.length > 0 ||
                    visibleUsdaFoods.length > 0;
                  const isMealExpanded = expandedMealBlocks[block.id] ?? false;
                  const isMealFoodComposerOpen =
                    mealFoodComposerOpenByBlock[block.id] ?? false;
                  const isEditingMealBlock = editingMealBlockId === block.id;
                  const mealItemsLabel =
                    block.items.length === 1 ? "1 item" : `${block.items.length} itens`;
                  // Block-level "Concluir refeição" affordance: true only
                  // when every item in the block is already marked done
                  // for today. Uses the same `isMealItemConsumedToday`
                  // helper that drives consumedDietTotals — so the button
                  // state stays in lockstep with the macro percentages.
                  // setMealBlockItemsCompleted toggles all in one shot,
                  // stamping completedAt against today's date.
                  const blockAllCompletedToday =
                    block.items.length > 0 &&
                    block.items.every((item) =>
                      isMealItemConsumedToday(item),
                    );
                  // linkedShoppingItems lookup removed — the "Itens vinculados
                  // de mercado e suplementos" panel that consumed it is gone.
                  const quantityScaling = selectedFood
                    ? resolveQuantityScaling(selectedFood.servingLabel, draft.quantityLabel)
                    : null;
                  const previewMacros = selectedFood
                    ? quantityScaling
                      ? scaleNutritionMacros(selectedFood.macros, quantityScaling.multiplier)
                      : draft.quantityLabel.trim()
                        ? null
                        : selectedFood.macros
                    : null;
                  return (
                    <div
                      key={block.id}
                      className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] p-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-zinc-500">{block.time}</p>
                            <h3 className="mt-1 text-lg font-semibold leading-tight text-white sm:text-xl">
                              {block.title}
                            </h3>
                            {block.notes ? (
                              <p className="mt-2 text-sm text-zinc-500">{block.notes}</p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              isEditingMealBlock
                                ? cancelEditingMealBlock(block.id)
                                : startEditingMealBlock(block)
                            }
                            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-2 text-xs text-zinc-200"
                          >
                            {isEditingMealBlock ? (
                              <X className="h-3.5 w-3.5" />
                            ) : (
                              <PencilLine className="h-3.5 w-3.5" />
                            )}
                            {isEditingMealBlock ? "Cancelar edição" : "Editar refeição"}
                          </button>
                        </div>
                        <div className="flex w-full flex-wrap items-center gap-2">
                          <div className="rounded-sm bg-[rgba(251,146,60,0.12)] px-3 py-2 text-xs text-[var(--accent)]">
                            {mealItemsLabel}
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleMealBlockExpanded(block.id)}
                            aria-expanded={isMealExpanded}
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-2 text-xs text-zinc-200"
                          >
                            {isMealExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                            {isMealExpanded ? "Ocultar alimentos" : "Ver alimentos"}
                          </button>
                          {block.items.length > 0 ? (
                            <button
                              type="button"
                              // Two states only — no half-toggle:
                              //  • Not all done → marks every item complete
                              //    for today (one-way bulk mark; matches
                              //    the earlier fix that stopped the
                              //    partial-state toggle confusion).
                              //  • All done → unmarks every item for today
                              //    in one click, so a misclick is fully
                              //    reversible without having to expand
                              //    the meal and untoggle item-by-item.
                              onClick={() => {
                                actions.setMealBlockItemsCompleted({
                                  blockId: block.id,
                                  completed: !blockAllCompletedToday,
                                  dateKey: todayKey,
                                });
                              }}
                              title={
                                blockAllCompletedToday
                                  ? "Desfazer: remove a marcação de todos os itens deste bloco para hoje"
                                  : "Marcar todos os itens deste bloco como concluídos hoje"
                              }
                              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-sm border px-3 py-2 text-xs transition ${
                                blockAllCompletedToday
                                  ? "border-zinc-800 bg-[rgba(14,14,17,0.96)] text-zinc-400 hover:border-[rgba(239,68,68,0.35)] hover:text-red-300"
                                  : "border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.12)] text-[#a7f3d0] hover:border-[rgba(74,222,128,0.5)]"
                              }`}
                            >
                              {blockAllCompletedToday ? (
                                <X className="h-3.5 w-3.5" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              {blockAllCompletedToday
                                ? "Desfazer refeição"
                                : "Concluir refeição"}
                            </button>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-[var(--accent)]">
                          <span className="rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-3 py-1">
                            P {blockTotals.protein.toFixed(1)}g
                          </span>
                          <span className="rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-3 py-1">
                            C {blockTotals.carbs.toFixed(1)}g
                          </span>
                          <span className="rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-3 py-1">
                            G {blockTotals.fat.toFixed(1)}g
                          </span>
                          <span className="rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-3 py-1">
                            {blockTotals.calories.toFixed(0)} kcal
                          </span>
                        </div>
                      </div>
                      {isEditingMealBlock ? (
                        <div className="mt-4 rounded-sm border border-zinc-800 bg-[rgba(10,10,12,0.72)] p-4">
                          <div className="grid gap-3 md:grid-cols-[1.3fr_0.7fr_0.9fr]">
                            <input
                              value={mealBlockEditDraft.title}
                              onChange={(event) =>
                                updateMealBlockEditDraft(block.id, {
                                  title: event.target.value,
                                })
                              }
                              className="rounded-sm border border-zinc-700 bg-[#09090c] px-3 py-3 text-sm text-white"
                              placeholder="Nome da refeição"
                            />
                            <input
                              type="time"
                              value={mealBlockEditDraft.time}
                              onChange={(event) =>
                                updateMealBlockEditDraft(block.id, {
                                  time: event.target.value,
                                })
                              }
                              className="rounded-sm border border-zinc-700 bg-[#09090c] px-3 py-3 text-sm text-white [color-scheme:dark]"
                            />
                            <select
                              value={mealBlockEditDraft.category}
                              onChange={(event) =>
                                updateMealBlockEditDraft(block.id, {
                                  category: event.target.value as MealCategory,
                                })
                              }
                              className="rounded-sm border border-zinc-700 bg-[#09090c] px-3 py-3 text-sm text-white"
                            >
                              {mealCategoryOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <textarea
                            value={mealBlockEditDraft.notes}
                            onChange={(event) =>
                              updateMealBlockEditDraft(block.id, {
                                notes: event.target.value,
                              })
                            }
                            rows={2}
                            className="mt-3 w-full rounded-sm border border-zinc-700 bg-[#09090c] px-3 py-3 text-sm text-white"
                            placeholder="Observações da refeição"
                          />
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => removeMealBlock(block.id, block.title)}
                              className="inline-flex items-center gap-1 rounded-sm border border-[rgba(251,146,60,0.18)] bg-[rgba(251,146,60,0.08)] px-3 py-2 text-xs text-[var(--accent)]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir refeição
                            </button>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => cancelEditingMealBlock(block.id)}
                              className="inline-flex items-center gap-1 rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-2 text-xs text-zinc-300"
                            >
                              <X className="h-3.5 w-3.5" />
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => saveMealBlockEdit(block.id)}
                              className="inline-flex items-center gap-1 rounded-sm border border-[rgba(251,146,60,0.18)] bg-[rgba(251,146,60,0.08)] px-3 py-2 text-xs text-[var(--accent)]"
                            >
                              <Save className="h-3.5 w-3.5" />
                              Salvar refeição
                            </button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {isMealExpanded ? (
                        <>
                          <div className="mt-4 space-y-3">
                            {block.items.length ? (
                              block.items.map((item) => {
                                const itemCompletedToday = Boolean(
                                  item.completed && item.completedAt?.slice(0, 10) === todayKey,
                                );

                                return (
                          <div
                            key={item.id}
                            className={`rounded-sm border px-4 py-4 ${
                              itemCompletedToday
                                ? "border-[rgba(251,146,60,0.18)] bg-[rgba(251,146,60,0.08)]"
                                : "border-zinc-800 bg-[rgba(7,7,9,0.92)]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p
                                  className={`font-medium ${
                                    itemCompletedToday
                                      ? "text-zinc-500 line-through"
                                      : "text-white"
                                  }`}
                                >
                                  {item.label}
                                </p>
                                <p
                                  className={`mt-1 text-sm ${
                                    itemCompletedToday
                                      ? "text-zinc-500 line-through"
                                      : "text-zinc-500"
                                  }`}
                                >
                                  {item.quantityLabel}
                                  {item.notes ? ` • ${item.notes}` : ""}
                                </p>
                                {itemCompletedToday && item.completedAt ? (
                                  <p className="mt-2 text-xs text-emerald-200/80">
                                    Consumido em{" "}
                                    {new Date(item.completedAt).toLocaleDateString("pt-BR")}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap justify-end gap-2">
                                <span
                                  className={`rounded-sm px-3 py-2 text-xs ${
                                    item.kind === "supplement"
                                      ? "bg-[rgba(251,146,60,0.12)] text-[var(--accent)]"
                                      : "bg-white/8 text-zinc-300"
                                  }`}
                                >
                                  {item.kind === "supplement" ? "Suplemento" : "Alimento"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    actions.toggleMealItemCompleted({
                                      blockId: block.id,
                                      itemId: item.id,
                                    })
                                  }
                                  className={`rounded-sm border px-3 py-2 text-xs ${
                                    itemCompletedToday
                                      ? "border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] text-emerald-100"
                                      : "border-zinc-800 bg-[rgba(14,14,17,0.96)] text-zinc-300"
                                  }`}
                                >
                                  <span className="inline-flex items-center gap-1">
                                    <Check className="h-3.5 w-3.5" />
                                    {itemCompletedToday ? "Consumido" : "Dar check"}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startEditingMealItem(item)}
                                  className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-2 text-xs text-zinc-300"
                                >
                                  <span className="inline-flex items-center gap-1">
                                    <PencilLine className="h-3.5 w-3.5" />
                                    Alterar
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    actions.removeMealItem({
                                      blockId: block.id,
                                      itemId: item.id,
                                    })
                                  }
                                  className="rounded-sm border border-[rgba(251,146,60,0.18)] bg-[rgba(251,146,60,0.08)] px-3 py-2 text-xs text-[var(--accent)]"
                                >
                                  <span className="inline-flex items-center gap-1">
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Excluir
                                  </span>
                                </button>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-300">
                              <span className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-1">
                                P {item.macros.protein}g
                              </span>
                              <span className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-1">
                                C {item.macros.carbs}g
                              </span>
                              <span className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-1">
                                G {item.macros.fat}g
                              </span>
                              <span className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-1">
                                F {item.macros.fiber}g
                              </span>
                              <span className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-1">
                                Na {item.macros.sodium}mg
                              </span>
                              <span className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-1">
                                {item.macros.calories} kcal
                              </span>
                            </div>
                            {editingMealItemId === item.id ? (
                              <div className="mt-4 rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] p-4">
                                <div className="grid gap-3 md:grid-cols-2">
                                  <input
                                    value={mealItemEditDrafts[item.id]?.label ?? ""}
                                    onChange={(event) =>
                                      updateMealItemEditDraft(item.id, {
                                        label: event.target.value,
                                      })
                                    }
                                    placeholder="Nome do alimento"
                                    className="rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-4 py-3 text-white placeholder:text-zinc-500"
                                  />
                                  <input
                                    value={mealItemEditDrafts[item.id]?.quantityLabel ?? ""}
                                    onChange={(event) => {
                                      const nextQuantityLabel = event.target.value;
                                      const scaledMacros = getScaledMealItemMacros(
                                        item.foodId,
                                        nextQuantityLabel,
                                      );

                                      updateMealItemEditDraft(item.id, {
                                        quantityLabel: nextQuantityLabel,
                                        ...(scaledMacros
                                          ? getMealItemDraftMacroPatch(scaledMacros)
                                          : {}),
                                      });
                                    }}
                                    placeholder="Quantidade exibida"
                                    className="rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-4 py-3 text-white placeholder:text-zinc-500"
                                  />
                                  <input
                                    value={mealItemEditDrafts[item.id]?.notes ?? ""}
                                    onChange={(event) =>
                                      updateMealItemEditDraft(item.id, {
                                        notes: event.target.value,
                                      })
                                    }
                                    placeholder="Descrição opcional"
                                    className="rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-4 py-3 text-white placeholder:text-zinc-500 md:col-span-2"
                                  />
                                </div>
                                {item.foodId ? (
                                  <p className="mt-3 text-xs text-zinc-500">
                                    Ao alterar a quantidade, os macros são recalculados
                                    automaticamente com base no alimento da sua base.
                                  </p>
                                ) : null}
                                <div className="mt-3 grid gap-3 md:grid-cols-3">
                                  <input
                                    value={mealItemEditDrafts[item.id]?.protein ?? "0"}
                                    onChange={(event) =>
                                      updateMealItemEditDraft(item.id, {
                                        protein: event.target.value,
                                      })
                                    }
                                    placeholder="Proteína"
                                    className="rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-4 py-3 text-white placeholder:text-zinc-500"
                                  />
                                  <input
                                    value={mealItemEditDrafts[item.id]?.carbs ?? "0"}
                                    onChange={(event) =>
                                      updateMealItemEditDraft(item.id, {
                                        carbs: event.target.value,
                                      })
                                    }
                                    placeholder="Carbo"
                                    className="rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-4 py-3 text-white placeholder:text-zinc-500"
                                  />
                                  <input
                                    value={mealItemEditDrafts[item.id]?.fat ?? "0"}
                                    onChange={(event) =>
                                      updateMealItemEditDraft(item.id, {
                                        fat: event.target.value,
                                      })
                                    }
                                    placeholder="Gordura"
                                    className="rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-4 py-3 text-white placeholder:text-zinc-500"
                                  />
                                  <input
                                    value={mealItemEditDrafts[item.id]?.fiber ?? "0"}
                                    onChange={(event) =>
                                      updateMealItemEditDraft(item.id, {
                                        fiber: event.target.value,
                                      })
                                    }
                                    placeholder="Fibras"
                                    className="rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-4 py-3 text-white placeholder:text-zinc-500"
                                  />
                                  <input
                                    value={mealItemEditDrafts[item.id]?.sodium ?? "0"}
                                    onChange={(event) =>
                                      updateMealItemEditDraft(item.id, {
                                        sodium: event.target.value,
                                      })
                                    }
                                    placeholder="Sódio"
                                    className="rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-4 py-3 text-white placeholder:text-zinc-500"
                                  />
                                  <input
                                    value={mealItemEditDrafts[item.id]?.calories ?? "0"}
                                    onChange={(event) =>
                                      updateMealItemEditDraft(item.id, {
                                        calories: event.target.value,
                                      })
                                    }
                                    placeholder="Calorias"
                                    className="rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-4 py-3 text-white placeholder:text-zinc-500"
                                  />
                                </div>
                                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                                  <button
                                    type="button"
                                    onClick={() => saveMealItemEdit(block.id, item.id)}
                                    className="rounded-sm bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-2)_100%)] px-4 py-3 font-semibold text-slate-950"
                                  >
                                    <span className="inline-flex items-center gap-2">
                                      <Save className="h-4 w-4" />
                                      Salvar alterações
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingMealItemId(null)}
                                    className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-3 font-semibold text-zinc-200"
                                  >
                                    <span className="inline-flex items-center gap-2">
                                      <X className="h-4 w-4" />
                                      Cancelar
                                    </span>
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                                );
                              })
                            ) : (
                              <div className="rounded-sm border border-dashed border-zinc-800 bg-[rgba(7,7,9,0.92)] px-4 py-4 text-sm text-zinc-500">
                                Nenhum alimento nesta refeição ainda.
                              </div>
                            )}
                          </div>

                      {isMealFoodComposerOpen ? (
                        <div className="mt-5 rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.92)] p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-white">Adicionar alimento</p>
                            <p className="mt-1 text-sm text-zinc-500">
                              Escolha um item do banco e informe a quantidade real. Se a base
                              for 100 g e você digitar 10 g, os macros entram na proporção.
                            </p>
                          </div>
                          {selectedFood ? (
                            <span className="rounded-sm bg-white/8 px-3 py-2 text-xs text-zinc-300">
                              Base:{" "}
                              {getDisplayServingLabel(
                                selectedFood.servingLabel,
                                selectedFood.source,
                              )}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-4 space-y-4">
                          <div className="space-y-3">
                            <p className="px-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                              Alimento
                            </p>
                            <div className="relative">
                              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                              <input
                                value={mealFoodLookup}
                                onChange={(event) =>
                                  updateMealFoodLookup(block.id, event.target.value)
                                }
                                placeholder="Digite para pesquisar um alimento"
                                className="w-full rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] py-3 pl-11 pr-4 text-white placeholder:text-zinc-500"
                              />
                            </div>
                            {mealFoodLookup.trim() || visibleMealFoods.length > 0 ? (
                                <div className="max-h-80 overflow-y-auto rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)]">
                                  {false ? visibleMealFoods.map((food) => (
                                    <button
                                      key={food.id}
                                      type="button"
                                      onClick={() => selectMealFood(block.id, food)}
                                      className={`flex w-full items-start justify-between gap-3 border-b border-zinc-900 px-4 py-3 text-left last:border-b-0 ${
                                        draft.foodId === food.id
                                          ? "bg-[rgba(251,146,60,0.12)]"
                                          : "hover:bg-[rgba(18,18,20,0.98)]"
                                      }`}
                                    >
                                      <div>
                                        <p className="font-medium text-white">{food.name}</p>
                                        <p className="mt-1 text-xs text-zinc-500">
                                          {food.kind === "supplement"
                                            ? "Suplemento"
                                            : "Alimento"}{" "}
                                          ? {getFoodSourceLabel(food.source)}
                                        </p>
                                      </div>
                                      {draft.foodId === food.id ? (
                                        <span className="rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-3 py-1 text-[11px] text-[var(--accent)]">
                                          Selecionado
                                        </span>
                                      ) : null}
                                    </button>
                                  )) : visibleMealFoods.map((food) => {
                                    const isSelected = draft.foodId === food.id;

                                    return (
                                      <div
                                        key={food.id}
                                        className={`flex items-start gap-3 border-b border-zinc-900 px-4 py-3 last:border-b-0 ${
                                          isSelected ? "bg-[rgba(251,146,60,0.12)]" : "hover:bg-[rgba(18,18,20,0.98)]"
                                        }`}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => selectMealFood(block.id, food)}
                                          className="flex-1 text-left"
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div>
                                              <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-medium text-white">
                                                  {food.name}
                                                </p>
                                                {food.favorite ? (
                                                  <span className="rounded-sm border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-amber-100">
                                                    Favorito
                                                  </span>
                                                ) : null}
                                              </div>
                                              <p className="mt-1 text-xs text-zinc-500">
                                                Base{" "}
                                                {getDisplayServingLabel(
                                                  food.servingLabel,
                                                  food.source,
                                                )}{" "}
                                                ? {getFoodSourceLabel(food.source)}
                                              </p>
                                            </div>
                                            {isSelected ? (
                                              <span className="rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-3 py-1 text-[11px] text-[var(--accent)]">
                                                Selecionado
                                              </span>
                                            ) : null}
                                          </div>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => actions.toggleFoodFavorite(food.id)}
                                          aria-label={
                                            food.favorite
                                              ? "Remover dos favoritos"
                                              : "Adicionar aos favoritos"
                                          }
                                          title={
                                            food.favorite
                                              ? "Remover dos favoritos"
                                              : "Adicionar aos favoritos"
                                          }
                                          className={`mt-0.5 rounded-sm border p-2 transition ${
                                            food.favorite
                                              ? "border-amber-300/30 bg-amber-300/10 text-amber-300"
                                              : "border-zinc-800 bg-[rgba(18,18,20,0.96)] text-zinc-500 hover:border-zinc-700 hover:text-zinc-200"
                                          }`}
                                        >
                                          <Star
                                            className={`h-4 w-4 ${
                                              food.favorite ? "fill-current" : ""
                                            }`}
                                          />
                                        </button>
                                      </div>
                                    );
                                  })}
                                  {visibleTbcaFoods.map((food) => (
                                    <button
                                      key={`tbca-inline-${food.code}`}
                                      type="button"
                                      onClick={() =>
                                        importTbcaFoodToMeal(
                                          { id: block.id, category: block.category },
                                          food,
                                        )
                                      }
                                      className="flex w-full items-start justify-between gap-3 border-b border-zinc-900 px-4 py-3 text-left last:border-b-0 hover:bg-[rgba(18,18,20,0.98)]"
                                    >
                                      <div>
                                        <p className="font-medium text-white">{food.name}</p>
                                        <p className="mt-1 text-xs text-zinc-500">
                                          Base {food.servingLabel} ? TBCA
                                        </p>
                                        <p className="mt-1 text-[11px] text-slate-600">
                                          {formatTbcaFoodMeta(food)}
                                        </p>
                                      </div>
                                      <span className="rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-3 py-1 text-[11px] text-emerald-100">
                                        Importar
                                      </span>
                                    </button>
                                  ))}
                                  {visibleUsdaFoods.map((food) => (
                                    <button
                                      key={`usda-inline-${food.fdcId}`}
                                      type="button"
                                      onClick={() =>
                                        importUsdaFoodToMeal(
                                          { id: block.id, category: block.category },
                                          food,
                                        )
                                      }
                                      className="flex w-full items-start justify-between gap-3 border-b border-zinc-900 px-4 py-3 text-left last:border-b-0 hover:bg-[rgba(18,18,20,0.98)]"
                                    >
                                      <div>
                                        <p className="font-medium text-white">{food.name}</p>
                                        <p className="mt-1 text-xs text-zinc-500">
                                          Base {getDisplayUsdaServingLabel(food.servingLabel)} ? USDA
                                        </p>
                                        <p className="mt-1 text-[11px] text-slate-600">
                                          {formatUsdaFoodMeta(food)}
                                        </p>
                                      </div>
                                      <span className="rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-3 py-1 text-[11px] text-[var(--accent)]">
                                        Importar
                                      </span>
                                    </button>
                                  ))}
                                  {isActiveRemoteSearch &&
                                  ((effectiveTbcaSearchStatus === "loading" ||
                                    effectiveUsdaSearchStatus === "loading") ? (
                                    <div className="border-b border-zinc-900 px-4 py-3 text-xs text-zinc-500 last:border-b-0">
                                      Buscando mais resultados...
                                    </div>
                                  ) : null)}
                                  {!hasUnifiedSearchResults &&
                                  mealFoodLookup.trim() &&
                                  effectiveTbcaSearchStatus !== "loading" &&
                                  effectiveUsdaSearchStatus !== "loading" ? (
                                    <div className="px-4 py-3 text-xs text-amber-200">
                                      Nenhum alimento encontrado. Cadastre manualmente abaixo.
                                    </div>
                                  ) : null}
                                </div>
                            ) : (
                              <p className="px-1 text-xs text-zinc-500">
                                Digite o nome do alimento para pesquisar. Os seus favoritos
                                vao aparecer aqui como sugestão.
                              </p>
                            )}
                            {isActiveRemoteSearch &&
                            ((effectiveTbcaSearchStatus === "missing" ||
                              effectiveTbcaSearchStatus === "error") ? (
                              <p className="px-1 text-xs text-amber-200">
                                {effectiveTbcaSearchMessage}
                              </p>
                            ) : null)}
                            {isActiveRemoteSearch &&
                            ((effectiveUsdaSearchStatus === "missing" ||
                              effectiveUsdaSearchStatus === "error") ? (
                              <p className="px-1 text-xs text-amber-200">
                                {effectiveUsdaSearchMessage}
                              </p>
                            ) : null)}
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => openManualFoodForm(block.id)}
                                className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-2 text-sm text-zinc-200"
                              >
                                  Cadastrar alimento manualmente
                              </button>
                              {isManualFoodFormOpen ? (
                                <button
                                  type="button"
                                  onClick={() => closeManualFoodForm(block.id)}
                                  className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-2 text-sm text-zinc-500"
                                >
                                  Fechar cadastro
                                </button>
                              ) : null}
                            </div>
                            {selectedFood ? (
                              <p className="px-1 text-xs text-zinc-500">
                                Selecionado: {selectedFood.name} ? Base{" "}
                                {getDisplayServingLabel(
                                  selectedFood.servingLabel,
                                  selectedFood.source,
                                )}
                              </p>
                            ) : null}
                          </div>

                          {isManualFoodFormOpen ? (
                            <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] p-4">
                              <p className="font-medium text-white">Cadastrar alimento manualmente</p>
                              <p className="mt-1 text-sm text-zinc-500">
                                Cadastre a base nutricional do item e depois informe a
                                quantidade logo abaixo.
                              </p>
                              <div className="mt-4 grid gap-3 md:grid-cols-2">
                                <input
                                  value={manualFoodDraft.name}
                                  onChange={(event) =>
                                    updateManualFoodDraft(block.id, {
                                      name: event.target.value,
                                    })
                                  }
                                  placeholder="Nome do alimento"
                                  className="rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-4 py-3 text-white placeholder:text-zinc-500"
                                />
                                <input
                                  value={manualFoodDraft.servingLabel}
                                  onChange={(event) =>
                                    updateManualFoodDraft(block.id, {
                                      servingLabel: event.target.value,
                                    })
                                  }
                                  placeholder="Base nutricional, ex.: 100 g"
                                  className="rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-4 py-3 text-white placeholder:text-zinc-500"
                                />
                              </div>
                              <div className="mt-4 grid gap-4 md:grid-cols-3">
                                <MetricInput
                                  label="Proteína"
                                  unit="g"
                                  value={manualFoodDraft.protein}
                                  onChange={(value) =>
                                    updateManualFoodDraft(block.id, { protein: value })
                                  }
                                  step="0.1"
                                  min="0"
                                />
                                <MetricInput
                                  label="Carboidratos"
                                  unit="g"
                                  value={manualFoodDraft.carbs}
                                  onChange={(value) =>
                                    updateManualFoodDraft(block.id, { carbs: value })
                                  }
                                  step="0.1"
                                  min="0"
                                />
                                <MetricInput
                                  label="Gorduras"
                                  unit="g"
                                  value={manualFoodDraft.fat}
                                  onChange={(value) =>
                                    updateManualFoodDraft(block.id, { fat: value })
                                  }
                                  step="0.1"
                                  min="0"
                                />
                                <MetricInput
                                  label="Fibras"
                                  unit="g"
                                  value={manualFoodDraft.fiber}
                                  onChange={(value) =>
                                    updateManualFoodDraft(block.id, { fiber: value })
                                  }
                                  step="0.1"
                                  min="0"
                                />
                                <MetricInput
                                  label="Sódio"
                                  unit="mg"
                                  value={manualFoodDraft.sodium}
                                  onChange={(value) =>
                                    updateManualFoodDraft(block.id, { sodium: value })
                                  }
                                  step="1"
                                  min="0"
                                />
                                <MetricInput
                                  label="Calorias"
                                  unit="kcal"
                                  value={manualFoodDraft.calories}
                                  onChange={(value) =>
                                    updateManualFoodDraft(block.id, { calories: value })
                                  }
                                  step="1"
                                  min="0"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  saveManualFoodForMeal({
                                    id: block.id,
                                    category: block.category,
                                  })
                                }
                                className="mt-4 w-full rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-4 py-3 font-semibold text-[var(--accent)]"
                              >
                                Salvar alimento manual e selecionar
                              </button>
                            </div>
                          ) : null}

                          <div className="space-y-2">
                            <p className="px-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                              Quantidade
                            </p>
                            <input
                              value={draft.quantityLabel}
                              onChange={(event) =>
                                updateMealItemDraft(block.id, {
                                  quantityLabel: event.target.value,
                                })
                              }
                              placeholder="Ex.: 10, 250 ou 2"
                              className="w-full rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-4 py-3 text-white placeholder:text-zinc-500"
                            />
                          </div>
                        </div>

                        {selectedFood && previewMacros ? (
                          <div className="mt-4 rounded-sm border border-[rgba(251,146,60,0.16)] bg-[rgba(251,146,60,0.08)] p-4">
                            <div className="flex flex-wrap gap-2 text-xs text-[var(--accent)]">
                              <span className="rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-3 py-1">
                                Proteína {previewMacros.protein}g
                              </span>
                              <span className="rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-3 py-1">
                                Carboidratos {previewMacros.carbs}g
                              </span>
                              <span className="rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-3 py-1">
                                Gorduras {previewMacros.fat}g
                              </span>
                              <span className="rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-3 py-1">
                                Fibra {previewMacros.fiber}g
                              </span>
                              <span className="rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-3 py-1">
                                Sódio {previewMacros.sodium}mg
                              </span>
                              <span className="rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-3 py-1">
                                Calorias {previewMacros.calories} kcal
                              </span>
                            </div>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => addFoodToMeal(block.id)}
                          disabled={!selectedFood || !quantityScaling}
                          className={`mt-4 w-full rounded-sm px-4 py-3 font-semibold ${
                            !selectedFood || !quantityScaling
                              ? "cursor-not-allowed border border-zinc-800 bg-[rgba(14,14,17,0.96)] text-zinc-500"
                              : "border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] text-[var(--accent)]"
                          }`}
                        >
                          Adicionar alimento nesta refeição
                        </button>
                        </div>
                      ) : (
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.92)] p-3">
                          <div>
                            <p className="font-medium text-white">Adicionar alimento</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => openMealFoodComposer(block.id)}
                            className="inline-flex items-center gap-2 rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.08)] px-3 py-2.5 text-sm font-medium text-[var(--accent)]"
                          >
                            <Plus className="h-4 w-4" />
                            Adicionar alimento
                          </button>
                        </div>
                      )}
                      {/* "Itens vinculados de mercado e suplementos" panel
                          removed per user request. It showed the cross-module
                          link between Mercado / Suplementos items and the
                          meal block, but added a permanent "0 vinculados"
                          empty state for users who don't use those modules.
                          The linkage still exists in the data — just no
                          longer rendered here. */}
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
          </GlassPanel>
        </div>
      {/* Outer 2-col grid removed — only one column remained after the
          Biblioteca library panel was extracted into the compact
          "Plano semanal" block at the top of the page. */}

      {/* Total do cardápio — soma de todos os itens das refeições configuradas.
          Tem objetivo diferente da tabela "Meta de X" do editor: aquela mostra
          o que VOCÊ DEFINIU como meta; esta mostra o que a DIETA MONTADA
          oferece. A comparação entre as duas indica se o cardápio está
          aderente à meta. */}
      <GlassPanel className="space-y-4">
        <div>
          <p className="text-sm text-zinc-500">Resumo do cardápio</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">
            Total dos macros da dieta
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Soma dos itens em todas as refeições do plano. Compare com a meta
            diária pra ver se o cardápio bate seus objetivos.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[
            { label: "Proteína", value: plannedDietTotals.protein, target: dailyNutritionTargets.totals.protein, unit: "g" },
            { label: "Carboidrato", value: plannedDietTotals.carbs, target: dailyNutritionTargets.totals.carbs, unit: "g" },
            { label: "Gordura", value: plannedDietTotals.fat, target: dailyNutritionTargets.totals.fat, unit: "g" },
            { label: "Fibra", value: plannedDietTotals.fiber, target: dailyNutritionTargets.totals.fiber, unit: "g" },
            { label: "Sódio", value: plannedDietTotals.sodium, target: dailyNutritionTargets.totals.sodium, unit: "mg" },
            { label: "Calorias", value: plannedDietTotals.calories, target: dailyNutritionTargets.totals.calories, unit: "kcal" },
          ].map((card) => {
            const pct = card.target > 0 ? (card.value / card.target) * 100 : 0;
            const diff = card.value - card.target;
            const tone =
              Math.abs(pct - 100) <= 5
                ? "text-emerald-300"
                : pct < 95
                  ? "text-amber-300"
                  : "text-orange-300";
            return (
              <div
                key={card.label}
                className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-4"
              >
                <p className="text-sm text-zinc-500">{card.label}</p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {card.value.toFixed(card.unit === "kcal" || card.unit === "mg" ? 0 : 1)} {card.unit}
                </p>
                <p className={`mt-2 text-xs ${tone}`}>
                  {pct.toFixed(0)}% da meta ({card.target.toFixed(card.unit === "kcal" || card.unit === "mg" ? 0 : 1)} {card.unit})
                  {" · "}
                  {diff >= 0 ? "+" : ""}
                  {diff.toFixed(card.unit === "kcal" || card.unit === "mg" ? 0 : 1)}
                </p>
              </div>
            );
          })}
        </div>
      </GlassPanel>

      {/* "Extras esporádicos" + "Histórico da dieta" (era "Consumo por
          dia") foram movidos pra DEPOIS do bloco "Meta ativa · Referência
          diária" a pedido do usuário. Ver fim do arquivo. */}

      {/* Unified "Meta ativa + Referência diária" panel — both halves
          used to live in their own GlassPanels inside a 2-col grid.
          User requested they collapse into a single section at the
          bottom of the page so the configuration surface stays in one
          place. Single shared collapse state (isMetricsPanelCollapsed)
          drives both pieces; NutritionTargetsEditor renders in embedded
          mode so we don't end up with nested panel borders. */}
      <GlassPanel className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500">Configuração da meta</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">
              Meta ativa · Referência diária
            </h2>
            {!isMetricsPanelCollapsed ? (
              <p className="mt-2 text-sm text-zinc-500">
                Escolha o objetivo corporal e ajuste pesos, faixas e
                referências da dieta no mesmo lugar.
              </p>
            ) : null}
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
              {currentGoal.name} · Aplicado à dieta: {activeDietPlan?.name ?? "Dieta atual"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsMetricsPanelCollapsed((current) => !current)}
            className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-2 text-xs text-zinc-300"
          >
            {isMetricsPanelCollapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
            {isMetricsPanelCollapsed ? "Expandir" : "Ocultar"}
          </button>
        </div>

        {isMetricsPanelCollapsed ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-3">
              <p className="text-sm text-zinc-500">Meta ativa</p>
              <p className="mt-1 text-base font-semibold text-white">
                {currentGoal.name}
              </p>
            </div>
            <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-3">
              <p className="text-sm text-zinc-500">Calorias alvo</p>
              <p className="mt-1 text-base font-semibold text-white">
                {caloriesTarget.toFixed(0)} kcal
              </p>
            </div>
            <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-3">
              <p className="text-sm text-zinc-500">Peso</p>
              <p className="mt-1 text-base font-semibold text-white">
                {dailyNutritionTargets.bodyWeightKg.toFixed(1)} kg
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Order swapped per user request: "Ajuste de peso e
                referência diária" now comes first, "Objetivo corporal"
                comes after. The reasoning is that body metrics +
                per-kg targets are the foundation users tune first;
                the goal preset on top of that is a quicker pivot. */}

            {/* SECTION 1 — Ajuste de peso e referência diária (embedded
                NutritionTargetsEditor, no inner panel/header/toggle). */}
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
                Ajuste de peso e referência diária
              </p>
              <NutritionTargetsEditor
                activityMultiplier={activityMultiplier}
                key={`nutrition-targets-${state.activeDietPlanId}-${dailyNutritionTargets.bodyWeightKg}-${dailyNutritionTargets.goalAdjustmentKcal}-${dailyNutritionTargets.perKg.waterMl}-${dailyNutritionTargets.perKg.protein}-${dailyNutritionTargets.perKg.carbs}-${dailyNutritionTargets.perKg.fat}-${dailyNutritionTargets.fiberStrategy}-${dailyNutritionTargets.fiberPerKg}-${dailyNutritionTargets.fiberRatioGrams}-${dailyNutritionTargets.fiberRatioCalories}-${dailyNutritionTargets.sodiumTargetMg}`}
                targets={dailyNutritionTargets}
                onApply={actions.updateNutritionTargets}
                isCollapsed={false}
                onToggle={() => undefined}
                embedded
              />
            </div>

            {/* Divider between the two integrated sections */}
            <div className="border-t border-zinc-800" />

            {/* SECTION 2 — Objetivo corporal (goal selector + adjustment) */}
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
                Objetivo corporal
              </p>

              {/* Calorie breakdown: shows how the final daily target is
                  assembled — BMR pulled from body metrics, × multiplier
                  from the user's active workout program (training days
                  per week), + the cut/bulk adjustment from goal. */}
              <div className="rounded-sm border border-zinc-800 bg-[rgba(10,10,12,0.72)] p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  Como a meta é calculada
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-4 text-sm">
                  <div>
                    <p className="text-[11px] text-zinc-500">BMR (basal)</p>
                    <p className="mt-0.5 font-semibold text-white">
                      {dailyNutritionTargets.basalMetabolicRate} kcal
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-zinc-500">
                      Treinos/semana
                    </p>
                    <p className="mt-0.5 font-semibold text-white">
                      {trainingDaysPerWeek}{" "}
                      <span className="text-xs font-normal text-zinc-400">
                        × {activityMultiplier.toFixed(3)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[10px] leading-tight text-zinc-500">
                      {describeTrainingActivity(trainingDaysPerWeek)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-zinc-500">TDEE</p>
                    <p className="mt-0.5 font-semibold text-white">
                      {tdeeKcal} kcal
                    </p>
                    <p className="mt-0.5 text-[10px] text-zinc-500">
                      Ajuste {goalAdjustmentKcal > 0 ? "+" : ""}
                      {goalAdjustmentKcal}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[var(--accent)]">
                      Meta diária
                    </p>
                    <p className="mt-0.5 text-base font-semibold text-[var(--accent)]">
                      {caloriesTarget} kcal
                    </p>
                  </div>
                </div>
                {!activeWorkoutProgramForActivity ? (
                  <p className="mt-2 text-[11px] leading-snug text-zinc-500">
                    Sem treino ativo — assumindo sedentário (× 1.20). Crie e
                    ative um programa em Treino para refinar o cálculo.
                  </p>
                ) : null}
              </div>

              <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] p-4">
                <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)_auto] md:items-end">
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                      Ajuste da meta
                    </span>
                    <input
                      value={goalAdjustmentDraft}
                      onChange={(event) =>
                        setGoalAdjustmentDraftState({
                          planId: state.activeDietPlanId,
                          value: event.target.value,
                        })
                      }
                      type="number"
                      step="1"
                      className="w-full rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-3 py-2.5 text-white"
                    />
                  </label>
                  <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-2.5">
                    <p className="text-sm text-zinc-300">
                      Meta final: {caloriesTarget.toFixed(0)} kcal/dia
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Negativo = déficit. Positivo = superávit.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={applyGoalAdjustment}
                    className="rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-4 py-2.5 text-sm font-medium text-[var(--accent)]"
                  >
                    Fixar ajuste
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {(Object.entries(nutritionGoals) as Array<
                  [NutritionGoalId, (typeof nutritionGoals)[NutritionGoalId]]
                >).map(([goalId, goal]) => (
                  <button
                    key={goalId}
                    type="button"
                    onClick={() => {
                      setGoalAdjustmentDraftState({
                        planId: state.activeDietPlanId,
                        value: nutritionGoals[goalId].defaultAdjustmentKcal.toString(),
                      });
                      actions.setNutritionGoal(goalId);
                    }}
                    className={`rounded-sm border px-4 py-3 text-left ${
                      state.nutritionGoal === goalId
                        ? "border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)]"
                        : "border-zinc-800 bg-[rgba(14,14,17,0.96)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-white">{goal.name}</p>
                        <p className="mt-1.5 text-sm leading-snug text-zinc-500">
                          {goal.description}
                        </p>
                      </div>
                      <span className="max-w-[120px] rounded-sm bg-white/8 px-2 py-1.5 text-[11px] leading-tight text-zinc-300">
                        {goal.recommendation}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Divider before the reference notes */}
            <div className="border-t border-zinc-800" />

            {/* SECTION 3 — Faixas de referência (the macro guidance notes
                that used to live as per-card expand panels in Leitura
                detalhada). Pulled together as a single reference block
                here next to where the user is editing the targets. */}
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
                Faixas de referência
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {Object.entries(nutritionMacroNotes).map(([label, note]) => (
                  <div
                    key={label}
                    className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-2"
                  >
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      {label}
                    </p>
                    <p className="mt-1 text-xs leading-snug text-zinc-400">
                      {note}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </GlassPanel>

      {/* Extras esporádicos — vem DEPOIS do painel "Meta ativa" a
          pedido do usuário. id="extras-esporadicos" é alvo do botão
          "Adicionar extra" no header da seção "Estrutura do dia".
          scroll-mt-24 dá folga pro header sticky não cobrir o título. */}
      <GlassPanel id="extras-esporadicos" className="scroll-mt-24 space-y-4">
        <div>
          <p className="text-sm text-zinc-500">Consumo extra de hoje</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">
            Extras esporádicos
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Adicione aqui qualquer coisa que comeu HOJE fora do plano. Não vira
            parte do cardápio-padrão, mas conta no consumo do dia e fica no
            histórico.
          </p>
        </div>

        {extrasTodayList.length > 0 ? (
          <div className="space-y-2">
            {extrasTodayList.map((extra) => (
              <div
                key={extra.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">
                    {extra.label}{" "}
                    <span className="font-normal text-zinc-500">
                      · {extra.quantityLabel}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {extra.macros.protein.toFixed(1)}P · {extra.macros.carbs.toFixed(1)}C · {extra.macros.fat.toFixed(1)}F · {extra.macros.calories.toFixed(0)} kcal
                  </p>
                </div>
                <button
                  type="button"
                  className="praxis-button-ghost px-3 py-1.5 text-xs text-red-300 hover:text-red-100"
                  onClick={() => actions.removeNutritionDailyExtra(extra.id)}
                >
                  Remover
                </button>
              </div>
            ))}
            <div className="rounded-sm border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-4 py-3 text-sm text-zinc-200">
              <span className="text-zinc-500">Subtotal extras: </span>
              <span className="font-semibold text-white">
                {extrasTodayTotals.protein.toFixed(1)}P · {extrasTodayTotals.carbs.toFixed(1)}C · {extrasTodayTotals.fat.toFixed(1)}F · {extrasTodayTotals.calories.toFixed(0)} kcal
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            Nenhum extra adicionado hoje.
          </p>
        )}

        <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] p-4 space-y-3">
          <p className="text-sm font-semibold text-zinc-300">
            Adicionar extra ao dia
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Nome</span>
              <input
                type="text"
                placeholder="Ex: Pão de queijo"
                value={extraDraft.label}
                onChange={(e) => setExtraDraft({ ...extraDraft, label: e.target.value })}
                className="praxis-field w-full px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Quantidade</span>
              <input
                type="text"
                placeholder="Ex: 1 unidade · 40g"
                value={extraDraft.quantityLabel}
                onChange={(e) => setExtraDraft({ ...extraDraft, quantityLabel: e.target.value })}
                className="praxis-field w-full px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Calorias (kcal)</span>
              <input
                type="number"
                step="1"
                placeholder="0"
                value={extraDraft.calories}
                onChange={(e) => setExtraDraft({ ...extraDraft, calories: e.target.value })}
                className="praxis-field w-full px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Proteína (g)</span>
              <input
                type="number"
                step="0.1"
                placeholder="0"
                value={extraDraft.protein}
                onChange={(e) => setExtraDraft({ ...extraDraft, protein: e.target.value })}
                className="praxis-field w-full px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Carbo (g)</span>
              <input
                type="number"
                step="0.1"
                placeholder="0"
                value={extraDraft.carbs}
                onChange={(e) => setExtraDraft({ ...extraDraft, carbs: e.target.value })}
                className="praxis-field w-full px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Gordura (g)</span>
              <input
                type="number"
                step="0.1"
                placeholder="0"
                value={extraDraft.fat}
                onChange={(e) => setExtraDraft({ ...extraDraft, fat: e.target.value })}
                className="praxis-field w-full px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Fibra (g)</span>
              <input
                type="number"
                step="0.1"
                placeholder="0"
                value={extraDraft.fiber}
                onChange={(e) => setExtraDraft({ ...extraDraft, fiber: e.target.value })}
                className="praxis-field w-full px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Sódio (mg)</span>
              <input
                type="number"
                step="1"
                placeholder="0"
                value={extraDraft.sodium}
                onChange={(e) => setExtraDraft({ ...extraDraft, sodium: e.target.value })}
                className="praxis-field w-full px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button
              type="button"
              className="praxis-button-ghost px-3 py-1.5 text-xs"
              onClick={() =>
                setExtraDraft({
                  label: "",
                  quantityLabel: "",
                  protein: "",
                  carbs: "",
                  fat: "",
                  fiber: "",
                  sodium: "",
                  calories: "",
                })
              }
            >
              Limpar
            </button>
            <button
              type="button"
              className="praxis-button px-4 py-2"
              disabled={!extraDraft.label.trim()}
              onClick={() => {
                if (!extraDraft.label.trim()) return;
                actions.addNutritionDailyExtra({
                  label: extraDraft.label.trim(),
                  quantityLabel: extraDraft.quantityLabel.trim() || "1 unidade",
                  kind: "food",
                  macros: {
                    protein: Number(extraDraft.protein) || 0,
                    carbs: Number(extraDraft.carbs) || 0,
                    fat: Number(extraDraft.fat) || 0,
                    fiber: Number(extraDraft.fiber) || 0,
                    sodium: Number(extraDraft.sodium) || 0,
                    calories: Number(extraDraft.calories) || 0,
                  },
                });
                setExtraDraft({
                  label: "",
                  quantityLabel: "",
                  protein: "",
                  carbs: "",
                  fat: "",
                  fiber: "",
                  sodium: "",
                  calories: "",
                });
              }}
            >
              Adicionar ao dia
            </button>
          </div>
        </div>

        <div className="rounded-sm border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-4 py-3">
          <p className="text-sm font-semibold text-white">
            Consumo total do dia (plano completado + extras)
          </p>
          <p className="mt-2 text-sm text-zinc-200">
            {consumedTodayTotalsIncludingExtras.protein.toFixed(1)}P · {consumedTodayTotalsIncludingExtras.carbs.toFixed(1)}C · {consumedTodayTotalsIncludingExtras.fat.toFixed(1)}F · {consumedTodayTotalsIncludingExtras.fiber.toFixed(1)} fibra · {consumedTodayTotalsIncludingExtras.calories.toFixed(0)} kcal
          </p>
        </div>
      </GlassPanel>

      {/* Histórico da dieta — agrega items completados + extras por
          data. Renomeado de "Consumo por dia" e movido pra última
          posição da página. */}
      <GlassPanel className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-500">Consumo por dia</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">
              Histórico da dieta
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Cada linha agrega itens marcados como concluídos naquele dia + extras adicionados na mesma data.
            </p>
          </div>
          <button
            type="button"
            className="praxis-button-ghost shrink-0 px-3 py-1.5 text-xs"
            onClick={() => setIsHistoryCollapsed((current) => !current)}
          >
            {isHistoryCollapsed ? "Mostrar" : "Ocultar"}
          </button>
        </div>
        {!isHistoryCollapsed ? (
          nutritionDailyHistory.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Sem registros ainda. Marque refeições como concluídas ou adicione extras pra construir o histórico.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-sm border border-zinc-800">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-700 bg-zinc-900 text-left text-[11px] uppercase tracking-wider text-zinc-400">
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2 text-right">P (g)</th>
                    <th className="px-3 py-2 text-right">C (g)</th>
                    <th className="px-3 py-2 text-right">F (g)</th>
                    <th className="px-3 py-2 text-right">Fibra</th>
                    <th className="px-3 py-2 text-right">kcal</th>
                    <th className="px-3 py-2 text-right">Itens · Extras</th>
                  </tr>
                </thead>
                <tbody>
                  {nutritionDailyHistory.map((entry) => {
                    const targetCal = dailyNutritionTargets.totals.calories || 1;
                    const pct = (entry.totals.calories / targetCal) * 100;
                    const tone =
                      Math.abs(pct - 100) <= 8
                        ? "text-emerald-300"
                        : pct < 92
                          ? "text-amber-300"
                          : "text-orange-300";
                    return (
                      <tr
                        key={entry.date}
                        className="border-b border-zinc-800/60 hover:bg-zinc-900/40"
                      >
                        <td className="px-3 py-2 font-semibold text-zinc-100">
                          {(() => {
                            const date = new Date(`${entry.date}T00:00:00`);
                            return new Intl.DateTimeFormat("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              weekday: "short",
                            }).format(date);
                          })()}
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-200">{entry.totals.protein.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right text-zinc-200">{entry.totals.carbs.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right text-zinc-200">{entry.totals.fat.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right text-zinc-200">{entry.totals.fiber.toFixed(1)}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${tone}`}>
                          {entry.totals.calories.toFixed(0)}{" "}
                          <span className="text-[10px] text-zinc-500">({pct.toFixed(0)}%)</span>
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-zinc-400">
                          {entry.itemsCount} · {entry.extrasCount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </GlassPanel>
    </div>
  );
}


