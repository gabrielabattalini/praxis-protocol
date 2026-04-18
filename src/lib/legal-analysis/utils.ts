import type {
  AnalysisFormData,
  AnalysisRecord,
  AnalysisStatus,
  AutomaticFlag,
  CalculationResult,
  ConclusionType,
  ProcessType,
} from "@/types/legal-analysis";
import { processTypeLabels, wizardSteps } from "@/lib/legal-analysis/constants";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatNumber(value: number, fractionDigits = 2) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatDate(date: string) {
  if (!date) return "Não informado";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("pt-BR").format(parsed);
}

export function formatDateTime(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

export function getProcessTypeLabel(value: ProcessType) {
  return processTypeLabels[value];
}

export function getConclusionLabel(value: ConclusionType | "") {
  if (value === "deferir") return "Deferir";
  if (value === "deferir_parcialmente") return "Deferir parcialmente";
  if (value === "indeferir") return "Indeferir";
  return "Sem conclusão";
}

export function getStatusLabel(value: AnalysisStatus) {
  if (value === "pendente") return "Pendente";
  if (value === "em_andamento") return "Em andamento";
  return "Concluída";
}

export function getCaseTitle(data: AnalysisFormData) {
  const credor = data.identificacao.credor.nome || "Credor não identificado";
  const devedora =
    data.identificacao.processo.empresaDevedora || "devedora não informada";
  return `${credor} x ${devedora}`;
}

export function getCaseSubtitle(data: AnalysisFormData) {
  const processNumber =
    data.identificacao.processo.numero || "Processo sem numeração";
  return `${processNumber} · ${getProcessTypeLabel(
    data.identificacao.processo.tipo,
  )}`;
}

export function deriveStatus(data: AnalysisFormData): AnalysisStatus {
  if (data.conclusaoTecnica.conclusao) return "concluida";
  if (data.currentStep > 0) return "em_andamento";
  return "pendente";
}

export function getCompletionRatio(data: AnalysisFormData) {
  return Math.max(
    0,
    Math.min(100, ((data.currentStep + 1) / wizardSteps.length) * 100),
  );
}

export function parseDate(value: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function diffInDays(startDate: string, endDate: string) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return 0;
  const milliseconds = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(milliseconds / 86_400_000));
}

export function clampStep(value: number) {
  return Math.max(0, Math.min(wizardSteps.length - 1, value));
}

export function hasPotentialDuplication(data: AnalysisFormData) {
  const duplication = data.verificacaoDuplicidade;
  return Boolean(
    duplication.creditoJaListado ||
    duplication.habilitacaoAnterior ||
    duplication.divergenciaAnterior ||
    duplication.valoresDivergentes ||
    duplication.execucaoParalela,
  );
}

export function detectSelic(indexLabel: string, jurosLabel: string) {
  const token = `${indexLabel} ${jurosLabel}`.toLowerCase();
  return token.includes("selic");
}

export function buildAutomaticFlags(
  data: AnalysisFormData,
  calculation: CalculationResult,
): AutomaticFlag[] {
  const presentedDocuments = data.analiseDocumental.documentos.filter(
    (documento) => documento.apresentado,
  );
  const hasMinimumProof = presentedDocuments.length > 0;
  const hasCoreDocument = presentedDocuments.some((documento) =>
    ["contrato", "nota_fiscal", "sentenca", "calculos_homologados", "ctps"].includes(
      documento.tipo,
    ),
  );
  const marco = parseDate(data.dataMarco.dataMarcoConsiderada);
  const dataBase = parseDate(data.dadosEconomicos.dataBaseValorApresentado);
  const dataFinalCalculo = parseDate(data.regrasCalculo.dataFinal);
  const fatoGerador = parseDate(data.fatoGerador.dataFatoGerador);
  const selic = detectSelic(
    data.dadosEconomicos.indiceCorrecaoInformado,
    data.dadosEconomicos.jurosInformados,
  );
  const isConcursal = data.naturezaCredito.natureza === "concursal";
  const mismatchConcursal =
    !!marco &&
    !!fatoGerador &&
    ((isConcursal && fatoGerador > marco) ||
      (!isConcursal && fatoGerador <= marco));

  return [
    {
      chave: "ausencia_prova_minima",
      titulo: "Ausência de prova mínima",
      ativa:
        !hasMinimumProof ||
        data.analiseDocumental.avaliacao === "insuficiente" ||
        data.analiseDocumental.avaliacao === "contraditoria",
      detalhe:
        "A instrução não apresenta lastro mínimo robusto ou foi classificada como insuficiente/contraditória.",
    },
    {
      chave: "valor_sem_base_documental",
      titulo: "Valor sem base documental",
      ativa:
        data.dadosEconomicos.valorApresentadoCredor > 0 && !hasCoreDocument,
      detalhe:
        "O valor exigido não está adequadamente ancorado em contrato, título, nota fiscal, sentença ou cálculo homologado.",
    },
    {
      chave: "atualizacao_apos_data_marco",
      titulo: "Atualização além da data marco",
      ativa:
        (!!marco && !!dataBase && dataBase > marco) ||
        (!!marco && !!dataFinalCalculo && dataFinalCalculo > marco),
      detalhe:
        "Há indício de atualização posterior à data marco, exigindo deflação ou revisão técnica.",
    },
    {
      chave: "possivel_duplicidade",
      titulo: "Possível duplicidade",
      ativa: hasPotentialDuplication(data),
      detalhe:
        "Foram identificados indícios de listagem prévia, habilitação/divergência anterior ou execução paralela.",
    },
    {
      chave: "uso_incorreto_selic",
      titulo: "Uso incorreto de SELIC",
      ativa: selic && data.regrasCalculo.taxaJuros > 0,
      detalhe:
        "A SELIC já incorpora juros e correção; sua cumulação com juros apartados deve ser bloqueada.",
    },
    {
      chave: "juros_apos_data_marco",
      titulo: "Juros além da data marco",
      ativa:
        calculation.diasConsiderados < data.regrasCalculo.numeroDias &&
        data.regrasCalculo.taxaJuros > 0,
      detalhe:
        "A memória indica necessidade de limitação dos juros à data marco do processo.",
    },
    {
      chave: "inconsistencia_fato_gerador_regime",
      titulo: "Inconsistência entre fato gerador e regime",
      ativa: mismatchConcursal,
      detalhe:
        "A data do fato gerador não conversa com a natureza atribuída ao crédito em relação à data marco.",
    },
    {
      chave: "possivel_credito_ficticio",
      titulo: "Possível crédito fictício",
      ativa:
        !hasCoreDocument &&
        !data.fatoGerador.descricaoDetalhada.trim() &&
        !data.verificacaoDuplicidade.processoVinculado.trim(),
      detalhe:
        "A narrativa fática, o lastro probatório e os vínculos processuais são insuficientes para conferir plausibilidade plena ao crédito.",
    },
  ];
}

export function buildAnalysisRecord(data: AnalysisFormData): AnalysisRecord {
  return {
    id: data.id,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    data,
  };
}

export function downloadTextFile(
  fileName: string,
  content: string,
  mimeType = "text/plain;charset=utf-8",
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function toMultilineList(lines: string[]) {
  return lines.filter(Boolean).map((line) => `- ${line}`).join("\n");
}
