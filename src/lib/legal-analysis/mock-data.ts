import {
  createEmptyAnalysis,
  createEmptyGeneratedPieces,
} from "@/lib/legal-analysis/constants";
import type { AnalysisFormData } from "@/types/legal-analysis";

export function createExampleAnalysis(): AnalysisFormData {
  const base = createEmptyAnalysis();

  return {
    ...base,
    id: "analise-demo-rj-001",
    createdAt: "2026-03-10T09:00:00.000Z",
    updatedAt: "2026-03-28T12:30:00.000Z",
    currentStep: 12,
    identificacao: {
      processo: {
        numero: "5001234-56.2025.8.26.0100",
        empresaDevedora: "Metalúrgica Aurora S.A.",
        tipo: "recuperacao_judicial",
        varaComarca:
          "2ª Vara Regional Empresarial da Comarca de São Paulo/SP",
        administradorJudicial: "Nexus Administração Judicial Ltda.",
        observacoesIniciais:
          "Pedido de divergência apresentado após publicação da segunda relação de credores.",
      },
      credor: {
        nome: "Transportes Serra Azul Ltda.",
        documento: "12.345.678/0001-90",
      },
    },
    regimeBaseLegal: {
      regimeSelecionado: "recuperacao_judicial",
      legislacaoAplicavel:
        "Lei 11.101/2005, com redação da Lei 14.112/2020.",
      diplomas: {
        dl7661: false,
        lei11101: true,
        lei14112: true,
      },
      observacaoJuridica:
        "Procedimento voltado à preservação da empresa, com sujeição dos créditos concursais constituídos até a data do pedido.",
    },
    dataMarco: {
      dataPedidoRecuperacao: "2025-08-14",
      dataDecretacaoFalencia: "",
      dataMarcoConsiderada: "2025-08-14",
      justificativa:
        "Em recuperação judicial, a data do pedido delimita a sujeição concursal e a incidência de juros.",
    },
    fatoGerador: {
      tipoFatoGerador: "Prestação de serviços de transporte e logística",
      dataFatoGerador: "2025-06-30",
      periodoFatoGerador: "abril/2025 a junho/2025",
      descricaoDetalhada:
        "Prestação continuada de serviços de transporte rodoviário de insumos industriais, com entregas comprovadas e notas fiscais emitidas ao longo do segundo trimestre de 2025.",
      observacaoDiferencas:
        "As notas fiscais foram emitidas em datas distintas, mas o fato gerador corresponde às efetivas prestações executadas antes do pedido de RJ.",
    },
    naturezaCredito: {
      natureza: "concursal",
      justificativaTecnica:
        "O fato gerador antecede a data do pedido de recuperação judicial, atraindo a sujeição concursal do crédito.",
    },
    classificacaoCredito: {
      classificacao: "quirografario",
      justificativaOutro: "",
    },
    analiseDocumental: {
      documentos: base.analiseDocumental.documentos.map((documento) => {
        switch (documento.tipo) {
          case "contrato":
            return {
              ...documento,
              apresentado: true,
              arquivoNome: "contrato-logistica-2025.pdf",
              arquivoTipo: "application/pdf",
              arquivoTamanhoKb: 842,
              observacao:
                "Contrato de prestação de serviços assinado pelas partes.",
            };
          case "nota_fiscal":
            return {
              ...documento,
              apresentado: true,
              arquivoNome: "notas-fiscais-lote-abril-junho.zip",
              arquivoTipo: "application/zip",
              arquivoTamanhoKb: 2310,
              observacao: "Conjunto de NF-e emitidas no período contratual.",
            };
          case "comprovante_entrega":
            return {
              ...documento,
              apresentado: true,
              arquivoNome: "canhotos-entrega.pdf",
              arquivoTipo: "application/pdf",
              arquivoTamanhoKb: 516,
              observacao:
                "Canhotos e comprovantes eletrônicos confirmando as entregas.",
            };
          case "comprovante_pagamento_parcial":
            return {
              ...documento,
              apresentado: true,
              arquivoNome: "comprovante-adiantamento.pdf",
              arquivoTipo: "application/pdf",
              arquivoTamanhoKb: 120,
              observacao:
                "Pagamento parcial de R$ 20.000,00 identificado no extrato.",
            };
          default:
            return documento;
        }
      }),
      avaliacao: "suficiente",
    },
    verificacaoDuplicidade: {
      creditoJaListado: true,
      habilitacaoAnterior: false,
      divergenciaAnterior: true,
      valoresDivergentes: true,
      execucaoParalela: false,
      processoVinculado: "Divergência administrativa protocolada em 05/09/2025.",
    },
    dadosEconomicos: {
      valorApresentadoCredor: 184560.45,
      dataBaseValorApresentado: "2025-08-31",
      indiceCorrecaoInformado: "IPCA-E",
      jurosInformados: "1% ao mês",
      multaInformada: "2%",
      honorariosInformados: "Sem honorários autônomos no pedido.",
      valorJaPago: 20000,
    },
    regrasCalculo: {
      valorOriginal: 172000,
      dataInicial: "2025-06-30",
      dataFinal: "2025-08-31",
      indiceInicial: 100,
      indiceFinal: 102.18,
      taxaJuros: 1,
      numeroDias: 62,
      multa: 2,
      inssEmpregado: 0,
      inssEmpregador: 0,
      outrosDescontos: 1560.45,
    },
    analiseInconsistencias: {
      flagsAutomaticas: [],
      riscoManual: "medio",
      apontamentosManuais:
        "Divergência entre valor listado inicialmente e valor recalculado até a data marco. Necessário retificar quadro quanto ao montante.",
    },
    conclusaoTecnica: {
      conclusao: "deferir_parcialmente",
      fundamentacaoResumida:
        "Crédito demonstrado por documentação suficiente, porém sujeito a adequação do valor em razão da atualização além da data marco e do abatimento de pagamento parcial.",
      fundamentoLegal:
        "Arts. 7º, 9º e 49 da Lei 11.101/2005, com redação da Lei 14.112/2020.",
      observacoesInternas:
        "Incluir observação expressa sobre pagamento parcial já reconhecido.",
      ajustesValor:
        "Retificar valor para refletir juros apenas até 14/08/2025 e dedução do adiantamento pago.",
      documentosPendentes:
        "Sem pendências essenciais; apenas organizar ordem cronológica das NF-e no dossiê.",
    },
    pecasGeradas: createEmptyGeneratedPieces(),
  };
}

