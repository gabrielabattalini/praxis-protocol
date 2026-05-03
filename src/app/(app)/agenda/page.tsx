"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  UtensilsCrossed,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import {
  RxLabel,
  RxPBar,
  RxPageHeader,
  RxPanel,
} from "@/components/redesign/primitives";
import { buildWeekAgenda, type AgendaEvent } from "@/lib/agenda";
import { formatPoints } from "@/lib/utils";

function formatFullDate(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

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
      icon: UtensilsCrossed,
      color: "var(--ok)",
    };
  }
  if (kind === "workout") {
    return {
      icon: Dumbbell,
      color: "var(--accent)",
    };
  }
  return {
    icon: CalendarClock,
    color: "var(--fg-3)",
  };
}

function buildReferenceDate(base: Date, weekOffset: number) {
  const next = new Date(base);
  next.setDate(base.getDate() + weekOffset * 7);
  return next;
}

export default function AgendaPage() {
  const { state } = useAppStore();
  const today = useMemo(() => new Date(), []);
  const [weekOffset, setWeekOffset] = useState(0);

  const referenceDate = useMemo(
    () => buildReferenceDate(today, weekOffset),
    [today, weekOffset],
  );

  const weekAgenda = useMemo(
    () => buildWeekAgenda(state, referenceDate),
    [state, referenceDate],
  );

  const [selectedDateKey, setSelectedDateKey] = useState(weekAgenda[0]?.dateKey ?? "");

  const selectedDay =
    weekAgenda.find((day) => day.dateKey === selectedDateKey) ?? weekAgenda[0];

  const selectedDayIndex = weekAgenda.findIndex(
    (day) => day.dateKey === selectedDay?.dateKey,
  );

  const pendingItems = selectedDay?.items.filter((item) => !item.completed) ?? [];
  const completedItems = selectedDay?.items.filter((item) => item.completed) ?? [];
  const totalXp = pendingItems.reduce((sum, item) => sum + (item.xp ?? 0), 0);
  const consistency =
    selectedDay?.totalCount ? (selectedDay.completedCount / selectedDay.totalCount) * 100 : 0;
  const featuredItem = pendingItems[0] ?? completedItems[0];

  const flowItems = [
    ...pendingItems,
    ...completedItems,
  ].filter((item) => item.id !== featuredItem?.id);

  return (
    <div>
      <RxPageHeader
        title="Agenda"
        subtitle={
          <>
            Período · {formatWeekRange(weekAgenda)} ·{" "}
            <span style={{ color: "var(--accent)" }}>
              {selectedDayIndex >= 0 ? `dia ${selectedDayIndex + 1}/7` : "semana"}
            </span>
          </>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => setWeekOffset((c) => c - 1)}
              className="rx-btn-ghost"
              style={{ padding: 8 }}
              aria-label="Semana anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((c) => c + 1)}
              className="rx-btn-ghost"
              style={{ padding: 8 }}
              aria-label="Próxima semana"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <Link
              href="/tasks"
              className="rx-btn-primary"
              style={{ padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              Tarefas <ArrowRight className="h-3 w-3" />
            </Link>
          </>
        }
      />

      {/* Week strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: 10,
          marginBottom: 18,
        }}
      >
        {weekAgenda.map((day) => {
          const selected = day.dateKey === selectedDay?.dateKey;
          const completion =
            day.totalCount > 0
              ? Math.round((day.completedCount / day.totalCount) * 100)
              : 0;
          return (
            <button
              key={day.dateKey}
              type="button"
              onClick={() => setSelectedDateKey(day.dateKey)}
              className={selected ? "rx-panel-hot" : "rx-panel"}
              style={{
                padding: 12,
                textAlign: "center",
                cursor: "pointer",
                fontFamily: "inherit",
                color: "inherit",
                border: selected ? "1px solid var(--accent)" : undefined,
              }}
            >
              <div
                className="rx-mono"
                style={{
                  fontSize: 9,
                  color: selected ? "var(--accent)" : "var(--fg-3)",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                }}
              >
                {day.shortLabel}
              </div>
              <div
                className="rx-display"
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: selected ? "var(--accent)" : "var(--fg)",
                  marginTop: 6,
                  letterSpacing: "-0.02em",
                }}
              >
                {day.date.getDate().toString().padStart(2, "0")}
              </div>
              <div
                className="rx-mono"
                style={{
                  fontSize: 9,
                  color: "var(--fg-4)",
                  letterSpacing: "0.18em",
                  marginTop: 6,
                }}
              >
                {day.completedCount}/{day.totalCount}
              </div>
              <div style={{ marginTop: 6 }}>
                <RxPBar value={completion} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Split */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 300px) 1fr",
          gap: 16,
        }}
      >
        {/* Sidebar */}
        <div>
          <RxPanel style={{ padding: 18, marginBottom: 14 }}>
            <RxLabel>DIA SELECIONADO</RxLabel>
            <div
              className="rx-display"
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "var(--fg)",
                marginTop: 8,
                letterSpacing: "-0.02em",
              }}
            >
              {selectedDay?.dayLabel ?? "Semana"}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--fg-3)",
                marginTop: 4,
              }}
            >
              {selectedDay ? formatFullDate(selectedDay.date) : "Selecione um dia."}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
                marginTop: 14,
              }}
            >
              {[
                {
                  label: "PEND.",
                  value: pendingItems.length.toString().padStart(2, "0"),
                  color: "var(--fg)",
                },
                {
                  label: "CONCL.",
                  value: completedItems.length.toString().padStart(2, "0"),
                  color: "var(--ok)",
                },
                {
                  label: "XP",
                  value: `+${formatPoints(totalXp)}`,
                  color: "var(--accent)",
                },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  style={{
                    padding: 10,
                    border: "1px solid var(--line)",
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: 12,
                  }}
                >
                  <div
                    className="rx-mono"
                    style={{
                      fontSize: 9,
                      color: "var(--fg-3)",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                    }}
                  >
                    {kpi.label}
                  </div>
                  <div
                    className="rx-display"
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: kpi.color,
                      marginTop: 2,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {kpi.value}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 6,
                }}
              >
                <span
                  className="rx-mono"
                  style={{
                    fontSize: 10,
                    color: "var(--fg-3)",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                  }}
                >
                  Consistência
                </span>
                <span
                  className="rx-mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ok)",
                    fontWeight: 600,
                  }}
                >
                  {Math.round(consistency)}%
                </span>
              </div>
              <RxPBar value={consistency} />
            </div>
          </RxPanel>

          <RxPanel style={{ padding: 14 }}>
            <RxLabel>AÇÕES RÁPIDAS</RxLabel>
            <div
              style={{
                display: "grid",
                gap: 8,
                marginTop: 10,
              }}
            >
              <Link
                href="/tasks"
                className="rx-btn-ghost"
                style={{
                  padding: "10px 12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  textDecoration: "none",
                }}
              >
                <span>Registrar refeição</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/modules/nutrition"
                className="rx-btn-ghost"
                style={{
                  padding: "10px 12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  textDecoration: "none",
                }}
              >
                <span>Registrar biometria</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </RxPanel>
        </div>

        {/* Main flow */}
        <RxPanel style={{ padding: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: 10,
              marginBottom: 16,
              paddingBottom: 14,
              borderBottom: "1px solid var(--line)",
              flexWrap: "wrap",
            }}
          >
            <RxLabel>FLUXO OPERACIONAL DO DIA</RxLabel>
            <span
              className="rx-mono"
              style={{
                fontSize: 10,
                color: "var(--fg-3)",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              {selectedDay?.totalCount ?? 0} blocos
            </span>
          </div>

          {featuredItem ? (
            <Link
              href={featuredItem.route}
              className="rx-panel-hot"
              style={{
                display: "block",
                padding: 18,
                marginBottom: 14,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <span
                  className="rx-mono"
                  style={{
                    fontSize: 10,
                    color: "var(--accent)",
                    letterSpacing: "0.22em",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    padding: "3px 8px",
                    border: "1px solid rgba(251,146,60,0.4)",
                    background: "rgba(251,146,60,0.08)",
                    borderRadius: 12,
                  }}
                >
                  {featuredItem.time || "Sem horário"}
                </span>
                <span
                  className="rx-mono"
                  style={{
                    fontSize: 10,
                    color: "var(--fg-2)",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    padding: "3px 8px",
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                  }}
                >
                  {featuredItem.badgeLabel}
                </span>
              </div>
              <div
                className="rx-display"
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "var(--fg)",
                  letterSpacing: "-0.02em",
                }}
              >
                {featuredItem.title}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--fg-3)",
                  marginTop: 6,
                  lineHeight: 1.5,
                }}
              >
                {featuredItem.description}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 8,
                  marginTop: 14,
                }}
              >
                {[
                  { label: "ORIGEM", value: featuredItem.sourceLabel },
                  {
                    label: "STATUS",
                    value: featuredItem.completed ? "Concluído" : "Em execução",
                  },
                  { label: "TAG", value: featuredItem.badgeLabel },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    style={{
                      padding: 10,
                      border: "1px solid var(--line)",
                      background: "rgba(0,0,0,0.3)",
                      borderRadius: 12,
                    }}
                  >
                    <div
                      className="rx-mono"
                      style={{
                        fontSize: 9,
                        color: "var(--fg-3)",
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                      }}
                    >
                      {kpi.label}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--fg)",
                        fontWeight: 600,
                        marginTop: 4,
                      }}
                    >
                      {kpi.value}
                    </div>
                  </div>
                ))}
              </div>
            </Link>
          ) : null}

          {selectedDay?.items.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {flowItems.map((item) => {
                const tone = toneForKind(item.kind);
                const Icon = tone.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.route}
                    className={`timeline-item${item.completed ? " completed" : ""}`}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      borderLeft: `3px solid ${tone.color}`,
                      opacity: item.completed ? 0.7 : 1,
                    }}
                  >
                    <div className="timeline-time">{item.time || "--:--"}</div>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        display: "grid",
                        placeItems: "center",
                        border: `1px solid ${tone.color}`,
                        background: "rgba(0,0,0,0.3)",
                        color: tone.color,
                        borderRadius: 12,
                        flexShrink: 0,
                      }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="timeline-body">
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          flexWrap: "wrap",
                          marginBottom: 4,
                        }}
                      >
                        <span
                          className="timeline-title"
                          style={{
                            textDecoration: item.completed ? "line-through" : "none",
                            marginBottom: 0,
                          }}
                        >
                          {item.title}
                        </span>
                        <span
                          className="badge badge-sm"
                          style={{
                            color: tone.color,
                            borderColor: tone.color,
                            background: "rgba(0,0,0,0.3)",
                          }}
                        >
                          {item.badgeLabel}
                        </span>
                      </div>
                      <div
                        className="timeline-sub"
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.description}
                      </div>
                      <div
                        className="praxis-label"
                        style={{ fontSize: 9, marginTop: 4, color: "var(--fg-4)" }}
                      >
                        {item.sourceLabel}
                      </div>
                    </div>
                    <div style={{ justifySelf: "end", alignSelf: "center" }}>
                      {item.completed ? (
                        <CheckCircle2 className="h-5 w-5" style={{ color: "var(--ok)" }} />
                      ) : (
                        <ArrowRight className="h-4 w-4" style={{ color: "var(--fg-3)" }} />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                border: "1px dashed var(--line)",
                borderRadius: 12,
              }}
            >
              <Clock3
                className="h-5 w-5"
                style={{ color: "var(--fg-3)", margin: "0 auto" }}
              />
              <div
                className="rx-display"
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--fg)",
                  marginTop: 10,
                  letterSpacing: "-0.01em",
                }}
              >
                Nenhum bloco para esse dia
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--fg-3)",
                  marginTop: 6,
                  maxWidth: 320,
                  marginInline: "auto",
                  lineHeight: 1.5,
                }}
              >
                Abra o centro de tarefas para montar um novo ciclo para esta
                data.
              </div>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 8,
              marginTop: 16,
              paddingTop: 14,
              borderTop: "1px solid var(--line)",
            }}
          >
            <Link
              href="/tasks"
              className="rx-btn-ghost"
              style={{
                padding: "10px 12px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                textDecoration: "none",
              }}
            >
              Centro diário <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/modules/workout"
              className="rx-btn-ghost"
              style={{
                padding: "10px 12px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                textDecoration: "none",
              }}
            >
              Treino do dia <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/dashboard"
              className="rx-btn-ghost"
              style={{
                padding: "10px 12px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                textDecoration: "none",
              }}
            >
              Painel <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </RxPanel>
      </div>
    </div>
  );
}
