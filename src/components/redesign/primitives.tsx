"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";

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

// RxPageHeader — command-style header matching design's AppShell title/subtitle + actions
export function RxPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      style={{
        padding: "18px 0",
        borderBottom: "1px solid var(--line-soft)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
        marginBottom: 24,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <RxLabel>{title.toUpperCase()}</RxLabel>
        {subtitle ? (
          <div
            style={{
              fontSize: 13,
              color: "var(--fg-3)",
              marginTop: 4,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}

// RadarChart — 5-axis skill chart (Profile, Arena)
export function RadarChart({
  values,
  size = 180,
}: {
  values: Record<string, number>;
  size?: number;
}) {
  const keys = Object.keys(values);
  const n = keys.length;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;
  const pt = (i: number, v: number): [number, number] => {
    const angle = ((Math.PI * 2) / n) * i - Math.PI / 2;
    const rr = r * (v / 100);
    return [cx + Math.cos(angle) * rr, cy + Math.sin(angle) * rr];
  };
  const outer: [number, number][] = keys.map((_, i) => {
    const a = ((Math.PI * 2) / n) * i - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  const poly = keys
    .map((k, i) => pt(i, values[k]).join(","))
    .join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.25, 0.5, 0.75, 1].map((s) => (
        <polygon
          key={s}
          points={outer
            .map(([x, y]) => {
              const dx = x - cx;
              const dy = y - cy;
              return `${cx + dx * s},${cy + dy * s}`;
            })
            .join(" ")}
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
        />
      ))}
      {outer.map(([x, y], i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={x}
          y2={y}
          stroke="var(--line)"
          strokeWidth="1"
        />
      ))}
      <polygon
        points={poly}
        fill="var(--accent)"
        fillOpacity="0.15"
        stroke="var(--accent)"
        strokeWidth="1.5"
        style={{ filter: "drop-shadow(0 0 8px var(--accent-glow))" }}
      />
      {keys.map((k, i) => {
        const [x, y] = pt(i, values[k]);
        return <circle key={k} cx={x} cy={y} r="3" fill="var(--accent)" />;
      })}
      {keys.map((k, i) => {
        const a = ((Math.PI * 2) / n) * i - Math.PI / 2;
        const lx = cx + Math.cos(a) * (r + 16);
        const ly = cy + Math.sin(a) * (r + 16);
        return (
          <text
            key={`lbl-${k}`}
            x={lx}
            y={ly}
            fontSize="9"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--fg-3)"
            fontFamily="var(--rx-mono, ui-monospace, monospace)"
            letterSpacing="0.14em"
            style={{ textTransform: "uppercase" }}
          >
            {k.toUpperCase()}
          </text>
        );
      })}
    </svg>
  );
}

// KPIMini — right-aligned label/value divider (ModuleShell hero)
export function KPIMini({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        textAlign: "right",
        borderLeft: "1px solid var(--line)",
        paddingLeft: 12,
      }}
    >
      <div
        className="rx-mono"
        style={{
          fontSize: 9,
          color: "var(--fg-3)",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        className="rx-display"
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--fg)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// MacroDot — centered macro nutrient pill (NutritionBoard meals)
export function MacroDot({
  value,
  label,
  color = "var(--accent)",
}: {
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <div style={{ textAlign: "center", minWidth: 44 }}>
      <div
        className="rx-mono"
        style={{ fontSize: 11, color, fontWeight: 600 }}
      >
        {value}
      </div>
      <div
        className="rx-mono"
        style={{
          fontSize: 9,
          color: "var(--fg-4)",
          letterSpacing: "0.18em",
          marginTop: 2,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
}

// TaskRow — inline task row with checkbox + time + title + difficulty + xp
export function TaskRow({
  time,
  moduleLabel,
  title,
  meta,
  difficulty = 3,
  state,
  xp,
  onToggle,
  onClick,
}: {
  time: string;
  moduleLabel: string;
  title: string;
  meta?: string;
  difficulty?: number;
  state: "pending" | "done" | "overdue";
  xp: string;
  onToggle?: () => void;
  onClick?: () => void;
}) {
  const stateColor =
    state === "done"
      ? "var(--ok)"
      : state === "overdue"
        ? "var(--danger)"
        : "var(--accent)";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "28px 64px 1fr auto auto",
        gap: 14,
        padding: "12px 14px",
        alignItems: "center",
        border: "1px solid var(--line)",
        marginBottom: 4,
        background:
          state === "done" ? "rgba(0,0,0,0.3)" : "rgba(20,20,24,0.5)",
        opacity: state === "done" ? 0.65 : 1,
        cursor: onClick ? "pointer" : "default",
        borderRadius: 2,
      }}
      onClick={onClick}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle?.();
        }}
        style={{
          width: 18,
          height: 18,
          border: `1.5px solid ${stateColor}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: state === "done" ? stateColor : "transparent",
          padding: 0,
          cursor: "pointer",
          borderRadius: 2,
        }}
        aria-label="Toggle task"
      >
        {state === "done" ? <Check size={10} color="var(--bg)" /> : null}
      </button>
      <div
        className="rx-mono"
        style={{
          fontSize: 11,
          color: "var(--fg-3)",
          letterSpacing: "0.1em",
        }}
      >
        {time}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            color: "var(--fg)",
            textDecoration: state === "done" ? "line-through" : "none",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        <div
          className="rx-mono"
          style={{
            fontSize: 9,
            color: "var(--fg-4)",
            letterSpacing: "0.16em",
            marginTop: 2,
            textTransform: "uppercase",
          }}
        >
          {moduleLabel}
          {meta ? ` · ${meta}` : ""}
        </div>
      </div>
      <div style={{ display: "flex", gap: 2 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              background:
                i < difficulty ? "var(--accent)" : "var(--line-bright)",
              transform: "rotate(45deg)",
            }}
          />
        ))}
      </div>
      <div
        className="rx-mono"
        style={{
          fontSize: 11,
          color: "var(--accent)",
          fontWeight: 600,
          minWidth: 44,
          textAlign: "right",
        }}
      >
        {xp}
      </div>
    </div>
  );
}

// ModuleShell — hero + tabs wrapper for all module pages
export function ModuleShell({
  Icon,
  name,
  streak,
  completion,
  lastRecord,
  tabs,
  activeTab,
  onTabChange,
  hero,
  children,
}: {
  Icon: LucideIcon;
  name: string;
  streak: string;
  completion: string;
  lastRecord: string;
  tabs: string[];
  activeTab: string;
  onTabChange?: (tab: string) => void;
  hero?: { title?: string; desc?: string };
  children: ReactNode;
}) {
  return (
    <div>
      <div className="rx-panel-hot" style={{ padding: 20, marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid var(--accent)",
              background: "rgba(251,146,60,0.08)",
              color: "var(--accent)",
              borderRadius: 2,
              flexShrink: 0,
            }}
          >
            <Icon size={24} />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div
              className="rx-mono"
              style={{
                fontSize: 10,
                color: "var(--accent)",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              ▸ MÓDULO · {name.toUpperCase()}
            </div>
            <div
              className="rx-display"
              style={{
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                marginTop: 2,
                color: "var(--fg)",
              }}
            >
              {hero?.title ?? name}
            </div>
            {hero?.desc ? (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--fg-3)",
                  marginTop: 2,
                }}
              >
                {hero.desc}
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <KPIMini label="STREAK" value={streak} />
            <KPIMini label="CONCL." value={completion} />
            <KPIMini label="ÚLTIMO" value={lastRecord} />
          </div>
        </div>
      </div>
      {tabs.length > 0 ? (
        <div
          style={{
            display: "flex",
            gap: 0,
            borderBottom: "1px solid var(--line)",
            marginBottom: 18,
            overflowX: "auto",
          }}
        >
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTabChange?.(t)}
              style={{
                padding: "12px 18px",
                color: activeTab === t ? "var(--accent)" : "var(--fg-3)",
                borderBottom:
                  activeTab === t
                    ? "2px solid var(--accent)"
                    : "2px solid transparent",
                fontFamily: "var(--rx-mono, ui-monospace, monospace)",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                cursor: "pointer",
                background: "transparent",
                whiteSpace: "nowrap",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      ) : null}
      {children}
    </div>
  );
}
