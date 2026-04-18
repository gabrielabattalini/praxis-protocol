"use client";

import { useMemo, useState } from "react";
import { Shield } from "lucide-react";
import { getLoadingCuePool } from "@/lib/discipline-cues";
import { cn } from "@/lib/utils";

type NavigationLoadingOverlayProps = {
  message?: string;
  detail?: string;
  className?: string;
};

export function NavigationLoadingOverlay({
  message = "Carregando",
  detail = "Aguarde enquanto o sistema conclui a próxima etapa.",
  className,
}: NavigationLoadingOverlayProps) {
  const cuePool = useMemo(() => getLoadingCuePool(), []);
  const [activeCue] = useState(() => {
    if (!cuePool.length) {
      return { eyebrow: "PROTOCOLO", text: "Carregando rotina." };
    }
    const index = Math.floor(Math.random() * cuePool.length);
    return cuePool[index] ?? cuePool[0];
  });

  return (
    <div
      className={cn(
        "fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(5,5,5,0.82)] px-6 backdrop-blur-md",
        className,
      )}
    >
      <div className="praxis-panel praxis-scanlines w-full max-w-md rounded-sm px-8 py-9 text-center shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-sm border border-[color:color-mix(in_srgb,var(--accent)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)] shadow-[0_0_18px_var(--glow)]">
          <Shield className="h-7 w-7 animate-pulse" />
        </div>
        <p className="praxis-label mt-5 text-[var(--accent)]">Carregando</p>
        <h2 className="praxis-title mt-3 text-3xl">{message}</h2>
        <p className="mt-4 text-sm leading-6 text-zinc-400">{detail}</p>
        <div className="mt-5 border border-zinc-800 bg-black/50 px-4 py-3 text-left">
          <p className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-[var(--accent)]">
            {activeCue.eyebrow}
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{activeCue.text}</p>
        </div>
        <div className="mt-6 h-2 overflow-hidden rounded-[2px] border border-zinc-800 bg-black/70">
          <div className="praxis-accent-progress h-full w-1/2 animate-[pulse_1.1s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
}
