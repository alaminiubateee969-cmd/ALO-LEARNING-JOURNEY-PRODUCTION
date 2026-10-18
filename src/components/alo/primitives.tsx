"use client";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { useCountUp, formatNumber } from "./useCountUp";

function AnimatedValue({ value }: { value: number }) {
  const n = useCountUp(value);
  return <span className="alo-count">{formatNumber(n)}</span>;
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "amber",
  className,
  animate = true,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "amber" | "rose" | "emerald" | "sky" | "violet" | "slate";
  className?: string;
  animate?: boolean;
}) {
  const tones: Record<string, string> = {
    amber: "from-amber-500/15 to-amber-500/5 text-amber-700 dark:text-amber-300",
    rose: "from-rose-500/15 to-rose-500/5 text-rose-700 dark:text-rose-300",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    sky: "from-sky-500/15 to-sky-500/5 text-sky-700 dark:text-sky-300",
    violet: "from-violet-500/15 to-violet-500/5 text-violet-700 dark:text-violet-300",
    slate: "from-slate-500/15 to-slate-500/5 text-slate-700 dark:text-slate-300",
  };
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-0 bg-gradient-to-br shadow-sm hover:shadow-md transition-shadow p-4",
        tones[tone],
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide opacity-70 truncate">
            {label}
          </p>
          <p className="text-2xl font-bold mt-1 text-foreground tabular-nums">
            {animate && typeof value === "number" ? <AnimatedValue value={value} /> : value}
          </p>
          {sub && <p className="text-[11px] mt-0.5 opacity-70 truncate">{sub}</p>}
        </div>
        {icon && (
          <div className="shrink-0 rounded-xl bg-white/60 dark:bg-white/10 p-2">
            {icon}
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute -right-6 -bottom-6 h-20 w-20 rounded-full bg-current opacity-10" />
    </Card>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { c: string; label: string }> = {
    connected: { c: "bg-emerald-100 text-emerald-700", label: "Connected" },
    not_connected: { c: "bg-slate-100 text-slate-600", label: "Not connected" },
    external_setup_required: { c: "bg-amber-100 text-amber-700", label: "External setup" },
    expired: { c: "bg-rose-100 text-rose-700", label: "Expired" },
    revoked: { c: "bg-rose-100 text-rose-700", label: "Revoked" },
    failed: { c: "bg-rose-100 text-rose-700", label: "Failed" },
    pending: { c: "bg-amber-100 text-amber-700", label: "Pending" },
    approved: { c: "bg-emerald-100 text-emerald-700", label: "Approved" },
    rejected: { c: "bg-rose-100 text-rose-700", label: "Rejected" },
    revised: { c: "bg-sky-100 text-sky-700", label: "Revised" },
    published: { c: "bg-emerald-100 text-emerald-700", label: "Marked published" },
    queued: { c: "bg-amber-100 text-amber-700", label: "Queued" },
    active: { c: "bg-emerald-100 text-emerald-700", label: "Active" },
    configured: { c: "bg-slate-100 text-slate-600", label: "Catalog entry" },
    unverified: { c: "bg-amber-100 text-amber-700", label: "Unverified" },
    idle: { c: "bg-slate-100 text-slate-600", label: "Idle" },
    running: { c: "bg-sky-100 text-sky-700", label: "Running" },
    blocked_external_setup: { c: "bg-amber-100 text-amber-700", label: "Blocked · external" },
    error: { c: "bg-rose-100 text-rose-700", label: "Error" },
    safe: { c: "bg-emerald-100 text-emerald-700", label: "Safe" },
    needs_revision: { c: "bg-amber-100 text-amber-700", label: "Needs revision" },
    blocked: { c: "bg-rose-100 text-rose-700", label: "Blocked" },
    new: { c: "bg-sky-100 text-sky-700", label: "New" },
    classified: { c: "bg-violet-100 text-violet-700", label: "Classified" },
    escalated: { c: "bg-rose-100 text-rose-700", label: "Escalated" },
    ignored: { c: "bg-slate-100 text-slate-600", label: "Ignored" },
  };
  const s = map[status] ?? { c: "bg-slate-100 text-slate-600", label: status };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", s.c)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current alo-pulse" />
      {s.label}
    </span>
  );
}

export function SectionHeader({
  title, bn, desc, icon, action,
}: {
  title: string; bn?: string; desc?: string; icon?: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="rounded-2xl bg-gradient-to-br from-amber-400/20 to-rose-400/20 p-2.5 text-amber-600 alo-glow">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            {title} {bn && <span className="alo-text-grad">{bn}</span>}
          </h1>
          {desc && <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">{desc}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function ProviderTag({ provider, fallback }: { provider: string; fallback?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        fallback ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
      )}
      title={fallback ? "Local fallback used — no paid model ran" : "Configured model response; no quality certification implied"}
    >
      {fallback ? "fallback" : provider}
    </span>
  );
}

type SegmentOption<T extends string> = {
  id: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
};

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel = "Choose view",
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  ariaLabel?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1">
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.id)}
            className={cn(
              "inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
            )}
          >
            {option.icon}
            <span>{option.label}</span>
            {typeof option.count === "number" && <span className="text-[10px] opacity-70">{option.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

const beaconColors: Record<string, string> = {
  frontend: "bg-cyan-300 text-slate-950",
  backend: "bg-emerald-300 text-slate-950",
  database: "bg-violet-300 text-slate-950",
  cloud: "bg-amber-300 text-slate-950",
  security: "bg-rose-300 text-slate-950",
};

export function ArchifyToolbarButton({
  label,
  beacon,
  role,
  active = false,
  onClick,
}: {
  label: string;
  beacon: string;
  role: keyof typeof beaconColors;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-xs transition-colors",
        active ? "border-slate-500 bg-slate-800 text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
      )}
    >
      <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold", beaconColors[role])}>{beacon}</span>
      {label}
    </button>
  );
}

export function EditorialButton({
  children,
  variant = "paper",
  tag,
  onClick,
}: {
  children: React.ReactNode;
  variant?: "accent" | "paper" | "link";
  tag?: string;
  onClick?: () => void;
}) {
  const variantClass = {
    accent: "border-[#bf4520] bg-[#bf4520] text-white hover:bg-[#a83b1c]",
    paper: "border-[#2d3142]/40 bg-white text-[#2d3142] hover:bg-[#f5f5f5]",
    link: "border-transparent bg-transparent text-[#2d3142] underline underline-offset-4 hover:bg-black/5",
  }[variant];
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex min-h-9 items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold", variantClass)}>
      {tag && <span className="rounded-sm border border-current/30 px-1 py-0.5 font-mono text-[9px] uppercase tracking-wide">{tag}</span>}
      {children}
    </button>
  );
}

export function HotkeyButton({
  label,
  hotkey,
  onClick,
}: {
  label: string;
  hotkey: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
    >
      <span>{label}</span>
      <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{hotkey}</kbd>
    </button>
  );
}
