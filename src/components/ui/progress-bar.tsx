import { cn } from "@/lib/utils";

// Legacy ProgressBar — delegates to the redesign rx-pbar for a consistent
// amber accent bar across all pages that still import ProgressBar.
export function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("rx-pbar", className)}>
      <div style={{ width: `${clamped}%` }} />
    </div>
  );
}
