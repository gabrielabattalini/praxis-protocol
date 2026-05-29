import type {
  Achievement,
  AppearanceRoutineCategory,
  AppearanceRoutineTemplate,
  DashboardSectionId,
  DailyNutritionTargets,
  DietWorkoutLinkSettings,
  FinanceCategory,
  FinanceBudgetLine,
  FinanceYearBudget,
  FoodDatabaseItem,
  FoodSubstitutionGroup,
  FinanceLesson,
  GuidedOnboardingProfile,
  HouseholdSupplyItem,
  LifeAreaProfile,
  MealPlanBlock,
  ModuleId,
  ModuleConfig,
  NutritionDayType,
  NutritionGoalId,
  NutritionWaterEntry,
  NutritionWeightEntry,
  PersonalProfile,
  PersistedState,
  RankTier,
  ReminderItem,
  SavedDietPlan,
  SavedWorkoutProgram,
  Task,
  ThemeOption,
  UserProfile,
  WorkoutDayPlan,
  WorkoutExercise,
  WorkoutMuscleGroup,
} from "@/lib/types";
import { getShoppingSeedState } from "@/lib/shopping-seed";
import { workControlSeed } from "@/lib/work-control-seed";

export const storageKey = "praxis-protocol-store";
export const legacyStorageKey = "nexus-preview-store";

export function getScopedStorageKey(userId: string) {
  return `${storageKey}:${userId}`;
}

export const themeOptions: ThemeOption[] = [
  {
    id: "default",
    name: "Padrão",
    primary: "#35d6b4",
    secondary: "#8ff7c7",
    glow: "rgba(53, 214, 180, 0.3)",
  },
  {
    id: "ocean",
    name: "Oceano",
    primary: "#38bdf8",
    secondary: "#0ea5e9",
    glow: "rgba(56, 189, 248, 0.32)",
  },
  {
    id: "sunset",
    name: "Pôr do Sol",
    primary: "#f97316",
    secondary: "#fb7185",
    glow: "rgba(251, 113, 133, 0.35)",
  },
  {
    id: "forest",
    name: "Floresta",
    primary: "#34d399",
    secondary: "#84cc16",
    glow: "rgba(52, 211, 153, 0.32)",
  },
  {
    id: "royal",
    name: "Royal",
    primary: "#a855f7",
    secondary: "#6366f1",
    glow: "rgba(168, 85, 247, 0.34)",
  },
  {
    id: "gold",
    name: "Ouro",
    primary: "#facc15",
    secondary: "#f59e0b",
    glow: "rgba(250, 204, 21, 0.3)",
  },
];

export const moduleCatalog: ModuleConfig[] = [
  {
    id: "run",
    name: "Cardio",
    route: "/modules/run",
    description: "Metas semanais, registro manual e pace calculado",
    detail: "km / pace",
    unitLabel: "meta + histórico",
    color: "from-emerald-400/20 to-cyan-400/15",
    accent: "text-emerald-300",
  },
  {
    id: "workout",
    name: "Treino",
    route: "/modules/workout",
    description: "Programas de treino com sessões, exercícios e histórico",
    detail: "força / volume",
    unitLabel: "80 exercícios/mês",
    color: "from-rose-400/20 to-orange-400/15",
    accent: "text-rose-300",
  },
  {
    id: "work",
    name: "Trabalho",
    route: "/modules/work",
    description: "Tasks de trabalho, entregas, blocos de foco e rotina profissional",
    detail: "foco / entregas",
    unitLabel: "projetos e tarefas",
    color: "from-sky-400/20 to-indigo-400/15",
    accent: "text-sky-200",
  },
  {
    id: "nutrition",
    name: "Dieta",
    route: "/modules/nutrition",
    description: "Planejamento alimentar, metas e consistência diária",
    detail: "refeições / meta",
    unitLabel: "90 refeições/mês",
    color: "from-lime-400/20 to-emerald-400/15",
    accent: "text-lime-300",
  },
  {
    id: "finance",
    name: "Finanças",
    route: "/modules/finance",
    description: "Educação financeira e controle detalhado de gastos",
    detail: "lições / controle",
    unitLabel: "8 lições",
    color: "from-amber-400/20 to-yellow-400/15",
    accent: "text-amber-300",
  },
  {
    id: "appearance",
    name: "Aparência",
    route: "/modules/appearance",
    description: "Rotinas de skincare, massagem e cuidados pessoais",
    detail: "rotinas / consistência",
    unitLabel: "11 rotinas",
    color: "from-fuchsia-400/20 to-pink-400/15",
    accent: "text-pink-300",
  },
  {
    id: "recovery",
    name: "Recuperação",
    route: "/modules/recovery",
    description: "Mobilidade, alongamento, liberação e descanso pós-treino",
    detail: "dor / recuperação",
    unitLabel: "check-ins semanais",
    color: "from-cyan-400/20 to-sky-400/15",
    accent: "text-cyan-200",
  },
  {
    id: "health",
    name: "Saúde",
    route: "/modules/health",
    description: "Exames, consultas, check-ups e acompanhamento periódico",
    detail: "exames / check-up",
    unitLabel: "protocolos de saúde",
    color: "from-emerald-400/20 to-teal-400/15",
    accent: "text-emerald-200",
  },
  {
    id: "mind",
    name: "Mente",
    route: "/modules/mind",
    description: "Meditação, respiração, journal rápido, foco e humor",
    detail: "clareza / foco",
    unitLabel: "sessões mentais",
    color: "from-violet-400/20 to-indigo-400/15",
    accent: "text-violet-200",
  },
  {
    id: "sleep",
    name: "Sono",
    route: "/modules/sleep",
    description: "Horário de dormir, qualidade, horas dormidas e cafeína tarde",
    detail: "sono / rotina",
    unitLabel: "noites registradas",
    color: "from-slate-400/20 to-blue-400/15",
    accent: "text-slate-200",
  },
  {
    id: "home",
    name: "Casa",
    route: "/modules/home",
    description: "Limpeza, lavanderia, compras, manutenção e organização",
    detail: "casa / ordem",
    unitLabel: "tarefas domésticas",
    color: "from-orange-400/20 to-amber-400/15",
    accent: "text-orange-200",
  },
  {
    id: "market",
    name: "Mercado",
    route: "/modules/market",
    description: "Busca de reposição da casa com comparação entre lojas e frete",
    detail: "preço / frete",
    unitLabel: "produtos da casa",
    color: "from-amber-400/20 to-orange-400/15",
    accent: "text-amber-200",
  },
  {
    id: "supplements",
    name: "Suplementos / Remédios",
    route: "/modules/supplements",
    description: "Comparador de suplementos e remédios por nome, marca e quantidade",
    detail: "marca / dose",
    unitLabel: "busca precisa",
    color: "from-cyan-400/20 to-blue-400/15",
    accent: "text-cyan-200",
  },
];

export const defaultModuleOrder = moduleCatalog.map((module) => module.id);

export const defaultDashboardSectionOrder: DashboardSectionId[] = [
  "quick-actions",
  "timeline",
  "telemetry",
  "modules",
  "ranking",
  "skills",
];

export const initialTasks: Task[] = [
  {
    id: "task-pull",
    title: "Pull Day: Treino de Força",
    description:
      "Faça um treino de força com puxada alta, remada e crucifixo inverso.",
    category: "fitness",
    moduleId: "workout",
    difficulty: "hard",
    xp: 55,
    completed: false,
    recurrence: {
      kind: "selected-weekdays",
      weekdays: ["monday", "wednesday"],
    },
  },
  {
    id: "task-push",
    title: "Punch Day: Treino de Força",
    description:
      "Faça um treino composto com supino, agachamento e levantamento.",
    category: "fitness",
    moduleId: "workout",
    difficulty: "hard",
    xp: 55,
    completed: false,
    recurrence: {
      kind: "selected-weekdays",
      weekdays: ["tuesday", "thursday"],
    },
  },
  {
    id: "task-legs",
    title: "Legs Day: Treino de Força",
    description:
      "Complete uma sessão pesada com agachamento, leg press e panturrilha.",
    category: "fitness",
    moduleId: "workout",
    difficulty: "hard",
    xp: 55,
    completed: false,
    recurrence: {
      kind: "weekly-fixed",
      weekday: "friday",
    },
  },
];

export function createDefaultLifeAreaProfile(): LifeAreaProfile {
  const defaultArea = {
    importance: "C" as const,
    currentLevel: "C" as const,
  };

  const areas = moduleCatalog.reduce<Record<ModuleId, typeof defaultArea>>(
    (accumulator, module) => {
      accumulator[module.id] = { ...defaultArea };
      return accumulator;
    },
    {} as Record<ModuleId, typeof defaultArea>,
  );

  return {
    completedAt: undefined,
    areas,
  };
}

export function createDefaultGuidedOnboardingProfile(): GuidedOnboardingProfile {
  return {
    completedAt: undefined,
    selectedModules: [],
    whatsappNumber: undefined,
    whatsappSkippedAt: undefined,
    selectedCharacterId: undefined,
    selectedRoomId: undefined,
  };
}

export const personalProfileSeed: PersonalProfile = {
  ageYears: 30,
  bodyHeightCm: 175,
  bodyWeightKg: 84,
  biologicalSex: "male",
  activityLevel: "moderate",
  cardioGoal: "health",
  preferredCardio: "running",
  hasCardiovascularCondition: false,
  hasJointLimitation: false,
  usesHeartRateMedication: false,
};

export const achievementCatalog: Achievement[] = [
  {
    id: "streak-3",
    name: "Começando",
    icon: "\u{1F525}",
    description: "Mantenha um streak de 3 dias.",
    category: "streak",
    rarity: "Comum",
    unlocked: false,
  },
  {
    id: "streak-30",
    name: "Um Mês!",
    icon: "\u{1F31F}",
    description: "Mantenha um streak de 30 dias.",
    category: "streak",
    rarity: "Raro",
    unlocked: false,
  },
  {
    id: "task-1",
    name: "Primeira Task",
    icon: "\u2705",
    description: "Complete sua primeira task.",
    category: "tasks",
    rarity: "Comum",
    unlocked: false,
  },
  {
    id: "task-100",
    name: "Centurião",
    icon: "\u{1F4AF}",
    description: "Complete 100 tasks.",
    category: "tasks",
    rarity: "Raro",
    unlocked: false,
  },
  {
    id: "run-10k",
    name: "10K Total",
    icon: "\u{1F3C3}",
    description: "Corra 10km no total.",
    category: "fitness",
    rarity: "Incomum",
    unlocked: false,
  },
  {
    id: "workout-100",
    name: "100 Séries",
    icon: "\u{1F4AA}",
    description: "Complete 100 séries de exercícios.",
    category: "fitness",
    rarity: "Incomum",
    unlocked: false,
  },
  {
    id: "friend-1",
    name: "Primeiro Amigo",
    icon: "\u{1F91D}",
    description: "Adicione seu primeiro amigo.",
    category: "social",
    rarity: "Comum",
    unlocked: false,
  },
  {
    id: "friend-10",
    name: "Popular",
    icon: "\u{1F31F}",
    description: "Tenha 10 amigos.",
    category: "social",
    rarity: "Incomum",
    unlocked: false,
  },
  {
    id: "arena-1",
    name: "Competidor",
    icon: "\u2694\uFE0F",
    description: "Participe da sua primeira Arena.",
    category: "arena",
    rarity: "Comum",
    unlocked: false,
  },
  {
    id: "arena-win",
    name: "Vitorioso",
    icon: "\u{1F3C6}",
    description: "Vença sua primeira Arena.",
    category: "arena",
    rarity: "Incomum",
    unlocked: false,
  },
  {
    id: "study-master",
    name: "Mestre do Foco",
    icon: "\u{1F9E0}",
    description: "Complete 20 sessões de estudo com consistência.",
    category: "modules",
    rarity: "Épico",
    unlocked: false,
  },
  {
    id: "nutrition-clean",
    name: "Corpo em Dia",
    icon: "\u{1F957}",
    description: "Registre 15 refeições com consistência.",
    category: "modules",
    rarity: "Incomum",
    unlocked: false,
  },
  {
    id: "finance-starter",
    name: "Investidor Inicial",
    icon: "\u{1F4B8}",
    description: "Conclua 3 lições de finanças.",
    category: "modules",
    rarity: "Comum",
    unlocked: false,
  },
  {
    id: "appearance-routine",
    name: "Glow Up",
    icon: "\u2728",
    description: "Finalize 10 rotinas de aparência.",
    category: "modules",
    rarity: "Raro",
    unlocked: false,
  },
  {
    id: "points-1k",
    name: "1K XP",
    icon: "⭐",
    description: "Alcance 1000 XP totais.",
    category: "ranking",
    rarity: "Comum",
    unlocked: false,
  },
  {
    id: "points-10k",
    name: "10K XP",
    icon: "\u{1F4AB}",
    description: "Alcance 10000 XP totais.",
    category: "ranking",
    rarity: "Raro",
    unlocked: false,
  },
  {
    id: "level-10",
    name: "Level 10",
    icon: "\u{1F51F}",
    description: "Alcance o level 10.",
    category: "ranking",
    rarity: "Incomum",
    unlocked: false,
  },
  {
    id: "legendary",
    name: "100K XP",
    icon: "\u{1F451}",
    description: "Alcance 100000 XP totais.",
    category: "ranking",
    rarity: "Lendário",
    unlocked: false,
  },
];

