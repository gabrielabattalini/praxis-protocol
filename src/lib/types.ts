import type {
  ShoppingModuleScope,
  ShoppingModuleStoredState,
} from "@/lib/shopping-search";

export type ThemeId =
  | "default"
  | "ocean"
  | "sunset"
  | "forest"
  | "royal"
  | "gold";

export type DashboardSectionId =
  | "quick-actions"
  // "score" (Operações · hoje / XP por hora · 24h panel) removed at
  // the user's request. Legacy state entries get filtered by the
  // normalize functions in the store provider.
  | "timeline"
  | "telemetry"
  | "modules"
  | "ranking"
  | "skills";

export type TaskCategory =
  | "fitness"
  | "study"
  | "nutrition"
  | "mindfulness"
  | "productivity"
  | "social"
  | "creativity"
  | "appearance"
  | "finance"
  | "health";

export type TaskDifficulty = "easy" | "medium" | "hard";

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type TaskRecurrenceKind =
  | "one-time"
  | "daily"
  | "times-per-week"
  | "selected-weekdays"
  | "weekly-fixed"
  | "monthly"
  | "interval-days";

export interface TaskRecurrence {
  kind: TaskRecurrenceKind;
  timesPerWeek?: number;
  weekdays?: Weekday[];
  weekday?: Weekday;
  dayOfMonth?: number;
  intervalDays?: number;
}

export type ModuleId =
  | "run"
  | "workout"
  | "work"
  | "nutrition"
  | "finance"
  | "appearance"
  | "recovery"
  | "health"
  | "mind"
  | "sleep"
  | "home"
  | "market"
  | "supplements";

export type WorkoutMode = "gym" | "calisthenics";

export type WorkoutMuscleGroup =
  | "Peito"
  | "Ombro"
  | "Tríceps"
  | "Costas"
  | "Bíceps"
  | "Quadríceps"
  | "Posterior"
  | "Glúteos"
  | "Panturrilha"
  | "Core";

export type NutritionGoalId =
  | "lose_weight"
  | "lose_fat"
  | "gain_weight"
  | "gain_muscle"
  | "maintain";

export type BiologicalSex = "female" | "male";
export type BasalMetabolicRateSource = "estimated" | "manual";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "high";
export type CardioGoal =
  | "health"
  | "fat-loss"
  | "maintenance"
  | "performance"
  | "muscle-gain";
export type CardioPreference =
  | "walking"
  | "running"
  | "bike"
  | "elliptical"
  | "stairs";

export type AchievementCategory =
  | "streak"
  | "tasks"
  | "fitness"
  | "social"
  | "arena"
  | "modules"
  | "ranking";

export type RankTier = "E" | "D" | "C" | "B" | "A" | "S";

export type FinanceMonthId =
  | "january"
  | "february"
  | "march"
  | "april"
  | "may"
  | "june"
  | "july"
  | "august"
  | "september"
  | "october"
  | "november"
  | "december";

export type FinanceLineKind = "income" | "expense";

export type FinanceLineFrequency = "fixed" | "variable";

export type FinancePaymentMethod =
  | "cash"
  | "credit-card"
  | "debit-card"
  | "auto-debit"
  | "pix"
  | "bank-slip"
  | "bank-transfer";

export type FriendTab = "all" | "online" | "requests";

export interface UserProfile {
  name: string;
  email: string;
  username: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  totalXp: number;
  isMaxLevel: boolean;
  streak: number;
  rankLabel: string;
  rankTier: RankTier;
  nextRankTier: RankTier | null;
  xpToNextRank: number;
  evolutionsUnlocked: number;
  skillScores: {
    focus: number;
    energy: number;
    discipline: number;
    production: number;
    motivation: number;
  };
  characterStats: {
    vitality: number;
    hydration: number;
    strength: number;
    intelligence: number;
    discipline: number;
    agility: number;
    focus: number;
    charisma: number;
  };
}

export interface Task {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  moduleId: ModuleId | null;
  scheduledTime?: string;
  sourceKey?: string;
  deferUntilDate?: string;
  difficulty?: TaskDifficulty;
  baseXp?: number;
  xp: number;
  completed: boolean;
  recurrence: TaskRecurrence;
  progressLabel?: string;
  completedAt?: string;
  // Per-date completion history (YYYY-MM-DD keys). Lets the user
  // retroactively mark past days complete without trampling today's
  // completedAt slot. isTaskCompletedForDate consults this first; older
  // tasks without the array fall back to the legacy completedAt logic.
  completedDates?: string[];
}

