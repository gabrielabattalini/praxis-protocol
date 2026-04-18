import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";

const isPublicRoute = createRouteMatcher([
  "/",
  "/auth/login(.*)",
  "/auth/register(.*)",
  "/clerk-sync-keyless(.*)",
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
