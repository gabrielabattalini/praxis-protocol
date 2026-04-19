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
  CheckCircle2,
  Dumbbell,
  HeartPulse,
  House,
  Medal,
  MoonStar,
  Pill,
  Shield,
  ShoppingBasket,
  Sparkles,
  Stethoscope,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { GlassPanel } from "@/components/ui/glass-panel";
import { PageIntro } from "@/components/ui/page-intro";
import { buildAgendaEvents, buildWeekAgenda } from "@/lib/agenda";
import { moduleCatalog, rankingSeed } from "@/lib/mock-data";
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
  "quick-actions": "Ações rápidas",
  score: "Score do dia",
  timeline: "Linha do tempo",
  telemetry: "Ritmo semanal",
  modules: "Módulos",
  ranking: "Ranking",
  skills: "Habilidades",
};

function barWidth(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

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

function formatHourLabel(value?: string) {
  return value || "Sem horário";
}

export default function DashboardPage() {
  const { state, user, actions } = useAppStore();
  const [isLayoutEditing, setIsLayoutEditing] = useState(false);
  const today = useMemo(() => new Date(), []);
  const todayAgenda = useMemo(() => buildAgendaEvents(state, today), [state, today]);
  const weekAgenda = useMemo(() => buildWeekAgenda(state, today), [state, today]);

  const pendingItems = todayAgenda.filter((item) => !item.completed);
  const completedItems = todayAgenda.filter((item) => item.completed);
  const waterConsumedToday =
    state.waterEntries.find((entry) => entry.date === today.toISOString().slice(0, 10))
      ?.consumedMl ?? 0;
  const waterTarget = state.dailyNutritionTargets.waterMl;
  const waterPercent = waterTarget > 0 ? Math.min(100, Math.round((waterConsumedToday / waterTarget) * 100)) : 0;
  const scorePercent =
    todayAgenda.length > 0 ? Math.round((completedItems.length / todayAgenda.length) * 100) : 0;
  const openXp = pendingItems.reduce((sum, item) => sum + (item.xp ?? 0), 0);
  const currentWeek = weekAgenda.map((day) => ({
    ...day,
    percent: day.totalCount > 0 ? Math.round((day.completedCount / day.totalCount) * 100) : 0,
  }));

  const nextFocusItems = pendingItems.slice(0, 5);
  const nextWorkout = pendingItems.find((item) => item.kind === "workout");
  const nextMeal = pendingItems.find((item) => item.kind === "meal");
  const nextManual = pendingItems.find((item) => item.kind === "manual");

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

    return [...rankingSeed, selfEntry].sort((left, right) => right.totalXp - left.totalXp);
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
  const rivalAhead = rankingPosition > 1 ? leaderboard[rankingPosition - 2] : null;

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
                ? `${completed} de ${total} blocos fechados hoje`
                : "Monte a primeira estrutura da dieta",
            icon: moduleIcons[module.id],
          };
        }

        if (module.id === "finance") {
          const total = state.financeLessons.length;
          const completed = state.financeLessons.filter((lesson) => lesson.completed).length;

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
                ? `${completed} de ${total} lições concluídas`
                : "Ative a educação financeira do módulo",
            icon: moduleIcons[module.id],
          };
        }

        if (module.id === "workout") {
          const total = state.workoutPlan.filter((day) => !day.isRestDay).length;
          const completed = new Set(
            state.workoutDayCompletions.map((item) => `${item.dayId}:${item.dateKey}`),
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
                ? `${completed} sessões já marcadas no histórico`
                : "Abra o treino e registre a primeira sessão",
            icon: moduleIcons[module.id],
          };
        }

        const tasks = state.tasks.filter((task) => task.moduleId === module.id);
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
              ? `${completed} de ${total} tarefas concluídas`
              : "Sem rotina cadastrada ainda",
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
  ]);

  const sectionOrder = state.settings.dashboardSectionOrder;
  const hiddenSections = new Set(state.settings.hiddenDashboardSections);
  const visibleSectionOrder = sectionOrder.filter((sectionId) => !hiddenSections.has(sectionId));

  const sectionCards: Record<DashboardSectionId, React.ReactNode> = {
    "quick-actions": (
      <GlassPanel className="space-y-4 p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="editorial-kicker text-[#c65622]">Abertura do dia</p>
            <h2 className="editorial-title mt-2 text-3xl text-zinc-100 md:text-4xl">
              O que fazer agora
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
              Um painel menos teatral e mais útil: o próximo passo já aparece com
              contexto, prioridade e caminho de execução.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsLayoutEditing((current) => !current)}
            className={cn(
              "rounded-sm border px-3 py-2 text-[11px] uppercase tracking-[0.18em] transition",
              isLayoutEditing
                ? "border-[rgba(251,146,60,0.28)] bg-[rgba(251,146,60,0.12)] text-[var(--accent)]"
                : "border-zinc-800 bg-[rgba(14,14,17,0.96)] text-zinc-400 hover:border-zinc-700 hover:text-zinc-100",
            )}
          >
            {isLayoutEditing ? "Fechar edição" : "Editar layout"}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/tasks"
            className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] p-4 transition hover:border-[rgba(251,146,60,0.24)]"
          >
            <p className="text-sm font-semibold text-zinc-100">Abrir fila diária</p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              {pendingItems.length > 0
                ? `${pendingItems.length} itens em aberto agora`
                : "Nenhum item pendente no momento"}
            </p>
          </Link>

          <Link
            href={nextWorkout?.route ?? "/modules/workout"}
            className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] p-4 transition hover:border-[rgba(251,146,60,0.24)]"
          >
            <p className="text-sm font-semibold text-zinc-100">Treino</p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              {nextWorkout
                ? `${formatHourLabel(nextWorkout.time)} • ${nextWorkout.title}`
                : "Nenhum treino pendente hoje"}
            </p>
          </Link>

          <Link
            href={nextMeal?.route ?? "/modules/nutrition"}
            className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] p-4 transition hover:border-[rgba(251,146,60,0.24)]"
          >
            <p className="text-sm font-semibold text-zinc-100">Nutrição</p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              {nextMeal
                ? `${formatHourLabel(nextMeal.time)} • ${nextMeal.title}`
                : "Sem refeição pendente agora"}
            </p>
          </Link>

          <Link
            href="/agenda"
            className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] p-4 transition hover:border-[rgba(251,146,60,0.24)]"
          >
            <p className="text-sm font-semibold text-zinc-100">Agenda</p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Semana inteira em uma leitura operacional.
            </p>
          </Link>
        </div>

        <div className="rounded-[1.25rem] border border-zinc-800 bg-[rgba(10,10,12,0.82)] p-4">
          <p className="editorial-kicker">Pressão do ciclo</p>
          <p className="mt-2 text-sm leading-7 text-zinc-500">
            {nextManual
              ? `A próxima meta manual é ${nextManual.title.toLowerCase()}.`
              : "O ciclo atual está dominado pelas rotinas sincronizadas dos módulos."}
          </p>
        </div>
      </GlassPanel>
    ),
    score: (
      <GlassPanel className="space-y-5 p-6 md:p-8">
        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <div>
            <p className="editorial-kicker text-[#c65622]">Score do dia</p>
            <h2 className="editorial-title mt-2 text-3xl text-zinc-100 md:text-4xl">
              Leitura de execução
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
              O painel abre mostrando o estado real do dia, não só o que foi planejado.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="praxis-kpi p-4">
                <p className="praxis-label">Pendentes</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">
                  {pendingItems.length}
                </p>
              </div>
              <div className="praxis-kpi p-4">
                <p className="praxis-label">Concluídas</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">
                  {completedItems.length}
                </p>
              </div>
              <div className="praxis-kpi p-4">
                <p className="praxis-label">XP em aberto</p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">
                  {formatPoints(openXp)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-sm border border-zinc-800 bg-[rgba(10,10,12,0.78)] p-5">
            <div className="relative mx-auto h-52 w-52">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle
                  cx="60"
                  cy="60"
                  r="46"
                  fill="none"
                  stroke="rgba(39,39,42,0.9)"
                  strokeWidth="10"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="46"
                  fill="none"
                  stroke="url(#dashboardScore)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={289}
                  strokeDashoffset={289 - (289 * scorePercent) / 100}
                />
                <defs>
                  <linearGradient id="dashboardScore" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#fb923c" />
                    <stop offset="100%" stopColor="#f97316" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 grid place-items-center text-center">
                <div>
                  <p className="editorial-kicker">Execução</p>
                  <p className="mt-2 font-title text-5xl font-bold text-zinc-100">
                    {scorePercent}%
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
                    ciclo diário
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-sm border border-zinc-800 bg-black/30 p-4">
                <p className="editorial-kicker">Hidratação</p>
                <p className="mt-2 text-xl font-semibold text-zinc-100">
                  {waterPercent}%
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  {Math.round(waterConsumedToday / 100) / 10} L de{" "}
                  {Math.round(waterTarget / 100) / 10} L
                </p>
              </div>
              <div className="rounded-sm border border-zinc-800 bg-black/30 p-4">
                <p className="editorial-kicker">Sequência</p>
                <p className="mt-2 text-xl font-semibold text-zinc-100">
                  {user.streak} dias
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  Consistência puxando o protocolo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </GlassPanel>
    ),
    timeline: (
      <GlassPanel className="space-y-4 p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="editorial-kicker text-[#c65622]">Próximos passos</p>
            <h2 className="editorial-title mt-2 text-3xl text-zinc-100 md:text-4xl">
              Linha do tempo de hoje
            </h2>
          </div>
          <Link
            href="/agenda"
            className="text-xs uppercase tracking-[0.18em] text-zinc-500 transition hover:text-zinc-200"
          >
            Ver semana inteira
          </Link>
        </div>

        {nextFocusItems.length ? (
          <div className="space-y-3">
            {nextFocusItems.map((item) => (
              <Link
                key={item.id}
                href={item.route}
                className="flex items-center justify-between gap-4 rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] px-4 py-4 transition hover:border-[rgba(251,146,60,0.24)]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-zinc-100">{item.title}</p>
                    <span className="rounded-sm border border-zinc-800 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                      {item.badgeLabel}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    {item.description}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-zinc-100">
                    {formatHourLabel(item.time)}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                    {item.sourceLabel}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-sm border border-dashed border-zinc-800 px-4 py-12 text-center">
            <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-300" />
            <p className="mt-4 text-lg font-semibold text-zinc-100">
              Tudo limpo por hoje
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              O restante do valor agora está em revisar o histórico ou preparar o próximo
              dia. Esse é o tipo de vazio que a dashboard precisa deixar claro.
            </p>
          </div>
        )}
      </GlassPanel>
    ),
    telemetry: (
      <GlassPanel className="space-y-4 p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="editorial-kicker text-[#c65622]">Ritmo</p>
            <h2 className="editorial-title mt-2 text-3xl text-zinc-100 md:text-4xl">
              Consistência na semana
            </h2>
          </div>
          <span className="rounded-sm border border-zinc-800 px-3 py-2 text-xs uppercase tracking-[0.18em] text-zinc-400">
            leitura por dia
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-7">
          {currentWeek.map((day) => (
            <div
              key={day.dateKey}
              className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] p-4"
            >
              <p className="praxis-label">{day.shortLabel}</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-100">
                {day.percent}%
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                {day.completedCount}/{day.totalCount} concluídos
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full border border-zinc-800 bg-black/70">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent)_0%,#f97316_100%)]"
                  style={{ width: barWidth(Math.max(day.percent, day.totalCount > 0 ? 6 : 0)) }}
                />
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>
    ),
    modules: (
      <GlassPanel className="space-y-4 p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="editorial-kicker text-[#c65622]">Sistema</p>
            <h2 className="editorial-title mt-2 text-3xl text-zinc-100 md:text-4xl">
              Módulos ativos
            </h2>
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            progresso por frente
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {moduleSnapshots.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.id}
                href={module.route}
                className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] p-5 transition hover:border-[rgba(251,146,60,0.24)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-100">{module.name}</p>
                    <p className="mt-1 text-sm text-zinc-500">{module.detail}</p>
                  </div>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-sm border border-[rgba(251,146,60,0.2)] bg-[rgba(251,146,60,0.08)] text-[var(--accent)]">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="praxis-label">Progresso</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                      {module.total > 0 ? `${module.completed}/${module.total}` : "Sem dados"}
                    </p>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full border border-zinc-800 bg-black/70">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent)_0%,#f97316_100%)]"
                      style={{ width: barWidth(module.progress) }}
                    />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-500">{module.summary}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </GlassPanel>
    ),
    ranking: (
      <GlassPanel className="space-y-4 p-6 md:p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="editorial-kicker text-[#c65622]">Posição</p>
            <h2 className="editorial-title mt-2 text-3xl text-zinc-100 md:text-4xl">
              Leitura global
            </h2>
          </div>
          <Medal className="h-5 w-5 text-[var(--accent)]" />
        </div>

        <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] p-4">
          <p className="praxis-label">Você está em</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">#{rankingPosition}</p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            {rivalAhead
              ? `O próximo operador acima é ${rivalAhead.name} com ${formatPoints(rivalAhead.totalXp)} XP.`
              : "Você está liderando a leitura global."}
          </p>
        </div>

        <div className="space-y-3">
          {leaderboard.slice(0, 4).map((entry, index) => (
            <div
              key={entry.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-sm border px-4 py-3",
                entry.id === "praxis-user"
                  ? "border-[rgba(251,146,60,0.28)] bg-[rgba(251,146,60,0.08)]"
                  : "border-zinc-800 bg-[rgba(14,14,17,0.96)]",
              )}
            >
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">#{index + 1}</p>
                <p className="mt-1 text-sm font-semibold text-zinc-100">{entry.name}</p>
                <p className="mt-1 text-xs text-zinc-500">{entry.username}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-zinc-100">
                  {formatPoints(entry.totalXp)} XP
                </p>
                <p className="mt-1 text-xs text-zinc-500">Nível {entry.level}</p>
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>
    ),
    skills: (
      <GlassPanel className="space-y-4 p-6 md:p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="editorial-kicker text-[#c65622]">Perfil</p>
            <h2 className="editorial-title mt-2 text-3xl text-zinc-100 md:text-4xl">
              Status do operador
            </h2>
          </div>
          <Shield className="h-5 w-5 text-[var(--accent)]" />
        </div>

        <div className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] p-5">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-sm border border-[rgba(251,146,60,0.2)] bg-[rgba(251,146,60,0.08)] font-title text-lg font-bold text-zinc-100">
              {squareInitials(user.name)}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold text-zinc-100">{user.name}</p>
              <p className="mt-1 text-sm text-zinc-500">{user.username}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
                Rank {user.rankTier} • nível {user.level}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {[
            { label: "Energia", value: user.skillScores.energy },
            { label: "Foco", value: user.skillScores.focus },
            { label: "Disciplina", value: user.skillScores.discipline },
            { label: "Produção", value: user.skillScores.production },
            { label: "Motivação", value: user.skillScores.motivation },
          ].map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-zinc-200">{item.label}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  {item.value.toFixed(1)}/5
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full border border-zinc-800 bg-black/70">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent)_0%,#f97316_100%)]"
                  style={{ width: barWidth((item.value / 5) * 100) }}
                />
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>
    ),
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Comando"
        title="Dashboard"
        description="Visão central do operador: missões, ritmo semanal, módulos ativos e próximos passos no mesmo núcleo."
      />

      {isLayoutEditing ? (
        <GlassPanel className="space-y-4 p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="editorial-kicker text-[#c65622]">Personalização</p>
              <h2 className="editorial-title mt-2 text-3xl text-zinc-100 md:text-4xl">
                Editar layout do painel
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
                Reordene os blocos que você vê primeiro e esconda o que não ajuda no ciclo
                atual. Essa ordem fica presa à conta.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsLayoutEditing(false)}
              className="praxis-button-ghost px-4 py-3"
            >
              Fechar edição
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {sectionOrder.map((sectionId, index) => {
              const hidden = hiddenSections.has(sectionId);

              return (
                <div
                  key={sectionId}
                  className="rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.96)] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">
                        {dashboardSectionLabels[sectionId]}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-zinc-500">
                        {hidden
                          ? "Esse bloco está oculto no painel."
                          : "Esse bloco está visível no painel."}
                      </p>
                    </div>
                    <span className="rounded-sm border border-zinc-800 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                      #{index + 1}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => actions.toggleDashboardSectionVisibility(sectionId)}
                      className={cn(
                        "rounded-sm border px-3 py-2 text-xs transition",
                        hidden
                          ? "border-zinc-800 bg-[rgba(18,18,20,0.98)] text-zinc-300"
                          : "border-[rgba(251,146,60,0.28)] bg-[rgba(251,146,60,0.12)] text-[var(--accent)]",
                      )}
                    >
                      {hidden ? "Mostrar bloco" : "Ocultar bloco"}
                    </button>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() =>
                        actions.reorderDashboardSection({
                          sectionId,
                          direction: "up",
                        })
                      }
                      className="inline-flex items-center gap-2 rounded-sm border border-zinc-800 px-3 py-2 text-xs text-zinc-300 transition disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                      Subir
                    </button>
                    <button
                      type="button"
                      disabled={index === sectionOrder.length - 1}
                      onClick={() =>
                        actions.reorderDashboardSection({
                          sectionId,
                          direction: "down",
                        })
                      }
                      className="inline-flex items-center gap-2 rounded-sm border border-zinc-800 px-3 py-2 text-xs text-zinc-300 transition disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                      Descer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      ) : null}

      <div className="space-y-6">
        {visibleSectionOrder.map((sectionId) => (
          <div key={sectionId}>{sectionCards[sectionId]}</div>
        ))}
      </div>
    </div>
  );
}
