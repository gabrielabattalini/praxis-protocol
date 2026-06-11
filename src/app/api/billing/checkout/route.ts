import { currentUser, auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "@/lib/billing-config";
import { getStripeBillingPlan } from "@/lib/stripe-billing.server";
import { getStripeServer } from "@/lib/stripe.server";
import {
  clientIpFromRequest,
  enforceRateLimit,
} from "@/lib/security/rate-limit";

type CheckoutPayload = {
  plan?: string;
  source?: string;
};

const CHECKOUT_ERROR_MESSAGE =
  "Não foi possível iniciar o checkout agora. Tente novamente em instantes.";

async function createCheckoutSessionUrl(payload: CheckoutPayload) {
  const source =
    typeof payload.source === "string" && payload.source.trim().length > 0
      ? payload.source.trim().slice(0, 80)
      : "site";

  const plan = getStripeBillingPlan(payload.plan);

  if (!plan.stripePriceId) {
    throw new Error(
      "Stripe ainda não foi configurado neste ambiente. Adicione a chave e o Price ID para liberar o checkout.",
    );
  }

  const { userId } = await auth();
  const user = userId ? await currentUser() : null;
  // Só pré-preenche o email a partir da SESSÃO autenticada. Antes, um
  // request anônimo podia passar qualquer email no payload → o Stripe
  // enviava "Complete sua compra" pra esse endereço, virando vetor de
  // spam/phishing contra terceiros. Sem sessão, deixa o Stripe coletar
  // o email no próprio checkout.
  const email = user?.primaryEmailAddress?.emailAddress || undefined;
  const stripe = getStripeServer();
  const appUrl = getAppUrl();

  const session = await stripe.checkout.sessions.create({
    mode: plan.mode,
    line_items: [
      {
        price: plan.stripePriceId,
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/checkout/cancel`,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    customer_email: email,
    client_reference_id: userId || undefined,
    metadata: {
      source,
      planId: plan.id,
      userId: userId || "",
      email: email || "",
    },
  });

  if (!session.url) {
    throw new Error("A Stripe não retornou a URL do checkout.");
  }

  return session.url;
}

export async function GET(request: NextRequest) {
  try {
    const url = await createCheckoutSessionUrl({
      plan: request.nextUrl.searchParams.get("plan") || undefined,
      source: request.nextUrl.searchParams.get("source") || undefined,
    });

    return NextResponse.redirect(url);
  } catch {
    const fallbackUrl = new URL("/checkout/cancel", getAppUrl());
    return NextResponse.redirect(fallbackUrl);
  }
}

export async function POST(request: NextRequest) {
  // Rota pública: cada chamada cria uma Stripe Checkout Session real.
  // Rate-limit por IP pra impedir geração em massa de sessões.
  const limited = await enforceRateLimit(
    "billing-checkout",
    clientIpFromRequest(request),
    10,
    60,
  );
  if (limited) return limited;

  try {
    const payload = (await request.json().catch(() => ({}))) as CheckoutPayload;
    const url = await createCheckoutSessionUrl(payload);

    return NextResponse.json({
      url,
    });
  } catch {
    return NextResponse.json(
      {
        error: CHECKOUT_ERROR_MESSAGE,
      },
      { status: 500 },
    );
  }
}