// rankingSeedBase removido — eram 10 personagens fake (Zenkichi,
// Kurama, Levi, All Might, Aizen, Edward, Sung Jin Woo, Gojo,
// Kurapika, Sasuke) que apareciam em /ranking, /friends e no card
// "Sua posição" do dashboard. Sem sinal real até a camada social
// existir. Removidos junto com a export const rankingSeed.

export const financeLessonSeed: FinanceLesson[] = [
  {
    id: "lesson-budget",
    title: "Orçamento 50-30-20",
    description: "Entenda a regra simples para organizar renda, desejos e reserva.",
    duration: 8,
    points: 25,
    completed: false,
  },
  {
    id: "lesson-emergency",
    title: "Reserva de Emergência",
    description: "Monte sua proteção financeira para imprevistos.",
    duration: 6,
    points: 20,
    completed: false,
  },
  {
    id: "lesson-fixed-income",
    title: "Renda Fixa vs Variável",
    description: "Compare previsibilidade, risco e retorno.",
    duration: 10,
    points: 30,
    completed: false,
  },
  {
    id: "lesson-compound",
    title: "Juros Compostos",
    description: "Veja como consistência e tempo multiplicam seu capital.",
    duration: 8,
    points: 30,
    completed: false,
  },
  {
    id: "lesson-debt",
    title: "Como Sair das Dívidas",
    description: "Avalanche, negociação e plano tático de corte.",
    duration: 12,
    points: 35,
    completed: false,
  },
  {
    id: "lesson-tesouro",
    title: "Tesouro Direto",
    description: "Comece com baixo valor em títulos públicos.",
    duration: 9,
    points: 25,
    completed: false,
  },
];

export const financeCategorySeed: FinanceCategory[] = [
  { id: "finance-category-income-main", name: "Renda principal", kind: "income", icon: "\u{1F4BC}" },
  { id: "finance-category-income-extra", name: "Renda extra", kind: "income", icon: "\u2728" },
  { id: "finance-category-income-freelance", name: "Freelance", kind: "income", icon: "\u{1F9FE}" },
  { id: "finance-category-income-commission", name: "Comissão", kind: "income", icon: "\u{1F4C8}" },
  { id: "finance-category-income-sale", name: "Venda", kind: "income", icon: "\u{1F6CD}\uFE0F" },
  { id: "finance-category-income-investments", name: "Investimentos", kind: "income", icon: "\u{1F3E6}" },
  { id: "finance-category-expense-housing", name: "Moradia", kind: "expense", icon: "\u{1F3E0}" },
  { id: "finance-category-expense-subscriptions", name: "Assinaturas", kind: "expense", icon: "\u{1F501}" },
  { id: "finance-category-expense-food", name: "Alimentação", kind: "expense", icon: "\u{1F37D}\uFE0F" },
  { id: "finance-category-expense-pet", name: "Pet", kind: "expense", icon: "\u{1F43E}" },
  { id: "finance-category-expense-fitness", name: "Treino", kind: "expense", icon: "\u{1F3CB}\uFE0F" },
  { id: "finance-category-expense-transport", name: "Transporte", kind: "expense", icon: "\u{1F697}" },
  { id: "finance-category-expense-card", name: "Cartão", kind: "expense", icon: "\u{1F4B3}" },
  { id: "finance-category-expense-services", name: "Serviços", kind: "expense", icon: "\u{1F6E0}\uFE0F" },
  { id: "finance-category-expense-leisure", name: "Lazer", kind: "expense", icon: "\u{1F39F}\uFE0F" },
  { id: "finance-category-expense-education", name: "Educação", kind: "expense", icon: "\u{1F4DA}" },
  { id: "finance-category-expense-cash", name: "Dinheiro", kind: "expense", icon: "\u{1F4B5}" },
];

function monthValues(
  january: number,
  february: number,
  march: number,
  april: number,
  may: number,
  june: number,
  july: number,
  august: number,
  september: number,
  october: number,
  november: number,
  december: number,
) {
  return {
    january,
    february,
    march,
    april,
    may,
    june,
    july,
    august,
    september,
    october,
    november,
    december,
  };
}

function budgetLine(
  id: string,
  name: string,
  kind: FinanceBudgetLine["kind"],
  category: string,
  frequency: FinanceBudgetLine["frequency"],
  paymentMethod: FinanceBudgetLine["paymentMethod"],
  monthly: ReturnType<typeof monthValues>,
  options?: {
    dueDay?: number;
    cardName?: string;
    notes?: string;
  },
): FinanceBudgetLine {
  return {
    id,
    name,
    kind,
    category,
    frequency,
    paymentMethod,
    monthly,
    dueDay: options?.dueDay,
    cardName: options?.cardName,
    notes: options?.notes,
  };
}

export const financeBudgetSeed: FinanceYearBudget = {
  year: 2026,
  startCash: 463,
  cardInvoiceBase: monthValues(
    0,
    0,
    0,
    2387.59,
    1250,
    682.75,
    682.75,
    654.35,
    654.35,
    654.35,
    654.35,
    654.35,
  ),
  sheetReportedExpenseTotal: 35850.62,
  lines: [
    budgetLine(
      "income-salary",
      "Salario",
      "income",
      "Renda principal",
      "fixed",
      "bank-transfer",
      monthValues(0, 0, 0, 4500, 4500, 4500, 4500, 4500, 4500, 4500, 4500, 4500),
      { dueDay: 15 },
    ),
    budgetLine(
      "income-extra",
      "Renda extra",
      "income",
      "Extra",
      "variable",
      "pix",
      monthValues(0, 0, 0, 1695, 0, 0, 0, 0, 0, 0, 0, 0),
      { dueDay: 15 },
    ),
    budgetLine(
      "expense-google",
      "Armazenamento Google",
      "expense",
      "Assinaturas",
      "fixed",
      "credit-card",
      monthValues(0, 0, 0, 9.9, 9.9, 9.9, 9.9, 9.9, 9.9, 9.9, 9.9, 9.9),
      { dueDay: 4, cardName: "Inter" },
    ),
    budgetLine(
      "expense-youtube",
      "Youtube Premium",
      "expense",
      "Assinaturas",
      "fixed",
      "credit-card",
      monthValues(0, 0, 0, 26.9, 26.9, 26.9, 26.9, 26.9, 26.9, 26.9, 26.9, 26.9),
      { dueDay: 11, cardName: "Inter" },
    ),
    budgetLine(
      "expense-sobrancelha",
      "Sobrancelha",
      "expense",
      "Beleza",
      "fixed",
      "pix",
      monthValues(0, 0, 0, 48, 48, 48, 48, 48, 48, 48, 48, 48),
      { dueDay: 30 },
    ),
    budgetLine(
      "expense-diana",
      "Comida e tapetinho Diana",
      "expense",
      "Pet",
      "variable",
      "pix",
      monthValues(0, 0, 0, 0, 100, 100, 100, 100, 100, 100, 100, 100),
    ),
    budgetLine(
      "expense-gym",
      "Academia",
      "expense",
      "Treino",
      "fixed",
      "credit-card",
      monthValues(0, 0, 0, 120, 120, 120, 120, 120, 120, 120, 120, 120),
      { dueDay: 20, cardName: "Inter" },
    ),
    budgetLine(
      "expense-barber",
      "Cortar cabelo e barba",
      "expense",
      "Beleza",
      "variable",
      "cash",
      monthValues(0, 0, 0, 0, 140, 140, 140, 140, 140, 140, 140, 140),
      { dueDay: 30 },
    ),
    budgetLine(
      "expense-fuel",
      "Combustível",
      "expense",
      "Transporte",
      "variable",
      "cash",
      monthValues(0, 0, 0, 200, 400, 400, 400, 400, 400, 400, 400, 400),
    ),
    budgetLine(
      "expense-moto-insurance",
      "Seguro moto",
      "expense",
      "Transporte",
      "variable",
      "bank-slip",
      monthValues(0, 0, 0, 1157.3, 0, 0, 0, 0, 0, 0, 0, 0),
      { dueDay: 22 },
    ),
    budgetLine(
      "expense-condo",
      "Condominio + Água + gas",
      "expense",
      "Moradia",
      "fixed",
      "bank-transfer",
      monthValues(0, 0, 0, 800, 800, 800, 800, 800, 800, 800, 800, 800),
      { dueDay: 15 },
    ),
    budgetLine(
      "expense-cleaning",
      "Faxineira",
      "expense",
      "Servico",
      "fixed",
      "pix",
      monthValues(0, 0, 0, 440, 440, 440, 440, 440, 440, 440, 440, 440),
      { dueDay: 15 },
    ),
    budgetLine(
      "expense-market",
      "Mercado",
      "expense",
      "Alimentação",
      "fixed",
      "debit-card",
      monthValues(0, 0, 0, 800, 800, 800, 800, 800, 800, 800, 800, 800),
    ),
    budgetLine(
      "expense-mycon",
      "Mycon",
      "expense",
      "Dividas",
      "fixed",
      "bank-slip",
      monthValues(0, 0, 0, 373.35, 373.35, 373.35, 373.35, 373.35, 373.35, 373.35, 373.35, 373.35),
      { dueDay: 10 },
    ),
    budgetLine(
      "expense-energy",
      "Energia",
      "expense",
      "Moradia",
      "fixed",
      "bank-slip",
      monthValues(0, 0, 0, 300, 300, 300, 300, 300, 300, 300, 300, 300),
      { dueDay: 15 },
    ),
    budgetLine(
      "expense-supplements",
      "Suplementos e farmacia",
      "expense",
      "Saude",
      "variable",
      "pix",
      monthValues(0, 0, 0, 0, 300, 300, 300, 300, 300, 300, 300, 300),
    ),
    budgetLine(
      "expense-internet-phone",
      "Internet e celular",
      "expense",
      "Comunicação",
      "fixed",
      "credit-card",
      monthValues(0, 0, 0, 143.54, 143.54, 143.54, 143.54, 143.54, 143.54, 143.54, 143.54, 143.54),
      { dueDay: 15, cardName: "Inter" },
    ),
    budgetLine(
      "expense-iptu",
      "IPTU",
      "expense",
      "Impostos",
      "variable",
      "bank-slip",
      monthValues(0, 0, 0, 0, 389.32, 97.33, 97.33, 97.33, 97.33, 97.33, 97.33, 0),
      { dueDay: 15 },
    ),
    budgetLine(
      "expense-cash",
      "Gastos dinheiro",
      "expense",
      "Dinheiro",
      "variable",
      "cash",
      monthValues(0, 0, 0, 2856.89, 3546.21, 3254.22, 3254.22, 3254.22, 3254.22, 3254.22, 3254.22, 3156.89),
    ),
  ],
};

export const appearanceCategories: AppearanceRoutineCategory[] = [
  {
    id: "massage",
    name: "Massagens Faciais",
    description: "Técnicas de drenagem, tonificação e relaxamento.",
    routines: 3,
    points: "+15 pts / rotina",
  },
  {
    id: "skincare",
    name: "Rotinas de Skincare",
    description: "Limpeza, hidratação e proteção para a semana inteira.",
    routines: 3,
    points: "+20 pts / rotina",
  },
  {
    id: "targeted",
    name: "Tratamentos Direcionados",
    description: "Protocolos para acne, manchas e textura.",
    routines: 3,
    points: "+25 pts / rotina",
  },
  {
    id: "body",
    name: "Cuidados Corporais",
    description: "Rotinas de banho premium, hidratação e recuperação.",
    routines: 2,
    points: "+18 pts / rotina",
  },
];
export const appearanceCareCategories: AppearanceRoutineCategory[] = [
  {
    id: "standard",
    name: "Padrão",
    description: "Rotinas base de manhã e noite para manter consistência visual.",
    routines: 2,
    points: "+20 XP / rotina",
  },
  {
    id: "skincare",
    name: "Skincare",
    description: "Limpeza, hidratação, proteção e reparo para o rosto.",
    routines: 3,
    points: "+25 XP / rotina",
  },
  {
    id: "body",
    name: "Corpo",
    description: "Banho premium, hidratação corporal e recuperação visual.",
    routines: 2,
    points: "+18 XP / rotina",
  },
  {
    id: "grooming",
    name: "Grooming",
    description: "Cabelo, barba, unhas e outros acabamentos de presença.",
    routines: 2,
    points: "+22 XP / rotina",
  },
];

