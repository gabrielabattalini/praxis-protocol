"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useReducer,
  useState,
} from "react";
import {
  useAuthClient,
  useUserClient,
} from "@/components/providers/auth-client-provider";
import {
  coerceAccountEntitlement,
  defaultAccountEntitlement,
  isFounderEmail,
  localDevelopmentEntitlement,
  type AccountEntitlement,
} from "@/lib/access-entitlements";
import {
  createDefaultGuidedOnboardingProfile,
  buildUserProfile,
  createDefaultLifeAreaProfile,
  defaultDashboardSectionOrder,
  defaultModuleOrder,
  getScopedStorageKey,
  initialPersistedState,
  legacyStorageKey,
  nutritionGoals,
  storageKey,
} from "@/lib/mock-data";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";
import { getShoppingSeedState } from "@/lib/shopping-seed";
import type {
  DashboardSectionId,
  DietWorkoutLinkSettings,
  FinanceBudgetLine,
  FinanceCategory,
  FinanceLineFrequency,
  FinanceLineKind,
  FinanceMonthId,
  FinancePaymentMethod,
  FinanceYearBudget,
  FoodKind,
  FoodSource,
  FoodSubstitutionGroup,
  HouseholdSupplyItem,
  MealCategory,
  NutritionDayType,
  NutritionMacros,
  ReminderEntityType,
  SavedDietPlan,
  SavedWorkoutProgram,
  PersistedState,
  ModuleId,
  RecoveryDayPlan,
  SavedRecoveryProgram,
  Task,
  TaskCategory,
  TaskDifficulty,
  TaskRecurrence,
  ThemeId,
  Weekday,
  WorkoutDayCompletion,
  WorkoutDayPlan,
  WorkoutLoadEntry,
  WorkoutMode,
  NutritionGoalId,
  WorkControlEntry,
} from "@/lib/types";
import type {
  ShoppingModuleScope,
  ShoppingModuleStoredState,
  ShoppingSearchSnapshot,
  ShoppingTrackedItem,
} from "@/lib/shopping-search";
import {
  emptyFinanceMonthlyFlags,
  emptyFinanceMonthlyValues,
  financeMonthOrder,
  getAdjustedTaskXp,
  getTaskBaseXp,
  isFinanceCreditCardPaymentMethod,
  isTaskCompletedForDate,
  makeId,
  normalizeLifeAreaRank,
  normalizeRecurringTaskCompletion,
  normalizeTaskDifficulty,
  roundCurrencyValue,
  getActivityMultiplierFromTrainingDays,
  resolveBasalMetabolicRate,
} from "@/lib/utils";
import { normalizeWorkControlEntry } from "@/lib/work-control";

type AppStoreValue = {
  hydrated: boolean;
  state: PersistedState;
  user: ReturnType<typeof buildUserProfile>;
  entitlement: AccountEntitlement;
  actions: {
    toggleTask: (taskId: string) => void;
    /**
     * Toggle completion for a specific date (YYYY-MM-DD). Used to
     * retroactively mark past days complete without trampling the
     * task's primary completedAt slot. The Tasks page routes the
     * button to this when the user has scrolled the calendar to any
     * day other than today.
     */
    toggleTaskCompletionForDate: (payload: {
      taskId: string;
      dateKey: string;
    }) => void;
    addTask: (task: {
      title: string;
      description: string;
      category: TaskCategory;
      moduleId?: ModuleId | null;
      scheduledTime?: string;
      sourceKey?: string;
      progressLabel?: string;
      completed?: boolean;
      completedAt?: string;
      difficulty: TaskDifficulty;
      recurrence: TaskRecurrence;
    }) => void;
    updateTask: (payload: {
      taskId: string;
      patch: Partial<
        Pick<
          Task,
          | "title"
          | "description"
          | "category"
          | "moduleId"
          | "scheduledTime"
          | "deferUntilDate"
          | "difficulty"
          | "recurrence"
          | "progressLabel"
          | "completed"
          | "completedAt"
        >
      >;
    }) => void;
    removeTask: (taskId: string) => void;
    addWorkControlEntry: (payload: {
      clientName: string;
      referenceNumber: string;
      entryType: string;
      startDate?: string;
      fatalDeadline?: string;
      progressLabel: string;
      notes?: string;
    }) => void;
    updateWorkControlEntry: (payload: {
      entryId: string;
      patch: Partial<
        Pick<
          WorkControlEntry,
          | "clientName"
          | "referenceNumber"
          | "entryType"
          | "startDate"
          | "fatalDeadline"
          | "progressLabel"
          | "notes"
        >
      >;
    }) => void;
    removeWorkControlEntry: (entryId: string) => void;
    saveGuidedOnboarding: (payload: {
      selectedModules: ModuleId[];
      whatsappNumber?: string;
      whatsappSkipped?: boolean;
      selectedCharacterId?: string;
      selectedRoomId?: string;
    }) => void;
    saveLifeAreaProfile: (profile: PersistedState["lifeAreaProfile"]["areas"]) => void;
    completeBodyMetricsSetup: (payload?: { skipped?: boolean }) => void;
    updatePersonalProfile: (
      payload: Partial<
        Omit<PersistedState["personalProfile"], "completedAt">
      >,
    ) => void;
    updateAccountProfile: (payload: {
      name?: string;
      username?: string;
    }) => void;
    setTheme: (theme: ThemeId) => void;
    toggleSetting: (key: "sound" | "vibration" | "darkMode" | "notifications") => void;
    toggleModuleVisibility: (moduleId: ModuleId) => void;
    reorderModule: (payload: {
      moduleId: ModuleId;
      direction: "up" | "down";
    }) => void;
    toggleDashboardSectionVisibility: (sectionId: DashboardSectionId) => void;
    reorderDashboardSection: (payload: {
      sectionId: DashboardSectionId;
      direction: "up" | "down";
    }) => void;
    setNutritionGoal: (goal: NutritionGoalId) => void;
    setNutritionGoalAdjustment: (adjustmentKcal: number) => void;
    updateNutritionTargets: (payload: {
      bodyWeightKg: number;
      bodyHeightCm: number;
      ageYears: number;
      biologicalSex: "female" | "male";
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
      basalMetabolicRateSource: "estimated" | "manual";
    }) => void;
    addWeightEntry: (payload: {
      date: string;
      weightKg: number;
    }) => void;
    removeWeightEntry: (entryId: string) => void;
    setWaterConsumed: (payload: {
      date: string;
      consumedMl: number;
    }) => void;
    setWorkoutMode: (mode: WorkoutMode) => void;
    setDietDayType: (payload: {
      weekday: Weekday;
      dayType: NutritionDayType;
    }) => void;
    setDietWeekPlan: (payload: {
      weekday: Weekday;
      planId: string;
    }) => void;
    setDietWorkoutLink: (payload: Partial<DietWorkoutLinkSettings>) => void;
    addFoodSubstitution: (payload: {
      title: string;
      primaryFoodId?: string;
      mealCategory?: MealCategory;
      alternativeFoodIds: string[];
      notes?: string;
    }) => void;
    removeFoodSubstitution: (substitutionId: string) => void;
    saveCurrentDietPlan: (payload: {
      name: string;
      startDate?: string;
      endDate?: string;
      notes?: string;
    }) => void;
    /**
     * Create an EMPTY diet plan with the given name + goal and make it
     * active immediately. The user flow is name + objective first, then
     * the meal blocks are built inside the now-active plan. Unlike
     * saveCurrentDietPlan, this does not snapshot the existing mealPlan
     * — it intentionally starts from zero so the user has a clean slate.
     */
    createBlankDietPlan: (payload: {
      name: string;
      nutritionGoal: NutritionGoalId;
    }) => void;
    duplicateDietPlan: (planId: string) => void;
    removeDietPlan: (planId: string) => void;
    updateDietPlan: (payload: {
      planId: string;
      patch: Partial<
        Pick<
          SavedDietPlan,
          "name" | "startDate" | "endDate" | "notes" | "nutritionGoal" | "nutritionTargets"
        >
      >;
    }) => void;
    activateDietPlan: (planId: string) => void;
    saveCurrentWorkoutProgram: (payload: {
      programId?: string;
      name: string;
      splitLabel: string;
      startDate?: string;
      endDate?: string;
      notes?: string;
      workoutPlan: WorkoutDayPlan[];
    }) => void;
    activateWorkoutProgram: (programId: string) => void;
    removeWorkoutProgram: (programId: string) => void;
    simulateArenaMatch: () => void;
    toggleLesson: (lessonId: string) => void;
    updateWorkoutLoadBatch: (payload: {
      entries: Array<{
        id: string;
        weightKg: number;
        repetitions: number;
      }>;
    }) => void;
    removeWorkoutLoadBatch: (entryIds: string[]) => void;
    saveWorkoutLoad: (payload: {
      dayId: string;
      exerciseId: string;
      sets: Array<{
        setNumber: number;
        weightKg: number;
        repetitions: number;
      }>;
    }) => void;
    toggleWorkoutDayCompleted: (payload: {
      dayId: string;
      dateKey?: string;
    }) => void;
    addCustomFood: (payload: {
      id?: string;
      name: string;
      servingLabel: string;
      kind: FoodKind;
      macros: NutritionMacros;
      source?: FoodSource;
    }) => void;
    toggleFoodFavorite: (foodId: string) => void;
    addMealBlock: (payload: {
      title: string;
      time: string;
      category: MealCategory;
      notes?: string;
    }) => void;
    updateMealBlock: (payload: {
      blockId: string;
      patch: Partial<{
        title: string;
        time: string;
        category: MealCategory;
        notes?: string;
      }>;
    }) => void;
    removeMealBlock: (blockId: string) => void;
    addMealItem: (payload: {
      blockId: string;
      foodId?: string;
      label: string;
      quantityLabel: string;
      kind: FoodKind;
      macros: NutritionMacros;
      notes?: string;
    }) => void;
    toggleMealItemCompleted: (payload: {
      blockId: string;
      itemId: string;
      /** Optional YYYY-MM-DD. When set, completedAt is stamped to this
       *  date instead of "now", so retroactive marks on past calendar
       *  days show as completed for the right day. */
      dateKey?: string;
    }) => void;
    setMealBlockItemsCompleted: (payload: {
      blockId: string;
      completed: boolean;
      /** Same per-date semantics as toggleMealItemCompleted. */
      dateKey?: string;
    }) => void;
    updateMealItem: (payload: {
      blockId: string;
      itemId: string;
      patch: Partial<{
        label: string;
        quantityLabel: string;
        notes?: string;
        macros: NutritionMacros;
      }>;
    }) => void;
    removeMealItem: (payload: {
      blockId: string;
      itemId: string;
    }) => void;
    toggleReminder: (reminderId: string) => void;
    addReminder: (payload: {
      entityType: ReminderEntityType;
      entityId: string;
      title: string;
      time: string;
      weekdays?: Weekday[];
      note?: string;
    }) => void;
    updateReminder: (payload: {
      reminderId: string;
      patch: Partial<{
        title: string;
        time: string;
        weekdays?: Weekday[];
        enabled: boolean;
        note?: string;
      }>;
    }) => void;
    addHouseholdSupply: (payload: {
      name: string;
      category?: string;
      unitPrice: number;
      packageQuantity: number;
      monthlyNeed: number;
      link?: string;
    }) => void;
    updateHouseholdSupply: (payload: {
      supplyId: string;
      patch: Partial<
        Pick<
          HouseholdSupplyItem,
          "name" | "category" | "unitPrice" | "packageQuantity" | "monthlyNeed" | "link"
        >
      >;
    }) => void;
    removeHouseholdSupply: (supplyId: string) => void;
    replaceShoppingModuleState: (payload: {
      scope: ShoppingModuleScope;
      nextState: ShoppingModuleStoredState;
    }) => void;
    /** Bulk-replace the recovery (mobility) plan — used by the Recovery
     *  module page which performs CRUD locally and dispatches the
     *  resulting plan in one shot. */
    replaceRecoveryPlan: (plan: RecoveryDayPlan[]) => void;
    replaceRecoveryDayCompletions: (
      completions: import("@/lib/types").RecoveryDayCompletion[],
    ) => void;
    updateFinanceStartCash: (amount: number) => void;
    addFinanceCategory: (payload: {
      name: string;
      kind: FinanceLineKind;
    }) => void;
    addFinanceLine: (payload: {
      name: string;
      kind: FinanceLineKind;
      category: string;
      frequency: FinanceLineFrequency;
      paymentMethod: FinancePaymentMethod;
      initialMonth: FinanceMonthId;
      initialValue: number;
      dueDay?: number;
      cardName?: string;
      notes?: string;
    }) => void;
    updateFinanceLine: (payload: {
      lineId: string;
      contextMonth?: FinanceMonthId;
      patch: Partial<
        Pick<
          FinanceBudgetLine,
          "name" | "category" | "frequency" | "paymentMethod" | "dueDay" | "cardName" | "notes"
        >
      >;
    }) => void;
    updateFinanceMonthlyValue: (payload: {
      lineId: string;
      month: FinanceMonthId;
      value: number;
    }) => void;
    toggleFinanceLineSettled: (payload: {
      lineId: string;
      month: FinanceMonthId;
    }) => void;
    applyFinanceSettlement: (payload: {
      lineId: string;
      month: FinanceMonthId;
      amount: number;
    }) => void;
    clearFinanceSettlement: (payload: {
      lineId: string;
      month: FinanceMonthId;
    }) => void;
    rollFinanceLineToNextMonth: (payload: {
      lineId: string;
      month: FinanceMonthId;
    }) => void;
    cancelFinanceLineMonth: (payload: {
      lineId: string;
      month: FinanceMonthId;
    }) => void;
    updateFinanceInvoiceBase: (payload: {
      month: FinanceMonthId;
      value: number;
    }) => void;
    removeFinanceLine: (lineId: string) => void;
    closeFinanceMonth: (month: FinanceMonthId) => void;
    setSleepPlan: (plan: PersistedState["sleepPlan"]) => void;
    setSleepHistory: (history: PersistedState["sleepHistory"]) => void;
    /* Per-module KV bucket setter. Pass null/undefined value to clear
       a module's slot. See PersistedState.moduleState for the rationale. */
    setModuleState: (key: string, value: unknown) => void;
  };
};

type Action =
  | { type: "hydrate"; payload: PersistedState; allowSeed?: boolean }
  | { type: "sync-session"; session: PersistedState["session"] }
  | { type: "toggle-task"; taskId: string }
  | {
      type: "toggle-task-completion-for-date";
      payload: { taskId: string; dateKey: string };
    }
  | { type: "sync-daily-task-completions" }
  | { type: "add-task"; task: Task }
  | {
      type: "update-task";
      payload: {
        taskId: string;
        patch: Partial<
          Pick<
            Task,
            | "title"
            | "description"
            | "category"
            | "moduleId"
            | "scheduledTime"
            | "deferUntilDate"
            | "difficulty"
            | "recurrence"
          >
        >;
      };
    }
  | { type: "remove-task"; taskId: string }
  | {
      type: "add-work-control-entry";
      payload: WorkControlEntry;
    }
  | {
      type: "update-work-control-entry";
      payload: {
        entryId: string;
        patch: Partial<
          Pick<
            WorkControlEntry,
            | "clientName"
            | "referenceNumber"
            | "entryType"
            | "startDate"
            | "fatalDeadline"
            | "progressLabel"
            | "notes"
          >
        >;
      };
    }
  | { type: "remove-work-control-entry"; entryId: string }
  | {
      type: "save-guided-onboarding";
      payload: {
        selectedModules: ModuleId[];
        whatsappNumber?: string;
        whatsappSkipped?: boolean;
        selectedCharacterId?: string;
        selectedRoomId?: string;
      };
    }
  | {
      type: "save-life-area-profile";
      areas: PersistedState["lifeAreaProfile"]["areas"];
    }
  | { type: "complete-body-metrics-setup"; skipped?: boolean }
  | {
      type: "update-personal-profile";
      payload: Partial<
        Omit<PersistedState["personalProfile"], "completedAt">
      >;
    }
  | {
      type: "update-account-profile";
      payload: {
        name?: string;
        username?: string;
      };
    }
  | { type: "set-theme"; theme: ThemeId }
  | {
      type: "toggle-setting";
      key: "sound" | "vibration" | "darkMode" | "notifications";
    }
  | { type: "toggle-module-visibility"; moduleId: ModuleId }
  | {
      type: "reorder-module";
      payload: { moduleId: ModuleId; direction: "up" | "down" };
    }
  | { type: "toggle-dashboard-section-visibility"; sectionId: DashboardSectionId }
  | {
      type: "reorder-dashboard-section";
      payload: { sectionId: DashboardSectionId; direction: "up" | "down" };
    }
  | { type: "set-goal"; goal: NutritionGoalId }
  | { type: "set-goal-adjustment"; adjustmentKcal: number }
  | {
      type: "update-nutrition-targets";
      payload: {
        bodyWeightKg: number;
        bodyHeightCm: number;
        ageYears: number;
        biologicalSex: "female" | "male";
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
        basalMetabolicRateSource: "estimated" | "manual";
      };
    }
  | {
      type: "add-weight-entry";
      payload: {
        date: string;
        weightKg: number;
      };
    }
  | { type: "remove-weight-entry"; entryId: string }
  | {
      type: "set-water-consumed";
      payload: {
        date: string;
        consumedMl: number;
      };
    }
  | {
      type: "add-household-supply";
      payload: {
        name: string;
        category?: string;
        unitPrice: number;
        packageQuantity: number;
        monthlyNeed: number;
        link?: string;
      };
    }
  | {
      type: "update-household-supply";
      payload: {
        supplyId: string;
        patch: Partial<
          Pick<
            HouseholdSupplyItem,
            "name" | "category" | "unitPrice" | "packageQuantity" | "monthlyNeed" | "link"
          >
        >;
      };
    }
  | { type: "remove-household-supply"; supplyId: string }
  | {
      type: "replace-shopping-module-state";
      payload: {
        scope: ShoppingModuleScope;
        nextState: ShoppingModuleStoredState;
      };
    }
  | { type: "replace-recovery-plan"; plan: RecoveryDayPlan[] }
  | {
      type: "replace-recovery-day-completions";
      completions: import("@/lib/types").RecoveryDayCompletion[];
    }
  | { type: "set-workout"; mode: WorkoutMode }
  | {
      type: "set-diet-day-type";
      payload: {
        weekday: Weekday;
        dayType: NutritionDayType;
      };
    }
  | {
      type: "set-diet-workout-link";
      payload: Partial<DietWorkoutLinkSettings>;
    }
  | {
      type: "set-diet-week-plan";
      payload: {
        weekday: Weekday;
        planId: string;
      };
    }
  | {
      type: "add-food-substitution";
      payload: {
        title: string;
        primaryFoodId?: string;
        mealCategory?: MealCategory;
        alternativeFoodIds: string[];
        notes?: string;
      };
    }
  | { type: "remove-food-substitution"; substitutionId: string }
  | {
      type: "save-current-diet-plan";
      payload: {
        name: string;
        startDate?: string;
        endDate?: string;
        notes?: string;
      };
    }
  | {
      type: "create-blank-diet-plan";
      payload: { name: string; nutritionGoal: NutritionGoalId };
    }
  | {
      type: "update-diet-plan";
      payload: {
        planId: string;
        patch: Partial<
          Pick<
            SavedDietPlan,
            "name" | "startDate" | "endDate" | "notes" | "nutritionGoal" | "nutritionTargets"
          >
        >;
      };
    }
  | { type: "duplicate-diet-plan"; planId: string }
  | { type: "remove-diet-plan"; planId: string }
  | { type: "activate-diet-plan"; planId: string }
  | {
      type: "save-current-workout-program";
      payload: {
        programId?: string;
        name: string;
        splitLabel: string;
        startDate?: string;
        endDate?: string;
        notes?: string;
        workoutPlan: WorkoutDayPlan[];
      };
    }
  | { type: "activate-workout-program"; programId: string }
  | { type: "remove-workout-program"; programId: string }
  | { type: "simulate-arena"; result: { opponent: string; message: string; win: boolean; damage: number } }
  | { type: "toggle-lesson"; lessonId: string }
  | {
      type: "update-workout-load-batch";
      payload: {
        entries: Array<{
          id: string;
          weightKg: number;
          repetitions: number;
        }>;
      };
    }
  | { type: "remove-workout-load-batch"; entryIds: string[] }
  | {
      type: "save-workout-load";
      payload: {
        dayId: string;
        exerciseId: string;
        sets: Array<{
          setNumber: number;
          weightKg: number;
          repetitions: number;
        }>;
      };
    }
  | {
      type: "toggle-workout-day-completed";
      payload: {
        dayId: string;
        dateKey?: string;
      };
    }
  | {
      type: "add-custom-food";
      payload: {
        id?: string;
        name: string;
        servingLabel: string;
        kind: FoodKind;
        macros: NutritionMacros;
        source?: FoodSource;
      };
    }
  | { type: "toggle-food-favorite"; foodId: string }
  | {
      type: "add-meal-block";
      payload: {
        title: string;
        time: string;
        category: MealCategory;
        notes?: string;
      };
    }
  | {
      type: "update-meal-block";
      payload: {
        blockId: string;
        patch: Partial<{
          title: string;
          time: string;
          category: MealCategory;
          notes?: string;
        }>;
      };
    }
  | { type: "remove-meal-block"; blockId: string }
  | {
      type: "add-meal-item";
      payload: {
        blockId: string;
        foodId?: string;
        label: string;
        quantityLabel: string;
        kind: FoodKind;
        macros: NutritionMacros;
        notes?: string;
      };
    }
  | {
      type: "toggle-meal-item-completed";
      payload: {
        blockId: string;
        itemId: string;
        dateKey?: string;
      };
    }
  | {
      type: "set-meal-block-items-completed";
      payload: {
        blockId: string;
        completed: boolean;
        dateKey?: string;
      };
    }
  | {
      type: "update-meal-item";
      payload: {
        blockId: string;
        itemId: string;
        patch: Partial<{
          label: string;
          quantityLabel: string;
          notes?: string;
          macros: NutritionMacros;
        }>;
      };
    }
  | {
      type: "remove-meal-item";
      payload: {
        blockId: string;
        itemId: string;
      };
    }
  | { type: "toggle-reminder"; reminderId: string }
  | {
      type: "add-reminder";
      payload: {
        entityType: ReminderEntityType;
        entityId: string;
        title: string;
        time: string;
        weekdays?: Weekday[];
        note?: string;
      };
    }
  | {
      type: "update-reminder";
      payload: {
        reminderId: string;
        patch: Partial<{
          title: string;
          time: string;
          weekdays?: Weekday[];
          enabled: boolean;
          note?: string;
        }>;
      };
    }
  | { type: "update-finance-start-cash"; amount: number }
  | {
      type: "add-finance-category";
      payload: {
        name: string;
        kind: FinanceLineKind;
      };
    }
  | {
      type: "add-finance-line";
      payload: {
        name: string;
        kind: FinanceLineKind;
        category: string;
        frequency: FinanceLineFrequency;
        paymentMethod: FinancePaymentMethod;
        initialMonth: FinanceMonthId;
        initialValue: number;
        dueDay?: number;
        cardName?: string;
        notes?: string;
      };
    }
  | {
      type: "update-finance-line";
      payload: {
        lineId: string;
        contextMonth?: FinanceMonthId;
        patch: Partial<
          Pick<
            FinanceBudgetLine,
            "name" | "category" | "frequency" | "paymentMethod" | "dueDay" | "cardName" | "notes"
          >
        >;
      };
    }
  | {
      type: "update-finance-monthly-value";
      payload: {
        lineId: string;
        month: FinanceMonthId;
        value: number;
      };
    }
  | {
      type: "toggle-finance-line-settled";
      payload: {
        lineId: string;
        month: FinanceMonthId;
      };
    }
  | {
      type: "apply-finance-settlement";
      payload: {
        lineId: string;
        month: FinanceMonthId;
        amount: number;
      };
    }
  | {
      type: "clear-finance-settlement";
      payload: {
        lineId: string;
        month: FinanceMonthId;
      };
    }
  | {
      type: "roll-finance-line-to-next-month";
      payload: {
        lineId: string;
        month: FinanceMonthId;
      };
    }
  | {
      type: "cancel-finance-line-month";
      payload: {
        lineId: string;
        month: FinanceMonthId;
      };
    }
  | {
      type: "update-finance-invoice-base";
      payload: {
        month: FinanceMonthId;
        value: number;
      };
    }
  | { type: "remove-finance-line"; lineId: string }
  | { type: "close-finance-month"; month: FinanceMonthId }
  | { type: "set-sleep-plan"; payload: PersistedState["sleepPlan"] }
  | { type: "set-sleep-history"; payload: PersistedState["sleepHistory"] }
  | { type: "set-module-state"; key: string; value: unknown };

