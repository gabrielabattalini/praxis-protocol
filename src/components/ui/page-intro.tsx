import type { ReactNode } from "react";
import { RxPageHeader } from "@/components/redesign/primitives";

// Legacy PageIntro — delegates to the redesign RxPageHeader primitive. The
// eyebrow prop becomes part of the subtitle so every consumer inherits the
// new command-line-style header without touching call sites.
export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  const subtitle: ReactNode | undefined =
    eyebrow || description ? (
      <>
        {eyebrow ? (
          <span style={{ color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.2em", fontSize: 11, marginRight: 8 }}>
            {eyebrow}
          </span>
        ) : null}
        {description}
      </>
    ) : undefined;

  return <RxPageHeader title={title} subtitle={subtitle} actions={actions} />;
}
