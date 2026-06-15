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

export type WeeklyReportActivityDayStatus =
  | "done"      // concluído (ou parcialmente — meal block tocado)
  | "missed"    // estava agendado e ficou pra trás
  | "absent";   // não estava agendado nesse dia (ex.: treino de quinta)

export type WeeklyReportActivityDay = {
  dateKey: string;
  shortLabel: string;
  status: WeeklyReportActivityDayStatus;
};

export type WeeklyReportActivity = {
  key: string;
  title: string;
  module: string;
  scheduled: number;
  completed: number;
  missed: number;
  percent: number;
  // 7 entradas, sempre de segunda a domingo da semana — ajuda o usuário a
  // diagnosticar visualmente em quais dias a baixa não foi registrada
  // (vs. dias em que a atividade simplesmente não caiu).
  days: WeeklyReportActivityDay[];
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
 * Conta partiallyCompleted como feito, igual ao relatório principal,
 * pra a tendência não comparar laranjas com bananas.
 */
function overallPercentForWeek(state: PersistedState, referenceDate: Date) {
  const days = buildWeekAgenda(state, referenceDate);
  const completed = days.reduce(
    (sum, day) =>
      sum +
      day.items.filter((item) => item.completed || item.partiallyCompleted)
        .length,
    0,
  );
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

  // "Feito" pro relatório inclui partiallyCompleted (refeição tocada
  // ou hidratação com qualquer consumo). Mesma regra usada nos loops de
  // agregação abaixo — sem isto, days[] e overall divergiam de modules[]
  // e activities[].
  const countDone = (items: typeof week[number]["items"]) =>
    items.filter((item) => item.completed || item.partiallyCompleted).length;

  const days: WeeklyReportDay[] = week.map((day) => {
    const doneCount = countDone(day.items);
    return {
      dateKey: day.dateKey,
      dayLabel: day.dayLabel,
      shortLabel: day.shortLabel,
      completed: doneCount,
      total: day.totalCount,
      percent: percentOf(doneCount, day.totalCount),
    };
  });

  // Agrega atividades (mesma tarefa/bloco ao longo dos 7 dias) e módulos.
  const activityMap = new Map<string, WeeklyReportActivity>();
  const moduleMap = new Map<string, WeeklyReportModule>();
  // Status por dia, por atividade — preenchido durante a iteração e
  // usado pra mostrar a fileira visual "fez/não fez" no relatório,
  // ajudando o usuário a diagnosticar em qual dia a baixa sumiu.
  const dayStatusByActivity = new Map<string, Map<string, WeeklyReportActivityDayStatus>>();
  // Pra treinos, conta apenas as aparições CANONICAL (não off-schedule)
  // como "scheduled". Quando o usuário fez o treino fora do dia agendado
  // (canonical=quarta, executado=quinta), antes ficava 1/2 — agora 1/1.
  // Sem isso a aderência ficava artificialmente baixa pra quem
  // remaneja o treino dentro da semana.
  const workoutCanonical = new Map<string, number>();
  const workoutCompletedCount = new Map<string, number>();
  let xpEarned = 0;

  for (const day of week) {
    for (const item of day.items) {
      const moduleName = item.sourceLabel || "Outros";
      const isWorkout = item.kind === "workout";
      // "Feito" pro relatório = concluído OU TOCADO (partiallyCompleted).
      // Cobre o caso da refeição em que o usuário comeu o prato principal
      // mas não marcou todos os suplementos opcionais, e o dia em que ele
      // bebeu água sem fechar a meta de hidratação. Sem isto, esses dias
      // entravam como "missed" mesmo com a atividade EFETIVAMENTE feita.
      const wasDone = item.completed || Boolean(item.partiallyCompleted);
      // Treinos agrupam por workoutDayId (sessão única no programa),
      // outros itens por módulo+título (hábito recorrente).
      const activityKey =
        isWorkout && item.workoutDayId
          ? `workout::${item.workoutDayId}`
          : `${moduleName}::${item.title.trim().toLowerCase()}`;

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
          days: [],
        };

      // Registra o status DESTE dia pra esta atividade. Aparição
      // off-schedule de treino (executado num dia que não era o canônico)
      // só conta como "done" se foi feito — não "missed", senão um
      // treino remanejado faria o canônico aparecer como missed E o dia
      // remanejado também (dupla penalização).
      const dayStatus: WeeklyReportActivityDayStatus =
        wasDone
          ? "done"
          : isWorkout && item.isOffSchedule
            ? "absent"
            : "missed";
      const statusMap =
        dayStatusByActivity.get(activityKey) ??
        new Map<string, WeeklyReportActivityDayStatus>();
      const previous = statusMap.get(day.dateKey);
      // "done" prevalece sobre missed/absent caso a atividade apareça
      // duas vezes no mesmo dia (raro mas possível).
      if (previous !== "done") {
        statusMap.set(day.dateKey, dayStatus);
      }
      dayStatusByActivity.set(activityKey, statusMap);

      if (isWorkout && item.workoutDayId) {
        if (!item.isOffSchedule) {
          workoutCanonical.set(
            activityKey,
            (workoutCanonical.get(activityKey) ?? 0) + 1,
          );
        }
        if (wasDone) {
          workoutCompletedCount.set(
            activityKey,
            (workoutCompletedCount.get(activityKey) ?? 0) + 1,
          );
        }
      } else {
        activity.scheduled += 1;
        if (wasDone) activity.completed += 1;
      }
      if (item.completed) xpEarned += item.xp ?? 0;
      activityMap.set(activityKey, activity);

      // Módulo segue mesma lógica: aparição off-schedule NÃO adiciona
      // um "scheduled" novo (foi a mesma sessão remanejada de dia).
      const mod =
        moduleMap.get(moduleName) ??
        { module: moduleName, scheduled: 0, completed: 0, percent: 0 };
      if (isWorkout) {
        if (!item.isOffSchedule) mod.scheduled += 1;
      } else {
        mod.scheduled += 1;
      }
      if (wasDone) mod.completed += 1;
      moduleMap.set(moduleName, mod);
    }
  }

  // Monta `days` final pra cada atividade: 7 entradas (seg→dom). Dias em
  // que a atividade não apareceu na agenda viram "absent".
  function buildActivityDays(activityKey: string): WeeklyReportActivityDay[] {
    const statusMap = dayStatusByActivity.get(activityKey);
    return week.map((day) => ({
      dateKey: day.dateKey,
      shortLabel: day.shortLabel,
      status: statusMap?.get(day.dateKey) ?? "absent",
    }));
  }

  const activities = Array.from(activityMap.values())
    .map((activity) => {
      const days = buildActivityDays(activity.key);
      // Treinos: scheduled vem do conjunto canonical (capturado no
      // workoutCanonical). Se o usuário fez off-schedule num treino
      // não-agendado essa semana, ainda conta como 1 sessão prevista
      // (o usuário "criou" a sessão ao executá-la). Completed é capado
      // pelo scheduled pra não passar de 100% quando há sobra.
      if (activity.key.startsWith("workout::")) {
        const canonical = workoutCanonical.get(activity.key) ?? 0;
        const done = workoutCompletedCount.get(activity.key) ?? 0;
        const scheduled = canonical > 0 ? canonical : done;
        const completed = Math.min(done, scheduled);
        return {
          ...activity,
          scheduled,
          completed,
          missed: scheduled - completed,
          percent: percentOf(completed, scheduled),
          days,
        };
      }
      return {
        ...activity,
        missed: activity.scheduled - activity.completed,
        percent: percentOf(activity.completed, activity.scheduled),
        days,
      };
    })
    .sort((left, right) => {
      if (right.percent !== left.percent) return right.percent - left.percent;
      return left.title.localeCompare(right.title);
    });

  const modules = Array.from(moduleMap.values())
    .map((mod) => {
      // Cap completed pelo scheduled — execuções extras off-schedule
      // não devem inflar o módulo acima de 100%.
      const completed = Math.min(mod.completed, mod.scheduled);
      return {
        ...mod,
        completed,
        percent: percentOf(completed, mod.scheduled),
      };
    })
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

  // Overall consistente com days[]/modules[]: usa wasDone via countDone.
  const overallCompleted = week.reduce(
    (sum, day) => sum + countDone(day.items),
    0,
  );
  const overallTotal = week.reduce((sum, day) => sum + day.totalCount, 0);
  const overall = {
    completed: overallCompleted,
    total: overallTotal,
    percent: percentOf(overallCompleted, overallTotal),
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