const AppStoreContext = createContext<AppStoreValue | null>(null);

function withCalculatedTaskXp(
  task: Task,
  profile: PersistedState["lifeAreaProfile"],
): Task {
  const difficulty = normalizeTaskDifficulty(task.difficulty, task.xp);
  const baseXp = getTaskBaseXp(task);

  return {
    ...task,
    difficulty,
    baseXp,
    xp: getAdjustedTaskXp(
      {
        ...task,
        difficulty,
        baseXp,
      },
      profile,
    ),
  };
}

function isMealItemCompletedForDate(
  item: PersistedState["mealPlan"][number]["items"][number],
  date: Date,
) {
  const dateKey = date.toISOString().slice(0, 10);
  return Boolean(item.completed && item.completedAt?.slice(0, 10) === dateKey);
}

function normalizeMealPlanCompletion(
  mealPlan: PersistedState["mealPlan"],
  date: Date = new Date(),
) {
  return mealPlan.map((block) => ({
    ...block,
    items: block.items.map((item) => {
      const completedForCurrentDate = isMealItemCompletedForDate(item, date);
      return {
        ...item,
        completed: completedForCurrentDate,
        completedAt: completedForCurrentDate ? item.completedAt : undefined,
      };
    }),
  }));
}

function clearMealPlanCompletion(
  mealPlan: PersistedState["mealPlan"],
): PersistedState["mealPlan"] {
  return mealPlan.map((block) => ({
    ...block,
    items: block.items.map((item) => ({
      ...item,
      completed: false,
      completedAt: undefined,
    })),
  }));
}

function createDuplicatedDietPlanName(
  sourceName: string,
  existingPlans: PersistedState["dietPlans"],
) {
  const existingNames = new Set(
    existingPlans.map((plan) => plan.name.trim().toLocaleLowerCase("pt-BR")),
  );
  const baseName = sourceName.trim() || "Dieta";
  const initialCandidate = `${baseName} (cópia)`;

  if (!existingNames.has(initialCandidate.trim().toLocaleLowerCase("pt-BR"))) {
    return initialCandidate;
  }

  let suffix = 2;
  while (true) {
    const candidate = `${baseName} (cópia ${suffix})`;
    if (!existingNames.has(candidate.trim().toLocaleLowerCase("pt-BR"))) {
      return candidate;
    }
    suffix += 1;
  }
}

function normalizeWorkControlEntries(
  entries: PersistedState["workControlEntries"] = emptyPersistedState.workControlEntries,
) {
  return entries.map((entry) => normalizeWorkControlEntry(entry));
}