export const appearanceRoutineTemplates: AppearanceRoutineTemplate[] = [
  {
    id: "appearance-standard-morning",
    categoryId: "standard",
    categoryName: "Padrão",
    name: "Padrão da manhã",
    description: "Limpeza leve, hidratação e proteção para começar o dia alinhado.",
    frequencyLabel: "Base diária",
    defaultTime: "07:00",
    suggestedXp: 35,
    defaultWeekdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    steps: ["Lavar o rosto", "Hidratante", "Protetor solar"],
  },
  {
    id: "appearance-standard-night",
    categoryId: "standard",
    categoryName: "Padrão",
    name: "Padrão da noite",
    description: "Limpeza completa e recuperação antes de dormir.",
    frequencyLabel: "Base diária",
    defaultTime: "21:30",
    suggestedXp: 40,
    defaultWeekdays: [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ],
    steps: ["Remover resíduos", "Limpeza", "Hidratação ou tratamento"],
  },
  {
    id: "appearance-skincare-acne",
    categoryId: "skincare",
    categoryName: "Skincare",
    name: "Controle de oleosidade e acne",
    description: "Rotina objetiva para segurar brilho, acne e poros durante a semana.",
    frequencyLabel: "3x na semana",
    defaultTime: "20:30",
    suggestedXp: 45,
    defaultWeekdays: ["monday", "wednesday", "friday"],
    steps: ["Limpeza", "Sérum ou ácido", "Hidratante reparador"],
  },
  {
    id: "appearance-skincare-bright",
    categoryId: "skincare",
    categoryName: "Skincare",
    name: "Textura e luminosidade",
    description: "Sessão para textura, viço e acabamento mais uniforme.",
    frequencyLabel: "2x na semana",
    defaultTime: "21:00",
    suggestedXp: 42,
    defaultWeekdays: ["tuesday", "saturday"],
    steps: ["Esfoliação suave", "Máscara ou sérum", "Hidratação final"],
  },
  {
    id: "appearance-body-hydration",
    categoryId: "body",
    categoryName: "Corpo",
    name: "Banho e hidratação corporal",
    description: "Rotina de pele do corpo para manter toque, cheiro e acabamento.",
    frequencyLabel: "4x na semana",
    defaultTime: "20:45",
    suggestedXp: 28,
    defaultWeekdays: ["monday", "wednesday", "friday", "sunday"],
    steps: ["Banho caprichado", "Hidratante corporal", "Desodorante ou perfume"],
  },
  {
    id: "appearance-body-recovery",
    categoryId: "body",
    categoryName: "Corpo",
    name: "Recuperação corporal visual",
    description: "Pós-treino ou fim do dia com foco em postura, pele e relaxamento.",
    frequencyLabel: "2x na semana",
    defaultTime: "22:00",
    suggestedXp: 30,
    defaultWeekdays: ["tuesday", "thursday"],
    steps: ["Banho morno", "Hidratação localizada", "Auto cuidado de relaxamento"],
  },
  {
    id: "appearance-grooming-hair",
    categoryId: "grooming",
    categoryName: "Grooming",
    name: "Cabelo e couro cabeludo",
    description: "Lavagem, finalização e ajuste visual do cabelo.",
    frequencyLabel: "2x na semana",
    defaultTime: "19:30",
    suggestedXp: 32,
    defaultWeekdays: ["wednesday", "saturday"],
    steps: ["Lavar", "Tratar ou finalizar", "Organizar corte ou penteado"],
  },
  {
    id: "appearance-grooming-details",
    categoryId: "grooming",
    categoryName: "Grooming",
    name: "Barba, unhas e detalhes",
    description: "Acabamento de presença para manter visual limpo e alinhado.",
    frequencyLabel: "1x na semana",
    defaultTime: "18:30",
    suggestedXp: 38,
    defaultWeekdays: ["saturday"],
    steps: ["Barba ou depilação", "Unhas ou mãos", "Checagem final do visual"],
  },
];

export const workoutCatalog = {
  gym: [
    "Supino reto com barra",
    "Agachamento livre",
    "Levantamento terra",
    "Remada curvada",
    "Desenvolvimento com halteres",
    "Leg press 45°",
  ],
  calisthenics: [
    "Flexão tradicional",
    "Pike push-up",
    "Barra fixa",
    "Australian pull-up",
    "Agachamento livre",
    "Prancha isométrica",
  ],
};

export const nutritionGoals: Record<
  NutritionGoalId,
  {
    name: string;
    description: string;
    target: string;
    recommendation: string;
    defaultAdjustmentKcal: number;
  }
> = {
  lose_weight: {
    name: "Emagrecer",
    recommendation: "Deficit recomendado de 500 a 700 kcal",
    defaultAdjustmentKcal: -600,
    description: "Perder peso total com déficit calórico.",
    target: "Déficit de 500-700 kcal",
  },
  lose_fat: {
    name: "Perder Gordura",
    recommendation: "Deficit recomendado de 300 a 500 kcal",
    defaultAdjustmentKcal: -400,
    description: "Secar mantendo massa muscular.",
    target: "Déficit de 300-500 kcal",
  },
  gain_weight: {
    name: "Ganhar Peso",
    recommendation: "Superavit recomendado de 300 a 500 kcal",
    defaultAdjustmentKcal: 400,
    description: "Aumentar massa total com superávit controlado.",
    target: "Superávit de 300-500 kcal",
  },
  gain_muscle: {
    recommendation: "Superavit recomendado de 200 a 400 kcal",
    defaultAdjustmentKcal: 300,
    name: "Ganhar Músculos",
    description: "Hipertrofia com proteína alta e superávit leve.",
    target: "Superávit de 200-400 kcal",
  },
  maintain: {
    name: "Manter Peso",
    recommendation: "Sem ajuste calorico",
    defaultAdjustmentKcal: 0,
    description: "Manutenção limpa com ajuste fino da ingestão.",
    target: "Manutenção calórica",
  },
};

function macros(
  protein: number,
  carbs: number,
  fat: number,
  fiber: number,
  sodium: number,
  calories: number,
) {
  return {
    protein,
    carbs,
    fat,
    fiber,
    sodium,
    calories,
  };
}

export const workoutPlanSeed: WorkoutDayPlan[] = [
  {
    id: "workout-monday-a",
    weekday: "monday",
    title: "Push pesado",
    focus: "Peito, ombro e triceps",
    summary: "Sessão principal de empurrar com foco em carga e estabilidade.",
    isRestDay: false,
    exercises: [
      {
        id: "supino-inclinado",
        name: "Supino inclinado com halteres",
        muscleGroup: "Peito",
        bodyArea: "Peitoral superior",
        sets: 4,
        repRange: "6-10",
      },
      {
        id: "supino-reto-maquina",
        name: "Supino reto na máquina",
        muscleGroup: "Peito",
        bodyArea: "Peitoral médio",
        sets: 3,
        repRange: "8-12",
      },
      {
        id: "desenvolvimento-ombro",
        name: "Desenvolvimento de ombros",
        muscleGroup: "Ombro",
        bodyArea: "Deltoide anterior",
        sets: 3,
        repRange: "8-10",
      },
      {
        id: "elevacao-lateral",
        name: "Elevação lateral",
        muscleGroup: "Ombro",
        bodyArea: "Deltoide lateral",
        sets: 3,
        repRange: "12-15",
      },
      {
        id: "triceps-barra-w",
        name: "Tríceps no cabo barra W",
        muscleGroup: "Tríceps",
        bodyArea: "Cabeça lateral",
        sets: 3,
        repRange: "10-12",
      },
    ],
    accessoryWork: ["Aquecimento de manguito por 5 minutos"],
    cardio: {
      id: "cardio-monday",
      label: "Cardio pos treino",
      durationMinutes: 20,
      notes: "Zona moderada",
    },
  },
  {
    id: "workout-wednesday-c",
    weekday: "wednesday",
    title: "Lower completo",
    focus: "Pernas",
    summary: "Base de quadríceps e posterior com finalização de glúteos.",
    isRestDay: false,
    exercises: [
      {
        id: "agachamento-livre",
        name: "Agachamento livre ou no smith",
        muscleGroup: "Quadríceps",
        bodyArea: "Quadríceps",
        sets: 4,
        repRange: "6-10",
      },
      {
        id: "hack-machine",
        name: "Hack machine",
        muscleGroup: "Quadríceps",
        bodyArea: "Quadríceps",
        sets: 3,
        repRange: "8-12",
      },
      {
        id: "flexor-deitado",
        name: "Flexor deitado",
        muscleGroup: "Posterior",
        bodyArea: "Posterior de coxa",
        sets: 3,
        repRange: "10-12",
      },
      {
        id: "elevacao-pelvica",
        name: "Elevação pélvica",
        muscleGroup: "Glúteos",
        bodyArea: "Glúteos",
        sets: 3,
        repRange: "8-12",
      },
      {
        id: "panturrilha-livre",
        name: "Panturrilha",
        muscleGroup: "Panturrilha",
        bodyArea: "Panturrilha",
        sets: 3,
        repRange: "15-20",
      },
    ],
    accessoryWork: ["Mobilidade de quadril por 8 minutos"],
  },
  {
    id: "workout-friday-b",
    weekday: "friday",
    title: "Pull com costas",
    focus: "Costas e bíceps",
    summary: "Puxada principal com ênfase em dorsais e braços.",
    isRestDay: false,
    exercises: [
      {
        id: "remada-curvada",
        name: "Remada curvada",
        muscleGroup: "Costas",
        bodyArea: "Dorsal",
        sets: 4,
        repRange: "6-10",
      },
      {
        id: "serrote",
        name: "Serrote",
        muscleGroup: "Costas",
        bodyArea: "Dorsal média",
        sets: 3,
        repRange: "8-12",
      },
      {
        id: "puxador-supinado",
        name: "Puxador frente pegada supinada",
        muscleGroup: "Costas",
        bodyArea: "Latíssimo",
        sets: 3,
        repRange: "10-12",
      },
      {
        id: "rosca-martelo",
        name: "Rosca martelo",
        muscleGroup: "Bíceps",
        bodyArea: "Brachialis",
        sets: 3,
        repRange: "10-12",
      },
      {
        id: "rosca-direta",
        name: "Rosca direta",
        muscleGroup: "Bíceps",
        bodyArea: "Cabeça longa",
        sets: 3,
        repRange: "8-10",
      },
    ],
    accessoryWork: [],
    cardio: {
      id: "cardio-friday",
      label: "Cardio pos treino",
      durationMinutes: 15,
      notes: "Final de sessão",
    },
  },
];

