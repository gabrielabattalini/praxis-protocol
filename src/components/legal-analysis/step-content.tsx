"use client";

import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { CheckCircle2, Calculator, FileText, TriangleAlert, Workflow } from "lucide-react";
import {
  AlertCard,
  BooleanChoice,
  ChoiceButton,
  FieldShell,
  ProgressBar,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/legal-analysis/ui";
import { classificationOptions, pieceTabs, wizardSteps } from "@/lib/legal-analysis/constants";
import { cn, formatCurrency, formatNumber, hasPotentialDuplication } from "@/lib/legal-analysis/utils";
import type {
  AnalysisFormData,
  AutomaticFlag,
  CalculationResult,
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

type StepContentProps = {
  currentStep: number;
  progress: number;
  stepNotice: string;
  activeAnalysis: AnalysisFormData;
  calculation: CalculationResult;
  activeFlags: AutomaticFlag[];
  errors: FieldErrors<AnalysisFormData>;
  register: UseFormRegister<AnalysisFormData>;
  control: Control<AnalysisFormData>;
  onSetDocumentUpload: (index: number, file: File | undefined) => void;
  onSelectPreviewTab: (tab: keyof AnalysisFormData["pecasGeradas"]) => void;
  activePreviewTab: keyof AnalysisFormData["pecasGeradas"];
};

export function LegalAnalysisStepContent({
  currentStep,
  progress,
  stepNotice,
  activeAnalysis,
  calculation,
  activeFlags,
  errors,
  register,
  control,
  onSetDocumentUpload,
  onSelectPreviewTab,
  activePreviewTab,
}: StepContentProps) {
  const selectedStep = wizardSteps[currentStep];

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Progresso do caso
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {selectedStep.shortTitle} · {formatNumber(progress, 0)}% do fluxo preenchido
            </p>
          </div>
          <Workflow className="h-5 w-5 text-slate-500" />
        </div>
        <div className="mt-4">
          <ProgressBar value={progress} />
        </div>
      </div>

      {stepNotice ? (
        <AlertCard
          title="Validação pendente"
          description={stepNotice}
          tone="danger"
        />
      ) : null}

      {currentStep === 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <FieldShell
            label="Número do processo"
            error={getErrorMessage(errors, "identificacao.processo.numero")}
          >
            <TextInput
              placeholder="0000000-00.0000.0.00.0000"
              {...register("identificacao.processo.numero")}
            />
          </FieldShell>
          <FieldShell
            label="Empresa devedora"
            error={getErrorMessage(errors, "identificacao.processo.empresaDevedora")}
          >
            <TextInput
              placeholder="Razão social da devedora"
              {...register("identificacao.processo.empresaDevedora")}
            />
          </FieldShell>
          <FieldShell
            label="Nome do credor"
            error={getErrorMessage(errors, "identificacao.credor.nome")}
          >
            <TextInput
              placeholder="Nome completo ou razão social"
              {...register("identificacao.credor.nome")}
            />
          </FieldShell>
          <FieldShell
            label="CPF/CNPJ do credor"
            error={getErrorMessage(errors, "identificacao.credor.documento")}
          >
            <TextInput
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              {...register("identificacao.credor.documento")}
            />
          </FieldShell>
          <FieldShell label="Tipo de processo">
            <SelectInput {...register("identificacao.processo.tipo")}>
              <option value="recuperacao_judicial">Recuperação Judicial</option>
              <option value="falencia">Falência</option>
            </SelectInput>
          </FieldShell>
          <FieldShell
            label="Vara / comarca"
            error={getErrorMessage(errors, "identificacao.processo.varaComarca")}
          >
            <TextInput
              placeholder="Ex.: 2ª Vara Regional Empresarial"
              {...register("identificacao.processo.varaComarca")}
            />
          </FieldShell>
          <FieldShell
            label="Administrador judicial"
            error={getErrorMessage(errors, "identificacao.processo.administradorJudicial")}
          >
            <TextInput
              placeholder="Nome do AJ ou escritório"
              {...register("identificacao.processo.administradorJudicial")}
            />
          </FieldShell>
          <FieldShell label="Observações iniciais">
            <TextArea
              rows={4}
              placeholder="Contexto inicial da triagem, origem do protocolo e notas relevantes."
              {...register("identificacao.processo.observacoesIniciais")}
            />
          </FieldShell>
        </div>
      ) : null}

      {currentStep === 1 ? (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <AlertCard
              title="Recuperação Judicial"
              description="A análise deve preservar a empresa e verificar a sujeição concursal conforme a data do pedido."
              tone="info"
            />
            <AlertCard
              title="Falência"
              description="A análise passa a ter foco na liquidação patrimonial e na ordem legal de pagamento."
              tone="warning"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <FieldShell label="Regime selecionado">
              <SelectInput {...register("regimeBaseLegal.regimeSelecionado")}>
                <option value="recuperacao_judicial">Recuperação Judicial</option>
                <option value="falencia">Falência</option>
              </SelectInput>
            </FieldShell>
            <FieldShell
              label="Legislação aplicável"
              error={getErrorMessage(errors, "regimeBaseLegal.legislacaoAplicavel")}
            >
              <TextInput
                placeholder="Ex.: Lei 11.101/2005, com redação da Lei 14.112/2020"
                {...register("regimeBaseLegal.legislacaoAplicavel")}
              />
            </FieldShell>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["regimeBaseLegal.diplomas.dl7661", "DL 7.661/1945"],
              ["regimeBaseLegal.diplomas.lei11101", "Lei 11.101/2005"],
              ["regimeBaseLegal.diplomas.lei14112", "Lei 14.112/2020"],
            ].map(([field, label]) => (
              <label
                key={field}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              >
                <input type="checkbox" {...register(field as never)} />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <FieldShell label="Observação jurídica">
            <TextArea
              rows={5}
              placeholder="Explique os fundamentos jurídicos relevantes do enquadramento."
              {...register("regimeBaseLegal.observacaoJuridica")}
            />
          </FieldShell>
        </div>
      ) : null}

      {currentStep === 2 ? (
        <div className="space-y-5">
          <AlertCard
            title="Regra automática de data marco"
            description={
              activeAnalysis.identificacao.processo.tipo === "recuperacao_judicial"
                ? "Para RJ, a data marco padrão é a data do pedido de recuperação judicial."
                : "Para falência, a data marco padrão é a data da decretação da falência."
            }
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <FieldShell label="Data do pedido de recuperação judicial">
              <TextInput type="date" {...register("dataMarco.dataPedidoRecuperacao")} />
            </FieldShell>
            <FieldShell label="Data da decretação da falência">
              <TextInput type="date" {...register("dataMarco.dataDecretacaoFalencia")} />
            </FieldShell>
            <FieldShell
              label="Data marco considerada"
              error={getErrorMessage(errors, "dataMarco.dataMarcoConsiderada")}
            >
              <TextInput type="date" {...register("dataMarco.dataMarcoConsiderada")} />
            </FieldShell>
            <FieldShell
              label="Justificativa"
              error={getErrorMessage(errors, "dataMarco.justificativa")}
            >
              <TextArea
                rows={4}
                placeholder="Justifique a adoção da data marco."
                {...register("dataMarco.justificativa")}
              />
            </FieldShell>
          </div>
        </div>
      ) : null}

      {currentStep === 3 ? (
        <div className="space-y-5">
          <AlertCard
            title="Alerta técnico central"
            description="O fato gerador define a sujeição do crédito, e não apenas a data da nota fiscal, vencimento ou sentença."
            tone="danger"
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <FieldShell
              label="Tipo do fato gerador"
              error={getErrorMessage(errors, "fatoGerador.tipoFatoGerador")}
            >
              <TextInput
                placeholder="Ex.: prestação de serviços, verbas rescisórias, mútuo"
                {...register("fatoGerador.tipoFatoGerador")}
              />
            </FieldShell>
            <FieldShell
              label="Data do fato gerador"
              error={getErrorMessage(errors, "fatoGerador.dataFatoGerador")}
            >
              <TextInput type="date" {...register("fatoGerador.dataFatoGerador")} />
            </FieldShell>
            <FieldShell
              label="Período do fato gerador"
              error={getErrorMessage(errors, "fatoGerador.periodoFatoGerador")}
            >
              <TextInput
                placeholder="Ex.: maio/2025 a julho/2025"
                {...register("fatoGerador.periodoFatoGerador")}
              />
            </FieldShell>
            <FieldShell
              label="Descrição detalhada"
              error={getErrorMessage(errors, "fatoGerador.descricaoDetalhada")}
            >
              <TextArea
                rows={5}
                placeholder="Descreva a origem material do crédito e a cronologia relevante."
                {...register("fatoGerador.descricaoDetalhada")}
              />
            </FieldShell>
          </div>
          <FieldShell label="Observação sobre diferenças entre fato gerador, vencimento, NF ou sentença">
            <TextArea
              rows={4}
              placeholder="Aponte diferenças relevantes entre o fato gerador e outras datas documentais."
              {...register("fatoGerador.observacaoDiferencas")}
            />
          </FieldShell>
        </div>
      ) : null}

      {currentStep === 4 ? (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <AlertCard
              title="Crédito concursal"
              description="Via de regra, decorre de fato gerador anterior à data marco do procedimento."
            />
            <AlertCard
              title="Crédito extraconcursal"
              description="Depende de base legal própria e de fato gerador posterior ou privilegiado."
              tone="warning"
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <FieldShell
              label="Natureza do crédito"
              error={getErrorMessage(errors, "naturezaCredito.natureza")}
            >
              <SelectInput {...register("naturezaCredito.natureza")}>
                <option value="">Selecione</option>
                <option value="concursal">Concursal</option>
                <option value="extraconcursal">Extraconcursal</option>
              </SelectInput>
            </FieldShell>
            <FieldShell
              label="Justificativa técnica"
              error={getErrorMessage(errors, "naturezaCredito.justificativaTecnica")}
            >
              <TextArea
                rows={5}
                placeholder="Explique tecnicamente por que o crédito é concursal ou extraconcursal."
                {...register("naturezaCredito.justificativaTecnica")}
              />
            </FieldShell>
          </div>
        </div>
      ) : null}

      {currentStep === 5 ? (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <AlertCard
              title="Nota técnica"
              description="Créditos tributários não entram na RJ, em regra."
              tone="warning"
            />
            <AlertCard
              title="Falência"
              description="Em falência, a classificação deve respeitar a ordem legal de pagamento."
              tone="info"
            />
            <AlertCard
              title="Verbas indenizatórias"
              description="Demandam exame específico quanto à classe e ao fato gerador."
              tone="danger"
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <FieldShell
              label="Classificação do crédito"
              error={getErrorMessage(errors, "classificacaoCredito.classificacao")}
            >
              <SelectInput {...register("classificacaoCredito.classificacao")}>
                <option value="">Selecione</option>
                {classificationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </FieldShell>
            {activeAnalysis.classificacaoCredito.classificacao === "outro" ? (
              <FieldShell
                label="Justificativa para 'outro'"
                error={getErrorMessage(errors, "classificacaoCredito.justificativaOutro")}
              >
                <TextArea
                  rows={4}
                  placeholder="Especifique a classe e a razão jurídica."
                  {...register("classificacaoCredito.justificativaOutro")}
                />
              </FieldShell>
            ) : null}
          </div>
        </div>
      ) : null}

      {currentStep === 6 ? (
        <div className="space-y-5">
          <AlertCard
            title="Checklist probatório"
            description="Os uploads armazenam metadados localmente nesta demo. A estrutura já está pronta para integração futura com banco de dados e storage externo."
            tone="info"
          />
          <div className="grid gap-4">
            {activeAnalysis.analiseDocumental.documentos.map((documento, index) => (
              <div
                key={documento.tipo}
                className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4"
              >
                <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)_220px]">
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      {...register(`analiseDocumental.documentos.${index}.apresentado`)}
                    />
                    <span>{documento.titulo}</span>
                  </label>
                  <FieldShell label="Observação do documento">
                    <TextArea
                      rows={3}
                      placeholder="Ex.: assinado, incompleto, divergente, sem comprovação de entrega."
                      {...register(`analiseDocumental.documentos.${index}.observacao`)}
                    />
                  </FieldShell>
                  <div className="space-y-3">
                    <FieldShell label="Upload opcional">
                      <TextInput
                        type="file"
                        onChange={(event) => onSetDocumentUpload(index, event.target.files?.[0])}
                      />
                    </FieldShell>
                    {documento.arquivoNome ? (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                        <p className="font-semibold text-slate-800">{documento.arquivoNome}</p>
                        <p>
                          {documento.arquivoTipo || "Tipo não informado"} · {documento.arquivoTamanhoKb} KB
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <FieldShell
            label="Avaliação documental"
            error={getErrorMessage(errors, "analiseDocumental.avaliacao")}
          >
            <SelectInput {...register("analiseDocumental.avaliacao")}>
              <option value="">Selecione</option>
              <option value="suficiente">Documentação suficiente</option>
              <option value="insuficiente">Documentação insuficiente</option>
              <option value="contraditoria">Documentação contraditória</option>
            </SelectInput>
          </FieldShell>
        </div>
      ) : null}

      {currentStep === 7 ? (
        <div className="space-y-5">
          {hasPotentialDuplication(activeAnalysis) ? (
            <AlertCard
              title="Risco potencial de duplicidade"
              description="Há respostas positivas na triagem e o crédito precisa ser confrontado com quadro geral, divergências anteriores e execuções paralelas."
              tone="danger"
            />
          ) : (
            <AlertCard
              title="Sem alerta automático"
              description="Até aqui, o caso não aponta duplicidade evidente, mas a confirmação depende de resposta completa a todos os itens."
              tone="success"
            />
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {[
              ["creditoJaListado", "Crédito já listado?"],
              ["habilitacaoAnterior", "Há habilitação anterior?"],
              ["divergenciaAnterior", "Há divergência anterior?"],
              ["valoresDivergentes", "Existem valores divergentes?"],
              ["execucaoParalela", "Existe execução paralela?"],
            ].map(([field, label]) => (
              <Controller
                key={field}
                control={control}
                name={`verificacaoDuplicidade.${field}` as never}
                render={({ field: controllerField }) => (
                  <FieldShell label={label}>
                    <BooleanChoice
                      value={controllerField.value as boolean | null}
                      onChange={controllerField.onChange}
                    />
                  </FieldShell>
                )}
              />
            ))}
          </div>
          <FieldShell label="Processo vinculado / observação complementar">
            <TextArea
              rows={4}
              placeholder="Informe número de processo vinculado, divergência já protocolada ou observação de confronto."
              {...register("verificacaoDuplicidade.processoVinculado")}
            />
          </FieldShell>
        </div>
      ) : null}

      {currentStep === 8 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <FieldShell
            label="Valor apresentado pelo credor"
            error={getErrorMessage(errors, "dadosEconomicos.valorApresentadoCredor")}
          >
            <TextInput
              type="number"
              step="0.01"
              {...register("dadosEconomicos.valorApresentadoCredor", {
                valueAsNumber: true,
              })}
            />
          </FieldShell>
          <FieldShell
            label="Data-base do valor apresentado"
            error={getErrorMessage(errors, "dadosEconomicos.dataBaseValorApresentado")}
          >
            <TextInput
              type="date"
              {...register("dadosEconomicos.dataBaseValorApresentado")}
            />
          </FieldShell>
          <FieldShell
            label="Índice de correção informado"
            error={getErrorMessage(errors, "dadosEconomicos.indiceCorrecaoInformado")}
          >
            <TextInput
              placeholder="Ex.: IPCA-E, SELIC, TR"
              {...register("dadosEconomicos.indiceCorrecaoInformado")}
            />
          </FieldShell>
          <FieldShell label="Juros informados">
            <TextInput
              placeholder="Ex.: 1% ao mês"
              {...register("dadosEconomicos.jurosInformados")}
            />
          </FieldShell>
          <FieldShell label="Multa informada">
            <TextInput
              placeholder="Ex.: 2% ou 40% FGTS"
              {...register("dadosEconomicos.multaInformada")}
            />
          </FieldShell>
          <FieldShell label="Honorários informados">
            <TextInput
              placeholder="Descreva se o credor informou honorários"
              {...register("dadosEconomicos.honorariosInformados")}
            />
          </FieldShell>
          <FieldShell label="Valor já pago, se houver">
            <TextInput
              type="number"
              step="0.01"
              {...register("dadosEconomicos.valorJaPago", {
                valueAsNumber: true,
              })}
            />
          </FieldShell>
        </div>
      ) : null}

      {currentStep === 9 ? (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <AlertCard
              title="Cálculo orientado pela data marco"
              description="O motor limita juros à data marco, bloqueia cumulação indevida de SELIC com juros separados e evidencia eventual deflação."
            />
            <AlertCard
              title="Critério previdenciário"
              description="INSS do empregado é deduzido; INSS patronal é excluído do crédito trabalhista."
              tone="warning"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {[
              ["regrasCalculo.valorOriginal", "Valor original", "0.01"],
              ["regrasCalculo.indiceInicial", "Índice inicial", "0.0001"],
              ["regrasCalculo.indiceFinal", "Índice final", "0.0001"],
              ["regrasCalculo.taxaJuros", "Taxa de juros (% a.m.)", "0.01"],
              ["regrasCalculo.numeroDias", "Número de dias", "1"],
              ["regrasCalculo.multa", "Multa (%)", "0.01"],
              ["regrasCalculo.inssEmpregado", "INSS empregado (%)", "0.01"],
              ["regrasCalculo.inssEmpregador", "INSS empregador (%)", "0.01"],
              ["regrasCalculo.outrosDescontos", "Outros descontos", "0.01"],
            ].map(([field, label, step]) => (
              <FieldShell key={field} label={label}>
                <TextInput
                  type="number"
                  step={step}
                  {...register(field as never, { valueAsNumber: true })}
                />
              </FieldShell>
            ))}
            <FieldShell
              label="Data inicial"
              error={getErrorMessage(errors, "regrasCalculo.dataInicial")}
            >
              <TextInput type="date" {...register("regrasCalculo.dataInicial")} />
            </FieldShell>
            <FieldShell
              label="Data final"
              error={getErrorMessage(errors, "regrasCalculo.dataFinal")}
            >
              <TextInput type="date" {...register("regrasCalculo.dataFinal")} />
            </FieldShell>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-slate-600" />
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-600">
                Memória de cálculo
              </h3>
            </div>
            <div className="mt-4 grid gap-3">
              {calculation.memoria.map((line) => (
                <div
                  key={line.titulo}
                  className={cn(
                    "rounded-2xl border px-4 py-3",
                    line.destaque === "positivo"
                      ? "border-emerald-200 bg-emerald-50"
                      : line.destaque === "negativo"
                        ? "border-rose-200 bg-rose-50"
                        : "border-slate-200 bg-white",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{line.titulo}</p>
                      <p className="text-xs text-slate-500">{line.formula}</p>
                    </div>
                    <p className="font-title text-xl text-slate-950">{line.valor}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {currentStep === 10 ? (
        <div className="space-y-5">
          <div className="grid gap-4">
            {activeAnalysis.analiseInconsistencias.flagsAutomaticas.map((flag) => (
              <div
                key={flag.chave}
                className={cn(
                  "rounded-[22px] border px-4 py-4",
                  flag.ativa
                    ? "border-rose-200 bg-rose-50/90"
                    : "border-slate-200 bg-slate-50/70",
                )}
              >
                <div className="flex items-start gap-3">
                  {flag.ativa ? (
                    <TriangleAlert className="mt-0.5 h-4 w-4 text-rose-600" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{flag.titulo}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{flag.detalhe}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <FieldShell
              label="Classificação manual do risco"
              error={getErrorMessage(errors, "analiseInconsistencias.riscoManual")}
            >
              <SelectInput {...register("analiseInconsistencias.riscoManual")}>
                <option value="">Selecione</option>
                <option value="baixo">Risco baixo</option>
                <option value="medio">Risco médio</option>
                <option value="alto">Risco alto</option>
              </SelectInput>
            </FieldShell>
            <FieldShell label="Apontamentos manuais">
              <TextArea
                rows={5}
                placeholder="Registre cautelas adicionais, inconsistências não automatizadas ou encaminhamentos internos."
                {...register("analiseInconsistencias.apontamentosManuais")}
              />
            </FieldShell>
          </div>
        </div>
      ) : null}

      {currentStep === 11 ? (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <AlertCard
              title="Valor técnico apurado"
              description={`Montante líquido atual: ${formatCurrency(calculation.valorFinal)}.`}
              tone="success"
            />
            <AlertCard
              title="Resultado obrigatório"
              description="Selecione deferimento, deferimento parcial ou indeferimento com fundamentação objetiva e legal."
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <FieldShell
              label="Conclusão técnica"
              error={getErrorMessage(errors, "conclusaoTecnica.conclusao")}
            >
              <SelectInput {...register("conclusaoTecnica.conclusao")}>
                <option value="">Selecione</option>
                <option value="deferir">Deferir</option>
                <option value="deferir_parcialmente">Deferir parcialmente</option>
                <option value="indeferir">Indeferir</option>
              </SelectInput>
            </FieldShell>
            <FieldShell
              label="Fundamento legal"
              error={getErrorMessage(errors, "conclusaoTecnica.fundamentoLegal")}
            >
              <TextInput
                placeholder="Ex.: arts. 7º, 9º e 49 da Lei 11.101/2005"
                {...register("conclusaoTecnica.fundamentoLegal")}
              />
            </FieldShell>
            <FieldShell
              label="Fundamentação resumida"
              error={getErrorMessage(errors, "conclusaoTecnica.fundamentacaoResumida")}
            >
              <TextArea
                rows={5}
                placeholder="Explique de forma objetiva por que o crédito deve ser deferido, deferido parcialmente ou indeferido."
                {...register("conclusaoTecnica.fundamentacaoResumida")}
              />
            </FieldShell>
            <FieldShell label="Observações internas">
              <TextArea
                rows={5}
                placeholder="Notas reservadas da equipe técnica."
                {...register("conclusaoTecnica.observacoesInternas")}
              />
            </FieldShell>
            <FieldShell label="Ajustes necessários no valor">
              <TextArea
                rows={4}
                placeholder="Descreva as retificações financeiras ou premissas adicionais."
                {...register("conclusaoTecnica.ajustesValor")}
              />
            </FieldShell>
            <FieldShell label="Documentos pendentes">
              <TextArea
                rows={4}
                placeholder="Liste os documentos faltantes ou providências complementares."
                {...register("conclusaoTecnica.documentosPendentes")}
              />
            </FieldShell>
          </div>
        </div>
      ) : null}

      {currentStep === 12 ? (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pieceTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onSelectPreviewTab(tab.key)}
                className={cn(
                  "rounded-[24px] border p-5 text-left transition",
                  activePreviewTab === tab.key
                    ? "border-slate-900 bg-slate-950 text-white"
                    : "border-slate-200 bg-slate-50 hover:border-amber-400",
                )}
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4" />
                  <p className="font-semibold">{tab.label}</p>
                </div>
                <p
                  className={cn(
                    "mt-3 text-sm leading-6",
                    activePreviewTab === tab.key ? "text-slate-300" : "text-slate-600",
                  )}
                >
                  Saída pronta para revisão, cópia, exportação e uso interno do escritório.
                </p>
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <AlertCard
              title="Parecer técnico"
              description="Organiza síntese, base legal, prova, cálculo e conclusão."
              tone="success"
            />
            <AlertCard
              title="Minutas prontas"
              description="Petição de habilitação e manifestação de divergência em linguagem jurídica objetiva."
              tone="info"
            />
            <AlertCard
              title="Decisão interna"
              description="Texto-base alinhado ao desfecho indicado na conclusão técnica."
              tone="warning"
            />
          </div>
          {activeFlags.length ? (
            <AlertCard
              title="Inconsistências ativas"
              description={`${activeFlags.length} flag(s) automática(s) constam na análise e foram incorporadas ao relatório final.`}
              tone="danger"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
