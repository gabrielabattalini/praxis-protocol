import type { ModuleId, ReminderEntityType } from "@/lib/types";

type LoadingCue = {
  eyebrow: string;
  text: string;
};

// Frases reais de pensadores, traduzidas. Alinhadas ao tom do app
// (disciplina, hábito, execução, identidade). Cada eyebrow é o autor.
const loadingCues: LoadingCue[] = [
  {
    eyebrow: "Aristóteles",
    text: "Nos tornamos justos praticando atos justos; temperantes, praticando a temperança; corajosos, praticando atos de coragem.",
  },
  {
    eyebrow: "Marco Aurélio",
    text: "Não perca mais tempo discutindo como deveria ser um bom homem. Seja um.",
  },
  {
    eyebrow: "Marco Aurélio",
    text: "Você monta sua vida sozinho — ação por ação.",
  },
  {
    eyebrow: "Sêneca",
    text: "Não é que tenhamos pouco tempo de vida. É que perdemos muito dele.",
  },
  {
    eyebrow: "Sêneca",
    text: "O mais poderoso é aquele que tem a si mesmo em seu próprio poder.",
  },
  {
    eyebrow: "Epicteto",
    text: "Primeiro decida quem você quer ser. Depois faça o que precisa ser feito.",
  },
  {
    eyebrow: "Epicteto",
    text: "Todo hábito e capacidade se confirma e cresce nas ações correspondentes — caminhar, caminhando; correr, correndo.",
  },
  {
    eyebrow: "Lao-Tsé",
    text: "A jornada de mil milhas começa com um único passo.",
  },
  {
    eyebrow: "Sócrates",
    text: "O segredo da mudança é focar toda a sua energia não em lutar contra o velho, mas em construir o novo.",
  },
  {
    eyebrow: "Bruce Lee",
    text: "A disciplina é o caminho para a liberdade.",
  },
  {
    eyebrow: "Bruce Lee",
    text: "Não ore por uma vida fácil. Ore por força para suportar uma vida difícil.",
  },
  {
    eyebrow: "Bruce Lee",
    text: "Se você passa tempo demais pensando em uma coisa, nunca vai realizá-la.",
  },
  {
    eyebrow: "Albert Einstein",
    text: "Não é que eu seja tão inteligente. É que fico com os problemas por mais tempo.",
  },
  {
    eyebrow: "Marco Aurélio",
    text: "O obstáculo à ação faz avançar a ação. O que está no caminho se torna o caminho.",
  },
  {
    eyebrow: "Sêneca",
    text: "Sofremos mais vezes na imaginação do que na realidade.",
  },
  {
    eyebrow: "James Clear",
    text: "Você não se eleva ao nível das suas metas. Você cai ao nível dos seus sistemas.",
  },
  {
    eyebrow: "James Clear",
    text: "Cada ação é um voto no tipo de pessoa que você quer se tornar.",
  },
  {
    eyebrow: "John C. Maxwell",
    text: "Pequenas disciplinas repetidas com consistência todo dia geram grandes conquistas com o tempo.",
  },
  {
    eyebrow: "Jeremy Bentham",
    text: "A mais rara das qualidades humanas é a consistência.",
  },
  {
    eyebrow: "Marco Aurélio",
    text: "Confine-se ao presente.",
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
