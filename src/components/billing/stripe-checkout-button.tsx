"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import type { BillingPlanId } from "@/lib/billing-config";
import { cn } from "@/lib/utils";

type StripeCheckoutButtonProps = {
  source: string;
  plan?: BillingPlanId;
  className?: string;
  noteClassName?: string;
  errorClassName?: string;
  note?: string;
  children: React.ReactNode;
};

export function StripeCheckoutButton({
  source,
  plan = "monthly",
  className,
  noteClassName,
  errorClassName,
  note = "Checkout seguro via Stripe.",
  children,
}: StripeCheckoutButtonProps) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const checkoutHref = useMemo(() => {
    const params = new URLSearchParams({
      plan,
      source,
    });

    return `/api/billing/checkout?${params.toString()}`;
  }, [plan, source]);

  function handleCheckout() {
    startTransition(async () => {
      setError("");

      try {
        window.location.assign(checkoutHref);
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Não foi possível abrir o checkout agora.",
        );
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleCheckout}
        disabled={isPending}
        className={cn(
          "inline-flex h-12 items-center justify-center gap-3 border border-amber-400 bg-amber-400 px-5 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#090909] shadow-[0_0_18px_rgba(251,146,60,0.32)] transition hover:bg-[#ffb16c] hover:shadow-[0_0_26px_rgba(251,146,60,0.42)] disabled:cursor-wait disabled:opacity-80",
          className,
        )}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Abrindo checkout
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4" />
            {children}
          </>
        )}
      </button>

      {note ? (
        <p
          className={cn(
            "font-mono text-[0.58rem] uppercase tracking-[0.2em] text-zinc-500",
            noteClassName,
          )}
        >
          {note}
        </p>
      ) : null}

      {error ? (
        <p
          className={cn(
            "max-w-md text-sm leading-6 text-amber-300",
            errorClassName,
          )}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