export const workoutUpperLowerSeed: WorkoutDayPlan[] = [
  {
    id: "workout-monday-upper",
    weekday: "monday",
    title: "Upper 1",
    focus: "Peito, costas e ombro",
    summary: "Upper com base em compostos e finalização de deltoide.",
    isRestDay: false,
    exercises: [
      {
        id: "supino-reto-barra",
        name: "Supino reto com barra",
        muscleGroup: "Peito",
        bodyArea: "Peitoral médio",
        sets: 4,
        repRange: "5-8",
      },
      {
        id: "remada-fechada",
        name: "Remada fechada",
        muscleGroup: "Costas",
        bodyArea: "Dorsal média",
        sets: 4,
        repRange: "6-10",
      },
      {
        id: "desenvolvimento-maquina",
        name: "Desenvolvimento na máquina",
        muscleGroup: "Ombro",
        bodyArea: "Deltoide anterior",
        sets: 3,
        repRange: "8-12",
      },
      {
        id: "crucifixo-maquina",
        name: "Crucifixo na máquina",
        muscleGroup: "Peito",
        bodyArea: "Peitoral",
        sets: 3,
        repRange: "12-15",
      },
    ],
    accessoryWork: [],
  },
  {
    id: "workout-tuesday-lower",
    weekday: "tuesday",
    title: "Lower 1",
    focus: "Quadríceps e posterior",
    summary: "Lower com base em agachamento e padrão hinge.",
    isRestDay: false,
    exercises: [
      {
        id: "agachamento-frontal",
        name: "Agachamento frontal",
        muscleGroup: "Quadríceps",
        bodyArea: "Quadríceps",
        sets: 4,
        repRange: "5-8",
      },
      {
        id: "stiff",
        name: "Stiff",
        muscleGroup: "Posterior",
        bodyArea: "Posterior de coxa",
        sets: 4,
        repRange: "6-10",
      },
      {
        id: "leg-press",
        name: "Leg press 45",
        muscleGroup: "Quadríceps",
        bodyArea: "Quadríceps",
        sets: 3,
        repRange: "10-12",
      },
      {
        id: "panturrilha-sentado",
        name: "Panturrilha sentado",
        muscleGroup: "Panturrilha",
        bodyArea: "Panturrilha",
        sets: 4,
        repRange: "12-20",
      },
    ],
    accessoryWork: [],
  },
  {
    id: "workout-thursday-upper",
    weekday: "thursday",
    title: "Upper 2",
    focus: "Costas, peito e braços",
    summary: "Upper com puxadas e isoladores para fechar volume semanal.",
    isRestDay: false,
    exercises: [
      {
        id: "puxada-neutra",
        name: "Puxada neutra",
        muscleGroup: "Costas",
        bodyArea: "Latíssimo",
        sets: 4,
        repRange: "8-12",
      },
      {
        id: "supino-inclinado-barra",
        name: "Supino inclinado com barra",
        muscleGroup: "Peito",
        bodyArea: "Peitoral superior",
        sets: 4,
        repRange: "6-10",
      },
      {
        id: "rosca-scott",
        name: "Rosca scott",
        muscleGroup: "Bíceps",
        bodyArea: "Cabeça curta",
        sets: 3,
        repRange: "10-12",
      },
      {
        id: "triceps-testa",
        name: "Tríceps testa",
        muscleGroup: "Tríceps",
        bodyArea: "Cabeça longa",
        sets: 3,
        repRange: "8-12",
      },
    ],
    accessoryWork: [],
  },
  {
    id: "workout-saturday-lower",
    weekday: "saturday",
    title: "Lower 2",
    focus: "Glúteos e posterior",
    summary: "Lower com ênfase em glúteos e unilateral.",
    isRestDay: false,
    exercises: [
      {
        id: "terra-romeno",
        name: "Terra romeno",
        muscleGroup: "Posterior",
        bodyArea: "Posterior de coxa",
        sets: 4,
        repRange: "6-10",
      },
      {
        id: "avanco-passada",
        name: "Avanco na passada",
        muscleGroup: "Glúteos",
        bodyArea: "Glúteos",
        sets: 3,
        repRange: "10-12",
      },
      {
        id: "mesa-flexora",
        name: "Mesa flexora",
        muscleGroup: "Posterior",
        bodyArea: "Posterior de coxa",
        sets: 3,
        repRange: "10-15",
      },
      {
        id: "cadeira-abdutora",
        name: "Cadeira abdutora",
        muscleGroup: "Glúteos",
        bodyArea: "Glúteos médio",
        sets: 3,
        repRange: "12-20",
      },
    ],
    accessoryWork: ["Core anti-rotacao por 3 séries"],
  },
];

function workoutSeedExercise(
  id: string,
  name: string,
  muscleGroup: WorkoutMuscleGroup,
  bodyArea: string,
  sets: number,
  repRange: string,
  notes?: string,
): WorkoutExercise {
  return {
    id,
    name,
    muscleGroup,
    bodyArea,
    sets,
    repRange,
    notes,
  };
}

function workoutSeedDay(
  id: string,
  weekday: WorkoutDayPlan["weekday"],
  title: string,
  focus: string,
  summary: string,
  exercises: WorkoutExercise[],
  accessoryWork: string[] = [],
): WorkoutDayPlan {
  return {
    id,
    weekday,
    title,
    focus,
    summary,
    isRestDay: false,
    exercises,
    accessoryWork,
  };
}

export const importedMuriloWorkoutSeed: WorkoutDayPlan[] = [
  workoutSeedDay(
    "murilo-2014-tuesday",
    "tuesday",
    "Peito e quadríceps",
    "Peito, pernas e core",
      "Sessão mista com peitoral, quadríceps e finalização de core.",
    [
      workoutSeedExercise("murilo-supino-inclinado-halteres", "Supino inclinado com halteres", "Peito", "Peitoral superior", 2, "6-12"),
      workoutSeedExercise("murilo-supino-maquina-unilateral", "Supino máquina unilateral", "Peito", "Peitoral", 2, "6-12"),
      workoutSeedExercise("murilo-crucifixo-inclinado", "Crucifixo inclinado com halteres", "Peito", "Peitoral superior", 2, "12-15"),
      workoutSeedExercise("murilo-agachamento-smith", "Agachamento na smith machine", "Quadríceps", "Quadríceps", 2, "12-15"),
      workoutSeedExercise("murilo-leg-press-unilateral", "Leg press unilateral", "Quadríceps", "Quadríceps", 2, "6-12"),
      workoutSeedExercise("murilo-cadeira-extensora", "Cadeira extensora", "Quadríceps", "Quadríceps", 2, "12-15"),
      workoutSeedExercise("murilo-panturrilha-sentando", "Panturrilha sentando", "Panturrilha", "Panturrilha", 3, "20"),
    ],
    [
      "Prancha até a falha - 3x ou 60 segundos",
      "Abdominal infra na máquina ou na barra fixa - 3x10",
      "Vacum - 3x",
    ],
  ),
  workoutSeedDay(
    "murilo-2014-wednesday",
    "wednesday",
    "Costas e ombros",
    "Costas, ombro e braços",
      "Puxadas e remadas com deltoides e finalização de braços.",
    [
      workoutSeedExercise("murilo-puxador-pronada", "Puxador frente pegada pronada aberta", "Costas", "Latíssimo", 2, "12-15"),
      workoutSeedExercise("murilo-pulldown-corda", "Pull down corda", "Costas", "Dorsal", 2, "12-15"),
      workoutSeedExercise("murilo-remada-baixa", "Remada baixa com triangulo sentado", "Costas", "Dorsal média", 2, "6-12"),
      workoutSeedExercise("murilo-desenvolvimento-halteres", "Desenvolvimento com halteres", "Ombro", "Deltoide anterior", 2, "12-15"),
      workoutSeedExercise("murilo-elevacao-lateral", "Elevação lateral com halteres", "Ombro", "Deltoide lateral", 2, "12-15"),
      workoutSeedExercise("murilo-rosca-martelo", "Rosca martelo", "Bíceps", "Braço", 2, "12-15"),
      workoutSeedExercise("murilo-triceps-corda", "Tríceps corda", "Tríceps", "Cabeça lateral", 2, "12-15"),
    ],
    [
      "Prancha até a falha - 3x ou 60 segundos",
      "Abdominal infra na máquina ou na barra fixa - 3x10",
      "Vacum - 3x",
    ],
  ),
  workoutSeedDay(
    "murilo-2014-friday",
    "friday",
    "Lower e peito",
    "Pernas, peito e core",
    "Sessão de pernas com bloco final de peito e core.",
    [
      workoutSeedExercise("murilo-agachamento-hack", "Agachamento hack", "Quadríceps", "Quadríceps", 2, "12-15"),
      workoutSeedExercise("murilo-leg-press", "Leg press", "Quadríceps", "Quadríceps", 2, "12-15"),
      workoutSeedExercise("murilo-mesa-flexora", "Mesa flexora", "Posterior", "Posterior de coxa", 2, "12-15"),
      workoutSeedExercise("murilo-cadeira-abdutora", "Cadeira abdutora", "Glúteos", "Glúteos médio", 2, "12-15"),
      workoutSeedExercise("murilo-supino-inclinado-barra", "Supino inclinado barra", "Peito", "Peitoral superior", 2, "6-12"),
      workoutSeedExercise("murilo-cross-over", "Cross over altura dos ombros", "Peito", "Peitoral", 2, "12-15"),
    ],
    [
      "Prancha até a falha - 3x ou 60 segundos",
      "Abdominal infra na máquina ou na barra fixa - 3x10",
      "Vacum - 3x",
    ],
  ),
  workoutSeedDay(
    "murilo-2014-saturday",
    "saturday",
    "Upper costas e braços",
    "Costas, ombros e braços",
      "Sessão de costas e ombros com finalização de braços.",
    [
      workoutSeedExercise("murilo-remada-curvada", "Remada curvada", "Costas", "Dorsal", 2, "12-15"),
      workoutSeedExercise("murilo-remada-unilateral", "Remada unilateral", "Costas", "Dorsal média", 2, "12-15"),
      workoutSeedExercise("murilo-puxador-supinado", "Puxador frente pegada supinada", "Costas", "Latíssimo", 2, "12-15"),
      workoutSeedExercise("murilo-desenvolvimento-maquina", "Desenvolvimento máquina ou smith", "Ombro", "Deltoide anterior", 2, "12-15"),
      workoutSeedExercise("murilo-elevacao-frontal", "Elevação frontal", "Ombro", "Deltoide anterior", 2, "12-15"),
      workoutSeedExercise("murilo-panturrilha-sentado-2", "Panturrilha sentado", "Panturrilha", "Panturrilha", 3, "20"),
      workoutSeedExercise("murilo-rosca-direta", "Rosca direta", "Bíceps", "Braço", 2, "12-15"),
      workoutSeedExercise("murilo-triceps-barra", "Tríceps barra", "Tríceps", "Cabeça longa", 2, "12-15"),
    ],
    [
      "Prancha até a falha - 3x ou 60 segundos",
      "Abdominal infra na máquina ou na barra fixa - 3x10",
      "Vacum - 3x",
    ],
  ),
];

