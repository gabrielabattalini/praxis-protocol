import test from "node:test";
import assert from "node:assert/strict";
import {
  computeDailyEnergySummary,
  estimateStrengthSessionKcal,
  sumCardioKcalForDateFromModuleState,
} from "../../src/lib/utils.ts";

const DATE = "2026-06-06";
const OTHER = "2026-06-05";

// Musculação: kcal = round(0.21875 * peso * séries). Para 80kg e 20 séries
// dá exatamente 350.
test("estimateStrengthSessionKcal escala com séries e peso", () => {
  assert.equal(estimateStrengthSessionKcal(20, 80), 350);
  assert.equal(estimateStrengthSessionKcal(0, 80), 0);
  assert.equal(estimateStrengthSessionKcal(10, 80), 175);
  // peso inválido cai pro mínimo (1), então não explode
  assert.equal(estimateStrengthSessionKcal(20, 0) > 0, true);
});

test("sumCardioKcalForDateFromModuleState conta só a data e prefere a máquina", () => {
  const moduleState = {
    "run-module-v2": {
      entries: [
        { date: DATE, machineKcal: 400 },
        { date: DATE, machineKcal: 0, estimatedKcal: 120 },
        { date: OTHER, machineKcal: 900 },
      ],
    },
  };
  const kcal = sumCardioKcalForDateFromModuleState(moduleState, DATE, {
    bodyWeightKg: 80,
  });
  assert.equal(kcal, 520); // 400 (máquina) + 120 (estimativa), ignora o outro dia
  assert.equal(sumCardioKcalForDateFromModuleState(undefined, DATE, { bodyWeightKg: 80 }), 0);
  assert.equal(sumCardioKcalForDateFromModuleState({}, DATE, { bodyWeightKg: 80 }), 0);
});

test("computeDailyEnergySummary conta só o que foi efetivamente feito", () => {
  const state = {
    personalProfile: { bodyWeightKg: 80, ageYears: 30, biologicalSex: "male" },
    dailyNutritionTargets: { bodyWeightKg: 80 },
    mealPlan: [
      {
        id: "block",
        items: [
          { id: "a", macros: { calories: 500 }, completedDates: [DATE] }, // conta
          { id: "b", macros: { calories: 300 }, completedDates: [OTHER] }, // outro dia
          { id: "c", macros: { calories: 200 } }, // não marcado
        ],
      },
    ],
    nutritionDailyExtras: [
      { id: "e1", date: DATE, macros: { calories: 150 } }, // conta
      { id: "e2", date: OTHER, macros: { calories: 999 } }, // outro dia
    ],
    workoutPlan: [
      { id: "day1", exercises: [{ sets: 10 }, { sets: 10 }] }, // 20 séries
    ],
    workoutDayCompletions: [
      { dayId: "day1", dateKey: DATE }, // conta
      { dayId: "day1", dateKey: OTHER }, // outro dia
    ],
    moduleState: {
      "run-module-v2": {
        entries: [
          { date: DATE, machineKcal: 400 },
          { date: DATE, machineKcal: 0, estimatedKcal: 120 },
          { date: OTHER, machineKcal: 900 },
        ],
      },
    },
  };

  const summary = computeDailyEnergySummary(state, DATE);
  assert.equal(summary.consumedKcal, 650); // 500 + 150
  assert.equal(summary.workoutKcal, 350); // 20 séries @ 80kg
  assert.equal(summary.cardioKcal, 520); // 400 + 120
  assert.equal(summary.burnedKcal, 870); // 350 + 520
  assert.equal(summary.netKcal, -220); // 650 - 870
});

test("computeDailyEnergySummary com estado vazio retorna zeros", () => {
  const summary = computeDailyEnergySummary({}, DATE);
  assert.deepEqual(summary, {
    consumedKcal: 0,
    burnedKcal: 0,
    workoutKcal: 0,
    cardioKcal: 0,
    netKcal: 0,
  });
});

test("treino não marcado e refeição não concluída não contam", () => {
  const state = {
    personalProfile: { bodyWeightKg: 80 },
    mealPlan: [
      { id: "b", items: [{ id: "c", macros: { calories: 200 } }] },
    ],
    workoutPlan: [{ id: "day1", exercises: [{ sets: 10 }] }],
    workoutDayCompletions: [], // nenhum treino marcado
    nutritionDailyExtras: [],
    moduleState: {},
  };
  const summary = computeDailyEnergySummary(state, DATE);
  assert.equal(summary.consumedKcal, 0);
  assert.equal(summary.burnedKcal, 0);
  assert.equal(summary.netKcal, 0);
});
