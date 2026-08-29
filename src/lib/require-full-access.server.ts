import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { resolveAccountEntitlementCached } from "@/lib/access-entitlements.server";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";

/**
 * Gate de plano pras rotas de API CARAS (busca de preço, bases
 * nutricionais, PDF do relatório…). O PaywallGate tranca a UI, mas UI é
 * burlável — quem paga a conta das requisições é o servidor, então é o
 * servidor que nega.
 *
 * Uso no topo do handler (depois do check de sessão):
 *   const denied = await requireFullAccess();
 *   if (denied) return denied;
 *
 * Retorna null quando pode seguir; NextResponse 402 quando não pode.
 * Usa o resolvedor CACHEADO (KV) — custa uma leitura de cache por
 * request, não uma varredura no Stripe.
 */
export async function requireFullAccess(): Promise<NextResponse | null> {
  // Dev local sem Clerk: sessão simulada já é tratada como vitalícia.
  if (isLocalAuthBypassEnabled) return null;

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const entitlement = await resolveAccountEntitlementCached(email);

  if (entitlement.hasFullAccess) return null;

  return NextResponse.json(
    {
      error:
        "Este recurso faz parte do plano pago. Ative sua conta para usar.",
      code: "payment_required",
    },
    { status: 402, headers: { "Cache-Control": "no-store" } },
  );
}