function reducer(state: PersistedState, action: Action): PersistedState {
  switch (action.type) {
    case "hydrate": {
      const allowSeed = action.allowSeed ?? true;
      const hydratedState = parseStateValue(action.payload, allowSeed);
      return syncShoppingFinanceState(
        hydratedState ?? emptyPersistedState,
        allowSeed,
      );
    }
    case "sync-session":
      return {
        ...state,
        session: {
          ...state.session,
          ...action.session,
          lastLoginAt: action.session.authenticated
            ? action.session.userId !== state.session.userId
              ? new Date().toISOString()
              : state.session.lastLoginAt ?? new Date().toISOString()
            : undefined,
        },
      };
    case "toggle-task":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId
            ? (() => {
                const completedForCurrentDate = isTaskCompletedForDate(task, new Date());
                return {
                  ...task,
                  completed: !completedForCurrentDate,
                  deferUntilDate: undefined,
                  completedAt: !completedForCurrentDate
                    ? new Date().toISOString()
                    : undefined,
                };
              })()
            : task,
        ),
      };
    case "toggle-task-completion-for-date":
      return {
        ...state,
        tasks: state.tasks.map((task) => {
          if (task.id !== action.payload.taskId) return task;
          const { dateKey } = action.payload;
          const currentList = task.completedDates ?? [];
          const alreadyComplete = currentList.includes(dateKey);
          const nextList = alreadyComplete
            ? currentList.filter((entry) => entry !== dateKey)
            : [...currentList, dateKey];
          return {
            ...task,
            completedDates: nextList,
          };
        }),
      };
    case "sync-daily-task-completions":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          normalizeRecurringTaskCompletion(task),
        ),
      };
    case "add-task":
      return (() => {
        const nextTask = withCalculatedTaskXp(action.task, state.lifeAreaProfile);

        if (nextTask.sourceKey) {
          const existingTask = state.tasks.find(
            (task) => task.sourceKey === nextTask.sourceKey,
          );

          if (existingTask) {
            const mergedTask = withCalculatedTaskXp(
              {
                ...existingTask,
                ...nextTask,
                id: existingTask.id,
                completed: existingTask.completed,
                completedAt: existingTask.completedAt,
              },
              state.lifeAreaProfile,
            );

            return {
              ...state,
              tasks: state.tasks.map((task) =>
                task.id === existingTask.id ? mergedTask : task,
              ),
            };
          }
        }

        return {
          ...state,
          tasks: [nextTask, ...state.tasks],
        };
      })();
    case "update-task":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.payload.taskId
            ? (() => {
                const nextTask = {
                  ...task,
                  ...action.payload.patch,
                };

                return withCalculatedTaskXp(nextTask, state.lifeAreaProfile);
              })()
            : task,
        ),
      };
    case "remove-task":
      return {
        ...state,
        tasks: state.tasks.filter((task) => task.id !== action.taskId),
      };
    case "add-work-control-entry":
      return {
        ...state,
        workControlEntries: [
          normalizeWorkControlEntry(action.payload),
          ...state.workControlEntries,
        ],
      };
    case "update-work-control-entry":
      return {
        ...state,
        workControlEntries: state.workControlEntries.map((entry) =>
          entry.id === action.payload.entryId
            ? normalizeWorkControlEntry({
                ...entry,
                ...action.payload.patch,
              })
            : entry,
        ),
      };
    case "remove-work-control-entry":
      return {
        ...state,
        workControlEntries: state.workControlEntries.filter(
          (entry) => entry.id !== action.entryId,
        ),
      };
    case "save-guided-onboarding": {
      const selectedModules = Array.from(
        new Set(
          action.payload.selectedModules.filter((moduleId) =>
            defaultModuleOrder.includes(moduleId),
          ),
        ),
      ) as ModuleId[];
      const baseSelectedModules = selectedModules.length
        ? selectedModules
        : defaultModuleOrder.filter((moduleId) => state.settings.activeModules[moduleId]);
      const orderedSelectedModules = baseSelectedModules.length
        ? baseSelectedModules
        : [...defaultModuleOrder];
      const moduleOrder = [
        ...orderedSelectedModules,
        ...state.settings.moduleOrder.filter(
          (moduleId) => !orderedSelectedModules.includes(moduleId),
        ),
      ];
      const activeModules = defaultModuleOrder.reduce<Record<ModuleId, boolean>>(
        (accumulator, moduleId) => {
          accumulator[moduleId] = orderedSelectedModules.includes(moduleId);
          return accumulator;
        },
        {} as Record<ModuleId, boolean>,
      );
      const whatsappNumber = action.payload.whatsappNumber?.trim();

      return {
        ...state,
        guidedOnboarding: {
          completedAt:
            state.guidedOnboarding.completedAt ?? new Date().toISOString(),
          selectedModules: orderedSelectedModules,
          whatsappNumber: whatsappNumber ? whatsappNumber : undefined,
          whatsappSkippedAt: action.payload.whatsappSkipped
            ? state.guidedOnboarding.whatsappSkippedAt ?? new Date().toISOString()
            : undefined,
          selectedCharacterId:
            action.payload.selectedCharacterId ??
            state.guidedOnboarding.selectedCharacterId,
          selectedRoomId:
            action.payload.selectedRoomId ?? state.guidedOnboarding.selectedRoomId,
        },
        settings: {
          ...state.settings,
          activeModules,
          moduleOrder: normalizeModuleOrder(moduleOrder),
        },
      };
    }
    case "save-life-area-profile": {
      const lifeAreaProfile = {
        completedAt: state.lifeAreaProfile.completedAt ?? new Date().toISOString(),
        areas: action.areas,
      };

      return {
        ...state,
        lifeAreaProfile,
        tasks: state.tasks.map((task) => withCalculatedTaskXp(task, lifeAreaProfile)),
      };
    }
    case "complete-body-metrics-setup":
      return {
        ...state,
        bodyMetricsProfile: {
          completedAt: state.bodyMetricsProfile.completedAt ?? new Date().toISOString(),
          skippedAt: action.skipped
            ? state.bodyMetricsProfile.skippedAt ?? new Date().toISOString()
            : undefined,
        },
      };
    case "update-personal-profile": {
      const ageYears =
        typeof action.payload.ageYears === "number" &&
        Number.isFinite(action.payload.ageYears)
          ? Math.max(1, Math.round(action.payload.ageYears))
          : state.personalProfile.ageYears;
      const bodyHeightCm =
        typeof action.payload.bodyHeightCm === "number" &&
        Number.isFinite(action.payload.bodyHeightCm)
          ? Math.max(1, Math.round(action.payload.bodyHeightCm))
          : state.personalProfile.bodyHeightCm;
      const bodyWeightKg =
        typeof action.payload.bodyWeightKg === "number" &&
        Number.isFinite(action.payload.bodyWeightKg)
          ? Math.max(1, Number(action.payload.bodyWeightKg.toFixed(1)))
          : state.personalProfile.bodyWeightKg;
      const biologicalSex =
        action.payload.biologicalSex === "female" || action.payload.biologicalSex === "male"
          ? action.payload.biologicalSex
          : state.personalProfile.biologicalSex;
      const restingHeartRateBpm =
        typeof action.payload.restingHeartRateBpm === "number" &&
        Number.isFinite(action.payload.restingHeartRateBpm) &&
        action.payload.restingHeartRateBpm > 0
          ? Math.min(220, Math.max(30, Math.round(action.payload.restingHeartRateBpm)))
          : undefined;
      const notes = action.payload.notes?.trim();

      return {
        ...state,
        personalProfile: {
          ...state.personalProfile,
          ...action.payload,
          ageYears,
          bodyHeightCm,
          bodyWeightKg,
          biologicalSex,
          restingHeartRateBpm,
          notes: notes ? notes : undefined,
          completedAt: state.personalProfile.completedAt ?? new Date().toISOString(),
        },
      };
    }
    case "update-account-profile": {
      const name = action.payload.name?.trim();
      const username = action.payload.username?.trim();
      return {
        ...state,
        session: {
          ...state.session,
          name: name || state.session.name,
          username: username || state.session.username,
        },
      };
    }
    case "set-theme":
      return {
        ...state,
        settings: {
          ...state.settings,
          theme: action.theme,
        },
      };
    case "toggle-setting":
      return {
        ...state,
        settings: {
          ...state.settings,
          [action.key]: !state.settings[action.key],
        },
      };
    case "toggle-module-visibility":
      return {
        ...state,
        settings: {
          ...state.settings,
          activeModules: {
            ...state.settings.activeModules,
            [action.moduleId]: !state.settings.activeModules[action.moduleId],
          },
        },
      };
    case "reorder-module": {
      const currentOrder = normalizeModuleOrder(state.settings.moduleOrder);
      const visibleOrder = currentOrder.filter(
        (moduleId) => state.settings.activeModules[moduleId],
      );
      const visibleIndex = visibleOrder.indexOf(action.payload.moduleId);
      if (visibleIndex < 0) return state;

      const targetVisibleIndex =
        action.payload.direction === "up" ? visibleIndex - 1 : visibleIndex + 1;
      if (targetVisibleIndex < 0 || targetVisibleIndex >= visibleOrder.length) return state;

      const targetModuleId = visibleOrder[targetVisibleIndex];
      const currentIndex = currentOrder.indexOf(action.payload.moduleId);
      const targetIndex = currentOrder.indexOf(targetModuleId);
      if (currentIndex < 0 || targetIndex < 0) return state;

      const nextOrder = [...currentOrder];
      [nextOrder[currentIndex], nextOrder[targetIndex]] = [
        nextOrder[targetIndex],
        nextOrder[currentIndex],
      ];

      return {
        ...state,
        settings: {
          ...state.settings,
          moduleOrder: nextOrder,
        },
      };
    }
    case "toggle-dashboard-section-visibility": {
      const hidden = new Set(
        normalizeHiddenDashboardSections(state.settings.hiddenDashboardSections),
      );

      if (hidden.has(action.sectionId)) {
        hidden.delete(action.sectionId);
      } else {
        hidden.add(action.sectionId);
      }

      return {
        ...state,
        settings: {
          ...state.settings,
          hiddenDashboardSections: Array.from(hidden),
        },
      };
    }
    case "reorder-dashboard-section": {
      const currentOrder = normalizeDashboardSectionOrder(
        state.settings.dashboardSectionOrder,
      );
      const currentIndex = currentOrder.indexOf(action.payload.sectionId);

      if (currentIndex < 0) {
        return state;
      }

      const targetIndex =
        action.payload.direction === "up" ? currentIndex - 1 : currentIndex + 1;

      if (targetIndex < 0 || targetIndex >= currentOrder.length) {
        return state;
      }

      const nextOrder = [...currentOrder];
      [nextOrder[currentIndex], nextOrder[targetIndex]] = [
        nextOrder[targetIndex],
        nextOrder[currentIndex],
      ];

      return {
        ...state,
        settings: {
          ...state.settings,
          dashboardSectionOrder: nextOrder,
        },
      };
    }
    case "set-goal":
      {
        const currentTargets = state.dailyNutritionTargets;
        const goalAdjustmentKcal =
          nutritionGoals[action.goal].defaultAdjustmentKcal;
        const caloriesTarget = resolveNutritionCaloriesTarget(
          currentTargets.basalMetabolicRate,
          goalAdjustmentKcal,
          getActivityMultiplierFromTrainingDaysForState(state),
        );
        const nextTargets = {
          ...currentTargets,
          goalAdjustmentKcal,
          totals: {
            ...currentTargets.totals,
            fiber: resolveNutritionFiberTarget(caloriesTarget, currentTargets.bodyWeightKg, {
              fiberStrategy: currentTargets.fiberStrategy,
              fiberPerKg: currentTargets.fiberPerKg,
              fiberRatioGrams: currentTargets.fiberRatioGrams,
              fiberRatioCalories: currentTargets.fiberRatioCalories,
            }),
            calories: caloriesTarget,
          },
        };
        return {
          ...state,
          nutritionGoal: action.goal,
          dailyNutritionTargets: nextTargets,
          dietPlans: state.dietPlans.map((plan) =>
            plan.id === state.activeDietPlanId
              ? {
                  ...plan,
                  nutritionGoal: action.goal,
                  nutritionTargets: nextTargets,
                }
              : plan,
          ),
        };
      }
    case "set-goal-adjustment": {
      const currentTargets = state.dailyNutritionTargets;
      const goalAdjustmentKcal = Math.round(action.adjustmentKcal);
      const caloriesTarget = resolveNutritionCaloriesTarget(
        currentTargets.basalMetabolicRate,
        goalAdjustmentKcal,
        getActivityMultiplierFromTrainingDaysForState(state),
      );
      const nextTargets = {
        ...currentTargets,
        goalAdjustmentKcal,
        totals: {
          ...currentTargets.totals,
          fiber: resolveNutritionFiberTarget(caloriesTarget, currentTargets.bodyWeightKg, {
            fiberStrategy: currentTargets.fiberStrategy,
            fiberPerKg: currentTargets.fiberPerKg,
            fiberRatioGrams: currentTargets.fiberRatioGrams,
            fiberRatioCalories: currentTargets.fiberRatioCalories,
          }),
          calories: caloriesTarget,
        },
      };
      return {
        ...state,
        dailyNutritionTargets: nextTargets,
        dietPlans: state.dietPlans.map((plan) =>
          plan.id === state.activeDietPlanId
            ? {
                ...plan,
                nutritionTargets: nextTargets,
              }
            : plan,
        ),
      };
    }
    case "update-nutrition-targets": {
      const bodyWeightKg = Math.max(1, action.payload.bodyWeightKg);
      const bodyHeightCm = Math.max(1, action.payload.bodyHeightCm);
      const ageYears = Math.max(1, action.payload.ageYears);
      const biologicalSex = action.payload.biologicalSex;
      const waterMlPerKg = Math.max(0, action.payload.waterMlPerKg);
      const proteinPerKg = Math.max(0, action.payload.proteinPerKg);
      const carbsPerKg = Math.max(0, action.payload.carbsPerKg);
      const fatPerKg = Math.max(0, action.payload.fatPerKg);
      const fiberStrategy = action.payload.fiberStrategy;
      const fiberPerKg = Math.max(0, action.payload.fiberPerKg);
      const fiberRatioGrams = Math.max(0, action.payload.fiberRatioGrams);
      const fiberRatioCalories = Math.max(1, action.payload.fiberRatioCalories);
      const sodiumTargetMg = Math.max(0, Math.round(action.payload.sodiumTargetMg));
      const targetWeightKg = Math.max(1, action.payload.targetWeightKg);
      const weeklyChangeKg = Number(action.payload.weeklyChangeKg.toFixed(2));
      const currentTargets = state.dailyNutritionTargets;
      const proteinTarget = Number((bodyWeightKg * proteinPerKg).toFixed(1));
      const carbsTarget = Number((bodyWeightKg * carbsPerKg).toFixed(1));
      const fatTarget = Number((bodyWeightKg * fatPerKg).toFixed(1));
      const basalMetabolicRate = resolveBasalMetabolicRate({
        bodyWeightKg,
        bodyHeightCm,
        ageYears,
        biologicalSex,
        basalMetabolicRate: action.payload.basalMetabolicRate,
        basalMetabolicRateSource: action.payload.basalMetabolicRateSource,
      });
      const goalAdjustmentKcal = Math.round(currentTargets.goalAdjustmentKcal);
      const caloriesTarget = resolveNutritionCaloriesTarget(
        basalMetabolicRate,
        goalAdjustmentKcal,
        getActivityMultiplierFromTrainingDaysForState(state),
      );
      const fiberTarget = resolveNutritionFiberTarget(caloriesTarget, bodyWeightKg, {
        fiberStrategy,
        fiberPerKg,
        fiberRatioGrams,
        fiberRatioCalories,
      });

      const nextTargets = {
        ...currentTargets,
        bodyWeightKg,
        bodyHeightCm,
        ageYears,
        biologicalSex,
        basalMetabolicRate,
        basalMetabolicRateSource: action.payload.basalMetabolicRateSource,
        goalAdjustmentKcal,
        waterMl: Math.round(bodyWeightKg * waterMlPerKg),
        weightGoal: {
          targetWeightKg,
          weeklyChangeKg,
        },
        fiberStrategy,
        fiberPer1000Kcal: fiberRatioCalories > 0
          ? Number(((fiberRatioGrams / fiberRatioCalories) * 1000).toFixed(2))
          : currentTargets.fiberPer1000Kcal,
        fiberPerKg,
        fiberRatioGrams,
        fiberRatioCalories,
        sodiumTargetMg,
        totals: {
          ...currentTargets.totals,
          protein: proteinTarget,
          carbs: carbsTarget,
          fat: fatTarget,
          fiber: fiberTarget,
          sodium: sodiumTargetMg,
          calories: caloriesTarget,
        },
        perKg: {
          ...currentTargets.perKg,
          waterMl: waterMlPerKg,
          protein: proteinPerKg,
          carbs: carbsPerKg,
          fat: fatPerKg,
        },
      };

      return {
        ...state,
        dailyNutritionTargets: nextTargets,
        dietPlans: state.dietPlans.map((plan) =>
          plan.id === state.activeDietPlanId
            ? {
                ...plan,
                nutritionTargets: nextTargets,
              }
            : plan,
        ),
      };
    }
    case "add-weight-entry": {
      const nextEntry = {
        id: makeId("weight"),
        date: action.payload.date,
        weightKg: Math.max(1, Number(action.payload.weightKg)),
      };
      const remaining = state.weightEntries.filter((entry) => entry.date !== nextEntry.date);
      return {
        ...state,
        weightEntries: [nextEntry, ...remaining].sort((left, right) =>
          right.date.localeCompare(left.date),
        ),
      };
    }
    case "remove-weight-entry":
      return {
        ...state,
        weightEntries: state.weightEntries.filter((entry) => entry.id !== action.entryId),
      };
    case "set-water-consumed": {
      const nextEntry = {
        date: action.payload.date,
        consumedMl: Math.max(0, Math.round(action.payload.consumedMl)),
      };
      const remaining = state.waterEntries.filter((entry) => entry.date !== nextEntry.date);
      return {
        ...state,
        waterEntries: [nextEntry, ...remaining].sort((left, right) =>
          right.date.localeCompare(left.date),
        ),
      };
    }
    case "add-household-supply":
      return {
        ...state,
        householdSupplies: [
          {
            id: makeId("household-supply"),
            name: action.payload.name.trim(),
            category: action.payload.category?.trim() || undefined,
            unitPrice: roundCurrencyValue(Math.max(0, action.payload.unitPrice)),
            packageQuantity: Math.max(1, Math.round(action.payload.packageQuantity)),
            monthlyNeed: Math.max(1, Math.round(action.payload.monthlyNeed)),
            link: action.payload.link?.trim() || undefined,
          },
          ...state.householdSupplies,
        ],
      };
    case "update-household-supply":
      return {
        ...state,
        householdSupplies: state.householdSupplies.map((supply) =>
          supply.id === action.payload.supplyId
            ? {
                ...supply,
                ...action.payload.patch,
                name: (action.payload.patch.name ?? supply.name).trim(),
                category:
                  action.payload.patch.category !== undefined
                    ? action.payload.patch.category.trim() || undefined
                    : supply.category,
                unitPrice: roundCurrencyValue(
                  Math.max(0, action.payload.patch.unitPrice ?? supply.unitPrice),
                ),
                packageQuantity: Math.max(
                  1,
                  Math.round(action.payload.patch.packageQuantity ?? supply.packageQuantity),
                ),
                monthlyNeed: Math.max(
                  1,
                  Math.round(action.payload.patch.monthlyNeed ?? supply.monthlyNeed),
                ),
                link:
                  action.payload.patch.link !== undefined
                    ? action.payload.patch.link.trim() || undefined
                    : supply.link,
              }
            : supply,
        ),
      };
    case "remove-household-supply":
      return {
        ...state,
        householdSupplies: state.householdSupplies.filter(
          (supply) => supply.id !== action.supplyId,
        ),
      };
    case "replace-shopping-module-state":
      return syncShoppingFinanceState({
        ...state,
        shoppingModules: {
          ...state.shoppingModules,
          [action.payload.scope]: normalizeShoppingModuleState(
            action.payload.nextState,
            action.payload.scope,
          ),
        },
      });
    case "replace-recovery-plan":
      return { ...state, recoveryPlan: action.plan };
    case "replace-recovery-day-completions":
      return { ...state, recoveryDayCompletions: action.completions };
    case "set-workout":
      return {
        ...state,
        workoutMode: action.mode,
      };
    case "set-diet-day-type":
      return {
        ...state,
        dietDayTypes: {
          ...state.dietDayTypes,
          [action.payload.weekday]: action.payload.dayType,
        },
      };
    case "set-diet-week-plan":
      return {
        ...state,
        dietWeekSchedule: {
          ...state.dietWeekSchedule,
          [action.payload.weekday]: action.payload.planId,
        },
      };
    case "set-diet-workout-link":
      return {
        ...state,
        dietWorkoutLink: {
          ...state.dietWorkoutLink,
          ...action.payload,
        },
      };
    case "add-food-substitution":
      return {
        ...state,
        foodSubstitutions: [
          {
            id: makeId("substitution"),
            title: action.payload.title,
            primaryFoodId: action.payload.primaryFoodId,
            mealCategory: action.payload.mealCategory,
            alternativeFoodIds: action.payload.alternativeFoodIds,
            notes: action.payload.notes,
          },
          ...state.foodSubstitutions,
        ],
      };
    case "remove-food-substitution":
      return {
        ...state,
        foodSubstitutions: state.foodSubstitutions.filter(
          (substitution) => substitution.id !== action.substitutionId,
        ),
      };
    case "save-current-diet-plan": {
      const planId = makeId("diet");
      const nextPlan: SavedDietPlan = {
        id: planId,
        name: action.payload.name,
        startDate: action.payload.startDate,
        endDate: action.payload.endDate,
        notes: action.payload.notes,
        createdAt: new Date().toISOString(),
        mealPlan: clearMealPlanCompletion(state.mealPlan),
        nutritionGoal: state.nutritionGoal,
        nutritionTargets: state.dailyNutritionTargets,
        dayTypes: state.dietDayTypes,
        workoutLinkSettings: state.dietWorkoutLink,
        foodSubstitutions: state.foodSubstitutions,
      };

      return {
        ...state,
        dietPlans: [nextPlan, ...state.dietPlans],
        activeDietPlanId: planId,
      };
    }
    case "create-blank-diet-plan": {
      // User wants name + objective first, then build structure inside
      // the now-active blank plan. Snapshots the current macro/target
      // settings (so the new plan inherits the user's existing per-kg
      // metrics) but starts with an empty mealPlan + empty foodSubs.
      const planId = makeId("diet");
      const nextPlan: SavedDietPlan = {
        id: planId,
        name: action.payload.name,
        createdAt: new Date().toISOString(),
        mealPlan: [],
        nutritionGoal: action.payload.nutritionGoal,
        nutritionTargets: state.dailyNutritionTargets,
        dayTypes: state.dietDayTypes,
        workoutLinkSettings: state.dietWorkoutLink,
        foodSubstitutions: [],
      };

      return {
        ...state,
        dietPlans: [nextPlan, ...state.dietPlans],
        activeDietPlanId: planId,
        mealPlan: [],
        nutritionGoal: action.payload.nutritionGoal,
        foodSubstitutions: [],
      };
    }
    case "update-diet-plan":
      return {
        ...state,
        dietPlans: state.dietPlans.map((plan) =>
          plan.id === action.payload.planId
            ? {
                ...plan,
                ...action.payload.patch,
              }
            : plan,
        ),
      };
    case "duplicate-diet-plan": {
      const sourcePlan = state.dietPlans.find((plan) => plan.id === action.planId);
      if (!sourcePlan) return state;

      const duplicatedPlanId = makeId("diet");
      const duplicatedPlan: SavedDietPlan = {
        ...sourcePlan,
        id: duplicatedPlanId,
        name: createDuplicatedDietPlanName(sourcePlan.name, state.dietPlans),
        createdAt: new Date().toISOString(),
        mealPlan: clearMealPlanCompletion(sourcePlan.mealPlan),
        nutritionTargets: { ...sourcePlan.nutritionTargets },
        dayTypes: { ...sourcePlan.dayTypes },
        workoutLinkSettings: { ...sourcePlan.workoutLinkSettings },
        foodSubstitutions: sourcePlan.foodSubstitutions.map((substitution) => ({
          ...substitution,
          alternativeFoodIds: [...substitution.alternativeFoodIds],
        })),
      };

      return {
        ...state,
        dietPlans: [duplicatedPlan, ...state.dietPlans],
        mealPlan: clearMealPlanCompletion(duplicatedPlan.mealPlan),
        nutritionGoal: duplicatedPlan.nutritionGoal,
        dailyNutritionTargets: normalizeDailyNutritionTargets(
          duplicatedPlan.nutritionTargets,
          getActivityMultiplierFromTrainingDaysForState(state),
        ),
        dietDayTypes: duplicatedPlan.dayTypes,
        dietWorkoutLink: duplicatedPlan.workoutLinkSettings,
        foodSubstitutions: duplicatedPlan.foodSubstitutions,
        activeDietPlanId: duplicatedPlanId,
      };
    }
    case "remove-diet-plan": {
      const removedPlan = state.dietPlans.find(
        (plan) => plan.id === action.planId,
      );
      if (!removedPlan) return state;

      const nextPlans = state.dietPlans.filter(
        (plan) => plan.id !== action.planId,
      );
      // Only re-hydrate the top-level slices (mealPlan, nutritionGoal,
      // targets, etc.) when the active plan was deleted — otherwise the
      // user is just removing an inactive copy and the live editing
      // surfaces must stay untouched.
      if (state.activeDietPlanId !== action.planId) {
        return {
          ...state,
          dietPlans: nextPlans,
        };
      }

      const fallbackPlan = nextPlans[0];
      if (!fallbackPlan) {
        // No diets left — wipe the editing surface back to empty.
        return {
          ...state,
          dietPlans: nextPlans,
          activeDietPlanId: emptyPersistedState.activeDietPlanId,
          mealPlan: [],
          nutritionGoal: emptyPersistedState.nutritionGoal,
          dailyNutritionTargets: normalizeDailyNutritionTargets(
            emptyPersistedState.dailyNutritionTargets,
            getActivityMultiplierFromTrainingDaysForState(state),
          ),
          dietDayTypes: emptyPersistedState.dietDayTypes,
          dietWorkoutLink: emptyPersistedState.dietWorkoutLink,
          foodSubstitutions: [],
        };
      }

      // Hand the live surface to the next plan in the list.
      return {
        ...state,
        dietPlans: nextPlans,
        activeDietPlanId: fallbackPlan.id,
        mealPlan: clearMealPlanCompletion(fallbackPlan.mealPlan),
        nutritionGoal: fallbackPlan.nutritionGoal,
        dailyNutritionTargets: normalizeDailyNutritionTargets(
          fallbackPlan.nutritionTargets,
          getActivityMultiplierFromTrainingDaysForState(state),
        ),
        dietDayTypes: fallbackPlan.dayTypes,
        dietWorkoutLink: fallbackPlan.workoutLinkSettings,
        foodSubstitutions: fallbackPlan.foodSubstitutions,
      };
    }
    case "activate-diet-plan": {
      const nextPlan = state.dietPlans.find((plan) => plan.id === action.planId);
      if (!nextPlan) return state;

      return {
        ...state,
        mealPlan: clearMealPlanCompletion(nextPlan.mealPlan),
        nutritionGoal: nextPlan.nutritionGoal,
        dailyNutritionTargets: normalizeDailyNutritionTargets(
          nextPlan.nutritionTargets,
          getActivityMultiplierFromTrainingDaysForState(state),
        ),
        dietDayTypes: nextPlan.dayTypes,
        dietWorkoutLink: nextPlan.workoutLinkSettings,
        foodSubstitutions: nextPlan.foodSubstitutions,
        activeDietPlanId: nextPlan.id,
      };
    }
    case "save-current-workout-program": {
      const programId =
        action.payload.programId ?? makeId("workout-program");
      const existingProgram = state.workoutPrograms.find(
        (program) => program.id === programId,
      );
      const nextProgram: SavedWorkoutProgram = {
        id: programId,
        name: action.payload.name,
        splitLabel: action.payload.splitLabel,
        startDate: action.payload.startDate,
        endDate: action.payload.endDate,
        notes: action.payload.notes,
        createdAt: existingProgram?.createdAt ?? new Date().toISOString(),
        workoutPlan: action.payload.workoutPlan,
      };

      return {
        ...state,
        workoutPlan: action.payload.workoutPlan,
        workoutPrograms: [
          nextProgram,
          ...state.workoutPrograms.filter((program) => program.id !== programId),
        ],
        activeWorkoutProgramId: programId,
      };
    }
    case "activate-workout-program": {
      const nextProgram = state.workoutPrograms.find(
        (program) => program.id === action.programId,
      );
      if (!nextProgram) return state;

      return {
        ...state,
        workoutPlan: nextProgram.workoutPlan,
        activeWorkoutProgramId: nextProgram.id,
      };
    }
    case "remove-workout-program": {
      const nextPrograms = state.workoutPrograms.filter(
        (program) => program.id !== action.programId,
      );
      const removedProgram = state.workoutPrograms.find(
        (program) => program.id === action.programId,
      );
      const fallbackProgram =
        state.activeWorkoutProgramId === action.programId
          ? nextPrograms[0]
          : state.workoutPrograms.find(
              (program) => program.id === state.activeWorkoutProgramId,
            ) ?? nextPrograms[0];
      const removedDayIds = new Set(removedProgram?.workoutPlan.map((day) => day.id) ?? []);

      return {
        ...state,
        workoutPrograms: nextPrograms,
        workoutPlan: fallbackProgram?.workoutPlan ?? [],
        activeWorkoutProgramId: fallbackProgram?.id ?? "",
        workoutLoadEntries: state.workoutLoadEntries.filter(
          (entry) =>
            entry.programId !== action.programId &&
            !removedDayIds.has(entry.dayId),
        ),
        workoutDayCompletions: state.workoutDayCompletions.filter(
          (completion) =>
            completion.programId !== action.programId &&
            !removedDayIds.has(completion.dayId),
        ),
        reminders: state.reminders.filter(
          (reminder) =>
            !(
              removedDayIds.has(reminder.entityId) &&
              (reminder.entityType === "workout" ||
                reminder.entityType === "cardio")
            ),
        ),
      };
    }
    case "simulate-arena":
      return {
        ...state,
        arena: {
          victories: state.arena.victories + (action.result.win ? 1 : 0),
          matches: state.arena.matches + 1,
          totalDamage: state.arena.totalDamage + action.result.damage,
          lastOpponent: action.result.opponent,
          lastResult: action.result.message,
          combatLog: [action.result.message, ...state.arena.combatLog].slice(0, 6),
        },
      };
    case "toggle-lesson":
      return {
        ...state,
        financeLessons: state.financeLessons.map((lesson) =>
          lesson.id === action.lessonId
             ? { ...lesson, completed: !lesson.completed }
            : lesson,
        ),
      };
    case "update-workout-load-batch": {
      const updates = new Map(
        action.payload.entries.map((entry) => [entry.id, entry]),
      );

      return {
        ...state,
        workoutLoadEntries: state.workoutLoadEntries.map((entry) => {
          const nextEntry = updates.get(entry.id);
          if (!nextEntry) return entry;

          return {
            ...entry,
            weightKg: nextEntry.weightKg,
            repetitions: nextEntry.repetitions,
          };
        }),
      };
    }
    case "remove-workout-load-batch":
      return {
        ...state,
        workoutLoadEntries: state.workoutLoadEntries.filter(
          (entry) => !action.entryIds.includes(entry.id),
        ),
      };
    case "save-workout-load": {
      const day = state.workoutPlan.find(
        (currentDay) => currentDay.id === action.payload.dayId,
      );
      const exercise = day?.exercises.find(
        (currentExercise) => currentExercise.id === action.payload.exerciseId,
      );
      const key = `${action.payload.dayId}:${action.payload.exerciseId}`;
      const loggedAt = new Date().toISOString();
      return {
        ...state,
        workoutLoadEntries: [
          ...action.payload.sets.map((set) => ({
            id: makeId("workout-load"),
            key,
            programId: state.activeWorkoutProgramId,
            dayId: action.payload.dayId,
            dayTitle: day?.title ?? "Sessão",
            exerciseId: action.payload.exerciseId,
            exerciseName: exercise?.name ?? action.payload.exerciseId,
            setNumber: set.setNumber,
            weightKg: set.weightKg,
            repetitions: set.repetitions,
            loggedAt,
          })),
          ...state.workoutLoadEntries,
        ],
      };
    }
    case "toggle-workout-day-completed": {
      const dateKey =
        action.payload.dateKey ?? new Date().toISOString().slice(0, 10);
      const program =
        state.workoutPrograms.find((currentProgram) =>
          currentProgram.workoutPlan.some(
            (day) => day.id === action.payload.dayId,
          ),
        ) ??
        state.workoutPrograms.find(
          (currentProgram) => currentProgram.id === state.activeWorkoutProgramId,
        ) ??
        state.workoutPrograms[0];
      const day =
        program?.workoutPlan.find(
          (currentDay) => currentDay.id === action.payload.dayId,
        ) ??
        state.workoutPlan.find(
          (currentDay) => currentDay.id === action.payload.dayId,
        );
      const completionKey = `${program?.id ?? state.activeWorkoutProgramId}:${action.payload.dayId}:${dateKey}`;
      const existingCompletion = state.workoutDayCompletions.find(
        (completion) =>
          `${completion.programId}:${completion.dayId}:${completion.dateKey}` ===
          completionKey,
      );

      if (existingCompletion) {
        return {
          ...state,
          workoutDayCompletions: state.workoutDayCompletions.filter(
            (completion) => completion.id !== existingCompletion.id,
          ),
        };
      }

      return {
        ...state,
        workoutDayCompletions: [
          {
            id: makeId("workout-day"),
            programId: program?.id ?? state.activeWorkoutProgramId,
            dayId: action.payload.dayId,
            dayTitle: day?.title ?? "Treino do dia",
            dateKey,
            completedAt: new Date().toISOString(),
          },
          ...state.workoutDayCompletions,
        ],
      };
    }
    case "add-custom-food":
      return {
        ...state,
        foodDatabase: [
          {
            id: action.payload.id ?? makeId("food"),
            favorite: false,
            source: action.payload.source ?? "custom",
            ...action.payload,
          },
          ...state.foodDatabase,
        ],
      };
    case "toggle-food-favorite":
      return {
        ...state,
        foodDatabase: state.foodDatabase.map((food) =>
          food.id === action.foodId
             ? {
                ...food,
                favorite: !food.favorite,
              }
            : food,
        ),
      };
    case "add-meal-block": {
      const nextMealPlan = [
        ...state.mealPlan,
        {
          id: makeId("meal-block"),
          title: action.payload.title,
          time: action.payload.time,
          category: action.payload.category,
          items: [],
          notes: action.payload.notes,
        },
      ].sort((left, right) => left.time.localeCompare(right.time));

      return {
        ...state,
        mealPlan: nextMealPlan,
      };
    }
    case "update-meal-block": {
      const nextMealPlan = state.mealPlan
        .map((block) =>
          block.id === action.payload.blockId
            ? {
                ...block,
                ...action.payload.patch,
              }
            : block,
        )
        .sort((left, right) => left.time.localeCompare(right.time));

      return {
        ...state,
        mealPlan: nextMealPlan,
      };
    }
    case "remove-meal-block":
      return {
        ...state,
        mealPlan: state.mealPlan.filter((block) => block.id !== action.blockId),
        reminders: state.reminders.filter(
          (reminder) =>
            !(
              reminder.entityId === action.blockId &&
              (reminder.entityType === "meal" ||
                reminder.entityType === "supplement")
            ),
        ),
      };
    case "add-meal-item":
      return {
        ...state,
        mealPlan: state.mealPlan.map((block) =>
          block.id === action.payload.blockId
             ? {
                ...block,
                items: [
                  ...block.items,
                  {
                    id: makeId("meal-item"),
                    foodId: action.payload.foodId,
                    label: action.payload.label,
                    quantityLabel: action.payload.quantityLabel,
                    kind: action.payload.kind,
                    macros: action.payload.macros,
                    notes: action.payload.notes,
                    completed: false,
                  },
                ],
              }
            : block,
        ),
      };
    case "toggle-meal-item-completed":
      return {
        ...state,
        mealPlan: state.mealPlan.map((block) =>
          block.id === action.payload.blockId
             ? {
                ...block,
                items: block.items.map((item) =>
                  item.id === action.payload.itemId
                    ? (() => {
                        // When dateKey is passed we are toggling the
                        // item's completion for that specific calendar
                        // day (e.g. retroactively marking yesterday's
                        // meal). Otherwise we operate on "today".
                        const referenceDate = action.payload.dateKey
                          ? new Date(`${action.payload.dateKey}T12:00:00`)
                          : new Date();
                        const completedForCurrentDate = isMealItemCompletedForDate(
                          item,
                          referenceDate,
                        );
                        return {
                          ...item,
                          completed: !completedForCurrentDate,
                          completedAt: !completedForCurrentDate
                            ? referenceDate.toISOString()
                            : undefined,
                        };
                      })()
                    : item,
                ),
              }
            : block,
        ),
      };
    case "set-meal-block-items-completed":
      return {
        ...state,
        mealPlan: state.mealPlan.map((block) =>
          block.id === action.payload.blockId
             ? {
                ...block,
                items: block.items.map((item) => ({
                  ...item,
                  completed: action.payload.completed,
                  completedAt: action.payload.completed
                    ? (action.payload.dateKey
                        ? new Date(`${action.payload.dateKey}T12:00:00`).toISOString()
                        : new Date().toISOString())
                    : undefined,
                })),
              }
            : block,
        ),
      };
    case "update-meal-item":
      return {
        ...state,
        mealPlan: state.mealPlan.map((block) =>
          block.id === action.payload.blockId
             ? {
                ...block,
                items: block.items.map((item) =>
                  item.id === action.payload.itemId
                     ? {
                        ...item,
                        ...action.payload.patch,
                        notes: action.payload.patch.notes,
                        macros: action.payload.patch.macros ?? item.macros,
                      }
                    : item,
                ),
              }
            : block,
        ),
      };
    case "remove-meal-item":
      return {
        ...state,
        mealPlan: state.mealPlan.map((block) =>
          block.id === action.payload.blockId
             ? {
                ...block,
                items: block.items.filter((item) => item.id !== action.payload.itemId),
              }
            : block,
        ),
      };
    case "toggle-reminder":
      return {
        ...state,
        reminders: state.reminders.map((reminder) =>
          reminder.id === action.reminderId
             ? { ...reminder, enabled: !reminder.enabled }
            : reminder,
        ),
      };
    case "add-reminder":
      return {
        ...state,
        reminders: [
          {
            id: makeId("reminder"),
            enabled: true,
            delivery: "native-pending",
            ...action.payload,
          },
          ...state.reminders,
        ],
      };
    case "update-reminder":
      return {
        ...state,
        reminders: state.reminders.map((reminder) =>
          reminder.id === action.payload.reminderId
             ? {
                ...reminder,
                ...action.payload.patch,
              }
            : reminder,
        ),
      };
    case "update-finance-start-cash":
      return {
        ...state,
        financeBudget: {
          ...state.financeBudget,
          startCash: roundCurrencyValue(action.amount),
        },
      };
    case "add-finance-category": {
      const categoryName = normalizeFinanceCategory(
        action.payload.name,
        action.payload.kind,
      );
      return {
        ...state,
        financeCategories: ensureFinanceCategoryList(state.financeCategories, {
          name: categoryName,
          kind: action.payload.kind,
        }),
      };
    }
    case "add-finance-line":
      return {
        ...state,
        financeBudget: {
          ...state.financeBudget,
          lines: [
            (() => {
              const initialValue = roundCurrencyValue(action.payload.initialValue);
              const monthly =
                action.payload.frequency === "fixed"
                  ? fillFinanceMonths(initialValue)
                  : {
                      ...emptyFinanceMonthlyValues(),
                      [action.payload.initialMonth]: initialValue,
                    };
              const shouldSettleInitialMonth =
                action.payload.kind === "expense" &&
                isFinanceCreditCardPaymentMethod(action.payload.paymentMethod);
              const settlementState = shouldSettleInitialMonth
                ? buildFinanceSettlementState(
                    emptyFinanceMonthlyFlags(),
                    emptyFinanceMonthlyValues(),
                    action.payload.initialMonth,
                    initialValue,
                    true,
                  )
                : {
                    settledMonths: emptyFinanceMonthlyFlags(),
                    settledAmounts: emptyFinanceMonthlyValues(),
                  };

              return {
                id: makeId("finance"),
                monthly,
                ...settlementState,
                name: action.payload.name,
                kind: action.payload.kind,
                category: normalizeFinanceCategory(
                  action.payload.category,
                  action.payload.kind,
                ),
                frequency: action.payload.frequency,
                paymentMethod: action.payload.paymentMethod,
                dueDay: action.payload.dueDay,
                cardName: action.payload.cardName,
                notes: action.payload.notes,
              };
            })(),
            ...state.financeBudget.lines,
          ],
        },
        financeCategories: ensureFinanceCategoryList(state.financeCategories, {
          name: action.payload.category,
          kind: action.payload.kind,
        }),
      };
    case "update-finance-line":
      return {
        ...state,
        financeBudget: {
          ...state.financeBudget,
          lines: state.financeBudget.lines.map((line) =>
            line.id === action.payload.lineId
               ? (() => {
                  const nextCategory =
                    action.payload.patch.category !== undefined
                       ? action.payload.patch.category
                      : line.category;
                  const nextLine: FinanceBudgetLine = {
                    ...line,
                    ...action.payload.patch,
                    category: nextCategory,
                    cardName: undefined,
                  };
                  let updatedLine = nextLine;

                  if (
                    action.payload.patch.frequency === "fixed" &&
                    line.frequency !== "fixed"
                  ) {
                    const anchorMonth =
                      action.payload.contextMonth ??
                      financeMonthOrder.find(
                        (month) => (nextLine.monthly[month] ?? 0) > 0,
                      ) ??
                      "january";

                    updatedLine = {
                      ...updatedLine,
                      monthly: fillFinanceMonths(updatedLine.monthly[anchorMonth] ?? 0),
                    };
                  }

                  if (
                    action.payload.patch.frequency === "variable" &&
                    line.frequency !== "variable" &&
                    action.payload.contextMonth
                  ) {
                    updatedLine = {
                      ...updatedLine,
                      monthly: trimFutureFinanceMonths(
                        updatedLine.monthly,
                        action.payload.contextMonth,
                      ),
                    };
                  }

                  if (
                    action.payload.patch.paymentMethod !== undefined &&
                    updatedLine.kind === "expense" &&
                    action.payload.contextMonth
                  ) {
                    const shouldSettleInInvoice = isFinanceCreditCardPaymentMethod(
                      action.payload.patch.paymentMethod,
                    );
                    const monthlyValue = roundCurrencyValue(
                      updatedLine.monthly[action.payload.contextMonth] ?? 0,
                    );
                    const settlementState = buildFinanceSettlementState(
                      line.settledMonths,
                      line.settledAmounts,
                      action.payload.contextMonth,
                      monthlyValue,
                      shouldSettleInInvoice,
                    );

                    updatedLine = {
                      ...updatedLine,
                      ...settlementState,
                    };
                  }

                  return updatedLine;
                })()
              : line,
          ),
        },
        financeCategories: state.financeCategories,
      };
    case "update-finance-monthly-value":
      return {
        ...state,
        financeBudget: {
          ...state.financeBudget,
          lines: state.financeBudget.lines.map((line) =>
            line.id === action.payload.lineId
               ? (() => {
                  const monthly =
                    line.frequency === "fixed"
                       ? fillFinanceMonths(roundCurrencyValue(action.payload.value))
                      : {
                          ...line.monthly,
                          [action.payload.month]: roundCurrencyValue(action.payload.value),
                        };
                  const settledAmounts = normalizeFinanceAmounts(
                    line.settledAmounts,
                    monthly,
                    line.settledMonths,
                  );
                  return {
                    ...line,
                    monthly,
                    settledAmounts: financeMonthOrder.reduce(
                      (nextAmounts, month) => {
                        nextAmounts[month] = Math.min(
                          settledAmounts[month] ?? 0,
                          monthly[month] ?? 0,
                        );
                        return nextAmounts;
                      },
                      {} as Record<FinanceMonthId, number>,
                    ),
                  };
                })()
              : line,
          ),
        },
      };
    case "toggle-finance-line-settled":
      return {
        ...state,
        financeBudget: {
          ...state.financeBudget,
          lines: state.financeBudget.lines.map((line) =>
            line.id === action.payload.lineId
               ? (() => {
                  const settledAmounts = normalizeFinanceAmounts(
                    line.settledAmounts,
                    line.monthly,
                    line.settledMonths,
                  );
                    const monthlyValue = roundCurrencyValue(line.monthly[action.payload.month] ?? 0);
                  const nextAmount =
                    settledAmounts[action.payload.month] >= monthlyValue ? 0 : monthlyValue;
                  return {
                    ...line,
                    settledAmounts: {
                      ...settledAmounts,
                      [action.payload.month]: nextAmount,
                    },
                    settledMonths: {
                      ...normalizeFinanceFlags(line.settledMonths),
                      [action.payload.month]: nextAmount >= monthlyValue && monthlyValue > 0,
                    },
                  };
                })()
              : line,
          ),
        },
      };
    case "apply-finance-settlement":
      return {
        ...state,
        financeBudget: {
          ...state.financeBudget,
          lines: state.financeBudget.lines.map((line) =>
            line.id === action.payload.lineId
               ? (() => {
                  const settledAmounts = normalizeFinanceAmounts(
                    line.settledAmounts,
                    line.monthly,
                    line.settledMonths,
                  );
                const monthlyValue = roundCurrencyValue(line.monthly[action.payload.month] ?? 0);
                const currentSettled = settledAmounts[action.payload.month] ?? 0;
                  const nextAmount = Math.min(
                    monthlyValue,
                    roundCurrencyValue(currentSettled + action.payload.amount),
                  );
                  return {
                    ...line,
                    settledAmounts: {
                      ...settledAmounts,
                      [action.payload.month]: nextAmount,
                    },
                    settledMonths: {
                      ...normalizeFinanceFlags(line.settledMonths),
                      [action.payload.month]: nextAmount >= monthlyValue && monthlyValue > 0,
                    },
                  };
                })()
              : line,
          ),
        },
      };
    case "clear-finance-settlement":
      return {
        ...state,
        financeBudget: {
          ...state.financeBudget,
          lines: state.financeBudget.lines.map((line) =>
            line.id === action.payload.lineId
               ? {
                  ...line,
                  settledAmounts: {
                    ...normalizeFinanceAmounts(
                      line.settledAmounts,
                      line.monthly,
                      line.settledMonths,
                    ),
                    [action.payload.month]: 0,
                  },
                  settledMonths: {
                    ...normalizeFinanceFlags(line.settledMonths),
                    [action.payload.month]: false,
                  },
                }
              : line,
          ),
        },
      };
    case "roll-finance-line-to-next-month":
      return {
        ...state,
        financeBudget: {
          ...state.financeBudget,
          lines: state.financeBudget.lines.map((line) =>
            line.id === action.payload.lineId
               ? (() => {
                  const currentMonthIndex = financeMonthOrder.indexOf(action.payload.month);
                  if (currentMonthIndex < 0 || currentMonthIndex >= financeMonthOrder.length - 1) {
                    return line;
                  }

                  const nextMonth = financeMonthOrder[currentMonthIndex + 1];
                  const settledAmounts = normalizeFinanceAmounts(
                    line.settledAmounts,
                    line.monthly,
                    line.settledMonths,
                  );
                  const currentValue = roundCurrencyValue(
                      line.monthly[action.payload.month] ?? 0,
                  );
                  const currentSettled = roundCurrencyValue(
                      settledAmounts[action.payload.month] ?? 0,
                  );
                  const pendingAmount = roundCurrencyValue(
                    Math.max(currentValue - currentSettled, 0),
                  );

                  if (pendingAmount <= 0) {
                    return line;
                  }

                  const nextMonthly = {
                    ...line.monthly,
                    [action.payload.month]: currentSettled,
                    [nextMonth]: roundCurrencyValue(
                      (line.monthly[nextMonth] ?? 0) + pendingAmount,
                    ),
                  };
                  const nextSettledAmounts = normalizeFinanceAmounts(
                    {
                      ...settledAmounts,
                      [action.payload.month]: currentSettled,
                    },
                    nextMonthly,
                    line.settledMonths,
                  );

                  return {
                    ...line,
                    monthly: nextMonthly,
                    settledAmounts: {
                      ...nextSettledAmounts,
                      [action.payload.month]: currentSettled,
                    },
                    settledMonths: {
                      ...normalizeFinanceFlags(line.settledMonths),
                      [action.payload.month]:
                        currentSettled >= nextMonthly[action.payload.month] &&
                        nextMonthly[action.payload.month] > 0,
                      [nextMonth]:
                      (nextSettledAmounts[nextMonth] ?? 0) >= nextMonthly[nextMonth] &&
                        nextMonthly[nextMonth] > 0,
                    },
                  };
                })()
              : line,
          ),
        },
      };
    case "cancel-finance-line-month":
      return {
        ...state,
        financeBudget: {
          ...state.financeBudget,
          lines: state.financeBudget.lines.map((line) =>
            line.id === action.payload.lineId
               ? (() => {
                  const settledAmounts = normalizeFinanceAmounts(
                    line.settledAmounts,
                    line.monthly,
                    line.settledMonths,
                  );
                const settledAmount = settledAmounts[action.payload.month] ?? 0;
                  return {
                    ...line,
                    monthly: {
                      ...line.monthly,
                      [action.payload.month]: roundCurrencyValue(settledAmount),
                    },
                    settledAmounts: {
                      ...settledAmounts,
                      [action.payload.month]: roundCurrencyValue(settledAmount),
                    },
                    settledMonths: {
                      ...normalizeFinanceFlags(line.settledMonths),
                      [action.payload.month]:
                        roundCurrencyValue(settledAmount) > 0,
                    },
                  };
                })()
              : line,
          ),
        },
      };
    case "update-finance-invoice-base":
      return {
        ...state,
        financeBudget: {
          ...state.financeBudget,
          cardInvoiceBase: {
            ...normalizeFinanceMonths(state.financeBudget.cardInvoiceBase),
            [action.payload.month]: roundCurrencyValue(action.payload.value),
          },
        },
      };
    case "remove-finance-line":
      return {
        ...state,
        financeBudget: {
          ...state.financeBudget,
          lines: state.financeBudget.lines.filter(
            (line) => line.id !== action.lineId,
          ),
        },
      };
    case "close-finance-month": {
      // Atomic month-close. The key rule: every line (variable AND
      // fixed) gets zeroed FOR THE CLOSED MONTH ONLY. Other months
      // stay intact.
      //
      // We bypass update-finance-monthly-value on purpose: that
      // action fan-outs a single write across all 12 months for
      // frequency: "fixed" lines (the "type once, applies everywhere"
      // UX). Close-month needs the opposite — surgical, per-month
      // edits — so we manually spread `line.monthly` and override the
      // single closed-month slot.
      //
      // Rules:
      //  • Variable AND fixed lines → zero the closed month, leave
      //    every other month untouched. Fixed lines effectively get a
      //    one-month "hole" on the closed month; conceptually that
      //    month was paid out and is no longer a forecast obligation.
      //  • settledAmounts/settledMonths for the closed month → cleared
      //    on credit-card lines.
      //  • cardInvoiceBase[month] → cleared (manual fatura total).
      const month = action.month;
      const nextLines = state.financeBudget.lines.map((line) => {
        let nextLine = line;

        // Zero out the closed month on every line that has a non-zero
        // value there — works for both variable and fixed without
        // touching any other month.
        if ((line.monthly?.[month] ?? 0) !== 0) {
          const monthly = {
            ...line.monthly,
            [month]: 0,
          };
          const settledAmounts = normalizeFinanceAmounts(
            line.settledAmounts,
            monthly,
            line.settledMonths,
          );
          nextLine = {
            ...nextLine,
            monthly,
            settledAmounts: financeMonthOrder.reduce(
              (next, m) => {
                next[m] = Math.min(settledAmounts[m] ?? 0, monthly[m] ?? 0);
                return next;
              },
              {} as Record<FinanceMonthId, number>,
            ),
          };
        }

        // Clear settlement for the closed month on credit-card lines.
        if (
          isFinanceCreditCardPaymentMethod(line.paymentMethod) &&
          ((line.settledAmounts?.[month] ?? 0) > 0 ||
            Boolean(line.settledMonths?.[month]))
        ) {
          nextLine = {
            ...nextLine,
            settledAmounts: {
              ...normalizeFinanceAmounts(
                nextLine.settledAmounts,
                nextLine.monthly,
                nextLine.settledMonths,
              ),
              [month]: 0,
            },
            settledMonths: {
              ...normalizeFinanceFlags(nextLine.settledMonths),
              [month]: false,
            },
          };
        }

        return nextLine;
      });

      return {
        ...state,
        financeBudget: {
          ...state.financeBudget,
          lines: nextLines,
          cardInvoiceBase: {
            ...normalizeFinanceMonths(state.financeBudget.cardInvoiceBase),
            [month]: 0,
          },
        },
      };
    }
    case "set-sleep-plan":
      return { ...state, sleepPlan: action.payload };
    case "set-sleep-history":
      return { ...state, sleepHistory: action.payload };
    case "set-module-state": {
      const nextBucket = {
        ...(state.moduleState ?? {}),
        [action.key]: action.value,
      };
      // Drop slots whose value is null/undefined so the bucket stays tidy.
      if (action.value === null || action.value === undefined) {
        delete nextBucket[action.key];
      }
      return { ...state, moduleState: nextBucket };
    }
    default:
      return state;
  }
}

