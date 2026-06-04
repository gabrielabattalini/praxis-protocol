"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileBarChart,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import {
  buildWeeklyReport,
  weekReference,
  type WeeklyReport,
} from "@/lib/weekly-report";

function percentColor(percent: number) {
  if (percent >= 80) return "var(--ok)";
  if (percent >= 50) return "var(--accent)";
  return "#f87171";
}

function Bar({ percent }: { percent: number }) {
  return (
    <div
      style={{
        height: 8,
        borderRadius: 999,
        background: "rgba(39,39,42,0.7)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${Math.min(100, percent)}%`,
          background: percentColor(percent),
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}

export default function WeeklyReportPage() {
  const { state } = useAppStore();
  // weeksAgo=1 = última semana fechada (default). 0 = semana atual.
  const [weeksAgo, setWeeksAgo] = useState(1);

  const report: WeeklyReport = useMemo(
    () => buildWeeklyReport(state, weekReference(weeksAgo)),
    [state, weeksAgo],
  );

  const TrendIcon =
    report.trend == null
      ? Minus
      : report.trend.delta > 0
        ? TrendingUp
        : report.trend.delta < 0
          ? TrendingDown
          : Minus;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="mod-hero">
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div className="mod-icon" style={{ width: 56, height: 56, borderRadius: 14, fontSize: 24 }}>
            <FileBarChart className="h-7 w-7" />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="praxis-label" style={{ color: "var(--accent)", marginBottom: 4 }}>
              ▸ RELATÓRIO SEMANAL
            </div>
            <div className="praxis-title" style={{ fontSize: 26 }}>
              {report.rangeLabel}
              {report.isCurrentWeek ? (
                <span style={{ fontSize: 13, color: "var(--fg-3)", marginLeft: 8 }}>
                  (em andamento)
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
              {report.summary}
            </div>
          </div>
          {/* Week navigation + actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setWeeksAgo((value) => value + 1)}
              className="v2-btn v2-btn-sm v2-btn-ghost"
              title="Semana anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setWeeksAgo((value) => Math.max(0, value - 1))}
              disabled={weeksAgo === 0}
              className="v2-btn v2-btn-sm v2-btn-ghost"
              title="Semana seguinte"
              style={weeksAgo === 0 ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <a
              href={`/api/reports/weekly/pdf?weeksAgo=${weeksAgo}`}
              className="v2-btn v2-btn-sm v2-btn-ok"
              title="Baixar relatório em PDF"
            >
              <Download className="h-4 w-4" />
              PDF
            </a>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <div className="kpi">
          <div className="praxis-label">Disciplina</div>
          <div className="kpi-value" style={{ color: percentColor(report.overall.percent) }}>
            {report.overall.percent}%
          </div>
          <div className="kpi-sub">
            {report.overall.completed}/{report.overall.total} atividades
          </div>
        </div>
        <div className="kpi">
          <div className="praxis-label">Vs. semana anterior</div>
          <div
            className="kpi-value"
            style={{
              color:
                report.trend == null
                  ? "var(--fg)"
                  : report.trend.delta > 0
                    ? "var(--ok)"
                    : report.trend.delta < 0
                      ? "#f87171"
                      : "var(--fg)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <TrendIcon className="h-5 w-5" />
            {report.trend == null
              ? "—"
              : `${report.trend.delta > 0 ? "+" : ""}${report.trend.delta} pts`}
          </div>
          <div className="kpi-sub">
            {report.trend == null
              ? "Sem base anterior"
              : `Antes: ${report.trend.previousPercent}%`}
          </div>
        </div>
        <div className="kpi">
          <div className="praxis-label">XP na semana</div>
          <div className="kpi-value" style={{ color: "var(--accent)" }}>{report.xpEarned}</div>
          <div className="kpi-sub">Concluído</div>
        </div>
        <div className="kpi">
          <div className="praxis-label">Melhor dia</div>
          <div className="kpi-value" style={{ fontSize: 20 }}>
            {report.bestDay ? report.bestDay.dayLabel : "—"}
          </div>
          <div className="kpi-sub">
            {report.bestDay ? `${report.bestDay.percent}% concluído` : "Sem dados"}
          </div>
        </div>
      </div>

      {/* Day-by-day */}
      <GlassPanel className="space-y-4">
        <div>
          <p className="praxis-label text-[var(--accent)]">Dia a dia</p>
          <h2 className="praxis-title text-2xl">Como foi cada dia</h2>
        </div>
        <div className="space-y-3">
          {report.days.map((day) => (
            <div key={day.dateKey} style={{ display: "grid", gridTemplateColumns: "90px 1fr 70px", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--fg-2)" }}>{day.dayLabel}</span>
              <Bar percent={day.percent} />
              <span style={{ fontSize: 12, color: "var(--fg-3)", textAlign: "right" }}>
                {day.total > 0 ? `${day.completed}/${day.total}` : "—"}
              </span>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* Modules ranking */}
      <GlassPanel className="space-y-4">
        <div>
          <p className="praxis-label text-[var(--accent)]">Por módulo</p>
          <h2 className="praxis-title text-2xl">Aderência de cada área</h2>
        </div>
        {report.modules.length ? (
          <div className="space-y-3">
            {report.modules.map((mod) => (
              <div key={mod.module} style={{ display: "grid", gridTemplateColumns: "130px 1fr 90px", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "var(--fg-2)" }}>{mod.module}</span>
                <Bar percent={mod.percent} />
                <span style={{ fontSize: 12, color: percentColor(mod.percent), textAlign: "right", fontWeight: 600 }}>
                  {mod.percent}% ({mod.completed}/{mod.scheduled})
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Nenhuma atividade nesta semana.</p>
        )}
      </GlassPanel>

      {/* "Atividades · O que foi executado" removida — duplicava a
          visão de "Por módulo · Aderência" acima. A granularidade por
          atividade individual continua disponível no PDF, na seção
          "Ficou pra trás" e no resumo do relatório. */}

      {/* Left behind + what to improve */}
      <GlassPanel className="space-y-4">
        <div>
          <p className="praxis-label" style={{ color: "#f87171" }}>Ficou pra trás</p>
          <h2 className="praxis-title text-2xl">O que precisa melhorar</h2>
        </div>

        {report.topToImprove.length ? (
          <>
            <div className="space-y-2">
              <p className="text-sm text-zinc-400">Foco pra próxima semana:</p>
              {report.topToImprove.map((activity, index) => (
                <div
                  key={activity.key}
                  className="rounded-sm border px-4 py-3"
                  style={{ borderColor: "rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.06)", display: "flex", alignItems: "center", gap: 12 }}
                >
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#f87171", width: 24 }}>
                    {index + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="truncate" style={{ fontSize: 14, color: "var(--fg)", fontWeight: 500 }}>
                      {activity.title}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--fg-3)" }}>
                      {activity.module} · perdeu {activity.missed} de {activity.scheduled} dias
                    </p>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: percentColor(activity.percent) }}>
                    {activity.percent}%
                  </span>
                </div>
              ))}
            </div>

            {report.leftBehind.length > report.topToImprove.length ? (
              <details>
                <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--fg-3)" }}>
                  Ver todas as {report.leftBehind.length} pendências
                </summary>
                <div className="mt-3 space-y-2">
                  {report.leftBehind.slice(report.topToImprove.length).map((activity) => (
                    <div
                      key={activity.key}
                      className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.92)] px-4 py-2"
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p className="truncate" style={{ fontSize: 13, color: "var(--fg-2)" }}>
                          {activity.title}
                        </p>
                        <p style={{ fontSize: 11, color: "var(--fg-3)" }}>{activity.module}</p>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--fg-3)", whiteSpace: "nowrap" }}>
                        {activity.completed}/{activity.scheduled}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </>
        ) : (
          <div className="rounded-sm border border-dashed border-zinc-800 bg-black/40 p-5 text-sm text-zinc-500">
            {report.overall.total === 0
              ? "Nenhuma atividade caiu nesta semana."
              : "Nenhuma pendência — você fechou tudo que estava agendado. 🎯"}
          </div>
        )}
      </GlassPanel>

      <p style={{ fontSize: 11, color: "var(--fg-3)", textAlign: "center" }}>
        Em breve: PDF pra baixar e envio automático toda segunda por push, Telegram e e-mail.
      </p>
    </div>
  );
}
