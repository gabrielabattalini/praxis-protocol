"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { useToast } from "@/components/ui/toast";
import { buildWeekAgenda, type AgendaEvent } from "@/lib/agenda";
import { formatDateKey, makeId } from "@/lib/utils";
import type { RecoveryDayCompletion } from "@/lib/types";

const agendaSlots = [
  "05:00",
  "08:00",
  "10:00",
  "12:00",
  "14:00",
  "17:00",
  "19:00",
  "21:00",
  "22:00",
  "00:00",
] as const;

function formatWeekRange(days: { date: Date }[]) {
  if (!days.length) return "";
  const first = days[0].date;
  const last = days[days.length - 1].date;

  return `${first
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    .replace(".", "")} - ${last
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    .replace(".", "")}`;
}

function toneForKind(kind: AgendaEvent["kind"]) {
  if (kind === "meal") {
    return {
      color: "var(--ok)",
      label: "Nutrição",
    };
  }

  if (kind === "workout") {
    return {
      color: "var(--accent)",
      label: "Treino",
    };
  }

  if (kind === "recovery") {
    return {
      color: "var(--accent)",
      label: "Recuperação",
    };
  }

  return {
    color: "var(--ocean)",
    label: "Tarefa",
  };
}

function buildReferenceDate(base: Date, weekOffset: number) {
  const next = new Date(base);
  next.setDate(base.getDate() + weekOffset * 7);
  return next;
}

function parseAgendaTimeMinutes(time?: string) {
  if (!time) return null;
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  return hours * 60 + minutes;
}

function normalizeAgendaMinutes(time?: string) {
  const minutes = parseAgendaTimeMinutes(time);
  if (minutes === null) return null;

  // A madrugada pertence ao fechamento do ciclo, então aparece no fim do dia.
  return minutes < 5 * 60 ? minutes + 24 * 60 : minutes;
}

function slotForAgendaItem(item: AgendaEvent) {
  const minutes = normalizeAgendaMinutes(item.time);
  if (minutes === null) return null;

  let activeSlot: (typeof agendaSlots)[number] = agendaSlots[0];
  for (const slot of agendaSlots) {
    const slotMinutes = normalizeAgendaMinutes(slot) ?? 0;
    if (minutes >= slotMinutes) {
      activeSlot = slot;
    }
  }

  return activeSlot;
}

function isSameDate(left: Date, right: Date) {
  return left.toDateString() === right.toDateString();
}

/**
 * Chip de evento da Agenda.
 *
 * Pedido do usuário: clicar deve DAR/TIRAR baixa na própria Agenda
 * (sincronizado com Missões), inclusive em dias passados (esqueceu de
 * lançar). Então:
 *  - dia de HOJE ou PASSADO → vira botão que alterna a conclusão.
 *  - dia FUTURO → continua link pro módulo (não dá pra concluir o que
 *    ainda não aconteceu; abrir o módulo serve pra planejar).
 */
