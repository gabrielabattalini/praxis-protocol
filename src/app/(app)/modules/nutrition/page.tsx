"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
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
  emptyMacros,
  estimateBasalMetabolicRate,
  formatPoints,
  weekdayLabel,
  weekdayLongLabel,
} from "@/lib/utils";

type UsdaSearchStatus = "idle" | "loading" | "ready" | "error" | "missing";

const nutritionReferenceCards = [
  {
    title: "Proteína",
    detail: "Hipertrofia e atletas: 1,6 a 2,2 g/kg. Corte e definição: pode subir até 2,5 g/kg.",
  },
  {
    title: "Carboidratos",
    detail: "Leve: 3 a 5 g/kg. Moderado: 5 a 7 g/kg. Intenso: 7 a 10 g/kg. Picos: até 12 g/kg.",
  },
  {
    title: "Gorduras",
    detail: "Faixa prática: cerca de 0,5 a 1 g/kg. Ajuste conforme calorias totais e adesão.",
  },
  {
    title: "Fibra e sódio",
    detail: "Fibra: 10 g a cada 1000 kcal. Sódio: máximo recomendado de 3000 mg por dia.",
  },
];

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
}: {
  targets: DailyNutritionTargets;
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
  const adjustedCaloriesTarget = Math.max(
    0,
    Math.round(displayedBasalMetabolicRate + targets.goalAdjustmentKcal),
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
            Basal {displayedBasalMetabolicRate.toFixed(0)} kcal com{" "}
            {formatGoalAdjustment(targets.goalAdjustmentKcal).toLowerCase()}.
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
        onClick={() =>
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
            fiberRatioCalories: fiberRatioCaloriesValue || targets.fiberRatioCalories,
            sodiumTargetMg: sodiumTargetValue || targets.sodiumTargetMg,
            targetWeightKg: targets.weightGoal.targetWeightKg,
            weeklyChangeKg: targets.weightGoal.weeklyChangeKg,
            basalMetabolicRate: displayedBasalMetabolicRate,
            basalMetabolicRateSource,
          })
        }
        className="w-full rounded-sm bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-2)_100%)] px-4 py-3 font-semibold text-slate-950"
      >
        Aplicar metas
      </button>
        </>
      )}
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
  const [isGoalPanelCollapsed, setIsGoalPanelCollapsed] = useState(true);
  const [isTargetsPanelCollapsed, setIsTargetsPanelCollapsed] = useState(true);
  const [isReferencesCollapsed, setIsReferencesCollapsed] = useState(true);
  const [isDietLibraryCollapsed, setIsDietLibraryCollapsed] = useState(false);
  const [isCreateDietPanelOpen, setIsCreateDietPanelOpen] = useState(false);
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
  const consumedDietTotals = mealPlan.reduce(
    (total, block) =>
      block.items.reduce(
        (blockTotal, item) =>
          item.completed && item.completedAt?.slice(0, 10) === todayKey
            ? addMacros(blockTotal, item.macros)
            : blockTotal,
        total,
      ),
    emptyMacros(),
  );
  const completedMealItemsCount = mealPlan.reduce(
    (count, block) =>
      count +
      block.items.filter(
        (item) => item.completed && item.completedAt?.slice(0, 10) === todayKey,
      ).length,
    0,
  );
  const linkedShoppingItemsByBlock = buildLinkedShoppingItemsByBlock(
    (state.shoppingModules.market?.items ?? []) as ShoppingItemWithMealBlocks[],
    (state.shoppingModules.supplements?.items ?? []) as ShoppingItemWithMealBlocks[],
  );

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
  const proteinProgress = getNutritionProgressPercent(
    consumedDietTotals.protein,
    proteinTarget,
  );
  const carbsProgress = getNutritionProgressPercent(
    consumedDietTotals.carbs,
    carbsTarget,
  );
  const fatProgress = getNutritionProgressPercent(consumedDietTotals.fat, fatTarget);
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
            <div className="praxis-title" style={{ fontSize: 26 }}>Registro da dieta</div>
            <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
              Biblioteca, metas e refeições no mesmo fluxo.
            </div>
          </div>
          <div className="mod-hero-side" style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div className="mod-hero-side-stat" style={{ textAlign: "right", borderLeft: "1px solid rgba(39,39,42,0.6)", paddingLeft: 16 }}>
              <div className="praxis-label" style={{ fontSize: 9 }}>HOJE</div>
              <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "var(--font-space-grotesk), sans-serif", marginTop: 2 }}>
                {consumedDietTotals.calories.toFixed(0)}/{caloriesTarget.toFixed(0)}
                <span style={{ fontSize: 11, color: "var(--fg-3)", marginLeft: 4 }}>kcal</span>
              </div>
            </div>
          </div>
        </div>
      </div>

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
            On narrow phones the row overflows: the wrapper scrolls
            horizontally while each cell keeps a minimum width so the
            select stays usable. min-w-[560px] = 7 × ~80px. */}
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="grid min-w-[560px] grid-cols-7 gap-2">
            {weekdayOrder.map((weekday) => (
              <div
                key={weekday}
                className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] p-2"
              >
                <p className="text-center font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {weekdayLabel(weekday)}
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

        <GlassPanel className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-sm border border-zinc-800 bg-surface-container-low px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-500">Consumo do dia</p>
                  <h3 className="mt-1 text-xl font-semibold text-white">
                    Progresso da meta
                  </h3>
                </div>
                <span className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-2 text-xs text-zinc-300">
                  {Math.round(calorieProgress)}%
                </span>
              </div>
              <div className="mt-4 h-2 rounded-sm bg-slate-900/80">
                <div
                  className="h-full rounded-sm bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-2)_100%)]"
                  style={{ width: `${Math.max(Math.min(calorieProgress, 100), 4)}%` }}
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Proteína",
                    value: `${consumedDietTotals.protein.toFixed(1)} / ${proteinTarget.toFixed(1)} g`,
                    percent: proteinProgress,
                  },
                  {
                    label: "Carboidratos",
                    value: `${consumedDietTotals.carbs.toFixed(1)} / ${carbsTarget.toFixed(1)} g`,
                    percent: carbsProgress,
                  },
                  {
                    label: "Gorduras",
                    value: `${consumedDietTotals.fat.toFixed(1)} / ${fatTarget.toFixed(1)} g`,
                    percent: fatProgress,
                  },
                  {
                    label: "Itens concluídos",
                    value: `${completedMealItemsCount} lançados`,
                    percent: totalMealItemsCount > 0 ? (completedMealItemsCount / totalMealItemsCount) * 100 : 0,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-sm border border-zinc-800 bg-[rgba(10,10,12,0.72)] px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                        {item.label}
                      </p>
                      <span className="text-[11px] text-zinc-400">
                        {Math.round(Math.min(item.percent, 100))}%
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-sm border border-zinc-800 bg-surface-container-low px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-500">Hidratação</p>
                  <h3 className="mt-1 text-xl font-semibold text-white">
                    Registro rápido
                  </h3>
                </div>
                <span className="rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.08)] px-3 py-2 text-xs text-[var(--accent)]">
                  {Math.round(Math.min(waterProgress, 100))}%
                </span>
              </div>
              <div className="mt-4 h-2 rounded-sm bg-slate-900/80">
                <div
                  className="h-full rounded-sm bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-2)_100%)]"
                  style={{ width: `${Math.max(Math.min(waterProgress, 100), 4)}%` }}
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {waterQuickActions.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => addWater(amount)}
                    className="rounded-sm border border-zinc-800 bg-[rgba(18,18,20,0.96)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-200 transition hover:border-[rgba(251,146,60,0.24)] hover:text-[var(--accent)]"
                  >
                    +{formatPoints(amount)} ml
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-zinc-500">
                1 copo foi tratado como 200 ml para facilitar o registro rápido.
              </p>
            </div>
          </div>
        </GlassPanel>
      </section>

      <GlassPanel className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500">Referências rápidas</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">
              Faixas para montar a dieta
            </h2>
            {!isReferencesCollapsed ? (
              <p className="mt-2 text-sm text-zinc-500">
                Deixe aberto só quando precisar consultar as faixas.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setIsReferencesCollapsed((current) => !current)}
            className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-2 text-xs text-zinc-300"
          >
            {isReferencesCollapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
            {isReferencesCollapsed ? "Expandir" : "Ocultar"}
          </button>
        </div>
        {isReferencesCollapsed ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {nutritionReferenceCards.map((card) => (
              <div
                key={card.title}
                className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-3"
              >
                <p className="font-medium text-white">{card.title}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {nutritionReferenceCards.map((card) => (
              <div
                key={card.title}
                className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-4"
              >
                <p className="font-medium text-white">{card.title}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-500">{card.detail}</p>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>

      <GlassPanel className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500">Consumo do dia</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">
              Leitura detalhada da meta
            </h2>
          </div>
          <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-2 text-xs text-zinc-300">
            {completedMealItemsCount} itens concluídos
          </div>
        </div>

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
              <span className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-2 text-xs text-zinc-300">
                {mealBlocksCount} refeições
              </span>
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

                <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-zinc-500">Adicionar alimento ou receita</p>
                      <h3 className="mt-1 text-lg font-semibold text-white">
                        Adicionar alimento ou receita
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsQuickAddFoodPanelOpen((current) => !current)}
                      className="inline-flex items-center gap-2 rounded-sm border border-zinc-800 bg-[rgba(18,18,20,0.96)] px-4 py-3 text-sm font-medium text-zinc-100"
                    >
                      {isQuickAddFoodPanelOpen ? (
                        <X className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {isQuickAddFoodPanelOpen ? "Fechar atalho" : "Adicionar alimento"}
                    </button>
                  </div>
                  {isQuickAddFoodPanelOpen ? (
                    <div className="mt-4 rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.72)] p-4">
                      <p className="text-sm text-zinc-500">
                        Cadastre o item na sua base e depois selecione dentro da refeição que quiser.
                      </p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <input
                          value={libraryFoodDraft.name}
                          onChange={(event) =>
                            updateLibraryFoodDraft({ name: event.target.value })
                          }
                          placeholder="Nome do alimento ou receita"
                          className="rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-4 py-3 text-white placeholder:text-zinc-500"
                        />
                        <input
                          value={libraryFoodDraft.servingLabel}
                          onChange={(event) =>
                            updateLibraryFoodDraft({ servingLabel: event.target.value })
                          }
                          placeholder="Base nutricional, ex.: 100 g"
                          className="rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-4 py-3 text-white placeholder:text-zinc-500"
                        />
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <MetricInput
                          label="Proteína"
                          unit="g"
                          value={libraryFoodDraft.protein}
                          onChange={(value) => updateLibraryFoodDraft({ protein: value })}
                          step="0.1"
                          min="0"
                        />
                        <MetricInput
                          label="Carboidratos"
                          unit="g"
                          value={libraryFoodDraft.carbs}
                          onChange={(value) => updateLibraryFoodDraft({ carbs: value })}
                          step="0.1"
                          min="0"
                        />
                        <MetricInput
                          label="Gorduras"
                          unit="g"
                          value={libraryFoodDraft.fat}
                          onChange={(value) => updateLibraryFoodDraft({ fat: value })}
                          step="0.1"
                          min="0"
                        />
                        <MetricInput
                          label="Fibras"
                          unit="g"
                          value={libraryFoodDraft.fiber}
                          onChange={(value) => updateLibraryFoodDraft({ fiber: value })}
                          step="0.1"
                          min="0"
                        />
                        <MetricInput
                          label="Sódio"
                          unit="mg"
                          value={libraryFoodDraft.sodium}
                          onChange={(value) => updateLibraryFoodDraft({ sodium: value })}
                          step="1"
                          min="0"
                        />
                        <MetricInput
                          label="Calorias"
                          unit="kcal"
                          value={libraryFoodDraft.calories}
                          onChange={(value) => updateLibraryFoodDraft({ calories: value })}
                          step="1"
                          min="0"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={saveLibraryFood}
                        className="mt-4 w-full rounded-sm border border-[rgba(251,146,60,0.24)] bg-[rgba(251,146,60,0.12)] px-4 py-3 font-semibold text-[var(--accent)]"
                      >
                        Salvar na minha base de alimentos
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
                  const linkedShoppingItems = linkedShoppingItemsByBlock[block.id] ?? [];
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
                      <div className="mt-4 rounded-sm border border-zinc-800 bg-[rgba(10,10,12,0.72)] p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-white">
                              Itens vinculados de mercado e suplementos
                            </p>
                          </div>
                          <span className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                            {linkedShoppingItems.length} vinculados
                          </span>
                        </div>
                        {linkedShoppingItems.length > 0 ? (
                          <div className="mt-4 space-y-3">
                            {linkedShoppingItems.map((linkedItem) => (
                              <div
                                key={linkedItem.id}
                                className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-3"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <p className="font-medium text-white">
                                    {linkedItem.name}
                                  </p>
                                  <span className="rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-3 py-1 text-xs text-zinc-300">
                                    {linkedItem.quantity}
                                  </span>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                                  <span
                                    className={`rounded-sm border px-3 py-1 ${
                                      linkedItem.originLabel === "Mercado"
                                        ? "border-sky-400/20 bg-sky-400/10 text-sky-100"
                                        : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                                    }`}
                                  >
                                    {linkedItem.originLabel}
                                  </span>
                                  {linkedItem.scheduleLabel ? (
                                    <span className="rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-3 py-1 text-zinc-400">
                                      Horário {linkedItem.scheduleLabel}
                                    </span>
                                  ) : null}
                                  {linkedItem.localStoreName ? (
                                    <span className="rounded-sm border border-zinc-800 bg-[rgba(7,7,9,0.98)] px-3 py-1 text-zinc-400">
                                      Local {linkedItem.localStoreName}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
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

      {/* Was 2xl:grid-cols (kicked in only at 1536px+), so desktop in the
          1024-1535 band stacked Meta ativa above NutritionTargetsEditor.
          Drops to lg: so they sit side-by-side from 1024px upward. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)]">
        <GlassPanel className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-zinc-500">Objetivo corporal</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">
                Meta ativa: {currentGoal.name}
              </h2>
              {!isGoalPanelCollapsed ? (
                <p className="mt-2 text-sm text-zinc-500">
                  {currentGoal.recommendation}. Ajuste atual:{" "}
                  {formatGoalAdjustment(goalAdjustmentKcal).toLowerCase()}.
                </p>
              ) : null}
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                Aplicado à dieta: {activeDietPlan?.name ?? "Dieta atual"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsGoalPanelCollapsed((current) => !current)}
              className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-3 py-2 text-xs text-zinc-300"
            >
              {isGoalPanelCollapsed ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
              {isGoalPanelCollapsed ? "Expandir" : "Ocultar"}
            </button>
          </div>
          {isGoalPanelCollapsed ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-4">
                <p className="text-sm text-zinc-500">Meta ativa</p>
                <p className="mt-2 text-lg font-semibold text-white">{currentGoal.name}</p>
              </div>
              <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-4">
                <p className="text-sm text-zinc-500">Calorias alvo</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {caloriesTarget.toFixed(0)} kcal
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Ajuste row: was a single 2xl-only 3-col grid that
                  collapsed to a tall stack on every desktop width below
                  1536. md: gives it a 3-col layout from 768 upward — input
                  on the left, "Meta final" summary in the middle, button
                  on the right; the input now has a saner natural width
                  via the explicit 160px lane instead of stretching to
                  full panel width. */}
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

              {/* Goal cards: 2xl breakpoint moved to md so cards sit
                  side-by-side on desktop. Recommendation chip lost
                  shrink-0 + got max-w + leading-tight so long copy wraps
                  inside the chip instead of pushing the card layout. */}
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
            </>
          )}
        </GlassPanel>

        <NutritionTargetsEditor
          key={`nutrition-targets-${state.activeDietPlanId}-${dailyNutritionTargets.bodyWeightKg}-${dailyNutritionTargets.goalAdjustmentKcal}-${dailyNutritionTargets.perKg.waterMl}-${dailyNutritionTargets.perKg.protein}-${dailyNutritionTargets.perKg.carbs}-${dailyNutritionTargets.perKg.fat}-${dailyNutritionTargets.fiberStrategy}-${dailyNutritionTargets.fiberPerKg}-${dailyNutritionTargets.fiberRatioGrams}-${dailyNutritionTargets.fiberRatioCalories}-${dailyNutritionTargets.sodiumTargetMg}`}
          targets={dailyNutritionTargets}
          onApply={actions.updateNutritionTargets}
          isCollapsed={isTargetsPanelCollapsed}
          onToggle={() => setIsTargetsPanelCollapsed((current) => !current)}
        />
      </div>
    </div>
  );
}


