import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "@/lib/billing-config";
import { getStripeServer } from "@/lib/stripe.server";
import { normalizeEntitlementEmail } from "@/lib/access-entitlements";
import {
  clientIpFromRequest,
  enforceRateLimit,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Portal do cliente Stripe — o assinante gerencia a própria assinatura
 * (cancelar, trocar cartão, baixar faturas) sem abrir chamado. Sem isto,
 * cancelar exigia falar com o suporte, que é atrito e motivo clássico de
 * chargeback.
 *
 * Segurança: o customer é procurado APENAS pelo email da sessão Clerk
 * autenticada — ninguém abre portal de outra pessoa por payload.
 */
export async function POST(request: NextRequest) {
  const ip = clientIpFromRequest(request);
  const limited = await enforceRateLimit("billing-portal", ip, 10, 60);
  if (limited) return limited;

  const user = await currentUser();
  const email = normalizeEntitlementEmail(
    user?.primaryEmailAddress?.emailAddress,
  );

  if (!email) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe não configurado neste ambiente." },
      { status: 503 },
    );
  }

  try {
    const stripe = getStripeServer();
    const customers = await stripe.customers.list({ email, limit: 5 });
    const customer = customers.data.find((candidate) => !candidate.deleted);

    if (!customer) {
      return NextResponse.json(
        {
          error:
            "Nenhuma assinatura encontrada para este email. Se você pagou com outro email, entre em contato.",
        },
        { status: 404 },
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${getAppUrl()}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[billing-portal] failed:", error);
    return NextResponse.json(
      { error: "Não foi possível abrir o portal agora. Tente de novo." },
      { status: 500 },
    );
  }
}
