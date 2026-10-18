"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Circle } from "lucide-react";

export interface PipelineStep {
  agent: string;
  label: string;
  emoji: string;
}

export const PIPELINE_STEPS: PipelineStep[] = [
  { agent: "TrendResearchAgent", label: "Trend research", emoji: "🔍" },
  { agent: "RAGMemoryAgent", label: "RAG retrieval", emoji: "📚" },
  { agent: "ContentWriterAgent", label: "Script writing", emoji: "✍️" },
  { agent: "HookOptimizerAgent", label: "Hook crafting", emoji: "🎯" },
  { agent: "SEOAgent", label: "SEO keywords", emoji: "🏷️" },
  { agent: "CaptionAgent", label: "Captions", emoji: "📝" },
  { agent: "HashtagAgent", label: "Hashtags", emoji: "#️⃣" },
  { agent: "ImagePromptAgent", label: "Image prompt", emoji: "🎨" },
  { agent: "VoiceAgent", label: "Voice direction", emoji: "🎙️" },
  { agent: "SafetyGuardianAgent", label: "Protective Mode", emoji: "🛡️" },
  { agent: "QualityCriticAgent", label: "Quality scoring", emoji: "⭐" },
];

type StepState = "pending" | "running" | "done";

export default function PipelineRunner({ active }: { active: boolean }) {
  // When active, animate steps running one-by-one. When idle, show all pending.
  const [states, setStates] = useState<StepState[]>(
    PIPELINE_STEPS.map(() => "pending")
  );

  useEffect(() => {
    if (!active) {
      setStates(PIPELINE_STEPS.map(() => "pending"));
      return;
    }
    setStates(PIPELINE_STEPS.map(() => "pending"));
    let i = 0;
    const interval = setInterval(() => {
      setStates((prev) => {
        const next = [...prev];
        if (i > 0) next[i - 1] = "done";
        if (i < next.length) next[i] = "running";
        return next;
      });
      i++;
      if (i > PIPELINE_STEPS.length) {
        clearInterval(interval);
        setStates(PIPELINE_STEPS.map(() => "done"));
      }
    }, 280);
    return () => clearInterval(interval);
  }, [active]);

  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold flex items-center gap-1.5">
          <span className="text-sm">⚙️</span> Agent Pipeline
          {active && (
            <span className="text-[10px] text-amber-600 font-normal alo-pulse">
              চলছে…
            </span>
          )}
        </p>
        <span className="text-[10px] text-muted-foreground">
          {states.filter((s) => s === "done").length}/{PIPELINE_STEPS.length}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {PIPELINE_STEPS.map((step, i) => {
          const st = states[i];
          return (
            <div
              key={step.agent}
              className={`rounded-lg p-2 border text-[11px] transition-all duration-300 ${
                st === "done"
                  ? "border-emerald-200 bg-emerald-50/60"
                  : st === "running"
                  ? "border-amber-300 bg-amber-50/70 alo-glow"
                  : "border-border/50 bg-background/60 opacity-60"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{step.emoji}</span>
                <span className="font-medium truncate flex-1">{step.label}</span>
                {st === "done" ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                ) : st === "running" ? (
                  <Loader2 className="h-3 w-3 text-amber-600 shrink-0 animate-spin" />
                ) : (
                  <Circle className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                )}
              </div>
              <p className="text-[9px] text-muted-foreground mt-0.5 truncate">
                {step.agent}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
