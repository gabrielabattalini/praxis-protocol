"use client";

import { useEffect } from "react";
import { CheckCircle2, Dumbbell, Zap } from "lucide-react";

type WorkoutCelebrationProps = {
  title: string;
  xp: number;
  onClose: () => void;
};

/**
 * Overlay comemorativo exibido quando o usuário termina TODOS os
 * lançamentos do treino do dia (ou marca como feito). Some sozinho em
 * alguns segundos e fecha em qualquer clique/Esc. Pura camada visual —
 * a conclusão e o XP já são gravados no estado por quem dispara.
 */
export function WorkoutCelebration({
  title,
  xp,
  onClose,
}: WorkoutCelebrationProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 6000);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label="Treino concluído"
      onClick={onClose}
      className="fixed inset-0 z-[140] flex items-center justify-center bg-[rgba(5,5,5,0.78)] px-6 backdrop-blur-md"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="praxis-celebrate-pop praxis-panel praxis-scanlines w-full max-w-sm rounded-sm px-8 py-9 text-center shadow-[0_24px_90px_rgba(0,0,0,0.6)]"
      >
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[color:color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--accent)] shadow-[0_0_28px_var(--glow)]">
          <CheckCircle2 className="h-10 w-10" />
        </div>

        <p className="praxis-label mt-5 text-[var(--accent)]">
          <Dumbbell className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
          Sessão registrada
        </p>
        <h2 className="praxis-title mt-2 text-3xl">Treino concluído!</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-300">{title}</p>

        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-2)_100%)] px-5 py-2 text-base font-bold text-slate-950 shadow-[0_0_20px_rgba(251,146,60,0.4)]">
          <Zap className="h-4 w-4" />
          +{xp} XP
        </div>

        <p className="mt-5 text-xs leading-5 text-zinc-500">
          Disciplina é o que separa quem fala de quem faz. Bora pra próxima.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="praxis-button-ghost mt-5 inline-flex w-full items-center justify-center px-4 py-2 text-sm"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
