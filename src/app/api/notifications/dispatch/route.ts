import { NextResponse } from "next/server";
import { dispatchDueNotifications } from "@/lib/notification-center.server";
import { isAuthorizedDispatchRequest } from "@/lib/security/dispatch-auth";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  return isAuthorizedDispatchRequest({
    nodeEnv: process.env.NODE_ENV,
    configuredSecret:
      process.env.NOTIFICATION_CRON_SECRET || process.env.CRON_SECRET,
    headerSecret: request.headers.get("x-praxis-cron-secret"),
    authorizationHeader: request.headers.get("authorization"),
  });
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const summary = await dispatchDueNotifications();
  // Log completo no servidor pra debug via Vercel Logs sem precisar
  // de body grande na resposta — cron-job.org free tier limita a ~1KB
  // (headers + body) e Vercel sozinho já manda ~1KB em headers de segurança.
  console.log(
    `[dispatch] users=${summary.usersChecked} sent=${summary.notificationsSent} cleaned=${summary.invalidSubscriptionsRemoved}`,
  );

  // ?verbose=1 retorna o JSON completo (debug manual via curl/browser).
  // Default = 204 No Content pra caber no limite de qualquer cron externo.
  const url = new URL(request.url);
  if (url.searchParams.get("verbose") === "1") {
    return NextResponse.json(summary);
  }
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  return GET(request);
}
