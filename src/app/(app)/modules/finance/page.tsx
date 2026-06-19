"use client";

import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  CalendarDays,
  ChevronDown,
  Fuel,
  Landmark,
  Pill,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
} from "lucide-react";
import { StripeCheckoutButton } from "@/components/billing/stripe-checkout-button";
import { useAppStore } from "@/components/providers/app-store-provider";
import { FinanceFuelPlanner } from "@/components/modules/finance-fuel-planner";
import { GlassPanel } from "@/components/ui/glass-panel";
import type {
  FinanceBudgetLine,
  FinanceLineFrequency,
  FinanceLineKind,
  FinanceMonthId,
  FinancePaymentMethod,
} from "@/lib/types";
import {
  financeMonthOrder,
  formatCurrency,
  formatFinanceFrequency,
  formatFinancePaymentMethod,
  getFinanceSettledAmount,
  getFinanceMonthSummaries,
  isFinanceAutoDebitPaymentMethod,
  isFinanceCreditCardPaymentMethod,
  isFinanceInvoiceBaseLine,
  isFinanceSummaryHelperLine,
  isFinanceSettledInMonth,
  formatMoneyInputBR,
  parseMoneyInputBR,
  roundCurrencyValue,
  sumFinanceLine,
} from "@/lib/utils";

const paymentOptions: FinancePaymentMethod[] = [
  "cash",
  "pix",
  "debit-card",
  "credit-card",
  "auto-debit",
  "bank-slip",
  "bank-transfer",
];

const frequencyOptions: FinanceLineFrequency[] = ["fixed", "variable"];

type ExpenseSortMode = "due-date" | "highest-value" | "lowest-value";
type FinanceView = "budget" | "fuel";
type FinanceCategoryBreakdownItem = {
  category: string;
  value: number;
  share: number;
  toneClass: string;
};

const breakdownToneClasses = [
  "bg-amber-300",
  "bg-emerald-300",
  "bg-amber-300",
  "bg-fuchsia-300",
  "bg-sky-300",
  "bg-lime-300",
];

const financePremiumHighlights = [
  "Sugestoes de Mercado e Suplementos viram lancamento em um toque.",
  "Fatura, renda e saldo ficam na mesma leitura.",
  "O plano premium ganha leitura guiada e acesso seguro via Stripe.",
];

// Parser tolerante de valor (formato BR e variações). Aceita o que o
// usuário digitar — "5.000", "5.000,00", "5900", "5,90", "R$ 1.234,56" —
// e converte pro número. Lógica em @/lib/utils (testada).
function parseMoneyInput(raw: string) {
  return parseMoneyInputBR(raw);
}

function buildFinanceCategoryBreakdown(
  totals: Map<string, number>,
): FinanceCategoryBreakdownItem[] {
  const entries = Array.from(totals.entries())
    .filter(([, value]) => value > 0)
    .sort((left, right) => right[1] - left[1]);
  const grandTotal = entries.reduce((sum, [, value]) => sum + value, 0);

  return entries.map(([category, value], index) => ({
    category,
    value,
    share: grandTotal > 0 ? (value / grandTotal) * 100 : 0,
    toneClass: breakdownToneClasses[index % breakdownToneClasses.length],
  }));
}

function FinanceActionHint({
  text,
  children,
}: {
  text: string;
  children: ReactNode;
}) {
  return (
    <span className="group/finance-tooltip relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-[calc(100%+10px)] right-0 z-20 hidden w-56 rounded-sm border border-zinc-800 bg-[rgba(5,5,5,0.96)] px-3 py-2 text-left text-[11px] leading-5 text-zinc-100 shadow-[0_16px_40px_rgba(2,8,23,0.5)] group-hover/finance-tooltip:block">
        {text}
      </span>
    </span>
  );
}

function sortLines(
  lines: FinanceBudgetLine[],
  monthId: FinanceMonthId,
  sortMode: ExpenseSortMode = "due-date",
) {
  return [...lines].sort((left, right) => {
    const leftSettled =
      left.kind === "expense" && isFinanceSettledInMonth(left, monthId);
    const rightSettled =
      right.kind === "expense" && isFinanceSettledInMonth(right, monthId);

    if (leftSettled !== rightSettled) {
      return leftSettled ? 1 : -1;
    }

    if (sortMode !== "due-date") {
      const leftValue = left.monthly[monthId] ?? 0;
      const rightValue = right.monthly[monthId] ?? 0;
      if (leftValue !== rightValue) {
        return sortMode === "highest-value"
          ? rightValue - leftValue
          : leftValue - rightValue;
      }
    }

    const leftDue = left.dueDay ?? 99;
    const rightDue = right.dueDay ?? 99;
    if (leftDue !== rightDue) return leftDue - rightDue;
    return left.name.localeCompare(right.name);
  });
}

