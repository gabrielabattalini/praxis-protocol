/**
 * Guia de execução dos exercícios de Recuperação (mobilidade, alongamento,
 * liberação miofascial). Cada guia tem um passo a passo, respiração e
 * cuidados, além de um `slug` usado pra localizar a imagem futura em
 * /public/recovery/<slug>.(webp|png|jpg) — quando o arquivo existir, a aba
 * "como executar" mostra a imagem; enquanto não existir, mostra um
 * placeholder na identidade visual.
 *
 * A busca é por NOME normalizado (sem acento, minúsculo), então funciona
 * tanto pros exercícios-base quanto pra qualquer um digitado igual.
 */
export type RecoveryExerciseGuide = {
  slug: string;
  /** Passo a passo da execução, em ordem. */
  steps: string[];
  /** Como respirar durante o movimento. */
  breathing?: string;
  /** O que evitar / pontos de atenção. */
  cuidados?: string;
};

function normalizeExerciseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const GUIDES: RecoveryExerciseGuide[] = [
  // ── Mobilidade matinal ──────────────────────────────────────────
  {
    slug: "cat-cow",
    steps: [
      "Fique em quatro apoios: mãos sob os ombros e joelhos sob o quadril.",
      "Inspirando, arqueie a coluna — barriga desce, peito e olhar sobem (cow).",
      "Expirando, arredonde as costas — empurre o chão, queixo em direção ao peito (cat).",
      "Alterne entre as duas posições de forma lenta e contínua.",
    ],
    breathing: "Inspira ao arquear, expira ao arredondar.",
    cuidados: "Mova vértebra por vértebra, sem forçar o pescoço nem o lombar.",
  },
  {
    slug: "hip-90-90",
    steps: [
      "Sentado no chão, deixe uma perna à frente dobrada a 90° e a outra ao lado também a 90°.",
      "Mantenha o tronco ereto e a coluna longa.",
      "Gire o quadril levando os dois joelhos para o outro lado, trocando a posição das pernas.",
      "Alterne os lados de forma controlada.",
    ],
    breathing: "Expira ao girar para cada lado.",
    cuidados: "Vá só até onde tem amplitude sem dor; mantenha o tronco alto.",
  },
  {
    slug: "thoracic-openers",
    steps: [
      "Deite de lado com os joelhos dobrados a 90° e os dois braços estendidos à frente, palmas juntas.",
      "Abra o braço de cima desenhando um grande arco até o lado oposto, acompanhando com o olhar.",
      "Deixe o peito abrir em direção ao teto; mantenha os joelhos no chão.",
      "Volte devagar e repita; depois troque de lado.",
    ],
    breathing: "Inspira ao abrir o braço, expira ao voltar.",
    cuidados: "O giro vem da coluna torácica (meio das costas), não do lombar.",
  },
  {
    slug: "shoulder-cars",
    steps: [
      "Em pé, tronco firme, estenda um braço para a frente.",
      "Desenhe o maior círculo possível com o braço: para cima, para trás e para baixo.",
      "Faça bem lento e controlado, buscando a amplitude máxima sem dor.",
      "Inverta o sentido do círculo e depois troque de braço.",
    ],
    breathing: "Respiração contínua, sem prender o ar.",
    cuidados: "Não compense com a coluna — o movimento é só do ombro.",
  },

  // ── Alongamento pós-treino ──────────────────────────────────────
  {
    slug: "pigeon",
    steps: [
      "Partindo de quatro apoios, traga uma perna à frente com o joelho dobrado e a canela na diagonal.",
      "Estenda a outra perna para trás, com o peito do pé no chão.",
      "Mantenha o quadril alinhado (sem cair pro lado) e desça o tronco sobre a perna da frente.",
      "Sinta o glúteo alongar; segure parado e depois troque de lado.",
    ],
    breathing: "Respire fundo e aprofunde um pouco a cada expiração.",
    cuidados: "Se o joelho da frente incomodar, aproxime o calcanhar do corpo.",
  },
  {
    slug: "hamstring-estatico",
    steps: [
      "Sentado (ou em pé), estenda uma perna à frente com o pé relaxado.",
      "Incline o tronco para a frente a partir do quadril, coluna longa, buscando o pé.",
      "Pare quando sentir a parte de trás da coxa alongar e segure parado.",
      "Troque de perna.",
    ],
    breathing: "Expira ao inclinar e aprofundar.",
    cuidados: "Não arredonde as costas; alongamento firme, nunca dor aguda.",
  },
  {
    slug: "panturrilha-em-parede",
    steps: [
      "De frente para a parede, apoie as duas mãos na altura do peito.",
      "Leve uma perna para trás, joelho estendido e calcanhar firme no chão, pé apontado pra frente.",
      "Empurre o quadril em direção à parede até sentir a panturrilha alongar.",
      "Segure e troque de perna.",
    ],
    breathing: "Respiração calma; segura o alongamento na expiração.",
    cuidados: "O calcanhar de trás não pode sair do chão; joelho de trás reto.",
  },
  {
    slug: "child-pose",
    steps: [
      "Ajoelhado, sente os glúteos sobre os calcanhares.",
      "Leve o tronco à frente até a testa se aproximar do chão.",
      "Estenda os braços à frente e relaxe os ombros.",
      "Respire fundo, sentindo as costas se expandirem.",
    ],
    breathing: "Respiração lenta, expandindo as costas na inspiração.",
    cuidados: "Se quadril/joelho incomodar, afaste os joelhos e relaxe.",
  },

  // ── Liberação miofascial ────────────────────────────────────────
  {
    slug: "rolo-coluna-toracica",
    steps: [
      "Deite com o rolo na transversal, apoiado na parte alta das costas (acima do lombar).",
      "Cruze as mãos atrás da cabeça para apoiar o pescoço e mantenha o core levemente ativo.",
      "Role pequenas distâncias só na região torácica, procurando pontos tensos.",
      "Pause e respire nos pontos mais rígidos.",
    ],
    breathing: "Expira ao rolar e ao aprofundar a pressão.",
    cuidados: "Não role o lombar nem o pescoço.",
  },
  {
    slug: "bola-no-gluteo",
    steps: [
      "Sente-se com a bola posicionada sob um dos glúteos.",
      "Cruze o tornozelo desse lado sobre o joelho oposto para abrir a região.",
      "Role devagar buscando pontos tensos e pause sobre eles.",
      "Troque de lado.",
    ],
    breathing: "Respire fundo e relaxe em cima de cada ponto.",
    cuidados: "Pressão moderada; saia de pontos com dor aguda ou formigamento.",
  },
  {
    slug: "rolo-no-quadriceps",
    steps: [
      "Deite de bruços com o rolo sob a frente de uma coxa, apoiado nos antebraços.",
      "Role lentamente da virilha até logo acima do joelho.",
      "Pause nos pontos mais tensos, respirando.",
      "Troque de perna.",
    ],
    breathing: "Respiração contínua; pausa nos pontos tensos.",
    cuidados: "Não role sobre o joelho nem sobre a articulação do quadril.",
  },
  {
    slug: "bola-planta-do-pe",
    steps: [
      "Em pé ou sentado, apoie a planta do pé sobre a bola.",
      "Role da base dos dedos até o calcanhar, com pressão leve.",
      "Pause nos pontos sensíveis por alguns segundos.",
      "Troque de pé.",
    ],
    breathing: "Respiração calma e constante.",
    cuidados: "Pressão suave; evite pontos de dor aguda.",
  },
];

