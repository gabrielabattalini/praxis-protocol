"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Brain,
  Briefcase,
  Calendar,
  CheckCircle2,
  Dumbbell,
  HeartPulse,
  House,
  Medal,
  MoonStar,
  Pill,
  Plus,
  Shield,
  ShoppingBasket,
  Sparkles,
  Stethoscope,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import {
  MissionCard,
  RxChip,
} from "@/components/redesign/primitives";
import { buildAgendaEvents, buildWeekAgenda } from "@/lib/agenda";
import { moduleCatalog } from "@/lib/mock-data";
import type { AgendaEvent } from "@/lib/agenda";
import type { DashboardSectionId, ModuleId } from "@/lib/types";
import { formatPoints } from "@/lib/utils";

type ModuleSnapshot = {
  id: ModuleId;
  name: string;
  route: string;
  detail: string;
  completed: number;
  total: number;
  progress: number;
  summary: string;
  icon: LucideIcon;
};

const moduleIcons: Record<ModuleId, LucideIcon> = {
  run: Activity,
  workout: Dumbbell,
  work: Briefcase,
  nutrition: UtensilsCrossed,
  finance: Wallet,
  appearance: Sparkles,
  recovery: HeartPulse,
  health: Stethoscope,
  mind: Brain,
  sleep: MoonStar,
  home: House,
  market: ShoppingBasket,
  supplements: Pill,
};

const dashboardSectionLabels: Record<DashboardSectionId, string> = {
  "quick-actions": "Hero HUD",
  timeline: "Agenda · próximas 8h",
  telemetry: "Ritmo semanal",
  modules: "Módulos ativos",
  ranking: "Ranking global",
  skills: "Status do operador",
};

function squareInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "PP"
  );
}

function moduleLabelFromRoute(route: string): string {
  const fromCatalog = moduleCatalog.find((module) => module.route === route);
  if (fromCatalog) return fromCatalog.name.toUpperCase();
  if (route === "/tasks") return "MANUAL";
  if (route === "/agenda") return "AGENDA";
  return "MISSÃO";
}

function difficultyForItem(item: AgendaEvent): number {
  if (item.kind === "workout") return 4;
  if (item.kind === "meal") return 2;
  if ((item.xp ?? 0) >= 200) return 4;
  if ((item.xp ?? 0) >= 100) return 3;
  return 2;
}

function formatHeaderDate(date: Date) {
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .replace(".", "");
  return formatted;
}

