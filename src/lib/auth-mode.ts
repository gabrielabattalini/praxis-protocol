/**
 * Local auth bypass.
 *
 * Normally enabled in non-production when no Clerk publishable key is set
 * (renders the "ACESSO LOCAL" simulated session for visual review).
 *
 * Set PRAXIS_FORCE_CLERK=true (or NEXT_PUBLIC_PRAXIS_FORCE_CLERK=true) to
 * force the real Clerk auth UI even without keys — Clerk then runs in
 * keyless development mode (auto-provisioned dev instance, Google OAuth
 * available out of the box). This lets you actually log in with Google
 * in dev without manually copying API keys.
 */
const forceClerk =
  process.env.PRAXIS_FORCE_CLERK === "true" ||
  process.env.NEXT_PUBLIC_PRAXIS_FORCE_CLERK === "true";

export const isLocalAuthBypassEnabled =
  !forceClerk &&
  process.env.NODE_ENV !== "production" &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