export const importedPachoAbcdWorkoutSeed: WorkoutDayPlan[] = [
  workoutSeedDay(
    "pacho-abcd-monday",
    "monday",
    "Peito e triceps",
    "Peito e triceps",
    "Sessão de empurrar com progressão de carga e técnicas de intensidade.",
    [
      workoutSeedExercise("pacho-abcd-supino-inclinado", "Supino inclinado", "Peito", "Peitoral superior", 3, "6-10", "Progressão de carga até falhar entre 6 e 10 nas válidas."),
      workoutSeedExercise("pacho-abcd-supino-smith", "Supino reto no smith", "Peito", "Peitoral médio", 3, "8-12", "Dois rest pause nas séries válidas."),
      workoutSeedExercise("pacho-abcd-cross-polia", "Cross over na polia alta", "Peito", "Peitoral", 3, "8-12"),
      workoutSeedExercise("pacho-abcd-voador-cabo", "Voador ou crucifixo no cabo", "Peito", "Peitoral", 3, "8-12", "Executar com drop na serie final."),
      workoutSeedExercise("pacho-abcd-triceps-corda", "Tríceps corda", "Tríceps", "Cabeça lateral", 3, "6-10"),
      workoutSeedExercise("pacho-abcd-francês-cabo", "Testa ou francês no cabo", "Tríceps", "Cabeça longa", 3, "8-12", "Dois rest pause com descanso entre 1:30 e 2:30."),
    ],
    [
      "Rest pause nas séries de trabalho",
      "Drop nas séries de trabalho",
      "Prancha até a falha - 3x ou 60 segundos",
      "Abdominal infra na máquina ou na barra fixa - 3x10",
      "Vacum - 3x",
    ],
  ),
  workoutSeedDay(
    "pacho-abcd-tuesday",
    "tuesday",
    "Costas",
    "Costas e core",
    "Puxadas e remadas com progressão de carga e trabalho de lombar.",
    [
      workoutSeedExercise("pacho-abcd-remada-curvada", "Remada curvada", "Costas", "Dorsal", 3, "6-10", "Progressão de carga até falhar entre 6 e 10 nas válidas."),
      workoutSeedExercise("pacho-abcd-remada-aberta", "Remada pegada aberta", "Costas", "Dorsal média", 3, "8-12", "Dois rest pause nas séries válidas."),
      workoutSeedExercise("pacho-abcd-serrote", "Serrote", "Costas", "Dorsal", 3, "8-12"),
      workoutSeedExercise("pacho-abcd-puxada-frente", "Puxada frente aberta ou supinada", "Costas", "Latíssimo", 3, "8-12", "Serie final com drop."),
      workoutSeedExercise("pacho-abcd-lombar", "Lombar no banco", "Core", "Lombar", 3, "10-15"),
    ],
    [
      "Rest pause nas séries de trabalho",
      "Drop nas séries de trabalho",
      "Prancha até a falha - 3x ou 60 segundos",
      "Abdominal infra na máquina ou na barra fixa - 3x10",
      "Vacum - 3x",
    ],
  ),
  workoutSeedDay(
    "pacho-abcd-thursday",
    "thursday",
    "Lower alternado",
    "Quadríceps ou posterior por semana",
    "Treino de pernas que alterna foco entre quadríceps na semana 1 e posterior na semana 2.",
    [
      workoutSeedExercise("pacho-abcd-agachamento-livre", "Agachamento livre ou no smith", "Quadríceps", "Quadríceps", 3, "6-10", "Semana 1 - foco em quadríceps."),
      workoutSeedExercise("pacho-abcd-legpress-quad", "Leg press 45", "Quadríceps", "Quadríceps", 3, "8-12", "Semana 1 - adicionar 10 parciais."),
      workoutSeedExercise("pacho-abcd-extensora-quad", "Cadeira extensora", "Quadríceps", "Quadríceps", 3, "8-12", "Semana 1 - serie final com drop."),
      workoutSeedExercise("pacho-abcd-flexor-seated", "Flexor sentado ou deitado", "Posterior", "Posterior de coxa", 3, "6-10", "Semana 1."),
      workoutSeedExercise("pacho-abcd-elevacao-quadril", "Elevação de quadril", "Glúteos", "Glúteos", 3, "8-12", "Semana 1."),
      workoutSeedExercise("pacho-abcd-flexor-deitado", "Flexor deitado", "Posterior", "Posterior de coxa", 3, "6-10", "Semana 2 - foco em posterior."),
      workoutSeedExercise("pacho-abcd-flexor-sentado", "Flexor sentado", "Posterior", "Posterior de coxa", 3, "8-12", "Semana 2 - com parciais e isometria."),
      workoutSeedExercise("pacho-abcd-stiff", "Stiff", "Posterior", "Posterior de coxa", 3, "8-12", "Semana 2 - serie final com drop."),
      workoutSeedExercise("pacho-abcd-legpress-post", "Leg press 45", "Quadríceps", "Quadríceps", 3, "6-10", "Semana 2."),
      workoutSeedExercise("pacho-abcd-extensora-post", "Extensora", "Quadríceps", "Quadríceps", 3, "8-12", "Semana 2 - com rest pause."),
    ],
  ),
  workoutSeedDay(
    "pacho-abcd-friday",
    "friday",
    "Ombros e bíceps",
    "Ombros e bíceps",
    "Sessão de deltoides e bíceps com técnicas de intensidade nas séries válidas.",
    [
      workoutSeedExercise("pacho-abcd-desenvolvimento", "Desenvolvimento", "Ombro", "Deltoide anterior", 3, "6-10"),
      workoutSeedExercise("pacho-abcd-elevacao-frontal", "Elevação frontal", "Ombro", "Deltoide anterior", 3, "8-12"),
      workoutSeedExercise("pacho-abcd-elevacao-lateral", "Elevação lateral", "Ombro", "Deltoide lateral", 3, "8-12", "Dois rest pause nas séries válidas."),
      workoutSeedExercise("pacho-abcd-elevacao-cabo", "Elevação lateral unilateral no cabo", "Ombro", "Deltoide lateral", 3, "8-12", "Pico de concentração no topo."),
      workoutSeedExercise("pacho-abcd-rosca-direta", "Rosca direta", "Bíceps", "Braço", 3, "8-12"),
      workoutSeedExercise("pacho-abcd-rosca-scott", "Rosca scott", "Bíceps", "Braço", 3, "8-12", "Dois rest pause nas séries válidas."),
    ],
    [
      "Rest pause nas séries de trabalho",
      "Drop nas séries de trabalho",
      "Prancha até a falha - 3x ou 60 segundos",
      "Abdominal infra na máquina ou na barra fixa - 3x10",
      "Vacum - 3x",
    ],
  ),
];

export const importedPachoAbcWorkoutSeed: WorkoutDayPlan[] = [
  workoutSeedDay(
    "pacho-abc-monday",
    "monday",
    "Treino A",
    "Peito, ombro e triceps",
    "Bloco A com peitoral, ombros e triceps.",
    [
      workoutSeedExercise("pacho-abc-supino-inclinado", "Supino inclinado no banco com halteres", "Peito", "Peitoral superior", 2, "12-15 / 8-12 / 6-10"),
      workoutSeedExercise("pacho-abc-supino-reto-maquina", "Supino reto na máquina", "Peito", "Peitoral médio", 2, "12-15 / 8-12 / 6-10"),
      workoutSeedExercise("pacho-abc-cross-over", "Cross over na polia alta ou crucifixo com halteres deitado", "Peito", "Peitoral", 2, "12-15 / 8-12 / 6-10"),
      workoutSeedExercise("pacho-abc-desenvolvimento", "Desenvolvimento de ombros", "Ombro", "Deltoide anterior", 2, "12-15 / 8-12 / 6-10"),
      workoutSeedExercise("pacho-abc-elevacao-lateral", "Elevação lateral", "Ombro", "Deltoide lateral", 2, "12-15 / 8-12 / 6-10"),
      workoutSeedExercise("pacho-abc-elevacao-frontal", "Elevação frontal", "Ombro", "Deltoide anterior", 2, "12-15 / 8-12 / 6-10"),
      workoutSeedExercise("pacho-abc-triceps-barra-w", "Tríceps no cabo barra W", "Tríceps", "Cabeça lateral", 2, "12-15 / 8-12 / 6-10"),
    ],
  ),
  workoutSeedDay(
    "pacho-abc-wednesday",
    "wednesday",
    "Treino C",
    "Pernas",
    "Bloco C dedicado a pernas e panturrilha.",
    [
      workoutSeedExercise("pacho-abc-agachamento", "Agachamento livre ou no smith", "Quadríceps", "Quadríceps", 2, "12-15 / 8-12 / 6-10"),
      workoutSeedExercise("pacho-abc-hack", "Hack machine", "Quadríceps", "Quadríceps", 2, "12-15 / 8-12 / 6-10"),
      workoutSeedExercise("pacho-abc-extensora", "Cadeira extensora", "Quadríceps", "Quadríceps", 2, "12-15 / 8-12 / 6-10"),
      workoutSeedExercise("pacho-abc-flexor", "Flexor deitado", "Posterior", "Posterior de coxa", 2, "12-15 / 8-12 / 6-10"),
      workoutSeedExercise("pacho-abc-abdutora", "Cadeira abdutora", "Glúteos", "Glúteos médio", 2, "12-15 / 8-12 / 6-10"),
      workoutSeedExercise("pacho-abc-adutora", "Cadeira adutora", "Glúteos", "Adutores", 2, "12-15 / 8-12 / 6-10"),
      workoutSeedExercise("pacho-abc-panturrilha", "Panturrilha", "Panturrilha", "Panturrilha", 3, "15-20"),
    ],
  ),
  workoutSeedDay(
    "pacho-abc-friday",
    "friday",
    "Treino B",
    "Costas e bíceps",
      "Bloco B com remadas, puxadas e finalização de bíceps.",
    [
      workoutSeedExercise("pacho-abc-remada-curvada", "Remada curvada", "Costas", "Dorsal", 2, "12-15 / 8-12 / 6-10"),
      workoutSeedExercise("pacho-abc-serrote", "Serrote", "Costas", "Dorsal média", 2, "12-15 / 8-12 / 6-10"),
      workoutSeedExercise("pacho-abc-puxador-supinado", "Puxador frente pegada supinada", "Costas", "Latíssimo", 2, "12-15 / 8-12 / 6-10"),
      workoutSeedExercise("pacho-abc-remada-baixa", "Remada baixa com triangulo sentado", "Costas", "Dorsal média", 2, "12-15 / 8-12 / 6-10"),
      workoutSeedExercise("pacho-abc-rosca-martelo", "Rosca martelo", "Bíceps", "Braço", 2, "12-15 / 8-12 / 6-10"),
      workoutSeedExercise("pacho-abc-rosca-direta", "Rosca direta", "Bíceps", "Braço", 2, "12-15 / 8-12 / 6-10"),
    ],
  ),
];

export const importedJogoMontenegro2019Seed: WorkoutDayPlan[] = [
  workoutSeedDay(
    "jogo-2019-monday",
    "monday",
    "Serie A",
    "Peito e triceps",
    "Peito e triceps com volume alto e finalização tecnica.",
    [
      workoutSeedExercise("jogo-2019-supino-canadense", "Supino canadense", "Peito", "Peitoral", 4, "12"),
      workoutSeedExercise("jogo-2019-supino-reto", "Supino reto", "Peito", "Peitoral médio", 4, "12"),
      workoutSeedExercise("jogo-2019-supino-45", "Supino 45", "Peito", "Peitoral superior", 4, "12"),
      workoutSeedExercise("jogo-2019-voador", "Voador", "Peito", "Peitoral", 5, "7", "Hyperslow com alongamento máximo."),
      workoutSeedExercise("jogo-2019-triceps-triangulo", "Tríceps no cross com triângulo", "Tríceps", "Cabeça lateral", 7, "12"),
    ],
    ["15 minutos de exercícios para o core abdominal."],
  ),
  workoutSeedDay(
    "jogo-2019-tuesday",
    "tuesday",
    "Serie B",
    "Costas e bíceps",
    "Costas e bíceps com puxadas abertas, fechadas e remadas.",
    [
      workoutSeedExercise("jogo-2019-puxada-aberta", "Puxada aberta", "Costas", "Latíssimo", 4, "12"),
      workoutSeedExercise("jogo-2019-puxada-fechada", "Puxada fechada supinada", "Costas", "Latíssimo", 3, "12"),
      workoutSeedExercise("jogo-2019-remada-aberta", "Remada aberta", "Costas", "Dorsal média", 4, "12"),
      workoutSeedExercise("jogo-2019-remada-unilateral-hbc", "Remada unilateral HBC", "Costas", "Dorsal", 3, "12"),
      workoutSeedExercise("jogo-2019-pulldown", "Pull down", "Costas", "Latíssimo", 5, "7", "Hyperslow com alongamento máximo."),
      workoutSeedExercise("jogo-2019-bíceps-scott", "Bíceps Scott máquina", "Bíceps", "Braço", 7, "12"),
    ],
  ),
  workoutSeedDay(
    "jogo-2019-wednesday",
    "wednesday",
    "Serie C",
    "Pernas e panturrilha",
    "Bloco completo de pernas com grande volume de panturrilha.",
    [
      workoutSeedExercise("jogo-2019-panturrilha-pe-pesado", "Panturrilha em pe pesado", "Panturrilha", "Panturrilha", 6, "8"),
      workoutSeedExercise("jogo-2019-panturrilha-pe-leve", "Panturrilha em pe leve", "Panturrilha", "Panturrilha", 6, "30"),
      workoutSeedExercise("jogo-2019-panturrilha-leg45", "Panturrilha leg 45", "Panturrilha", "Panturrilha", 5, "25 / 25 / 30 / 30 / 40"),
      workoutSeedExercise("jogo-2019-panturrilha-cadeira", "Panturrilha cadeira", "Panturrilha", "Panturrilha", 7, "12"),
      workoutSeedExercise("jogo-2019-leg45", "Leg 45", "Quadríceps", "Quadríceps", 5, "20"),
      workoutSeedExercise("jogo-2019-agachamento-smith", "Agachamento smith", "Quadríceps", "Quadríceps", 3, "15"),
      workoutSeedExercise("jogo-2019-extensora", "Cadeira extensora", "Quadríceps", "Quadríceps", 7, "12"),
      workoutSeedExercise("jogo-2019-mesa-flexora", "Mesa flexora", "Posterior", "Posterior de coxa", 7, "12"),
    ],
    ["15 minutos de alongamento full body."],
  ),
  workoutSeedDay(
    "jogo-2019-thursday",
    "thursday",
    "Serie D",
    "Tríceps e bíceps",
    "Braços com bastante volume e técnicas de fadiga.",
    [
      workoutSeedExercise("jogo-2019-triangulo-cross", "Triângulo no cross", "Tríceps", "Cabeça lateral", 4, "12"),
      workoutSeedExercise("jogo-2019-testa-barra-w", "Testa barra W", "Tríceps", "Cabeça longa", 4, "12"),
      workoutSeedExercise("jogo-2019-invertida", "Invertida", "Tríceps", "Cabeça medial", 3, "12"),
      workoutSeedExercise("jogo-2019-paralela", "Paralela", "Tríceps", "Tríceps", 7, "12"),
      workoutSeedExercise("jogo-2019-bíceps-barra-w", "Bíceps barra W", "Bíceps", "Braço", 4, "12"),
      workoutSeedExercise("jogo-2019-martelo-unilateral", "Martelo unilateral", "Bíceps", "Braço", 4, "12"),
      workoutSeedExercise("jogo-2019-bíceps-scott-livre", "Bíceps no scott", "Bíceps", "Braço", 7, "12"),
    ],
    ["15 minutos de exercícios para o core abdominal."],
  ),
  workoutSeedDay(
    "jogo-2019-friday",
    "friday",
    "Serie E",
    "Ombros",
    "Sessão isolada para ombros com foco em volume e drop set.",
    [
      workoutSeedExercise("jogo-2019-desenvolvimento-aberto", "Desenvolvimento aberto HBC", "Ombro", "Deltoide anterior", 4, "12"),
      workoutSeedExercise("jogo-2019-abducao-ombros", "Abducao de ombros", "Ombro", "Deltoide lateral", 3, "12", "Adicionar 1 drop."),
      workoutSeedExercise("jogo-2019-flexao-ombros", "Flexao de ombros", "Ombro", "Deltoide anterior", 3, "12", "Adicionar 1 drop."),
      workoutSeedExercise("jogo-2019-crucifixo-invertido", "Crucifixo invertido", "Ombro", "Deltoide posterior", 4, "12"),
      workoutSeedExercise("jogo-2019-pecdec-invertido", "Pec dec invertido", "Ombro", "Deltoide posterior", 7, "12"),
      workoutSeedExercise("jogo-2019-remada-alta", "Remada alta máquina", "Ombro", "Deltoide lateral", 4, "12"),
    ],
  ),
  workoutSeedDay(
    "jogo-2019-saturday",
    "saturday",
    "Serie F",
    "Panturrilha e abs",
    "Panturrilha com volume alto e trabalho de abdomen.",
    [
      workoutSeedExercise("jogo-2019-panturrilha-legpress", "Panturrilha leg press", "Panturrilha", "Panturrilha", 7, "30"),
      workoutSeedExercise("jogo-2019-panturrilha-em-pe", "Panturrilha em pe", "Panturrilha", "Panturrilha", 7, "30"),
      workoutSeedExercise("jogo-2019-abdominal-corda", "Abdominal com corda no cross", "Core", "Abdomen", 4, "20"),
      workoutSeedExercise("jogo-2019-abdominal-declinado", "Abdominal no banco declinado", "Core", "Abdomen", 4, "30"),
    ],
    ["15 minutos de alongamento full body."],
  ),
];

