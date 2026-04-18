export function isAuthorizedDispatchRequest({
  nodeEnv,
  configuredSecret,
  headerSecret,
}: {
  nodeEnv: string | undefined;
  configuredSecret: string | undefined;
  headerSecret: string | null;
}) {
  if (nodeEnv !== "production") {
    return true;
  }

  if (!configuredSecret) {
    return false;
  }

  return headerSecret === configuredSecret;
}
