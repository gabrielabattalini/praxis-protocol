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
  return NextResponse.json(summary);
}

export async function POST(request: Request) {
  return GET(request);
}
