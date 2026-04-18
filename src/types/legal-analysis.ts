export type ProcessType = "recuperacao_judicial" | "falencia";

export type CreditNature = "concursal" | "extraconcursal";

export type CreditClassification =
  | "trabalhista"
  | "garantia_real"
  | "quirografario"
  | "tributario"
  | "me_epp"
  | "outro";

export type DocumentType =
  | "contrato"
  | "nota_fiscal"
  | "comprovante_entrega"
  | "ctps"
  | "peticao_inicial"
  | "sentenca"
  | "sentenca_homologatoria"
  | "calculos_homologados"
  | "comprovante_pagamento_parcial"
  | "outros";

export type DocumentEvaluation =
  | "suficiente"
  | "insuficiente"
  | "contraditoria";

export type RiskLevel = "baixo" | "medio" | "alto";

export type ConclusionType =
  | "deferir"
  | "deferir_parcialmente"
  | "indeferir";

export type AnalysisStatus = "pendente" | "em_andamento" | "concluida";

export type AutomaticFlagKey =
  | "ausencia_prova_minima"
  | "valor_sem_base_documental"
  | "atualizacao_apos_data_marco"
  | "possivel_duplicidade"
  | "uso_incorreto_selic"
  | "juros_apos_data_marco"
  | "inconsistencia_fato_gerador_regime"
  | "possivel_credito_ficticio";

export type GeneratedPieceKey =
  | "parecerTecnico"
  | "minutaPeticaoHabilitacao"
  | "minutaManifestacaoDivergencia"
  | "textoBaseDecisao"
  | "resumoExecutivo"
  | "relatorioInconsistencias";

export interface Credor {
  nome: string;
  documento: string;
}

export interface Processo {
  numero: string;
  empresaDevedora: string;
  tipo: ProcessType;
  varaComarca: string;
  administradorJudicial: string;
  observacoesIniciais: string;
}

export interface CaseIdentification {
  processo: Processo;
  credor: Credor;
}

export interface LegalRegimeData {
  regimeSelecionado: ProcessType | "";
  legislacaoAplicavel: string;
  diplomas: {
    dl7661: boolean;
    lei11101: boolean;
    lei14112: boolean;
  };
  observacaoJuridica: string;
}

export interface MilestoneData {
  dataPedidoRecuperacao: string;
  dataDecretacaoFalencia: string;
  dataMarcoConsiderada: string;
  justificativa: string;
}

export interface TriggeringEventData {
  tipoFatoGerador: string;
  dataFatoGerador: string;
  periodoFatoGerador: string;
  descricaoDetalhada: string;
  observacaoDiferencas: string;
}

export interface CreditNatureData {
  natureza: CreditNature | "";
  justificativaTecnica: string;
}

export interface CreditClassificationData {
  classificacao: CreditClassification | "";
  justificativaOutro: string;
}

export interface DocumentChecklistItem {
  tipo: DocumentType;
  titulo: string;
  apresentado: boolean;
  arquivoNome: string;
  arquivoTipo: string;
  arquivoTamanhoKb: number;
  observacao: string;
}

export interface DocumentAnalysisData {
  documentos: DocumentChecklistItem[];
  avaliacao: DocumentEvaluation | "";
}

export interface DuplicationCheckData {
  creditoJaListado: boolean | null;
  habilitacaoAnterior: boolean | null;
  divergenciaAnterior: boolean | null;
  valoresDivergentes: boolean | null;
  execucaoParalela: boolean | null;
  processoVinculado: string;
}

export interface EconomicCreditData {
  valorApresentadoCredor: number;
  dataBaseValorApresentado: string;
  indiceCorrecaoInformado: string;
  jurosInformados: string;
  multaInformada: string;
  honorariosInformados: string;
  valorJaPago: number;
}

export interface CalculationRulesData {
  valorOriginal: number;
  dataInicial: string;
  dataFinal: string;
  indiceInicial: number;
  indiceFinal: number;
  taxaJuros: number;
  numeroDias: number;
  multa: number;
  inssEmpregado: number;
  inssEmpregador: number;
  outrosDescontos: number;
}

export interface AutomaticFlag {
  chave: AutomaticFlagKey;
  titulo: string;
  ativa: boolean;
  detalhe: string;
}

export interface InconsistencyAnalysisData {
  flagsAutomaticas: AutomaticFlag[];
  riscoManual: RiskLevel | "";
  apontamentosManuais: string;
}

export interface TechnicalConclusionData {
  conclusao: ConclusionType | "";
  fundamentacaoResumida: string;
  fundamentoLegal: string;
  observacoesInternas: string;
  ajustesValor: string;
  documentosPendentes: string;
}

export interface GeneratedPieces {
  parecerTecnico: string;
  minutaPeticaoHabilitacao: string;
  minutaManifestacaoDivergencia: string;
  textoBaseDecisao: string;
  resumoExecutivo: string;
  relatorioInconsistencias: string;
}

export interface CalculationMemoryLine {
  titulo: string;
  formula: string;
  valor: string;
  destaque?: "positivo" | "negativo" | "neutro";
}

export interface CalculationResult {
  valorCorrigido: number;
  fatorCorrecao: number;
  correcaoMonetaria: number;
  houveDeflacao: boolean;
  deflacaoAplicada: number;
  dataFinalEfetiva: string;
  diasConsiderados: number;
  jurosAplicados: number;
  multaAplicada: number;
  subtotalAntesDeducoes: number;
  deducaoInssEmpregado: number;
  exclusaoInssEmpregador: number;
  descontosAdicionais: number;
  valorJaPago: number;
  valorFinal: number;
  selicBloqueouJurosSeparados: boolean;
  observacoes: string[];
  memoria: CalculationMemoryLine[];
}

export interface AnalysisFormData {
  id: string;
  createdAt: string;
  updatedAt: string;
  currentStep: number;
  identificacao: CaseIdentification;
  regimeBaseLegal: LegalRegimeData;
  dataMarco: MilestoneData;
  fatoGerador: TriggeringEventData;
  naturezaCredito: CreditNatureData;
  classificacaoCredito: CreditClassificationData;
  analiseDocumental: DocumentAnalysisData;
  verificacaoDuplicidade: DuplicationCheckData;
  dadosEconomicos: EconomicCreditData;
  regrasCalculo: CalculationRulesData;
  analiseInconsistencias: InconsistencyAnalysisData;
  conclusaoTecnica: TechnicalConclusionData;
  pecasGeradas: GeneratedPieces;
}

export interface AnalysisRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  data: AnalysisFormData;
}

export interface DashboardFilters {
  busca: string;
  regime: ProcessType | "todos";
  conclusao: ConclusionType | "todas";
  status: AnalysisStatus | "todos";
}
