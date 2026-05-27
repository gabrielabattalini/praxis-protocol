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
 * Built-in founder/admin emails — ALWAYS have lifetime access, regardless
 * of any env configuration. Guarantees admin access never breaks even if
 * PRAXIS_LIFETIME_ACCESS_EMAILS isn't set on the deploy (e.g. Vercel).
 * IMPORTANT: founder emails also get the pre-seeded demo data (mercado,
 * suplementos do Pacho etc.) via isFounderEmail(). Pra dar só acesso
 * lifetime SEM o seed, usar BUILT_IN_LIFETIME_EMAILS abaixo.
 */
export const FOUNDER_ACCESS_EMAILS: readonly string[] = [
  "gabrielabattalini@gmail.com",
];

/**
 * Built-in lifetime allowlist — ALWAYS have lifetime access, mas NÃO
 * recebem os dados pré-seeded (não passam por isFounderEmail()).
 * Equivalente a estar em PRAXIS_LIFETIME_ACCESS_EMAILS, mas hardcoded
 * no código pra sobreviver a qualquer mudança/limpeza de env var.
 * Use isso pra liberar acesso vitalício a usuários reais (não-admin).
 */
export const BUILT_IN_LIFETIME_EMAILS: readonly string[] = [
  "alberto1998.lima@gmail.com",
];

/**
 * True only for the built-in founder/admin email(s). Used to decide who
 * gets the pre-seeded demo data (market, supplements, etc.). Brand-new
 * real accounts must start completely clean, so they return false here.
 */
export function isFounderEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEntitlementEmail(email);
  if (!normalized) return false;
  return FOUNDER_ACCESS_EMAILS.some(
    (founder) => normalizeEntitlementEmail(founder) === normalized,
  );
}

export function parseLifetimeAccessEmails(rawValue: string | null | undefined) {
  return new Set(
    [
      ...FOUNDER_ACCESS_EMAILS,
      ...BUILT_IN_LIFETIME_EMAILS,
      ...(rawValue ?? "").split(/[\s,;]+/),
    ]
      .map((email) => normalizeEntitlementEmail(email))
      .filter(Boolean),
  );
}

export function hasLifetimeAccessEmail(
  email: string | null | undefined,
  rawAllowlist: string | null | undefined,
) {
  const normalizedEmail = normalizeEntitlementEmail(email);

  if (!normalizedEmail) {
    return false;
  }

  return parseLifetimeAccessEmails(rawAllowlist).has(normalizedEmail);
}

export function resolveAccountEntitlement({
  email,
  lifetimeAccessEmails,
  paidActive = false,
}: {
  email: string | null | undefined;
  lifetimeAccessEmails?: string | null;
  paidActive?: boolean;
}): AccountEntitlement {
  if (hasLifetimeAccessEmail(email, lifetimeAccessEmails)) {
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
