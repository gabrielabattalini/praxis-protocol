"use client";

import { cn } from "@/lib/utils";

/**
 * Skeleton placeholder com shimmer leve. Usado em telas onde o conteúdo
 * tem latência perceptível de hidratação (Tasks, Dashboard, Nutrition).
 */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        "animate-pulse rounded-sm bg-gradient-to-r from-zinc-900/60 via-zinc-800/80 to-zinc-900/60 bg-[length:200%_100%]",
        className,
      )}
    />
  );
}

/**
 * Skeleton compõe pré-feita pra uma lista de cards (agenda, refeições, etc).
 */
export function SkeletonAgendaList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-start gap-4 rounded-sm border border-zinc-800 bg-[rgba(14,14,17,0.6)] p-4"
        >
          <Skeleton className="h-12 w-12 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-2 w-1/3" />
          </div>
          <Skeleton className="h-8 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}
