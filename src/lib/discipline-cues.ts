import type { ModuleId, ReminderEntityType } from "@/lib/types";

type LoadingCue = {
  eyebrow: string;
  text: string;
};

const loadingCues: LoadingCue[] = [
  {
    eyebrow: "Protocolo de execução",
    text: "Você não precisa de hype. Precisa do próximo passo.",
  },
  {
    eyebrow: "Consistência",
    text: "Hoje não precisa ser perfeito. Só precisa continuar.",
  },
  {
    eyebrow: "Identidade",
    text: "Cada execução reforça quem você está se tornando.",
  },
  {
    eyebrow: "Aderência",
    text: "Facilite o começo. O resto fica mais leve em movimento.",
  },
  {
    eyebrow: "Regra central",
    text: "Falhar uma vez é ruído. Falhar duas vezes vira padrão.",
  },
  {
    eyebrow: "Disciplina",
    text: "Sofra a dor da disciplina ou sofra a dor do arrependimento.",
  },
  {
    eyebrow: "Sistema",
    text: "Menos negociação mental. Mais caminho pronto para agir.",
  },
  {
    eyebrow: "Ambiente",
    text: "O que fica fácil de começar pesa menos na força de vontade.",
  },
  {
    eyebrow: "Sentido",
    text: "O esforço pesa menos quando você lembra por que escolheu isso.",
  },
  {
    eyebrow: "Retomada",
    text: "Quebrou ontem? Hoje é o dia de voltar para a trilha.",
  },
  {
    eyebrow: "Ação",
    text: "Clareza não vem antes. Clareza aparece enquanto você faz.",
  },
  {
    eyebrow: "Fidelidade",
    text: "O que você repete em silêncio constrói a pessoa que você vira.",
  },
];

const genericNotificationCues = [
  "Faça o próximo passo antes que o cérebro abra negociação.",
  "Constância silenciosa vence intensidade de curto prazo.",
  "Se o plano já está decidido, agora é só executar.",
  "O desconforto de agir pesa menos que o arrependimento depois.",
  "Transforme este lembrete em evidência de quem você quer ser.",
  "Disciplina não é emoção alta. É retorno consistente ao protocolo.",
  "Hoje vale mais manter a trilha do que esperar o dia perfeito.",
  "Uma ação pequena ainda conta como voto para a sua identidade.",
  "Se estiver pesado, faça a versão mínima e preserve a sequência.",
  "O importante agora é reduzir o atrito entre intenção e execução.",
] as const;

const moduleNotificationCues: Partial<Record<ModuleId, readonly string[]>> = {
  run: [
    "Tênis calçado e horário definido vencem a vontade oscilante.",
    "Comece em ritmo leve. O mais importante é preservar a sequência.",
    "Cardio consistente nasce do protocolo, não do clima perfeito.",
  ],
  workout: [
    "Treinar hoje protege a identidade que você está construindo.",
    "A roupa pronta reduz atrito. O primeiro minuto resolve o resto.",
    "Mesmo curto, o treino de hoje mantém vivo o seu padrão.",
  ],
  work: [
    "Clareza nasce em execução. Abra, comece e refine em movimento.",
    "Bloco entregue vale mais do que perfeição adiada.",
    "O trabalho avança melhor quando a próxima ação já está definida.",
  ],
  nutrition: [
    "Decisão tomada antes da fome exige menos força de vontade.",
    "Comer conforme o plano reduz a negociação do resto do dia.",
    "Nutrição certa hoje protege energia, foco e recuperação amanhã.",
  ],
  finance: [
    "Organizar agora evita o peso silencioso de deixar para depois.",
    "Consistência financeira é protocolo, não impulso.",
    "A decisão registrada hoje evita retrabalho e ruído amanhã.",
  ],
  appearance: [
    "Cuidado repetido vira padrão visual sem depender de motivação.",
    "Rotina simples, repetida, sustenta presença com menos esforço.",
  ],
  recovery: [
    "Recuperar também é disciplina. Sem isso, o sistema perde tração.",
    "Descanso planejado mantém o restante da rotina de pé.",
  ],
  health: [
    "Prevenção é disciplina sem plateia.",
    "Check-up feito no prazo evita o custo invisível de adiar.",
    "Cuidar disso agora reduz o peso de ignorar depois.",
  ],
  mind: [
    "Poucos minutos contam como evidência de autocontrole e clareza.",
    "Foco treinado em blocos curtos tende a durar mais.",
    "Mente estável vem mais de repetição do que de inspiração.",
  ],
  sleep: [
    "Dormir no horário protege a rotina de amanhã.",
    "Sono consistente reduz a chance de depender só de força de vontade.",
    "Ir dormir agora é preparar o dia seguinte antes dele começar.",
  ],
  home: [
    "Ambiente arrumado cria menos atrito para todo o resto.",
    "Ordem externa economiza energia mental durante o dia.",
  ],
  market: [
    "Deixar o básico resolvido reduz decisões ruins no improviso.",
    "Compra planejada sustenta o sistema quando a semana apertar.",
  ],
  supplements: [
    "O que fica pronto e visível pede menos esforço para ser seguido.",
    "Dose no horário certo vale mais do que intenção sem gatilho.",
  ],
};

const entityNotificationCues: Partial<
  Record<ReminderEntityType | "task", readonly string[]>
> = {
  task: [
    "Quando o gatilho aparece, a decisão já deveria estar tomada.",
    "Execute o bloco e preserve a relação de confiança com você mesmo.",
    "Hoje não é sobre intensidade. É sobre manter o acordo que você fez consigo.",
  ],
  meal: [
    "Refeição planejada reduz a chance de improvisar no cansaço.",
    "Coma o que já foi decidido e economize força de vontade.",
  ],
  supplement: [
    "Deixar a suplementação automática reduz atrito diário.",
    "O horário certo torna o protocolo mais leve de cumprir.",
  ],
  workout: [
    "Um treino feito vale mais do que o treino ideal que não saiu.",
    "Comece pequeno se precisar, mas não deixe a sequência quebrar.",
  ],
  cardio: [
    "Cardio consistente nasce do horário fixo, não do clima perfeito.",
    "Faça o primeiro bloco. O corpo entende o resto em movimento.",
  ],
};

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickBySeed<T>(items: readonly T[], seed: string) {
  if (!items.length) {
    throw new Error("pickBySeed recebeu uma lista vazia.");
  }

  const index = hashString(seed) % items.length;
  return items[index];
}

function normalizeBody(value?: string) {
  return value?.trim() || "O próximo passo já está pronto no Praxis.";
}

export function getLoadingCuePool() {
  return loadingCues;
}

export function getNotificationCue(params: {
  title: string;
  body?: string;
  moduleId?: ModuleId | null;
  entityType?: ReminderEntityType | "task";
  route?: string;
}) {
  const contextual = [
    ...(params.moduleId ? moduleNotificationCues[params.moduleId] ?? [] : []),
    ...(params.entityType ? entityNotificationCues[params.entityType] ?? [] : []),
    ...genericNotificationCues,
  ];

  return pickBySeed(
    contextual,
    `${params.title}|${params.moduleId || ""}|${params.entityType || ""}|${params.route || ""}`,
  );
}

export function buildNotificationBodyWithCue(params: {
  title: string;
  body?: string;
  moduleId?: ModuleId | null;
  entityType?: ReminderEntityType | "task";
  route?: string;
}) {
  const base = normalizeBody(params.body);
  const cue = getNotificationCue(params);

  return `${base}\n\n${cue}`;
}
