import type { AnalysisFormData, CalculationResult } from "@/types/legal-analysis";
import {
  detectSelic,
  diffInDays,
  formatCurrency,
  formatDate,
  formatNumber,
  parseDate,
} from "@/lib/legal-analysis/utils";

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateCredit(data: AnalysisFormData): CalculationResult {
  const calculation = data.regrasCalculo;
  const marco = parseDate(data.dataMarco.dataMarcoConsiderada);
  const declaredEndDate = parseDate(calculation.dataFinal);
  const effectiveEndDate =
    marco && declaredEndDate && declaredEndDate > marco
      ? data.dataMarco.dataMarcoConsiderada
      : calculation.dataFinal;

  const effectiveDays =
    calculation.numeroDias > 0
      ? Math.min(
          calculation.numeroDias,
          diffInDays(calculation.dataInicial, effectiveEndDate),
        ) || calculation.numeroDias
      : diffInDays(calculation.dataInicial, effectiveEndDate);

  const rawFactor =
    calculation.indiceInicial > 0
      ? calculation.indiceFinal / calculation.indiceInicial
      : 1;
  const factor = Number.isFinite(rawFactor) && rawFactor > 0 ? rawFactor : 1;
  const correctionAmount = round(calculation.valorOriginal * (factor - 1));
  const correctedValue = round(calculation.valorOriginal + correctionAmount);
  const deflation = factor < 1 ? round(Math.abs(correctionAmount)) : 0;

  const selicDetected = detectSelic(
    data.dadosEconomicos.indiceCorrecaoInformado,
    data.dadosEconomicos.jurosInformados,
  );
  const separatedInterestRate = selicDetected ? 0 : calculation.taxaJuros;
  const interestAmount = round(
    correctedValue * (separatedInterestRate / 100) * (effectiveDays / 30),
  );
  const fineAmount = round(calculation.valorOriginal * (calculation.multa / 100));
  const subtotal = round(correctedValue + interestAmount + fineAmount);
  const employeeDeduction = round(
    subtotal * (calculation.inssEmpregado / 100),
  );
  const employerExclusion =
    data.classificacaoCredito.classificacao === "trabalhista"
      ? round(subtotal * (calculation.inssEmpregador / 100))
      : 0;
  const additionalDiscounts = round(calculation.outrosDescontos);
  const paidValue = round(data.dadosEconomicos.valorJaPago);
  const finalValue = round(
    subtotal -
      employeeDeduction -
      employerExclusion -
      additionalDiscounts -
      paidValue,
  );
  const observations: string[] = [];

  if (selicDetected && calculation.taxaJuros > 0) {
    observations.push(
      "SELIC identificada na base informada; os juros autônomos foram zerados para evitar cumulação indevida.",
    );
  }

  if (marco && declaredEndDate && declaredEndDate > marco) {
    observations.push(
      `A data final do cálculo foi limitada à data marco (${formatDate(
        data.dataMarco.dataMarcoConsiderada,
      )}).`,
    );
  }

  if (deflation > 0) {
    observations.push(
      "Foi aplicada deflação porque o índice final informado é inferior ao índice inicial considerado.",
    );
  }

  if (employerExclusion > 0) {
    observations.push(
      "O INSS patronal foi excluído do crédito do trabalhador, em observância à natureza da verba.",
    );
  }

  return {
    valorCorrigido: correctedValue,
    fatorCorrecao: factor,
    correcaoMonetaria: correctionAmount,
    houveDeflacao: deflation > 0,
    deflacaoAplicada: deflation,
    dataFinalEfetiva: effectiveEndDate,
    diasConsiderados: effectiveDays,
    jurosAplicados: interestAmount,
    multaAplicada: fineAmount,
    subtotalAntesDeducoes: subtotal,
    deducaoInssEmpregado: employeeDeduction,
    exclusaoInssEmpregador: employerExclusion,
    descontosAdicionais: additionalDiscounts,
    valorJaPago: paidValue,
    valorFinal: round(Math.max(0, finalValue)),
    selicBloqueouJurosSeparados: selicDetected && calculation.taxaJuros > 0,
    observacoes: observations,
    memoria: [
      {
        titulo: "Valor original",
        formula: "Base declarada para recálculo",
        valor: formatCurrency(calculation.valorOriginal),
        destaque: "neutro",
      },
      {
        titulo: "Correção monetária",
        formula: `${formatNumber(calculation.indiceFinal, 4)} / ${formatNumber(
          calculation.indiceInicial,
          4,
        )} = fator ${formatNumber(factor, 6)}`,
        valor: formatCurrency(correctionAmount),
        destaque: correctionAmount >= 0 ? "positivo" : "negativo",
      },
      {
        titulo: "Juros limitados à data marco",
        formula: `${formatNumber(separatedInterestRate)}% a.m. x ${effectiveDays} dias`,
        valor: formatCurrency(interestAmount),
        destaque: interestAmount > 0 ? "positivo" : "neutro",
      },
      {
        titulo: "Multa",
        formula: `${formatNumber(calculation.multa)}% sobre o valor original`,
        valor: formatCurrency(fineAmount),
        destaque: fineAmount > 0 ? "positivo" : "neutro",
      },
      {
        titulo: "INSS empregado",
        formula: `${formatNumber(calculation.inssEmpregado)}% sobre o subtotal`,
        valor: formatCurrency(-employeeDeduction),
        destaque: employeeDeduction > 0 ? "negativo" : "neutro",
      },
      {
        titulo: "INSS empregador excluído",
        formula:
          data.classificacaoCredito.classificacao === "trabalhista"
            ? `${formatNumber(calculation.inssEmpregador)}% excluído do crédito`
            : "Não aplicável à classificação atual",
        valor: formatCurrency(-employerExclusion),
        destaque: employerExclusion > 0 ? "negativo" : "neutro",
      },
      {
        titulo: "Outros descontos e pagamentos",
        formula: "Pagamentos parciais e abatimentos identificados",
        valor: formatCurrency(-(additionalDiscounts + paidValue)),
        destaque:
          additionalDiscounts + paidValue > 0 ? "negativo" : "neutro",
      },
      {
        titulo: "Valor final líquido",
        formula: `Data final efetiva: ${formatDate(effectiveEndDate)}`,
        valor: formatCurrency(Math.max(0, finalValue)),
        destaque: "positivo",
      },
    ],
  };
}
