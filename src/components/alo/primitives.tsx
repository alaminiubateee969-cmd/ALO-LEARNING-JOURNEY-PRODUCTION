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
      title={fallback ? "Deterministic local fallback used; no model response was returned" : `Configured local provider: ${provider}`}
    >
      {fallback ? "fallback" : provider}
    </span>
  );
}

/**
 * Archify "Evidence Console" Toolbar Button & Semantic Beacon
 * Inspired by tt-a1i/archify DESIGN.md (canvas #020617, mask #0F172A, semantic beacons).
 */
export function ArchifyToolbarButton({
  label,
  beacon,
  role = "frontend",
  active = false,
  onClick,
  icon,
}: {
  label: string;
  beacon?: string;
  role?: "frontend" | "backend" | "database" | "cloud" | "security";
  active?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
}) {
  const roleColors: Record<string, string> = {
    frontend: "text-[#22D3EE] border-[#22D3EE]/40",
    backend: "text-[#34D399] border-[#34D399]/40",
    database: "text-[#A78BFA] border-[#A78BFA]/40",
    cloud: "text-[#FBBF24] border-[#FBBF24]/40",
    security: "text-[#FB7185] border-[#FB7185]/40",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 py-1.5 font-mono text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400",
        active
          ? "border-[#22D3EE] bg-[#0F172A] text-white shadow-sm"
          : "border-[#1E293B] bg-[#0F172A]/95 text-[#F8FAFC] hover:border-[#334155]"
      )}
    >
      {icon}
      <span>{label}</span>
      {beacon && (
        <span
          className={cn(
            "inline-flex items-center rounded-full border bg-[#020617] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
            roleColors[role]
          )}
        >
          {beacon}
        </span>
      )}
    </button>
  );
}

/**
 * Editorial Tactile Button (cathrynlavery/diagram-design style-guide.md)
 * Uses paper #f5f5f5, ink #2d3142, and WCAG-verified burnt-tangerine #bf4520 (4.71:1).
 */
export function EditorialButton({
  children,
  variant = "accent",
  tag,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  variant?: "accent" | "paper" | "link";
  tag?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const styles: Record<string, string> = {
    accent: "border-[#bf4520] bg-[#bf4520] text-white hover:bg-[#a63b1b]",
    paper: "border-[#2d3142] bg-[#f5f5f5] text-[#2d3142] hover:bg-[#ececec]",
    link: "border-[#2e5aa8] bg-[#f5f5f5] text-[#2e5aa8] hover:bg-[#e8eef8]",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-[6px] border px-3.5 text-xs font-semibold transition-colors disabled:opacity-50",
        styles[variant]
      )}
    >
      {tag && (
        <span className="rounded-[2px] border border-current/40 px-1 py-0.5 font-mono text-[9px] uppercase leading-none">
          {tag}
        </span>
      )}
      {children}
    </button>
  );
}

/**
 * Segmented View Switcher (inspired by Twenty CRM, Frappe CRM, NextStep-Abroad & Bricks)
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel = "View switcher",
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ id: T; label: string; icon?: React.ReactNode; count?: number }>;
  ariaLabel?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-muted/40 p-1"
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-all",
              active
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.icon}
            <span>{opt.label}</span>
            {typeof opt.count === "number" && (
              <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] tabular-nums">
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Omarchy / Command-First Hotkey Button
 */
export function HotkeyButton({
  label,
  hotkey,
  onClick,
  icon,
}: {
  label: string;
  hotkey: string;
  onClick?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-2 rounded-md border border-border/80 bg-card px-3 text-xs font-medium text-foreground shadow-2xs transition-colors hover:border-amber-500/60 hover:bg-amber-500/5"
    >
      {icon}
      <span>{label}</span>
      <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
        {hotkey}
      </kbd>
    </button>
  );
}
