"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Clock3,
  MoreHorizontal,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import {
  CELL_TYPE_HINTS,
  CELL_TYPE_LABELS,
  WORK_SHEET_MODULE_KEY,
  type WorkCellType,
  type WorkCellValue,
  type WorkColumn,
  type WorkRow,
  type WorkSheet,
  computeRemainingDays,
  computeUrgencyLabel,
  findFirstDeadlineColumn,
  formatDateBR,
  formatRemainingLabel,
  getComputedRemainingForColumn,
  getDateLikeColumns,
  getUrgencyClasses,
  loadWorkSheetFromModuleState,
  makeColumnId,
  makeRowId,
} from "@/lib/work-sheet";

const FIELD = "praxis-field w-full min-w-0 px-3 py-2.5 text-sm";
const FIELD_COMPACT = "praxis-field w-full min-w-0 px-2.5 py-2 text-sm";

const CELL_TYPE_ORDER: WorkCellType[] = [
  "text",
  "longtext",
  "date",
  "number",
  "select",
  "checkbox",
  "deadline",
  "computed-remaining",
  "computed-urgency",
];

function getColumnLetter(index: number): string {
  let letter = "";
  let n = index + 1;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

function cloneSheet(sheet: WorkSheet): WorkSheet {
  return {
    columns: sheet.columns.map((column) => ({
      ...column,
      options: column.options ? [...column.options] : undefined,
    })),
    rows: sheet.rows.map((row) => ({
      id: row.id,
      cells: { ...row.cells },
    })),
  };
}

function makeEmptyRow(columns: WorkColumn[]): WorkRow {
  const cells: Record<string, WorkCellValue> = {};
  for (const column of columns) {
    cells[column.id] =
      column.type === "checkbox"
        ? false
        : column.type === "number"
          ? null
          : "";
  }
  return { id: makeRowId(), cells };
}

function toText(value: WorkCellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "";
  return String(value);
}

const DISPLAY_CELL =
  "min-h-[100px] w-full cursor-text whitespace-pre-wrap break-words rounded-sm border border-zinc-700/70 bg-zinc-950/40 px-2 py-2 text-sm leading-6 text-zinc-100 hover:border-[var(--accent)]/40 hover:bg-zinc-900/70";

function CellDisplay({
  column,
  value,
  onActivate,
}: {
  column: WorkColumn;
  value: WorkCellValue;
  onActivate: () => void;
}) {
  if (column.type === "checkbox") {
    // single-click toggle handled by parent; show a visual mark
    return (
      <div className="flex h-full min-h-[100px] items-center justify-center">
        <span
          className={`inline-flex h-4 w-4 items-center justify-center rounded-sm border ${
            value
              ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
              : "border-zinc-700 bg-zinc-950"
          }`}
        >
          {value ? "✓" : ""}
        </span>
      </div>
    );
  }

  if (column.type === "date" || column.type === "deadline") {
    const text = toText(value);
    return (
      <div
        className={DISPLAY_CELL}
        onDoubleClick={onActivate}
        title="Duplo clique para editar"
      >
        {text ? formatDateBR(text) : ""}
      </div>
    );
  }

  const text = toText(value);
  return (
    <div
      className={DISPLAY_CELL}
      onDoubleClick={onActivate}
      title="Duplo clique para editar"
    >
      {text}
    </div>
  );
}

function CellEditor({
  column,
  value,
  onCommit,
}: {
  column: WorkColumn;
  value: WorkCellValue;
  onCommit: (next: WorkCellValue) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<WorkCellValue>(value);

  useEffect(() => setDraft(value), [value]);

  // Checkbox is always interactive (single click toggles), no edit mode needed.
  if (column.type === "checkbox") {
    return (
      <label className="flex h-full min-h-[34px] cursor-pointer items-center justify-center">
        <input
          type="checkbox"
          checked={Boolean(draft)}
          className="h-4 w-4 accent-[var(--accent)]"
          onChange={(event) => {
            setDraft(event.target.checked);
            onCommit(event.target.checked);
          }}
        />
      </label>
    );
  }

  function exitAndCommit(next: WorkCellValue) {
    setEditing(false);
    if (next !== value) onCommit(next);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (!editing) {
    return (
      <CellDisplay
        column={column}
        value={value}
        onActivate={() => setEditing(true)}
      />
    );
  }

  if (column.type === "longtext") {
    return (
      <textarea
        autoFocus
        value={toText(draft)}
        rows={3}
        className="praxis-field min-h-[80px] w-full resize-y px-2.5 py-2 text-sm leading-5"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => exitAndCommit(toText(draft).trim())}
        onKeyDown={(event) => {
          if (event.key === "Escape") cancel();
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.currentTarget.blur();
          }
        }}
      />
    );
  }

  if (column.type === "date" || column.type === "deadline") {
    return (
      <input
        autoFocus
        type="date"
        value={toText(draft)}
        className={FIELD_COMPACT}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => exitAndCommit(toText(draft))}
        onKeyDown={(event) => {
          if (event.key === "Escape") cancel();
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    );
  }

  if (column.type === "number") {
    const text =
      draft === null || draft === undefined || draft === ""
        ? ""
        : String(draft);
    return (
      <input
        autoFocus
        type="number"
        value={text}
        className={FIELD_COMPACT}
        onChange={(event) => {
          const raw = event.target.value;
          setDraft(raw === "" ? null : Number(raw));
        }}
        onBlur={() => exitAndCommit(draft)}
        onKeyDown={(event) => {
          if (event.key === "Escape") cancel();
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    );
  }

  if (column.type === "select") {
    const options = column.options ?? [];
    return (
      <select
        autoFocus
        value={toText(draft)}
        className={FIELD_COMPACT}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => exitAndCommit(toText(draft))}
        onKeyDown={(event) => {
          if (event.key === "Escape") cancel();
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      >
        <option value="">—</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      autoFocus
      type="text"
      value={toText(draft)}
      className={FIELD_COMPACT}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => exitAndCommit(toText(draft).trim())}
      onKeyDown={(event) => {
        if (event.key === "Escape") cancel();
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

function ColumnHeaderMenu({
  column,
  columns,
  index,
  anchorRect,
  onUpdate,
  onRemove,
  onMove,
  onClose,
}: {
  column: WorkColumn;
  columns: WorkColumn[];
  index: number;
  anchorRect: DOMRect;
  onUpdate: (patch: Partial<WorkColumn>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  onClose: () => void;
}) {
  const [optionDraft, setOptionDraft] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  const MENU_WIDTH = 288;
  const top = anchorRect.bottom + 8;
  const left = Math.max(
    8,
    Math.min(window.innerWidth - MENU_WIDTH - 8, anchorRect.right - MENU_WIDTH),
  );

  return createPortal(
    <div
      ref={containerRef}
      style={{ position: "fixed", top, left, zIndex: 60 }}
      className="w-72 rounded-sm border border-zinc-700 bg-zinc-950/95 p-3 shadow-xl backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <span className="praxis-label text-[var(--accent)]">Coluna</span>
          <p className="mt-0.5 truncate text-xs text-zinc-400">
            {column.label || "Sem nome"}
          </p>
        </div>
        <button
          type="button"
          className="ml-2 shrink-0 text-zinc-500 hover:text-zinc-200"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <label className="mt-3 block space-y-1">
        <span className="text-xs text-zinc-400">Tipo</span>
        <select
          value={column.type}
          onChange={(event) =>
            onUpdate({ type: event.target.value as WorkCellType })
          }
          className={FIELD_COMPACT}
        >
          {CELL_TYPE_ORDER.map((type) => (
            <option key={type} value={type}>
              {CELL_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>

      {column.type === "computed-remaining" ||
      column.type === "computed-urgency" ? (
        <div className="mt-3 space-y-2">
          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Início</span>
            <select
              value={column.startColumnId ?? ""}
              onChange={(event) =>
                onUpdate({
                  startColumnId: event.target.value || undefined,
                })
              }
              className={FIELD_COMPACT}
            >
              <option value="">Hoje (padrão)</option>
              {getDateLikeColumns(columns).map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label || "Sem nome"}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Término</span>
            <select
              value={column.endColumnId ?? ""}
              onChange={(event) =>
                onUpdate({
                  endColumnId: event.target.value || undefined,
                })
              }
              className={FIELD_COMPACT}
            >
              <option value="">Auto (primeiro Prazo fatal)</option>
              {getDateLikeColumns(columns).map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label || "Sem nome"}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[11px] leading-4 text-zinc-500">
            Calcula <strong className="text-zinc-300">Término − Início</strong>.
            Se Início ficar em &quot;Hoje&quot;, mostra dias restantes até o
            término.
          </p>
        </div>
      ) : null}

      {column.type === "select" ? (
        <div className="mt-3 space-y-2">
          <span className="text-xs text-zinc-400">Opções</span>
          <div className="flex flex-wrap gap-1.5">
            {(column.options ?? []).map((option) => (
              <span
                key={option}
                className="inline-flex items-center gap-1 rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
              >
                {option}
                <button
                  type="button"
                  className="text-zinc-500 hover:text-red-300"
                  onClick={() =>
                    onUpdate({
                      options: (column.options ?? []).filter(
                        (current) => current !== option,
                      ),
                    })
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={optionDraft}
              placeholder="Nova opção"
              className={FIELD_COMPACT}
              onChange={(event) => setOptionDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && optionDraft.trim()) {
                  onUpdate({
                    options: [...(column.options ?? []), optionDraft.trim()],
                  });
                  setOptionDraft("");
                }
              }}
            />
            <button
              type="button"
              className="praxis-button-ghost px-2 py-1 text-xs"
              onClick={() => {
                if (!optionDraft.trim()) return;
                onUpdate({
                  options: [...(column.options ?? []), optionDraft.trim()],
                });
                setOptionDraft("");
              }}
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="praxis-button-ghost px-2 py-1 text-xs disabled:opacity-40"
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          ← Mover
        </button>
        <button
          type="button"
          className="praxis-button-ghost px-2 py-1 text-xs disabled:opacity-40"
          disabled={index === columns.length - 1}
          onClick={() => onMove(1)}
        >
          Mover →
        </button>
        <button
          type="button"
          className="praxis-button-ghost ml-auto px-2 py-1 text-xs text-red-300 hover:text-red-100"
          onClick={() => {
            onRemove();
            onClose();
          }}
        >
          <Trash2 className="h-3 w-3" />
          Excluir
        </button>
      </div>
    </div>,
    document.body,
  );
}

function RowActionsMenu({
  anchorRect,
  onDelete,
  onDuplicate,
  onClose,
}: {
  anchorRect: DOMRect;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  const MENU_WIDTH = 176;
  const top = anchorRect.bottom + 8;
  const left = Math.max(
    8,
    Math.min(window.innerWidth - MENU_WIDTH - 8, anchorRect.right - MENU_WIDTH),
  );

  return createPortal(
    <div
      ref={containerRef}
      style={{ position: "fixed", top, left, zIndex: 60 }}
      className="w-44 rounded-sm border border-zinc-700 bg-zinc-950/95 p-1.5 shadow-xl backdrop-blur"
    >
      <button
        type="button"
        className="praxis-button-ghost flex w-full items-center justify-start gap-2 px-2 py-1.5 text-xs"
        onClick={() => {
          onDuplicate();
          onClose();
        }}
      >
        <Plus className="h-3 w-3" />
        Duplicar linha
      </button>
      <button
        type="button"
        className="praxis-button-ghost flex w-full items-center justify-start gap-2 px-2 py-1.5 text-xs text-red-300 hover:text-red-100"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        <Trash2 className="h-3 w-3" />
        Excluir linha
      </button>
    </div>,
    document.body,
  );
}

export default function WorkModulePage() {
  const { state, actions } = useAppStore();
  const today = useMemo(() => new Date(), []);

  const sheet = useMemo<WorkSheet>(
    () =>
      loadWorkSheetFromModuleState(state.moduleState, state.workControlEntries),
    [state.moduleState, state.workControlEntries],
  );

  const [openColumnMenu, setOpenColumnMenu] = useState<
    { id: string; rect: DOMRect } | null
  >(null);
  const [openRowMenu, setOpenRowMenu] = useState<
    { id: string; rect: DOMRect } | null
  >(null);
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  const persistSheet = useCallback(
    (mutator: (draft: WorkSheet) => WorkSheet) => {
      const next = mutator(cloneSheet(sheet));
      actions.setModuleState(WORK_SHEET_MODULE_KEY, next);
    },
    [actions, sheet],
  );

  const updateCell = useCallback(
    (rowId: string, columnId: string, value: WorkCellValue) => {
      persistSheet((draft) => {
        draft.rows = draft.rows.map((row) =>
          row.id === rowId
            ? { ...row, cells: { ...row.cells, [columnId]: value } }
            : row,
        );
        return draft;
      });
    },
    [persistSheet],
  );

  const addColumn = useCallback(
    (type: WorkCellType) => {
      persistSheet((draft) => {
        const column: WorkColumn = {
          id: makeColumnId(),
          label: CELL_TYPE_LABELS[type],
          type,
          options: type === "select" ? ["Opção A", "Opção B"] : undefined,
          width: 180,
        };
        draft.columns = [...draft.columns, column];
        draft.rows = draft.rows.map((row) => ({
          ...row,
          cells: {
            ...row.cells,
            [column.id]:
              type === "checkbox" ? false : type === "number" ? null : "",
          },
        }));
        return draft;
      });
      setShowColumnPicker(false);
    },
    [persistSheet],
  );

  const updateColumn = useCallback(
    (columnId: string, patch: Partial<WorkColumn>) => {
      persistSheet((draft) => {
        draft.columns = draft.columns.map((column) =>
          column.id === columnId ? { ...column, ...patch } : column,
        );
        return draft;
      });
    },
    [persistSheet],
  );

  const removeColumn = useCallback(
    (columnId: string) => {
      persistSheet((draft) => {
        draft.columns = draft.columns.filter(
          (column) => column.id !== columnId,
        );
        draft.rows = draft.rows.map((row) => {
          const next = { ...row.cells };
          delete next[columnId];
          return { ...row, cells: next };
        });
        return draft;
      });
    },
    [persistSheet],
  );

  const moveColumn = useCallback(
    (columnId: string, direction: -1 | 1) => {
      persistSheet((draft) => {
        const index = draft.columns.findIndex(
          (column) => column.id === columnId,
        );
        if (index === -1) return draft;
        const target = index + direction;
        if (target < 0 || target >= draft.columns.length) return draft;
        const next = [...draft.columns];
        const [removed] = next.splice(index, 1);
        next.splice(target, 0, removed);
        draft.columns = next;
        return draft;
      });
    },
    [persistSheet],
  );

  const addRow = useCallback(() => {
    persistSheet((draft) => {
      draft.rows = [...draft.rows, makeEmptyRow(draft.columns)];
      return draft;
    });
  }, [persistSheet]);

  const removeRow = useCallback(
    (rowId: string) => {
      persistSheet((draft) => {
        draft.rows = draft.rows.filter((row) => row.id !== rowId);
        return draft;
      });
    },
    [persistSheet],
  );

  const duplicateRow = useCallback(
    (rowId: string) => {
      persistSheet((draft) => {
        const source = draft.rows.find((row) => row.id === rowId);
        if (!source) return draft;
        const index = draft.rows.indexOf(source);
        const copy: WorkRow = { id: makeRowId(), cells: { ...source.cells } };
        draft.rows = [
          ...draft.rows.slice(0, index + 1),
          copy,
          ...draft.rows.slice(index + 1),
        ];
        return draft;
      });
    },
    [persistSheet],
  );

  const deadlineColumn = findFirstDeadlineColumn(sheet.columns);

  const radarRows = useMemo(() => {
    if (!deadlineColumn) return [];
    return sheet.rows
      .map((row) => {
        const deadlineValue = row.cells[deadlineColumn.id] as
          | string
          | null
          | undefined;
        const remaining = computeRemainingDays(deadlineValue, today);
        const urgency = computeUrgencyLabel(remaining);
        return { row, remaining, urgency, deadlineValue };
      })
      .filter((entry) => entry.remaining !== null)
      .sort(
        (left, right) =>
          (left.remaining ?? Number.POSITIVE_INFINITY) -
          (right.remaining ?? Number.POSITIVE_INFINITY),
      )
      .slice(0, 6);
  }, [deadlineColumn, sheet.rows, today]);

  const summary = useMemo(() => {
    const total = sheet.rows.length;
    let urgent = 0;
    if (deadlineColumn) {
      for (const row of sheet.rows) {
        const remaining = computeRemainingDays(
          row.cells[deadlineColumn.id] as string | null | undefined,
          today,
        );
        const urgency = computeUrgencyLabel(remaining);
        if (["Vencido", "Hoje", "Urgente"].includes(urgency)) urgent += 1;
      }
    }
    return { total, urgent, next: radarRows[0] };
  }, [deadlineColumn, radarRows, sheet.rows, today]);

  return (
    <div className="space-y-6">
      <div className="mod-hero">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div
            className="mod-icon"
            style={{ width: 56, height: 56, borderRadius: 14, fontSize: 24 }}
          >
            💼
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div
              className="praxis-label"
              style={{ color: "var(--accent)", marginBottom: 4 }}
            >
              ▸ MÓDULO · TRABALHO
            </div>
            <div className="praxis-title" style={{ fontSize: 26 }}>
              Planilha modular
            </div>
            <div
              style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}
            >
              Monte do seu jeito: adicione colunas, escolha o tipo, edite tudo
              célula a célula.
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              type="button"
              className="v2-btn"
              onClick={() => setShowColumnPicker((current) => !current)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Coluna
            </button>
            <button
              type="button"
              className="v2-btn v2-btn-primary"
              onClick={addRow}
            >
              <Plus className="h-3.5 w-3.5" />
              Nova linha
            </button>
          </div>
        </div>

        {showColumnPicker ? (
          <div className="mt-4 grid gap-2 rounded-sm border border-zinc-800 bg-black/40 p-3 sm:grid-cols-3">
            {CELL_TYPE_ORDER.map((type) => (
              <button
                key={type}
                type="button"
                title={CELL_TYPE_HINTS[type]}
                className="praxis-button-ghost flex items-center justify-start gap-2 px-3 py-2 text-left"
                onClick={() => addColumn(type)}
              >
                <span className="text-sm font-medium text-zinc-100">
                  {CELL_TYPE_LABELS[type]}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <GlassPanel className="praxis-panel-active">
          <p className="praxis-label text-[var(--accent)]">Linhas ativas</p>
          <p className="praxis-title mt-3 text-4xl">{summary.total}</p>
          <p className="mt-2 text-sm text-zinc-400">
            Cada linha é um item editável da sua planilha.
          </p>
        </GlassPanel>
        <GlassPanel>
          <p className="praxis-label text-[var(--accent)]">Urgência</p>
          <p className="praxis-title mt-3 text-4xl">{summary.urgent}</p>
          <p className="mt-2 text-sm text-zinc-400">
            Vencidos, hoje ou urgentes (com base no Prazo fatal).
          </p>
        </GlassPanel>
        <GlassPanel>
          <p className="praxis-label text-[var(--accent)]">Próximo prazo</p>
          <p className="praxis-title mt-3 text-2xl">
            {summary.next
              ? formatRemainingLabel(summary.next.remaining)
              : "Sem prazo"}
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            {summary.next && deadlineColumn
              ? formatDateBR(
                  summary.next.row.cells[deadlineColumn.id] as string,
                )
              : "Adicione uma coluna Prazo fatal e preencha datas."}
          </p>
        </GlassPanel>
      </section>

      <GlassPanel className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="praxis-label text-[var(--accent)]">Planilha</p>
            <h2 className="praxis-title text-2xl">Sua estrutura</h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              Clique no nome da coluna para renomear, mudar o tipo, reordenar ou
              excluir. Cada célula edita-se direto na grade.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-sm border border-zinc-600 bg-black/30">
          <table className="min-w-full table-fixed border-collapse">
            <thead>
              <tr className="border-b-2 border-zinc-600 bg-zinc-900 text-left">
                <th className="w-12 border-r border-zinc-600 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
                  #
                </th>
                {sheet.columns.map((column, index) => (
                  <th
                    key={column.id}
                    className="relative border-r border-zinc-700 px-2 py-2 align-bottom last:border-r-0"
                    style={{ minWidth: column.width ?? 160 }}
                  >
                    <div className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
                      {getColumnLetter(index)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        value={column.label}
                        placeholder="Sem nome"
                        aria-label="Nome da coluna"
                        onChange={(event) =>
                          updateColumn(column.id, { label: event.target.value })
                        }
                        className="praxis-label min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-1 py-1 text-zinc-100 hover:border-zinc-600 hover:bg-zinc-900/80 focus:border-[var(--accent)]/60 focus:bg-zinc-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        title="Mais opções"
                        aria-label="Mais opções da coluna"
                        className="shrink-0 rounded-sm border border-transparent p-1 text-zinc-400 hover:border-zinc-600 hover:text-zinc-100"
                        onClick={(event) => {
                          const rect =
                            event.currentTarget.getBoundingClientRect();
                          setOpenColumnMenu((current) =>
                            current?.id === column.id
                              ? null
                              : { id: column.id, rect },
                          );
                        }}
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {openColumnMenu?.id === column.id ? (
                      <ColumnHeaderMenu
                        column={column}
                        columns={sheet.columns}
                        index={index}
                        anchorRect={openColumnMenu.rect}
                        onUpdate={(patch) => updateColumn(column.id, patch)}
                        onRemove={() => removeColumn(column.id)}
                        onMove={(direction) => moveColumn(column.id, direction)}
                        onClose={() => setOpenColumnMenu(null)}
                      />
                    ) : null}
                  </th>
                ))}
                <th className="w-12 px-2 py-2 text-right">
                  <button
                    type="button"
                    title="Adicionar coluna"
                    className="praxis-button-ghost p-1.5"
                    onClick={() => setShowColumnPicker(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((row, rowIndex) => {
                return (
                  <tr
                    key={row.id}
                    className="border-b border-zinc-700/80 align-top hover:bg-zinc-900/30"
                  >
                    <td className="border-r border-zinc-600 bg-zinc-900/70 px-2 py-2 text-center text-xs font-semibold text-zinc-200">
                      {rowIndex + 1}
                    </td>
                    {sheet.columns.map((column) => {
                      if (column.type === "computed-remaining") {
                        const remaining = getComputedRemainingForColumn(
                          column,
                          row,
                          sheet.columns,
                          today,
                        );
                        const endColumn =
                          sheet.columns.find(
                            (c) => c.id === column.endColumnId,
                          ) ?? deadlineColumn;
                        const endValue = endColumn
                          ? (row.cells[endColumn.id] as string | undefined)
                          : undefined;
                        return (
                          <td key={column.id} className="border-r border-zinc-700/60 px-3 py-2">
                            <div className="rounded-sm border border-zinc-600 bg-zinc-900/80 px-2 py-1.5 text-xs">
                              <p className="font-medium text-zinc-100">
                                {formatRemainingLabel(remaining)}
                              </p>
                              {endValue ? (
                                <p className="text-[10px] text-zinc-300">
                                  {formatDateBR(endValue)}
                                </p>
                              ) : null}
                            </div>
                          </td>
                        );
                      }
                      if (column.type === "computed-urgency") {
                        const remaining = getComputedRemainingForColumn(
                          column,
                          row,
                          sheet.columns,
                          today,
                        );
                        const urgency = computeUrgencyLabel(remaining);
                        return (
                          <td key={column.id} className="border-r border-zinc-700/60 px-3 py-2">
                            <span
                              className={`inline-flex rounded-sm border px-2 py-1 text-xs font-semibold ${getUrgencyClasses(
                                urgency,
                              )}`}
                            >
                              {urgency}
                            </span>
                          </td>
                        );
                      }
                      return (
                        <td key={column.id} className="border-r border-zinc-700/60 px-3 py-2">
                          <CellEditor
                            column={column}
                            value={row.cells[column.id] ?? ""}
                            onCommit={(next) =>
                              updateCell(row.id, column.id, next)
                            }
                          />
                        </td>
                      );
                    })}
                    <td className="relative px-2 py-2 text-right">
                      <button
                        type="button"
                        className="praxis-button-ghost p-1.5"
                        onClick={(event) => {
                          const rect =
                            event.currentTarget.getBoundingClientRect();
                          setOpenRowMenu((current) =>
                            current?.id === row.id
                              ? null
                              : { id: row.id, rect },
                          );
                        }}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                      {openRowMenu?.id === row.id ? (
                        <RowActionsMenu
                          anchorRect={openRowMenu.rect}
                          onDelete={() => removeRow(row.id)}
                          onDuplicate={() => duplicateRow(row.id)}
                          onClose={() => setOpenRowMenu(null)}
                        />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {Array.from({
                length: Math.max(0, 5 - sheet.rows.length),
              }).map((_, phantomIndex) => (
                <tr
                  key={`phantom-${phantomIndex}`}
                  className="border-b border-zinc-700/80 align-top"
                  aria-hidden="true"
                >
                  <td className="border-r border-zinc-600 bg-zinc-900/40 px-2 py-2 text-center text-xs font-semibold text-zinc-500">
                    {sheet.rows.length + phantomIndex + 1}
                  </td>
                  {sheet.columns.map((column) => (
                    <td key={column.id} className="border-r border-zinc-700/60 px-3 py-2">
                      <div className="min-h-[100px] w-full rounded-sm border border-zinc-800/60 bg-zinc-950/30 px-2 py-2 text-sm text-zinc-700">
                        &nbsp;
                      </div>
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      title="Adicionar linha aqui"
                      aria-label="Adicionar linha aqui"
                      className="praxis-button-ghost p-1.5 opacity-40 hover:opacity-100"
                      onClick={addRow}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
          <p>
            {sheet.columns.length} colunas · {sheet.rows.length} linhas
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="praxis-button-ghost px-2 py-1"
              onClick={() => setShowColumnPicker(true)}
            >
              <Plus className="h-3 w-3" />
              Adicionar coluna
            </button>
            <button
              type="button"
              className="praxis-button-ghost px-2 py-1"
              onClick={addRow}
            >
              <Plus className="h-3 w-3" />
              Adicionar linha
            </button>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel>
        <div className="flex items-center gap-3">
          <Clock3 className="h-4 w-4 text-[var(--accent)]" />
          <div>
            <p className="praxis-label text-[var(--accent)]">Radar</p>
            <h2 className="praxis-title mt-1 text-2xl">Próximos prazos</h2>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {radarRows.length > 0 && deadlineColumn ? (
            radarRows.map(({ row, remaining, urgency, deadlineValue }) => {
              const firstTextColumn = sheet.columns.find(
                (column) =>
                  column.type === "text" || column.type === "longtext",
              );
              const headline = firstTextColumn
                ? (row.cells[firstTextColumn.id] as string) || "Sem rótulo"
                : "Sem rótulo";
              return (
                <div
                  key={row.id}
                  className="rounded-sm border border-zinc-800 bg-black/30 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-zinc-100">
                      {headline}
                    </p>
                    <span
                      className={`shrink-0 rounded-sm border px-2 py-1 text-[11px] font-semibold ${getUrgencyClasses(
                        urgency,
                      )}`}
                    >
                      {urgency}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-400">
                    <span>{formatDateBR(deadlineValue)}</span>
                    <span>{formatRemainingLabel(remaining)}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-zinc-500">
              Adicione uma coluna de tipo{" "}
              <strong className="text-zinc-300">Prazo fatal</strong> e
              preencha datas para ver o radar.
            </p>
          )}
        </div>
      </GlassPanel>
    </div>
  );
}