function normalizeFinanceMonths(
  monthly?: Partial<Record<FinanceMonthId, number>>,
): Record<FinanceMonthId, number> {
  const merged = {
    ...emptyFinanceMonthlyValues(),
    ...monthly,
  };
  return financeMonthOrder.reduce(
    (normalized, month) => {
      normalized[month] = roundCurrencyValue(merged[month] ?? 0);
      return normalized;
    },
    {} as Record<FinanceMonthId, number>,
  );
}

function normalizeFinanceFlags(
  flags?: Partial<Record<FinanceMonthId, boolean>>,
): Record<FinanceMonthId, boolean> {
  return {
    ...emptyFinanceMonthlyFlags(),
    ...flags,
  };
}

function normalizeFinanceAmounts(
  amounts: Partial<Record<FinanceMonthId, number>> | undefined,
  monthly: Record<FinanceMonthId, number>,
  flags?: Partial<Record<FinanceMonthId, boolean>>,
): Record<FinanceMonthId, number> {
  const normalizedFlags = normalizeFinanceFlags(flags);
  return financeMonthOrder.reduce(
    (normalized, month) => {
      const fallbackAmount = normalizedFlags[month] ? (monthly[month] ?? 0) : 0;
      normalized[month] = roundCurrencyValue(amounts?.[month] ?? fallbackAmount);
      return normalized;
    },
    {} as Record<FinanceMonthId, number>,
  );
}

function resolveNutritionCaloriesTarget(
  basalMetabolicRate: number,
  goalAdjustmentKcal: number,
  activityMultiplier: number = 1,
) {
  // TDEE = BMR × activity multiplier. Then ± the user's cut/bulk
  // adjustment. activityMultiplier defaults to 1 for backward compat
  // (callsites that don't pass it stay on the old BMR + adjustment
  // formula); the four nutrition callsites below pass the value from
  // getActivityMultiplierFromTrainingDaysForState.
  const tdee = basalMetabolicRate * activityMultiplier;
  return Math.max(0, Math.round(tdee + goalAdjustmentKcal));
}

/** Reads the active workout program and maps non-rest days/week to a
 *  TDEE multiplier. Falls back to 1.2 (sedentary) when no program is
 *  active — same baseline as a person with zero scheduled workouts. */
function getActivityMultiplierFromTrainingDaysForState(
  state: PersistedState,
): number {
  const program = state.workoutPrograms.find(
    (p) => p.id === state.activeWorkoutProgramId,
  );
  if (!program) return getActivityMultiplierFromTrainingDays(0);
  const days = program.workoutPlan.filter((d) => !d.isRestDay).length;
  return getActivityMultiplierFromTrainingDays(days);
}

function resolveNutritionFiberTarget(
  caloriesTarget: number,
  bodyWeightKg: number,
  config: {
    fiberStrategy: "per-calories" | "per-kg";
    fiberPerKg: number;
    fiberRatioGrams: number;
    fiberRatioCalories: number;
  },
) {
  if (config.fiberStrategy === "per-kg") {
    return Number((bodyWeightKg * config.fiberPerKg).toFixed(1));
  }

  const safeCaloriesBase = Math.max(1, config.fiberRatioCalories);
  return Number(
    ((caloriesTarget / safeCaloriesBase) * config.fiberRatioGrams).toFixed(1),
  );
}

