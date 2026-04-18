import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlassPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "praxis-panel praxis-scanlines relative overflow-hidden rounded-sm p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]",
        className,
      )}
    >
      <div className="praxis-copy relative min-w-0">{children}</div>
    </section>
  );
}
