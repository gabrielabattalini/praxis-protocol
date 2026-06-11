export type AccountAccessTier = "free" | "paid" | "lifetime";

export type AccountEntitlement = {
  hasFullAccess: boolean;
  tier: AccountAccessTier;
  label: string;
  reason: string;
};

export const defaultAccountEntitlement: AccountEntitlement = {
  hasFullAccess: false,
  tier: "free",
  label: "Plano gratuito",
  reason: "Nenhum acesso pago ou vitalicio encontrado para esta conta.",
};

export const localDevelopmentEntitlement: AccountEntitlement = {
  hasFullAccess: true,
  tier: "lifetime",
  label: "Acesso local completo",
  reason: "Modo local de desenvolvimento sem Clerk configurado.",
};

export function normalizeEntitlementEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

/**
 * Hash(es) SHA-256 do(s) email(s) de fundador/admin. Mantemos só o HASH
 * neste módulo (importado por app-store-provider → vai pro bundle do
 * client) pra NÃO vazar o email do operador em texto puro no JS público.
 * O texto puro vive em access-entitlements.server.ts (fora do bundle) e é
 * injetado na allowlist de lifetime no servidor — então o acesso vitalício
 * do fundador continua garantido independente de env.
 * isFounderEmail() decide quem recebe os dados pré-seeded (mercado,
 * suplementos etc.) comparando o hash do email logado com esta lista.
 */
export const FOUNDER_ACCESS_EMAIL_HASHES: readonly string[] = [
  // SHA-256 de "gabrielabattalini@gmail.com" (normalizado: trim+lowercase).
  "81e89aaf9bb611943f624f7e946848c92fcd55bcd1f9c23b73880b4db87d408f",
];

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// BUILT_IN_LIFETIME_EMAILS removido daqui — vivia neste módulo e ia pro
// bundle do client (importado por app-store-provider). Agora mora em
// access-entitlements.server.ts, fora do bundle público, e é injetado
// só quando o servidor monta a allowlist. Sem mudança de comportamento.

/**
 * True only for the built-in founder/admin email(s). Used to decide who
 * gets the pre-seeded demo data (market, supplements, etc.). Brand-new
 * real accounts must start completely clean, so they return false here.
 * Assíncrona porque compara via hash SHA-256 (Web Crypto) — assim o email
 * do fundador não precisa ficar em texto puro no bundle do client.
 */
export async function isFounderEmail(
  email: string | null | undefined,
): Promise<boolean> {
  const normalized = normalizeEntitlementEmail(email);
  if (!normalized) return false;
  const hash = await sha256Hex(normalized);
  return FOUNDER_ACCESS_EMAIL_HASHES.includes(hash);
}

/**
 * Monta a allowlist de lifetime access a partir de `extraBuiltIn` (injetado
 * pelo server com fundador + vitalícios, lista que vive fora do bundle do
 * client) e da env. Este módulo client-safe não embute mais nenhum email em
 * texto puro, então nada vaza pro bundle JS público.
 */
export function parseLifetimeAccessEmails(
  rawValue: string | null | undefined,
  extraBuiltIn: readonly string[] = [],
) {
  return new Set(
    [...extraBuiltIn, ...(rawValue ?? "").split(/[\s,;]+/)]
      .map((email) => normalizeEntitlementEmail(email))
      .filter(Boolean),
  );
}

export function hasLifetimeAccessEmail(
  email: string | null | undefined,
  rawAllowlist: string | null | undefined,
  extraBuiltIn: readonly string[] = [],
) {
  const normalizedEmail = normalizeEntitlementEmail(email);

  if (!normalizedEmail) {
    return false;
  }

  return parseLifetimeAccessEmails(rawAllowlist, extraBuiltIn).has(
    normalizedEmail,
  );
}

export function resolveAccountEntitlement({
  email,
  lifetimeAccessEmails,
  paidActive = false,
  extraBuiltInLifetimeEmails = [],
}: {
  email: string | null | undefined;
  lifetimeAccessEmails?: string | null;
  paidActive?: boolean;
  // Lifetime emails que o server injeta (lista que vivia hardcoded e
  // saiu do bundle do client). Sem isto, o client receberia apenas
  // FOUNDER + a env, perdendo o BUILT_IN_LIFETIME — mas só o server
  // chama essa função, então passar a lista é seguro.
  extraBuiltInLifetimeEmails?: readonly string[];
}): AccountEntitlement {
  if (
    hasLifetimeAccessEmail(
      email,
      lifetimeAccessEmails,
      extraBuiltInLifetimeEmails,
    )
  ) {
    return {
      hasFullAccess: true,
      tier: "lifetime",
      label: "Acesso vitalicio",
      reason: "E-mail autorizado como fundador/operador do projeto.",
    };
  }

  if (paidActive) {
    return {
      hasFullAccess: true,
      tier: "paid",
      label: "Praxis Pro ativo",
      reason: "Assinatura paga ativa.",
    };
  }

  return defaultAccountEntitlement;
}

export function coerceAccountEntitlement(value: unknown): AccountEntitlement {
  if (!value || typeof value !== "object") {
    return defaultAccountEntitlement;
  }

  const payload = value as Partial<AccountEntitlement>;
  const tier: AccountAccessTier =
    payload.tier === "lifetime" || payload.tier === "paid"
      ? payload.tier
      : "free";

  return {
    hasFullAccess: tier !== "free" && Boolean(payload.hasFullAccess),
    tier,
    label:
      typeof payload.label === "string" && payload.label.trim()
        ? payload.label
        : defaultAccountEntitlement.label,
    reason:
      typeof payload.reason === "string" && payload.reason.trim()
        ? payload.reason
        : defaultAccountEntitlement.reason,
  };
}
