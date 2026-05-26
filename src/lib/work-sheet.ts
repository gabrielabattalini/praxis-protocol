import type { WorkControlEntry } from "@/lib/types";

export type WorkCellType =
  | "text"
  | "longtext"
  | "date"
  | "number"
  | "select"
  | "checkbox"
  | "deadline"
  | "computed-remaining"
  | "computed-urgency";

export type WorkCellValue = string | number | boolean | null;

export interface WorkColumn {
  id: string;
  label: string;
  type: WorkCellType;
  options?: string[];
  width?: number;
}

export interface WorkRow {
  id: string;
  cells: Record<string, WorkCellValue>;
}

export interface WorkSheet {
  columns: WorkColumn[];
  rows: WorkRow[];
}

export const WORK_SHEET_MODULE_KEY = "work-sheet";

const DAY_IN_MS = 1000 * 60 * 60 * 24;

export const CELL_TYPE_LABELS: Record<WorkCellType, string> = {
  text: "Texto curto",
  longtext: "Texto longo",
  date: "Data",
  number: "Número",
  select: "Seleção",
  checkbox: "Caixa",
  deadline: "Prazo fatal",
  "computed-remaining": "Dias restantes",
  "computed-urgency": "Urgência",
};

export const CELL_TYPE_HINTS: Record<WorkCellType, string> = {
  text: "Uma linha de texto.",
  longtext: "Várias linhas (observações, descrições).",
  date: "Calendário (DD/MM/AAAA).",
  number: "Valor numérico.",
  select: "Lista de opções clicáveis.",
  checkbox: "Liga/desliga.",
  deadline: "Data + cálculo automático de urgência.",
  "computed-remaining": "Auto: dias até o prazo fatal mais próximo.",
  "computed-urgency": "Auto: rótulo (Vencido / Hoje / Urgente / Atenção / Normal).",
};

export function makeColumnId(): string {
  return `col-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeRowId(): string {
  return `row-${Math.random().toString(36).slice(2, 10)}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function computeRemainingDays(
  deadlineISO: string | null | undefined,
  referenceDate: Date = new Date(),
): number | null {
  if (!deadlineISO) return null;
  const deadline = new Date(`${deadlineISO}T00:00:00`);
  if (Number.isNaN(deadline.getTime())) return null;
  return Math.round(
    (startOfDay(deadline).getTime() - startOfDay(referenceDate).getTime()) /
      DAY_IN_MS,
  );
}

export function computeUrgencyLabel(remainingDays: number | null): string {
  if (remainingDays === null) return "Sem prazo";
  if (remainingDays < 0) return "Vencido";
  if (remainingDays === 0) return "Hoje";
  if (remainingDays <= 3) return "Urgente";
  if (remainingDays <= 5) return "Atenção";
  return "Normal";
}

export function formatRemainingLabel(value: number | null): string {
  if (value === null) return "Sem prazo";
  if (value < 0) return `${Math.abs(value)}d atrasado`;
  if (value === 0) return "Hoje";
  if (value === 1) return "1 dia";
  return `${value} dias`;
}

export function formatDateBR(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function getUrgencyClasses(label: string): string {
  switch (label) {
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

export function findFirstDeadlineColumn(
  columns: WorkColumn[],
): WorkColumn | undefined {
  return columns.find((column) => column.type === "deadline");
}

export function getComputedCellValue(
  column: WorkColumn,
  row: WorkRow,
  columns: WorkColumn[],
  referenceDate: Date = new Date(),
): { remainingDays: number | null; urgency: string } {
  const deadlineColumn = findFirstDeadlineColumn(columns);
  const deadlineValue = deadlineColumn
    ? (row.cells[deadlineColumn.id] as string | null | undefined)
    : null;
  const remainingDays = computeRemainingDays(deadlineValue, referenceDate);
  const urgency = computeUrgencyLabel(remainingDays);
  return { remainingDays, urgency };
}

export function defaultColumnsForLegalWork(): WorkColumn[] {
  return [
    { id: makeColumnId(), label: "Cliente", type: "text", width: 240 },
    { id: makeColumnId(), label: "Número", type: "text", width: 180 },
    {
      id: makeColumnId(),
      label: "Tipo",
      type: "select",
      width: 160,
      options: [
        "Petição",
        "Relatório",
        "Manifestação",
        "Análise",
        "Revisão",
        "Audiência",
        "Prazo interno",
      ],
    },
    { id: makeColumnId(), label: "Data inicial", type: "date", width: 150 },
    { id: makeColumnId(), label: "Prazo fatal", type: "deadline", width: 150 },
    {
      id: makeColumnId(),
      label: "Dias restantes",
      type: "computed-remaining",
      width: 140,
    },
    {
      id: makeColumnId(),
      label: "Andamento",
      type: "select",
      width: 160,
      options: [
        "Pendente",
        "Em andamento",
        "Aguardando",
        "Correção",
        "Concluído",
      ],
    },
    { id: makeColumnId(), label: "Observação", type: "longtext", width: 260 },
    {
      id: makeColumnId(),
      label: "Urgência",
      type: "computed-urgency",
      width: 130,
    },
  ];
}

export function emptyWorkSheet(): WorkSheet {
  return {
    columns: defaultColumnsForLegalWork(),
    rows: [],
  };
}

export function migrateLegacyEntries(
  entries: WorkControlEntry[],
): WorkSheet {
  const columns = defaultColumnsForLegalWork();
  const [
    colClient,
    colNumber,
    colType,
    colStart,
    colDeadline,
    ,
    colProgress,
    colNotes,
  ] = columns;

  const rows: WorkRow[] = entries.map((entry) => ({
    id: makeRowId(),
    cells: {
      [colClient.id]: entry.clientName ?? "",
      [colNumber.id]: entry.referenceNumber ?? "",
      [colType.id]: entry.entryType ?? "",
      [colStart.id]: entry.startDate ?? "",
      [colDeadline.id]: entry.fatalDeadline ?? "",
      [colProgress.id]: entry.progressLabel ?? "",
      [colNotes.id]: entry.notes ?? "",
    },
  }));

  return { columns, rows };
}

export function isValidWorkSheet(value: unknown): value is WorkSheet {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WorkSheet>;
  if (!Array.isArray(candidate.columns) || !Array.isArray(candidate.rows)) {
    return false;
  }
  return candidate.columns.every(
    (column) =>
      column &&
      typeof column === "object" &&
      typeof (column as WorkColumn).id === "string" &&
      typeof (column as WorkColumn).label === "string" &&
      typeof (column as WorkColumn).type === "string",
  );
}

export function loadWorkSheetFromModuleState(
  moduleState: Record<string, unknown> | undefined,
  legacyEntries: WorkControlEntry[],
): WorkSheet {
  const stored = moduleState?.[WORK_SHEET_MODULE_KEY];
  if (isValidWorkSheet(stored)) {
    return stored;
  }
  if (legacyEntries.length > 0) {
    return migrateLegacyEntries(legacyEntries);
  }
  return emptyWorkSheet();
}
