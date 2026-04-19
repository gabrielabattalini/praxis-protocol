"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function RxPanel({
  children,
  hot = false,
  className,
  ...rest
}: {
  children: ReactNode;
  hot?: boolean;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(hot ? "rx-panel-hot" : "rx-panel", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function RxLabel({
  children,
  arrow = true,
  className,
}: {
  children: ReactNode;
  arrow?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rx-label", className)}>
      {arrow ? "▸ " : null}
      {children}
    </div>
  );
}

type RxChipProps = {
  children: ReactNode;
  active?: boolean;
  className?: string;
} & (
  | ({ as?: "span" } & React.HTMLAttributes<HTMLSpanElement>)
  | ({ as: "button" } & React.ButtonHTMLAttributes<HTMLButtonElement>)
);

export function RxChip(props: RxChipProps) {
  const { children, active = false, className, as = "span", ...rest } = props;
  const classes = cn(active ? "rx-chip-accent" : "rx-chip-mono", className);
  if (as === "button") {
    return (
      <button
        type="button"
        className={classes}
        {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    );
  }
  return (
    <span
      className={classes}
      {...(rest as React.HTMLAttributes<HTMLSpanElement>)}
    >
      {children}
    </span>
  );
}

export function RxPBar({ value, className }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("rx-pbar", className)}>
      <div style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function Avatar({
  initials,
  size = 56,
  tier = "GOLD",
  online = true,
}: {
  initials: string;
  size?: number;
  tier?: string;
  online?: boolean;
}) {
  const tierColor: Record<string, string> = {
    BRONZE: "#cd7f32",
    SILVER: "#d4d4d8",
    GOLD: "#facc15",
    PLATINUM: "#a7f3d0",
    DIAMOND: "#93c5fd",
    MASTER: "#c084fc",
    LEGEND: "#fb923c",
  };
  const color = tierColor[tier.toUpperCase()] ?? "#facc15";
  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        border: `1px solid ${color}`,
        background:
          "linear-gradient(135deg, rgba(251,146,60,0.18), rgba(251,146,60,0.02))",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        borderRadius: 2,
      }}
    >
      <span
        className="rx-display"
        style={{
          fontSize: Math.round(size * 0.42),
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "var(--fg)",
        }}
      >
        {initials}
      </span>
      {online ? (
        <span
          style={{
            position: "absolute",
            right: -3,
            bottom: -3,
            width: 10,
            height: 10,
            borderRadius: 999,
            background: "var(--ok)",
            boxShadow: "0 0 8px rgba(74,222,128,0.7)",
            border: "1px solid var(--bg)",
          }}
        />
      ) : null}
    </div>
  );
}

export function RankChip({ tier }: { tier: string }) {
  return (
    <span
      className="rx-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 8px",
        fontSize: 10,
        letterSpacing: "0.2em",
        fontWeight: 700,
        color: "#facc15",
        border: "1px solid rgba(250,204,21,0.5)",
        background: "rgba(250,204,21,0.08)",
        boxShadow: "0 0 10px rgba(250,204,21,0.15)",
        borderRadius: 2,
        textTransform: "uppercase",
      }}
    >
      ◆ {tier}
    </span>
  );
}

export function Streak({ days }: { days: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 2,
      }}
    >
      <div
        className="rx-display"
        style={{
          fontSize: 28,
          fontWeight: 700,
          lineHeight: 1,
          color: "var(--accent)",
          textShadow: "0 0 18px rgba(251,146,60,0.45)",
          letterSpacing: "-0.02em",
        }}
      >
        {days}
      </div>
      <div
        className="rx-mono"
        style={{
          fontSize: 9,
          letterSpacing: "0.22em",
          color: "var(--fg-3)",
          textTransform: "uppercase",
        }}
      >
        DIAS · STREAK
      </div>
    </div>
  );
}

