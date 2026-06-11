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
    allowOpenDispatch: process.env.PRAXIS_ALLOW_OPEN_DISPATCH === "true",
  });
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const wantsVerbose =
    new URL(request.url).searchParams.get("verbose") === "1";

  try {
    const summary = await dispatchDueNotifications();
    // Log completo no servidor pra debug via Vercel Logs sem precisar
    // de body grande na resposta — cron-job.org free tier limita o tamanho
    // do output salvo, e qualquer 500 (página HTML de erro do Next) estoura.
    console.log(
      `[dispatch] users=${summary.usersChecked} sent=${summary.notificationsSent} cleaned=${summary.invalidSubscriptionsRemoved}`,
    );

    // ?verbose=1 retorna o JSON completo (debug manual via curl/browser).
    // Default = 204 No Content pra caber no limite de qualquer cron externo.
    if (wantsVerbose) {
      return NextResponse.json(summary);
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    // Nunca deixa vazar um 500 com página HTML grande — isso quebraria
    // crons externos (cron-job.org marca "output too large" e desativa
    // o job). Loga e responde curto.
    console.error("[dispatch] erro inesperado:", error);
    if (wantsVerbose) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "dispatch failed" },
        { status: 500 },
      );
    }
    // 200 com corpo mínimo pra não estourar o limite de output do cron
    // externo, MAS com um header de sinal: dá pra montar um alerta
    // (uptime check no header) sem depender de alguém ler o Vercel Logs.
    return new Response("err", {
      status: 200,
      headers: { "X-Praxis-Dispatch-Status": "error" },
    });
  }
}

export async function POST(request: Request) {
  return GET(request);
}

// HEAD existe principalmente pra crons externos (ex.: cron-job.org).
// Por spec HTTP, response a HEAD NÃO TEM BODY — o que garante 0 bytes
// independente do que a Vercel/Next façam com headers. Roda a mesma
// lógica de dispatch e retorna um status code curto. Sem chance de
// "output too large" no log do cron externo.
export async function HEAD(request: Request) {
  if (!isAuthorized(request)) {
    return new Response(null, { status: 401 });
  }
  try {
    const summary = await dispatchDueNotifications();
    console.log(
      `[dispatch:HEAD] users=${summary.usersChecked} sent=${summary.notificationsSent} cleaned=${summary.invalidSubscriptionsRemoved}`,
    );
  } catch (error) {
    console.error("[dispatch:HEAD] erro inesperado:", error);
    return new Response(null, {
      status: 204,
      headers: { "X-Praxis-Dispatch-Status": "error" },
    });
  }
  return new Response(null, { status: 204 });
}