export interface LifeAreaAssessment {
  importance: RankTier;
  currentLevel: RankTier;
}

export interface LifeAreaProfile {
  completedAt?: string;
  areas: Record<ModuleId, LifeAreaAssessment>;
}

export interface BodyMetricsProfile {
  completedAt?: string;
  skippedAt?: string;
}

export interface PersonalProfile {
  completedAt?: string;
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
}

export interface GuidedOnboardingProfile {
  completedAt?: string;
  selectedModules: ModuleId[];
  whatsappNumber?: string;
  whatsappSkippedAt?: string;
  selectedCharacterId?: string;
  selectedRoomId?: string;
}

export interface ModuleConfig {
  id: ModuleId;
  name: string;
  route: string;
  description: string;
  detail: string;
  unitLabel: string;
  color: string;
  accent: string;
}

export interface Achievement {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: AchievementCategory;
  rarity: "Comum" | "Incomum" | "Raro" | "Épico" | "Lendário";
  unlocked: boolean;
}

export interface ArenaStats {
  victories: number;
  matches: number;
  totalDamage: number;
  lastOpponent?: string;
  lastResult?: string;
  combatLog: string[];
}

export interface AppSettings {
  theme: ThemeId;
  sound: boolean;
  vibration: boolean;
  darkMode: boolean;
  notifications: boolean;
  activeModules: Record<ModuleId, boolean>;
  moduleOrder: ModuleId[];
  dashboardSectionOrder: DashboardSectionId[];
  hiddenDashboardSections: DashboardSectionId[];
}

export interface WorkoutExercise {
  id: string;
  name: string;
  muscleGroup: WorkoutMuscleGroup;
  bodyArea: string;
  sets: number;
  repRange: string;
  notes?: string;
}

export interface CardioBlock {
  id: string;
  label: string;
  durationMinutes: number;
  notes?: string;
}

export interface WorkoutDayPlan {
  id: string;
  weekday: Weekday;
  title: string;
  focus: string;
  summary: string;
  isRestDay: boolean;
  exercises: WorkoutExercise[];
  accessoryWork: string[];
  cardio?: CardioBlock;
}

export interface WorkoutLoadEntry {
  id: string;
  key: string;
  programId: string;
  dayId: string;
  dayTitle: string;
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  weightKg: number;
  repetitions: number;
  loggedAt: string;
  note?: string;
}

export interface WorkoutDayCompletion {
  id: string;
  programId: string;
  dayId: string;
  dayTitle: string;
  dateKey: string;
  completedAt: string;
}

/** Adiamento de uma ocorrência de treino: o dia `dayId` que cairia em
 *  `fromDateKey` (agendamento normal) é movido pra `toDateKey`. Usado
 *  pelo botão "Passar pra amanhã" da aba Missões. fromDateKey guarda a
 *  data ORIGINAL agendada (pra esconder só aquela ocorrência, sem
 *  afetar as próximas semanas). */
export interface WorkoutDayDeferral {
  dayId: string;
  fromDateKey: string;
  toDateKey: string;
}

export interface NutritionMacros {
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  calories: number;
}

export type FoodSource = "database" | "custom" | "usda" | "tbca";
export type FoodKind = "food" | "supplement";

export interface FoodDatabaseItem {
  id: string;
  name: string;
  servingLabel: string;
  macros: NutritionMacros;
  source: FoodSource;
  kind: FoodKind;
  favorite?: boolean;
}

export interface UsdaFoodSearchResult {
  fdcId: number;
  name: string;
  brandName?: string;
  brandOwner?: string;
  category?: string;
  dataType: string;
  servingLabel: string;
  macros: NutritionMacros;
}

export interface TbcaFoodSearchResult {
  code: string;
  name: string;
  category?: string;
  servingLabel: string;
  macros: NutritionMacros;
}

export type MealCategory =
  | "fasting"
  | "breakfast"
  | "lunch"
  | "intra"
  | "dinner"
  | "supplements";

