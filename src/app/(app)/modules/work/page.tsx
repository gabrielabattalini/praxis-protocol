"use client";

import { useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  Clock3,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import type { Weekday, WorkControlEntry, WorkControlStatus } from "@/lib/types";
import { isTaskCompletedForDate } from "@/lib/utils";
import {
  getWorkControlRemainingDays,
  getWorkControlStatus,
  isWorkControlCompleted,
} from "@/lib/work-control";

const fieldClassName = "praxis-field w-full min-w-0 px-3 py-2.5 text-sm";
const compactFieldClassName = "praxis-field w-full min-w-0 px-3 py-2 text-sm";

const entryTypeOptions = [
  "Peti\u00e7\u00e3o",
  "Relat\u00f3rio",
  "Manifesta\u00e7\u00e3o",
  "An\u00e1lise",
  "Revis\u00e3o",
  "Audi\u00eancia",
  "Prazo interno",
];

const progressOptions = [
  "Pendente",
  "Em andamento",
  "Aguardando",
  "Corre\u00e7\u00e3o",
  "Conclu\u00eddo",
];

type SortOption =
  | "urgency"
  | "deadline-asc"
  | "deadline-desc"
  | "client"
  | "type";

type EntryDraft = Omit<WorkControlEntry, "id">;

type WorkSheetRow = {
  entry: WorkControlEntry;
  remainingDays: number | null;
  status: WorkControlStatus;
  completed: boolean;
};

const statusOptions: Array<WorkControlStatus | "Todos"> = [
  "Todos",
  "Vencido",
  "Hoje",
  "Urgente",
  "Atenção",
  "Normal",
  "Sem prazo",
];

const statusWeight: Record<WorkControlStatus, number> = {
  Vencido: 0,
  Hoje: 1,
  Urgente: 2,
  Atenção: 3,
  Normal: 4,
  "Sem prazo": 5,
};

function repairText(value?: string) {
  if (!value) return "";
  let nextValue = value;

  for (let index = 0; index < 3; index += 1) {
    if (!(nextValue.includes("\u00c3") || nextValue.includes("\u00e2"))) break;
    try {
      nextValue = decodeURIComponent(escape(nextValue));
    } catch {
      break;
    }
  }

  return nextValue;
}

function getTodayWeekday(date = new Date()): Weekday {
  const mapping: Record<number, Weekday> = {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
  };

  return mapping[date.getDay()];
}

function isTaskDueOnDate(
  recurrence: {
    kind: string;
    weekdays?: Weekday[];
    weekday?: Weekday;
    dayOfMonth?: number;
  },
  date: Date,
  weekday: Weekday,
) {
  switch (recurrence.kind) {
    case "daily":
      return true;
    case "selected-weekdays":
      return recurrence.weekdays?.includes(weekday) ?? false;
    case "weekly-fixed":
      return recurrence.weekday === weekday;
    case "monthly":
      return recurrence.dayOfMonth === date.getDate();
    case "times-per-week":
      return true;
    case "one-time":
    default:
      return true;
  }
}

function formatDateLabel(value?: string) {
  if (!value) return "\u2014";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "\u2014";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatRemainingLabel(value: number | null) {
  if (value === null) return "Sem prazo";
  if (value < 0) return `${Math.abs(value)}d atrasado`;
  if (value === 0) return "Hoje";
  if (value === 1) return "1 dia";
  return `${value} dias`;
}

function getStatusClasses(status: WorkControlStatus) {
  switch (repairText(status)) {
    case "Vencido":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "Hoje":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    case "Urgente":
      return "border-orange-500/30 bg-orange-500/10 text-orange-200";
    case "Atenção":
      return "border-yellow-500/30 bg-yellow-500/10 text-yellow-200";
    case "Sem prazo":
      return "border-zinc-700 bg-zinc-900/70 text-zinc-400";
    case "Normal":
    default:
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }
}

function createEmptyEntryDraft(): EntryDraft {
  const today = new Date().toISOString().slice(0, 10);

  return {
    clientName: "",
    referenceNumber: "",
    entryType: "Peti\u00e7\u00e3o",
    startDate: today,
    fatalDeadline: today,
    progressLabel: "Pendente",
    notes: "",
  };
}

function buildRowSummary(row: WorkSheetRow) {
  return `${repairText(row.entry.entryType)} \u2022 ${formatDateLabel(
    row.entry.fatalDeadline,
  )} \u2022 ${formatRemainingLabel(row.remainingDays)}`;
}

function EditableField({
  value,
  onCommit,
  className = compactFieldClassName,
  placeholder,
  type = "text",
  list,
}: {
  value?: string;
  onCommit: (value: string) => void;
  className?: string;
  placeholder?: string;
  type?: "text" | "date";
  list?: string;
}) {
  const [draft, setDraft] = useState(value ?? "");

  function commit() {
    const nextValue = draft.trim();
    const currentValue = (value ?? "").trim();
    if (nextValue !== currentValue) {
      onCommit(nextValue);
    }
  }

  return (
    <input
      type={type}
      value={draft}
      list={list}
      placeholder={placeholder}
      className={className}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function EditableTextarea({
  value,
  onCommit,
  placeholder,
}: {
  value?: string;
  onCommit: (value: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value ?? "");

  function commit() {
    const nextValue = draft.trim();
    const currentValue = (value ?? "").trim();
    if (nextValue !== currentValue) {
      onCommit(nextValue);
    }
  }

  return (
    <textarea
      value={draft}
      placeholder={placeholder}
      rows={4}
      className="praxis-field min-h-[108px] w-full resize-y px-3 py-3 text-sm leading-6"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
    />
  );
}

export default function WorkModulePage() {
  const { state, actions } = useAppStore();
  const today = useMemo(() => new Date(), []);
  const todayWeekday = getTodayWeekday(today);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<WorkControlStatus | "Todos">(
    "Todos",
  );
  const [sortBy, setSortBy] = useState<SortOption>("urgency");
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [showNewRow, setShowNewRow] = useState(false);
  const [draft, setDraft] = useState<EntryDraft>(createEmptyEntryDraft);

  const workSheetRows = useMemo<WorkSheetRow[]>(() => {
    return state.workControlEntries.map((entry) => {
      const remainingDays = getWorkControlRemainingDays(entry.fatalDeadline, today);
      const status = getWorkControlStatus(entry, today);
      const completed = isWorkControlCompleted(entry.progressLabel);

      return {
        entry,
        remainingDays,
        status,
        completed,
      };
    });
  }, [state.workControlEntries, today]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const nextRows = workSheetRows.filter((row) => {
      const matchesStatus =
        statusFilter === "Todos" ? true : row.status === statusFilter;
      const matchesSearch = normalizedSearch
        ? [
            repairText(row.entry.clientName),
            repairText(row.entry.referenceNumber),
            repairText(row.entry.entryType),
            repairText(row.entry.progressLabel),
            repairText(row.entry.notes),
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedSearch)
        : true;

      return matchesStatus && matchesSearch;
    });

    return [...nextRows].sort((left, right) => {
      if (sortBy === "client") {
        return left.entry.clientName.localeCompare(right.entry.clientName, "pt-BR");
      }
      if (sortBy === "type") {
        return left.entry.entryType.localeCompare(right.entry.entryType, "pt-BR");
      }
      if (sortBy === "deadline-asc" || sortBy === "deadline-desc") {
        const leftValue = left.remainingDays ?? Number.POSITIVE_INFINITY;
        const rightValue = right.remainingDays ?? Number.POSITIVE_INFINITY;
        return sortBy === "deadline-asc"
          ? leftValue - rightValue
          : rightValue - leftValue;
      }

      const urgencyDelta = statusWeight[left.status] - statusWeight[right.status];
      if (urgencyDelta !== 0) return urgencyDelta;

      const leftValue = left.remainingDays ?? Number.POSITIVE_INFINITY;
      const rightValue = right.remainingDays ?? Number.POSITIVE_INFINITY;
      if (leftValue !== rightValue) return leftValue - rightValue;

      return left.entry.clientName.localeCompare(right.entry.clientName, "pt-BR");
    });
  }, [search, sortBy, statusFilter, workSheetRows]);

  const nextDeadlines = useMemo(() => {
    return [...workSheetRows]
      .filter((row) => !row.completed && row.remainingDays !== null)
      .sort((left, right) => {
        return (left.remainingDays ?? Number.POSITIVE_INFINITY) -
          (right.remainingDays ?? Number.POSITIVE_INFINITY);
      })
      .slice(0, 6);
  }, [workSheetRows]);

  const todayTasks = useMemo(() => {
    return state.tasks.filter((task) => {
      if (task.moduleId !== "work") return false;
      const dueToday = isTaskDueOnDate(task.recurrence, today, todayWeekday);
      if (!dueToday) return false;
      return !isTaskCompletedForDate(task, today);
    });
  }, [state.tasks, today, todayWeekday]);

  const summary = useMemo(() => {
    const overdueOrUrgent = workSheetRows.filter((row) =>
      ["Vencido", "Hoje", "Urgente"].includes(row.status),
    ).length;
    const completed = workSheetRows.filter((row) => row.completed).length;
    const nextDeadline = nextDeadlines[0];

    return {
      total: workSheetRows.length,
      overdueOrUrgent,
      completed,
      nextDeadline,
    };
  }, [nextDeadlines, workSheetRows]);

  const draftRemainingDays = getWorkControlRemainingDays(draft.fatalDeadline, today);
  const draftStatus = getWorkControlStatus(
    { fatalDeadline: draft.fatalDeadline },
    today,
  );

  function updateDraftField<Key extends keyof EntryDraft>(
    key: Key,
    value: EntryDraft[Key],
  ) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetDraft() {
    setDraft(createEmptyEntryDraft());
  }

  function handleAddEntry() {
    if (!draft.clientName.trim() || !draft.entryType.trim()) return;

    actions.addWorkControlEntry({
      clientName: draft.clientName.trim(),
      referenceNumber: draft.referenceNumber.trim() || "n.a.",
      entryType: draft.entryType.trim(),
      startDate: draft.startDate || undefined,
      fatalDeadline: draft.fatalDeadline || undefined,
      progressLabel: draft.progressLabel.trim() || "Pendente",
      notes: draft.notes.trim(),
    });

    resetDraft();
    setShowNewRow(false);
  }

  function updateEntry(entryId: string, patch: Partial<WorkControlEntry>) {
    actions.updateWorkControlEntry({ entryId, patch });
  }

  return (
    <div className="space-y-6">
      <div className="mod-hero">
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div className="mod-icon" style={{ width: 56, height: 56, borderRadius: 14, fontSize: 24 }}>💼</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="praxis-label" style={{ color: "var(--accent)", marginBottom: 4 }}>▸ MÓDULO · TRABALHO</div>
            <div className="praxis-title" style={{ fontSize: 26 }}>Controle vivo</div>
            <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
              Planilha operacional editável: prazo, cliente, andamento e urgência.
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              type="button"
              className="v2-btn v2-btn-primary"
              onClick={() => setShowNewRow((current) => !current)}
            >
              <Plus className="h-3.5 w-3.5" />
              {showNewRow ? "Fechar" : "Nova linha"}
            </button>
          </div>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GlassPanel className="praxis-panel-active">
          <p className="praxis-label text-[var(--accent)]">Linhas ativas</p>
          <p className="praxis-title mt-3 text-4xl">{summary.total}</p>
          <p className="mt-2 text-sm text-zinc-400">Tudo o que está em controle hoje.</p>
        </GlassPanel>
        <GlassPanel>
          <p className="praxis-label text-[var(--accent)]">Urgência</p>
          <p className="praxis-title mt-3 text-4xl">{summary.overdueOrUrgent}</p>
          <p className="mt-2 text-sm text-zinc-400">Vencidos, hoje ou urgentes.</p>
        </GlassPanel>
        <GlassPanel>
          <p className="praxis-label text-[var(--accent)]">Concluídos</p>
          <p className="praxis-title mt-3 text-4xl">{summary.completed}</p>
          <p className="mt-2 text-sm text-zinc-400">Itens já encerrados dentro da base.</p>
        </GlassPanel>
        <GlassPanel>
          <p className="praxis-label text-[var(--accent)]">Próximo prazo</p>
          <p className="praxis-title mt-3 text-2xl">
            {summary.nextDeadline
              ? formatRemainingLabel(summary.nextDeadline.remainingDays)
              : "Sem prazo"}
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            {summary.nextDeadline
              ? `${repairText(summary.nextDeadline.entry.clientName)} • ${formatDateLabel(
                  summary.nextDeadline.entry.fatalDeadline,
                )}`
              : "Nenhum item pendente com prazo fatal."}
          </p>
        </GlassPanel>
      </section>

      <GlassPanel className="space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <p className="praxis-label text-[var(--accent)]">Planilha operacional</p>
            <h2 className="praxis-title text-3xl">Controle principal</h2>
            <p className="max-w-3xl text-sm leading-6 text-zinc-400">
              Cliente, número, tipo, datas, andamento e observação ficam editáveis.
              O sistema calcula a urgência automaticamente.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[760px]">
            <label className="block space-y-2">
              <span className="praxis-label">Busca</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cliente, número, tipo ou observação"
                  className="praxis-field w-full py-3 pl-10 pr-3 text-sm"
                />
              </div>
            </label>
            <label className="block space-y-2">
              <span className="praxis-label">Urgência</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as WorkControlStatus | "Todos")
                }
                className="praxis-field w-full appearance-none px-3 py-3 text-sm"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {repairText(option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="praxis-label">Ordenar por</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
                className="praxis-field w-full appearance-none px-3 py-3 text-sm"
              >
                <option value="urgency">Urgência</option>
                <option value="deadline-asc">Prazo mais próximo</option>
                <option value="deadline-desc">Prazo mais distante</option>
                <option value="client">Cliente</option>
                <option value="type">Tipo</option>
              </select>
            </label>
          </div>
        </div>

        {showNewRow ? (
          <div className="rounded-sm border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="praxis-label text-[var(--accent)]">Nova linha</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Cadastre um novo item e ele entra direto no controle.
                  </p>
                </div>
                <div
                  className={`rounded-sm border px-3 py-2 text-xs font-medium ${getStatusClasses(
                    draftStatus,
                  )}`}
                >
                  {draftStatus} • {formatRemainingLabel(draftRemainingDays)}
                </div>
              </div>
              <div className="grid gap-3 xl:grid-cols-[1.4fr_1.2fr_0.9fr_0.9fr_0.9fr_1fr]">
                <input
                  value={draft.clientName}
                  onChange={(event) => updateDraftField("clientName", event.target.value)}
                  placeholder="Cliente"
                  className={fieldClassName}
                />
                <input
                  value={draft.referenceNumber}
                  onChange={(event) =>
                    updateDraftField("referenceNumber", event.target.value)
                  }
                  placeholder="Número"
                  className={fieldClassName}
                />
                <input
                  value={draft.entryType}
                  onChange={(event) => updateDraftField("entryType", event.target.value)}
                  placeholder="Tipo"
                  list="work-entry-types"
                  className={fieldClassName}
                />
                <input
                  type="date"
                  value={draft.startDate ?? ""}
                  onChange={(event) => updateDraftField("startDate", event.target.value)}
                  className={fieldClassName}
                />
                <input
                  type="date"
                  value={draft.fatalDeadline ?? ""}
                  onChange={(event) =>
                    updateDraftField("fatalDeadline", event.target.value)
                  }
                  className={fieldClassName}
                />
                <input
                  value={draft.progressLabel}
                  onChange={(event) =>
                    updateDraftField("progressLabel", event.target.value)
                  }
                  placeholder="Andamento"
                  list="work-progress-options"
                  className={fieldClassName}
                />
              </div>
              <textarea
                value={draft.notes}
                onChange={(event) => updateDraftField("notes", event.target.value)}
                placeholder="Observação"
                rows={3}
                className="praxis-field w-full resize-y px-3 py-3 text-sm"
              />
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  className="praxis-button-ghost px-4 py-3"
                  onClick={() => {
                    resetDraft();
                    setShowNewRow(false);
                  }}
                >
                  Fechar
                </button>
                <button
                  type="button"
                  className="praxis-button px-4 py-3"
                  onClick={handleAddEntry}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar linha
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="hidden xl:block">
          <div className="overflow-x-auto rounded-sm border border-zinc-800 bg-black/25">
            <table className="min-w-[1500px] table-fixed border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/90 text-left">
                  <th className="w-[21rem] px-4 py-3 praxis-label">Cliente</th>
                  <th className="w-[16rem] px-4 py-3 praxis-label">Número</th>
                  <th className="w-[12rem] px-4 py-3 praxis-label">Tipo</th>
                  <th className="w-[10rem] px-4 py-3 praxis-label">Data inicial</th>
                  <th className="w-[10rem] px-4 py-3 praxis-label">Prazo fatal</th>
                  <th className="w-[10rem] px-4 py-3 praxis-label">Dias restantes</th>
                  <th className="w-[12rem] px-4 py-3 praxis-label">Andamento</th>
                  <th className="w-[20rem] px-4 py-3 praxis-label">Observação</th>
                  <th className="w-[10rem] px-4 py-3 praxis-label">Urgência</th>
                  <th className="w-[8rem] px-4 py-3 praxis-label">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const expanded = expandedEntryId === row.entry.id;
                  return (
                    <tr
                      key={row.entry.id}
                      className={`align-top border-b border-zinc-900/80 ${
                        expanded ? "bg-[var(--accent)]/5" : "bg-transparent"
                      }`}
                    >
                      <td className="px-4 py-4">
                        <EditableField
                          key={`${row.entry.id}-client-${row.entry.clientName}`}
                          value={repairText(row.entry.clientName)}
                          onCommit={(value) =>
                            updateEntry(row.entry.id, { clientName: value })
                          }
                          placeholder="Cliente"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <EditableField
                          key={`${row.entry.id}-number-${row.entry.referenceNumber}`}
                          value={repairText(row.entry.referenceNumber)}
                          onCommit={(value) =>
                            updateEntry(row.entry.id, { referenceNumber: value || "n.a." })
                          }
                          placeholder="Número"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <EditableField
                          key={`${row.entry.id}-type-${row.entry.entryType}`}
                          value={repairText(row.entry.entryType)}
                          list="work-entry-types"
                          onCommit={(value) =>
                            updateEntry(row.entry.id, { entryType: value || "Petição" })
                          }
                          placeholder="Tipo"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <EditableField
                          key={`${row.entry.id}-start-${row.entry.startDate ?? ""}`}
                          type="date"
                          value={row.entry.startDate ?? ""}
                          onCommit={(value) =>
                            updateEntry(row.entry.id, {
                              startDate: value || undefined,
                            })
                          }
                        />
                      </td>
                      <td className="px-4 py-4">
                        <EditableField
                          key={`${row.entry.id}-deadline-${row.entry.fatalDeadline ?? ""}`}
                          type="date"
                          value={row.entry.fatalDeadline ?? ""}
                          onCommit={(value) =>
                            updateEntry(row.entry.id, {
                              fatalDeadline: value || undefined,
                            })
                          }
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="rounded-sm border border-zinc-800 bg-zinc-950/70 px-3 py-3">
                          <p className="text-sm font-medium text-zinc-100">
                            {formatRemainingLabel(row.remainingDays)}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {formatDateLabel(row.entry.fatalDeadline)}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <EditableField
                          key={`${row.entry.id}-progress-${row.entry.progressLabel}`}
                          value={repairText(row.entry.progressLabel)}
                          list="work-progress-options"
                          onCommit={(value) =>
                            updateEntry(row.entry.id, {
                              progressLabel: value || "Pendente",
                            })
                          }
                          placeholder="Andamento"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          {expanded ? (
                            <EditableTextarea
                              key={`${row.entry.id}-notes-${row.entry.notes}`}
                              value={repairText(row.entry.notes)}
                              onCommit={(value) =>
                                updateEntry(row.entry.id, { notes: value })
                              }
                              placeholder="Observação"
                            />
                          ) : (
                            <button
                              type="button"
                              className="w-full rounded-sm border border-zinc-800 bg-zinc-950/70 px-3 py-3 text-left text-sm leading-6 text-zinc-300"
                              onClick={() => setExpandedEntryId(row.entry.id)}
                            >
                              <span className="line-clamp-3">
                                {repairText(row.entry.notes) || "Adicionar observação"}
                              </span>
                            </button>
                          )}
                          <p className="text-xs text-zinc-500">
                            {buildRowSummary(row)}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-sm border px-3 py-2 text-xs font-semibold ${getStatusClasses(
                            row.status,
                          )}`}
                        >
                          {repairText(row.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            className="praxis-button-ghost px-3 py-2"
                            onClick={() =>
                              setExpandedEntryId((current) =>
                                current === row.entry.id ? null : row.entry.id,
                              )
                            }
                          >
                            {expanded ? (
                              <>
                                <ChevronUp className="h-4 w-4" />
                                Recolher
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4" />
                                Detalhes
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            className="praxis-button-ghost px-3 py-2 text-red-300 hover:text-red-100"
                            onClick={() => actions.removeWorkControlEntry(row.entry.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Remover
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4 xl:hidden">
          {filteredRows.map((row) => {
            const expanded = expandedEntryId === row.entry.id;
            return (
              <div
                key={row.entry.id}
                className={`rounded-sm border p-4 ${
                  expanded
                    ? "border-[var(--accent)]/30 bg-[var(--accent)]/5"
                    : "border-zinc-800 bg-black/30"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-base font-semibold text-zinc-100">
                      {repairText(row.entry.clientName) || "Sem cliente"}
                    </p>
                    <p className="text-sm text-zinc-500">{buildRowSummary(row)}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-sm border px-3 py-2 text-xs font-semibold ${getStatusClasses(
                      row.status,
                    )}`}
                  >
                    {repairText(row.status)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <EditableField
                    key={`${row.entry.id}-mobile-client-${row.entry.clientName}`}
                    value={repairText(row.entry.clientName)}
                    onCommit={(value) =>
                      updateEntry(row.entry.id, { clientName: value })
                    }
                    placeholder="Cliente"
                  />
                  <EditableField
                    key={`${row.entry.id}-mobile-number-${row.entry.referenceNumber}`}
                    value={repairText(row.entry.referenceNumber)}
                    onCommit={(value) =>
                      updateEntry(row.entry.id, { referenceNumber: value || "n.a." })
                    }
                    placeholder="Número"
                  />
                  <EditableField
                    key={`${row.entry.id}-mobile-type-${row.entry.entryType}`}
                    value={repairText(row.entry.entryType)}
                    list="work-entry-types"
                    onCommit={(value) =>
                      updateEntry(row.entry.id, { entryType: value || "Petição" })
                    }
                    placeholder="Tipo"
                  />
                  <EditableField
                    key={`${row.entry.id}-mobile-progress-${row.entry.progressLabel}`}
                    value={repairText(row.entry.progressLabel)}
                    list="work-progress-options"
                    onCommit={(value) =>
                      updateEntry(row.entry.id, {
                        progressLabel: value || "Pendente",
                      })
                    }
                    placeholder="Andamento"
                  />
                  <EditableField
                    key={`${row.entry.id}-mobile-start-${row.entry.startDate ?? ""}`}
                    type="date"
                    value={row.entry.startDate ?? ""}
                    onCommit={(value) =>
                      updateEntry(row.entry.id, {
                        startDate: value || undefined,
                      })
                    }
                  />
                  <EditableField
                    key={`${row.entry.id}-mobile-deadline-${row.entry.fatalDeadline ?? ""}`}
                    type="date"
                    value={row.entry.fatalDeadline ?? ""}
                    onCommit={(value) =>
                      updateEntry(row.entry.id, {
                        fatalDeadline: value || undefined,
                      })
                    }
                  />
                </div>

                <div className="mt-4 space-y-3">
                  {expanded ? (
                    <EditableTextarea
                      key={`${row.entry.id}-mobile-notes-${row.entry.notes}`}
                      value={repairText(row.entry.notes)}
                      onCommit={(value) => updateEntry(row.entry.id, { notes: value })}
                      placeholder="Observação"
                    />
                  ) : (
                    <button
                      type="button"
                      className="w-full rounded-sm border border-zinc-800 bg-zinc-950/70 px-3 py-3 text-left text-sm leading-6 text-zinc-300"
                      onClick={() => setExpandedEntryId(row.entry.id)}
                    >
                      <span className="line-clamp-3">
                        {repairText(row.entry.notes) || "Adicionar observação"}
                      </span>
                    </button>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="praxis-button-ghost px-3 py-2"
                      onClick={() =>
                        setExpandedEntryId((current) =>
                          current === row.entry.id ? null : row.entry.id,
                        )
                      }
                    >
                      {expanded ? "Recolher" : "Detalhes"}
                    </button>
                    <button
                      type="button"
                      className="praxis-button-ghost px-3 py-2 text-red-300 hover:text-red-100"
                      onClick={() => actions.removeWorkControlEntry(row.entry.id)}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredRows.length === 0 ? (
          <div className="rounded-sm border border-dashed border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500">
            Nenhuma linha encontrada com os filtros atuais.
          </div>
        ) : null}
      </GlassPanel>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <GlassPanel>
          <div className="flex items-center gap-3">
            <Clock3 className="h-4 w-4 text-[var(--accent)]" />
            <div>
              <p className="praxis-label text-[var(--accent)]">Radar</p>
              <h2 className="praxis-title mt-1 text-2xl">Próximos prazos</h2>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {nextDeadlines.length > 0 ? (
              nextDeadlines.map((row) => (
                <div
                  key={row.entry.id}
                  className="rounded-sm border border-zinc-800 bg-black/30 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-100">
                        {repairText(row.entry.clientName)}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {repairText(row.entry.entryType)} • {repairText(row.entry.referenceNumber)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-sm border px-3 py-2 text-xs font-semibold ${getStatusClasses(
                        row.status,
                      )}`}
                    >
                    {repairText(row.status)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-zinc-400">
                    <span>{formatDateLabel(row.entry.fatalDeadline)}</span>
                    <span>{formatRemainingLabel(row.remainingDays)}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-500">Sem prazos pendentes no momento.</p>
            )}
          </div>
        </GlassPanel>

        <GlassPanel>
          <div className="flex items-center gap-3">
            <BriefcaseBusiness className="h-4 w-4 text-[var(--accent)]" />
            <div>
              <p className="praxis-label text-[var(--accent)]">Hoje</p>
              <h2 className="praxis-title mt-1 text-2xl">Hoje no trabalho</h2>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {todayTasks.length > 0 ? (
              todayTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-sm border border-zinc-800 bg-black/30 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-100">{task.title}</p>
                      <p className="mt-1 text-sm text-zinc-500">{task.description}</p>
                    </div>
                    <span className="rounded-sm border border-zinc-800 px-3 py-2 text-xs text-zinc-400">
                      {task.scheduledTime || "Sem hora"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-sm border border-dashed border-zinc-800 px-4 py-8 text-sm text-zinc-500">
                Nenhuma tarefa do trabalho pendente para hoje.
              </div>
            )}

            <div className="rounded-sm border border-zinc-800 bg-black/30 px-4 py-4">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 h-4 w-4 text-[var(--accent)]" />
                <div>
                  <p className="praxis-label text-[var(--accent)]">Leitura</p>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">
                    Os campos principais ficam editáveis direto na grade. A urgência
                    continua automática para não depender de preenchimento manual.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </GlassPanel>
      </section>

      <datalist id="work-entry-types">
        {entryTypeOptions.map((option) => (
          <option key={option} value={repairText(option)} />
        ))}
      </datalist>
      <datalist id="work-progress-options">
        {progressOptions.map((option) => (
          <option key={option} value={repairText(option)} />
        ))}
      </datalist>
    </div>
  );
}
