"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useCallback, useDeferredValue, useEffect, useState } from "react";
import {
  useForm,
  useWatch,
  type FieldErrors,
  type Resolver,
} from "react-hook-form";
import {
  StatusPill,
} from "@/components/legal-analysis/ui";
import {
  createEmptyAnalysis,
  pieceTabs,
  stepFieldMap,
  wizardSteps,
} from "@/lib/legal-analysis/constants";
import { calculateCredit } from "@/lib/legal-analysis/calculation";
import { buildDossierHtmlDocument } from "@/lib/legal-analysis/dossier-html";
import { generatePieces } from "@/lib/legal-analysis/generation";
import { localAnalysisRepository } from "@/lib/legal-analysis/repository";
import { creditAnalysisSchema } from "@/lib/legal-analysis/schema";
import {
  buildAutomaticFlags,
  clampStep,
  cn,
  deriveStatus,
  downloadTextFile,
  formatCurrency,
  formatDateTime,
  formatNumber,
  getCaseSubtitle,
  getCaseTitle,
  getCompletionRatio,
  getStatusLabel,
  hasPotentialDuplication,
} from "@/lib/legal-analysis/utils";
import type {
  AnalysisFormData,
  AnalysisStatus,
  DashboardFilters,
  GeneratedPieceKey,
} from "@/types/legal-analysis";

function getErrorMessage(errors: FieldErrors<AnalysisFormData>, path: string) {
  const value = path.split(".").reduce<unknown>((accumulator, segment) => {
    if (!accumulator || typeof accumulator !== "object") return undefined;
    return (accumulator as Record<string, unknown>)[segment];
  }, errors);

  if (
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return value.message;
  }

  return undefined;
}

function getStatusTone(status: AnalysisStatus) {
  if (status === "concluida") return "success" as const;
  if (status === "em_andamento") return "warning" as const;
  return "info" as const;
}

function enrichAnalysis(data: AnalysisFormData) {
  const calculation = calculateCredit(data);
  const flags = buildAutomaticFlags(data, calculation);
  const nextData = {
    ...data,
    analiseInconsistencias: {
      ...data.analiseInconsistencias,
      flagsAutomaticas: flags,
    },
  };

  return {
    ...nextData,
    pecasGeradas: generatePieces(nextData, calculation, flags),
  };
}

function duplicationAnswered(data: AnalysisFormData) {
  const duplication = data.verificacaoDuplicidade;
  return [
    duplication.creditoJaListado,
    duplication.habilitacaoAnterior,
    duplication.divergenciaAnterior,
    duplication.valoresDivergentes,
    duplication.execucaoParalela,
  ].every((value) => value !== null);
}

function stepCompleted(stepIndex: number, data: AnalysisFormData) {
  switch (stepIndex) {
    case 0:
      return (
        data.identificacao.processo.numero.trim().length > 0 &&
        data.identificacao.processo.empresaDevedora.trim().length > 0 &&
        data.identificacao.credor.nome.trim().length > 0 &&
        data.identificacao.credor.documento.replace(/\D/g, "").length >= 11 &&
        data.identificacao.processo.varaComarca.trim().length > 0 &&
        data.identificacao.processo.administradorJudicial.trim().length > 0
      );
    case 1:
      return (
        data.regimeBaseLegal.legislacaoAplicavel.trim().length > 0 &&
        Object.values(data.regimeBaseLegal.diplomas).some(Boolean)
      );
    case 2:
      return (
        data.dataMarco.dataMarcoConsiderada.trim().length > 0 &&
        data.dataMarco.justificativa.trim().length > 0 &&
        (data.identificacao.processo.tipo === "recuperacao_judicial"
          ? data.dataMarco.dataPedidoRecuperacao.trim().length > 0
          : data.dataMarco.dataDecretacaoFalencia.trim().length > 0)
      );
    case 3:
      return (
        data.fatoGerador.tipoFatoGerador.trim().length > 0 &&
        data.fatoGerador.dataFatoGerador.trim().length > 0 &&
        data.fatoGerador.periodoFatoGerador.trim().length > 0 &&
        data.fatoGerador.descricaoDetalhada.trim().length > 0
      );
    case 4:
      return (
        !!data.naturezaCredito.natureza &&
        data.naturezaCredito.justificativaTecnica.trim().length > 0
      );
    case 5:
      return (
        !!data.classificacaoCredito.classificacao &&
        (data.classificacaoCredito.classificacao !== "outro" ||
          data.classificacaoCredito.justificativaOutro.trim().length > 0)
      );
    case 6:
      return (
        !!data.analiseDocumental.avaliacao &&
        data.analiseDocumental.documentos.some((documento) => documento.apresentado)
      );
    case 7:
      return duplicationAnswered(data);
    case 8:
      return (
        data.dadosEconomicos.valorApresentadoCredor > 0 &&
        data.dadosEconomicos.dataBaseValorApresentado.trim().length > 0 &&
        data.dadosEconomicos.indiceCorrecaoInformado.trim().length > 0
      );
    case 9:
      return (
        data.regrasCalculo.valorOriginal > 0 &&
        data.regrasCalculo.dataInicial.trim().length > 0 &&
        data.regrasCalculo.dataFinal.trim().length > 0 &&
        data.regrasCalculo.indiceInicial > 0 &&
        data.regrasCalculo.indiceFinal > 0
      );
    case 10:
      return !!data.analiseInconsistencias.riscoManual;
    case 11:
      return (
        !!data.conclusaoTecnica.conclusao &&
        data.conclusaoTecnica.fundamentacaoResumida.trim().length > 0 &&
        data.conclusaoTecnica.fundamentoLegal.trim().length > 0
      );
    case 12:
      return !!data.pecasGeradas.parecerTecnico;
    default:
      return false;
  }
}

