import type {
  AnalysisFormData,
  AutomaticFlag,
  CalculationResult,
  GeneratedPieces,
} from "@/types/legal-analysis";
import {
  formatCurrency,
  formatDate,
  getConclusionLabel,
  getProcessTypeLabel,
  hasPotentialDuplication,
  toMultilineList,
} from "@/lib/legal-analysis/utils";

function getSelectedLaws(data: AnalysisFormData) {
  const labels: string[] = [];
  if (data.regimeBaseLegal.diplomas.dl7661) labels.push("DL 7.661/1945");
  if (data.regimeBaseLegal.diplomas.lei11101) labels.push("Lei 11.101/2005");
  if (data.regimeBaseLegal.diplomas.lei14112) labels.push("Lei 14.112/2020");
  return labels.join(", ") || data.regimeBaseLegal.legislacaoAplicavel;
}

function getDocumentSummary(data: AnalysisFormData) {
  const presented = data.analiseDocumental.documentos.filter(
    (documento) => documento.apresentado,
  );

  if (!presented.length) {
    return "Nenhum documento relevante foi assinalado como apresentado.";
  }

  return presented
    .map((documento) =>
      documento.observacao.trim()
        ? `${documento.titulo}: ${documento.observacao.trim()}`
        : documento.titulo,
    )
    .join("; ");
}

function getRiskSummary(flags: AutomaticFlag[]) {
  const active = flags.filter((flag) => flag.ativa);
  if (!active.length) {
    return "Não foram identificadas flags automáticas críticas na triagem atual.";
  }
  return active.map((flag) => `${flag.titulo}: ${flag.detalhe}`).join(" ");
}