function normalizeDailyNutritionTargets(
  targets: PersistedState["dailyNutritionTargets"] | undefined,
  // Activity multiplier from the user's active workout program. Defaults
  // to 1 so legacy callers (or callers without state context) don't break.
  // Callsites with access to state should pass
  // getActivityMultiplierFromTrainingDaysForState(state).
  activityMultiplier: number = 1,
) {
  const fallback = initialPersistedState.dailyNutritionTargets;
  const bodyWeightKg = targets?.bodyWeightKg ?? fallback.bodyWeightKg;
  const bodyHeightCm = targets?.bodyHeightCm ?? fallback.bodyHeightCm;
  const ageYears = targets?.ageYears ?? fallback.ageYears;
  const biologicalSex = targets?.biologicalSex ?? fallback.biologicalSex;
  const basalMetabolicRateSource =
    targets?.basalMetabolicRateSource ?? fallback.basalMetabolicRateSource;
  const waterMlPerKg =
    targets?.perKg?.waterMl ??
    (targets?.waterMl && bodyWeightKg ? targets.waterMl / bodyWeightKg : fallback.perKg.waterMl);
  const proteinPerKg = targets?.perKg?.protein ?? fallback.perKg.protein;
  const carbsPerKg = targets?.perKg?.carbs ?? fallback.perKg.carbs;
  const fatPerKg = targets?.perKg?.fat ?? fallback.perKg.fat;
  const targetWeightKg = targets?.weightGoal?.targetWeightKg ?? fallback.weightGoal.targetWeightKg;
  const weeklyChangeKg =
    targets?.weightGoal?.weeklyChangeKg ?? fallback.weightGoal.weeklyChangeKg;
  const fiberStrategy = targets?.fiberStrategy ?? fallback.fiberStrategy;
  const fiberPer1000Kcal = targets?.fiberPer1000Kcal ?? fallback.fiberPer1000Kcal;
  const fiberPerKg = targets?.fiberPerKg ?? fallback.fiberPerKg;
  const fiberRatioGrams =
    targets?.fiberRatioGrams ??
    (typeof targets?.fiberPer1000Kcal === "number"
      ? targets.fiberPer1000Kcal
      : fallback.fiberRatioGrams);
  const fiberRatioCalories =
    targets?.fiberRatioCalories ?? fallback.fiberRatioCalories;
  const sodiumTargetMg = targets?.sodiumTargetMg ?? fallback.sodiumTargetMg;
  const proteinTarget = Number((bodyWeightKg * proteinPerKg).toFixed(1));
  const carbsTarget = Number((bodyWeightKg * carbsPerKg).toFixed(1));
  const fatTarget = Number((bodyWeightKg * fatPerKg).toFixed(1));
  const basalMetabolicRate = resolveBasalMetabolicRate({
    bodyWeightKg,
    bodyHeightCm,
    ageYears,
    biologicalSex,
    basalMetabolicRate: targets?.basalMetabolicRate,
    basalMetabolicRateSource,
  });
  const goalAdjustmentKcal =
    typeof targets?.goalAdjustmentKcal === "number"
      ? targets.goalAdjustmentKcal
      : typeof targets?.totals?.calories === "number"
        ? Math.round(targets.totals.calories - basalMetabolicRate)
        : fallback.goalAdjustmentKcal;
  const caloriesTarget = resolveNutritionCaloriesTarget(
    basalMetabolicRate,
    goalAdjustmentKcal,
    activityMultiplier,
  );

  return {
    ...fallback,
    ...targets,
    bodyWeightKg,
    bodyHeightCm,
    ageYears,
    biologicalSex,
    basalMetabolicRate,
    basalMetabolicRateSource,
    goalAdjustmentKcal,
    waterMl: Math.round(bodyWeightKg * waterMlPerKg),
    weightGoal: {
      targetWeightKg,
      weeklyChangeKg,
    },
    fiberStrategy,
    fiberPer1000Kcal,
    fiberPerKg,
    fiberRatioGrams,
    fiberRatioCalories,
    sodiumTargetMg,
    totals: {
      ...fallback.totals,
      ...targets?.totals,
      protein: proteinTarget,
      carbs: carbsTarget,
      fat: fatTarget,
      fiber: resolveNutritionFiberTarget(caloriesTarget, bodyWeightKg, {
        fiberStrategy,
        fiberPerKg,
        fiberRatioGrams,
        fiberRatioCalories,
      }),
      sodium: sodiumTargetMg,
      calories: caloriesTarget,
    },
    perKg: {
      ...fallback.perKg,
      ...targets?.perKg,
      waterMl: waterMlPerKg,
      protein: proteinPerKg,
      carbs: carbsPerKg,
      fat: fatPerKg,
    },
  };
}

function isLegacyNutritionHydrationTask(task: Task) {
  const normalizedTitle = task.title.trim().toLocaleLowerCase("pt-BR");
  const normalizedDescription = task.description.trim().toLocaleLowerCase("pt-BR");

  return (
    task.id === "task-water" ||
    (task.moduleId === "nutrition" &&
      normalizedTitle.includes("hidratação diária") &&
      (normalizedTitle.includes("3l") ||
        normalizedTitle.includes("3 l") ||
        normalizedDescription.includes("3 litros")))
  );
}

function normalizeDietDayTypes(
  dayTypes?: Partial<Record<Weekday, NutritionDayType>>,
): Record<Weekday, NutritionDayType> {
  return {
    ...emptyPersistedState.dietDayTypes,
    ...dayTypes,
  };
}

function normalizeDietWeekSchedule(
  schedule: Partial<Record<Weekday, string>> | undefined,
  dietPlans: SavedDietPlan[],
  fallbackPlanId: string,
): Record<Weekday, string> {
  const validPlanIds = new Set(dietPlans.map((plan) => plan.id));
  const fallbackId =
    (validPlanIds.has(fallbackPlanId) ? fallbackPlanId : undefined) ??
    dietPlans[0]?.id ??
    emptyPersistedState.activeDietPlanId;

  return Object.entries(emptyPersistedState.dietWeekSchedule).reduce(
    (normalized, [weekday, defaultPlanId]) => {
      const requestedPlanId = schedule?.[weekday as Weekday];
      const basePlanId =
        requestedPlanId && validPlanIds.has(requestedPlanId)
          ? requestedPlanId
          : validPlanIds.has(defaultPlanId)
            ? defaultPlanId
            : fallbackId;
      normalized[weekday as Weekday] = basePlanId;
      return normalized;
    },
    {} as Record<Weekday, string>,
  );
}

function normalizeDietWorkoutLink(
  settings?: Partial<DietWorkoutLinkSettings>,
): DietWorkoutLinkSettings {
  return {
    ...emptyPersistedState.dietWorkoutLink,
    ...settings,
  };
}

function normalizeFoodSubstitutions(
  substitutions?: FoodSubstitutionGroup[],
): FoodSubstitutionGroup[] {
  return substitutions?.length ? substitutions : emptyPersistedState.foodSubstitutions;
}

function normalizeDietPlans(
  plans: SavedDietPlan[] | undefined,
  currentMealPlan: PersistedState["mealPlan"],
  currentTargets: PersistedState["dailyNutritionTargets"],
  currentNutritionGoal: PersistedState["nutritionGoal"],
  currentDayTypes: Record<Weekday, NutritionDayType>,
) {
  if (!plans?.length) {
    if (!currentMealPlan.length) {
      return [];
    }

    return [
      {
        id: "diet-current",
        name: "Dieta atual",
        createdAt: new Date().toISOString(),
        mealPlan: clearMealPlanCompletion(currentMealPlan),
        nutritionGoal: normalizeNutritionGoal(currentNutritionGoal),
        nutritionTargets: currentTargets,
        dayTypes: currentDayTypes,
        workoutLinkSettings: emptyPersistedState.dietWorkoutLink,
        foodSubstitutions: emptyPersistedState.foodSubstitutions,
      },
    ];
  }

  return plans.map((plan) => ({
    ...plan,
    mealPlan: clearMealPlanCompletion(
      plan.mealPlan?.length ? plan.mealPlan : currentMealPlan,
    ),
    nutritionGoal: normalizeNutritionGoal(
      plan.nutritionGoal ?? currentNutritionGoal,
    ),
    nutritionTargets: normalizeDailyNutritionTargets(plan.nutritionTargets),
    dayTypes: normalizeDietDayTypes(plan.dayTypes),
    workoutLinkSettings: normalizeDietWorkoutLink(plan.workoutLinkSettings),
    foodSubstitutions: normalizeFoodSubstitutions(plan.foodSubstitutions),
  }));
}

function normalizeWorkoutPlan(
  plan: WorkoutDayPlan[] | undefined,
): WorkoutDayPlan[] {
  const source = plan?.length ? plan : emptyPersistedState.workoutPlan;
  const trainingDays = source
    .filter((day) => !day.isRestDay || day.exercises?.length)
    .slice(0, 7)
    .map((day) => ({
      ...day,
      isRestDay: false,
      exercises: day.exercises ?? [],
      accessoryWork: day.accessoryWork ?? [],
    }));

  return trainingDays.length ? trainingDays : emptyPersistedState.workoutPlan;
}

function normalizeWorkoutPrograms(
  programs: SavedWorkoutProgram[] | undefined,
  currentWorkoutPlan: PersistedState["workoutPlan"],
) {
  const basePlan = normalizeWorkoutPlan(currentWorkoutPlan);
  const normalizeProgram = (program: SavedWorkoutProgram) => ({
    ...program,
    splitLabel:
      program.splitLabel?.trim() || `${normalizeWorkoutPlan(program.workoutPlan).length}x / semana`,
    workoutPlan: normalizeWorkoutPlan(
      program.workoutPlan?.length ? program.workoutPlan : basePlan,
    ),
  });
  if (!programs?.length) {
    return basePlan.length
      ? [
          normalizeProgram({
            id: "workout-migrated-current",
            name: "Treino atual",
            splitLabel: `${basePlan.length}x / semana`,
            createdAt: new Date().toISOString(),
            workoutPlan: basePlan,
          }),
        ]
      : [];
  }

  return programs.map(normalizeProgram);
}

function normalizeWorkoutLoadEntries(
  loads: WorkoutLoadEntry[] | undefined,
  programs: SavedWorkoutProgram[],
  activeProgramId: string,
) {
  const activeProgram =
    programs.find((program) => program.id === activeProgramId) ?? programs[0];
  const source = loads?.length ? loads : emptyPersistedState.workoutLoadEntries;

  return source
    .map((entry, index) => {
      const program =
        programs.find((programOption) => programOption.id === entry.programId) ??
        programs.find((programOption) =>
          programOption.workoutPlan.some(
            (day) =>
              day.id === entry.dayId &&
              day.exercises.some(
                (exercise) =>
                  exercise.id === entry.exerciseId ||
                  exercise.name === entry.exerciseName,
              ),
          ),
        ) ??
        activeProgram;
      const day =
        program?.workoutPlan.find((currentDay) => currentDay.id === entry.dayId) ??
        activeProgram?.workoutPlan.find((currentDay) => currentDay.id === entry.dayId);
      const exercise = day?.exercises.find(
        (currentExercise) =>
          currentExercise.id === entry.exerciseId ||
          currentExercise.name === entry.exerciseName,
      );
      const weightKg = Number(entry.weightKg);
      const repetitions =
        Number(entry.repetitions) ||
        Number.parseInt(exercise?.repRange?.split("-")[0] ?? "", 10) ||
        0;
      const key = entry.key ?? `${entry.dayId}:${entry.exerciseId}`;

      return {
        id: entry.id ?? `${key}:${entry.loggedAt ?? index}`,
        key,
        programId:
          program?.id ??
          activeProgram?.id ??
          emptyPersistedState.activeWorkoutProgramId,
        dayId: entry.dayId,
        dayTitle: entry.dayTitle ?? day?.title ?? "Sessão",
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName ?? exercise?.name ?? "Exercício",
        setNumber: Number(entry.setNumber) || 1,
        weightKg,
        repetitions,
        loggedAt: entry.loggedAt ?? new Date().toISOString(),
      };
    })
    .filter(
      (entry) =>
        Number.isFinite(entry.weightKg) &&
        entry.weightKg > 0 &&
        Number.isFinite(entry.setNumber) &&
        entry.setNumber > 0 &&
        Number.isFinite(entry.repetitions) &&
        entry.repetitions > 0,
    )
    .sort(
      (left, right) =>
        new Date(right.loggedAt).getTime() - new Date(left.loggedAt).getTime(),
    );
}

function normalizeWorkoutDayCompletions(
  completions: WorkoutDayCompletion[] | undefined,
  programs: SavedWorkoutProgram[],
  activeProgramId: string,
) {
  const activeProgram =
    programs.find((program) => program.id === activeProgramId) ?? programs[0];
  const source =
    completions?.length
      ? completions
      : emptyPersistedState.workoutDayCompletions;
  const deduped = new Map<string, WorkoutDayCompletion>();

  source.forEach((completion, index) => {
    const program =
      programs.find((programOption) => programOption.id === completion.programId) ??
      programs.find((programOption) =>
        programOption.workoutPlan.some((day) => day.id === completion.dayId),
      ) ??
      activeProgram;
    const day =
      program?.workoutPlan.find((currentDay) => currentDay.id === completion.dayId) ??
      activeProgram?.workoutPlan.find(
        (currentDay) => currentDay.id === completion.dayId,
      );
    const completedAt = completion.completedAt ?? new Date().toISOString();
    const dateKey = completion.dateKey ?? completedAt.slice(0, 10);
    const normalized: WorkoutDayCompletion = {
      id:
        completion.id ??
        `${program?.id ?? activeProgramId}:${completion.dayId}:${dateKey}:${index}`,
      programId:
        program?.id ??
        completion.programId ??
        activeProgramId ??
        emptyPersistedState.activeWorkoutProgramId,
      dayId: completion.dayId,
      dayTitle: completion.dayTitle ?? day?.title ?? "Treino do dia",
      dateKey,
      completedAt,
    };

    deduped.set(
      `${normalized.programId}:${normalized.dayId}:${normalized.dateKey}`,
      normalized,
    );
  });

  return [...deduped.values()].sort(
    (left, right) =>
      new Date(right.completedAt).getTime() -
      new Date(left.completedAt).getTime(),
  );
}

function normalizeHouseholdSupplies(
  supplies: HouseholdSupplyItem[] | undefined,
) {
  return (supplies?.length ? supplies : emptyPersistedState.householdSupplies).map(
    (supply, index) => ({
      id: supply.id ?? `household-supply-${index}`,
      name: supply.name?.trim() || "Produto sem nome",
      category: supply.category?.trim() || undefined,
      unitPrice: roundCurrencyValue(Math.max(0, Number(supply.unitPrice) || 0)),
      packageQuantity: Math.max(1, Math.round(Number(supply.packageQuantity) || 1)),
      monthlyNeed: Math.max(1, Math.round(Number(supply.monthlyNeed) || 1)),
      link: supply.link?.trim() || undefined,
    }),
  );
}

function normalizeShoppingTrackedItem(
  item: Partial<ShoppingTrackedItem> | undefined,
  scope: ShoppingModuleScope,
  index: number,
): ShoppingTrackedItem {
  const purchaseMode =
    scope === "market" && item?.purchaseMode === "presential"
      ? "presential"
      : "online";

  return {
    id: item?.id ?? `${scope}-tracked-${index}`,
    name: item?.name?.trim() || "Item monitorado",
    brand: item?.brand?.trim() || "",
    quantity: item?.quantity?.trim() || "",
    mealBlockIds: Array.isArray(item?.mealBlockIds)
      ? item.mealBlockIds
          .map((mealBlockId) => mealBlockId?.trim())
          .filter((mealBlockId): mealBlockId is string => Boolean(mealBlockId))
      : [],
    scheduleLabel: item?.scheduleLabel?.trim() || undefined,
    categoryLabel: item?.categoryLabel?.trim() || undefined,
    dailyDose: Math.max(0.01, Number(item?.dailyDose) || 1),
    // "Opção 2" — decomposed daily dose. Optional, but parsed/clamped
    // when present so the UI gets sane defaults.
    servingsPerDay: (() => {
      const raw = Number(item?.servingsPerDay);
      if (!Number.isFinite(raw) || raw <= 0) return undefined;
      return Math.max(1, Math.round(raw));
    })(),
    servingAmount: (() => {
      const raw = Number(item?.servingAmount);
      if (!Number.isFinite(raw) || raw <= 0) return undefined;
      return raw;
    })(),
    servingFrequency: (() => {
      const raw = item?.servingFrequency;
      if (raw === "weekly" || raw === "monthly" || raw === "daily") return raw;
      return undefined;
    })(),
    monthlyUnits: Math.max(0.01, Number(item?.monthlyUnits) || 1),
    includeInFinance: item?.includeInFinance ?? true,
    purchaseMode,
    localStoreName:
      purchaseMode === "presential" ? item?.localStoreName?.trim() || undefined : undefined,
    // Keep manualUnitPrice for BOTH modes. In presential it's the
    // primary price; in online it's a fallback used when there's no
    // saved search offer yet (so the imported xlsx prices stick even
    // after the item is flipped to online).
    manualUnitPrice:
      Math.max(0, Number(item?.manualUnitPrice) || 0) || undefined,
    referenceUrl: item?.referenceUrl?.trim() || undefined,
    preferredResultId: item?.preferredResultId?.trim() || undefined,
    // Purchase-frequency stagger control:
    //   • nextPurchaseMonth: 1..12, the calendar month of the next
    //     scheduled purchase. The interval between purchases is derived
    //     from monthlyUnits (1/monthlyUnits rounded) in the forecast UI,
    //     so no separate intervalMonths field is needed.
    nextPurchaseMonth: (() => {
      const raw = Number(item?.nextPurchaseMonth);
      if (!Number.isFinite(raw)) return undefined;
      const rounded = Math.round(raw);
      if (rounded < 1 || rounded > 12) return undefined;
      return rounded;
    })(),
    createdAt: item?.createdAt ?? new Date().toISOString(),
    updatedAt: item?.updatedAt ?? item?.createdAt ?? new Date().toISOString(),
  };
}