export const foodDatabaseSeed: FoodDatabaseItem[] = [
  {
    id: "food-whey",
    name: "Whey",
    servingLabel: "55 g",
    macros: macros(38.5, 10.8, 3.5, 0, 89, 229.2),
    source: "database",
    kind: "food",
  },
  {
    id: "food-creatina",
    name: "Creatina",
    servingLabel: "10 g",
    macros: macros(0, 0, 0, 0, 0, 0),
    source: "database",
    kind: "supplement",
  },
  {
    id: "food-psyllium",
    name: "Psyllium",
    servingLabel: "5 g",
    macros: macros(0, 0.55, 0.1, 4.05, 0, 9),
    source: "database",
    kind: "supplement",
  },
  {
    id: "food-chicken-breast-raw",
    name: "Frango peito cru sem pele",
    servingLabel: "100 g",
    macros: macros(21.8, 0, 1.9, 0, 45, 109),
    source: "database",
    kind: "food",
  },
  {
    id: "food-chicken-breast-grilled",
    name: "Frango peito grelhado sem pele",
    servingLabel: "100 g",
    macros: macros(31, 0, 3.6, 0, 74, 165),
    source: "database",
    kind: "food",
  },
  {
    id: "food-chicken-thigh-roasted",
    name: "Frango sobrecoxa assada com pele",
    servingLabel: "100 g",
    macros: macros(24.8, 0, 15.2, 0, 95, 239),
    source: "database",
    kind: "food",
  },
  {
    id: "food-tilapia-grilled",
    name: "Tilapia grelhada",
    servingLabel: "100 g",
    macros: macros(26.2, 0, 2.7, 0, 52, 128),
    source: "database",
    kind: "food",
  },
  {
    id: "food-patinho-cooked",
    name: "Patinho cozido",
    servingLabel: "100 g",
    macros: macros(26, 0, 8.9, 0, 70, 185),
    source: "database",
    kind: "food",
  },
  {
    id: "food-rice-cooked",
    name: "Arroz branco cozido",
    servingLabel: "100 g",
    macros: macros(2.5, 28.1, 0.3, 0.4, 1, 128),
    source: "database",
    kind: "food",
  },
  {
    id: "food-sweet-potato-roasted",
    name: "Batata doce assada",
    servingLabel: "100 g",
    macros: macros(1.6, 20.7, 0.1, 3, 41, 90),
    source: "database",
    kind: "food",
  },
  {
    id: "food-oats",
    name: "Aveia em flocos",
    servingLabel: "40 g",
    macros: macros(5.4, 26.6, 2.8, 4.1, 2, 156),
    source: "database",
    kind: "food",
  },
  {
    id: "food-protein-base",
    name: "Proteína base (acem ou atum)",
    servingLabel: "200 g acem / 170 g atum",
    macros: macros(39.6, 0, 11, 0, 99, 256),
    source: "database",
    kind: "food",
  },
  {
    id: "food-carb-base",
    name: "Carbo base",
    servingLabel: "160 g high / 80 g low",
    macros: macros(6.6, 62, 0.6, 0, 535, 287),
    source: "database",
    kind: "food",
  },
  {
    id: "food-ketchup",
    name: "Ketchup",
    servingLabel: "100 g",
    macros: macros(0, 25, 0, 0, 665, 99),
    source: "database",
    kind: "food",
  },
  {
    id: "food-alface",
    name: "Alface",
    servingLabel: "35 g",
    macros: macros(0.14, 0.52, 0.04, 0.43, 2.08, 2),
    source: "database",
    kind: "food",
  },
  {
    id: "food-tomate",
    name: "Tomate",
    servingLabel: "50 g",
    macros: macros(0.52, 1.91, 0.09, 0.8, 1.56, 9),
    source: "database",
    kind: "food",
  },
  {
    id: "food-dextrose",
    name: "Dextrose",
    servingLabel: "20 g",
    macros: macros(0, 20, 0, 0, 0, 80),
    source: "database",
    kind: "food",
  },
  {
    id: "food-hidraplex",
    name: "Hidraplex",
    servingLabel: "7 g",
    macros: macros(0, 6, 0, 0, 60, 24),
    source: "database",
    kind: "supplement",
  },
  {
    id: "food-glicerina",
    name: "Glicerina",
    servingLabel: "10 ml",
    macros: macros(0, 0, 0, 0, 0, 0),
    source: "database",
    kind: "supplement",
  },
  {
    id: "supp-ioimbina",
    name: "Ioimbina",
    servingLabel: "1 caps",
    macros: macros(0, 0, 0, 0, 0, 0),
    source: "database",
    kind: "supplement",
  },
  {
    id: "supp-cromo",
    name: "Picolinato de cromo",
    servingLabel: "1 caps",
    macros: macros(0, 0, 0, 0, 0, 0),
    source: "database",
    kind: "supplement",
  },
  {
    id: "supp-citrus",
    name: "Citrus aurantium",
    servingLabel: "1 caps",
    macros: macros(0, 0, 0, 0, 0, 0),
    source: "database",
    kind: "supplement",
  },
  {
    id: "supp-multivitaminico",
    name: "Multivitaminico",
    servingLabel: "1 caps",
    macros: macros(0, 0, 0, 0, 0, 0),
    source: "database",
    kind: "supplement",
  },
  {
    id: "supp-omega3",
    name: "Omega 3",
    servingLabel: "1 caps",
    macros: macros(0, 0, 1, 0, 0, 9),
    source: "database",
    kind: "supplement",
  },
  {
    id: "food-pao-forma",
    name: "Pão de forma",
    servingLabel: "100 g (≈ 4 fatias)",
    macros: macros(9, 48, 3, 2, 460, 250),
    source: "database",
    kind: "food",
    favorite: true,
  },
  {
    id: "food-azeite",
    name: "Azeite extra-virgem",
    servingLabel: "14 g (1 colher sopa)",
    macros: macros(0, 0, 14, 0, 0, 120),
    source: "database",
    kind: "food",
    favorite: true,
  },
  {
    id: "food-banana",
    name: "Banana média",
    servingLabel: "1 unidade (≈ 100 g)",
    macros: macros(1.1, 26.9, 0.3, 2.6, 1, 105),
    source: "database",
    kind: "food",
    favorite: true,
  },
  {
    id: "food-panqueca-mix",
    name: "Panqueca (mix caseiro)",
    servingLabel: "50 g (1 unidade)",
    macros: macros(6.6, 27.5, 3.8, 3.9, 0, 155),
    source: "custom",
    kind: "food",
    favorite: true,
  },
];

