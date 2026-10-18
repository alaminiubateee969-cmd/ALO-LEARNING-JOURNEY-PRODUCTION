"use client";

import { Loader2 } from "lucide-react";
import type { QualityAgentPass } from "@/lib/ai";

/**
 * Loading state for the existing single-request content generator. This is not
 * an agent pipeline and deliberately does not animate unexecuted stages.
 */
export default function PipelineRunner({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-border/60 bg-muted/30 p-4"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
        Single content-draft request in progress
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        The configured model or local template is used; no per-agent stages or independent review run here.
      </p>
    </div>
  );
}

const passStatusLabel: Record<QualityAgentPass["status"], string> = {
  complete: "Prompt returned data",
  fallback: "Fallback / incomplete",
  skipped: "Not run",
};

export function QualityPipelineSummary({ passes }: { passes: QualityAgentPass[] }) {
  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
      <h4 className="text-xs font-semibold">Local prompt trace · not independent review</h4>
      <p className="mt-1 text-[11px] leading-relaxed">
        These stages are separate prompts to the same configured local model, not independent agents. They do not verify facts, safety, quality, legal compliance, or consent; human review remains required.
      </p>
      <ul className="mt-2 space-y-2">
        {passes.map((pass) => (
          <li key={pass.agentId} className="rounded border border-amber-300/70 bg-white/50 p-2 dark:bg-black/10">
            <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
              <span className="font-medium">{pass.role}</span>
              <span>{passStatusLabel[pass.status]} · {pass.provider} · {Math.max(0, Math.round(pass.latencyMs))}ms</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed">{pass.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
