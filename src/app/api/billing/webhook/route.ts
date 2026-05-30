import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeServer } from "@/lib/stripe.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook receiver.
 *
 * Verifies the Stripe signature, then acknowledges the event. Entitlement
 * itself is resolved LIVE from Stripe (see access-entitlements.server.ts),
 * so this endpoint doesn't need a database — its job is:
 *   1. Verify the event is genuinely from Stripe (signature check)
 *   2. Log lifecycle events (paid / canceled / refunded)
 *   3. Return 200 fast so Stripe doesn't retry
 *
 * Configure in Stripe Dashboard → Developers → Webhooks:
 *   Endpoint URL:  {APP_URL}/api/billing/webhook
 *   Events:        checkout.session.completed,
 *                  customer.subscription.deleted,
 *                  customer.subscription.updated,
 *                  invoice.payment_failed
 *   Then put the signing secret in STRIPE_WEBHOOK_SECRET.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    // Fail-CLOSED em produção: aceitar webhooks não-assinados, mesmo só
    // pra log, normaliza "tá ok não verificar" e mascara uma má config.
    // Em dev local seguimos aceitando pra teste manual com Stripe CLI.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[webhook] STRIPE_WEBHOOK_SECRET ausente em produção — recusando",
      );
      return NextResponse.json(
        { error: "Webhook não configurado." },
        { status: 500 },
      );
    }
    return NextResponse.json({ received: true, configured: false });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Assinatura ausente." },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripeServer();
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    console.error("[webhook] signature verification failed:", error);
    return NextResponse.json(
      { error: "Assinatura inválida." },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const email =
          session.customer_details?.email ||
          (typeof session.customer_email === "string"
            ? session.customer_email
            : "") ||
          "";
        console.info(
          `[webhook] checkout.session.completed · ${email} · ${session.id}`,
        );
        break;
      }
      case "customer.subscription.deleted":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        console.info(
          `[webhook] ${event.type} · customer=${String(
            subscription.customer,
          )} · status=${subscription.status}`,
        );
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn(
          `[webhook] invoice.payment_failed · customer=${String(
            invoice.customer,
          )}`,
        );
        break;
      }
      default:
        // Unhandled event types are fine — just acknowledge.
        break;
    }
  } catch (error) {
    console.error("[webhook] handler error:", error);
    // Still return 200: the event was valid; retrying won't help.
  }

  return NextResponse.json({ received: true });
}