export function generatePieces(
  data: AnalysisFormData,
  calculation: CalculationResult,
  flags: AutomaticFlag[],
): GeneratedPieces {
  const processType = getProcessTypeLabel(data.identificacao.processo.tipo);
  const selectedLaws = getSelectedLaws(data);
  const activeFlags = flags.filter((flag) => flag.ativa);
  const duplicationRisk = hasPotentialDuplication(data)
    ? "Há risco concreto de duplicidade, exigindo confronto com quadro, divergências e feitos paralelos."
    : "Não foram localizados elementos objetivos de duplicidade até o momento.";

  const parecerTecnico = `PARECER TÉCNICO DE ANÁLISE DE HABILITAÇÃO DE CRÉDITO

Processo nº ${data.identificacao.processo.numero}
Devedora: ${data.identificacao.processo.empresaDevedora}
Credor: ${data.identificacao.credor.nome}
Procedimento: ${processType}

I. Síntese da demanda
Submete-se à análise o crédito apresentado por ${data.identificacao.credor.nome}, inscrito sob ${data.identificacao.credor.documento}, no valor informado de ${formatCurrency(
    data.dadosEconomicos.valorApresentadoCredor,
  )}, com fundamento em ${data.fatoGerador.tipoFatoGerador.toLowerCase()}.

II. Regime jurídico e data marco
O caso está submetido ao regime de ${processType.toLowerCase()}, observando-se ${selectedLaws}. A data marco adotada foi ${formatDate(
    data.dataMarco.dataMarcoConsiderada,
  )}, conforme justificativa lançada: ${data.dataMarco.justificativa}.

III. Fato gerador e sujeição
O fato gerador foi descrito como ${data.fatoGerador.descricaoDetalhada}. Considerou-se que a natureza do crédito é ${data.naturezaCredito.natureza} e a classificação técnica indicada é ${data.classificacaoCredito.classificacao.replaceAll(
    "_",
    " ",
  )}. Registra-se a advertência metodológica de que a sujeição decorre do fato gerador, e não apenas da nota fiscal, do vencimento ou da sentença.

IV. Base documental
${getDocumentSummary(data)}
Avaliação documental: ${data.analiseDocumental.avaliacao}.

V. Verificações complementares
${duplicationRisk}
${getRiskSummary(flags)}

VI. Reapuração do valor
O recálculo técnico apurou valor líquido estimado em ${formatCurrency(
    calculation.valorFinal,
  )}, após correção monetária de ${formatCurrency(
    calculation.correcaoMonetaria,
  )}, juros limitados à data marco no montante de ${formatCurrency(
    calculation.jurosAplicados,
  )}, multa de ${formatCurrency(
    calculation.multaAplicada,
  )} e deduções legais/financeiras pertinentes. ${
    calculation.observacoes.join(" ") || "Não houve ressalvas adicionais na memória de cálculo."
  }

VII. Conclusão
Opina-se por ${getConclusionLabel(
    data.conclusaoTecnica.conclusao,
  ).toLowerCase()} o crédito, nos termos da fundamentação resumida: ${
    data.conclusaoTecnica.fundamentacaoResumida
  }. Fundamento legal indicado: ${data.conclusaoTecnica.fundamentoLegal}.`;

  const minutaPeticaoHabilitacao = `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ${data.identificacao.processo.varaComarca.toUpperCase()}

Processo nº ${data.identificacao.processo.numero}

${data.identificacao.credor.nome.toUpperCase()}, inscrito(a) sob ${data.identificacao.credor.documento}, por seu advogado, vem, respeitosamente, apresentar HABILITAÇÃO / DIVERGÊNCIA DE CRÉDITO, em face de ${data.identificacao.processo.empresaDevedora}, pelos fundamentos a seguir expostos.

1. O crédito decorre de ${data.fatoGerador.descricaoDetalhada.toLowerCase()}, fato gerador ocorrido em ${formatDate(
    data.fatoGerador.dataFatoGerador,
  )}, no período ${data.fatoGerador.periodoFatoGerador}.

2. À luz do regime de ${processType.toLowerCase()}, considera-se como data marco ${formatDate(
    data.dataMarco.dataMarcoConsiderada,
  )}, sendo necessária a apuração do crédito até esse limite temporal, sem aceitação automática do valor indicado pelo requerente.

3. A documentação apresentada compreende: ${getDocumentSummary(data)}.

4. O valor originalmente postulado foi de ${formatCurrency(
    data.dadosEconomicos.valorApresentadoCredor,
  )}, mas o recálculo técnico conduzido em conformidade com os critérios jurídicos aplicáveis indica montante de ${formatCurrency(
    calculation.valorFinal,
  )}, observando-se correção monetária, limitação de juros, vedação de cumulação indevida da SELIC e deduções cabíveis.

5. Diante disso, requer-se o recebimento da presente manifestação para que o crédito seja ${getConclusionLabel(
    data.conclusaoTecnica.conclusao,
  ).toLowerCase()}, com enquadramento em ${data.classificacaoCredito.classificacao.replaceAll(
    "_",
    " ",
  )}, no valor de ${formatCurrency(calculation.valorFinal)}.

Termos em que,
Pede deferimento.`;

  const minutaManifestacaoDivergencia = `MANIFESTAÇÃO TÉCNICA EM DIVERGÊNCIA / HABILITAÇÃO DE CRÉDITO

1. Em atenção ao expediente apresentado por ${data.identificacao.credor.nome}, procede-se à conferência técnica do crédito informado contra ${data.identificacao.processo.empresaDevedora}.

2. O exame observa, em ordem lógica obrigatória, o fato gerador, a data marco, a natureza do crédito, a classificação jurídica, a suficiência documental, a inexistência de duplicidade e o recálculo do valor.

3. No caso concreto, a data marco considerada é ${formatDate(
    data.dataMarco.dataMarcoConsiderada,
  )}. O crédito foi tratado como ${data.naturezaCredito.natureza} e classificado como ${data.classificacaoCredito.classificacao.replaceAll(
    "_",
    " ",
  )}.

4. A documentação foi qualificada como ${data.analiseDocumental.avaliacao}. ${duplicationRisk}

5. O valor indicado pelo credor (${formatCurrency(
    data.dadosEconomicos.valorApresentadoCredor,
  )}) não foi acolhido automaticamente. Após recálculo, chegou-se ao montante de ${formatCurrency(
    calculation.valorFinal,
  )}. ${calculation.observacoes.join(" ")}

6. Assim, a equipe técnica manifesta-se por ${getConclusionLabel(
    data.conclusaoTecnica.conclusao,
  ).toLowerCase()}, nos termos da fundamentação constante dos autos internos.`;

  const textoBaseDecisao = `DECISÃO INTERNA - ANÁLISE DE HABILITAÇÃO DE CRÉDITO

Vistos.

Trata-se de análise interna do pedido formulado por ${data.identificacao.credor.nome}, em face de ${data.identificacao.processo.empresaDevedora}, no contexto do processo nº ${data.identificacao.processo.numero}.

Considerando o regime de ${processType.toLowerCase()}, a data marco de ${formatDate(
    data.dataMarco.dataMarcoConsiderada,
  )}, o fato gerador descrito, a classificação do crédito, a documentação apresentada e o recálculo técnico produzido, conclui-se que o pedido deve ser ${getConclusionLabel(
    data.conclusaoTecnica.conclusao,
  ).toLowerCase()}.

Fundamentação resumida: ${data.conclusaoTecnica.fundamentacaoResumida}
Fundamento legal: ${data.conclusaoTecnica.fundamentoLegal}
Valor técnico apurado: ${formatCurrency(calculation.valorFinal)}

Determino o encaminhamento da minuta correspondente e o registro interno da conclusão, observadas as pendências documentais remanescentes: ${
    data.conclusaoTecnica.documentosPendentes || "sem pendências formais apontadas."
  }`;

  const resumoExecutivo = `RESUMO EXECUTIVO

Credor: ${data.identificacao.credor.nome}
Processo: ${data.identificacao.processo.numero}
Regime: ${processType}
Data marco: ${formatDate(data.dataMarco.dataMarcoConsiderada)}
Natureza: ${data.naturezaCredito.natureza}
Classificação: ${data.classificacaoCredito.classificacao.replaceAll("_", " ")}
Conclusão: ${getConclusionLabel(data.conclusaoTecnica.conclusao)}

Valor apresentado: ${formatCurrency(data.dadosEconomicos.valorApresentadoCredor)}
Valor técnico apurado: ${formatCurrency(calculation.valorFinal)}

Pontos críticos:
${toMultilineList(activeFlags.map((flag) => flag.titulo))}

Observação conclusiva:
${data.conclusaoTecnica.fundamentacaoResumida}`;

  const relatorioInconsistencias = `RELATÓRIO DE INCONSISTÊNCIAS

Flags automáticas ativas:
${toMultilineList(
    activeFlags.length
      ? activeFlags.map((flag) => `${flag.titulo} - ${flag.detalhe}`)
      : ["Nenhuma inconsistência automática crítica foi ativada."],
  )}

Classificação de risco manual: ${data.analiseInconsistencias.riscoManual || "Não informado"}

Apontamentos manuais:
${data.analiseInconsistencias.apontamentosManuais || "Sem apontamentos adicionais."}

Pendências e ajustes:
${data.conclusaoTecnica.ajustesValor || "Sem ajustes adicionais lançados."}
${data.conclusaoTecnica.documentosPendentes || "Sem documentos pendentes cadastrados."}`;

  return {
    parecerTecnico,
    minutaPeticaoHabilitacao,
    minutaManifestacaoDivergencia,
    textoBaseDecisao,
    resumoExecutivo,
    relatorioInconsistencias,
  };
}