function AgendaEventChip({
  item,
  canToggle,
  onToggle,
}: {
  item: AgendaEvent;
  canToggle: boolean;
  onToggle: (item: AgendaEvent) => void;
}) {
  const tone = toneForKind(item.kind);
  const baseStyle = {
    display: "block",
    width: "100%",
    minWidth: 0,
    padding: "5px 7px",
    borderRadius: 6,
    borderLeft: `3px solid ${tone.color}`,
    background: item.completed ? "rgba(14,14,17,0.62)" : "rgba(20,20,24,0.86)",
    color: "inherit",
    textDecoration: "none",
    opacity: item.completed ? 0.68 : 1,
    textAlign: "left" as const,
  };

  const inner = (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          minWidth: 0,
        }}
      >
        <div
          className="praxis-label"
          style={{
            color: tone.color,
            fontSize: 8,
            letterSpacing: "0.18em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.sourceLabel || tone.label}
        </div>
        {item.completed ? (
          <CheckCircle2
            className="h-3.5 w-3.5"
            style={{ color: "var(--ok)", flexShrink: 0 }}
          />
        ) : item.partiallyCompleted ? (
          // Refeição comida em parte (alguns itens) — meia-baixa.
          <CheckCircle2
            className="h-3.5 w-3.5"
            style={{ color: "var(--accent)", flexShrink: 0, opacity: 0.6 }}
          />
        ) : canToggle ? (
          <Circle
            className="h-3.5 w-3.5"
            style={{ color: "#52525b", flexShrink: 0 }}
          />
        ) : null}
      </div>
      <div
        style={{
          color: "#e4e4e7",
          fontSize: 11,
          fontWeight: 600,
          marginTop: 2,
          overflow: "hidden",
          textDecoration: item.completed ? "line-through" : "none",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {item.title}
      </div>
    </>
  );

  if (!canToggle) {
    return (
      <Link
        href={item.route}
        title={`${item.time ?? "Sem horário"} · ${item.title}`}
        style={baseStyle}
      >
        {inner}
      </Link>
    );
  }

  // Ações: completo → "Tirar baixa". Parcial (refeição comida em parte /
  // hidratação tocada) → "Concluir" (sobe pra completo). Pendente → "Dar baixa".
  const actionLabel = item.completed
    ? "Tirar baixa"
    : item.partiallyCompleted
      ? "Concluir"
      : "Dar baixa";

  return (
    <button
      type="button"
      onClick={() => onToggle(item)}
      title={`${actionLabel} · ${item.title}`}
      style={{
        ...baseStyle,
        border: "none",
        borderLeft: `3px solid ${tone.color}`,
        cursor: "pointer",
      }}
    >
      {inner}
    </button>
  );
}

export default function AgendaPage() {
  const { state, actions } = useAppStore();
  const toast = useToast();
  const today = useMemo(() => new Date(), []);
  const todayKey = formatDateKey(today);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDateKey, setSelectedDateKey] = useState(() => formatDateKey(today));

  // Dá/tira baixa direto da Agenda (sincronizado com Missões), pro DIA
  // do evento — inclusive dias passados. Regra geral:
  //   - pendente / parcial (✓ âmbar) → marca como CONCLUÍDO. Pra refeição
  //     parcial, sobe pra completo (todos os items do dia). Pra hidratação
  //     parcial (bebeu mas não fechou a meta), marca a task como completa
  //     manualmente — sem isto o clique parecia "não fazer nada" porque a
  //     UI seguia em ✓ âmbar.
  //   - já completo (✓ verde) → TIRA a baixa. Pra treino com log de carga,
  //     pede confirm e apaga também os logs (sem isto, remover só a
  //     completion deixava a UI ainda como ✓ porque o log conta como feito).
  function handleToggleItem(item: AgendaEvent) {
    const dateKey = item.dateKey;
    const isToday = dateKey === todayKey;
    // "Concluído" = check verde. Parcial (âmbar) é tratado como pendente
    // pra que o clique SUBA pra completo, não tente desmarcar.
    const wasDone = item.completed;

    if (item.taskId) {
      if (isToday) {
        actions.toggleTask(item.taskId);
      } else {
        actions.toggleTaskCompletionForDate({ taskId: item.taskId, dateKey });
      }
    } else if (item.mealBlockId) {
      // Parcial vira completo (marca todos itens); já-completo desmarca tudo.
      actions.setMealBlockItemsCompleted({
        blockId: item.mealBlockId,
        completed: !wasDone,
        dateKey,
      });
    } else if (item.workoutDayId) {
      const entryIds = item.workoutLoadEntryIds ?? [];
      if (wasDone && entryIds.length > 0) {
        // Tem log de carga — sem apagar o log, a UI segue mostrando ✓
        // (hasLogOnDate continua true). Confirm pra não destruir
        // histórico de pesos por engano.
        const ok = window.confirm(
          `Desfazer "${item.title}"? Isso vai remover ${entryIds.length} registro(s) de carga salvos no histórico — não dá pra desfazer depois.`,
        );
        if (!ok) return;
        actions.removeWorkoutLoadBatch(entryIds);
      }
      // Toggle da completion (cria se não havia, remove se havia).
      actions.toggleWorkoutDayCompleted({ dayId: item.workoutDayId, dateKey });
    } else if (item.recoveryDayId) {
      const list = state.recoveryDayCompletions ?? [];
      const exists = list.some(
        (entry) => entry.dayId === item.recoveryDayId && entry.dateKey === dateKey,
      );
      if (exists) {
        actions.replaceRecoveryDayCompletions(
          list.filter(
            (entry) =>
              !(entry.dayId === item.recoveryDayId && entry.dateKey === dateKey),
          ),
        );
      } else {
        const completion: RecoveryDayCompletion = {
          id: makeId("rcomp"),
          programId: "default",
          dayId: item.recoveryDayId,
          dayTitle: item.title,
          dateKey,
          completedAt: new Date().toISOString(),
        };
        actions.replaceRecoveryDayCompletions([completion, ...list]);
      }
    } else {
      return;
    }

    toast.push({
      message: wasDone
        ? `Baixa removida: ${item.title}`
        : `Concluída: ${item.title}`,
    });
  }

  const referenceDate = useMemo(
    () => buildReferenceDate(today, weekOffset),
    [today, weekOffset],
  );

  const weekAgenda = useMemo(
    () => buildWeekAgenda(state, referenceDate),
    [state, referenceDate],
  );

  const selectedDay =
    weekAgenda.find((day) => day.dateKey === selectedDateKey) ?? weekAgenda[0];

  const agendaRows = useMemo(
    () =>
      agendaSlots.map((slot) => ({
        slot,
        days: weekAgenda.map((day) => ({
          dateKey: day.dateKey,
          items: day.items.filter((item) => slotForAgendaItem(item) === slot),
        })),
      })),
    [weekAgenda],
  );

  const unscheduledDays = useMemo(
    () =>
      weekAgenda.map((day) => ({
        dateKey: day.dateKey,
        items: day.items.filter((item) => !item.time),
      })),
    [weekAgenda],
  );

  const hasUnscheduled = unscheduledDays.some((day) => day.items.length > 0);
  const weekTotal = weekAgenda.reduce((sum, day) => sum + day.totalCount, 0);
  const weekCompleted = weekAgenda.reduce((sum, day) => sum + day.completedCount, 0);
  const weekConsistency = weekTotal ? (weekCompleted / weekTotal) * 100 : 0;

  function focusToday() {
    setWeekOffset(0);
    setSelectedDateKey(formatDateKey(today));
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div className="page-eyebrow">Agenda</div>
        <h1 className="page-title-v2">Semana operacional</h1>
        <p className="page-description-v2">
          Visão da semana por horário, com as tarefas reais do sistema prontas
          para abrir no módulo certo.
        </p>
      </div>

      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 18,
        }}
      >
        <button
          type="button"
          onClick={() => setWeekOffset((current) => current - 1)}
          className="v2-btn v2-btn-icon v2-btn-ghost"
          aria-label="Semana anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="badge" style={{ padding: "8px 14px" }}>
          {formatWeekRange(weekAgenda)}
        </span>
        <button
          type="button"
          onClick={() => setWeekOffset((current) => current + 1)}
          className="v2-btn v2-btn-icon v2-btn-ghost"
          aria-label="Próxima semana"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={focusToday} className="v2-btn v2-btn-sm v2-btn-ok">
          Hoje
        </button>
        <span className="badge badge-ok" style={{ marginLeft: "auto" }}>
          {Math.round(weekConsistency)}% semana
        </span>
        <Link
          href="/tasks"
          className="v2-btn v2-btn-primary"
          style={{ textDecoration: "none" }}
        >
          Abrir tarefas <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Mobile-only day strip + selected day detail. The full weekly
          grid below (940px wide) is hopeless on a phone — too much
          horizontal scroll. On small screens we show a compact day
          picker and just the events for the selected day. */}
      <div className="agenda-mobile-stack lg:hidden" style={{ marginBottom: 16 }}>
        <div
          className="glass"
          style={{ padding: 12, overflowX: "auto", marginBottom: 12 }}
        >
          <div style={{ display: "flex", gap: 6, minWidth: "min-content" }}>
            {weekAgenda.map((day) => {
              const selected = day.dateKey === selectedDay?.dateKey;
              const isToday = isSameDate(day.date, today);
              return (
                <button
                  key={`m-${day.dateKey}`}
                  type="button"
                  onClick={() => setSelectedDateKey(day.dateKey)}
                  style={{
                    flex: "0 0 auto",
                    minWidth: 56,
                    padding: "10px 6px",
                    borderRadius: 12,
                    border: selected
                      ? "1px solid rgba(74,222,128,0.45)"
                      : "1px solid rgba(39,39,42,0.8)",
                    background: selected
                      ? "rgba(74,222,128,0.1)"
                      : isToday
                        ? "rgba(74,222,128,0.04)"
                        : "rgba(18,18,20,0.88)",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  <div
                    className="praxis-label"
                    style={{
                      fontSize: 9,
                      color: selected || isToday ? "var(--ok)" : "#71717a",
                      marginBottom: 4,
                    }}
                  >
                    {day.shortLabel}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-space-grotesk), sans-serif",
                      fontSize: 18,
                      fontWeight: 700,
                      letterSpacing: "-0.03em",
                      color: selected || isToday ? "#d1fae5" : "#f4f4f5",
                    }}
                  >
                    {day.date.getDate().toString().padStart(2, "0")}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      marginTop: 2,
                      color: selected || isToday ? "var(--ok)" : "#52525b",
                    }}
                  >
                    {day.totalCount}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="glass" style={{ padding: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <div>
              <div className="praxis-label" style={{ color: "var(--ok)" }}>
                {selectedDay?.shortLabel ?? "—"}
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontFamily: "var(--font-space-grotesk), sans-serif",
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  color: "#f4f4f5",
                }}
              >
                {selectedDay
                  ? `${selectedDay.date.getDate().toString().padStart(2, "0")} ${selectedDay.shortLabel}`
                  : "—"}
              </div>
            </div>
            <span className="badge badge-dim">
              {selectedDay?.totalCount ?? 0} tarefas
            </span>
          </div>

          {selectedDay && selectedDay.items.length === 0 ? (
            <p style={{ color: "#71717a", fontSize: 13, lineHeight: 1.6 }}>
              Sem eventos para este dia. Bom momento para descansar ou planejar
              o próximo bloco.
            </p>
          ) : null}

          {/* Group by agenda slot, plus a "Dia todo" bucket for untimed items. */}
          {selectedDay
            ? agendaSlots.map((slot) => {
                const itemsInSlot = selectedDay.items.filter(
                  (item) => slotForAgendaItem(item) === slot,
                );
                if (itemsInSlot.length === 0) return null;
                return (
                  <div key={`m-slot-${slot}`} style={{ marginBottom: 12 }}>
                    <div
                      className="praxis-label"
                      style={{ color: "#52525b", fontSize: 10, marginBottom: 6 }}
                    >
                      {slot}
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {itemsInSlot.map((item) => (
                        <AgendaEventChip key={item.id} item={item} canToggle={item.dateKey <= todayKey} onToggle={handleToggleItem} />
                      ))}
                    </div>
                  </div>
                );
              })
            : null}

          {selectedDay && selectedDay.items.some((item) => !item.time) ? (
            <div>
              <div
                className="praxis-label"
                style={{ color: "#52525b", fontSize: 10, marginBottom: 6 }}
              >
                Dia todo
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {selectedDay.items
                  .filter((item) => !item.time)
                  .map((item) => (
                    <AgendaEventChip key={`m-day-${item.id}`} item={item} canToggle={item.dateKey <= todayKey} onToggle={handleToggleItem} />
                  ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Desktop / tablet weekly grid (≥lg). Hidden on phones because the
          940px content is impractical to scroll horizontally there. */}
      <div className="glass hidden lg:block" style={{ marginBottom: 24, overflow: "hidden", padding: 0 }}>
        <div style={{ overflowX: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "72px repeat(7, minmax(124px, 1fr))",
              minWidth: 980,
            }}
          >
            <div
              style={{
                background: "rgba(0,0,0,0.28)",
                borderBottom: "1px solid rgba(39,39,42,0.6)",
                borderRight: "1px solid rgba(39,39,42,0.6)",
              }}
            />
            {weekAgenda.map((day) => {
              const selected = day.dateKey === selectedDay?.dateKey;
              const isToday = isSameDate(day.date, today);

              return (
                <button
                  data-agenda-day
                  type="button"
                  key={day.dateKey}
                  onClick={() => setSelectedDateKey(day.dateKey)}
                  style={{
                    background: selected
                      ? "rgba(74,222,128,0.1)"
                      : isToday
                        ? "rgba(74,222,128,0.05)"
                        : "rgba(0,0,0,0.24)",
                    border: "none",
                    borderBottom: "1px solid rgba(39,39,42,0.6)",
                    borderLeft: "1px solid rgba(39,39,42,0.45)",
                    color: "inherit",
                    cursor: "pointer",
                    minHeight: 92,
                    padding: "14px 10px",
                    textAlign: "center",
                  }}
                >
                  <div
                    className="praxis-label"
                    style={{
                      color: selected || isToday ? "var(--ok)" : "#71717a",
                      marginBottom: 6,
                    }}
                  >
                    {day.shortLabel}
                  </div>
                  <div
                    style={{
                      color: selected || isToday ? "#d1fae5" : "#f4f4f5",
                      fontFamily: "var(--font-space-grotesk), sans-serif",
                      fontSize: 24,
                      fontWeight: 700,
                      letterSpacing: "-0.04em",
                    }}
                  >
                    {day.date.getDate().toString().padStart(2, "0")}
                  </div>
                  <div
                    style={{
                      color: selected || isToday ? "var(--ok)" : "#71717a",
                      fontSize: 11,
                      marginTop: 6,
                    }}
                  >
                    {day.totalCount} tarefas
                  </div>
                </button>
              );
            })}

            {agendaRows.map((row) => (
              <Fragment key={row.slot}>
                <div
                  style={{
                    background: "rgba(0,0,0,0.2)",
                    borderBottom: "1px solid rgba(39,39,42,0.35)",
                    borderRight: "1px solid rgba(39,39,42,0.6)",
                    color: "#52525b",
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    minHeight: 72,
                    padding: "10px 9px",
                    textAlign: "right",
                  }}
                >
                  {row.slot}
                </div>
                {row.days.map((day) => {
                  const selected = day.dateKey === selectedDay?.dateKey;

                  return (
                    <div
                      key={`${row.slot}-${day.dateKey}`}
                      style={{
                        background: selected ? "rgba(74,222,128,0.025)" : "transparent",
                        borderBottom: "1px solid rgba(39,39,42,0.35)",
                        borderLeft: "1px solid rgba(39,39,42,0.35)",
                        minHeight: 72,
                        padding: 5,
                      }}
                    >
                      <div style={{ display: "grid", gap: 4 }}>
                        {day.items.slice(0, 3).map((item) => (
                          <AgendaEventChip key={item.id} item={item} canToggle={item.dateKey <= todayKey} onToggle={handleToggleItem} />
                        ))}
                        {day.items.length > 3 ? (
                          <button
                            type="button"
                            onClick={() => setSelectedDateKey(day.dateKey)}
                            className="badge badge-sm"
                            style={{
                              borderRadius: 6,
                              cursor: "pointer",
                              justifyContent: "center",
                              width: "100%",
                            }}
                          >
                            +{day.items.length - 3}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </Fragment>
            ))}

            {hasUnscheduled ? (
              <>
                <div
                  style={{
                    background: "rgba(0,0,0,0.2)",
                    borderRight: "1px solid rgba(39,39,42,0.6)",
                    color: "#52525b",
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    minHeight: 72,
                    padding: "10px 9px",
                    textAlign: "right",
                  }}
                >
                  Dia todo
                </div>
                {unscheduledDays.map((day) => {
                  const selected = day.dateKey === selectedDay?.dateKey;

                  return (
                    <div
                      key={`unscheduled-${day.dateKey}`}
                      style={{
                        background: selected ? "rgba(74,222,128,0.025)" : "transparent",
                        borderLeft: "1px solid rgba(39,39,42,0.35)",
                        minHeight: 72,
                        padding: 5,
                      }}
                    >
                      <div style={{ display: "grid", gap: 4 }}>
                        {day.items.slice(0, 3).map((item) => (
                          <AgendaEventChip key={item.id} item={item} canToggle={item.dateKey <= todayKey} onToggle={handleToggleItem} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        {[
          { label: "Treino", color: "var(--accent)" },
          { label: "Nutrição", color: "var(--ok)" },
          { label: "Tarefa", color: "var(--ocean)" },
        ].map((item) => (
          <span
            key={item.label}
            className="badge"
            style={{ borderColor: item.color, color: item.color }}
          >
            ▪ {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
