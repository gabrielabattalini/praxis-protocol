"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/legal-analysis/utils";

export function SectionCard({
  title,
  description,
  children,
  className,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-slate-200/70 bg-white/88 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.35)] backdrop-blur-xl",
        className,
      )}
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Fluxo guiado
          </p>
          <h2 className="font-title text-2xl text-slate-950">{title}</h2>
          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              {description}
            </p>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function FieldShell({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-800">{label}</span>
        {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
      </div>
      {children}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </label>
  );
}

function fieldClassName(className?: string) {
  return cn(
    "w-full rounded-2xl border border-slate-300/80 bg-white px-4 py-3 text-sm text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] transition focus:border-amber-500/80 focus:outline-none focus:ring-4 focus:ring-amber-500/10",
    className,
  );
}

export function TextInput(props: ComponentPropsWithoutRef<"input">) {
  return <input {...props} className={fieldClassName(props.className)} />;
}

export function TextArea(props: ComponentPropsWithoutRef<"textarea">) {
  return <textarea {...props} className={fieldClassName(props.className)} />;
}

export function SelectInput(props: ComponentPropsWithoutRef<"select">) {
  return <select {...props} className={fieldClassName(props.className)} />;
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-slate-200/80">
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,#9a6b2f_0%,#c9974d_55%,#f2dfb7_100%)] transition-all duration-500"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const palette = {
    neutral: "border-slate-300 bg-slate-100 text-slate-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-rose-200 bg-rose-50 text-rose-700",
    info: "border-sky-200 bg-sky-50 text-sky-700",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
        palette[tone],
      )}
    >
      {label}
    </span>
  );
}

export function AlertCard({
  title,
  description,
  tone = "info",
}: {
  title: string;
  description: string;
  tone?: "info" | "warning" | "danger" | "success";
}) {
  const palette = {
    info: "border-sky-200/80 bg-sky-50/90 text-sky-900",
    warning: "border-amber-200/80 bg-amber-50/90 text-amber-900",
    danger: "border-rose-200/80 bg-rose-50/90 text-rose-900",
    success: "border-emerald-200/80 bg-emerald-50/90 text-emerald-900",
  } as const;

  return (
    <div className={cn("rounded-2xl border p-4", palette[tone])}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-6 opacity-85">{description}</p>
    </div>
  );
}

export function MetricCard({
  eyebrow,
  value,
  caption,
}: {
  eyebrow: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.32)]">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {eyebrow}
      </p>
      <p className="mt-3 font-title text-3xl text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{caption}</p>
    </div>
  );
}

export function ActionButton({
  tone = "primary",
  className,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  tone?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const palette = {
    primary:
      "border-transparent bg-slate-950 text-white hover:bg-slate-800",
    secondary:
      "border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200",
    ghost:
      "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50",
    danger: "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100",
  } as const;

  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center rounded-2xl border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55",
        palette[tone],
        className,
      )}
    />
  );
}

export function ChoiceButton({
  active,
  children,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <button
      {...props}
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm font-semibold transition",
        active
          ? "border-slate-900 bg-slate-900 text-white shadow-[0_14px_30px_-18px_rgba(15,23,42,0.45)]"
          : "border-slate-300 bg-white text-slate-700 hover:border-amber-400 hover:text-slate-950",
        props.className,
      )}
    />
  );
}

export function BooleanChoice({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (nextValue: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <ChoiceButton active={value === true} onClick={() => onChange(true)} type="button">
        Sim
      </ChoiceButton>
      <ChoiceButton active={value === false} onClick={() => onChange(false)} type="button">
        Não
      </ChoiceButton>
    </div>
  );
}