export const mealPlanSeed: MealPlanBlock[] = [
  {
    id: "meal-fasting",
    title: "Jejum",
    time: "08:00",
    category: "fasting",
    items: [
      { id: "fast-ioimbina", foodId: "supp-ioimbina", label: "Ioimbina", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "fast-cromo", foodId: "supp-cromo", label: "Picolinato de cromo", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "fast-citrus", foodId: "supp-citrus", label: "Citrus aurantium", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "fast-probiotico", label: "Complexo probiotico", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "fast-same", label: "SAMe 200mg", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "fast-rhodiola", label: "Rhodiola rosea 300mg", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "fast-carnitina", label: "L-Carnitina", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "fast-nac", label: "NAC 600", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "fast-berberina", label: "Berberina 500mg", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
    ],
    notes: "Termogênicos no jejum. Chá verde ou hibisco sem açúcar liberados. Cardio leve opcional.",
  },
  {
    id: "meal-lunch",
    title: "Almoço (quebra do jejum 16:8)",
    time: "12:00",
    category: "lunch",
    items: [
      { id: "lunch-protein", foodId: "food-protein-base", label: "Proteína", quantityLabel: "200 g acém / 170 g atum", macros: macros(39.6, 0, 11, 0, 99, 256), kind: "food", notes: "Escolha uma das fontes." },
      { id: "lunch-pao", foodId: "food-pao-forma", label: "Pão de forma", quantityLabel: "100 g (≈ 4 fatias)", macros: macros(9, 48, 3, 2, 460, 250), kind: "food" },
      { id: "lunch-ketchup", foodId: "food-ketchup", label: "Ketchup", quantityLabel: "50 g", macros: macros(0, 12.5, 0, 0, 332, 50), kind: "food" },
      { id: "lunch-azeite", foodId: "food-azeite", label: "Azeite extra-virgem", quantityLabel: "14 g (1 colher sopa)", macros: macros(0, 0, 14, 0, 0, 120), kind: "food" },
      { id: "lunch-alface", foodId: "food-alface", label: "Alface", quantityLabel: "35 g", macros: macros(0.14, 0.52, 0.04, 0.43, 2.08, 2), kind: "food" },
      { id: "lunch-tomate", foodId: "food-tomate", label: "Tomate", quantityLabel: "50 g", macros: macros(0.52, 1.91, 0.09, 0.8, 1.56, 9), kind: "food" },
      { id: "lunch-multi", foodId: "supp-multivitaminico", label: "Multivitaminico", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "lunch-creatina", foodId: "food-creatina", label: "Creatina", quantityLabel: "10 g", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "lunch-psyllium", foodId: "food-psyllium", label: "Psyllium", quantityLabel: "5 g", macros: macros(0, 0.55, 0.1, 4.05, 0, 9), kind: "supplement" },
      { id: "lunch-beta", label: "Beta-alanina", quantityLabel: "3 g", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "lunch-ala", label: "Acido alfa lipoico 300mg", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "lunch-vitc", label: "Vitamina C 1g", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "lunch-ltyr", label: "L-Tirosina 500mg", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
    ],
    notes: "Suplementos do antigo café da manhã foram realocados aqui.",
  },
  {
    id: "meal-pretreino",
    title: "Pré-treino",
    time: "16:00",
    category: "breakfast",
    items: [
      { id: "pretreino-whey", foodId: "food-whey", label: "Whey", quantityLabel: "40 g", macros: macros(28, 7.85, 2.5, 0, 65, 167), kind: "food" },
      { id: "pretreino-banana", foodId: "food-banana", label: "Banana média", quantityLabel: "1 unidade (≈ 100 g)", macros: macros(1.1, 26.9, 0.3, 2.6, 1, 105), kind: "food" },
    ],
    notes: "Carbo de IG moderado + proteína 2h antes do treino.",
  },
  {
    id: "meal-intra",
    title: "Intra treino",
    time: "18:15",
    category: "intra",
    items: [
      { id: "intra-dextrose", foodId: "food-dextrose", label: "Dextrose", quantityLabel: "20 g", macros: macros(0, 20, 0, 0, 0, 80), kind: "food" },
      { id: "intra-hidraplex", foodId: "food-hidraplex", label: "Hidraplex", quantityLabel: "7 g", macros: macros(0, 6, 0, 0, 60, 24), kind: "supplement" },
      { id: "intra-glicerina", foodId: "food-glicerina", label: "Glicerina", quantityLabel: "10 ml", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
    ],
    notes: "Diluir em 500 ml de água. Sip ao longo do treino de 40-50 min.",
  },
  {
    id: "meal-dinner",
    title: "Jantar (pós-treino)",
    time: "19:30",
    category: "dinner",
    items: [
      { id: "dinner-protein", foodId: "food-protein-base", label: "Proteína", quantityLabel: "200 g acém / 170 g atum", macros: macros(39.6, 0, 11, 0, 99, 256), kind: "food", notes: "Escolha uma das fontes." },
      { id: "dinner-pao", foodId: "food-pao-forma", label: "Pão de forma", quantityLabel: "100 g (≈ 4 fatias)", macros: macros(9, 48, 3, 2, 460, 250), kind: "food" },
      { id: "dinner-ketchup", foodId: "food-ketchup", label: "Ketchup", quantityLabel: "50 g", macros: macros(0, 12.5, 0, 0, 332, 50), kind: "food" },
      { id: "dinner-azeite", foodId: "food-azeite", label: "Azeite extra-virgem", quantityLabel: "14 g (1 colher sopa)", macros: macros(0, 0, 14, 0, 0, 120), kind: "food" },
      { id: "dinner-alface", foodId: "food-alface", label: "Alface", quantityLabel: "35 g", macros: macros(0.14, 0.52, 0.04, 0.43, 2.08, 2), kind: "food" },
      { id: "dinner-tomate", foodId: "food-tomate", label: "Tomate", quantityLabel: "50 g", macros: macros(0.52, 1.91, 0.09, 0.8, 1.56, 9), kind: "food" },
      { id: "dinner-vitd", label: "Vitamina D ultra", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "dinner-sleep", label: "Ashwagandha + Melissa + Passiflora + Kawa Kawa", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "dinner-omega", foodId: "supp-omega3", label: "Omega 3", quantityLabel: "1 caps", macros: macros(0, 0, 1, 0, 0, 9), kind: "supplement" },
      { id: "dinner-curcuma", label: "Curcuma 450mg", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "dinner-vite", label: "Vitamina E", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "dinner-5htp", label: "5 HTP", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "dinner-lteanina", label: "L-Teanina 200mg", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "dinner-mucuna", label: "Mucuna 400mg", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "dinner-gaba", label: "Gaba 400mg", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "dinner-glicina", label: "Glicina 3g", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "dinner-valeriana", label: "Valeriana 100mg", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "dinner-esomeprazol", label: "Esomeprazol 20mg", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "dinner-tadalafila", label: "Tadalafila 5mg", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "dinner-betaine", label: "Betaina + Pepsina", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "dinner-bacopa", label: "Bacopa Monnieri 250mg", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "dinner-enzimas", label: "Complexo de enzima digestiva", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
      { id: "dinner-ginkgo", label: "Ginkgo Biloba 120mg", quantityLabel: "1 caps", macros: macros(0, 0, 0, 0, 0, 0), kind: "supplement" },
    ],
  },
  {
    id: "meal-presono",
    title: "Pré-sono",
    time: "19:50",
    category: "dinner",
    items: [
      { id: "presono-whey", foodId: "food-whey", label: "Whey", quantityLabel: "40 g", macros: macros(28, 7.85, 2.5, 0, 65, 167), kind: "food" },
      { id: "presono-panqueca", foodId: "food-panqueca-mix", label: "Panqueca (mix caseiro)", quantityLabel: "50 g (1 unidade)", macros: macros(6.6, 27.5, 3.8, 3.9, 0, 155), kind: "food" },
    ],
    notes: "Fechamento da janela alimentar às 20:00.",
  },
];

export const dailyNutritionTargetsSeed: DailyNutritionTargets = {
  waterMl: 4425,
  bodyWeightKg: 88.5,
  bodyHeightCm: 165,
  ageYears: 26,
  biologicalSex: "male",
  basalMetabolicRate: 1791,
  basalMetabolicRateSource: "estimated",
  goalAdjustmentKcal: -400,
  weightGoal: {
    targetWeightKg: 82,
    weeklyChangeKg: -0.5,
  },
  fiberStrategy: "per-calories",
  fiberPer1000Kcal: 10,
  fiberPerKg: 0.3,
  fiberRatioGrams: 10,
  fiberRatioCalories: 1000,
  sodiumTargetMg: 3000,
  totals: macros(159.3, 309.8, 53.1, 20.6, 3000, 2063),
  perKg: {
    waterMl: 50,
    protein: 1.8,
    carbs: 3.5,
    fat: 0.6,
  },
};

export const nutritionWeightEntriesSeed: NutritionWeightEntry[] = [
  { id: "weight-2026-03-11", date: "2026-03-11", weightKg: 84.8 },
  { id: "weight-2026-03-12", date: "2026-03-12", weightKg: 84.5 },
  { id: "weight-2026-03-13", date: "2026-03-13", weightKg: 84.3 },
  { id: "weight-2026-03-14", date: "2026-03-14", weightKg: 84.2 },
  { id: "weight-2026-03-15", date: "2026-03-15", weightKg: 84.1 },
  { id: "weight-2026-03-16", date: "2026-03-16", weightKg: 84.0 },
  { id: "weight-2026-03-17", date: "2026-03-17", weightKg: 83.9 },
];

export const nutritionWaterEntriesSeed: NutritionWaterEntry[] = [
  { date: "2026-03-17", consumedMl: 2600 },
];

export const dietDayTypesSeed: Record<
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday",
  NutritionDayType
> = {
  monday: "high-carb",
  tuesday: "low-carb",
  wednesday: "high-carb",
  thursday: "low-carb",
  friday: "high-carb",
  saturday: "recovery",
  sunday: "default",
};

export const dietWorkoutLinkSeed: DietWorkoutLinkSettings = {
  enabled: true,
  trainingDayType: "high-carb",
  cardioOnlyDayType: "low-carb",
  restDayType: "default",
};

export const dietWeekScheduleSeed: Record<
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday",
  string
> = {
  monday: "diet-base-marco",
  tuesday: "diet-base-marco",
  wednesday: "diet-base-marco",
  thursday: "diet-base-marco",
  friday: "diet-base-marco",
  saturday: "diet-base-marco",
  sunday: "diet-base-marco",
};

export const foodSubstitutionSeed: FoodSubstitutionGroup[] = [
  {
    id: "swap-protein-main",
    title: "Proteína principal",
    primaryFoodId: "food-protein-base",
    mealCategory: "lunch",
    alternativeFoodIds: [
      "food-chicken-breast-grilled",
      "food-tilapia-grilled",
      "food-patinho-cooked",
    ],
    notes: "Troque a fonte principal mantendo foco em proteína alta e gordura controlada.",
  },
  {
    id: "swap-carb-main",
    title: "Carbo principal",
    primaryFoodId: "food-carb-base",
    mealCategory: "lunch",
    alternativeFoodIds: ["food-rice-cooked", "food-sweet-potato-roasted", "food-oats"],
    notes: "Use a versao que melhor encaixa no dia high ou low.",
  },
];

export const dietPlanSeed: SavedDietPlan[] = [
  {
    id: "diet-base-marco",
    name: "Dieta Base Marco",
    startDate: "2026-03-01",
    endDate: "2026-04-30",
    notes: "Estrutura atual com variação high e low nos dias da semana.",
    createdAt: "2026-03-16T12:00:00.000Z",
    mealPlan: mealPlanSeed,
    nutritionGoal: "maintain",
    nutritionTargets: dailyNutritionTargetsSeed,
    dayTypes: dietDayTypesSeed,
    workoutLinkSettings: dietWorkoutLinkSeed,
    foodSubstitutions: foodSubstitutionSeed,
  },
];

export const workoutProgramSeed: SavedWorkoutProgram[] = [
  {
    id: "workout-hypertrophy-3x",
    name: "Hipertrofia base",
    splitLabel: "3x / semana",
    startDate: "2026-03-01",
    endDate: "2026-04-30",
    notes: "Base enxuta para manter progressão e comparar cargas.",
    createdAt: "2026-03-16T12:00:00.000Z",
    workoutPlan: workoutPlanSeed,
  },
  {
    id: "workout-upper-lower-4x",
    name: "Upper lower base",
    splitLabel: "4x / semana",
    startDate: "2026-05-01",
    endDate: "2026-06-30",
    notes: "Opção de quatro sessões para semanas de maior disponibilidade.",
    createdAt: "2026-03-15T12:00:00.000Z",
    workoutPlan: workoutUpperLowerSeed,
  },
  {
    id: "workout-import-murilo-2024-03",
    name: "Treino 1 Murilo 03.2024",
    splitLabel: "4x / semana",
    notes: "Importado da planilha TODAS AS PLANILHAS. Blocos de core mantidos e cardio ignorado.",
    createdAt: "2026-03-18T12:00:00.000Z",
    workoutPlan: importedMuriloWorkoutSeed,
  },
  {
    id: "workout-import-pacho-abcd",
    name: "Treino Pacho ABCD",
    splitLabel: "4x / semana",
    notes: "Importado da planilha TODAS AS PLANILHAS. Técnicas de intensidade preservadas em notas e cardio ignorado.",
    createdAt: "2026-03-18T12:05:00.000Z",
    workoutPlan: importedPachoAbcdWorkoutSeed,
  },
  {
    id: "workout-import-pacho-abc",
    name: "Treino Pacho ABC",
    splitLabel: "3x / semana",
    notes: "Importado da planilha TODAS AS PLANILHAS com divisao A, B e C. Dias de cardio foram ignorados.",
    createdAt: "2026-03-18T12:10:00.000Z",
    workoutPlan: importedPachoAbcWorkoutSeed,
  },
  {
    id: "workout-import-jogo-montenegro-2019",
    name: "Treino Jogo Montenegro 2019",
    splitLabel: "6x / semana",
    notes: "Importado do arquivo Treino1 Gabriel Amorim 14-06-2019.docx. Como o documento não traz dias fixos, as séries A-F foram distribuidas de segunda a sabado.",
    createdAt: "2026-03-18T12:15:00.000Z",
    workoutPlan: importedJogoMontenegro2019Seed,
  },
];

export const reminderSeed: ReminderItem[] = [
  {
    id: "reminder-fasting",
    entityType: "supplement",
    entityId: "meal-fasting",
    title: "Stack de jejum",
    time: "08:00",
    weekdays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
    enabled: true,
    delivery: "native-pending",
    note: "Ideal para notificar via Capacitor no app instalado.",
  },
  {
    id: "reminder-breakfast",
    entityType: "meal",
    entityId: "meal-breakfast",
    title: "Café da manhã + suplementos",
    time: "09:30",
    weekdays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
    enabled: true,
    delivery: "native-pending",
  },
  {
    id: "reminder-lunch",
    entityType: "meal",
    entityId: "meal-lunch",
    title: "Almoço planejado",
    time: "13:00",
    weekdays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
    enabled: true,
    delivery: "native-pending",
  },
  {
    id: "reminder-intra",
    entityType: "supplement",
    entityId: "meal-intra",
    title: "Intra treino",
    time: "16:00",
    weekdays: ["monday", "wednesday", "friday"],
    enabled: true,
    delivery: "native-pending",
  },
  {
    id: "reminder-dinner",
    entityType: "meal",
    entityId: "meal-dinner",
    title: "Jantar e stack noturno",
    time: "19:00",
    weekdays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
    enabled: true,
    delivery: "native-pending",
  },
  {
    id: "reminder-workout-a",
    entityType: "workout",
    entityId: "workout-monday-a",
    title: "Treino A",
    time: "17:30",
    weekdays: ["monday"],
    enabled: true,
    delivery: "native-pending",
  },
  {
    id: "reminder-workout-c",
    entityType: "workout",
    entityId: "workout-wednesday-c",
    title: "Treino C",
    time: "17:30",
    weekdays: ["wednesday"],
    enabled: true,
    delivery: "native-pending",
  },
  {
    id: "reminder-workout-b",
    entityType: "workout",
    entityId: "workout-friday-b",
    title: "Treino B",
    time: "17:30",
    weekdays: ["friday"],
    enabled: true,
    delivery: "native-pending",
  },
];

export const householdSupplySeed: HouseholdSupplyItem[] = [
  {
    id: "household-toilet-paper",
    name: "Papel higiênico",
    category: "Banheiro",
    unitPrice: 32.9,
    packageQuantity: 12,
    monthlyNeed: 20,
    link: "",
  },
  {
    id: "household-laundry-detergent",
    name: "Sabão para roupas",
    category: "Lavanderia",
    unitPrice: 24.5,
    packageQuantity: 1,
    monthlyNeed: 2,
    link: "",
  },
];

export const initialPersistedState: PersistedState = {
  session: {
    authenticated: false,
    userId: "",
    email: "",
    name: "",
    username: "",
  },
  tasks: initialTasks,
  guidedOnboarding: createDefaultGuidedOnboardingProfile(),
  lifeAreaProfile: createDefaultLifeAreaProfile(),
  bodyMetricsProfile: {},
  personalProfile: personalProfileSeed,
  settings: {
    theme: "default",
    sound: true,
    vibration: true,
    darkMode: true,
    notifications: true,
    activeModules: {
      run: true,
      workout: true,
      work: true,
      nutrition: true,
      finance: true,
      appearance: true,
      recovery: true,
      health: true,
      mind: true,
      sleep: true,
      home: true,
      market: true,
      supplements: true,
    },
    moduleOrder: [...defaultModuleOrder],
    dashboardSectionOrder: [
      "quick-actions",
      "timeline",
      "telemetry",
      "modules",
      "ranking",
      "skills",
    ],
    hiddenDashboardSections: [],
  },
  nutritionGoal: "maintain",
  workoutMode: "gym",
  arena: {
    victories: 0,
    matches: 0,
    totalDamage: 0,
    combatLog: [],
  },
  financeLessons: financeLessonSeed,
  workoutPlan: workoutPlanSeed,
  workoutLoadEntries: [
    {
      id: "load-workout-monday-a-supino-inclinado-2026-03-14",
      key: "workout-monday-a:supino-inclinado",
      programId: "workout-hypertrophy-3x",
      dayId: "workout-monday-a",
      dayTitle: "Push pesado",
      exerciseId: "supino-inclinado",
      exerciseName: "Supino inclinado com halteres",
      setNumber: 1,
      weightKg: 28,
      repetitions: 8,
      loggedAt: "2026-03-14T18:20:00.000Z",
    },
    {
      id: "load-workout-monday-a-supino-inclinado-2026-03-07",
      key: "workout-monday-a:supino-inclinado",
      programId: "workout-hypertrophy-3x",
      dayId: "workout-monday-a",
      dayTitle: "Push pesado",
      exerciseId: "supino-inclinado",
      exerciseName: "Supino inclinado com halteres",
      setNumber: 1,
      weightKg: 26,
      repetitions: 10,
      loggedAt: "2026-03-07T18:10:00.000Z",
    },
    {
      id: "load-workout-friday-b-remada-curvada-2026-03-13",
      key: "workout-friday-b:remada-curvada",
      programId: "workout-hypertrophy-3x",
      dayId: "workout-friday-b",
      dayTitle: "Pull com costas",
      exerciseId: "remada-curvada",
      exerciseName: "Remada curvada",
      setNumber: 1,
      weightKg: 52,
      repetitions: 8,
      loggedAt: "2026-03-13T18:20:00.000Z",
    },
    {
      id: "load-workout-friday-b-remada-curvada-2026-03-06",
      key: "workout-friday-b:remada-curvada",
      programId: "workout-hypertrophy-3x",
      dayId: "workout-friday-b",
      dayTitle: "Pull com costas",
      exerciseId: "remada-curvada",
      exerciseName: "Remada curvada",
      setNumber: 1,
      weightKg: 50,
      repetitions: 10,
      loggedAt: "2026-03-06T18:15:00.000Z",
    },
    {
      id: "load-workout-wednesday-c-agachamento-livre-2026-03-12",
      key: "workout-wednesday-c:agachamento-livre",
      programId: "workout-hypertrophy-3x",
      dayId: "workout-wednesday-c",
      dayTitle: "Lower completo",
      exerciseId: "agachamento-livre",
      exerciseName: "Agachamento livre ou no smith",
      setNumber: 1,
      weightKg: 82,
      repetitions: 6,
      loggedAt: "2026-03-12T18:30:00.000Z",
    },
    {
      id: "load-workout-wednesday-c-agachamento-livre-2026-03-05",
      key: "workout-wednesday-c:agachamento-livre",
      programId: "workout-hypertrophy-3x",
      dayId: "workout-wednesday-c",
      dayTitle: "Lower completo",
      exerciseId: "agachamento-livre",
      exerciseName: "Agachamento livre ou no smith",
      setNumber: 1,
      weightKg: 78,
      repetitions: 8,
      loggedAt: "2026-03-05T18:25:00.000Z",
    },
  ],
  workoutDayCompletions: [],
  mealPlan: mealPlanSeed,
  nutritionDailyExtras: [],
  foodDatabase: foodDatabaseSeed,
  dailyNutritionTargets: dailyNutritionTargetsSeed,
  weightEntries: nutritionWeightEntriesSeed,
  waterEntries: nutritionWaterEntriesSeed,
  dietDayTypes: dietDayTypesSeed,
  dietWeekSchedule: dietWeekScheduleSeed,
  dietWorkoutLink: dietWorkoutLinkSeed,
  foodSubstitutions: foodSubstitutionSeed,
  dietPlans: dietPlanSeed,
  activeDietPlanId: dietPlanSeed[0].id,
  workoutPrograms: workoutProgramSeed,
  activeWorkoutProgramId: workoutProgramSeed[0].id,
  recoveryPrograms: [],
  activeRecoveryProgramId: "",
  recoveryPlan: [],
  recoveryDayCompletions: [],
  reminders: reminderSeed,
  householdSupplies: householdSupplySeed,
  workControlEntries: workControlSeed,
  shoppingModules: {
    market: getShoppingSeedState("market"),
    supplements: getShoppingSeedState("supplements"),
  },
  financeBudget: financeBudgetSeed,
  financeCategories: financeCategorySeed,
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
  customQuotes: [],
};

export function getRankFromPoints(points: number) {
  if (points >= 100000) return { label: "Transcendente", tier: "III" };
  if (points >= 60000) return { label: "Lenda", tier: "III" };
  if (points >= 40000) return { label: "Grão-Mestre", tier: "II" };
  if (points >= 25000) return { label: "Mestre", tier: "III" };
  if (points >= 15000) return { label: "Elite", tier: "II" };
  if (points >= 10000) return { label: "Veterano", tier: "II" };
  if (points >= 6000) return { label: "Guerreiro", tier: "I" };
  if (points >= 3000) return { label: "Dedicado", tier: "III" };
  if (points >= 1000) return { label: "Aprendiz", tier: "II" };
  return { label: "Iniciante", tier: "I" };
}

const maxUserLevel = 100;
const baseXpPerLevel = 120;
const xpGrowthFactor = 1.055;
const xpLinearBonusPerLevel = 12;
const hunterRankThresholds: Array<{ tier: RankTier; minXp: number }> = [
  { tier: "E", minXp: 0 },
  { tier: "D", minXp: 2_000 },
  { tier: "C", minXp: 8_000 },
  { tier: "B", minXp: 22_000 },
  { tier: "A", minXp: 50_000 },
  { tier: "S", minXp: 90_000 },
];

export function getXpForNextLevel(level: number) {
  if (level >= maxUserLevel) return 0;

  const safeLevel = Math.max(1, level);
  return Math.round(
    baseXpPerLevel * Math.pow(xpGrowthFactor, safeLevel - 1) +
      (safeLevel - 1) * xpLinearBonusPerLevel,
  );
}

export function getLevelProgressFromXp(totalXp: number) {
  const safeXp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  let remainingXp = safeXp;

  while (level < maxUserLevel) {
    const xpToNextLevel = getXpForNextLevel(level);
    if (remainingXp < xpToNextLevel) {
      return {
        level,
        xp: remainingXp,
        xpToNextLevel,
        isMaxLevel: false,
      };
    }

    remainingXp -= xpToNextLevel;
    level += 1;
  }

  return {
    level: maxUserLevel,
    xp: 0,
    xpToNextLevel: 0,
    isMaxLevel: true,
  };
}

export function getRankFromXp(totalXp: number) {
  const safeXp = Math.max(0, Math.floor(totalXp));
  let currentRank = hunterRankThresholds[0];
  let nextRank: { tier: RankTier; minXp: number } | null = null;

  for (let index = 0; index < hunterRankThresholds.length; index += 1) {
    const threshold = hunterRankThresholds[index];
    if (safeXp >= threshold.minXp) {
      currentRank = threshold;
      nextRank = hunterRankThresholds[index + 1] ?? null;
    }
  }

  return {
    label: "Rank",
    tier: currentRank.tier,
    nextTier: nextRank?.tier ?? null,
    xpToNextRank: nextRank ? Math.max(0, nextRank.minXp - safeXp) : 0,
  };
}

// export const rankingSeed removido — não tem mais consumidores
// (dashboard, /ranking e /friends agora mostram só o próprio user
// ou empty state). Quando voltar a camada social, reconstruir a
// partir de dados reais e não de mock.

export function buildUserProfile(state: PersistedState): UserProfile {
  const completedTasks = state.tasks.filter((task) => task.completed);
  const totalTaskXp = completedTasks.reduce((sum, task) => sum + task.xp, 0);
  const lessonsXp = state.financeLessons
    .filter((lesson) => lesson.completed)
    .reduce((sum, lesson) => sum + lesson.points, 0);
  const arenaXp = state.arena.victories * 120 + state.arena.matches * 25;
  const totalXp = totalTaskXp + lessonsXp + arenaXp;
  const levelProgress = getLevelProgressFromXp(totalXp);
  const rank = getRankFromXp(totalXp);

  const categoryCount = (category: Task["category"]) =>
    completedTasks.filter((task) => task.category === category).length;

  const focusScore = Math.min(
    5,
    3 + categoryCount("study") * 0.35 + categoryCount("productivity") * 0.15,
  );
  const energyScore = Math.min(5, 3 + categoryCount("fitness") * 0.25);
  const disciplineScore = Math.min(
    5,
    3 + completedTasks.length * 0.1 + state.arena.matches * 0.08,
  );
  const productionScore = Math.min(
    5,
    3 + categoryCount("productivity") * 0.35 + completedTasks.length * 0.05,
  );
  const motivationScore = Math.min(
    5,
    3 + state.arena.victories * 0.2 + lessonsXp / 200 + completedTasks.length * 0.03,
  );

  const streak = Math.max(1, Math.min(1 + Math.floor(completedTasks.length / 2), 14));
  const fallbackEmail = state.session.email || "operador@praxisprotocol.app";
  const fallbackHandle =
    state.session.username || fallbackEmail.split("@")[0]?.trim() || "operador";
  return {
    name: state.session.name || "Operador Praxis",
    email: fallbackEmail,
    username: fallbackHandle.startsWith("@")
      ? fallbackHandle
      : `@${fallbackHandle}`,
    level: levelProgress.level,
    xp: levelProgress.xp,
    xpToNextLevel: levelProgress.xpToNextLevel,
    totalXp,
    isMaxLevel: levelProgress.isMaxLevel,
    streak,
    rankLabel: rank.label,
    rankTier: rank.tier,
    nextRankTier: rank.nextTier,
    xpToNextRank: rank.xpToNextRank,
    evolutionsUnlocked: Math.max(
      1,
      Math.min(100, Math.floor(levelProgress.level / 4) + completedTasks.length),
    ),
    skillScores: {
      focus: Number(focusScore.toFixed(1)),
      energy: Number(energyScore.toFixed(1)),
      discipline: Number(disciplineScore.toFixed(1)),
      production: Number(productionScore.toFixed(1)),
      motivation: Number(motivationScore.toFixed(1)),
    },
    characterStats: {
      vitality: Math.min(100, categoryCount("fitness") * 18 + state.arena.matches * 6),
      hydration: Math.min(100, categoryCount("nutrition") * 24),
      strength: Math.min(100, categoryCount("fitness") * 22),
      intelligence: Math.min(
        100,
        categoryCount("study") * 18 +
          state.financeLessons.filter((lesson) => lesson.completed).length * 7,
      ),
      discipline: Math.min(100, completedTasks.length * 9),
      agility: Math.min(100, categoryCount("fitness") * 15 + state.arena.matches * 4),
      focus: Math.min(
        100,
        categoryCount("productivity") * 16 + categoryCount("study") * 8,
      ),
      charisma: Math.min(100, categoryCount("social") * 22 + state.arena.victories * 5),
    },
  };
}


