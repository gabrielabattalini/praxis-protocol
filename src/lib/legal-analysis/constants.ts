import type {
  AnalysisFormData,
  CreditClassification,
  DocumentChecklistItem,
  DocumentType,
  GeneratedPieceKey,
  ProcessType,
} from "@/types/legal-analysis";

export const STORAGE_KEY = "nexus-habilitacao-credito-v1";

export const documentDefinitions: Array<{
  tipo: DocumentType;
  titulo: string;
}> = [
  { tipo: "contrato", titulo: "Contrato" },
  { tipo: "nota_fiscal", titulo: "Nota fiscal" },
  { tipo: "comprovante_entrega", titulo: "Comprovante de entrega" },
  { tipo: "ctps", titulo: "CTPS" },
  { tipo: "peticao_inicial", titulo: "Petição inicial" },
  { tipo: "sentenca", titulo: "Sentença" },
  { tipo: "sentenca_homologatoria", titulo: "Sentença homologatória" },
  { tipo: "calculos_homologados", titulo: "Cálculos homologados" },
  {
    tipo: "comprovante_pagamento_parcial",
    titulo: "Comprovante de pagamento parcial",
  },
  { tipo: "outros", titulo: "Outros documentos" },
];

export const wizardSteps = [
  {
    title: "Identificação do caso",
    shortTitle: "Caso",
    description: "Dados essenciais do processo, da devedora e do credor.",
  },
  {
    title: "Regime e base legal",
    shortTitle: "Regime",
    description: "Enquadramento do procedimento e diplomas aplicáveis.",
  },
  {
    title: "Data marco",
    shortTitle: "Marco",
    description: "Definição da data limite técnica para sujeição e cálculo.",
  },
  {
    title: "Fato gerador",
    shortTitle: "Fato",
    description: "Verificação do evento que efetivamente origina o crédito.",
  },
  {
    title: "Natureza do crédito",
    shortTitle: "Natureza",
    description: "Análise de concursalidade ou extraconcursalidade.",
  },
  {
    title: "Classificação do crédito",
    shortTitle: "Classe",
    description: "Classe jurídica a ser aplicada ao crédito em análise.",
  },
  {
    title: "Análise documental",
    shortTitle: "Docs",
    description: "Checklist probatório com avaliação de suficiência.",
  },
  {
    title: "Verificação de duplicidade",
    shortTitle: "Duplic.",
    description: "Checagem de listagem prévia, divergências e ações paralelas.",
  },
  {
    title: "Dados econômicos do crédito",
    shortTitle: "Econômico",
    description: "Valor informado pelo credor e critérios declarados.",
  },
  {
    title: "Regras de cálculo",
    shortTitle: "Cálculo",
    description: "Recálculo técnico até a data marco com memória detalhada.",
  },
  {
    title: "Risco e inconsistências",
    shortTitle: "Riscos",
    description: "Flags automáticas, grau de risco e apontamentos internos.",
  },
  {
    title: "Conclusão técnica",
    shortTitle: "Conclusão",
    description: "Resultado analítico, fundamentos e pendências residuais.",
  },
  {
    title: "Peças e saídas",
    shortTitle: "Saídas",
    description: "Pareceres, minutas, decisão interna e resumo executivo.",
  },
] as const;

export const stepFieldMap: string[][] = [
  [
    "identificacao.processo.numero",
    "identificacao.processo.empresaDevedora",
    "identificacao.credor.nome",
    "identificacao.credor.documento",
    "identificacao.processo.tipo",
    "identificacao.processo.varaComarca",
    "identificacao.processo.administradorJudicial",
  ],
  [
    "regimeBaseLegal.regimeSelecionado",
    "regimeBaseLegal.legislacaoAplicavel",
  ],
  ["dataMarco.dataMarcoConsiderada", "dataMarco.justificativa"],
  [
    "fatoGerador.tipoFatoGerador",
    "fatoGerador.dataFatoGerador",
    "fatoGerador.periodoFatoGerador",
    "fatoGerador.descricaoDetalhada",
  ],
  ["naturezaCredito.natureza", "naturezaCredito.justificativaTecnica"],
  ["classificacaoCredito.classificacao"],
  ["analiseDocumental.avaliacao"],
  [],
  [
    "dadosEconomicos.valorApresentadoCredor",
    "dadosEconomicos.dataBaseValorApresentado",
    "dadosEconomicos.indiceCorrecaoInformado",
  ],
  [
    "regrasCalculo.valorOriginal",
    "regrasCalculo.dataInicial",
    "regrasCalculo.dataFinal",
    "regrasCalculo.indiceInicial",
    "regrasCalculo.indiceFinal",
  ],
  ["analiseInconsistencias.riscoManual"],
  [
    "conclusaoTecnica.conclusao",
    "conclusaoTecnica.fundamentacaoResumida",
    "conclusaoTecnica.fundamentoLegal",
  ],
  [],
];

