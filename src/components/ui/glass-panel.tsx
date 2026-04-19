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
        "praxis-panel relative overflow-hidden p-5 md:p-6",
        className,
      )}
    >
      <div className="praxis-copy relative min-w-0">{children}</div>
    </section>
  );
}