function normalizeShoppingSeedName(value: string | undefined) {
  return (value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeShoppingSnapshot(
  snapshot: ShoppingSearchSnapshot | undefined,
): ShoppingSearchSnapshot | undefined {
  if (!snapshot) return undefined;
  return {
    ...snapshot,
    results: Array.isArray(snapshot.results) ? snapshot.results : [],
    sources: Array.isArray(snapshot.sources) ? snapshot.sources : [],
    searchedAt: snapshot.searchedAt ?? new Date().toISOString(),
  };
}

function normalizeShoppingModuleState(
  state: Partial<ShoppingModuleStoredState> | undefined,
  scope: ShoppingModuleScope,
  allowSeed = true,
): ShoppingModuleStoredState {
  const hasExplicitEmptyState =
    Boolean(state) &&
    Array.isArray(state?.items) &&
    state.items.length === 0 &&
    !state?.selectedItemId &&
    !Object.keys(state?.snapshots ?? {}).length &&
    !(state?.removedSeedItemIds?.length ?? 0) &&
    !(state?.removedSeedNames?.length ?? 0);

  if (!state || hasExplicitEmptyState) {
    return createEmptyShoppingModuleState();
  }

  // Brand-new / non-founder accounts must never receive the demo seed.
  // Keep whatever items the user actually added; just don't inject seeds.
  if (!allowSeed) {
    const existingOnly = Array.isArray(state?.items)
      ? state.items.map((item, index) =>
          normalizeShoppingTrackedItem(item, scope, index),
        )
      : [];
    const existingIds = new Set(existingOnly.map((item) => item.id));
    return {
      items: existingOnly,
      selectedItemId:
        state?.selectedItemId && existingIds.has(state.selectedItemId)
          ? state.selectedItemId
          : existingOnly[0]?.id,
      snapshots: Object.entries(state?.snapshots ?? {}).reduce<
        ShoppingModuleStoredState["snapshots"]
      >((next, [itemId, snapshot]) => {
        if (!existingIds.has(itemId)) return next;
        const normalized = normalizeShoppingSnapshot(snapshot);
        if (normalized) next[itemId] = normalized;
        return next;
      }, {}),
      removedSeedItemIds: Array.isArray(state?.removedSeedItemIds)
        ? state.removedSeedItemIds
            .map((id) => id?.trim())
            .filter((id): id is string => Boolean(id))
        : [],
      removedSeedNames: Array.isArray(state?.removedSeedNames)
        ? state.removedSeedNames
            .map((name) => normalizeShoppingSeedName(name))
            .filter(Boolean)
        : [],
    };
  }

  const removedSeedItemIds = Array.isArray(state?.removedSeedItemIds)
    ? state.removedSeedItemIds
          .map((itemId) => itemId?.trim())
        .filter((itemId): itemId is string => Boolean(itemId))
    : [];
  const removedSeedItemIdSet = new Set(removedSeedItemIds);
  const removedSeedNames = Array.isArray(state?.removedSeedNames)
    ? state.removedSeedNames
        .map((name) => normalizeShoppingSeedName(name))
        .filter(Boolean)
    : [];
  const removedSeedNameSet = new Set(removedSeedNames);
  const existingItems = Array.isArray(state?.items)
    ? state!.items.map((item, index) =>
        normalizeShoppingTrackedItem(item, scope, index),
      )
    : [];

  const existingNames = new Set(
    existingItems.map((item) => normalizeShoppingSeedName(item.name)),
  );

  const seedState = getShoppingSeedState(scope);
  const mergedItems = [
    ...existingItems,
    ...seedState.items.filter((seedItem) => {
      const normalizedSeedName = normalizeShoppingSeedName(seedItem.name);

      return (
        !removedSeedItemIdSet.has(seedItem.id) &&
        !removedSeedNameSet.has(normalizedSeedName) &&
        !existingItems.some((item) => item.id === seedItem.id) &&
        !existingNames.has(normalizedSeedName)
      );
    }),
  ];

  const itemIds = new Set(mergedItems.map((item) => item.id));
  const selectedItemId =
    state?.selectedItemId && itemIds.has(state.selectedItemId)
      ? state.selectedItemId
      : mergedItems[0]?.id;

  const snapshots = Object.entries({
    ...seedState.snapshots,
    ...Object.entries(state?.snapshots ?? {}).reduce<
      ShoppingModuleStoredState["snapshots"]
    >((nextSnapshots, [itemId, snapshot]) => {
      if (!itemIds.has(itemId)) return nextSnapshots;
      const normalizedSnapshot = normalizeShoppingSnapshot(snapshot);
      if (normalizedSnapshot) {
        nextSnapshots[itemId] = normalizedSnapshot;
      }
      return nextSnapshots;
    }, {}),
  }).reduce<ShoppingModuleStoredState["snapshots"]>((nextSnapshots, [itemId, snapshot]) => {
    if (itemIds.has(itemId)) {
      nextSnapshots[itemId] = snapshot;
    }
    return nextSnapshots;
  }, {});

  return {
    items: mergedItems,
    selectedItemId,
    snapshots,
    removedSeedItemIds,
    removedSeedNames,
  };
}

function getShoppingAutoLineConfig(scope: ShoppingModuleScope) {
  if (scope === "market") {
    return {
      name: "Mercado sincronizado",
      category: "Alimentação",
      paymentMethod: "debit-card" as const,
      sourceKey: "shopping-sync:market",
      notes:
        "Linha sincronizada automaticamente a partir do módulo Mercado.",
    };
  }

  return {
    name: "Suplementos sincronizados",
    category: "Saude",
    paymentMethod: "pix" as const,
    sourceKey: "shopping-sync:supplements",
    notes:
      "Linha sincronizada automaticamente a partir do módulo Suplementos.",
  };
}

function getShoppingPreferredOffer(
  moduleState: ShoppingModuleStoredState,
  item: ShoppingTrackedItem,
) {
  const snapshot = moduleState.snapshots[item.id];
  if (!snapshot?.results?.length) return undefined;

  return (
    snapshot.results.find((result) => result.id === item.preferredResultId) ??
    snapshot.results[0]
  );
}

function getShoppingUnitPrice(
  moduleState: ShoppingModuleStoredState,
  item: ShoppingTrackedItem,
) {
  if (item.purchaseMode === "presential") {
    return Math.max(0, Number(item.manualUnitPrice) || 0);
  }

  // Online: prefer the chosen live offer; fall back to manualUnitPrice
  // (which the import step may have populated from a spreadsheet) so
  // the finance sync isn't 0 until the user clicks "Buscar".
  const preferredOffer = getShoppingPreferredOffer(moduleState, item);
  if (preferredOffer?.totalPrice) return preferredOffer.totalPrice;
  return Math.max(0, Number(item.manualUnitPrice) || 0);
}

function getShoppingMonthlyTotal(moduleState: ShoppingModuleStoredState) {
  return roundCurrencyValue(
    moduleState.items.reduce((sum, item) => {
      if (!item.includeInFinance) return sum;
      const unitPrice = getShoppingUnitPrice(moduleState, item);
      if (unitPrice <= 0) return sum;
      return (
        sum +
        unitPrice * Math.max(0.01, Number(item.monthlyUnits) || 1)
      );
    }, 0),
  );
}

function syncShoppingFinanceState(
  state: PersistedState,
  allowSeed = true,
): PersistedState {
  const nextShoppingModules = {
    market: normalizeShoppingModuleState(
      state.shoppingModules?.market,
      "market",
      allowSeed,
    ),
    supplements: normalizeShoppingModuleState(
      state.shoppingModules?.supplements,
      "supplements",
      allowSeed,
    ),
  };

  const scopedTotals = {
    market: getShoppingMonthlyTotal(nextShoppingModules.market),
    supplements: getShoppingMonthlyTotal(nextShoppingModules.supplements),
  };

  let nextLines = [...state.financeBudget.lines];

  (["market", "supplements"] as ShoppingModuleScope[]).forEach((scope) => {
    const config = getShoppingAutoLineConfig(scope);
    const existingIndex = nextLines.findIndex(
      (line) =>
        line.sourceKey === config.sourceKey ||
        (line.managedBySystem && line.syncScope === scope),
    );
    const nextAmount = scopedTotals[scope];

    if (nextAmount <= 0) {
      if (existingIndex >= 0) {
        nextLines.splice(existingIndex, 1);
      }
      return;
    }

    const existingLine = existingIndex >= 0 ? nextLines[existingIndex] : undefined;
    const monthly = fillFinanceMonths(nextAmount);
    const syncedLine: FinanceBudgetLine = normalizeRecurringFinanceLine({
      id: existingLine?.id ?? makeId("finance"),
      name: config.name,
      kind: "expense",
      category: normalizeFinanceCategory(config.category, "expense"),
      frequency: "fixed",
      paymentMethod: existingLine?.paymentMethod ?? config.paymentMethod,
      notes: config.notes,
      sourceKey: config.sourceKey,
      managedBySystem: true,
      syncScope: scope,
      monthly,
      settledMonths: existingLine?.settledMonths ?? emptyFinanceMonthlyFlags(),
      settledAmounts: normalizeFinanceAmounts(
        existingLine?.settledAmounts,
        monthly,
        existingLine?.settledMonths,
      ),
    });

    if (existingIndex >= 0) {
      nextLines[existingIndex] = syncedLine;
    } else {
      nextLines = [syncedLine, ...nextLines];
    }
  });

  const nextFinanceBudget = {
    ...state.financeBudget,
    lines: nextLines,
  };

  return {
    ...state,
    shoppingModules: nextShoppingModules,
    financeBudget: nextFinanceBudget,
    financeCategories: normalizeFinanceCategories(
      state.financeCategories,
      nextFinanceBudget,
    ),
  };
}

function fillFinanceMonths(value: number) {
  return financeMonthOrder.reduce(
    (monthly, month) => {
      monthly[month] = roundCurrencyValue(value);
      return monthly;
    },
    {} as Record<FinanceMonthId, number>,
  );
}

function trimFutureFinanceMonths(
  monthly: Record<FinanceMonthId, number>,
  contextMonth: FinanceMonthId,
) {
  const contextIndex = financeMonthOrder.indexOf(contextMonth);
  return financeMonthOrder.reduce(
    (nextMonthly, month, index) => {
      nextMonthly[month] =
      index > contextIndex ? 0 : roundCurrencyValue(monthly[month] ?? 0);
      return nextMonthly;
    },
    {} as Record<FinanceMonthId, number>,
  );
}

function buildFinanceSettlementState(
  settledMonths: Partial<Record<FinanceMonthId, boolean>> | undefined,
  settledAmounts: Partial<Record<FinanceMonthId, number>> | undefined,
  month: FinanceMonthId,
  amount: number,
  settled: boolean,
) {
  return {
    settledMonths: {
      ...(settledMonths ?? emptyFinanceMonthlyFlags()),
      [month]: settled,
    },
    settledAmounts: {
      ...(settledAmounts ?? emptyFinanceMonthlyValues()),
      [month]: settled ? roundCurrencyValue(amount) : 0,
    },
  };
}

function normalizeFinanceCategory(category: string | undefined, kind: FinanceLineKind) {
  const value = (category ?? "").trim().toLowerCase();
  if (!value) return kind === "income" ? "Renda principal" : "Outros";

  const mapping: Record<string, string> = {
    income: "Renda principal",
    extra: "Renda extra",
    subscription: "Assinaturas",
    subscriptions: "Assinaturas",
    beauty: "Beleza",
    pet: "Pet",
    fitness: "Treino",
    transport: "Transporte",
    debt: "Cartão",
    housing: "Moradia",
    service: "Servicos",
    services: "Servicos",
    food: "Alimentação",
    utility: "Contas da casa",
    health: "Saude",
    communication: "Comunicação",
    tax: "Impostos",
    cash: "Dinheiro",
    "renda": "Renda principal",
    "renda principal": "Renda principal",
    "renda extra": "Renda extra",
    "assinaturas": "Assinaturas",
    "beleza": "Beleza",
    "treino": "Treino",
    "transporte": "Transporte",
    "cartão": "Cartão",
    "moradia": "Moradia",
    "servico": "Servicos",
    "servicos": "Servicos",
    "alimentação": "Alimentação",
    "contas da casa": "Contas da casa",
    "saude": "Saude",
    "comunicação": "Comunicação",
    "impostos": "Impostos",
    "dinheiro": "Dinheiro",
  };

  return mapping[value] ?? category!.trim();
}

function isSuppressedFinanceCategoryName(name: string) {
  const value = name.trim().toLowerCase();
  return (
    value === "outros" ||
    value === "impostos" ||
    value === "outros]" ||
    /^o$|^ou$|^out$|^outr$|^outro$/.test(value) ||
    /^i$|^im$|^imp$|^impo$|^impos-?$/.test(value)
  );
}

function suggestFinanceCategoryIcon(name: string, kind: FinanceLineKind) {
  const value = name.trim().toLowerCase();
  if (kind === "income") {
    if (value.includes("extra")) return "✨";
    if (value.includes("invest")) return "\u{1F3E6}";
    if (value.includes("vend")) return "\u{1F6CD}\uFE0F";
    if (value.includes("comiss")) return "\u{1F4C8}";
    if (value.includes("free")) return "\u{1F9FE}";
    return "\u{1F4BC}";
  }

  if (value.includes("morad")) return "\u{1F3E0}";
  if (value.includes("casa") || value.includes("energia") || value.includes("Água")) return "💡";
  if (value.includes("assin")) return "\u{1F501}";
  if (value.includes("aliment") || value.includes("mercado")) return "\u{1F37D}\uFE0F";
  if (value.includes("saude")) return "\u{1FA7A}";
  if (value.includes("bele")) return "✨";
  if (value.includes("pet")) return "\u{1F43E}";
  if (value.includes("treino") || value.includes("academ")) return "\u{1F3CB}\uFE0F";
  if (value.includes("transp") || value.includes("combust")) return "\u{1F697}";
  if (value.includes("cart")) return "\u{1F4B3}";
  if (value.includes("serv")) return "\u{1F6E0}\uFE0F";
  if (value.includes("comunic") || value.includes("internet") || value.includes("celular")) return "\u{1F4F6}";
  if (value.includes("impost")) return "\u{1F3DB}\uFE0F";
  if (value.includes("lazer")) return "\u{1F39F}\uFE0F";
  if (value.includes("educ")) return "\u{1F4DA}";
  if (value.includes("dinheiro")) return "\u{1F4B5}";
  return "\u{1F4E6}";
}

function ensureFinanceCategoryList(
  categories: FinanceCategory[],
  payload: {
    name: string;
    kind: FinanceLineKind;
  },
) {
  const name = normalizeFinanceCategory(payload.name, payload.kind);
  const exists = categories.some(
    (category) =>
      category.kind === payload.kind &&
      category.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );

  if (exists) return categories;

  return [
    ...categories,
    {
      id: makeId("finance-category"),
      name,
      kind: payload.kind,
      icon: suggestFinanceCategoryIcon(name, payload.kind),
    },
  ];
}

function normalizeFinanceCategories(
  categories: FinanceCategory[] | undefined,
  budget: FinanceYearBudget,
) {
  const usedCategoryKeys = new Set(
    budget.lines.map((line) => `${line.kind}:${normalizeFinanceCategory(line.category, line.kind).toLowerCase()}`),
  );
  let nextCategories = categories?.map((category) => ({
    ...category,
    name: normalizeFinanceCategory(category.name, category.kind),
    icon: category.icon || suggestFinanceCategoryIcon(category.name, category.kind),
  }))
    .filter((category) => {
      const key = `${category.kind}:${category.name.trim().toLowerCase()}`;
      return !isSuppressedFinanceCategoryName(category.name) || usedCategoryKeys.has(key);
    }) ?? initialPersistedState.financeCategories;

  for (const line of budget.lines) {
    nextCategories = ensureFinanceCategoryList(nextCategories, {
      name: line.category,
      kind: line.kind,
    });
  }

  return nextCategories;
}

function inferFinancePaymentMethod(line: {
  name?: string;
  category?: string;
  id?: string;
}): FinancePaymentMethod {
  const value = `${line.id ?? ""} ${line.name ?? ""} ${line.category ?? ""}`.toLowerCase();
  if (value.includes("inter") || value.includes("cart")) return "credit-card";
  if (value.includes("iptu") || value.includes("energia")) return "bank-slip";
  if (value.includes("condominio")) return "bank-transfer";
  if (value.includes("salario")) return "bank-transfer";
  if (value.includes("renda extra")) return "pix";
  if (value.includes("mercado")) return "debit-card";
  if (value.includes("faxineira") || value.includes("suplementos")) return "pix";
  if (value.includes("dinheiro")) return "cash";
  return "cash";
}

// looksLikeLegacyFinanceSeed + correctedSeedInvoiceBase removed:
// they were a one-off migration that detected a specific buggy seed
// fingerprint (cardInvoiceBase[apr]=6337.28, may=3344.8, jun=2210.3)
// and overwrote it. Long past useful — now they'd just hide real edits.

function normalizeRecurringFinanceLine(line: FinanceBudgetLine): FinanceBudgetLine {
  const normalizedName = line.name.trim().toLowerCase();

  if (
    normalizedName === "cortar cabelo e barba" ||
    normalizedName === "comida e tapetinho diana"
  ) {
    if (line.paymentMethod === "cash") {
      return {
        ...line,
        paymentMethod: "credit-card",
      };
    }
  }

  return line;
}

function migrateFinanceBudget(
  budget: Partial<FinanceYearBudget> | null | undefined,
): FinanceYearBudget {
  if (!budget) {
    return emptyPersistedState.financeBudget;
  }

  if (Array.isArray(budget.lines)) {
    // Past iterations of this code detected lines named "Inter" /
    // "Resultado dos cartões" / "Fatura" + category "Cartão" +
    // payment-method "credit-card" via isFinanceInvoiceBaseLine, then
    // REMOVED them from the lines array and pushed their monthly
    // values into cardInvoiceBase. That created an infinite loop with
    // recovered/re-imported Inter lines: every hydrate stripped them
    // out and accumulated values into the manual fatura. The user
    // would re-add the values, save, hydrate again, lose them again.
    // Removed — those lines now stay as regular budget lines.
    const invoiceBase = normalizeFinanceMonths(budget.cardInvoiceBase);
    const lines = budget.lines.map((line) =>
      normalizeRecurringFinanceLine({
        ...line,
        category: normalizeFinanceCategory(line.category, line.kind),
        cardName: undefined,
        monthly: normalizeFinanceMonths(line.monthly),
        settledMonths: normalizeFinanceFlags(line.settledMonths),
        settledAmounts: normalizeFinanceAmounts(
          line.settledAmounts,
          normalizeFinanceMonths(line.monthly),
          line.settledMonths,
        ),
      }),
    );

    return {
      year: budget.year ?? emptyPersistedState.financeBudget.year,
      startCash:
        typeof budget.startCash === "number"
          ? budget.startCash
          : emptyPersistedState.financeBudget.startCash,
      cardInvoiceBase: invoiceBase,
      sheetReportedExpenseTotal: budget.sheetReportedExpenseTotal,
      lines,
    };
  }

  const legacyBudget = budget as Partial<{
    startCash: number;
    incomeLines: Array<Partial<FinanceBudgetLine>>;
    expenseLines: Array<Partial<FinanceBudgetLine>>;
    annualExpenseFromSheet: number;
  }>;

  const toLine = (
    line: Partial<FinanceBudgetLine>,
    kind: FinanceLineKind,
  ): FinanceBudgetLine =>
    normalizeRecurringFinanceLine({
      id: line.id ?? makeId("finance"),
      name: line.name ?? "Linha financeira",
      kind,
      category: normalizeFinanceCategory(
        line.category ?? (kind === "income" ? "Renda principal" : "Outros"),
        kind,
      ),
      frequency: "fixed",
      paymentMethod:
        line.paymentMethod ?? inferFinancePaymentMethod(line),
      dueDay: line.dueDay,
      cardName: undefined,
      notes: line.notes,
      monthly: normalizeFinanceMonths(line.monthly),
      settledMonths: normalizeFinanceFlags(line.settledMonths),
      settledAmounts: normalizeFinanceAmounts(
        line.settledAmounts,
        normalizeFinanceMonths(line.monthly),
        line.settledMonths,
      ),
    });

  // Same migration as the modern branch above: no longer swallowing
  // "Inter" / "Fatura" / "Resultado dos cartões" lines into
  // cardInvoiceBase. Legacy budgets get an empty invoiceBase and keep
  // every expense line untouched.
  const invoiceBase = normalizeFinanceMonths();
  const expenseLines = (legacyBudget.expenseLines ?? []).map((line) =>
    toLine(line, "expense"),
  );

  return {
    year: 2026,
    startCash:
      typeof legacyBudget.startCash === "number"
        ? legacyBudget.startCash
        : initialPersistedState.financeBudget.startCash,
    cardInvoiceBase: invoiceBase,
    sheetReportedExpenseTotal: legacyBudget.annualExpenseFromSheet,
    lines: [
      ...(legacyBudget.incomeLines ?? []).map((line) => toLine(line, "income")),
      ...expenseLines,
    ],
  };
}

function normalizeLifeAreaProfile(
  profile?: Partial<PersistedState["lifeAreaProfile"]> | null,
): PersistedState["lifeAreaProfile"] {
  const fallback = createDefaultLifeAreaProfile();
  const areas = { ...fallback.areas };

  for (const moduleId of Object.keys(fallback.areas) as ModuleId[]) {
    const current = profile?.areas?.[moduleId];
    areas[moduleId] = {
      importance: normalizeLifeAreaRank(
        current?.importance,
        fallback.areas[moduleId].importance,
      ),
      currentLevel: normalizeLifeAreaRank(
        current?.currentLevel,
        fallback.areas[moduleId].currentLevel,
      ),
    };
  }

  return {
    completedAt: profile?.completedAt,
    areas,
  };
}

function normalizeBodyMetricsProfile(
  profile?: Partial<PersistedState["bodyMetricsProfile"]> | null,
): PersistedState["bodyMetricsProfile"] {
  return {
    completedAt: profile?.completedAt,
    skippedAt: profile?.skippedAt,
  };
}

function normalizeGuidedOnboarding(
  profile: Partial<PersistedState["guidedOnboarding"]> | null | undefined,
  settings: Partial<PersistedState["settings"]> | null | undefined,
  hasExistingData: boolean,
  fallbackCompletedAt?: string,
): PersistedState["guidedOnboarding"] {
  const fallback = createDefaultGuidedOnboardingProfile();
  const selectedModules = Array.from(
    new Set(
      (profile?.selectedModules ?? []).filter((moduleId) =>
        defaultModuleOrder.includes(moduleId),
      ),
    ),
  ) as ModuleId[];
  const activeModulesFromSettings = defaultModuleOrder.filter(
    (moduleId) => settings?.activeModules?.[moduleId],
  );
  const resolvedSelectedModules = selectedModules.length
    ? selectedModules
    : activeModulesFromSettings;
  const shouldAutoComplete = hasExistingData && !profile?.completedAt;
  const whatsappNumber = profile?.whatsappNumber?.trim();

  return {
    ...fallback,
    ...profile,
    completedAt:
      profile?.completedAt ??
      (shouldAutoComplete
        ? fallbackCompletedAt ?? new Date().toISOString()
        : undefined),
    selectedModules: resolvedSelectedModules,
    whatsappNumber: whatsappNumber ? whatsappNumber : undefined,
    selectedCharacterId:
      profile?.selectedCharacterId ?? (shouldAutoComplete ? "atlas" : undefined),
    selectedRoomId:
      profile?.selectedRoomId ?? (shouldAutoComplete ? "neon-suite" : undefined),
  };
}

function normalizePersonalProfile(
  profile?: Partial<PersistedState["personalProfile"]> | null,
  nutritionTargets?: Partial<PersistedState["dailyNutritionTargets"]> | null,
): PersistedState["personalProfile"] {
  const fallback = initialPersistedState.personalProfile;
  const fallbackNutritionTargets = nutritionTargets ?? initialPersistedState.dailyNutritionTargets;
  const fallbackAgeYears =
    fallbackNutritionTargets.ageYears ?? initialPersistedState.dailyNutritionTargets.ageYears;
  const fallbackBodyHeightCm =
    fallbackNutritionTargets.bodyHeightCm ??
    initialPersistedState.dailyNutritionTargets.bodyHeightCm;
  const fallbackBodyWeightKg =
    fallbackNutritionTargets.bodyWeightKg ??
    initialPersistedState.dailyNutritionTargets.bodyWeightKg;
  const fallbackBiologicalSex =
    fallbackNutritionTargets.biologicalSex ??
    initialPersistedState.dailyNutritionTargets.biologicalSex;
  const ageYears =
    typeof profile?.ageYears === "number" && Number.isFinite(profile.ageYears)
      ? Math.max(1, Math.round(profile.ageYears))
      : fallbackAgeYears;
  const bodyHeightCm =
    typeof profile?.bodyHeightCm === "number" && Number.isFinite(profile.bodyHeightCm)
      ? Math.max(1, Math.round(profile.bodyHeightCm))
      : fallbackBodyHeightCm;
  const bodyWeightKg =
    typeof profile?.bodyWeightKg === "number" && Number.isFinite(profile.bodyWeightKg)
      ? Math.max(1, Number(profile.bodyWeightKg.toFixed(1)))
      : fallbackBodyWeightKg;
  const biologicalSex =
    profile?.biologicalSex === "female" || profile?.biologicalSex === "male"
      ? profile.biologicalSex
      : fallbackBiologicalSex;
  const restingHeartRateBpm =
    typeof profile?.restingHeartRateBpm === "number" &&
    Number.isFinite(profile.restingHeartRateBpm) &&
    profile.restingHeartRateBpm > 0
      ? Math.min(220, Math.max(30, Math.round(profile.restingHeartRateBpm)))
      : undefined;
  const notes = profile?.notes?.trim();

  return {
    ...fallback,
    ...profile,
    ageYears,
    bodyHeightCm,
    bodyWeightKg,
    biologicalSex,
    restingHeartRateBpm,
    notes: notes ? notes : undefined,
  };
}

function normalizeModuleOrder(order?: ModuleId[] | null): ModuleId[] {
  const preferred = Array.isArray(order) ? order : [];
  const seen = new Set<ModuleId>();
  const normalized: ModuleId[] = [];

  for (const moduleId of preferred) {
    if (!defaultModuleOrder.includes(moduleId) || seen.has(moduleId)) continue;
    seen.add(moduleId);
    normalized.push(moduleId);
  }

  for (const moduleId of defaultModuleOrder) {
    if (seen.has(moduleId)) continue;
    normalized.push(moduleId);
  }

  return normalized;
}

function normalizeDashboardSectionOrder(
  order?: DashboardSectionId[] | null,
): DashboardSectionId[] {
  const preferred = Array.isArray(order) ? order : [];
  const seen = new Set<DashboardSectionId>();
  const normalized: DashboardSectionId[] = [];

  for (const sectionId of preferred) {
    if (!defaultDashboardSectionOrder.includes(sectionId) || seen.has(sectionId)) {
      continue;
    }
    seen.add(sectionId);
    normalized.push(sectionId);
  }

  for (const sectionId of defaultDashboardSectionOrder) {
    if (seen.has(sectionId)) continue;
    normalized.push(sectionId);
  }

  return normalized;
}

function normalizeHiddenDashboardSections(
  hidden?: DashboardSectionId[] | null,
): DashboardSectionId[] {
  if (!Array.isArray(hidden)) {
    return [];
  }

  const seen = new Set<DashboardSectionId>();
  const normalized: DashboardSectionId[] = [];

  for (const sectionId of hidden) {
    if (!defaultDashboardSectionOrder.includes(sectionId) || seen.has(sectionId)) {
      continue;
    }
    seen.add(sectionId);
    normalized.push(sectionId);
  }

  return normalized;
}

function normalizeNutritionGoal(
  goal?: string | null,
): PersistedState["nutritionGoal"] {
  if (
    goal &&
    Object.prototype.hasOwnProperty.call(nutritionGoals, goal)
  ) {
    return goal as PersistedState["nutritionGoal"];
  }

  return initialPersistedState.nutritionGoal;
}

const mojibakeReplacements: Array<[string, string]> = [
  ["Ã§", "ç"],
  ["Ã£", "ã"],
  ["Ã¡", "á"],
  ["Ã ", "à"],
  ["Ã¢", "â"],
  ["Ãª", "ê"],
  ["Ã©", "é"],
  ["Ã­", "í"],
  ["Ã³", "ó"],
  ["Ã´", "ô"],
  ["Ãº", "ú"],
  ["Ãµ", "õ"],
  ["Ã¼", "ü"],
  ["Ã‰", "É"],
  ["Ã“", "Ó"],
  ["Ãš", "Ú"],
  ["Ã‡", "Ç"],
  ["Ã€", "À"],
  ["Ã", "Á"],
  ["Ã‚", "Â"],
  ["Â°", "°"],
  ["Âº", "º"],
  ["Âª", "ª"],
  ["â€¢", "•"],
  ["ðŸ”¥", "\u{1F525}"],
  ["ðŸŒŸ", "\u{1F31F}"],
  ["âœ…", "\u2705"],
  ["ðŸ’¯", "\u{1F4AF}"],
  ["ðŸ›£ï¸", "\u{1F3C3}"],
  ["ðŸ’ª", "\u{1F4AA}"],
  ["ðŸ¤", "\u{1F91D}"],
  ["âš”ï¸", "\u2694\uFE0F"],
  ["ðŸ†", "\u{1F3C6}"],
  ["ðŸ§ ", "\u{1F9E0}"],
  ["ðŸ¥—", "\u{1F957}"],
  ["ðŸ’¸", "\u{1F4B8}"],
  ["âœ¨", "\u2728"],
  ["â­", "\u2B50"],
  ["ðŸ’«", "\u{1F4AB}"],
  ["ðŸ”Ÿ", "\u{1F51F}"],
  ["ðŸ‘‘", "\u{1F451}"],
  ["ðŸ’¼", "\u{1F4BC}"],
  ["ðŸ§¾", "\u{1F9FE}"],
  ["ðŸ“ˆ", "\u{1F4C8}"],
  ["ðŸ›ï¸", "\u{1F6CD}\uFE0F"],
  ["ðŸ¦", "\u{1F3E6}"],
  ["ðŸ ", "\u{1F3E0}"],
  ["ðŸ’¡", "\u{1F4A1}"],
  ["ðŸ”", "\u{1F501}"],
  ["ðŸ½ï¸", "\u{1F37D}\uFE0F"],
  ["ðŸ©º", "\u{1FA7A}"],
  ["ðŸ¾", "\u{1F43E}"],
  ["ðŸ‹ï¸", "\u{1F3CB}\uFE0F"],
  ["ðŸš—", "\u{1F697}"],
  ["ðŸ’³", "\u{1F4B3}"],
  ["ðŸ› ï¸", "\u{1F6E0}\uFE0F"],
  ["ðŸ“¶", "\u{1F4F6}"],
  ["ðŸ›ï¸", "\u{1F3DB}\uFE0F"],
  ["ðŸŽŸï¸", "\u{1F39F}\uFE0F"],
  ["ðŸ“š", "\u{1F4DA}"],
  ["ðŸ’µ", "\u{1F4B5}"],
  ["ðŸ“¦", "\u{1F4E6}"],
];

function sanitizeMojibakeText(value: string) {
  let nextValue = value;
  for (const [from, to] of mojibakeReplacements) {
    nextValue = nextValue.split(from).join(to);
  }
  return nextValue;
}

function sanitizePersistedValue<T>(value: T): T {
  if (typeof value === "string") {
    return sanitizeMojibakeText(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizePersistedValue(entry)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        sanitizePersistedValue(entry),
      ]),
    ) as T;
  }

  return value;
}