export const classificationOptions: Array<{
  value: CreditClassification;
  label: string;
}> = [
  { value: "trabalhista", label: "Trabalhista" },
  { value: "garantia_real", label: "Garantia real" },
  { value: "quirografario", label: "Quirografário" },
  { value: "tributario", label: "Tributário" },
  { value: "me_epp", label: "ME / EPP" },
  { value: "outro", label: "Outro" },
];

export const processTypeLabels: Record<ProcessType, string> = {
  recuperacao_judicial: "Recuperação Judicial",
  falencia: "Falência",
};

export const pieceTabs: Array<{ key: GeneratedPieceKey; label: string }> = [
  { key: "parecerTecnico", label: "Parecer técnico" },
  { key: "minutaPeticaoHabilitacao", label: "Minuta de petição" },
  { key: "minutaManifestacaoDivergencia", label: "Manifestação de divergência" },
  { key: "textoBaseDecisao", label: "Texto-base de decisão" },
  { key: "resumoExecutivo", label: "Resumo executivo" },
  { key: "relatorioInconsistencias", label: "Relatório de inconsistências" },
];

export function createDocumentChecklist(): DocumentChecklistItem[] {
  return documentDefinitions.map((documento) => ({
    ...documento,
    apresentado: false,
    arquivoNome: "",
    arquivoTipo: "",
    arquivoTamanhoKb: 0,
    observacao: "",
  }));
}

export function createEmptyGeneratedPieces() {
  return {
    parecerTecnico: "",
    minutaPeticaoHabilitacao: "",
    minutaManifestacaoDivergencia: "",
    textoBaseDecisao: "",
    resumoExecutivo: "",
    relatorioInconsistencias: "",
  };
}

function createId() {
  return `analise-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyAnalysis(): AnalysisFormData {
  const now = new Date().toISOString();

  return {
    id: createId(),
    createdAt: now,
    updatedAt: now,
    currentStep: 0,
    identificacao: {
      processo: {
        numero: "",
        empresaDevedora: "",
        tipo: "recuperacao_judicial",
        varaComarca: "",
        administradorJudicial: "",
        observacoesIniciais: "",
      },
      credor: {
        nome: "",
        documento: "",
      },
    },
    regimeBaseLegal: {
      regimeSelecionado: "recuperacao_judicial",
      legislacaoAplicavel: "",
      diplomas: {
        dl7661: false,
        lei11101: true,
        lei14112: true,
      },
      observacaoJuridica: "",
    },
    dataMarco: {
      dataPedidoRecuperacao: "",
      dataDecretacaoFalencia: "",
      dataMarcoConsiderada: "",
      justificativa: "",
    },
    fatoGerador: {
      tipoFatoGerador: "",
      dataFatoGerador: "",
      periodoFatoGerador: "",
      descricaoDetalhada: "",
      observacaoDiferencas: "",
    },
    naturezaCredito: {
      natureza: "",
      justificativaTecnica: "",
    },
    classificacaoCredito: {
      classificacao: "",
      justificativaOutro: "",
    },
    analiseDocumental: {
      documentos: createDocumentChecklist(),
      avaliacao: "",
    },
    verificacaoDuplicidade: {
      creditoJaListado: null,
      habilitacaoAnterior: null,
      divergenciaAnterior: null,
      valoresDivergentes: null,
      execucaoParalela: null,
      processoVinculado: "",
    },
    dadosEconomicos: {
      valorApresentadoCredor: 0,
      dataBaseValorApresentado: "",
      indiceCorrecaoInformado: "",
      jurosInformados: "",
      multaInformada: "",
      honorariosInformados: "",
      valorJaPago: 0,
    },
    regrasCalculo: {
      valorOriginal: 0,
      dataInicial: "",
      dataFinal: "",
      indiceInicial: 100,
      indiceFinal: 100,
      taxaJuros: 0,
      numeroDias: 0,
      multa: 0,
      inssEmpregado: 0,
      inssEmpregador: 0,
      outrosDescontos: 0,
    },
    analiseInconsistencias: {
      flagsAutomaticas: [],
      riscoManual: "",
      apontamentosManuais: "",
    },
    conclusaoTecnica: {
      conclusao: "",
      fundamentacaoResumida: "",
      fundamentoLegal: "",
      observacoesInternas: "",
      ajustesValor: "",
      documentosPendentes: "",
    },
    pecasGeradas: createEmptyGeneratedPieces(),
  };
}