export interface MealPlanItem {
  id: string;
  foodId?: string;
  label: string;
  quantityLabel: string;
  macros: NutritionMacros;
  kind: FoodKind;
  notes?: string;
  completed?: boolean;
  completedAt?: string;
  // Per-date completion history (YYYY-MM-DD keys). Same pattern usado em
  // Task.completedDates — sobrevive a hidratações e ao normalize diário,
  // permitindo histórico real (semanal/mensal/trimestral) em vez de só
  // o último dia marcado.
  completedDates?: string[];
}

export interface MealPlanBlock {
  id: string;
  title: string;
  time: string;
  category: MealCategory;
  items: MealPlanItem[];
  notes?: string;
}

/* Itens consumidos fora do plano regular ("comi um pão de queijo a mais hoje").
   Não entram no cardápio-padrão, mas contam no consumo do dia e ficam
   registrados no histórico. */
export interface NutritionDailyExtra {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  label: string;
  quantityLabel: string;
  macros: NutritionMacros;
  kind: FoodKind;
  /** ISO timestamp do momento em que foi adicionado. */
  addedAt: string;
  /** Vínculo opcional com um FoodDatabaseItem existente. */
  foodId?: string;
  notes?: string;
}

export interface NutritionWeightGoal {
  targetWeightKg: number;
  weeklyChangeKg: number;
}

