export function isAuthorizedDispatchRequest({
  nodeEnv,
  configuredSecret,
  headerSecret,
  authorizationHeader,
}: {
  nodeEnv: string | undefined;
  configuredSecret: string | undefined;
  headerSecret: string | null;
  // Vercel Cron sends "Authorization: Bearer ${CRON_SECRET}" automatically,
  // so we accept that shape as well as the legacy `x-praxis-cron-secret`.
  authorizationHeader?: string | null;
}) {
  if (nodeEnv !== "production") {
    return true;
  }

  if (!configuredSecret) {
    return false;
  }

  if (headerSecret === configuredSecret) {
    return true;
  }

  if (authorizationHeader) {
    const bearer = authorizationHeader.replace(/^Bearer\s+/i, "").trim();
    if (bearer && bearer === configuredSecret) {
      return true;
    }
  }

  return false;
}