export default function FinanceModulePage() {
  const { state, actions, entitlement } = useAppStore();
  const budget = state.financeBudget;
  const [activeView, setActiveView] = useState<FinanceView>("budget");
  const [selectedMonthId, setSelectedMonthId] = useState<FinanceMonthId>(() => {
    // Default to the month AHEAD of the real "today" — the user
    // closes month N on month N+1 ("o fechamento de maio é feito em
    // junho"). Clamp at december so the page never starts on a month
    // that doesn't exist in the year budget.
    const monthIds: FinanceMonthId[] = [
      "january","february","march","april","may","june",
      "july","august","september","october","november","december",
    ];
    const nextIndex = Math.min(new Date().getMonth() + 1, 11);
    return monthIds[nextIndex];
  });
  const [expenseSort, setExpenseSort] = useState<ExpenseSortMode>("due-date");
  const [settlementDrafts, setSettlementDrafts] = useState<Record<string, string>>({});
  const [invoiceDrafts, setInvoiceDrafts] = useState<
    Partial<Record<FinanceMonthId, string>>
  >({});
  const [lineValueDrafts, setLineValueDrafts] = useState<Record<string, string>>({});
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    amount: "",
    kind: "expense" as FinanceLineKind,
    category: "",
    frequency: "fixed" as FinanceLineFrequency,
    paymentMethod: "credit-card" as FinancePaymentMethod,
    dueDay: "",
  });
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false);
  const [categoryDraftName, setCategoryDraftName] = useState("");

  const visibleLines = useMemo(
    () =>
      budget.lines.filter(
        (line) => !isFinanceInvoiceBaseLine(line) && !isFinanceSummaryHelperLine(line),
      ),
    [budget.lines],
  );
  const visibleBudget = useMemo(
    () => ({
      ...budget,
      lines: visibleLines,
    }),
    [budget, visibleLines],
  );
  const months = useMemo(() => getFinanceMonthSummaries(visibleBudget), [visibleBudget]);
  const plannedMonths = useMemo(
    () =>
      months.map((month) => {
        const plannedLineExpenses = roundCurrencyValue(
          visibleLines
            .filter((line) => line.kind === "expense")
            .reduce((sum, line) => sum + (line.monthly[month.id] ?? 0), 0),
        );
        const plannedExpenses = roundCurrencyValue(
          plannedLineExpenses + (budget.cardInvoiceBase?.[month.id] ?? 0),
        );
        return {
          ...month,
          plannedExpenses,
          plannedBalance: roundCurrencyValue(month.income - plannedExpenses),
        };
      }),
    [budget.cardInvoiceBase, months, visibleLines],
  );
  const selectedMonth =
    months.find((month) => month.id === selectedMonthId) ?? months[0];
  const selectedPlannedMonth =
    plannedMonths.find((month) => month.id === selectedMonthId) ?? plannedMonths[0];
  const invoiceTitle = "Fatura do cartão de crédito";
  const selectedMonthInvoiceBase = budget.cardInvoiceBase?.[selectedMonthId] ?? 0;
  const selectedMonthSettledCardAmount = useMemo(
    () =>
      roundCurrencyValue(
        visibleLines
        .filter(
          (line) =>
            line.kind === "expense" &&
            isFinanceCreditCardPaymentMethod(line.paymentMethod),
        )
        .reduce(
          (sum, line) =>
            sum + getFinanceSettledAmount(line, selectedMonthId, budget.year),
          0,
        ),
      ),
    [budget.year, selectedMonthId, visibleLines],
  );
  const selectedMonthInvoiceLaunchedTotal = roundCurrencyValue(
    selectedMonthInvoiceBase + selectedMonthSettledCardAmount,
  );

  const incomeLines = useMemo(
    () =>
      sortLines(
        visibleLines.filter(
          (line) => line.kind === "income" && (line.monthly[selectedMonthId] ?? 0) > 0,
        ),
        selectedMonthId,
      ),
    [selectedMonthId, visibleLines],
  );
  const expenseLines = useMemo(
    () =>
      sortLines(
        visibleLines.filter(
          (line) => line.kind === "expense" && (line.monthly[selectedMonthId] ?? 0) > 0,
        ),
        selectedMonthId,
        expenseSort,
      ),
    [expenseSort, selectedMonthId, visibleLines],
  );
  const cardExpenseLines = useMemo(
    () =>
      expenseLines.filter((line) =>
        isFinanceCreditCardPaymentMethod(line.paymentMethod),
      ),
    [expenseLines],
  );
  const nonCardExpenseLines = useMemo(
    () =>
      expenseLines.filter(
        (line) => !isFinanceCreditCardPaymentMethod(line.paymentMethod),
      ),
    [expenseLines],
  );
  const selectedMonthExpenseTotal = selectedPlannedMonth?.plannedExpenses ?? 0;
  const selectedMonthPlannedBalance = selectedPlannedMonth?.plannedBalance ?? 0;
  const detailedMonths = useMemo(
    () =>
      months.map((month) => {
        const plannedCardExpenses = roundCurrencyValue(
          (budget.cardInvoiceBase?.[month.id] ?? 0) +
            visibleLines
              .filter(
                (line) =>
                  line.kind === "expense" &&
                  isFinanceCreditCardPaymentMethod(line.paymentMethod),
              )
              .reduce((sum, line) => sum + (line.monthly[month.id] ?? 0), 0),
        );
        const plannedNonCardExpenses = roundCurrencyValue(
          visibleLines
            .filter(
              (line) =>
                line.kind === "expense" &&
                !isFinanceCreditCardPaymentMethod(line.paymentMethod),
            )
            .reduce((sum, line) => sum + (line.monthly[month.id] ?? 0), 0),
        );
        const plannedExpenses = roundCurrencyValue(
          plannedCardExpenses + plannedNonCardExpenses,
        );

        return {
          ...month,
          cardExpenses: plannedCardExpenses,
          cashExpenses: plannedNonCardExpenses,
          expenses: plannedExpenses,
          balance: roundCurrencyValue(month.income - plannedExpenses),
        };
      }),
    [budget.cardInvoiceBase, months, visibleLines],
  );
  const annualIncome = useMemo(
    () => roundCurrencyValue(detailedMonths.reduce((sum, month) => sum + month.income, 0)),
    [detailedMonths],
  );
  const annualCardExpenses = useMemo(
    () => roundCurrencyValue(detailedMonths.reduce((sum, month) => sum + month.cardExpenses, 0)),
    [detailedMonths],
  );
  const annualNonCardExpenses = useMemo(
    () => roundCurrencyValue(detailedMonths.reduce((sum, month) => sum + month.cashExpenses, 0)),
    [detailedMonths],
  );
  const annualExpenses = roundCurrencyValue(annualCardExpenses + annualNonCardExpenses);
  const annualOperatingBalance = roundCurrencyValue(annualIncome - annualExpenses);
  const annualBalance = roundCurrencyValue(
    budget.startCash + annualOperatingBalance,
  );
  const monthlyCategoryBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    for (const line of visibleLines) {
      if (line.kind !== "expense") continue;
      const value = line.monthly[selectedMonthId] ?? 0;
      if (value <= 0) continue;
      totals.set(line.category, roundCurrencyValue((totals.get(line.category) ?? 0) + value));
    }
    return buildFinanceCategoryBreakdown(totals);
  }, [selectedMonthId, visibleLines]);
  const annualCategoryBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    for (const line of visibleLines) {
      if (line.kind !== "expense") continue;
      let total = 0;
      for (const month of financeMonthOrder) {
        total = roundCurrencyValue(total + (line.monthly[month] ?? 0));
      }
      if (total <= 0) continue;
      totals.set(line.category, roundCurrencyValue((totals.get(line.category) ?? 0) + total));
    }
    return buildFinanceCategoryBreakdown(totals);
  }, [visibleLines]);
  const annualInvoiceBase = useMemo(
    () =>
      roundCurrencyValue(
        financeMonthOrder.reduce(
        (sum, month) => sum + (budget.cardInvoiceBase?.[month] ?? 0),
        0,
        ),
      ),
    [budget.cardInvoiceBase],
  );

  const incomeCategories = useMemo(
    () =>
      [...state.financeCategories]
        .filter((category) => category.kind === "income")
        .sort((left, right) => left.name.localeCompare(right.name)),
    [state.financeCategories],
  );
  const expenseCategories = useMemo(
    () =>
      [...state.financeCategories]
        .filter((category) => category.kind === "expense")
        .sort((left, right) => left.name.localeCompare(right.name)),
    [state.financeCategories],
  );
  const draftCategories = draft.kind === "income" ? incomeCategories : expenseCategories;
  const selectedDraftCategory =
    draftCategories.find((category) => category.name === draft.category) ?? null;
  const draftHasContent = Boolean(
    draft.name.trim() || draft.amount.trim() || draft.category.trim(),
  );
  // shoppingSuggestions useMemo removed — the "Sugestões rápidas"
  // panel that consumed it was deleted at the user's request.

  function addLine() {
    if (
      !draft.name.trim() ||
      !draft.category.trim() ||
      parseMoneyInput(draft.amount) <= 0
    ) {
      return;
    }
    actions.addFinanceLine({
      name: draft.name.trim(),
      initialMonth: selectedMonthId,
      initialValue: parseMoneyInput(draft.amount),
      kind: draft.kind,
      category: draft.category.trim(),
      frequency: draft.frequency,
      paymentMethod: draft.paymentMethod,
      dueDay: draft.dueDay ? Number(draft.dueDay) : undefined,
    });
    setDraft({
      name: "",
      amount: "",
      kind: "expense",
      category: "",
      frequency: "fixed",
      paymentMethod: "credit-card",
      dueDay: "",
    });
    setCreatePanelOpen(false);
    setCategoryPanelOpen(false);
  }

  // applyShoppingSuggestion removed alongside the "Sugestões rápidas"
  // panel that called it.

  function addCategory() {
    if (!categoryDraftName.trim()) return;
    actions.addFinanceCategory({
      name: categoryDraftName.trim(),
      kind: draft.kind,
    });
    setDraft((current) => ({
      ...current,
      category: categoryDraftName.trim(),
    }));
    setCategoryPanelOpen(false);
    setCategoryDraftName("");
  }

  function settlementDraftKey(lineId: string) {
    return `${lineId}:${selectedMonthId}`;
  }

  function lineValueDraftKey(lineId: string) {
    return `${lineId}:${selectedMonthId}`;
  }

  function commitInvoiceDraft(month: FinanceMonthId) {
    const rawValue = invoiceDrafts[month];
    if (rawValue === undefined) return;

    const nextValue = Math.max(
      0,
      parseMoneyInput(rawValue) - selectedMonthSettledCardAmount,
    );
    actions.updateFinanceInvoiceBase({
      month,
      value: nextValue,
    });
    setInvoiceDrafts((current) => {
      const nextDrafts = { ...current };
      delete nextDrafts[month];
      return nextDrafts;
    });
  }

  function commitLineMonthValue(lineId: string, rawValue: string) {
    actions.updateFinanceMonthlyValue({
      lineId,
      month: selectedMonthId,
      value: parseMoneyInput(rawValue),
    });
    setLineValueDrafts((current) => {
      const nextDrafts = { ...current };
      delete nextDrafts[lineValueDraftKey(lineId)];
      return nextDrafts;
    });
  }

  function applyPartialSettlement(line: FinanceBudgetLine) {
    const key = settlementDraftKey(line.id);
    const parsedAmount = parseMoneyInput(settlementDrafts[key] ?? "");
    if (parsedAmount <= 0) return;
    requestFinanceConfirmation(
      `${isFinanceCreditCardPaymentMethod(line.paymentMethod) ? "Lançar" : "Dar baixa"} parcial de ${formatCurrency(parsedAmount)} em ${line.name} para ${selectedMonth.label}?`,
      () => {
        actions.applyFinanceSettlement({
          lineId: line.id,
          month: selectedMonthId,
          amount: parsedAmount,
        });
        setSettlementDrafts((current) => ({
          ...current,
          [key]: "",
        }));
      },
    );
  }

  function openPartialSettlementField(
    lineId: string,
    month: FinanceMonthId,
  ) {
    if (typeof document === "undefined") return;

    const inputId = `partial-settlement-${lineId}-${month}`;
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    const details = input?.closest("details");
    if (!details) return;

    details.open = true;
    window.requestAnimationFrame(() => {
      if (!input) return;
      input.focus();
      input.select();
    });
  }

  function requestFinanceConfirmation(
    message: string,
    onConfirm: () => void,
  ) {
    if (typeof window === "undefined") return;
    if (!window.confirm(message)) return;
    onConfirm();
  }

  function renderLineCard(line: FinanceBudgetLine) {
    const monthValue = line.monthly[selectedMonthId];
    const monthValueKey = lineValueDraftKey(line.id);
    const settledAmount = getFinanceSettledAmount(line, selectedMonthId, budget.year);
    const pendingAmount = roundCurrencyValue(Math.max(monthValue - settledAmount, 0));
    const currentMonthIndex = financeMonthOrder.indexOf(selectedMonthId);
    const hasNextMonth = currentMonthIndex >= 0 && currentMonthIndex < financeMonthOrder.length - 1;
    const settlementKey = settlementDraftKey(line.id);
    const partialInputId = `partial-settlement-${line.id}-${selectedMonthId}`;
    const categoryListId =
      line.kind === "income" ? "income-categories" : "expense-categories";
    const dueLabel = line.dueDay ? `Vence dia ${line.dueDay}` : "Sem vencimento";
    const isExpense = line.kind === "expense";
    const isAutoDebit = isFinanceAutoDebitPaymentMethod(line.paymentMethod);
    // Anything categorized as "Combustível" gets a shortcut to the
    // calculator right inside the line card. Match loosely so variants
    // like "combustivel" (no accent) still light up.
    const isFuelLine = /combust/i.test(line.category) || /combust/i.test(line.name);
    const isSettled = isExpense && isFinanceSettledInMonth(line, selectedMonthId, budget.year);
    const isSystemManaged = Boolean(line.managedBySystem);
    const partialSettleLabel = isFinanceCreditCardPaymentMethod(line.paymentMethod)
      ? "Lançamento parcial"
      : "Baixa parcial";
    const totalSettleLabel = isFinanceCreditCardPaymentMethod(line.paymentMethod)
      ? "Lançamento total"
      : "Baixa total";
    const settledLabel = isFinanceCreditCardPaymentMethod(line.paymentMethod)
      ? "Já foi lançado na fatura"
      : "Já foi pago";
    const totalSettleHint =
      pendingAmount > 0
        ? isFinanceCreditCardPaymentMethod(line.paymentMethod)
          ? "Lança todo o valor pendente deste mês na fatura do cartão de crédito."
          : "Dá baixa em todo o valor pendente deste mês e abate isso do saldo disponível."
        : "Desfaz o lançamento completo deste mês e devolve o valor para pendente.";
    const partialSettleHint = isFinanceCreditCardPaymentMethod(line.paymentMethod)
      ? "Lança apenas uma parte do valor deste mês na fatura. Use o campo parcial ao abrir o item."
      : "Dá baixa em apenas uma parte do valor deste mês. Use o campo parcial ao abrir o item.";
    const nextMonthHint =
      "Move só o valor que ainda falta deste mês para o próximo, somando ao valor que já existir lá.";
    const clearSettlementHint =
      "Desfaz todos os lançamentos ou baixas deste mês e devolve o valor para ficar totalmente pendente.";
    const cancelMonthHint =
      "Mantém o que já foi lançado ou pago e remove apenas o restante deste mês.";
    const totalActionConfirmation =
      pendingAmount > 0
        ? `${isFinanceCreditCardPaymentMethod(line.paymentMethod) ? "Lançar" : "Dar baixa"} todo o valor pendente de ${line.name} em ${selectedMonth.label}?`
        : `Desfazer o ${isFinanceCreditCardPaymentMethod(line.paymentMethod) ? "lançamento" : "pagamento"} total de ${line.name} em ${selectedMonth.label}?`;
    const clearActionConfirmation = `Desfazer todos os ${isFinanceCreditCardPaymentMethod(line.paymentMethod) ? "lançamentos" : "pagamentos"} de ${line.name} em ${selectedMonth.label}?`;
    const nextMonthConfirmation = `Passar o valor pendente de ${line.name} para o próximo mês?`;
    const cancelMonthConfirmation = `Remover apenas o valor pendente de ${line.name} em ${selectedMonth.label}?`;
    const deleteLineConfirmation = `Apagar a linha ${line.name} por completo Essa ação remove o gasto de todos os meses.`;

    return (
      <details
        key={line.id}
                  className={`group rounded-sm border ${
          isSettled
            ? "border-white/6 bg-white/[0.03] opacity-70"
            : "border-zinc-800 bg-black/40"
        }`}
      >
        <summary className="list-none cursor-pointer px-4 py-4 [&::-webkit-details-marker]:hidden">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <div className="min-w-0 flex-1">
              <p
                className={`flex items-center gap-2 truncate text-base font-semibold ${
                  isSettled ? "text-zinc-500 line-through" : "text-white"
                }`}
              >
                {/* Ícone das linhas sincronizadas com os módulos correspondentes.
                    Sinaliza que aquela linha não foi criada manualmente: vem do
                    Mercado (ShoppingBag) ou de Suplementos / Remédios (Pill). */}
                {line.sourceKey === "shopping-sync:market" ? (
                  <ShoppingBag
                    className="h-4 w-4 shrink-0 text-amber-300"
                    aria-hidden
                  />
                ) : line.sourceKey === "shopping-sync:supplements" ? (
                  <Pill
                    className="h-4 w-4 shrink-0 text-cyan-300"
                    aria-hidden
                  />
                ) : null}
                <span className="truncate">{line.name}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                {isFuelLine ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      // The whole row is inside <summary>, so a plain click
                      // would also toggle the details panel. Block both
                      // default + propagation, then jump to the calculator.
                      event.preventDefault();
                      event.stopPropagation();
                      setActiveView("fuel");
                    }}
                    title="Abrir calculadora de combustível"
                    className="inline-flex items-center gap-1.5 rounded-sm border border-amber-300/30 bg-amber-300/10 px-2 py-1 font-medium text-amber-100 transition hover:border-amber-300/60 hover:bg-amber-300/15"
                  >
                    <Fuel className="h-3.5 w-3.5" />
                    Calcular
                  </button>
                ) : null}
                <span className="rounded-sm border border-zinc-800 bg-black/20 px-2 py-1">
                  {line.category}
                </span>
                <span className="rounded-sm border border-zinc-800 bg-black/20 px-2 py-1">
                  {formatFinancePaymentMethod(line.paymentMethod)}
                </span>
                <span className="rounded-sm border border-zinc-800 bg-black/20 px-2 py-1">
                  {formatFinanceFrequency(line.frequency)}
                </span>
                <span className="rounded-sm border border-zinc-800 bg-black/20 px-2 py-1">
                  {dueLabel}
                </span>
                {isSettled ? (
                  <span className="rounded-sm border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-emerald-200">
                    {settledLabel}
                  </span>
                ) : null}
                {isSystemManaged ? (
                  <span className="rounded-sm border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-sky-100">
                    Sincronizado automaticamente
                  </span>
                ) : null}
                {isAutoDebit ? (
                  <span className="rounded-sm border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-amber-100">
                    Débito automático
                  </span>
                ) : null}
              </div>
            </div>

            <div className="w-full text-left lg:w-auto lg:shrink-0 lg:text-right">
              <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-600">
                Valor do mês
              </p>
              <p
                className={`mt-1 text-lg font-semibold ${
                  isSettled ? "text-zinc-500 line-through" : "text-white"
                }`}
              >
                {formatCurrency(monthValue)}
              </p>
              {isExpense ? (
                <p className="mt-2 text-xs text-zinc-500">
                  {isFinanceCreditCardPaymentMethod(line.paymentMethod)
                    ? `Na fatura ${formatCurrency(settledAmount)}`
                    : `Abatido ${formatCurrency(settledAmount)}`}{" "}
                  • Falta {formatCurrency(pendingAmount)}
                </p>
              ) : null}
              {isExpense ? (
                <div className="mt-3 flex flex-wrap gap-2 lg:justify-end">
                  <FinanceActionHint text={totalSettleHint}>
                    <button
                      type="button"
                      title={totalSettleHint}
                      aria-label={totalSettleHint}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        requestFinanceConfirmation(
                          totalActionConfirmation,
                          () => {
                            if (pendingAmount > 0) {
                              actions.applyFinanceSettlement({
                                lineId: line.id,
                                month: selectedMonthId,
                                amount: pendingAmount,
                              });
                            } else {
                              actions.clearFinanceSettlement({
                                lineId: line.id,
                                month: selectedMonthId,
                              });
                            }
                          },
                        );
                      }}
                      className={`rounded-sm px-3 py-2 text-[11px] font-medium transition ${
                        isSettled
                          ? "border border-zinc-800 bg-black/60 text-zinc-200 hover:bg-white/10"
                          : isFinanceCreditCardPaymentMethod(line.paymentMethod)
                            ? "border border-amber-400/20 bg-amber-400/10 text-amber-200 hover:bg-amber-400/15"
                            : "border border-amber-400/20 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15"
                      }`}
                    >
                      {pendingAmount > 0 ? totalSettleLabel : "Desfazer total"}
                    </button>
                  </FinanceActionHint>
                  <FinanceActionHint text={partialSettleHint}>
                    <button
                      type="button"
                      title={partialSettleHint}
                      aria-label={partialSettleHint}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (
                          parseMoneyInput(settlementDrafts[settlementKey] ?? "") > 0
                        ) {
                          applyPartialSettlement(line);
                          return;
                        }

                        openPartialSettlementField(line.id, selectedMonthId);
                      }}
                      disabled={pendingAmount <= 0}
                      className="rounded-sm border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[11px] font-medium text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {partialSettleLabel}
                    </button>
                  </FinanceActionHint>
                  <FinanceActionHint text={nextMonthHint}>
                    <button
                      type="button"
                      title={nextMonthHint}
                      aria-label={nextMonthHint}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        requestFinanceConfirmation(
                          nextMonthConfirmation,
                          () => {
                            actions.rollFinanceLineToNextMonth({
                              lineId: line.id,
                              month: selectedMonthId,
                            });
                          },
                        );
                      }}
                      disabled={!hasNextMonth || pendingAmount <= 0}
                      className="rounded-sm border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-[11px] font-medium text-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Passar pro próximo mês
                    </button>
                  </FinanceActionHint>
                  <FinanceActionHint text={clearSettlementHint}>
                    <button
                      type="button"
                      title={clearSettlementHint}
                      aria-label={clearSettlementHint}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        requestFinanceConfirmation(
                          clearActionConfirmation,
                          () => {
                            actions.clearFinanceSettlement({
                              lineId: line.id,
                              month: selectedMonthId,
                            });
                          },
                        );
                      }}
                      className="rounded-sm border border-zinc-800 bg-black/60 px-3 py-2 text-[11px] font-medium text-zinc-200"
                    >
                      Desfazer
                    </button>
                  </FinanceActionHint>
                  <FinanceActionHint text={cancelMonthHint}>
                    <button
                      type="button"
                      title={cancelMonthHint}
                      aria-label={cancelMonthHint}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        requestFinanceConfirmation(
                          cancelMonthConfirmation,
                          () => {
                            actions.cancelFinanceLineMonth({
                              lineId: line.id,
                              month: selectedMonthId,
                            });
                          },
                        );
                      }}
                      disabled={pendingAmount <= 0}
                    className="rounded-sm border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-[11px] font-medium text-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Remover deste mês
                  </button>
                </FinanceActionHint>
                  {!isSystemManaged ? (
                    <FinanceActionHint text="Apaga esta linha do orçamento em todos os meses.">
                      <button
                        type="button"
                        title="Apagar gasto"
                        aria-label="Apagar gasto"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          requestFinanceConfirmation(
                            deleteLineConfirmation,
                            () => {
                              actions.removeFinanceLine(line.id);
                            },
                          );
                        }}
                        className="grid h-9 w-9 place-items-center rounded-sm border border-rose-400/20 bg-rose-400/10 text-rose-100 transition hover:bg-rose-400/15"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </FinanceActionHint>
                  ) : null}
                </div>
              ) : null}
              {isSettled ? (
                <p className="mt-2 text-xs text-zinc-600">
                  {isFinanceCreditCardPaymentMethod(line.paymentMethod)
                    ? "Esse valor já entrou na fatura."
                    : "Esse valor já foi abatido das receitas."}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-zinc-600 group-open:hidden">
                {isSystemManaged ? "Linha automática" : "Toque para editar"}
              </p>
              <p className="mt-2 hidden text-xs text-[var(--accent)] group-open:block">
                Recolher
              </p>
            </div>
          </div>
        </summary>

        <div className="border-t border-zinc-800 px-4 pb-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-3">
              <div className="grid gap-3 lg:grid-cols-[1.4fr_180px]">
                <input
                  value={line.name}
                  onChange={(event) =>
                    actions.updateFinanceLine({
                      lineId: line.id,
                      patch: { name: event.target.value },
                    })
                  }
                  disabled={isSystemManaged}
                  className="w-full rounded-sm border border-zinc-800 bg-black/60 px-4 py-3 text-white"
                  placeholder="Descrição"
                />
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-500">
                    R$
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={lineValueDrafts[monthValueKey] ?? formatMoneyInputBR(monthValue)}
                    onChange={(event) =>
                      setLineValueDrafts((current) => ({
                        ...current,
                        [monthValueKey]: event.target.value,
                      }))
                    }
                    onBlur={(event) =>
                      commitLineMonthValue(line.id, event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                    }}
                    disabled={isSystemManaged}
                    className="w-full rounded-sm border border-zinc-800 bg-black/60 py-3 pl-12 pr-4 text-right font-semibold text-white disabled:opacity-50"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.1fr_150px_170px_140px_150px]">
                <input
                  list={categoryListId}
                  value={line.category}
                  onChange={(event) =>
                    actions.updateFinanceLine({
                      lineId: line.id,
                      patch: { category: event.target.value },
                    })
                  }
                  disabled={isSystemManaged}
                  className="w-full rounded-sm border border-zinc-800 bg-black/60 px-4 py-3 text-white"
                  placeholder="Categoria"
                />

                <select
                  value={line.frequency}
                  onChange={(event) =>
                    actions.updateFinanceLine({
                      lineId: line.id,
                      contextMonth: selectedMonthId,
                      patch: {
                        frequency: event.target.value as FinanceLineFrequency,
                      },
                    })
                  }
                  disabled={isSystemManaged}
                  className="w-full rounded-sm border border-zinc-800 bg-black/60 px-4 py-3 text-white"
                >
                  {frequencyOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatFinanceFrequency(option)}
                    </option>
                  ))}
                </select>

                <select
                  value={line.paymentMethod}
                  onChange={(event) =>
                    actions.updateFinanceLine({
                      lineId: line.id,
                      contextMonth: selectedMonthId,
                      patch: {
                        paymentMethod:
                          event.target.value as FinancePaymentMethod,
                      },
                    })
                  }
                  className="w-full rounded-sm border border-zinc-800 bg-black/60 px-4 py-3 text-white"
                >
                  {paymentOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatFinancePaymentMethod(option)}
                    </option>
                  ))}
                </select>

                <div className="space-y-2">
                  <div className="px-1 text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                    Vencimento
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={line.dueDay ?? ""}
                    onChange={(event) =>
                      actions.updateFinanceLine({
                        lineId: line.id,
                        patch: {
                          dueDay: event.target.value
                            ? Number(event.target.value)
                            : undefined,
                        },
                      })
                    }
                    disabled={isSystemManaged}
                    className="w-full rounded-sm border border-zinc-800 bg-black/60 px-4 py-3 text-white"
                    placeholder="Ex.: 10"
                  />
                </div>

                <div className="rounded-sm border border-zinc-800 bg-black/20 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-600">
                    Total anual
                  </p>
                  <p className="mt-1 font-semibold text-white">
                    {formatCurrency(sumFinanceLine(line))}
                  </p>
                </div>
              </div>

              <div className="rounded-sm border border-amber-400/15 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
                {isSystemManaged
                  ? "Essa linha é atualizada automaticamente pelos módulos Mercado ou Suplementos. O valor vem da origem, mas a forma de pagamento pode ser ajustada aqui."
                  : line.frequency === "fixed"
                    ? "Item fixo: categoria, pagamento e vencimento valem para todos os meses. Se você alterar o valor, ele replica no ano inteiro."
                    : "Categoria, pagamento e vencimento alteram a linha inteira. O que continua mensal aqui e apenas o valor do mês selecionado."}
              </div>

              {isExpense ? (
                <div className="grid gap-3 lg:grid-cols-[170px_170px_1fr]">
                  <div className="rounded-sm border border-zinc-800 bg-black/20 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-600">
                      Já lançado
                    </p>
                    <p className="mt-1 font-semibold text-white">
                      {formatCurrency(settledAmount)}
                    </p>
                  </div>
                  <div className="rounded-sm border border-zinc-800 bg-black/20 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-600">
                      Falta
                    </p>
                    <p className="mt-1 font-semibold text-white">
                      {formatCurrency(pendingAmount)}
                    </p>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[1fr_170px]">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-500">
                        R$
                      </span>
                      <input
                        id={partialInputId}
                        type="text"
                        inputMode="decimal"
                        value={settlementDrafts[settlementKey] ?? ""}
                        onChange={(event) =>
                          setSettlementDrafts((current) => ({
                            ...current,
                            [settlementKey]: event.target.value,
                          }))
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            applyPartialSettlement(line);
                          }
                        }}
                        className="w-full rounded-sm border border-zinc-800 bg-black/60 py-3 pl-12 pr-4 text-right font-semibold text-white"
                        placeholder="Valor parcial"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => applyPartialSettlement(line)}
                      disabled={parseMoneyInput(settlementDrafts[settlementKey] ?? "") <= 0}
                      className="rounded-sm border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Aplicar parcial
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() =>
                requestFinanceConfirmation(deleteLineConfirmation, () => {
                  actions.removeFinanceLine(line.id);
                })
              }
              className="rounded-sm border border-rose-400/20 bg-rose-400/10 p-3 text-rose-200 transition hover:bg-rose-400/15"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </details>
    );
  }

  function renderBreakdownChart(
    title: string,
    description: string,
    items: FinanceCategoryBreakdownItem[],
    uncategorizedValue = 0,
  ) {
    return (
      <GlassPanel className="space-y-4">
        <div>
          <p className="text-sm text-zinc-500">{title}</p>
          <h3 className="mt-1 text-2xl font-semibold text-white">
            Gastos por categoria
          </h3>
          <p className="mt-2 text-sm text-zinc-600">{description}</p>
        </div>

        {items.length ? (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.category} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">
                      {item.category}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {item.share.toFixed(1)}% do total
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold text-white">
                    {formatCurrency(item.value)}
                  </p>
                </div>
                <div className="h-2 overflow-hidden rounded-sm bg-white/8">
                  <div
                    className={`h-full rounded-sm ${item.toneClass}`}
                    style={{ width: `${Math.max(item.share, 6)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-sm border border-dashed border-zinc-800 bg-black/20 px-4 py-5 text-sm text-zinc-600">
                    Ainda não há gastos lançados o suficiente para gerar este gráfico.
          </div>
        )}

        {uncategorizedValue > 0 ? (
          <div className="rounded-sm border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                    Há {formatCurrency(uncategorizedValue)} na fatura do cartão de crédito sem categoria detalhada.
          </div>
        ) : null}
      </GlassPanel>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mod-hero">
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div className="mod-icon" style={{ width: 56, height: 56, borderRadius: 14, fontSize: 24 }}>💰</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="praxis-label" style={{ color: "var(--accent)", marginBottom: 4 }}>▸ MÓDULO · FINANÇAS</div>
            <div className="praxis-title" style={{ fontSize: 26 }}>Painel mensal</div>
            <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
              Receitas, fatura, gastos pendentes e sugestões de compra no mesmo lugar.
            </div>
          </div>
        </div>
      </div>

      {/* Seção de resumo (Mês ativo / Saldo / Receitas / Gastos / Linhas
          ativas) removida a pedido — os números já aparecem ao longo do
          orçamento. Mantém só o painel de upgrade pra usuários free. */}
      {!entitlement.hasFullAccess ? (
        <GlassPanel className="space-y-4 border-[rgba(251,146,60,0.16)] bg-[linear-gradient(180deg,rgba(22,16,8,0.96),rgba(8,8,10,0.94))] p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="praxis-label text-[var(--accent)]">Plano premium</p>
              <h3 className="praxis-title mt-2 text-2xl">
                Ative o fluxo guiado para fechar o mês com menos atrito.
              </h3>
            </div>
            <BadgeDollarSign className="h-6 w-6 text-[var(--accent)]" />
          </div>

          <p className="text-sm leading-6 text-zinc-500">
            O Praxis fica mais forte quando o financeiro conversa com o que
            você compra, consome e paga. O upgrade abre uma leitura mais
            direta do seu ciclo.
          </p>

          <div className="space-y-3">
            {financePremiumHighlights.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-sm border border-zinc-800 bg-black/30 px-4 py-3"
              >
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                <p className="text-sm leading-6 text-zinc-300">{item}</p>
              </div>
            ))}
          </div>

          <StripeCheckoutButton
            source="finance-module"
            className="w-full rounded-sm border-[rgba(251,146,60,0.18)] bg-[linear-gradient(135deg,var(--accent)_0%,#fbbf24_100%)] px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_40px_rgba(251,146,60,0.22)]"
            noteClassName="text-zinc-500"
            errorClassName="text-amber-200"
          >
            Ver planos e fazer upgrade
          </StripeCheckoutButton>
        </GlassPanel>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveView("budget")}
          className={`inline-flex items-center gap-2 rounded-sm border px-4 py-2 text-sm font-medium transition ${
            activeView === "budget"
              ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
              : "border-zinc-800 bg-black/40 text-zinc-300 hover:border-white/20"
          }`}
        >
          <Landmark className="h-4 w-4" />
          Orçamento
        </button>
        <button
          type="button"
          onClick={() => setActiveView("fuel")}
          className={`inline-flex items-center gap-2 rounded-sm border px-4 py-2 text-sm font-medium transition ${
            activeView === "fuel"
              ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
              : "border-zinc-800 bg-black/40 text-zinc-300 hover:border-white/20"
          }`}
        >
          <Fuel className="h-4 w-4" />
          Combustível
        </button>
      </div>

      <div className={activeView === "budget" ? "space-y-6" : "hidden"}>
        <datalist id="income-categories">
          {incomeCategories.map((category) => (
            <option key={category.id} value={category.name} />
          ))}
        </datalist>
        <datalist id="expense-categories">
          {expenseCategories.map((category) => (
            <option key={category.id} value={category.name} />
          ))}
        </datalist>

        <GlassPanel className="space-y-4">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-6 w-6 text-[var(--accent)]" />
          <div>
            <p className="text-sm text-zinc-500">Mês ativo</p>
            <h2 className="text-2xl font-semibold text-white">
              {selectedMonth.label}
            </h2>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {plannedMonths.map((month) => (
            <button
              key={month.id}
              type="button"
              onClick={() => setSelectedMonthId(month.id)}
              className={`min-w-[92px] rounded-sm border px-3 py-3 text-left transition ${
                selectedMonth.id === month.id
                  ? "border-amber-300/30 bg-amber-300/10"
                  : "border-zinc-800 bg-black/40"
              }`}
            >
              <p className="text-sm text-zinc-500">{month.label}</p>
              <p
                className={`mt-1 text-sm font-semibold ${
                  month.plannedBalance < 0 ? "text-rose-300" : "text-[var(--accent)]"
                }`}
              >
                {formatCurrency(month.plannedBalance)}
              </p>
              <div className="mt-2 space-y-1 text-xs text-zinc-600">
                <p>Receita: {formatCurrency(month.income)}</p>
                <p>Gastos: {formatCurrency(month.plannedExpenses)}</p>
                <p>
                  {month.plannedBalance < 0 ? "Falta" : "Sobra"}:{" "}
                  {formatCurrency(Math.abs(month.plannedBalance))}
                </p>
              </div>
            </button>
          ))}
        </div>
      </GlassPanel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <GlassPanel>
          <p className="text-sm text-zinc-500">Resultado do mês</p>
          <p className="text-xs text-zinc-600">Receita, gastos planejados e saldo final</p>
          <p
            className={`mt-3 text-3xl font-semibold ${
              selectedMonthPlannedBalance < 0 ? "text-rose-300" : "text-[var(--accent)]"
            }`}
          >
            {formatCurrency(selectedMonthPlannedBalance)}
          </p>
          <div className="mt-3 space-y-1 text-sm text-zinc-500">
            <p>Receitas: {formatCurrency(selectedMonth.income)}</p>
            <p>Gastos: {formatCurrency(selectedMonthExpenseTotal)}</p>
            <p>
              {selectedMonthPlannedBalance < 0 ? "Faltando" : "Sobrando"}:{" "}
              {formatCurrency(Math.abs(selectedMonthPlannedBalance))}
            </p>
          </div>
        </GlassPanel>
        <GlassPanel>
          <p className="text-sm text-zinc-500">Receitas</p>
          <p className="mt-3 text-3xl font-semibold text-[var(--accent)]">
            {formatCurrency(selectedMonth.income)}
          </p>
        </GlassPanel>
        <GlassPanel>
          <p className="text-sm text-zinc-500">{invoiceTitle}</p>
          <p className="text-xs text-zinc-600">Só o que já foi lançado na fatura</p>
          <p className="mt-3 text-3xl font-semibold text-[var(--accent)]">
            {formatCurrency(selectedMonth.cardExpenses)}
          </p>
        </GlassPanel>
        <GlassPanel>
          <p className="text-sm text-zinc-500">Saídas imediatas</p>
          <p className="text-xs text-zinc-600">Aparecem aqui depois de dar baixa</p>
          <p className="mt-3 text-3xl font-semibold text-[var(--accent)]">
            {formatCurrency(selectedMonth.cashExpenses)}
          </p>
        </GlassPanel>
      </div>

      <GlassPanel className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-500">Receitas do mês</p>
            <h2 className="text-2xl font-semibold text-white">
              {formatCurrency(selectedMonth.income)}
            </h2>
          </div>
          <div className="rounded-sm border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-[var(--accent)]">
            {incomeLines.length} linhas
          </div>
        </div>
        <div className="space-y-3">
          {incomeLines.map(renderLineCard)}
        </div>
      </GlassPanel>

      <GlassPanel className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-500">Novo lançamento</p>
            <h2 className="text-2xl font-semibold text-white">
              Adicionar receita ou gasto
            </h2>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <select
              value={expenseSort}
              onChange={(event) => setExpenseSort(event.target.value as ExpenseSortMode)}
              aria-label="Ordenação dos gastos"
              className="w-full rounded-sm border border-zinc-800 bg-black/60 px-3 py-2.5 text-sm text-white sm:w-auto"
            >
              <option value="due-date">Por vencimento</option>
              <option value="highest-value">Maior valor</option>
              <option value="lowest-value">Menor valor</option>
            </select>
            <button
              type="button"
              onClick={() => setCreatePanelOpen((current) => !current)}
              aria-label={createPanelOpen ? "Fechar formulário" : "Adicionar receita ou gasto"}
              title={createPanelOpen ? "Fechar formulário" : "Adicionar receita ou gasto"}
              className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-sm bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-2)_100%)] px-6 py-3.5 text-base font-semibold text-slate-950 shadow-[0_0_20px_rgba(251,146,60,0.4)] transition hover:brightness-110 sm:w-auto"
            >
              <Plus
                className={`h-5 w-5 transition ${
                  createPanelOpen ? "rotate-45" : ""
                }`}
              />
              {createPanelOpen ? "Fechar" : "Adicionar receita ou gasto"}
            </button>
          </div>
        </div>

        {draftHasContent ? (
          <div className="rounded-sm border border-zinc-800 bg-black/40 px-4 py-4 text-sm text-zinc-300">
            {`Rascunho atual: ${draft.kind === "income" ? "Receita" : "Gasto"}${draft.name.trim() ? ` - ${draft.name.trim()}` : ""}${draft.amount.trim() ? ` - ${draft.amount.trim()}` : ""}`}
          </div>
        ) : null}

        {createPanelOpen ? (
          <>
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_220px]">
              <div className="space-y-2">
                <div className="px-1 text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                  Descrição
                </div>
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Ex.: Internet, mercado, salário"
                  className="w-full rounded-sm border border-zinc-800 bg-black/60 px-4 py-3 text-white placeholder:text-zinc-600"
                />
              </div>

              <div className="space-y-2">
                <div className="px-1 text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                  Valor em {selectedMonth.label} (R$)
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-400">
                    R$
                  </span>
                  <input
                    value={draft.amount}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, amount: event.target.value }))
                    }
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    className="w-full rounded-sm border border-zinc-800 bg-black/60 py-3 pl-12 pr-4 text-right font-semibold text-white placeholder:text-zinc-600"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <div className="px-1 text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                  Tipo
                </div>
                <select
                  value={draft.kind}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      kind: event.target.value as FinanceLineKind,
                      category: "",
                      dueDay: "",
                    }))
                  }
                  className="w-full rounded-sm border border-zinc-800 bg-black/60 px-4 py-3 text-white"
                >
                  <option value="expense">Gasto</option>
                  <option value="income">Receita</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="px-1 text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                  Frequencia
                </div>
                <select
                  value={draft.frequency}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      frequency: event.target.value as FinanceLineFrequency,
                    }))
                  }
                  className="w-full rounded-sm border border-zinc-800 bg-black/60 px-4 py-3 text-white"
                >
                  {frequencyOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatFinanceFrequency(option)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="px-1 text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                  Pagamento
                </div>
                <select
                  value={draft.paymentMethod}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      paymentMethod: event.target.value as FinancePaymentMethod,
                    }))
                  }
                  className="w-full rounded-sm border border-zinc-800 bg-black/60 px-4 py-3 text-white"
                >
                  {paymentOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatFinancePaymentMethod(option)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="px-1 text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                  Vencimento
                </div>
                <input
                  value={draft.dueDay}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      dueDay: event.target.value,
                    }))
                  }
                  placeholder={draft.kind === "income" ? "Opcional" : "Ex.: 10"}
                  type="number"
                  min="1"
                  max="31"
                  disabled={draft.kind === "income"}
                  className="w-full rounded-sm border border-zinc-800 bg-black/60 px-4 py-3 text-white placeholder:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>

                <div className="rounded-sm border border-zinc-800 bg-black/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-500">Categoria</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    Escolha uma categoria existente ou crie uma nova sem ocupar o
                    formulário inteiro.
                  </p>
                </div>
                <div className="rounded-sm border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-zinc-500">
                  {draftCategories.length} categorias
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCategoryPanelOpen((current) => !current)}
                className="mt-4 flex w-full items-center justify-between rounded-sm border border-zinc-800 bg-black/60 px-4 py-3 text-left transition hover:border-white/20"
              >
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                    Categoria selecionada
                  </p>
                  <p className="mt-1 truncate font-medium text-white">
                    {selectedDraftCategory
                      ? `${selectedDraftCategory.icon} ${selectedDraftCategory.name}`
                      : "Escolher categoria"}
                  </p>
                </div>
                <ChevronDown
                  className={`h-5 w-5 text-zinc-500 transition ${
                    categoryPanelOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {categoryPanelOpen ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {draftCategories.map((category) => {
                      const selected = draft.category === category.name;
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => {
                            setDraft((current) => ({
                              ...current,
                              category: category.name,
                            }));
                            setCategoryPanelOpen(false);
                          }}
                          className={`flex min-w-0 items-center gap-3 rounded-sm border px-3 py-3 text-left text-sm transition ${
                            selected
                              ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
                              : "border-zinc-800 bg-black/40 text-zinc-300 hover:bg-white/8"
                          }`}
                        >
                          <span className="shrink-0 text-base">{category.icon}</span>
                          <span className="truncate">{category.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
                    <input
                      value={categoryDraftName}
                      onChange={(event) => setCategoryDraftName(event.target.value)}
                      placeholder="Criar nova categoria"
                      className="w-full rounded-sm border border-zinc-800 bg-black/60 px-4 py-3 text-white placeholder:text-zinc-600"
                    />
                    <button
                      type="button"
                      onClick={addCategory}
                      className="rounded-sm border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 font-medium text-emerald-100 transition hover:bg-emerald-400/15"
                    >
                      Criar categoria
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={addLine}
              className="w-full rounded-sm bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-2)_100%)] px-4 py-3 font-semibold text-slate-950"
            >
              Adicionar
            </button>

            <p className="text-sm text-zinc-600">
              Lançamentos fixos replicam o valor em todos os meses. Lançamentos variáveis valem
              só no mês ativo e os próximos meses ficam zerados.
            </p>

            {/* "Sugestões rápidas · Itens vindos de Mercado e Suplementos"
                bloco removido a pedido do usuário — Mercado/Suplementos
                já sincronizam via as linhas Mercado/Suplementos
                sincronizados em finanças, então o atalho duplicava
                trabalho. */}
          </>
        ) : null}
      </GlassPanel>

      <div className="space-y-6">
        <GlassPanel className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-500">{invoiceTitle}</p>
              <p className="text-xs text-zinc-600">
                Clique em um gasto para mover ele para a fatura
              </p>
              <h2 className="text-2xl font-semibold text-white">
                {formatCurrency(selectedMonth.cardExpenses)}
              </h2>
            </div>
            <div className="rounded-sm border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-[var(--accent)]">
              {cardExpenseLines.length} linhas
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <div className="rounded-sm border border-zinc-800 bg-black/20 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-600">
                Já lançado na fatura
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Total que já caiu no cartão, somando a base manual e os lançamentos feitos abaixo.
              </p>
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={
                invoiceDrafts[selectedMonthId] ??
                formatMoneyInputBR(selectedMonthInvoiceLaunchedTotal)
              }
              onChange={(event) =>
                setInvoiceDrafts((current) => ({
                  ...current,
                  [selectedMonthId]: event.target.value,
                }))
              }
              onBlur={() => commitInvoiceDraft(selectedMonthId)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              className="w-full rounded-sm border border-zinc-800 bg-black/60 px-4 py-3 text-right font-semibold text-white"
              placeholder="Total lançado na fatura"
            />
          </div>
          <div className="space-y-3">
            {cardExpenseLines.map(renderLineCard)}
          </div>
        </GlassPanel>

        <GlassPanel className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-500">Saídas imediatas</p>
              <p className="text-xs text-zinc-600">
                Pix, débito, boleto, transferência e dinheiro so entram aqui depois da baixa
              </p>
              <h2 className="text-2xl font-semibold text-white">
                {formatCurrency(selectedMonth.cashExpenses)}
              </h2>
            </div>
            <div className="rounded-sm border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-[var(--accent)]">
              {nonCardExpenseLines.length} linhas
            </div>
          </div>
          <div className="space-y-3">
            {nonCardExpenseLines.map(renderLineCard)}
          </div>
        </GlassPanel>
      </div>

        <details className="group">
        <summary className="list-none">
          <GlassPanel className="cursor-pointer">
            <div className="flex items-center gap-3">
              <Landmark className="h-6 w-6 text-[var(--accent)]" />
              <div>
                <p className="text-sm text-zinc-500">Detalhamento financeiro</p>
                <h2 className="text-2xl font-semibold text-white">
                  Gráficos e consolidado
                </h2>
              </div>
            </div>
          </GlassPanel>
        </summary>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <GlassPanel>
            <p className="text-sm text-zinc-500">Receita anual</p>
            <p className="mt-3 text-3xl font-semibold text-[var(--accent)]">
              {formatCurrency(annualIncome)}
            </p>
          </GlassPanel>
          <GlassPanel>
            <p className="text-sm text-zinc-500">Saídas imediatas no ano</p>
            <p className="text-xs text-zinc-600">Pix, boleto, débito, débito automático, dinheiro e transferência</p>
            <p className="mt-3 text-3xl font-semibold text-[var(--accent)]">
              {formatCurrency(annualNonCardExpenses)}
            </p>
          </GlassPanel>
          <GlassPanel>
            <p className="text-sm text-zinc-500">{invoiceTitle}</p>
            <p className="text-xs text-zinc-600">Compromissos acumulados no crédito</p>
            <p className="mt-3 text-3xl font-semibold text-[var(--accent)]">
              {formatCurrency(annualCardExpenses)}
            </p>
          </GlassPanel>
          <GlassPanel>
            <p className="text-sm text-zinc-500">Resultado do ano</p>
            <p className="text-xs text-zinc-600">Receitas menos todos os gastos planejados</p>
            <p
              className={`mt-3 text-3xl font-semibold ${
                annualOperatingBalance < 0 ? "text-rose-300" : "text-[var(--accent)]"
              }`}
            >
              {formatCurrency(annualOperatingBalance)}
            </p>
          </GlassPanel>
          <GlassPanel>
            <p className="text-sm text-zinc-500">Gastos totais no ano</p>
            <p className="text-xs text-zinc-600">Inclui saídas imediatas e a fatura do cartão de crédito</p>
            <p className="mt-3 text-3xl font-semibold text-rose-300">
              {formatCurrency(annualExpenses)}
            </p>
          </GlassPanel>
          <GlassPanel>
            <p className="text-sm text-zinc-500">Saldo final projetado</p>
            <p className="text-xs text-zinc-600">Resultado do ano mais a reserva inicial</p>
            <p
              className={`mt-3 text-3xl font-semibold ${
                annualBalance < 0 ? "text-rose-300" : "text-[var(--accent)]"
              }`}
            >
              {formatCurrency(annualBalance)}
            </p>
          </GlassPanel>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {renderBreakdownChart(
            `Detalhamento de ${selectedMonth.label}`,
            "Mostra o peso de cada categoria no mês selecionado, considerando todos os gastos categorizados.",
            monthlyCategoryBreakdown,
            selectedMonthInvoiceBase,
          )}
          {renderBreakdownChart(
            "Detalhamento anual",
            "Consolidado das categorias que mais pesaram no ano inteiro.",
            annualCategoryBreakdown,
            annualInvoiceBase,
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {detailedMonths.map((month) => (
            <GlassPanel key={month.id}>
              <div className="flex items-center justify-between">
                <p className="font-medium text-white">{month.label}</p>
                <p
                  className={`font-semibold ${
                    month.balance < 0 ? "text-rose-300" : "text-[var(--accent)]"
                  }`}
                >
                  {formatCurrency(month.balance)}
                </p>
              </div>
              <div className="mt-3 space-y-1 text-sm text-zinc-500">
                <p>Receitas: {formatCurrency(month.income)}</p>
                <p>Cartão: {formatCurrency(month.cardExpenses)}</p>
                <p>Fora do cartão: {formatCurrency(month.cashExpenses)}</p>
              </div>
            </GlassPanel>
          ))}
        </div>
        </details>

        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() =>
              requestFinanceConfirmation(
                `Fechar o mês de ${selectedMonth.label}? Todas as linhas (fixas e variáveis) ficam zeradas apenas neste mês — nenhum outro mês é alterado. Fatura do cartão e baixas do mês também são limpas.`,
                () => {
                  // Atomic close-month: a dedicated reducer that only
                  // touches `selectedMonthId` on variable lines, plus
                  // clears settlement / cardInvoiceBase for the month.
                  //
                  // Why this replaced the per-line `updateFinanceMonthlyValue`
                  // loop: that action's reducer fan-outs through ALL 12
                  // months for `frequency: "fixed"` lines (so the user
                  // could keep a uniform value with one keystroke), and
                  // close-month was inadvertently triggering that
                  // fan-out — wiping every month on every fixed line
                  // (salário, internet, energia, etc.) instead of just
                  // the month being closed.
                  actions.closeFinanceMonth(selectedMonthId);
                },
              )
            }
            className="inline-flex items-center gap-2 rounded-sm border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm font-medium text-rose-200 transition hover:border-rose-400/50 hover:bg-rose-400/15"
          >
            <Trash2 className="h-4 w-4" />
            Fechar mês de {selectedMonth.label}
          </button>
        </div>
      </div>

      {activeView === "fuel" ? <FinanceFuelPlanner /> : null}
    </div>
  );
}