export interface DailyNutritionTargets {
  waterMl: number;
  bodyWeightKg: number;
  bodyHeightCm: number;
  ageYears: number;
  biologicalSex: BiologicalSex;
  basalMetabolicRate: number;
  basalMetabolicRateSource: BasalMetabolicRateSource;
  goalAdjustmentKcal: number;
  weightGoal: NutritionWeightGoal;
  fiberStrategy: "per-calories" | "per-kg";
  fiberPer1000Kcal: number;
  fiberPerKg: number;
  fiberRatioGrams: number;
  fiberRatioCalories: number;
  sodiumTargetMg: number;
  totals: NutritionMacros;
  perKg: {
    waterMl: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export type NutritionDayType =
  | "default"
  | "high-carb"
  | "low-carb"
  | "recovery";

export interface NutritionWeightEntry {
  id: string;
  date: string;
  weightKg: number;
}

export interface NutritionWaterEntry {
  date: string;
  consumedMl: number;
}

export interface DietWorkoutLinkSettings {
  enabled: boolean;
  trainingDayType: NutritionDayType;
  cardioOnlyDayType: NutritionDayType;
  restDayType: NutritionDayType;
}

export interface FoodSubstitutionGroup {
  id: string;
  title: string;
  primaryFoodId?: string;
  mealCategory?: MealCategory;
  alternativeFoodIds: string[];
  notes?: string;
}

export interface SavedDietPlan {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  createdAt: string;
  mealPlan: MealPlanBlock[];
  nutritionGoal: NutritionGoalId;
  nutritionTargets: DailyNutritionTargets;
  dayTypes: Record<Weekday, NutritionDayType>;
  workoutLinkSettings: DietWorkoutLinkSettings;
  foodSubstitutions: FoodSubstitutionGroup[];
}

export interface SavedWorkoutProgram {
  id: string;
  name: string;
  splitLabel: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  createdAt: string;
  workoutPlan: WorkoutDayPlan[];
}

/* ── Recovery (mobility, stretching, miofascial release) ────────
   Mirrors the workout architecture but adapted for mobility:
   no weight load — each exercise has a free "durationOrReps"
   string ("30s cada lado", "10 reps lentas", "1 min hold").  */

export interface RecoveryExercise {
  id: string;
  name: string;
  bodyArea: string;
  sets: number;
  durationOrReps: string;
  notes?: string;
}

export interface RecoveryDayPlan {
  id: string;
  weekday: Weekday;
  title: string;
  focus: string;
  summary: string;
  isRestDay: boolean;
  exercises: RecoveryExercise[];
  notes?: string;
}

export interface RecoveryDayCompletion {
  id: string;
  programId: string;
  dayId: string;
  dayTitle: string;
  dateKey: string;
  completedAt: string;
}

export interface SavedRecoveryProgram {
  id: string;
  name: string;
  focus?: string;
  notes?: string;
  createdAt: string;
  recoveryPlan: RecoveryDayPlan[];
}

export type ReminderEntityType =
  | "task"
  | "meal"
  | "supplement"
  | "workout"
  | "cardio";

export interface ReminderItem {
  id: string;
  entityType: ReminderEntityType;
  entityId: string;
  title: string;
  time: string;
  weekdays?: Weekday[];
  enabled: boolean;
  delivery: "native-pending" | "web-push" | "in-app";
  note?: string;
  // Pré-aviso individual deste lembrete, em minutos antes do horário.
  // undefined = usa o padrão global (notificationPreWarnMinutes). 0 = sem
  // pré-aviso (só o aviso na hora). Permite timer por tarefa no Telegram.
  preWarnMinutes?: number;
}

export interface FinanceLesson {
  id: string;
  title: string;
  description: string;
  duration: number;
  points: number;
  completed: boolean;
}

export interface FinanceCategory {
  id: string;
  name: string;
  kind: FinanceLineKind;
  icon: string;
}

export type FinanceCardBrand = "visa" | "mastercard" | "elo" | "amex" | "other";

/**
 * Cartão de crédito como entidade de primeira classe. Antes "cartão" era
 * só um cardName string solto numa linha (nunca exibido, apagado a cada
 * edit). Agora tem id próprio, cor pra identificação visual e vencimento
 * que serve de default pras linhas que apontam pra ele via cardId.
 */
export interface FinanceCard {
  id: string;
  name: string;
  /** Hex da paleta fixa, usado direto em style inline (cada cartão é independente do tema). */
  color: string;
  /** Dia de vencimento do cartão; vira default da linha quando ela não tem dueDay próprio. */
  dueDay?: number;
  brand?: FinanceCardBrand;
  /** 4 últimos dígitos, só pra exibir •••• 1234. */
  last4?: string;
  /** Ordenação na carteira. */
  order?: number;
  /** Soft-delete: some da carteira sem apagar lançamentos. */
  archived?: boolean;
}

export interface FinanceBudgetLine {
  id: string;
  name: string;
  kind: FinanceLineKind;
  category: string;
  frequency: FinanceLineFrequency;
  paymentMethod: FinancePaymentMethod;
  /** @deprecated usar cardId — mantido só para migração de dados salvos. */
  cardName?: string;
  /** FK → FinanceCard.id; relevante quando paymentMethod === 'credit-card'. */
  cardId?: string;
  dueDay?: number;
  notes?: string;
  sourceKey?: string;
  managedBySystem?: boolean;
  syncScope?: ShoppingModuleScope;
  monthly: Record<FinanceMonthId, number>;
  settledMonths?: Partial<Record<FinanceMonthId, boolean>>;
  settledAmounts?: Partial<Record<FinanceMonthId, number>>;
}

export interface HouseholdSupplyItem {
  id: string;
  name: string;
  category?: string;
  unitPrice: number;
  packageQuantity: number;
  monthlyNeed: number;
  link?: string;
}


export interface WorkControlEntry {
  id: string;
  clientName: string;
  referenceNumber: string;
  entryType: string;
  startDate?: string;
  fatalDeadline?: string;
  progressLabel: string;
  notes: string;
}

export interface FinanceYearBudget {
  year: number;
  startCash: number;
  lines: FinanceBudgetLine[];
  cards?: FinanceCard[];
  /** Base manual da fatura "sem cartão" (legado: linhas credit-card sem cardId). */
  cardInvoiceBase?: Partial<Record<FinanceMonthId, number>>;
  /** Base manual por cartão (fase 2): cardId → mês → valor. */
  cardInvoiceBaseByCard?: Partial<Record<string, Partial<Record<FinanceMonthId, number>>>>;
  sheetReportedExpenseTotal?: number;
}

export type ShoppingModulesState = Record<
  ShoppingModuleScope,
  ShoppingModuleStoredState
>;

export interface AppearanceRoutineTemplate {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string;
  frequencyLabel: string;
  defaultTime: string;
  suggestedXp: number;
  defaultWeekdays: Weekday[];
  steps: string[];
}

export interface ThemeOption {
  id: ThemeId;
  name: string;
  primary: string;
  secondary: string;
  glow: string;
}

export interface PersistedState {
  session: {
    authenticated: boolean;
    userId: string;
    email: string;
    name: string;
    username: string;
    lastLoginAt?: string;
  };
  tasks: Task[];
  guidedOnboarding: GuidedOnboardingProfile;
  lifeAreaProfile: LifeAreaProfile;
  bodyMetricsProfile: BodyMetricsProfile;
  personalProfile: PersonalProfile;
  settings: AppSettings;
  nutritionGoal: NutritionGoalId;
  workoutMode: WorkoutMode;
  arena: ArenaStats;
  financeLessons: FinanceLesson[];
  workoutPlan: WorkoutDayPlan[];
  workoutLoadEntries: WorkoutLoadEntry[];
  workoutDayCompletions: WorkoutDayCompletion[];
  /** Ocorrências de treino adiadas pro dia seguinte (botão "Passar pra
   *  amanhã"). Opcional pra back-compat com estados salvos antes. */
  workoutDayDeferrals?: WorkoutDayDeferral[];
  mealPlan: MealPlanBlock[];
  /** Lista plana de extras esporádicos do dia a dia. Cada entry guarda
   *  date (YYYY-MM-DD) e os macros — usada para somar consumo do dia e
   *  para gerar o histórico de consumo ao longo do tempo. */
  nutritionDailyExtras: NutritionDailyExtra[];
  foodDatabase: FoodDatabaseItem[];
  dailyNutritionTargets: DailyNutritionTargets;
  weightEntries: NutritionWeightEntry[];
  waterEntries: NutritionWaterEntry[];
  dietDayTypes: Record<Weekday, NutritionDayType>;
  dietWeekSchedule: Record<Weekday, string>;
  dietWorkoutLink: DietWorkoutLinkSettings;
  foodSubstitutions: FoodSubstitutionGroup[];
  dietPlans: SavedDietPlan[];
  activeDietPlanId: string;
  workoutPrograms: SavedWorkoutProgram[];
  activeWorkoutProgramId: string;
  recoveryPrograms: SavedRecoveryProgram[];
  activeRecoveryProgramId: string;
  recoveryPlan: RecoveryDayPlan[];
  recoveryDayCompletions: RecoveryDayCompletion[];
  reminders: ReminderItem[];
  householdSupplies: HouseholdSupplyItem[];
  workControlEntries: WorkControlEntry[];
  shoppingModules: ShoppingModulesState;
  financeBudget: FinanceYearBudget;
  financeCategories: FinanceCategory[];
  sleepPlan: SleepWeeklyPlan;
  sleepHistory: SleepLogEntry[];
  /* Generic per-module KV bucket. Modules that historically stored
     their own state in window.localStorage (run, health, fuel
     planner, quick diary, countdown timers, etc.) now serialize
     their full state under a key here so it syncs across devices
     via the central account-state envelope. Each module owns its
     own shape inside its slot. */
  moduleState: Record<string, unknown>;
  /* Frases motivacionais que o próprio usuário cadastra nas
     Configurações. Aparecem no overlay de transição entre páginas e
     são anexadas aos lembretes do Telegram, junto das frases nativas. */
  customQuotes: CustomQuote[];
  /* Textos das frases NATIVAS que o usuário escondeu nas Configurações.
     Guardamos o texto (não há id no array em código); o pool de frases
     filtra por ele no overlay e nos lembretes do Telegram. */
  hiddenQuotes: string[];
  /* Minutos do PRÉ-AVISO das notificações (o "⏰ Em N min"). Configurável
     nas Missões; padrão 5; 0 desliga o pré-aviso. */
  notificationPreWarnMinutes?: number;
}

export interface CustomQuote {
  id: string;
  text: string;
  author?: string;
}

/* ── Sleep ──────────────────────────────────────────────────────
   Sleep weekly schedule + history. Persisted in KV so the user's
   alarm targets + nightly logs survive across browser / device. */

export interface SleepDayPlan {
  enabled: boolean;
  bedtime: string;
  wakeTime: string;
}

export interface SleepWeeklyPlan {
  recommendedHours: string;
  days: Record<Weekday, SleepDayPlan>;
}

export interface SleepLogEntry {
  id: string;
  date: string;
  bedtime: string;
  wakeTime: string;
  hours: number;
  createdAt: string;
}