export default function DashboardPage() {
  const { state, user, actions } = useAppStore();
  const [isLayoutEditing, setIsLayoutEditing] = useState(false);
  const [missionFilter, setMissionFilter] = useState<
    "all" | "pending" | "overdue"
  >("pending");

  const today = useMemo(() => new Date(), []);
  const todayAgenda = useMemo(() => buildAgendaEvents(state, today), [state, today]);
  const weekAgenda = useMemo(() => buildWeekAgenda(state, today), [state, today]);

  const pendingItems = useMemo(
    () => todayAgenda.filter((item) => !item.completed),
    [todayAgenda],
  );
  const completedItems = useMemo(
    () => todayAgenda.filter((item) => item.completed),
    [todayAgenda],
  );

  // openXp const removido — só era usado no rodapé "Fila de execução"
  // que o usuário pediu pra tirar.
  const earnedXpToday = completedItems.reduce(
    (sum, item) => sum + (item.xp ?? 0),
    0,
  );
  const currentWeek = useMemo(
    () =>
      weekAgenda.map((day) => ({
        ...day,
        percent:
          day.totalCount > 0
            ? Math.round((day.completedCount / day.totalCount) * 100)
            : 0,
      })),
    [weekAgenda],
  );
  const weekXp = currentWeek.reduce(
    (sum, day) => sum + day.completedCount * 120,
    0,
  );

  const disciplinePct = useMemo(() => {
    const done = currentWeek.reduce((sum, day) => sum + day.completedCount, 0);
    const total = currentWeek.reduce((sum, day) => sum + day.totalCount, 0);
    if (total === 0) return 0;
    return Math.round((done / total) * 100);
  }, [currentWeek]);

  const xpProgress = useMemo(() => {
    if (user.isMaxLevel) return 100;
    const span = user.xp + user.xpToNextLevel;
    if (span <= 0) return 0;
    return Math.round((user.xp / span) * 100);
  }, [user.isMaxLevel, user.xp, user.xpToNextLevel]);

  const nextFocusItems = pendingItems.slice(0, 6);

  const filteredMissions = useMemo(() => {
    if (missionFilter === "all") return todayAgenda.slice(0, 6);
    if (missionFilter === "overdue") {
      const now = today.getTime();
      return pendingItems
        .filter((item) => {
          if (!item.time) return false;
          const [hh, mm] = item.time.split(":").map(Number);
          const when = new Date(today);
          when.setHours(hh ?? 0, mm ?? 0, 0, 0);
          return when.getTime() < now;
        })
        .slice(0, 6);
    }
    return pendingItems.slice(0, 6);
  }, [missionFilter, pendingItems, todayAgenda, today]);

  // Leaderboard global removido — era seed fake (Zenkichi, Kurama,
  // Levi etc.) sem sinal real. Enquanto não existe camada social,
  // o usuário é o único operador e fica naturalmente em #1.
  const rankingPosition = 1;

  const moduleSnapshots = useMemo<ModuleSnapshot[]>(() => {
    return moduleCatalog
      .filter((module) => state.settings.activeModules[module.id])
      .map((module) => {
        if (module.id === "nutrition") {
          const total = state.mealPlan.length;
          const completed = state.mealPlan.filter(
            (block) =>
              block.items.length > 0 &&
              block.items.every((item) => item.completed),
          ).length;
          return {
            id: module.id,
            name: module.name,
            route: module.route,
            detail: module.detail,
            completed,
            total,
            progress: total > 0 ? Math.round((completed / total) * 100) : 0,
            summary:
              total > 0
                ? `${completed}/${total} blocos · hoje`
                : "Monte a dieta",
            icon: moduleIcons[module.id],
          };
        }

        if (module.id === "finance") {
          const total = state.financeLessons.length;
          const completed = state.financeLessons.filter(
            (lesson) => lesson.completed,
          ).length;
          return {
            id: module.id,
            name: module.name,
            route: module.route,
            detail: module.detail,
            completed,
            total,
            progress: total > 0 ? Math.round((completed / total) * 100) : 0,
            summary:
              total > 0
                ? `${completed}/${total} aulas`
                : "Ative o módulo",
            icon: moduleIcons[module.id],
          };
        }

        if (module.id === "workout") {
          const total = state.workoutPlan.filter((day) => !day.isRestDay).length;
          const completed = new Set(
            state.workoutDayCompletions.map(
              (item) => `${item.dayId}:${item.dateKey}`,
            ),
          ).size;
          return {
            id: module.id,
            name: module.name,
            route: module.route,
            detail: module.detail,
            completed,
            total,
            progress: total > 0 ? Math.round((completed / total) * 100) : 0,
            summary:
              completed > 0
                ? `${user.streak}D STREAK · ${completed} sessões`
                : "1ª sessão",
            icon: moduleIcons[module.id],
          };
        }

        const tasks = state.tasks.filter(
          (task) => task.moduleId === module.id,
        );
        const total = tasks.length;
        const completed = tasks.filter((task) => task.completed).length;
        return {
          id: module.id,
          name: module.name,
          route: module.route,
          detail: module.detail,
          completed,
          total,
          progress: total > 0 ? Math.round((completed / total) * 100) : 0,
          summary:
            total > 0
              ? `${completed}/${total} tarefas`
              : "Sem rotina",
          icon: moduleIcons[module.id],
        };
      });
  }, [
    state.financeLessons,
    state.mealPlan,
    state.settings.activeModules,
    state.tasks,
    state.workoutDayCompletions,
    state.workoutPlan,
    user.streak,
  ]);

  const activeModuleCount = moduleSnapshots.length;
  const topModules = moduleSnapshots.slice(0, 6);

  const sectionOrder = state.settings.dashboardSectionOrder;
  const hiddenSections = new Set(state.settings.hiddenDashboardSections);
  const visibleSectionOrder = sectionOrder.filter(
    (sectionId) => !hiddenSections.has(sectionId),
  );

  // histogramBars useMemo deleted — the only consumer (operationsPanel
  // "XP por hora · 24h" visualization) was removed.

  const totalAgenda = todayAgenda.length;
  const executionPct = totalAgenda
    ? Math.round((completedItems.length / totalAgenda) * 100)
    : 0;
  const ringCircumference = 2 * Math.PI * 46; // ~289
  const ringDashOffset = ringCircumference * (1 - executionPct / 100);

  const heroHud = (
    <div className="glass">
      <div
        className="dashboard-hero-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 360px)",
          gap: 32,
          alignItems: "start",
        }}
      >
        <div>
          <div className="praxis-label" style={{ color: "var(--accent)", marginBottom: 8 }}>
            Score do dia
          </div>
          <h2 className="praxis-title" style={{ fontSize: 24 }}>
            Leitura de execução
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "#71717a",
              marginTop: 8,
              lineHeight: 1.6,
            }}
          >
            Estado real do dia — não só o que foi planejado.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
              marginTop: 20,
            }}
          >
            <div className="kpi">
              <div className="praxis-label">Pendentes</div>
              <div className="kpi-value">{pendingItems.length}</div>
            </div>
            <div className="kpi">
              <div className="praxis-label">Concluídas</div>
              <div className="kpi-value">{completedItems.length}</div>
            </div>
            {/* "XP em aberto" KPI removida a pedido do usuário. */}
          </div>

          {/* Hero level / XP */}
          <div
            style={{
              marginTop: 20,
              padding: 16,
              border: "1px solid rgba(39,39,42,0.8)",
              borderRadius: 14,
              background: "rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 8,
              }}
            >
              <div className="praxis-label">Nível {user.level}</div>
              <span
                className="praxis-label"
                style={{ color: "var(--accent)" }}
              >
                {xpProgress}% → {user.level + 1}
              </span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
            <div
              className="dashboard-hero-stats"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 8,
                marginTop: 14,
              }}
            >
              <div>
                <div className="praxis-label">XP HOJE</div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#f4f4f5",
                    marginTop: 4,
                  }}
                >
                  +{formatPoints(earnedXpToday)}
                </div>
              </div>
              <div>
                <div className="praxis-label">MISSÕES</div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#f4f4f5",
                    marginTop: 4,
                  }}
                >
                  {completedItems.length}/{totalAgenda}
                </div>
              </div>
              <div>
                <div className="praxis-label">XP 7D</div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#f4f4f5",
                    marginTop: 4,
                  }}
                >
                  +{formatPoints(weekXp)}
                </div>
              </div>
              <div>
                <div className="praxis-label">DISCIP.</div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#f4f4f5",
                    marginTop: 4,
                  }}
                >
                  {disciplinePct}%
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div
            className="score-ring"
            style={{ position: "relative", width: 200, height: 200 }}
          >
            <svg
              width={200}
              height={200}
              viewBox="0 0 120 120"
              style={{ display: "block", transform: "rotate(-90deg)" }}
            >
              <circle
                cx="60"
                cy="60"
                r="46"
                fill="none"
                stroke="rgba(39,39,42,.9)"
                strokeWidth="10"
              />
              <circle
                cx="60"
                cy="60"
                r="46"
                fill="none"
                stroke="url(#dashboard-score-gradient)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringDashOffset}
              />
              <defs>
                <linearGradient
                  id="dashboard-score-gradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="#fb923c" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div className="praxis-label">Execução</div>
              <div
                className="praxis-title"
                style={{ fontSize: 42, marginTop: 4 }}
              >
                {executionPct}%
              </div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#71717a",
                }}
              >
                ciclo diário
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              width: "100%",
            }}
          >
            <div className="kpi">
              <div className="praxis-label">Operador</div>
              <div className="kpi-value" style={{ fontSize: 22 }}>
                {squareInitials(user.name)}
              </div>
              <div className="kpi-sub">{user.username}</div>
            </div>
            <div className="kpi">
              <div className="praxis-label">Sequência</div>
              <div className="kpi-value" style={{ fontSize: 22 }}>
                {user.streak}d
              </div>
              <div className="kpi-sub">Consistência ativa</div>
            </div>
          </div>

          <div style={{ width: "100%" }}>
            <span className="rank-tag">
              ◆ {user.rankTier} {user.rankLabel} · #{rankingPosition}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  // operationsPanel JSX deleted — the "Operações · hoje / XP por hora ·
  // 24h" panel was removed at the user's request. histogramBars is no
  // longer rendered anywhere but still computed above; harmless to keep.

  const missionsSection = (
    <div className="glass">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 16,
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            className="praxis-label"
            style={{ color: "var(--accent)", marginBottom: 8 }}
          >
            Missões do dia
          </div>
          <h2 className="praxis-title" style={{ fontSize: 24 }}>
            Fila de execução
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "#71717a",
              marginTop: 6,
            }}
          >
            {pendingItems.length} pendentes · {completedItems.length}{" "}
            concluídas
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <RxChip
            as="button"
            active={missionFilter === "all"}
            onClick={() => setMissionFilter("all")}
          >
            TODAS
          </RxChip>
          <RxChip
            as="button"
            active={missionFilter === "pending"}
            onClick={() => setMissionFilter("pending")}
          >
            PENDENTES
          </RxChip>
          <RxChip
            as="button"
            active={missionFilter === "overdue"}
            onClick={() => setMissionFilter("overdue")}
          >
            ATRASADAS
          </RxChip>
        </div>
      </div>

      {filteredMissions.length === 0 ? (
        <div
          className="item-card"
          style={{ padding: 32, textAlign: "center" }}
        >
          <CheckCircle2
            className="mx-auto h-6 w-6"
            style={{ color: "var(--ok)" }}
          />
          <div
            className="praxis-title"
            style={{ marginTop: 12, fontSize: 18 }}
          >
            Tudo limpo por aqui
          </div>
          <div
            className="praxis-label"
            style={{ marginTop: 6 }}
          >
            Nenhuma missão nesse filtro
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {filteredMissions.map((item) => (
            <MissionCard
              key={item.id}
              moduleLabel={moduleLabelFromRoute(item.route)}
              title={item.title}
              // Meta was "time · description" — the description usually
              // just restates the title (e.g. "Acordar às 8h da manhã"
              // for a task already titled "Acordar"). Showing only the
              // time keeps signal, drops noise.
              meta={item.time ?? "Sem horário"}
              xp={`+${item.xp ?? 0} XP`}
              difficulty={difficultyForItem(item)}
              state={item.completed ? "done" : "pending"}
              href={item.route}
            />
          ))}
        </div>
      )}
    </div>
  );

  const modulesPanel = (
    <div className="glass">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 16,
        }}
      >
        <div>
          <div
            className="praxis-label"
            style={{ color: "var(--accent)", marginBottom: 8 }}
          >
            Sistema
          </div>
          <h2 className="praxis-title" style={{ fontSize: 24 }}>
            Módulos ativos · {activeModuleCount}
          </h2>
        </div>
        <Link
          href="/profile"
          className="praxis-label"
          style={{ color: "var(--accent)", textDecoration: "none" }}
        >
          Ver todos →
        </Link>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 12,
        }}
      >
        {topModules.map((module) => {
          const Icon = module.icon;
          return (
            <Link
              key={module.id}
              href={module.route}
              className="item-card"
              style={{ display: "block", textDecoration: "none", color: "inherit" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#f4f4f5",
                      marginBottom: 4,
                    }}
                  >
                    {module.name}
                  </div>
                  <div style={{ fontSize: 11, color: "#71717a" }}>
                    {module.detail}
                  </div>
                </div>
                <div className="mod-icon">
                  <Icon size={18} />
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <div className="praxis-label">Progresso</div>
                <div style={{ fontSize: 11, color: "#71717a" }}>
                  {module.total > 0
                    ? `${module.completed}/${module.total}`
                    : "—"}
                </div>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${module.progress}%` }}
                />
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#71717a",
                  marginTop: 12,
                }}
              >
                {module.summary}
              </div>
            </Link>
          );
        })}
        {topModules.length === 0 ? (
          <div
            className="praxis-label"
            style={{
              gridColumn: "1 / -1",
              padding: 24,
              textAlign: "center",
            }}
          >
            Nenhum módulo ativo
          </div>
        ) : null}
      </div>
    </div>
  );

  const agendaPanel = (
    <div className="glass">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 16,
        }}
      >
        <div>
          <div
            className="praxis-label"
            style={{ color: "var(--accent)", marginBottom: 8 }}
          >
            Próximos blocos
          </div>
          <h2 className="praxis-title" style={{ fontSize: 24 }}>
            Linha do tempo · próximas 8h
          </h2>
        </div>
        <Link
          href="/agenda"
          className="praxis-label"
          style={{ color: "var(--accent)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Calendar className="h-3.5 w-3.5" /> Ver semana →
        </Link>
      </div>
      {nextFocusItems.length === 0 ? (
        <div
          className="praxis-label"
          style={{ padding: 24, textAlign: "center" }}
        >
          Agenda livre
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {nextFocusItems.map((item) => {
            const tone =
              item.kind === "meal"
                ? "ok"
                : item.kind === "workout"
                  ? "accent"
                  : "default";
            // moduleBadgeClass dropped — badges removed from this card.
            return (
              <Link
                key={item.id}
                href={item.route}
                className={
                  tone === "accent" ? "timeline-item accent-card" : "timeline-item"
                }
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="timeline-time">{item.time ?? "—"}</div>
                <div className="timeline-body">
                  {/* Dropped the [Módulo + sourceLabel] badge row and the
                      timeline-sub description line — both just restated
                      info already in title + time + module color stripe. */}
                  <div className="timeline-title">{item.title}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );

  const telemetryPanel = (
    <div className="glass">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 16,
        }}
      >
        <div>
          <div
            className="praxis-label"
            style={{ color: "var(--accent)", marginBottom: 8 }}
          >
            Ritmo
          </div>
          <h2 className="praxis-title" style={{ fontSize: 24 }}>
            Consistência na semana
          </h2>
        </div>
        <span className="badge badge-accent">
          {disciplinePct}% disciplina
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 10,
        }}
      >
        {currentWeek.map((day) => {
          const isToday =
            day.date.toDateString() === today.toDateString();
          return (
            <div
              key={day.dateKey}
              style={{
                border: isToday
                  ? "1px solid rgba(74,222,128,.4)"
                  : "1px solid rgba(39,39,42,.8)",
                background: isToday
                  ? "rgba(74,222,128,.08)"
                  : undefined,
                borderRadius: 20,
                padding: "14px 8px",
                textAlign: "center",
              }}
            >
              <div
                className="praxis-label"
                style={{
                  marginBottom: 8,
                  color: isToday ? "var(--ok)" : undefined,
                }}
              >
                {day.shortLabel.slice(0, 3)}
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: "#f4f4f5",
                  fontFamily: "var(--font-space-grotesk), sans-serif",
                  letterSpacing: "-0.02em",
                }}
              >
                {day.percent}%
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#71717a",
                  marginTop: 8,
                }}
              >
                {day.completedCount}/{day.totalCount}
              </div>
              <div className="progress-track progress-thin" style={{ marginTop: 8 }}>
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.max(day.percent, day.totalCount > 0 ? 6 : 0)}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const rankingPanel = (
    <div className="glass">
      {/* Bloco enxuto: só o rank do usuário (◆ E Rank · #1) grande
          no topo. Lista global de personagens removida a pedido do
          usuário — era seed fake (Zenkichi, Kurama, Levi etc.) que
          não trazia sinal. Sem denominador enquanto não existe
          camada social real. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 6,
        }}
      >
        <div
          className="praxis-label"
          style={{ color: "var(--accent)" }}
        >
          Sua posição
        </div>
        <Medal className="h-4 w-4" style={{ color: "var(--accent)" }} />
      </div>
      <div
        className="praxis-title"
        style={{
          fontSize: 38,
          color: "var(--accent)",
          lineHeight: 1.05,
          letterSpacing: "-0.01em",
        }}
      >
        ◆ {user.rankTier} {user.rankLabel} · #{rankingPosition}
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 13,
          color: "#71717a",
        }}
      >
        {formatPoints(user.totalXp)} XP acumulados
      </div>
    </div>
  );

  const skillsPanel = (
    <div className="glass">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 16,
        }}
      >
        <div>
          <div
            className="praxis-label"
            style={{ color: "var(--accent)", marginBottom: 8 }}
          >
            Perfil
          </div>
          <h2 className="praxis-title" style={{ fontSize: 24 }}>
            Status do operador
          </h2>
        </div>
        <Shield className="h-4 w-4" style={{ color: "var(--accent)" }} />
      </div>
      <div className="item-card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="avatar-v2 avatar-lg">
            {squareInitials(user.name)}
          </div>
          <div>
            <div
              style={{ fontWeight: 600, fontSize: 16, color: "#f4f4f5" }}
            >
              {user.username}
            </div>
            <div
              style={{ fontSize: 11, color: "#71717a", marginTop: 4 }}
            >
              @{user.username}
            </div>
            <div className="rank-tag" style={{ marginTop: 8 }}>
              ◆ {user.rankTier} {user.rankLabel} · Nível {user.level}
            </div>
          </div>
        </div>
      </div>
      <div>
        {[
          { label: "Energia", value: user.skillScores.energy },
          { label: "Foco", value: user.skillScores.focus },
          { label: "Disciplina", value: user.skillScores.discipline },
          { label: "Produção", value: user.skillScores.production },
          { label: "Motivação", value: user.skillScores.motivation },
        ].map((item) => {
          const pct = (item.value / 5) * 100;
          return (
            <div key={item.label} className="skill-row">
              <div className="skill-name">{item.label}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <div className="skill-val">{item.value.toFixed(1)}/5</div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const sectionCards: Record<DashboardSectionId, React.ReactNode> = {
    "quick-actions": heroHud,
    timeline: agendaPanel,
    telemetry: telemetryPanel,
    modules: modulesPanel,
    ranking: rankingPanel,
    skills: skillsPanel,
  };

  // Pair ranking + skills into a 2-up grid when both visible (matches design)
  const renderSection = (sectionId: DashboardSectionId) => sectionCards[sectionId];

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div className="page-eyebrow">Hoje · {formatHeaderDate(today)}</div>
        <h1 className="page-title-v2">Painel do operador</h1>
        <p className="page-description-v2">
          Score, próximos blocos, módulos ativos e ações rápidas no mesmo
          lugar.
        </p>
      </div>

      {/* Action row */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <button
          type="button"
          onClick={() => setIsLayoutEditing((current) => !current)}
          className={isLayoutEditing ? "v2-btn v2-btn-primary" : "v2-btn"}
        >
          {isLayoutEditing ? "Fechar layout" : "Editar layout"}
        </button>
        <Link
          href="/tasks"
          className="v2-btn v2-btn-primary"
          style={{ textDecoration: "none" }}
        >
          <Plus className="h-3.5 w-3.5" /> Missão
        </Link>
      </div>

      {isLayoutEditing ? (
        <div className="glass" style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 16,
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                className="praxis-label"
                style={{ color: "var(--accent)", marginBottom: 8 }}
              >
                Layout · personalização
              </div>
              <h2 className="praxis-title" style={{ fontSize: 24 }}>
                Reordene o painel
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "#71717a",
                  marginTop: 6,
                  maxWidth: 560,
                }}
              >
                Reordene ou oculte blocos do painel. Essa ordem fica presa à
                conta.
              </p>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {sectionOrder.map((sectionId, index) => {
              const hidden = hiddenSections.has(sectionId);
              return (
                <div key={sectionId} className="item-card">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 10,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#f4f4f5",
                        }}
                      >
                        {dashboardSectionLabels[sectionId]}
                      </div>
                      <div
                        className="praxis-label"
                        style={{ marginTop: 6 }}
                      >
                        {hidden ? "Oculto" : "Visível"}
                      </div>
                    </div>
                    <span
                      className="praxis-label"
                      style={{ color: "#71717a" }}
                    >
                      #{index + 1}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      className={
                        hidden ? "v2-btn v2-btn-xs" : "v2-btn v2-btn-primary v2-btn-xs"
                      }
                      onClick={() =>
                        actions.toggleDashboardSectionVisibility(sectionId)
                      }
                    >
                      {hidden ? "Mostrar" : "Ocultar"}
                    </button>
                    <button
                      type="button"
                      className="v2-btn v2-btn-ghost v2-btn-xs"
                      disabled={index === 0}
                      onClick={() =>
                        actions.reorderDashboardSection({
                          sectionId,
                          direction: "up",
                        })
                      }
                    >
                      <ArrowUp className="h-3 w-3" /> Subir
                    </button>
                    <button
                      type="button"
                      className="v2-btn v2-btn-ghost v2-btn-xs"
                      disabled={index === sectionOrder.length - 1}
                      onClick={() =>
                        actions.reorderDashboardSection({
                          sectionId,
                          direction: "down",
                        })
                      }
                    >
                      <ArrowDown className="h-3 w-3" /> Descer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {visibleSectionOrder.map((sectionId) => (
          <div key={sectionId}>{renderSection(sectionId)}</div>
        ))}
      </div>
    </div>
  );
}
