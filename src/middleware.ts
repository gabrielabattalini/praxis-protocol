import { NextResponse, type NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Conditional Clerk middleware.
 *
 * Clerk v7 requires clerkMiddleware() for App Router auth() to work.
 * But when no publishable key is configured (local dev bypass), running
 * clerkMiddleware() would throw. So we only engage Clerk when the key is
 * present; otherwise we pass the request through untouched and the app's
 * isLocalAuthBypassEnabled path keeps working.
 *
 * The moment NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY are set,
 * real authentication (email/password + Google OAuth configured in the
 * Clerk dashboard) activates automatically — no code change needed.
 */
const hasClerkKeys = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY,
);

const clerk = clerkMiddleware();

export default function middleware(
  request: NextRequest,
  event: Parameters<typeof clerk>[1],
) {
  if (!hasClerkKeys) {
    return NextResponse.next();
  }
  return clerk(request, event);
}

export const config = {
  matcher: [
    // Skip Next internals and static files unless in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