type PersistedEnvelope = {
  version: 1;
  updatedAt?: string;
  state: unknown;
};

type ParsedStateEnvelope = {
  state: PersistedState;
  updatedAt?: string;
};

function createEmptyShoppingModuleState(): ShoppingModuleStoredState {
  return {
    items: [],
    selectedItemId: undefined,
    snapshots: {},
    removedSeedItemIds: [],
    removedSeedNames: [],
  };
}

const emptyPersistedState: PersistedState = {
  ...initialPersistedState,
  session: {
    authenticated: false,
    userId: "",
    email: "",
    name: "",
    username: "",
  },
  tasks: [],
  personalProfile: {
    ...initialPersistedState.personalProfile,
    ageYears: 0,
    bodyHeightCm: 0,
    bodyWeightKg: 0,
    restingHeartRateBpm: undefined,
    hasCardiovascularCondition: false,
    hasJointLimitation: false,
    usesHeartRateMedication: false,
    notes: "",
  },
  financeBudget: {
    ...initialPersistedState.financeBudget,
    startCash: 0,
    lines: [],
    cardInvoiceBase: emptyFinanceMonthlyValues(),
  },
  workoutPlan: [],
  workoutLoadEntries: [],
  workoutDayCompletions: [],
  mealPlan: [],
  foodDatabase: [],
  dailyNutritionTargets: {
    ...initialPersistedState.dailyNutritionTargets,
    waterMl: 0,
    bodyWeightKg: 0,
    bodyHeightCm: 0,
    ageYears: 0,
    basalMetabolicRate: 0,
    goalAdjustmentKcal: 0,
    totals: {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sodium: 0,
    },
    weightGoal: {
      ...initialPersistedState.dailyNutritionTargets.weightGoal,
      targetWeightKg: 0,
      weeklyChangeKg: 0,
    },
  },
  weightEntries: [],
  waterEntries: [],
  dietWeekSchedule: {
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
    saturday: "",
    sunday: "",
  },
  foodSubstitutions: [],
  dietPlans: [],
  activeDietPlanId: "",
  workoutPrograms: [],
  activeWorkoutProgramId: "",
  recoveryPrograms: [],
  activeRecoveryProgramId: "",
  recoveryPlan: [],
  recoveryDayCompletions: [],
  reminders: [],
  householdSupplies: [],
  workControlEntries: [],
  shoppingModules: {
    market: createEmptyShoppingModuleState(),
    supplements: createEmptyShoppingModuleState(),
  },
  sleepPlan: {
    recommendedHours: "",
    days: {
      monday: { enabled: false, bedtime: "", wakeTime: "" },
      tuesday: { enabled: false, bedtime: "", wakeTime: "" },
      wednesday: { enabled: false, bedtime: "", wakeTime: "" },
      thursday: { enabled: false, bedtime: "", wakeTime: "" },
      friday: { enabled: false, bedtime: "", wakeTime: "" },
      saturday: { enabled: false, bedtime: "", wakeTime: "" },
      sunday: { enabled: false, bedtime: "", wakeTime: "" },
    },
  },
  sleepHistory: [],
  moduleState: {},
};

function parseStateValue(
  rawValue: unknown,
  allowSeed = true,
): PersistedState | null {
  try {
    const parsed = sanitizePersistedValue(rawValue) as Partial<PersistedState> & {
      aiHistory?: unknown;
    };
    const parsedState = { ...parsed };
    delete (parsedState as { aiHistory?: unknown }).aiHistory;
    const financeBudget = migrateFinanceBudget(parsedState.financeBudget);

    // Hydrate-time activity multiplier — same lookup the reducers use,
    // pulled here from the parsedState shape because we don't have a
    // PersistedState yet. Without this the first load would silently
    // show BMR-only calories until the user edits anything.
    const hydrationPrograms = Array.isArray(parsedState.workoutPrograms)
      ? parsedState.workoutPrograms
      : [];
    const hydrationActiveProgram = hydrationPrograms.find(
      (p) => p?.id === parsedState.activeWorkoutProgramId,
    );
    const hydrationActivityMultiplier = hydrationActiveProgram
      ? getActivityMultiplierFromTrainingDays(
          hydrationActiveProgram.workoutPlan?.filter((d) => d && !d.isRestDay)
            .length ?? 0,
        )
      : getActivityMultiplierFromTrainingDays(0);

    const dailyNutritionTargets = normalizeDailyNutritionTargets(
      parsedState.dailyNutritionTargets,
      hydrationActivityMultiplier,
    );
    const dietDayTypes = normalizeDietDayTypes(parsedState.dietDayTypes);
    const workoutPlan = normalizeWorkoutPlan(parsedState.workoutPlan);
    const mealPlan = normalizeMealPlanCompletion(
      parsedState.mealPlan ?? emptyPersistedState.mealPlan,
    );
    const dietPlans = normalizeDietPlans(
      parsedState.dietPlans,
      mealPlan,
      dailyNutritionTargets,
      normalizeNutritionGoal(
        parsedState.nutritionGoal ?? emptyPersistedState.nutritionGoal,
      ),
      dietDayTypes,
    );
    const requestedActiveDietPlanId =
      parsedState.activeDietPlanId ??
      dietPlans[0]?.id ??
      emptyPersistedState.activeDietPlanId;
    const activeDietPlanId = dietPlans.some(
      (plan) => plan.id === requestedActiveDietPlanId,
    )
      ? requestedActiveDietPlanId
      : dietPlans[0]?.id ?? emptyPersistedState.activeDietPlanId;
    const activeDietPlan = dietPlans.find((plan) => plan.id === activeDietPlanId);
    const nutritionGoal = normalizeNutritionGoal(
      activeDietPlan?.nutritionGoal ??
        parsedState.nutritionGoal ??
        emptyPersistedState.nutritionGoal,
    );
    const activeDailyNutritionTargets = activeDietPlan
      ? normalizeDailyNutritionTargets(
          activeDietPlan.nutritionTargets,
          hydrationActivityMultiplier,
        )
      : dailyNutritionTargets;
    const dietWeekSchedule = normalizeDietWeekSchedule(
      parsedState.dietWeekSchedule,
      dietPlans,
      activeDietPlanId,
    );
    const weightEntries =
      parsedState.weightEntries ?? emptyPersistedState.weightEntries;
    const waterEntries =
      parsedState.waterEntries ?? emptyPersistedState.waterEntries;
    const dietWorkoutLink = normalizeDietWorkoutLink(parsedState.dietWorkoutLink);
    const foodSubstitutions = normalizeFoodSubstitutions(
      parsedState.foodSubstitutions,
    );
    const householdSupplies = normalizeHouseholdSupplies(
      parsedState.householdSupplies,
    );
    const shoppingModules = {
      market: normalizeShoppingModuleState(
        parsedState.shoppingModules?.market,
        "market",
        allowSeed,
      ),
      supplements: normalizeShoppingModuleState(
        parsedState.shoppingModules?.supplements,
        "supplements",
        allowSeed,
      ),
    };
    const lifeAreaProfile = normalizeLifeAreaProfile(parsedState.lifeAreaProfile);
    const bodyMetricsProfile = normalizeBodyMetricsProfile(
      parsedState.bodyMetricsProfile,
    );
    const personalProfile = normalizePersonalProfile(
      parsedState.personalProfile,
      activeDailyNutritionTargets,
    );
    const hasExistingData = Boolean(
      parsedState.bodyMetricsProfile?.completedAt ||
        parsedState.lifeAreaProfile?.completedAt ||
        parsedState.personalProfile?.completedAt ||
        parsedState.tasks?.length ||
        parsedState.mealPlan?.length ||
        parsedState.dietPlans?.length ||
        parsedState.workoutPrograms?.length ||
        parsedState.workoutPlan?.length ||
        parsedState.workoutLoadEntries?.length ||
        parsedState.weightEntries?.length ||
        parsedState.reminders?.length ||
        parsedState.workControlEntries?.length ||
        parsedState.householdSupplies?.length ||
        parsedState.shoppingModules?.market?.items?.length ||
        parsedState.shoppingModules?.supplements?.items?.length,
    );
    const settings = {
      ...emptyPersistedState.settings,
      ...parsedState.settings,
      activeModules: {
        ...emptyPersistedState.settings.activeModules,
        ...parsedState.settings?.activeModules,
      },
      moduleOrder: normalizeModuleOrder(parsedState.settings?.moduleOrder),
      dashboardSectionOrder: normalizeDashboardSectionOrder(
        parsedState.settings?.dashboardSectionOrder,
      ),
      hiddenDashboardSections: normalizeHiddenDashboardSections(
        parsedState.settings?.hiddenDashboardSections,
      ),
    };
    const guidedOnboarding = normalizeGuidedOnboarding(
      parsedState.guidedOnboarding,
      settings,
      hasExistingData,
      bodyMetricsProfile.completedAt ??
        lifeAreaProfile.completedAt ??
        personalProfile.completedAt,
    );
    const workoutPrograms = normalizeWorkoutPrograms(
      parsedState.workoutPrograms,
      workoutPlan,
    );
    const requestedActiveWorkoutProgramId =
      parsedState.activeWorkoutProgramId ??
      workoutPrograms[0]?.id ??
      emptyPersistedState.activeWorkoutProgramId;
    const activeWorkoutProgramId = workoutPrograms.some(
      (program) => program.id === requestedActiveWorkoutProgramId,
    )
      ? requestedActiveWorkoutProgramId
      : workoutPrograms[0]?.id ?? emptyPersistedState.activeWorkoutProgramId;
    const workoutLoadEntries = normalizeWorkoutLoadEntries(
      parsedState.workoutLoadEntries,
      workoutPrograms,
      activeWorkoutProgramId,
    );
    const workoutDayCompletions = normalizeWorkoutDayCompletions(
      parsedState.workoutDayCompletions,
      workoutPrograms,
      activeWorkoutProgramId,
    );
    return {
      ...emptyPersistedState,
      ...parsedState,
      session: {
        ...emptyPersistedState.session,
        ...parsedState.session,
      },
      guidedOnboarding,
      bodyMetricsProfile,
      personalProfile,
      settings,
      lifeAreaProfile,
      tasks:
        parsedState.tasks
          ?.filter((task) => !isLegacyNutritionHydrationTask(task))
          .map((task) => {
            const legacyTask = task as Task & { recurring?: boolean };
            const difficulty = normalizeTaskDifficulty(
              legacyTask.difficulty,
              legacyTask.xp,
            );
            return withCalculatedTaskXp(
              {
                ...legacyTask,
                difficulty,
                baseXp: getTaskBaseXp(legacyTask),
                xp: legacyTask.xp,
                recurrence:
                  legacyTask.recurrence ??
                  (legacyTask.recurring
                    ? {
                        kind: "daily" as const,
                      }
                    : {
                        kind: "one-time" as const,
                  }),
              },
              lifeAreaProfile,
            );
          }) ?? emptyPersistedState.tasks,
      financeLessons:
        parsedState.financeLessons ?? initialPersistedState.financeLessons,
      arena: {
        ...emptyPersistedState.arena,
        ...parsedState.arena,
        combatLog:
          parsedState.arena?.combatLog ?? emptyPersistedState.arena.combatLog,
      },
      nutritionGoal,
      workoutMode: parsedState.workoutMode ?? emptyPersistedState.workoutMode,
      workoutPlan,
      workoutLoadEntries,
      workoutDayCompletions,
      mealPlan,
      foodDatabase: (parsedState.foodDatabase ?? emptyPersistedState.foodDatabase).map(
        (food) => ({
          ...food,
          favorite: food.favorite ?? false,
        }),
      ),
      dailyNutritionTargets: activeDailyNutritionTargets,
      weightEntries,
      waterEntries,
      dietDayTypes,
      dietWeekSchedule,
      dietWorkoutLink,
      foodSubstitutions,
      dietPlans,
      activeDietPlanId,
      workoutPrograms,
      activeWorkoutProgramId,
      reminders:
        parsedState.reminders?.filter(
          (reminder) =>
            reminder.id !== "reminder-hydration" &&
            reminder.entityId !== "task-water",
        ) ??
        emptyPersistedState.reminders.filter(
          (reminder) =>
            reminder.id !== "reminder-hydration" &&
            reminder.entityId !== "task-water",
        ),
      householdSupplies,
      workControlEntries: normalizeWorkControlEntries(
        parsedState.workControlEntries ?? emptyPersistedState.workControlEntries,
      ),
      shoppingModules,
      financeBudget,
      financeCategories: normalizeFinanceCategories(
        parsedState.financeCategories,
        financeBudget,
      ),
      sleepPlan: (() => {
        const base = emptyPersistedState.sleepPlan;
        const incoming = parsedState.sleepPlan;
        if (!incoming || typeof incoming !== "object") return base;
        return {
          recommendedHours:
            typeof incoming.recommendedHours === "string"
              ? incoming.recommendedHours
              : base.recommendedHours,
          days: {
            ...base.days,
            ...(incoming.days && typeof incoming.days === "object"
              ? incoming.days
              : {}),
          },
        };
      })(),
      sleepHistory: Array.isArray(parsedState.sleepHistory)
        ? parsedState.sleepHistory.filter(
            (entry) =>
              entry &&
              typeof entry === "object" &&
              typeof entry.id === "string" &&
              typeof entry.date === "string" &&
              typeof entry.bedtime === "string" &&
              typeof entry.wakeTime === "string",
          )
        : emptyPersistedState.sleepHistory,
      moduleState:
        parsedState.moduleState &&
        typeof parsedState.moduleState === "object" &&
        !Array.isArray(parsedState.moduleState)
          ? (parsedState.moduleState as Record<string, unknown>)
          : {},
    };
  } catch {
    return null;
  }
}

function parsePersistedEnvelopeValue(rawValue: unknown): ParsedStateEnvelope | null {
  const sanitized = sanitizePersistedValue(rawValue);

  if (sanitized && typeof sanitized === "object" && "state" in sanitized) {
    const envelope = sanitized as PersistedEnvelope;
    const parsedState = parseStateValue(envelope.state);

    return parsedState
      ? {
          state: parsedState,
          updatedAt:
            typeof envelope.updatedAt === "string" ? envelope.updatedAt : undefined,
        }
      : null;
  }

  const parsedState = parseStateValue(sanitized);
  return parsedState ? { state: parsedState } : null;
}

function parseState(raw: string | null): ParsedStateEnvelope | null {
  if (!raw) return null;

  try {
    return parsePersistedEnvelopeValue(JSON.parse(raw));
  } catch {
    return null;
  }
}

function serializePersistedState(state: PersistedState) {
  return JSON.stringify({
    version: 1,
    updatedAt: new Date().toISOString(),
    state,
  } satisfies PersistedEnvelope);
}

