import { z } from "zod";

const cpfCnpjSchema = z
  .string()
  .trim()
  .min(1, "Informe o CPF ou CNPJ do credor.")
  .refine((value) => value.replace(/\D/g, "").match(/^(\d{11}|\d{14})$/), {
    message: "Informe um CPF ou CNPJ válido.",
  });

const nonEmptyString = (message: string) => z.string().trim().min(1, message);

const nonNegativeNumber = (message: string) =>
  z.coerce.number().min(0, message);

export const creditAnalysisSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  currentStep: z.number().min(0).max(12),
  identificacao: z.object({
    processo: z.object({
      numero: nonEmptyString("Informe o número do processo."),
      empresaDevedora: nonEmptyString("Informe o nome da empresa devedora."),
      tipo: z.enum(["recuperacao_judicial", "falencia"]),
      varaComarca: nonEmptyString("Informe a vara ou comarca."),
      administradorJudicial: nonEmptyString(
        "Informe o administrador judicial.",
      ),
      observacoesIniciais: z.string(),
    }),
    credor: z.object({
      nome: nonEmptyString("Informe o nome do credor."),
      documento: cpfCnpjSchema,
    }),
  }),
  regimeBaseLegal: z.object({
    regimeSelecionado: z.enum(["recuperacao_judicial", "falencia"]),
    legislacaoAplicavel: nonEmptyString("Informe a legislação aplicável."),
    diplomas: z.object({
      dl7661: z.boolean(),
      lei11101: z.boolean(),
      lei14112: z.boolean(),
    }),
    observacaoJuridica: z.string(),
  }),
  dataMarco: z.object({
    dataPedidoRecuperacao: z.string(),
    dataDecretacaoFalencia: z.string(),
    dataMarcoConsiderada: nonEmptyString("Informe a data marco considerada."),
    justificativa: nonEmptyString("Justifique a escolha da data marco."),
  }),
  fatoGerador: z.object({
    tipoFatoGerador: nonEmptyString("Informe o tipo do fato gerador."),
    dataFatoGerador: nonEmptyString("Informe a data do fato gerador."),
    periodoFatoGerador: nonEmptyString("Informe o período do fato gerador."),
    descricaoDetalhada: nonEmptyString("Descreva o fato gerador."),
    observacaoDiferencas: z.string(),
  }),
  naturezaCredito: z.object({
    natureza: z.enum(["concursal", "extraconcursal"]),
    justificativaTecnica: nonEmptyString(
      "Apresente a justificativa técnica.",
    ),
  }),
  classificacaoCredito: z
    .object({
      classificacao: z.enum([
        "trabalhista",
        "garantia_real",
        "quirografario",
        "tributario",
        "me_epp",
        "outro",
      ]),
      justificativaOutro: z.string(),
    })
    .superRefine((value, context) => {
      if (
        value.classificacao === "outro" &&
        value.justificativaOutro.trim().length === 0
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Justifique a classificação 'outro'.",
          path: ["justificativaOutro"],
        });
      }
    }),
  analiseDocumental: z.object({
    documentos: z.array(
      z.object({
        tipo: z.string(),
        titulo: z.string(),
        apresentado: z.boolean(),
        arquivoNome: z.string(),
        arquivoTipo: z.string(),
        arquivoTamanhoKb: z.number(),
        observacao: z.string(),
      }),
    ),
    avaliacao: z.enum(["suficiente", "insuficiente", "contraditoria"], {
      message: "Selecione a avaliação documental.",
    }),
  }),
  verificacaoDuplicidade: z.object({
    creditoJaListado: z.boolean().nullable(),
    habilitacaoAnterior: z.boolean().nullable(),
    divergenciaAnterior: z.boolean().nullable(),
    valoresDivergentes: z.boolean().nullable(),
    execucaoParalela: z.boolean().nullable(),
    processoVinculado: z.string(),
  }),
  dadosEconomicos: z.object({
    valorApresentadoCredor: nonNegativeNumber(
      "Informe o valor apresentado pelo credor.",
    ),
    dataBaseValorApresentado: nonEmptyString(
      "Informe a data-base do valor apresentado.",
    ),
    indiceCorrecaoInformado: nonEmptyString(
      "Informe o índice de correção declarado.",
    ),
    jurosInformados: z.string(),
    multaInformada: z.string(),
    honorariosInformados: z.string(),
    valorJaPago: nonNegativeNumber("O valor pago não pode ser negativo."),
  }),
  regrasCalculo: z.object({
    valorOriginal: nonNegativeNumber("Informe o valor original."),
    dataInicial: nonEmptyString("Informe a data inicial."),
    dataFinal: nonEmptyString("Informe a data final."),
    indiceInicial: z.coerce.number().positive("Informe o índice inicial."),
    indiceFinal: z.coerce.number().positive("Informe o índice final."),
    taxaJuros: nonNegativeNumber("A taxa de juros não pode ser negativa."),
    numeroDias: nonNegativeNumber("O número de dias não pode ser negativo."),
    multa: nonNegativeNumber("A multa não pode ser negativa."),
    inssEmpregado: nonNegativeNumber(
      "O percentual de INSS do empregado não pode ser negativo.",
    ),
    inssEmpregador: nonNegativeNumber(
      "O percentual de INSS do empregador não pode ser negativo.",
    ),
    outrosDescontos: nonNegativeNumber(
      "Outros descontos não podem ser negativos.",
    ),
  }),
  analiseInconsistencias: z.object({
    flagsAutomaticas: z.array(
      z.object({
        chave: z.string(),
        titulo: z.string(),
        ativa: z.boolean(),
        detalhe: z.string(),
      }),
    ),
    riscoManual: z.enum(["baixo", "medio", "alto"], {
      message: "Selecione o nível de risco.",
    }),
    apontamentosManuais: z.string(),
  }),
  conclusaoTecnica: z.object({
    conclusao: z.enum(
      ["deferir", "deferir_parcialmente", "indeferir"],
      {
        message: "Selecione a conclusão técnica.",
      },
    ),
    fundamentacaoResumida: nonEmptyString("Informe a fundamentação resumida."),
    fundamentoLegal: nonEmptyString("Informe o fundamento legal."),
    observacoesInternas: z.string(),
    ajustesValor: z.string(),
    documentosPendentes: z.string(),
  }),
  pecasGeradas: z.object({
    parecerTecnico: z.string(),
    minutaPeticaoHabilitacao: z.string(),
    minutaManifestacaoDivergencia: z.string(),
    textoBaseDecisao: z.string(),
    resumoExecutivo: z.string(),
    relatorioInconsistencias: z.string(),
  }),
});

export type CreditAnalysisSchema = z.infer<typeof creditAnalysisSchema>;
