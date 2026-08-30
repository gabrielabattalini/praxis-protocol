import type { ModuleId, TaskCategory } from "@/lib/types";

/**
 * Fonte ÚNICA da decisão "criar tarefa deste tipo abre um form rápido ou
 * leva pra página do módulo?".
 *
 * A regra não é gosto — é segurança:
 *  - quick-form: só módulos cuja criação nativa é um Task manual via
 *    addTask (home, mind, health) + a meta avulsa. Os defaults abaixo
 *    ESPELHAM os forms de cada módulo (mesma category, mesma política de
 *    dificuldade) — divergir muda o XP da tarefa.
 *  - navigate: módulos que NÃO criam Task solto. sleep/run/nutrition
 *    sincronizam tarefas por sourceKey (o sleep chega a APAGAR task
 *    manual órfã do módulo), work é planilha própria, workout/finance/
 *    market/supplements/recovery têm entidades próprias (exercício,
 *    linha de orçamento, item de compra…). Criar Task solto neles
 *    geraria lixo ou seria deletado pelo reconcile.
 *
 * Por construção, o config de quick-form NEM TEM campo sourceKey —
 * tarefa criada aqui é sempre manual.
 */
export type QuickFormRecurrenceKind =
  | "daily"
  | "selected-weekdays"
  | "one-time"
  | "interval-days"
  | "monthly";

export type QuickFormConfig = {
  mode: "quick-form";
  /** category gravada no Task — idêntica ao form nativo do módulo. */
  category: TaskCategory;
  /**
   * manual: usuário escolhe easy/medium/hard (default medium).
   * fixed-hard: sempre hard, campo oculto (regra do módulo Mente).
   * derived-health: derivada da recorrência via getHealthDifficulty.
   */
  difficultyMode: "manual" | "fixed-hard" | "derived-health";
  recurrenceKinds: QuickFormRecurrenceKind[];
  defaultTime?: string;
  /** microcopy exibida no card do passo 1 */
  hint: string;
};

export type NavigateConfig = {
  mode: "navigate";
  route: string;
  /** microcopy honesta: por que este tipo abre o módulo */
  hint: string;
};

export type TaskCreationConfig = QuickFormConfig | NavigateConfig;

/** "custom" = meta avulsa, sem módulo (moduleId null). */
export type TaskCreationKey = ModuleId | "custom";

export const taskCreationRegistry: Record<TaskCreationKey, TaskCreationConfig> = {
  custom: {
    mode: "quick-form",
    category: "productivity",
    difficultyMode: "manual",
    recurrenceKinds: ["one-time", "daily", "selected-weekdays"],
    hint: "Entra direto na sua agenda, sem módulo.",
  },
  home: {
    mode: "quick-form",
    category: "productivity",
    difficultyMode: "manual",
    recurrenceKinds: ["daily", "selected-weekdays"],
    defaultTime: "09:00",
    hint: "Rotina da casa — cria aqui mesmo.",
  },
  mind: {
    mode: "quick-form",
    category: "mindfulness",
    difficultyMode: "fixed-hard",
    recurrenceKinds: ["daily", "selected-weekdays"],
    defaultTime: "07:00",
    hint: "Prática mental — cria aqui mesmo.",
  },
  health: {
    mode: "quick-form",
    category: "health",
    difficultyMode: "derived-health",
    recurrenceKinds: ["interval-days", "selected-weekdays", "monthly"],
    defaultTime: "08:30",
    hint: "Exame, consulta, cuidado — cria aqui mesmo.",
  },
  appearance: {
    mode: "navigate",
    route: "/modules/appearance",
    hint: "Abre o módulo — a criação usa os templates de rotina.",
  },
  work: {
    mode: "navigate",
    route: "/modules/work",
    hint: "Abre a planilha de trabalho do módulo.",
  },
  sleep: {
    mode: "navigate",
    route: "/modules/sleep",
    hint: "Abre o módulo — as tarefas nascem do seu plano de sono.",
  },
  run: {
    mode: "navigate",
    route: "/modules/run",
    hint: "Abre o módulo — as tarefas nascem das metas de cardio.",
  },
  nutrition: {
    mode: "navigate",
    route: "/modules/nutrition",
    hint: "Abre o módulo — refeições e metas moram lá.",
  },
  workout: {
    mode: "navigate",
    route: "/modules/workout",
    hint: "Abre o módulo — o treino vem do seu plano semanal.",
  },
  finance: {
    mode: "navigate",
    route: "/modules/finance",
    hint: "Abre o orçamento — receitas e gastos moram lá.",
  },
  recovery: {
    mode: "navigate",
    route: "/modules/recovery",
    hint: "Abre o módulo de recuperação.",
  },
  market: {
    mode: "navigate",
    route: "/modules/market",
    hint: "Abre a lista de compras do mercado.",
  },
  supplements: {
    mode: "navigate",
    route: "/modules/supplements",
    hint: "Abre o módulo de suplementos.",
  },
};

export function getTaskCreationConfig(key: TaskCreationKey): TaskCreationConfig {
  return taskCreationRegistry[key];
}
