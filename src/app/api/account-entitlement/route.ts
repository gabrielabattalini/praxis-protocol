import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  localDevelopmentEntitlement,
  normalizeEntitlementEmail,
} from "@/lib/access-entitlements";
import { resolveAccountEntitlementFull } from "@/lib/access-entitlements.server";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getEmailFromClaims(claims: unknown) {
  if (!claims || typeof claims !== "object") {
    return "";
  }

  const record = claims as Record<string, unknown>;
  const candidates = [
    record.email,
    record.primary_email_address,
    record.primaryEmailAddress,
  ];

  const found = candidates.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length > 0,
  );

  return found ?? "";
}

export async function GET() {
  if (isLocalAuthBypassEnabled) {
    return NextResponse.json(localDevelopmentEntitlement, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  const authResult = await auth();

  if (!authResult.userId) {
    return NextResponse.json(
      { error: "Nao autenticado." },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ||
    getEmailFromClaims(authResult.sessionClaims);
  const entitlement = await resolveAccountEntitlementFull(email);

  return NextResponse.json(
    {
      ...entitlement,
      email: normalizeEntitlementEmail(email),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
