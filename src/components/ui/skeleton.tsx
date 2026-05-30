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