/** Apelidos: nomes alternativos que apontam pro mesmo guia. */
const ALIASES: Record<string, string> = {
  "gato camelo": "cat-cow",
  "gato-camelo": "cat-cow",
  "90/90": "hip-90-90",
  "hip 90 90": "hip-90-90",
  "rotacao toracica": "thoracic-openers",
  "abertura toracica": "thoracic-openers",
  "pombo": "pigeon",
  "postura da crianca": "child-pose",
  "crianca": "child-pose",
  "isquiotibiais estatico": "hamstring-estatico",
  "rolo na coluna toracica": "rolo-coluna-toracica",
  "rolo no quadriceps": "rolo-no-quadriceps",
  "bola na planta do pe": "bola-planta-do-pe",
};

const BY_SLUG = new Map(GUIDES.map((guide) => [guide.slug, guide]));

const BY_NAME: Record<string, RecoveryExerciseGuide> = (() => {
  const map: Record<string, RecoveryExerciseGuide> = {};
  // Nomes-base (os mesmos dos presets), normalizados.
  const baseNames: Record<string, string> = {
    "cat-cow": "cat-cow",
    "hip 90/90": "hip-90-90",
    "thoracic openers": "thoracic-openers",
    "shoulder cars": "shoulder-cars",
    "pigeon": "pigeon",
    "hamstring estatico": "hamstring-estatico",
    "panturrilha em parede": "panturrilha-em-parede",
    "child pose": "child-pose",
    "rolo na coluna toracica": "rolo-coluna-toracica",
    "bola no gluteo": "bola-no-gluteo",
    "rolo no quadriceps": "rolo-no-quadriceps",
    "bola na planta do pe": "bola-planta-do-pe",
  };
  for (const [name, slug] of Object.entries(baseNames)) {
    const guide = BY_SLUG.get(slug);
    if (guide) map[normalizeExerciseName(name)] = guide;
  }
  for (const [alias, slug] of Object.entries(ALIASES)) {
    const guide = BY_SLUG.get(slug);
    if (guide) map[normalizeExerciseName(alias)] = guide;
  }
  return map;
})();

export function getRecoveryExerciseGuide(
  name: string,
): RecoveryExerciseGuide | null {
  if (!name) return null;
  return BY_NAME[normalizeExerciseName(name)] ?? null;
}

/** Candidatos de caminho da imagem (a primeira que existir é exibida). */
export function recoveryExerciseImageCandidates(slug: string): string[] {
  return [
    `/recovery/${slug}.webp`,
    `/recovery/${slug}.png`,
    `/recovery/${slug}.jpg`,
  ];
}