export function createPendingExampleAnalysis(): AnalysisFormData {
  const base = createEmptyAnalysis();

  return {
    ...base,
    id: "analise-demo-fal-002",
    createdAt: "2026-03-22T15:00:00.000Z",
    updatedAt: "2026-03-27T18:40:00.000Z",
    currentStep: 7,
    identificacao: {
      processo: {
        numero: "1009876-21.2024.8.19.0001",
        empresaDevedora: "Tecelagem Horizonte Ltda.",
        tipo: "falencia",
        varaComarca: "3ª Vara Empresarial da Comarca do Rio de Janeiro/RJ",
        administradorJudicial: "Nexus Administração Judicial Ltda.",
        observacoesIniciais:
          "Habilitação trabalhista apresentada por ex-empregado após decretação da falência.",
      },
      credor: {
        nome: "Carlos Eduardo Martins",
        documento: "123.456.789-09",
      },
    },
    regimeBaseLegal: {
      regimeSelecionado: "falencia",
      legislacaoAplicavel: "Lei 11.101/2005 e Lei 14.112/2020.",
      diplomas: {
        dl7661: false,
        lei11101: true,
        lei14112: true,
      },
      observacaoJuridica:
        "Na falência, prevalece a liquidação patrimonial e a observância da ordem legal de pagamentos.",
    },
    dataMarco: {
      dataPedidoRecuperacao: "",
      dataDecretacaoFalencia: "2024-11-03",
      dataMarcoConsiderada: "2024-11-03",
      justificativa:
        "A decretação da falência funciona como data marco para limitação de juros e aferição da sujeição concursal.",
    },
    fatoGerador: {
      tipoFatoGerador: "Verbas rescisórias",
      dataFatoGerador: "2024-10-28",
      periodoFatoGerador: "setembro/2024 a outubro/2024",
      descricaoDetalhada:
        "Crédito trabalhista decorrente de rescisão contratual sem quitação integral de saldo salarial, aviso prévio e férias proporcionais.",
      observacaoDiferencas:
        "Há menção a cálculos unilaterais sem homologação judicial até o momento.",
    },
    naturezaCredito: {
      natureza: "concursal",
      justificativaTecnica:
        "O vínculo e a rescisão antecederam a decretação da falência.",
    },
    classificacaoCredito: {
      classificacao: "trabalhista",
      justificativaOutro: "",
    },
    analiseDocumental: {
      documentos: base.analiseDocumental.documentos.map((documento) => {
        if (documento.tipo === "ctps") {
          return {
            ...documento,
            apresentado: true,
            arquivoNome: "ctps-digital.pdf",
            arquivoTipo: "application/pdf",
            arquivoTamanhoKb: 330,
            observacao: "CTPS digital com registros do vínculo.",
          };
        }

        if (documento.tipo === "peticao_inicial") {
          return {
            ...documento,
            apresentado: true,
            arquivoNome: "reclamacao-trabalhista.pdf",
            arquivoTipo: "application/pdf",
            arquivoTamanhoKb: 720,
            observacao: "Petição inicial da ação trabalhista conexa.",
          };
        }

        return documento;
      }),
      avaliacao: "insuficiente",
    },
    verificacaoDuplicidade: {
      creditoJaListado: false,
      habilitacaoAnterior: false,
      divergenciaAnterior: false,
      valoresDivergentes: false,
      execucaoParalela: true,
      processoVinculado: "RTOrd 0100456-13.2024.5.01.0007",
    },
    dadosEconomicos: {
      valorApresentadoCredor: 48500,
      dataBaseValorApresentado: "2025-01-10",
      indiceCorrecaoInformado: "SELIC",
      jurosInformados: "SELIC",
      multaInformada: "40% FGTS incluída nos cálculos do credor",
      honorariosInformados: "Honorários sucumbenciais não discriminados",
      valorJaPago: 0,
    },
    regrasCalculo: {
      valorOriginal: 39000,
      dataInicial: "2024-10-28",
      dataFinal: "2025-01-10",
      indiceInicial: 100,
      indiceFinal: 104.12,
      taxaJuros: 1,
      numeroDias: 74,
      multa: 0,
      inssEmpregado: 8,
      inssEmpregador: 20,
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
      observacoesInternas:
        "Aguardar documentação complementar e conferir eventual habilitação no juízo trabalhista.",
      ajustesValor: "",
      documentosPendentes:
        "Termo de rescisão, sentença ou acordo homologado e cálculos discriminados.",
    },
    pecasGeradas: createEmptyGeneratedPieces(),
  };
}
