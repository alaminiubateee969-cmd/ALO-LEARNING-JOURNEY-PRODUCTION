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
    published: { c: "bg-emerald-100 text-emerald-700", label: "Published" },
    queued: { c: "bg-amber-100 text-amber-700", label: "Queued" },
    active: { c: "bg-emerald-100 text-emerald-700", label: "Active" },
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
      title={fallback ? "Local fallback used — no paid model ran" : "Live model"}
    >
      {fallback ? "fallback" : provider}
    </span>
  );
}
