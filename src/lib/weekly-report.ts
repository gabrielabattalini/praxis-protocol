import type { PersistedState } from "@/lib/types";
import { buildWeekAgenda } from "@/lib/agenda";
import { formatDateKey } from "@/lib/utils";

/**
 * Motor do Relatório Semanal (Fase 1).
 *
 * Fonte única de verdade pro relatório — reusado pela página /relatorios,
 * e (nas próximas fases) pela geração de PDF e pelo texto das notificações.
 *
 * Tudo é calculado a partir de buildWeekAgenda, que por sua vez consulta
 * o histórico real de conclusão (completedDates / completedAt). Por isso
 * dá pra recalcular QUALQUER semana passada sem precisar de storage novo.
 *
 * A semana é segunda→domingo (mesmo startOfWeek do agenda.ts).
 */

export type WeeklyReportDay = {
  dateKey: string;
  dayLabel: string;
  shortLabel: string;
  completed: number;
  total: number;
  percent: number;
};

export type WeeklyReportActivity = {
  key: string;
  title: string;
  module: string;
  scheduled: number;
  completed: number;
  missed: number;
  percent: number;
};

export type WeeklyReportModule = {
  module: string;
  scheduled: number;
  completed: number;
  percent: number;
};

export type WeeklyReport = {
  weekStartKey: string;
  weekEndKey: string;
  rangeLabel: string;
  isCurrentWeek: boolean;
  overall: { completed: number; total: number; percent: number };
  xpEarned: number;
  days: WeeklyReportDay[];
  activities: WeeklyReportActivity[];
  modules: WeeklyReportModule[];
  leftBehind: WeeklyReportActivity[];
  topToImprove: WeeklyReportActivity[];
  bestModule: WeeklyReportModule | null;
  worstModule: WeeklyReportModule | null;
  bestDay: WeeklyReportDay | null;
  worstDay: WeeklyReportDay | null;
  trend: { previousPercent: number; delta: number } | null;
  summary: string;
};

function addDays(reference: Date, amount: number) {
  const date = new Date(reference);
  date.setDate(reference.getDate() + amount);
  return date;
}

