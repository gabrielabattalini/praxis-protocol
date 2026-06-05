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
 * lifetime SEM o seed, usar BUILT_IN_LIFETIME_EMAILS em
 * access-entitlements.server.ts (não vai pro bundle do client).
 */
export const FOUNDER_ACCESS_EMAILS: readonly string[] = [
  "gabrielabattalini@gmail.com",
];

// BUILT_IN_LIFETIME_EMAILS removido daqui — vivia neste módulo e ia pro
// bundle do client (importado por app-store-provider). Agora mora em
// access-entitlements.server.ts, fora do bundle público, e é injetado
// só quando o servidor monta a allowlist. Sem mudança de comportamento.

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

/**
 * Monta a allowlist de lifetime access.
 * `extraBuiltIn` é injetado pelo server (access-entitlements.server.ts)
 * com a lista que antes vivia hardcoded aqui — assim os emails de
 * usuários reais não vazam pro bundle do client. No client (que importa
 * este módulo) só os FOUNDER_ACCESS_EMAILS são considerados, sem leak.
 */
export function parseLifetimeAccessEmails(
  rawValue: string | null | undefined,
  extraBuiltIn: readonly string[] = [],
) {
  return new Set(
    [
      ...FOUNDER_ACCESS_EMAILS,
      ...extraBuiltIn,
      ...(rawValue ?? "").split(/[\s,;]+/),
    ]
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
