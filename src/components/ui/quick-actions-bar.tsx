"use client";

import { useState } from "react";
import Link from "next/link";
import { Droplet, ListPlus, UtensilsCrossed, X } from "lucide-react";
import { useAppStore } from "@/components/providers/app-store-provider";
import { useToast } from "@/components/ui/toast";

const WATER_QUICK_ML = 250;

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function findNextPendingMeal(
  mealPlan: ReturnType<typeof useAppStore>["state"]["mealPlan"],
  todayKey: string,
) {
  for (const block of mealPlan ?? []) {
    for (const item of block.items) {
      const done =
        item.completedDates?.includes(todayKey) ||
        item.completedAt?.slice(0, 10) === todayKey;
      if (!done) {
        return {
          blockId: block.id,
          itemId: item.id,
          label: item.label,
          blockTitle: block.title,
        };
      }
    }
  }
  return null;
}

/**
 * Barra flutuante com 3 atalhos sempre acessíveis em qualquer página
 * autenticada: adicionar água, marcar próxima refeição pendente,
 * e ir pra criar tarefa.
 */
export function QuickActionsBar() {
  const { state, actions } = useAppStore();
  const { push } = useToast();
  const [open, setOpen] = useState(false);

  const todayKey = getTodayKey();
  const nextMealAction = findNextPendingMeal(state.mealPlan, todayKey);

  const addWater = () => {
    const current =
      (state.waterEntries ?? []).find((entry) => entry.date === todayKey)?.consumedMl ?? 0;
    const previous = current;
    const next = Math.max(0, current + WATER_QUICK_ML);
    actions.setWaterConsumed({ date: todayKey, consumedMl: next });
    push({
      message: `+${WATER_QUICK_ML} ml registrado`,
      undo: () => actions.setWaterConsumed({ date: todayKey, consumedMl: previous }),
    });
    setOpen(false);
  };

  const markNextMeal = () => {
    if (!nextMealAction) return;
    actions.toggleMealItemCompleted({
      blockId: nextMealAction.blockId,
      itemId: nextMealAction.itemId,
      dateKey: todayKey,
    });
    push({
      message: `Concluído: ${nextMealAction.label}`,
      undo: () =>
        actions.toggleMealItemCompleted({
          blockId: nextMealAction.blockId,
          itemId: nextMealAction.itemId,
          dateKey: todayKey,
        }),
    });
    setOpen(false);
  };

  return (
    <>
      {/* Backdrop quando expandido */}
      {open ? (
        <button
          type="button"
          aria-label="Fechar atalhos"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[140] bg-black/40 backdrop-blur-[2px]"
        />
      ) : null}

      <div className="pointer-events-none fixed bottom-[calc(var(--mobile-bottom-nav-space,0px)+1.25rem)] right-4 z-[150] flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
        {/* Atalhos expandidos */}
        {open ? (
          <div className="pointer-events-auto flex flex-col items-end gap-2 animate-in fade-in-0 slide-in-from-bottom-2">
            <QuickActionItem
              onClick={addWater}
              label={`+${WATER_QUICK_ML} ml de água`}
              icon={<Droplet className="h-4 w-4" />}
            />
            {nextMealAction ? (
              <QuickActionItem
                onClick={markNextMeal}
                label={`Concluir: ${nextMealAction.label}`}
                icon={<UtensilsCrossed className="h-4 w-4" />}
              />
            ) : null}
            <QuickActionLink
              href="/tasks?new=1"
              onClick={() => setOpen(false)}
              label="Nova tarefa"
              icon={<ListPlus className="h-4 w-4" />}
            />
          </div>
        ) : null}

        {/* Botão principal (FAB) */}
        <button
          type="button"
          aria-label={open ? "Fechar atalhos rápidos" : "Atalhos rápidos"}
          onClick={() => setOpen((current) => !current)}
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-[var(--accent)] bg-[var(--accent)] text-black shadow-[0_8px_28px_rgba(251,146,60,0.45)] transition active:scale-95"
        >
          {open ? <X className="h-5 w-5" /> : <Droplet className="h-5 w-5" />}
        </button>
      </div>
    </>
  );
}

function QuickActionItem({
  onClick,
  label,
  icon,
}: {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-sm border border-zinc-700 bg-[rgba(14,14,17,0.98)] px-4 py-2.5 text-sm font-semibold text-zinc-100 shadow-[0_8px_24px_rgba(0,0,0,0.55)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      {icon}
      {label}
    </button>
  );
}

function QuickActionLink({
  href,
  onClick,
  label,
  icon,
}: {
  href: string;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2 rounded-sm border border-zinc-700 bg-[rgba(14,14,17,0.98)] px-4 py-2.5 text-sm font-semibold text-zinc-100 shadow-[0_8px_24px_rgba(0,0,0,0.55)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      {icon}
      {label}
    </Link>
  );
}
