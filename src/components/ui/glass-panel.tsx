import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

// Legacy GlassPanel — delegates to the redesign rx-panel. Keeps the same API
// (children + className) so every consumer inherits the new matte-black +
// amber-accent panel without touching call sites.
export function GlassPanel({
  children,
  className,
  id,
  style,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  style?: CSSProperties;
}) {
  return (
    <section
      id={id}
      className={cn("rx-panel relative", className)}
      style={{ padding: 20, ...style }}
    >
      {children}
    </section>
  );
}