function getUnlockedStep(data: AnalysisFormData) {
  let unlocked = 0;
  for (let index = 0; index < wizardSteps.length - 1; index += 1) {
    if (stepCompleted(index, data)) {
      unlocked = Math.min(wizardSteps.length - 1, index + 1);
      continue;
    }
    break;
  }
  return unlocked;
}

function buildDossierText(data: AnalysisFormData) {
  return [
    getCaseTitle(data),
    getCaseSubtitle(data),
    "",
    ...pieceTabs.flatMap((tab) => [tab.label.toUpperCase(), "", data.pecasGeradas[tab.key], "", ""]),
  ].join("\n");
}

function buildDossierHtml(data: AnalysisFormData) {
  return buildDossierHtmlDocument({
    title: getCaseTitle(data),
    subtitle: getCaseSubtitle(data),
    sections: pieceTabs.map((tab) => ({
      label: tab.label,
      content: data.pecasGeradas[tab.key],
    })),
  });
}

async function exportPdf(title: string, body: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  pdf.setFont("times", "normal");
  pdf.setFontSize(12);
  const lines = pdf.splitTextToSize(body, 500);
  let y = 56;
  pdf.setFont("times", "bold");
  pdf.setFontSize(16);
  pdf.text(title, 48, y);
  y += 28;
  pdf.setFont("times", "normal");
  pdf.setFontSize(12);

  lines.forEach((line: string) => {
    if (y > 780) {
      pdf.addPage();
      y = 56;
    }
    pdf.text(line, 48, y);
    y += 16;
  });

  pdf.save(`${title.toLowerCase().replaceAll(" ", "-")}.pdf`);
}

