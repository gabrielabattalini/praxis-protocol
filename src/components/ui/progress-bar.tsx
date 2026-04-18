import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-2.5 w-full overflow-hidden rounded-[2px] border border-zinc-800 bg-black/70",
        className,
      )}
    >
      <div
        className="h-full rounded-[1px] bg-[linear-gradient(90deg,var(--accent)_0%,#f97316_100%)] shadow-[0_0_15px_rgba(251,146,60,0.35)] transition-all"
        style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
      />
    </div>
  );
}
