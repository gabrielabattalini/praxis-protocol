import crypto from "node:crypto";

/** Comparação de strings em tempo constante (evita timing oracle no
 *  segredo do cron). Faz hash dos dois lados pra normalizar o tamanho
 *  antes do timingSafeEqual (que exige buffers de mesmo comprimento). */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function isAuthorizedDispatchRequest({
  nodeEnv,
  configuredSecret,
  headerSecret,
  authorizationHeader,
  allowOpenDispatch,
}: {
  nodeEnv: string | undefined;
  configuredSecret: string | undefined;
  headerSecret: string | null;
  // Vercel Cron sends "Authorization: Bearer ${CRON_SECRET}" automatically,
  // so we accept that shape as well as the legacy `x-praxis-cron-secret`.
  authorizationHeader?: string | null;
  // Dev-only bypass — só quando EXPLICITAMENTE habilitado via
  // PRAXIS_ALLOW_OPEN_DISPATCH=true. Antes o bypass era automático fora
  // de produção, o que deixava qualquer host com NODE_ENV != production
  // (staging/self-host) com o dispatch ABERTO (carrega o estado de todos
  // os usuários + dispara push/Telegram). Agora exige opt-in consciente.
  allowOpenDispatch?: boolean;
}) {
  if (nodeEnv !== "production" && allowOpenDispatch) {
    return true;
  }

  if (!configuredSecret) {
    return false;
  }

  if (headerSecret && safeEqual(headerSecret, configuredSecret)) {
    return true;
  }

  if (authorizationHeader) {
    const bearer = authorizationHeader.replace(/^Bearer\s+/i, "").trim();
    if (bearer && safeEqual(bearer, configuredSecret)) {
      return true;
    }
  }

  return false;
}
