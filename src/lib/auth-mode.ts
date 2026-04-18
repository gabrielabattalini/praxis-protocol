export const isLocalAuthBypassEnabled =
  process.env.NODE_ENV !== "production" &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