export function XPBar({ value, level }: { value: number; level: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 6,
        }}
      >
        <div
          className="rx-mono"
          style={{
            fontSize: 10,
            color: "var(--fg-3)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          NÍVEL {level}
        </div>
        <div
          className="rx-mono"
          style={{
            fontSize: 10,
            color: "var(--accent)",
            letterSpacing: "0.18em",
          }}
        >
          {clamped}% → {level + 1}
        </div>
      </div>
      <RxPBar value={clamped} />
    </div>
  );
}

export function MiniStat({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string;
  Icon?: LucideIcon;
}) {
  return (
    <div
      style={{
        padding: 12,
        border: "1px solid var(--line)",
        background: "rgba(0,0,0,0.3)",
        borderRadius: 2,
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div
          className="rx-mono"
          style={{
            fontSize: 9,
            letterSpacing: "0.2em",
            color: "var(--fg-3)",
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
        {Icon ? (
          <Icon className="h-3 w-3" style={{ color: "var(--fg-4)" }} />
        ) : null}
      </div>
      <div
        className="rx-display"
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: "var(--fg)",
          marginTop: 6,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function ModuleTile({
  name,
  stat,
  Icon,
  hot = false,
  href,
}: {
  name: string;
  stat: string;
  Icon: LucideIcon;
  hot?: boolean;
  href?: string;
}) {
  const body = (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <Icon
          className="h-3.5 w-3.5"
          style={{ color: hot ? "var(--accent)" : "var(--fg-3)" }}
        />
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: hot ? "var(--accent)" : "var(--fg-2)",
          }}
        >
          {name}
        </div>
      </div>
      <div
        className="rx-mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.14em",
          color: "var(--fg-4)",
          textTransform: "uppercase",
        }}
      >
        {stat}
      </div>
    </>
  );
  const style: React.CSSProperties = {
    padding: 12,
    border: `1px solid ${hot ? "rgba(251,146,60,0.4)" : "var(--line)"}`,
    background: hot ? "rgba(251,146,60,0.05)" : "rgba(0,0,0,0.3)",
    borderRadius: 2,
    display: "block",
    transition: "border-color 120ms ease, background 120ms ease",
  };
  if (href) {
    return (
      <a href={href} style={style} className="rx-module-tile">
        {body}
      </a>
    );
  }
  return <div style={style}>{body}</div>;
}

export function MissionCard({
  moduleLabel,
  title,
  meta,
  xp,
  difficulty,
  state,
  href,
}: {
  moduleLabel: string;
  title: string;
  meta: string;
  xp: string;
  difficulty?: number;
  state: "pending" | "done" | "overdue";
  href?: string;
}) {
  const stateColor =
    state === "done"
      ? "var(--ok)"
      : state === "overdue"
        ? "var(--danger)"
        : "var(--accent)";
  const Wrapper: "a" | "div" = href ? "a" : "div";
  const wrapperProps = href
    ? { href, className: "rx-panel rx-mission-card" }
    : { className: "rx-panel" };
  return (
    <Wrapper
      {...(wrapperProps as Record<string, unknown>)}
      style={{
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        position: "relative",
        borderLeft: `2px solid ${stateColor}`,
        minHeight: 140,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          className="rx-mono"
          style={{
            fontSize: 9,
            letterSpacing: "0.22em",
            color: "var(--accent)",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          ▸ {moduleLabel}
        </span>
        <span
          className="rx-mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.12em",
            color: "var(--accent)",
            fontWeight: 700,
          }}
        >
          {xp}
        </span>
      </div>
      <div
        className="rx-display"
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "var(--fg)",
          lineHeight: 1.2,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--fg-3)",
        }}
      >
        {meta}
      </div>
      {typeof difficulty === "number" ? (
        <div
          style={{
            display: "flex",
            gap: 3,
            marginTop: "auto",
          }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 18,
                height: 3,
                background:
                  i < difficulty ? "var(--accent)" : "var(--line-soft)",
                borderRadius: 1,
              }}
            />
          ))}
        </div>
      ) : null}
    </Wrapper>
  );
}