function percentOf(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

const monthShort = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function rangeLabelFor(start: Date, end: Date) {
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.getDate()} – ${end.getDate()} de ${monthShort[end.getMonth()]}`;
  }
  return `${start.getDate()} de ${monthShort[start.getMonth()]} – ${end.getDate()} de ${monthShort[end.getMonth()]}`;
}

/**
 * Calcula o percentual geral (disciplina) de uma semana sem montar o
 * relatório inteiro — usado pra comparação com a semana anterior.
 */
function overallPercentForWeek(state: PersistedState, referenceDate: Date) {
  const days = buildWeekAgenda(state, referenceDate);
  const completed = days.reduce((sum, day) => sum + day.completedCount, 0);
  const total = days.reduce((sum, day) => sum + day.totalCount, 0);
  return { completed, total, percent: percentOf(completed, total) };
}

export function buildWeeklyReport(
  state: PersistedState,
  referenceDate: Date,
  now: Date = new Date(),
): WeeklyReport {
  const week = buildWeekAgenda(state, referenceDate);
  const start = week[0].date;
  const end = week[week.length - 1].date;
  const todayKey = formatDateKey(now);
  const isCurrentWeek =
    todayKey >= week[0].dateKey && todayKey <= week[week.length - 1].dateKey;

  const days: WeeklyReportDay[] = week.map((day) => ({
    dateKey: day.dateKey,
    dayLabel: day.dayLabel,
    shortLabel: day.shortLabel,
    completed: day.completedCount,
    total: day.totalCount,
    percent: percentOf(day.completedCount, day.totalCount),
  }));

  // Agrega atividades (mesma tarefa/bloco ao longo dos 7 dias) e módulos.
  const activityMap = new Map<string, WeeklyReportActivity>();
  const moduleMap = new Map<string, WeeklyReportModule>();
  let xpEarned = 0;

  for (const day of week) {
    for (const item of day.items) {
      const moduleName = item.sourceLabel || "Outros";
      // Agrupa por MÓDULO + TÍTULO em vez do id da entidade. Hábitos
      // recorrentes muitas vezes existem como tarefas separadas (uma
      // "Acordar" por dia da semana, vários "Cardio", etc.) — agrupar
      // por id deixava cada uma numa linha (0/1) repetida. Por título
      // dentro do módulo, todas viram uma só atividade ("Acordar 0/7").
      const activityKey = `${moduleName}::${item.title.trim().toLowerCase()}`;

      const activity =
        activityMap.get(activityKey) ??
        {
          key: activityKey,
          title: item.title,
          module: moduleName,
          scheduled: 0,
          completed: 0,
          missed: 0,
          percent: 0,
        };
      activity.scheduled += 1;
      if (item.completed) {
        activity.completed += 1;
        xpEarned += item.xp ?? 0;
      }
      activityMap.set(activityKey, activity);

      const mod =
        moduleMap.get(moduleName) ??
        { module: moduleName, scheduled: 0, completed: 0, percent: 0 };
      mod.scheduled += 1;
      if (item.completed) mod.completed += 1;
      moduleMap.set(moduleName, mod);
    }
  }

  const activities = Array.from(activityMap.values())
    .map((activity) => ({
      ...activity,
      missed: activity.scheduled - activity.completed,
      percent: percentOf(activity.completed, activity.scheduled),
    }))
    .sort((left, right) => {
      if (right.percent !== left.percent) return right.percent - left.percent;
      return left.title.localeCompare(right.title);
    });

  const modules = Array.from(moduleMap.values())
    .map((mod) => ({ ...mod, percent: percentOf(mod.completed, mod.scheduled) }))
    .sort((left, right) => {
      if (right.percent !== left.percent) return right.percent - left.percent;
      return left.module.localeCompare(right.module);
    });

  const leftBehind = activities
    .filter((activity) => activity.missed > 0)
    .sort((left, right) => {
      if (right.missed !== left.missed) return right.missed - left.missed;
      return left.percent - right.percent;
    });

  const topToImprove = leftBehind.slice(0, 3);

  const daysWithLoad = days.filter((day) => day.total > 0);
  const bestDay =
    daysWithLoad.length > 0
      ? daysWithLoad.reduce((best, day) =>
          day.percent > best.percent ? day : best,
        )
      : null;
  const worstDay =
    daysWithLoad.length > 0
      ? daysWithLoad.reduce((worst, day) =>
          day.percent < worst.percent ? day : worst,
        )
      : null;

  const overall = {
    completed: week.reduce((sum, day) => sum + day.completedCount, 0),
    total: week.reduce((sum, day) => sum + day.totalCount, 0),
    percent: percentOf(
      week.reduce((sum, day) => sum + day.completedCount, 0),
      week.reduce((sum, day) => sum + day.totalCount, 0),
    ),
  };

  // Tendência vs. semana anterior (só faz sentido se a anterior tinha carga).
  const previous = overallPercentForWeek(state, addDays(referenceDate, -7));
  const trend =
    previous.total > 0
      ? {
          previousPercent: previous.percent,
          delta: overall.percent - previous.percent,
        }
      : null;

  const bestModule = modules.length > 0 ? modules[0] : null;
  const worstModule =
    modules.length > 1 ? modules[modules.length - 1] : null;

  return {
    weekStartKey: week[0].dateKey,
    weekEndKey: week[week.length - 1].dateKey,
    rangeLabel: rangeLabelFor(start, end),
    isCurrentWeek,
    overall,
    xpEarned,
    days,
    activities,
    modules,
    leftBehind,
    topToImprove,
    bestModule,
    worstModule,
    bestDay,
    worstDay,
    trend,
    summary: buildSummary({
      overall,
      bestModule,
      worstModule,
      trend,
      isCurrentWeek,
    }),
  };
}

function buildSummary(input: {
  overall: { completed: number; total: number; percent: number };
  bestModule: WeeklyReportModule | null;
  worstModule: WeeklyReportModule | null;
  trend: { previousPercent: number; delta: number } | null;
  isCurrentWeek: boolean;
}) {
  const { overall, bestModule, worstModule, trend, isCurrentWeek } = input;
  if (overall.total === 0) {
    return "Nenhuma atividade caiu nesta semana — nada pra reportar.";
  }

  const parts: string[] = [];
  const prefix = isCurrentWeek ? "Até agora você concluiu" : "Você concluiu";
  parts.push(
    `${prefix} ${overall.percent}% das atividades da semana (${overall.completed} de ${overall.total}).`,
  );

  if (bestModule && worstModule && bestModule.module !== worstModule.module) {
    parts.push(
      `${bestModule.module} foi o destaque (${bestModule.percent}%), enquanto ${worstModule.module} ficou pra trás (${worstModule.percent}%).`,
    );
  } else if (bestModule) {
    parts.push(`Destaque pra ${bestModule.module} (${bestModule.percent}%).`);
  }

  if (trend) {
    if (trend.delta > 0) {
      parts.push(
        `Sua disciplina subiu ${trend.delta} ponto${trend.delta === 1 ? "" : "s"} vs. a semana anterior.`,
      );
    } else if (trend.delta < 0) {
      parts.push(
        `Sua disciplina caiu ${Math.abs(trend.delta)} ponto${Math.abs(trend.delta) === 1 ? "" : "s"} vs. a semana anterior.`,
      );
    } else {
      parts.push("Sua disciplina ficou estável vs. a semana anterior.");
    }
  }

  return parts.join(" ");
}

/**
 * Referência (qualquer data dentro da semana) pra N semanas atrás.
 * weeksAgo=0 → semana atual; weeksAgo=1 → última semana fechada.
 */
export function weekReference(weeksAgo: number, now: Date = new Date()) {
  return addDays(now, -7 * weeksAgo);
}