function getEnvelopeTimestamp(envelope: ParsedStateEnvelope | null | undefined) {
  if (!envelope?.updatedAt) return 0;
  const timestamp = new Date(envelope.updatedAt).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getEnvelopeDataScore(envelope: ParsedStateEnvelope | null | undefined) {
  const state = envelope?.state;

  if (!state) return 0;

  const shoppingItems =
    (state.shoppingModules?.market?.items?.length ?? 0) +
    (state.shoppingModules?.supplements?.items?.length ?? 0);

  return (
    state.tasks.length +
    state.financeLessons.length +
    state.workoutPlan.length +
    state.workoutLoadEntries.length +
    state.workoutDayCompletions.length +
    state.mealPlan.length +
    state.foodDatabase.length +
    state.weightEntries.length +
    state.waterEntries.length +
    state.dietPlans.length +
    state.workoutPrograms.length +
    state.reminders.length +
    state.householdSupplies.length +
    state.workControlEntries.length +
    state.financeBudget.lines.length +
    shoppingItems
  );
}

function isEnvelopeCompatibleWithUser(
  envelope: ParsedStateEnvelope | null | undefined,
  userId: string | null | undefined,
  email: string | null | undefined,
) {
  if (!envelope) return false;

  const sessionUserId = envelope.state.session?.userId;
  const sessionEmail = envelope.state.session?.email?.trim().toLowerCase();
  const normalizedEmail = email?.trim().toLowerCase();

  if (userId && sessionUserId && sessionUserId !== userId) {
    return false;
  }

  if (normalizedEmail && sessionEmail && sessionEmail !== normalizedEmail) {
    return false;
  }

  return true;
}

function resolveHydrationEnvelope(
  serverEnvelope: ParsedStateEnvelope | null,
  localEnvelope: ParsedStateEnvelope | null,
  legacyEnvelope: ParsedStateEnvelope | null,
) {
  if (serverEnvelope && localEnvelope) {
    return getEnvelopeTimestamp(localEnvelope) > getEnvelopeTimestamp(serverEnvelope)
      ? localEnvelope
      : serverEnvelope;
  }

  if (localEnvelope) {
    return localEnvelope;
  }

  if (serverEnvelope && legacyEnvelope) {
    const serverTimestamp = getEnvelopeTimestamp(serverEnvelope);
    const legacyTimestamp = getEnvelopeTimestamp(legacyEnvelope);

    if (legacyTimestamp && legacyTimestamp > serverTimestamp) {
      return legacyEnvelope;
    }

    if (
      !legacyTimestamp &&
      getEnvelopeDataScore(legacyEnvelope) > getEnvelopeDataScore(serverEnvelope)
    ) {
      return legacyEnvelope;
    }

    return serverEnvelope;
  }

  return serverEnvelope ?? legacyEnvelope ?? null;
}

function findLegacyPersistedState(
  activeStorageKey: string,
  userId: string,
  email?: string | null,
) {
  const keys = Object.keys(window.localStorage).filter(
    (key) => key !== activeStorageKey,
  );

  const scopedLegacy = keys
    .filter((key) => key.endsWith(`:${userId}`))
    .map((key) => ({
      key,
      value: parseState(window.localStorage.getItem(key)),
    }))
    .find((entry) => entry.value);

  if (scopedLegacy?.value) {
    return {
      envelope: scopedLegacy.value,
      keysToClear: [scopedLegacy.key],
    };
  }

  const unscopedLegacy = [storageKey, legacyStorageKey]
    .filter((key) => key !== activeStorageKey && keys.includes(key))
    .map((key) => ({
      key,
      value: parseState(window.localStorage.getItem(key)),
    }))
    .filter((entry) => isEnvelopeCompatibleWithUser(entry.value, userId, email))
    .find((entry) => entry.value);

  return unscopedLegacy?.value
    ? {
        envelope: unscopedLegacy.value,
        keysToClear: [unscopedLegacy.key],
      }
    : null;
}

export function AppStoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded: authLoaded, userId } = useAuthClient();
  const { user: clerkUser } = useUserClient();
  const [state, dispatch] = useReducer(reducer, emptyPersistedState);
  const [hydrated, setHydrated] = useState(false);
  const [entitlement, setEntitlement] = useState<AccountEntitlement>(
    isLocalAuthBypassEnabled
      ? localDevelopmentEntitlement
      : defaultAccountEntitlement,
  );
  const effectiveAuthLoaded = isLocalAuthBypassEnabled ? true : authLoaded;
  const activeStorageKey = userId
    ? getScopedStorageKey(userId)
    : isLocalAuthBypassEnabled
      ? legacyStorageKey
      : null;
  const currentEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? null;
  const legacyKeysToClearRef = useRef<string[]>([]);
  const remoteSyncReadyRef = useRef(false);
  const lastServerSnapshotRef = useRef("");
  const saveAccountTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!effectiveAuthLoaded) return;
    let cancelled = false;

    remoteSyncReadyRef.current = false;

    const hydrateStore = async () => {
      const persisted = activeStorageKey
        ? parseState(window.localStorage.getItem(activeStorageKey))
        : null;
      const localEnvelope = isEnvelopeCompatibleWithUser(
        persisted,
        userId,
        currentEmail,
      )
        ? persisted
        : null;
      const legacyPayload =
        activeStorageKey && userId && !localEnvelope
          ? findLegacyPersistedState(activeStorageKey, userId, currentEmail)
          : null;

      let serverEnvelope: ParsedStateEnvelope | null = null;

      if (userId) {
        try {
          const response = await fetch("/api/account-state", {
            credentials: "same-origin",
          });

          if (response.ok) {
            const parsedServerEnvelope = parsePersistedEnvelopeValue(await response.json());
            serverEnvelope = isEnvelopeCompatibleWithUser(
              parsedServerEnvelope,
              userId,
              currentEmail,
            )
              ? parsedServerEnvelope
              : null;
          }
        } catch {
          serverEnvelope = null;
        }
      }

      const resolvedEnvelope = resolveHydrationEnvelope(
        serverEnvelope,
        localEnvelope,
        legacyPayload?.envelope ?? null,
      );

      if (cancelled) return;

      legacyKeysToClearRef.current =
        resolvedEnvelope === legacyPayload?.envelope
          ? legacyPayload?.keysToClear ?? []
          : [];

      lastServerSnapshotRef.current = serverEnvelope
        ? JSON.stringify(serverEnvelope.state)
        : "";

      // Demo seed (market/supplements) only for the local-review bypass
      // or the founder account. Brand-new real accounts stay clean.
      const allowSeed =
        isLocalAuthBypassEnabled || isFounderEmail(currentEmail);

      dispatch({
        type: "hydrate",
        payload: resolvedEnvelope?.state ?? emptyPersistedState,
        allowSeed,
      });

      remoteSyncReadyRef.current = Boolean(userId) && !isLocalAuthBypassEnabled;

      const hydrationTick = window.setTimeout(() => {
        if (!cancelled) {
          setHydrated(true);
        }
      }, 0);

      if (cancelled) {
        window.clearTimeout(hydrationTick);
      }
    };

    void hydrateStore();

    return () => {
      cancelled = true;
    };
  }, [activeStorageKey, currentEmail, effectiveAuthLoaded, userId]);

  useEffect(() => {
    if (!hydrated || !activeStorageKey) return;
    window.localStorage.setItem(activeStorageKey, serializePersistedState(state));
    legacyKeysToClearRef.current.forEach((key) => window.localStorage.removeItem(key));
    if (legacyStorageKey !== activeStorageKey) {
      window.localStorage.removeItem(legacyStorageKey);
    }
  }, [activeStorageKey, hydrated, state]);

  useEffect(() => {
    if (!effectiveAuthLoaded || !hydrated || !userId || !remoteSyncReadyRef.current) return;

    if (saveAccountTimeoutRef.current) {
      window.clearTimeout(saveAccountTimeoutRef.current);
    }

    saveAccountTimeoutRef.current = window.setTimeout(() => {
      const currentSnapshot = JSON.stringify(state);

      if (currentSnapshot === lastServerSnapshotRef.current) {
        return;
      }

      void fetch("/api/account-state", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: serializePersistedState(state),
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Falha ao sincronizar o estado da conta.");
          }

          lastServerSnapshotRef.current = currentSnapshot;
        })
        .catch(() => {});
    }, 700);

    return () => {
      if (saveAccountTimeoutRef.current) {
        window.clearTimeout(saveAccountTimeoutRef.current);
        saveAccountTimeoutRef.current = null;
      }
    };
  }, [effectiveAuthLoaded, hydrated, state, userId]);

  useEffect(() => {
    if (!authLoaded || !hydrated) return;

    if (!userId) {
      dispatch({
        type: "sync-session",
        session: {
          authenticated: false,
          userId: "",
          email: "",
          name: "",
          username: "",
        },
      });
      return;
    }

    const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
    const fallbackName = email.split("@")[0]?.trim() || "Operador Praxis";
    dispatch({
      type: "sync-session",
      session: {
        authenticated: true,
        userId,
        email,
        name: clerkUser?.fullName ?? clerkUser?.firstName ?? fallbackName,
        username: clerkUser?.username ?? email.split("@")[0]?.trim() ?? "",
      },
    });
  }, [
    authLoaded,
    clerkUser?.firstName,
    clerkUser?.fullName,
    clerkUser?.primaryEmailAddress?.emailAddress,
    clerkUser?.username,
    hydrated,
    userId,
  ]);

  useEffect(() => {
    if (!effectiveAuthLoaded) return;

    if (isLocalAuthBypassEnabled) {
      setEntitlement(localDevelopmentEntitlement);
      return;
    }

    if (!userId) {
      setEntitlement(defaultAccountEntitlement);
      return;
    }

    let cancelled = false;

    const syncEntitlement = async () => {
      try {
        const response = await fetch("/api/account-entitlement", {
          cache: "no-store",
          credentials: "same-origin",
        });

        if (!response.ok) {
          throw new Error("Falha ao carregar o acesso da conta.");
        }

        const payload = coerceAccountEntitlement(await response.json());

        if (!cancelled) {
          setEntitlement(payload);
        }
      } catch {
        if (!cancelled) {
          setEntitlement(defaultAccountEntitlement);
        }
      }
    };

    void syncEntitlement();

    return () => {
      cancelled = true;
    };
  }, [currentEmail, effectiveAuthLoaded, userId]);

  useEffect(() => {
    if (!hydrated) return;

    let timeoutId: number | null = null;

    const scheduleNextSync = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 5, 0);
      const delay = Math.max(1_000, nextMidnight.getTime() - now.getTime());

      timeoutId = window.setTimeout(() => {
        dispatch({ type: "sync-daily-task-completions" });
        scheduleNextSync();
      }, delay);
    };

    dispatch({ type: "sync-daily-task-completions" });
    scheduleNextSync();

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.dataset.theme = state.settings.theme;
  }, [hydrated, state.settings.theme]);

  const value: AppStoreValue = {
    hydrated,
    state,
    user: buildUserProfile(state),
    entitlement,
    actions: {
      toggleTask(taskId) {
        dispatch({ type: "toggle-task", taskId });
      },
      toggleTaskCompletionForDate(payload) {
        dispatch({ type: "toggle-task-completion-for-date", payload });
      },
      addTask(task) {
        const difficulty = normalizeTaskDifficulty(task.difficulty);
        const taskId = makeId("task");
        dispatch({
          type: "add-task",
          task: {
            id: taskId,
            moduleId: null,
            completed: false,
            ...task,
            difficulty,
            baseXp: getTaskBaseXp({ difficulty, xp: 0 }),
            xp: 0,
          },
        });

        // Auto-create an enabled reminder when the new task ships with a
        // scheduledTime. Without this, every brand-new task showed up with
        // the alarm in the OFF state — defaulting to ON matches the user's
        // expectation that "if I gave it a time, I want to be reminded."
        // Tasks without a time get no reminder (and no alarm button — the
        // tasks page gates the toggle on item.time).
        const scheduledTime = task.scheduledTime?.trim();
        if (scheduledTime) {
          const recurrence = task.recurrence;
          let weekdaysFromRecurrence: Weekday[] | undefined;
          if (recurrence?.kind === "daily") {
            weekdaysFromRecurrence = [
              "monday",
              "tuesday",
              "wednesday",
              "thursday",
              "friday",
              "saturday",
              "sunday",
            ];
          } else if (recurrence?.kind === "selected-weekdays" && recurrence.weekdays?.length) {
            weekdaysFromRecurrence = recurrence.weekdays;
          } else if (recurrence?.kind === "weekly-fixed" && recurrence.weekday) {
            weekdaysFromRecurrence = [recurrence.weekday];
          }
          dispatch({
            type: "add-reminder",
            payload: {
              entityType: "task",
              entityId: taskId,
              title: task.title,
              time: scheduledTime,
              weekdays: weekdaysFromRecurrence,
            },
          });
        }
      },
      updateTask(payload) {
        dispatch({ type: "update-task", payload });
      },
      removeTask(taskId) {
        dispatch({ type: "remove-task", taskId });
      },
      addWorkControlEntry(payload) {
        dispatch({
          type: "add-work-control-entry",
          payload: {
            id: makeId("work-control"),
            notes: "",
            ...payload,
          },
        });
      },
      updateWorkControlEntry(payload) {
        dispatch({ type: "update-work-control-entry", payload });
      },
      removeWorkControlEntry(entryId) {
        dispatch({ type: "remove-work-control-entry", entryId });
      },
      saveGuidedOnboarding(payload) {
        dispatch({ type: "save-guided-onboarding", payload });
      },
      saveLifeAreaProfile(profile) {
        dispatch({ type: "save-life-area-profile", areas: profile });
      },
      completeBodyMetricsSetup(payload) {
        dispatch({
          type: "complete-body-metrics-setup",
          skipped: payload?.skipped ?? false,
        });
      },
      updatePersonalProfile(payload) {
        dispatch({ type: "update-personal-profile", payload });
      },
      updateAccountProfile(payload) {
        dispatch({ type: "update-account-profile", payload });
      },
      setTheme(theme) {
        dispatch({ type: "set-theme", theme });
      },
      toggleSetting(key) {
        dispatch({ type: "toggle-setting", key });
      },
      toggleModuleVisibility(moduleId) {
        dispatch({ type: "toggle-module-visibility", moduleId });
      },
      reorderModule(payload) {
        dispatch({ type: "reorder-module", payload });
      },
      toggleDashboardSectionVisibility(sectionId) {
        dispatch({ type: "toggle-dashboard-section-visibility", sectionId });
      },
      reorderDashboardSection(payload) {
        dispatch({ type: "reorder-dashboard-section", payload });
      },
      setNutritionGoal(goal) {
        dispatch({ type: "set-goal", goal });
      },
      setNutritionGoalAdjustment(adjustmentKcal) {
        dispatch({ type: "set-goal-adjustment", adjustmentKcal });
      },
      updateNutritionTargets(payload) {
        dispatch({ type: "update-nutrition-targets", payload });
      },
      addWeightEntry(payload) {
        dispatch({ type: "add-weight-entry", payload });
      },
      removeWeightEntry(entryId) {
        dispatch({ type: "remove-weight-entry", entryId });
      },
      setWaterConsumed(payload) {
        dispatch({ type: "set-water-consumed", payload });
      },
      setWorkoutMode(mode) {
        dispatch({ type: "set-workout", mode });
      },
      setDietDayType(payload) {
        dispatch({ type: "set-diet-day-type", payload });
      },
      setDietWeekPlan(payload) {
        dispatch({ type: "set-diet-week-plan", payload });
      },
      setDietWorkoutLink(payload) {
        dispatch({ type: "set-diet-workout-link", payload });
      },
      addFoodSubstitution(payload) {
        dispatch({ type: "add-food-substitution", payload });
      },
      removeFoodSubstitution(substitutionId) {
        dispatch({ type: "remove-food-substitution", substitutionId });
      },
      saveCurrentDietPlan(payload) {
        dispatch({ type: "save-current-diet-plan", payload });
      },
      createBlankDietPlan(payload) {
        dispatch({ type: "create-blank-diet-plan", payload });
      },
      duplicateDietPlan(planId) {
        dispatch({ type: "duplicate-diet-plan", planId });
      },
      removeDietPlan(planId) {
        dispatch({ type: "remove-diet-plan", planId });
      },
      updateDietPlan(payload) {
        dispatch({ type: "update-diet-plan", payload });
      },
      activateDietPlan(planId) {
        dispatch({ type: "activate-diet-plan", planId });
      },
      saveCurrentWorkoutProgram(payload) {
        dispatch({ type: "save-current-workout-program", payload });
      },
      activateWorkoutProgram(programId) {
        dispatch({ type: "activate-workout-program", programId });
      },
      removeWorkoutProgram(programId) {
        dispatch({ type: "remove-workout-program", programId });
      },
      simulateArenaMatch() {
        const opponents = [
          "KuramaYoko",
          "LeviAckerman",
          "GojoSatoru",
          "EdwardElric",
          "SungJinWoo",
        ];
        const opponent = opponents[Math.floor(Math.random() * opponents.length)];
        const win = Math.random() > 0.42;
        const damage = 120 + Math.floor(Math.random() * 180);
        dispatch({
          type: "simulate-arena",
          result: {
            opponent,
            win,
            damage,
            message: win
              ? `Vitória contra ${opponent}: combo crítico e +${damage} dano.`
              : `Derrota honrosa contra ${opponent}: ajuste seu build e tente de novo.`,
          },
        });
      },
      toggleLesson(lessonId) {
        dispatch({ type: "toggle-lesson", lessonId });
      },
      updateWorkoutLoadBatch(payload) {
        dispatch({ type: "update-workout-load-batch", payload });
      },
      removeWorkoutLoadBatch(entryIds) {
        dispatch({ type: "remove-workout-load-batch", entryIds });
      },
      saveWorkoutLoad(payload) {
        dispatch({ type: "save-workout-load", payload });
      },
      toggleWorkoutDayCompleted(payload) {
        dispatch({ type: "toggle-workout-day-completed", payload });
      },
      addCustomFood(payload) {
        dispatch({ type: "add-custom-food", payload });
      },
      toggleFoodFavorite(foodId) {
        dispatch({ type: "toggle-food-favorite", foodId });
      },
      addMealBlock(payload) {
        dispatch({ type: "add-meal-block", payload });
      },
      updateMealBlock(payload) {
        dispatch({ type: "update-meal-block", payload });
      },
      removeMealBlock(blockId) {
        dispatch({ type: "remove-meal-block", blockId });
      },
      addMealItem(payload) {
        dispatch({ type: "add-meal-item", payload });
      },
      toggleMealItemCompleted(payload) {
        dispatch({ type: "toggle-meal-item-completed", payload });
      },
      setMealBlockItemsCompleted(payload) {
        dispatch({ type: "set-meal-block-items-completed", payload });
      },
      updateMealItem(payload) {
        dispatch({ type: "update-meal-item", payload });
      },
      removeMealItem(payload) {
        dispatch({ type: "remove-meal-item", payload });
      },
      toggleReminder(reminderId) {
        dispatch({ type: "toggle-reminder", reminderId });
      },
      addReminder(payload) {
        dispatch({ type: "add-reminder", payload });
      },
      updateReminder(payload) {
        dispatch({ type: "update-reminder", payload });
      },
      addHouseholdSupply(payload) {
        dispatch({ type: "add-household-supply", payload });
      },
      updateHouseholdSupply(payload) {
        dispatch({ type: "update-household-supply", payload });
      },
      removeHouseholdSupply(supplyId) {
        dispatch({ type: "remove-household-supply", supplyId });
      },
      replaceShoppingModuleState(payload) {
        dispatch({ type: "replace-shopping-module-state", payload });
      },
      replaceRecoveryPlan(plan) {
        dispatch({ type: "replace-recovery-plan", plan });
      },
      replaceRecoveryDayCompletions(completions) {
        dispatch({ type: "replace-recovery-day-completions", completions });
      },
      updateFinanceStartCash(amount) {
        dispatch({ type: "update-finance-start-cash", amount });
      },
      addFinanceCategory(payload) {
        dispatch({ type: "add-finance-category", payload });
      },
      addFinanceLine(payload) {
        dispatch({ type: "add-finance-line", payload });
      },
      updateFinanceLine(payload) {
        dispatch({ type: "update-finance-line", payload });
      },
      updateFinanceMonthlyValue(payload) {
        dispatch({ type: "update-finance-monthly-value", payload });
      },
      toggleFinanceLineSettled(payload) {
        dispatch({ type: "toggle-finance-line-settled", payload });
      },
      applyFinanceSettlement(payload) {
        dispatch({ type: "apply-finance-settlement", payload });
      },
      clearFinanceSettlement(payload) {
        dispatch({ type: "clear-finance-settlement", payload });
      },
      rollFinanceLineToNextMonth(payload) {
        dispatch({ type: "roll-finance-line-to-next-month", payload });
      },
      cancelFinanceLineMonth(payload) {
        dispatch({ type: "cancel-finance-line-month", payload });
      },
      updateFinanceInvoiceBase(payload) {
        dispatch({ type: "update-finance-invoice-base", payload });
      },
      removeFinanceLine(lineId) {
        dispatch({ type: "remove-finance-line", lineId });
      },
      closeFinanceMonth(month) {
        dispatch({ type: "close-finance-month", month });
      },
      setSleepPlan(plan) {
        dispatch({ type: "set-sleep-plan", payload: plan });
      },
      setSleepHistory(history) {
        dispatch({ type: "set-sleep-history", payload: history });
      },
      setModuleState(key, value) {
        dispatch({ type: "set-module-state", key, value });
      },
    },
  };

  return (
    <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
  );
}

export function useAppStore() {
  const context = useContext(AppStoreContext);
  if (!context) {
    throw new Error("useAppStore must be used inside AppStoreProvider");
  }
  return context;
}