export function LegalCreditWorkbench() {
  const [analyses, setAnalyses] = useState<AnalysisFormData[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [activePreviewTab, setActivePreviewTab] =
    useState<GeneratedPieceKey>("parecerTecnico");
  const [hydrated, setHydrated] = useState(false);
  const [stepNotice, setStepNotice] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [filters, setFilters] = useState<DashboardFilters>({
    busca: "",
    regime: "todos",
    conclusao: "todas",
    status: "todos",
  });

  const deferredSearch = useDeferredValue(filters.busca);
  const form = useForm<AnalysisFormData>({
    resolver: zodResolver(creditAnalysisSchema) as Resolver<AnalysisFormData>,
    defaultValues: createEmptyAnalysis(),
    mode: "onBlur",
  });

  const {
    control,
    formState: { errors },
    getValues,
    register,
    reset,
    setValue,
    trigger,
  } = form;
  const watchedData = useWatch({ control }) as AnalysisFormData;
  const watchedProcessType = useWatch({
    control,
    name: "identificacao.processo.tipo",
  });
  const watchedPedidoRJ = useWatch({
    control,
    name: "dataMarco.dataPedidoRecuperacao",
  });
  const watchedFalencia = useWatch({
    control,
    name: "dataMarco.dataDecretacaoFalencia",
  });

  const pushNotice = useCallback((message: string) => {
    setActionNotice(message);
    window.clearTimeout((window as Window & { __noticeTimer?: number }).__noticeTimer);
    (window as Window & { __noticeTimer?: number }).__noticeTimer = window.setTimeout(
      () => setActionNotice(""),
      2200,
    );
  }, []);

  const persistSelected = useCallback((payload: AnalysisFormData) => {
    const enriched = enrichAnalysis({
      ...payload,
      currentStep,
      updatedAt: new Date().toISOString(),
    });

    setAnalyses((current) => {
      const exists = current.some((item) => item.id === enriched.id);
      const next = exists
        ? current.map((item) => (item.id === enriched.id ? enriched : item))
        : [enriched, ...current];
      localAnalysisRepository.save(next);
      return next;
    });
  }, [currentStep]);

  useEffect(() => {
    const loaded = localAnalysisRepository.load().map(enrichAnalysis);
    const first = loaded[0] ?? enrichAnalysis(createEmptyAnalysis());
    setAnalyses(loaded);
    setSelectedId(first.id);
    setCurrentStep(clampStep(first.currentStep));
    reset(first);
    setHydrated(true);
  }, [reset]);

  useEffect(() => {
    if (!hydrated) return;
    const selected = analyses.find((analysis) => analysis.id === selectedId);
    if (!selected || selected.id === watchedData?.id) return;

    startTransition(() => {
      setCurrentStep(clampStep(selected.currentStep));
      reset(selected);
    });
  }, [analyses, hydrated, reset, selectedId, watchedData?.id]);

  useEffect(() => {
    if (!hydrated || !watchedData?.id) return;
    const timer = window.setTimeout(() => {
      persistSelected({
        ...watchedData,
        currentStep,
      });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [currentStep, hydrated, persistSelected, watchedData]);

  useEffect(() => {
    if (!watchedProcessType) return;
    setValue("regimeBaseLegal.regimeSelecionado", watchedProcessType, {
      shouldDirty: true,
    });
  }, [setValue, watchedProcessType]);

  useEffect(() => {
    const currentMilestone = getValues("dataMarco.dataMarcoConsiderada");
    const preferred =
      watchedProcessType === "recuperacao_judicial"
        ? watchedPedidoRJ
        : watchedFalencia;
    const alternate =
      watchedProcessType === "recuperacao_judicial"
        ? watchedFalencia
        : watchedPedidoRJ;

    if (preferred && (!currentMilestone || currentMilestone === alternate)) {
      setValue("dataMarco.dataMarcoConsiderada", preferred, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [
    getValues,
    setValue,
    watchedFalencia,
    watchedPedidoRJ,
    watchedProcessType,
  ]);

  const activeAnalysis = enrichAnalysis({
    ...(watchedData?.id ? watchedData : createEmptyAnalysis()),
    currentStep,
  });
  const calculation = calculateCredit(activeAnalysis);
  const activeFlags = activeAnalysis.analiseInconsistencias.flagsAutomaticas.filter(
    (flag) => flag.ativa,
  );
  const unlockedStep = getUnlockedStep(activeAnalysis);
  const progress = getCompletionRatio(activeAnalysis);

  const analysisSummaries = analyses.map((analysis) => {
    const enriched = enrichAnalysis(analysis);
    const result = calculateCredit(enriched);
    return {
      data: enriched,
      amount: result.valorFinal,
      status: deriveStatus(enriched),
      completion: getCompletionRatio(enriched),
      title: getCaseTitle(enriched),
      subtitle: getCaseSubtitle(enriched),
      riskCount: enriched.analiseInconsistencias.flagsAutomaticas.filter(
        (flag) => flag.ativa,
      ).length,
    };
  });

  const filteredAnalyses = analysisSummaries.filter((summary) => {
    const haystack = `${summary.title} ${summary.subtitle}`.toLowerCase();
    const matchesSearch = haystack.includes(deferredSearch.toLowerCase());
    const matchesRegime =
      filters.regime === "todos" ||
      summary.data.identificacao.processo.tipo === filters.regime;
    const matchesConclusion =
      filters.conclusao === "todas" ||
      summary.data.conclusaoTecnica.conclusao === filters.conclusao;
    const matchesStatus =
      filters.status === "todos" || summary.status === filters.status;
    return matchesSearch && matchesRegime && matchesConclusion && matchesStatus;
  });

  const currentPiece = activeAnalysis.pecasGeradas[activePreviewTab];
  const totalValueUnderReview = analysisSummaries.reduce(
    (accumulator, summary) => accumulator + summary.amount,
    0,
  );

  async function validateCurrentStep() {
    setStepNotice("");
    const fieldNames = stepFieldMap[currentStep];
    const baseValid = fieldNames.length
      ? await trigger(fieldNames as never[], { shouldFocus: true })
      : true;
    const snapshot = getValues();

    if (currentStep === 1 && !Object.values(snapshot.regimeBaseLegal.diplomas).some(Boolean)) {
      setStepNotice("Selecione ao menos um diploma legal aplicável.");
      return false;
    }

    if (
      currentStep === 6 &&
      !snapshot.analiseDocumental.documentos.some((documento) => documento.apresentado)
    ) {
      setStepNotice(
        "Assinale ao menos um documento apresentado para concluir a triagem documental.",
      );
      return false;
    }

    if (currentStep === 7 && !duplicationAnswered(snapshot)) {
      setStepNotice("Responda todos os itens da verificação de duplicidade.");
      return false;
    }

    return baseValid;
  }

  async function goToNextStep() {
    if (currentStep >= wizardSteps.length - 1) return;
    const valid = await validateCurrentStep();
    if (!valid) return;
    const nextStep = clampStep(currentStep + 1);
    setCurrentStep(nextStep);
    setValue("currentStep", nextStep, { shouldDirty: true });
  }

  function goToPreviousStep() {
    const previousStep = clampStep(currentStep - 1);
    setCurrentStep(previousStep);
    setValue("currentStep", previousStep, { shouldDirty: true });
  }

  function openAnalysis(analysis: AnalysisFormData) {
    startTransition(() => {
      setSelectedId(analysis.id);
      setCurrentStep(clampStep(analysis.currentStep));
      reset(enrichAnalysis(analysis));
      setStepNotice("");
    });
  }

  function createAnalysis() {
    const next = enrichAnalysis(createEmptyAnalysis());
    setAnalyses((current) => {
      const collection = [next, ...current];
      localAnalysisRepository.save(collection);
      return collection;
    });
    openAnalysis(next);
    pushNotice("Nova análise criada e salva localmente.");
  }

  function saveNow() {
    persistSelected(getValues());
    pushNotice("Análise salva localmente.");
  }

  function copyText(text: string, label: string) {
    void navigator.clipboard.writeText(text);
    pushNotice(`${label} copiado.`);
  }

  async function exportCurrentPdf() {
    await exportPdf(getCaseTitle(activeAnalysis), buildDossierText(activeAnalysis));
    pushNotice("PDF exportado.");
  }

  function exportCurrentWord() {
    downloadTextFile(
      `${getCaseTitle(activeAnalysis).toLowerCase().replaceAll(" ", "-")}.doc`,
      buildDossierHtml(activeAnalysis),
      "application/msword;charset=utf-8",
    );
    pushNotice("Arquivo Word exportado.");
  }

  function printCurrentPreview() {
    const printer = window.open("", "_blank", "noopener,noreferrer,width=960,height=720");
    if (!printer) return;
    printer.document.write(buildDossierHtml(activeAnalysis));
    printer.document.close();
    printer.focus();
    printer.print();
  }

  function setDocumentUpload(index: number, file: File | undefined) {
    if (!file) return;
    setValue(`analiseDocumental.documentos.${index}.arquivoNome`, file.name, {
      shouldDirty: true,
    });
    setValue(`analiseDocumental.documentos.${index}.arquivoTipo`, file.type, {
      shouldDirty: true,
    });
    setValue(
      `analiseDocumental.documentos.${index}.arquivoTamanhoKb`,
      Math.round(file.size / 1024),
      {
        shouldDirty: true,
      },
    );
    setValue(`analiseDocumental.documentos.${index}.apresentado`, true, {
      shouldDirty: true,
    });
  }

  const selectedStep = wizardSteps[currentStep];
  const sidebarTitle = getCaseTitle(activeAnalysis);
  const sidebarSubtitle = getCaseSubtitle(activeAnalysis);

  return <div />;
}
