import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "praxis-panel animate-rise relative overflow-hidden p-6 md:p-7",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[color:color-mix(in_srgb,var(--accent)_26%,transparent)]" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="praxis-copy relative min-w-0 max-w-3xl space-y-3">
          {eyebrow ? (
            <p className="praxis-label text-[var(--accent)]/80">
              {eyebrow}
            </p>
          ) : null}
          <div className="space-y-2">
            <h1 className="praxis-title text-3xl md:text-4xl">
              {title}
            </h1>
            {description ? (
              <p className="max-w-2xl text-sm leading-7 text-zinc-400 md:text-[0.96rem]">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="relative flex min-w-0 flex-wrap gap-3 lg:max-w-[45%] lg:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
