import { NextResponse } from "next/server";
import { getAccountState } from "@/lib/account-state.server";
import {
  listUsersWithNotificationSchedule,
  sendCustomPushNotification,
} from "@/lib/notification-center.server";
import {
  sendTelegramDocumentToUser,
  sendTelegramToUser,
} from "@/lib/telegram-center.server";
import type { PersistedState } from "@/lib/types";
import { buildWeeklyReport, weekReference } from "@/lib/weekly-report";
import { generateWeeklyReportPdf } from "@/lib/weekly-report-pdf";
import { isAuthorizedDispatchRequest } from "@/lib/security/dispatch-auth";

export const runtime = "nodejs";
// PDFKit + iteração de usuários + envio cross-channel pode demorar.
// Vercel Pro permite 60s; default Hobby = 10s. Configurável no
// vercel.json. Mantém runtime nodejs (não edge) por causa do pdfkit.
export const maxDuration = 60;

function isAuthorized(request: Request) {
  return isAuthorizedDispatchRequest({
    nodeEnv: process.env.NODE_ENV,
    configuredSecret:
      process.env.NOTIFICATION_CRON_SECRET || process.env.CRON_SECRET,
    headerSecret: request.headers.get("x-praxis-cron-secret"),
    authorizationHeader: request.headers.get("authorization"),
    allowOpenDispatch: process.env.PRAXIS_ALLOW_OPEN_DISPATCH === "true",
  });
}

type UserOutcome = {
  userId: string;
  status: "sent" | "skipped" | "error";
  push?: { sent: number; removed: number };
  telegramMessage?: { ok: boolean; skipped?: boolean; error?: string };
  telegramDocument?: { ok: boolean; skipped?: boolean; error?: string };
  error?: string;
};

async function processUser(
  userId: string,
  referenceDate: Date,
): Promise<UserOutcome> {
  try {
    const envelope = await getAccountState(userId);
    if (!envelope) {
      return { userId, status: "skipped", error: "Sem estado salvo." };
    }
    const report = buildWeeklyReport(
      envelope.state as PersistedState,
      referenceDate,
    );

    // Skip semanas sem nenhuma atividade — não vale ocupar atenção.
    if (report.overall.total === 0) {
      return { userId, status: "skipped", error: "Sem atividades na semana." };
    }

    const pdf = await generateWeeklyReportPdf(report);
    const filename = `praxis-relatorio-${report.weekStartKey}.pdf`;

    // Texto curto pro Telegram (markdown evitado pra simplicidade).
    const summary = [
      `📊 Relatório Semanal — ${report.rangeLabel}`,
      "",
      report.summary,
      "",
      report.topToImprove.length > 0
        ? `Foco pra próxima semana: ${report.topToImprove
            .map((activity) => `${activity.title} (${activity.percent}%)`)
            .join(", ")}`
        : "Tudo fechado essa semana 🎯",
    ].join("\n");

    // Dispara em paralelo. Telegram doc envia DEPOIS da mensagem pra
    // ordem visual ficar: texto → PDF.
    const [pushResult, telegramText] = await Promise.all([
      sendCustomPushNotification(userId, {
        title: `Relatório semanal · ${report.overall.percent}%`,
        body: report.summary.slice(0, 180),
        url: "/relatorios",
        tag: `weekly-report-${report.weekStartKey}`,
        requireInteraction: false,
      }),
      sendTelegramToUser(userId, summary),
    ]);

    const telegramDoc = telegramText.skipped
      ? telegramText
      : await sendTelegramDocumentToUser(userId, pdf, filename);

    return {
      userId,
      status: "sent",
      push: { sent: pushResult.sent, removed: pushResult.removed },
      telegramMessage: telegramText,
      telegramDocument: telegramDoc,
    };
  } catch (error) {
    return {
      userId,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function dispatchWeeklyReports() {
  // Última SEMANA FECHADA — segunda-feira passa a apontar pra semana
  // que acabou no domingo anterior (mesmo critério que a página
  // /relatorios usa como default).
  const reference = weekReference(1);
  const userIds = await listUsersWithNotificationSchedule();

  const outcomes: UserOutcome[] = [];
  for (const userId of userIds) {
    outcomes.push(await processUser(userId, reference));
  }

  return {
    referenceDate: reference.toISOString(),
    usersChecked: userIds.length,
    sent: outcomes.filter((outcome) => outcome.status === "sent").length,
    skipped: outcomes.filter((outcome) => outcome.status === "skipped").length,
    errors: outcomes.filter((outcome) => outcome.status === "error").length,
    outcomes,
  };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const wantsVerbose =
    new URL(request.url).searchParams.get("verbose") === "1";

  try {
    const summary = await dispatchWeeklyReports();
    console.log(
      `[reports/dispatch-weekly] users=${summary.usersChecked} sent=${summary.sent} skipped=${summary.skipped} errors=${summary.errors}`,
    );
    if (wantsVerbose) {
      return NextResponse.json(summary);
    }
    // Cron-job free tier limita o tamanho do output salvo, então
    // 204 default casa com o padrão do /api/notifications/dispatch.
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("[reports/dispatch-weekly] failed:", error);
    return NextResponse.json(
      { error: "Falha no dispatch do relatório semanal." },
      { status: 500 },
    );
  }
}
