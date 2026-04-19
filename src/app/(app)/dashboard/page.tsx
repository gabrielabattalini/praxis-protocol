"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Bell,
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
  Search,
  Shield,
  ShoppingBasket,
  Sparkles,
  Stethoscope,
  Target,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
  Zap,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import {
  Avatar,
  MiniStat,
  MissionCard,
  ModuleTile,
  RankChip,
  RxChip,
  RxLabel,
  RxPBar,
  RxPanel,
  Streak,
  XPBar,
} from "@/components/redesign/primitives";
import { buildAgendaEvents, buildWeekAgenda } from "@/lib/agenda";
import { moduleCatalog, rankingSeed } from "@/lib/mock-data";
import type { AgendaEvent } from "@/lib/agenda";
import type { DashboardSectionId, ModuleId } from "@/lib/types";
import { cn, formatPoints } from "@/lib/utils";

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
  score: "Operações hoje",
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

function weekdayFull(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(date);
}

function dayShort(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
  })
    .format(date)
    .replace(".", "");
}

function hourTag(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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

  const openXp = pendingItems.reduce((sum, item) => sum + (item.xp ?? 0), 0);
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

  const leaderboard = useMemo(() => {
    const selfEntry = {
      id: "praxis-user",
      name: user.name,
      username: user.username,
      totalXp: user.totalXp,
      level: user.level,
      rankTier: user.rankTier,
      rankLabel: user.rankLabel,
    };
    return [...rankingSeed, selfEntry].sort(
      (left, right) => right.totalXp - left.totalXp,
    );
  }, [
    user.level,
    user.name,
    user.rankLabel,
    user.rankTier,
    user.totalXp,
    user.username,
  ]);

  const rankingPosition = Math.max(
    1,
    leaderboard.findIndex((entry) => entry.id === "praxis-user") + 1,
  );

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

  // 24h XP histogram bars — computed from completedItems where time exists
  const histogramBars = useMemo(() => {
    const buckets = Array.from({ length: 24 }, () => ({
      done: 0,
      pending: 0,
    }));
    for (const item of todayAgenda) {
      if (!item.time) continue;
      const [hh] = item.time.split(":").map(Number);
      if (hh === undefined || Number.isNaN(hh)) continue;
      const idx = Math.max(0, Math.min(23, hh));
      if (item.completed) buckets[idx].done += (item.xp ?? 40) / 40;
      else buckets[idx].pending += (item.xp ?? 40) / 40;
    }
    return buckets;
  }, [todayAgenda]);

  const heroHud = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)",
        gap: 20,
      }}
    >
      <RxPanel
        style={{ padding: 24, position: "relative", overflow: "hidden" }}
      >
        <div
          className="rx-grid-bg"
          style={{ position: "absolute", inset: 0, opacity: 0.3 }}
          aria-hidden
        />
        <div style={{ position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 20,
            }}
          >
            <Avatar
              initials={squareInitials(user.name)}
              size={64}
              tier={user.rankTier}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="rx-mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  color: "var(--fg-3)",
                  marginBottom: 4,
                  textTransform: "uppercase",
                }}
              >
                OPERADOR · ATIVO
              </div>
              <div
                className="rx-display"
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: "var(--fg)",
                }}
              >
                {user.username}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  marginTop: 6,
                  flexWrap: "wrap",
                }}
              >
                <RankChip tier={`${user.rankTier} ${user.rankLabel}`} />
                <span
                  className="rx-mono"
                  style={{
                    fontSize: 10,
                    color: "var(--fg-3)",
                    letterSpacing: "0.18em",
                  }}
                >
                  RANK GLOBAL · #{rankingPosition} / {leaderboard.length}
                </span>
              </div>
            </div>
            <Streak days={user.streak} />
          </div>

          <XPBar value={xpProgress} level={user.level} />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 10,
              marginTop: 20,
            }}
          >
            <MiniStat
              label="XP HOJE"
              value={`+${formatPoints(earnedXpToday)}`}
              Icon={Zap}
            />
            <MiniStat
              label="MISSÕES"
              value={`${completedItems.length}/${todayAgenda.length}`}
              Icon={Target}
            />
            <MiniStat
              label="XP 7D"
              value={`+${formatPoints(weekXp)}`}
              Icon={TrendingUp}
            />
            <MiniStat
              label="DISCIP."
              value={`${disciplinePct}%`}
              Icon={Shield}
            />
          </div>
        </div>
      </RxPanel>

      <RxPanel style={{ padding: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <RxLabel>OPERAÇÕES · HOJE</RxLabel>
          <div
            className="rx-mono"
            style={{
              fontSize: 10,
              color: "var(--accent)",
              letterSpacing: "0.18em",
            }}
          >
            {completedItems.length}/{todayAgenda.length} ·{" "}
            {todayAgenda.length
              ? Math.round((completedItems.length / todayAgenda.length) * 100)
              : 0}
            %
          </div>
        </div>

        <svg
          width="100%"
          height="60"
          viewBox="0 0 288 60"
          style={{ marginBottom: 14 }}
          aria-hidden
        >
          {histogramBars.map((bucket, i) => {
            const total = bucket.done + bucket.pending;
            const synthetic =
              total > 0
                ? Math.min(50, 8 + total * 10)
                : 4 + Math.max(0, Math.sin(i * 0.7) * 4 + 3);
            const h = synthetic;
            const fill =
              bucket.done > 0
                ? "var(--accent)"
                : bucket.pending > 0
                  ? "var(--warn)"
                  : "var(--line-bright)";
            const opacity = bucket.done > 0 ? 0.9 : bucket.pending > 0 ? 0.7 : 0.35;
            return (
              <rect
                key={i}
                x={i * 12}
                y={60 - h}
                width={8}
                height={h}
                fill={fill}
                opacity={opacity}
              />
            );
          })}
        </svg>

        <div
          className="rx-mono"
          style={{
            fontSize: 10,
            color: "var(--fg-4)",
            letterSpacing: "0.14em",
            marginBottom: 10,
            textTransform: "uppercase",
          }}
        >
          XP POR HORA · 24H
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          <div
            style={{
              padding: 10,
              border: "1px solid var(--line)",
              background: "rgba(0,0,0,0.3)",
              borderRadius: 2,
            }}
          >
            <div
              className="rx-mono"
              style={{
                fontSize: 9,
                color: "var(--ok)",
                letterSpacing: "0.14em",
              }}
            >
              ● EM DIA
            </div>
            <div
              style={{
                color: "var(--fg-2)",
                fontSize: 11,
                marginTop: 2,
              }}
            >
              {completedItems.length > 0
                ? `${completedItems.length} ${
                    completedItems.length === 1
                      ? "missão fechada"
                      : "missões fechadas"
                  }`
                : "Inicie a primeira ação"}
            </div>
          </div>
          <div
            style={{
              padding: 10,
              border: "1px solid var(--line)",
              background: "rgba(0,0,0,0.3)",
              borderRadius: 2,
            }}
          >
            <div
              className="rx-mono"
              style={{
                fontSize: 9,
                color: pendingItems.length > 0 ? "var(--warn)" : "var(--fg-3)",
                letterSpacing: "0.14em",
              }}
            >
              ◆ PENDENTES
            </div>
            <div
              style={{
                color: "var(--fg-2)",
                fontSize: 11,
                marginTop: 2,
              }}
            >
              {pendingItems.length > 0
                ? `${pendingItems.length} · +${formatPoints(openXp)} XP`
                : "Nada restante"}
            </div>
          </div>
        </div>
      </RxPanel>
    </div>
  );

  const missionsSection = (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 14,
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            className="rx-display"
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "var(--fg)",
              letterSpacing: "-0.01em",
            }}
          >
            Missões do dia
          </div>
          <div
            className="rx-mono"
            style={{
              fontSize: 10,
              color: "var(--fg-4)",
              letterSpacing: "0.18em",
              marginTop: 4,
              textTransform: "uppercase",
            }}
          >
            {pendingItems.length} PENDENTES · {completedItems.length} CONCLUÍDAS · +
            {formatPoints(openXp)} XP DISPONÍVEIS
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
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
        <RxPanel
          style={{
            padding: 32,
            textAlign: "center",
          }}
        >
          <CheckCircle2
            className="mx-auto h-6 w-6"
            style={{ color: "var(--ok)" }}
          />
          <div
            className="rx-display"
            style={{
              marginTop: 12,
              fontSize: 18,
              fontWeight: 600,
              color: "var(--fg)",
            }}
          >
            Tudo limpo por aqui
          </div>
          <div
            className="rx-mono"
            style={{
              marginTop: 6,
              fontSize: 10,
              letterSpacing: "0.16em",
              color: "var(--fg-3)",
              textTransform: "uppercase",
            }}
          >
            Nenhuma missão nesse filtro
          </div>
        </RxPanel>
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
              meta={[item.time ?? "Sem horário", item.description]
                .filter(Boolean)
                .join(" · ")}
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
    <RxPanel style={{ padding: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <RxLabel>MÓDULOS ATIVOS · {activeModuleCount}</RxLabel>
        <Link
          href="/profile"
          className="rx-mono"
          style={{
            fontSize: 10,
            color: "var(--accent)",
            letterSpacing: "0.14em",
          }}
        >
          VER TODOS ▸
        </Link>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
        }}
      >
        {topModules.map((module, idx) => (
          <ModuleTile
            key={module.id}
            name={module.name}
            stat={module.summary}
            Icon={module.icon}
            hot={idx === 0}
            href={module.route}
          />
        ))}
        {topModules.length === 0 ? (
          <div
            className="rx-mono"
            style={{
              gridColumn: "1 / -1",
              padding: 24,
              textAlign: "center",
              fontSize: 10,
              letterSpacing: "0.18em",
              color: "var(--fg-4)",
              textTransform: "uppercase",
            }}
          >
            NENHUM MÓDULO ATIVO
          </div>
        ) : null}
      </div>
    </RxPanel>
  );

  const agendaPanel = (
    <RxPanel style={{ padding: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <RxLabel>AGENDA · PRÓXIMAS 8H</RxLabel>
        <Link href="/agenda" style={{ color: "var(--fg-3)" }}>
          <Calendar className="h-3.5 w-3.5" />
        </Link>
      </div>
      {nextFocusItems.length === 0 ? (
        <div
          className="rx-mono"
          style={{
            padding: 24,
            textAlign: "center",
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "var(--fg-4)",
            textTransform: "uppercase",
          }}
        >
          AGENDA LIVRE
        </div>
      ) : (
        <div>
          {nextFocusItems.map((item, i) => {
            const color =
              item.kind === "meal"
                ? "var(--ok)"
                : item.kind === "workout"
                  ? "var(--accent)"
                  : "var(--fg-3)";
            return (
              <Link
                key={item.id}
                href={item.route}
                style={{
                  display: "flex",
                  gap: 14,
                  padding: "10px 0",
                  borderTop: i === 0 ? "none" : "1px solid var(--line-soft)",
                  alignItems: "center",
                }}
              >
                <div
                  className="rx-mono"
                  style={{
                    fontSize: 11,
                    color: "var(--fg-3)",
                    minWidth: 44,
                    letterSpacing: "0.06em",
                  }}
                >
                  {item.time ?? "—"}
                </div>
                <div
                  style={{
                    width: 2,
                    height: 18,
                    background: color,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--fg)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.title}
                  </div>
                  <div
                    className="rx-mono"
                    style={{
                      fontSize: 9,
                      color: "var(--fg-4)",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                    }}
                  >
                    {item.sourceLabel}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </RxPanel>
  );

  const telemetryPanel = (
    <RxPanel style={{ padding: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <RxLabel>RITMO · 7 DIAS</RxLabel>
        <span
          className="rx-mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "var(--accent)",
          }}
        >
          {disciplinePct}% DISCIP.
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 6,
        }}
      >
        {currentWeek.map((day) => (
          <div
            key={day.dateKey}
            style={{
              padding: 10,
              border: "1px solid var(--line)",
              background: "rgba(0,0,0,0.3)",
              borderRadius: 2,
            }}
          >
            <div
              className="rx-mono"
              style={{
                fontSize: 9,
                letterSpacing: "0.18em",
                color: "var(--fg-3)",
                textTransform: "uppercase",
              }}
            >
              {day.shortLabel.slice(0, 3)}
            </div>
            <div
              className="rx-display"
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--fg)",
                marginTop: 4,
                letterSpacing: "-0.02em",
              }}
            >
              {day.percent}%
            </div>
            <div
              className="rx-mono"
              style={{
                fontSize: 9,
                color: "var(--fg-4)",
                letterSpacing: "0.12em",
                marginTop: 3,
              }}
            >
              {day.completedCount}/{day.totalCount}
            </div>
            <div style={{ marginTop: 6 }}>
              <RxPBar value={Math.max(day.percent, day.totalCount > 0 ? 6 : 0)} />
            </div>
          </div>
        ))}
      </div>
    </RxPanel>
  );

  const rankingPanel = (
    <RxPanel style={{ padding: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <RxLabel>RANKING · GLOBAL</RxLabel>
        <Medal className="h-4 w-4" style={{ color: "var(--accent)" }} />
      </div>
      <div
        style={{
          padding: 12,
          border: "1px solid var(--line)",
          background: "rgba(0,0,0,0.3)",
          marginBottom: 12,
          borderRadius: 2,
        }}
      >
        <div
          className="rx-mono"
          style={{
            fontSize: 10,
            color: "var(--fg-3)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          VOCÊ ESTÁ EM
        </div>
        <div
          className="rx-display"
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: "var(--fg)",
            marginTop: 4,
            letterSpacing: "-0.03em",
          }}
        >
          #{rankingPosition}
        </div>
        <div
          style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 4 }}
        >
          {formatPoints(user.totalXp)} XP · {user.rankTier} {user.rankLabel}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {leaderboard.slice(0, 5).map((entry, index) => {
          const isSelf = entry.id === "praxis-user";
          return (
            <div
              key={entry.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 10px",
                border: isSelf
                  ? "1px solid rgba(251,146,60,0.4)"
                  : "1px solid var(--line)",
                background: isSelf
                  ? "rgba(251,146,60,0.08)"
                  : "rgba(0,0,0,0.3)",
                borderRadius: 2,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 0,
                }}
              >
                <span
                  className="rx-mono"
                  style={{
                    fontSize: 10,
                    color: isSelf ? "var(--accent)" : "var(--fg-4)",
                    letterSpacing: "0.12em",
                    width: 24,
                  }}
                >
                  #{index + 1}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: isSelf ? 600 : 500,
                    color: isSelf ? "var(--accent)" : "var(--fg-2)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {entry.name}
                </span>
              </div>
              <span
                className="rx-mono"
                style={{
                  fontSize: 10,
                  color: isSelf ? "var(--accent)" : "var(--fg-3)",
                  letterSpacing: "0.12em",
                  flexShrink: 0,
                }}
              >
                {formatPoints(entry.totalXp)} XP
              </span>
            </div>
          );
        })}
      </div>
    </RxPanel>
  );

  const skillsPanel = (
    <RxPanel style={{ padding: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <RxLabel>STATUS · OPERADOR</RxLabel>
        <Shield className="h-4 w-4" style={{ color: "var(--accent)" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { label: "ENERGIA", value: user.skillScores.energy },
          { label: "FOCO", value: user.skillScores.focus },
          { label: "DISCIPL.", value: user.skillScores.discipline },
          { label: "PRODUÇÃO", value: user.skillScores.production },
          { label: "MOTIVAÇÃO", value: user.skillScores.motivation },
        ].map((item) => (
          <div key={item.label}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span
                className="rx-mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  color: "var(--fg-3)",
                }}
              >
                {item.label}
              </span>
              <span
                className="rx-mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  color: "var(--accent)",
                }}
              >
                {item.value.toFixed(1)}/5
              </span>
            </div>
            <RxPBar value={(item.value / 5) * 100} />
          </div>
        ))}
      </div>
    </RxPanel>
  );

  const sectionCards: Record<DashboardSectionId, React.ReactNode> = {
    "quick-actions": heroHud,
    score: missionsSection,
    timeline: agendaPanel,
    telemetry: telemetryPanel,
    modules: modulesPanel,
    ranking: rankingPanel,
    skills: skillsPanel,
  };

  return (
    <div
      className="rx-pa"
      style={{
        margin: "-24px -24px -32px",
        padding: "0 24px 32px",
        minHeight: "calc(100vh - 120px)",
      }}
    >
      {/* Command header */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "18px 0",
          borderBottom: "1px solid var(--line-soft)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <div>
          <RxLabel>COMANDO</RxLabel>
          <div
            style={{
              fontSize: 13,
              color: "var(--fg-3)",
              marginTop: 4,
              textTransform: "capitalize",
            }}
          >
            {weekdayFull(today)} · {dayShort(today)} · {hourTag(today)} ·{" "}
            <span style={{ color: "var(--accent)" }}>
              {user.streak}º dia no protocolo
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ position: "relative", width: 240 }}>
            <input
              className="rx-input"
              placeholder="Buscar missão, módulo, registro"
              style={{ paddingLeft: 32, fontSize: 12 }}
            />
            <Search
              className="h-3 w-3"
              style={{
                position: "absolute",
                left: 10,
                top: 12,
                color: "var(--fg-4)",
              }}
            />
          </div>
          <button
            type="button"
            className="rx-btn-ghost"
            style={{ padding: "9px 10px" }}
            aria-label="Notificações"
          >
            <Bell className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsLayoutEditing((current) => !current)}
            className={cn(
              isLayoutEditing ? "rx-chip-accent" : "rx-btn-ghost",
            )}
            style={{ padding: "9px 14px" }}
          >
            {isLayoutEditing ? "FECHAR" : "LAYOUT"}
          </button>
          <Link href="/tasks" className="rx-btn-primary">
            <Plus className="h-3 w-3" /> Missão
          </Link>
        </div>
      </div>

      {isLayoutEditing ? (
        <RxPanel style={{ padding: 20, marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 14,
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <div>
              <RxLabel>LAYOUT · PERSONALIZAÇÃO</RxLabel>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--fg-3)",
                  marginTop: 4,
                  maxWidth: 560,
                }}
              >
                Reordene ou oculte blocos do painel. Essa ordem fica presa à conta.
              </div>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 10,
            }}
          >
            {sectionOrder.map((sectionId, index) => {
              const hidden = hiddenSections.has(sectionId);
              return (
                <div
                  key={sectionId}
                  style={{
                    padding: 12,
                    border: "1px solid var(--line)",
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: 2,
                  }}
                >
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
                          color: "var(--fg)",
                        }}
                      >
                        {dashboardSectionLabels[sectionId]}
                      </div>
                      <div
                        className="rx-mono"
                        style={{
                          fontSize: 9,
                          letterSpacing: "0.16em",
                          color: "var(--fg-4)",
                          marginTop: 4,
                          textTransform: "uppercase",
                        }}
                      >
                        {hidden ? "OCULTO" : "VISÍVEL"}
                      </div>
                    </div>
                    <span
                      className="rx-mono"
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.12em",
                        color: "var(--fg-4)",
                      }}
                    >
                      #{index + 1}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      marginTop: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      className={hidden ? "rx-btn-ghost" : "rx-chip-accent"}
                      style={{ padding: "6px 10px" }}
                      onClick={() =>
                        actions.toggleDashboardSectionVisibility(sectionId)
                      }
                    >
                      {hidden ? "MOSTRAR" : "OCULTAR"}
                    </button>
                    <button
                      type="button"
                      className="rx-btn-ghost"
                      style={{ padding: "6px 10px" }}
                      disabled={index === 0}
                      onClick={() =>
                        actions.reorderDashboardSection({
                          sectionId,
                          direction: "up",
                        })
                      }
                    >
                      <ArrowUp className="h-3 w-3" /> SUBIR
                    </button>
                    <button
                      type="button"
                      className="rx-btn-ghost"
                      style={{ padding: "6px 10px" }}
                      disabled={index === sectionOrder.length - 1}
                      onClick={() =>
                        actions.reorderDashboardSection({
                          sectionId,
                          direction: "down",
                        })
                      }
                    >
                      <ArrowDown className="h-3 w-3" /> DESCER
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </RxPanel>
      ) : null}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 24,
          position: "relative",
          zIndex: 2,
        }}
      >
        {visibleSectionOrder.map((sectionId) => (
          <div key={sectionId}>{sectionCards[sectionId]}</div>
        ))}
      </div>
    </div>
  );
}
