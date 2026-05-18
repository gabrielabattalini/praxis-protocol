import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";

const isPublicRoute = createRouteMatcher([
  "/",
  "/auth/login(.*)",
  "/auth/register(.*)",
  "/clerk-sync-keyless(.*)",
  "/checkout/(.*)",
  // VAPID public key is non-sensitive by design and the browser may
  // fetch it before the Clerk session is ready — keep it open.
  "/api/notifications/public-key",
  // Stripe webhook is verified by signature, must not require a session.
  "/api/billing/webhook",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isLocalAuthBypassEnabled) {
    return;
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp3)).*)",
    "/(api|trpc)(.*)",
  ],
};
