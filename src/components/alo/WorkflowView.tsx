"use client";

import { useState } from "react";
import { SectionHeader } from "./primitives";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AGENTS, AGENT_CATEGORIES, type AgentCategory } from "@/lib/agents";
import { Workflow, ArrowRight, ZoomIn, ZoomOut, Maximize2, Layers } from "lucide-react";

// Pipeline stages — each stage is a group of agents that run together
const PIPELINE_STAGES: {
  id: string;
  label: string;
  bn: string;
  icon: string;
  category: AgentCategory;
  description: string;
}[] = [
  { id: "stage-1", label: "Trend Research", bn: "গবেষণা", icon: "🔍", category: "research", description: "TrendResearchAgent ও TopicIdeationAgent ট্রেন্ডিং ও নিরাপদ টপিক খুঁজে বের করে।" },
  { id: "stage-2", label: "RAG Retrieval", bn: "জ্ঞান", icon: "📚", category: "research", description: "RAGMemoryAgent কোম্পানি-প্রাইভেট জ্ঞান থেকে প্রাসঙ্গিক তথ্য সংগ্রহ করে।" },
  { id: "stage-3", label: "Content Writing", bn: "লেখা", icon: "✍️", category: "content", description: "ContentWriterAgent + HookOptimizerAgent স্ক্রিপ্ট ও হুক তৈরি করে।" },
  { id: "stage-4", label: "SEO & Captions", bn: "SEO", icon: "🏷️", category: "content", description: "SEOAgent, CaptionAgent, HashtagAgent প্ল্যাটফর্ম-নির্দিষ্ট কনটেন্ট তৈরি করে।" },
  { id: "stage-5", label: "Media Generation", bn: "মিডিয়া", icon: "🎨", category: "media", description: "ImagePromptAgent, ImageGeneratorAgent, VoiceAgent মিডিয়া তৈরি করে।" },
  { id: "stage-6", label: "Protective Mode", bn: "নিরাপত্তা", icon: "🛡️", category: "safety", description: "SafetyGuardianAgent + FactCheckAgent নিরাপত্তা যাচাই করে।" },
  { id: "stage-7", label: "Quality Review", bn: "মান", icon: "⭐", category: "safety", description: "QualityCriticAgent কোয়ালিটি স্কোর দেয়।" },
  { id: "stage-8", label: "Approval", bn: "অনুমোদন", icon: "📋", category: "ops", description: "ApprovalPreparerAgent অ্যাডমিনের জন্য প্যাকেজ তৈরি করে।" },
  { id: "stage-9", label: "Publishing", bn: "প্রকাশনা", icon: "📤", category: "publishing", description: "PublisherAgent অনুমোদিত কনটেন্ট প্রকাশ করে।" },
  { id: "stage-10", label: "Analytics & Learning", bn: "শেখা", icon: "📈", category: "learning", description: "AnalyticsAgent + WeeklyLearningAgent পারফরম্যান্স বিশ্লেষণ করে।" },
];

const catColor: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  orchestration: { bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-300", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-400" },
  research: { bg: "bg-sky-50 dark:bg-sky-900/20", border: "border-sky-300", text: "text-sky-700 dark:text-sky-300", dot: "bg-sky-400" },
  content: { bg: "bg-violet-50 dark:bg-violet-900/20", border: "border-violet-300", text: "text-violet-700 dark:text-violet-300", dot: "bg-violet-400" },
  safety: { bg: "bg-rose-50 dark:bg-rose-900/20", border: "border-rose-300", text: "text-rose-700 dark:text-rose-300", dot: "bg-rose-400" },
  media: { bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-300", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-400" },
  publishing: { bg: "bg-cyan-50 dark:bg-cyan-900/20", border: "border-cyan-300", text: "text-cyan-700 dark:text-cyan-300", dot: "bg-cyan-400" },
  community: { bg: "bg-pink-50 dark:bg-pink-900/20", border: "border-pink-300", text: "text-pink-700 dark:text-pink-300", dot: "bg-pink-400" },
  learning: { bg: "bg-indigo-50 dark:bg-indigo-900/20", border: "border-indigo-300", text: "text-indigo-700 dark:text-indigo-300", dot: "bg-indigo-400" },
  ops: { bg: "bg-slate-50 dark:bg-slate-900/20", border: "border-slate-300", text: "text-slate-700 dark:text-slate-300", dot: "bg-slate-400" },
};

const catLabel: Record<string, string> = {
  orchestration: "অর্কেস্ট্রেশন",
  research: "গবেষণা",
  content: "কনটেন্ট",
  safety: "নিরাপত্তা",
  media: "মিডিয়া",
  publishing: "প্রকাশনা",
  community: "কমিউনিটি",
  learning: "শেখা",
  ops: "পরিচালনা",
};

export default function WorkflowView() {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const stageAgents = (cat: AgentCategory) => AGENTS.filter((a) => a.category === cat);

  return (
    <div className="alo-fade-up space-y-5">
      <SectionHeader
        title="Agent Workflow"
        bn="এজেন্ট ওয়ার্কফ্লো"
        desc="৪০টি এজেন্ট কীভাবে সংযুক্ত — MasterOrchestratorAgent পাইপলাইন পরিচালনা করে। প্রতিটি ধাপে কোন এজেন্টগুলো কাজ করে দেখুন।"
        icon={<Workflow className="h-5 w-5" />}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}>
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}>
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setZoom(1)}>
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
      />

      {/* Pipeline flow diagram */}
      <Card className="p-4 sm:p-6 overflow-x-auto alo-scrollbar">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="h-4 w-4 text-amber-600" />
          <h3 className="font-semibold text-sm">কনটেন্ট পাইপলাইন ফ্লো</h3>
          <Badge variant="outline" className="text-[9px]">১০ ধাপ</Badge>
        </div>
        <div className="flex items-stretch gap-1 min-w-max" style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}>
          {PIPELINE_STAGES.map((stage, i) => {
            const c = catColor[stage.category];
            const agents = stageAgents(stage.category);
            const isSelected = selectedStage === stage.id;
            return (
              <div key={stage.id} className="flex items-stretch">
                <div
                  onClick={() => setSelectedStage(isSelected ? null : stage.id)}
                  className={`rounded-xl border-2 p-3 cursor-pointer transition-all min-w-[140px] w-[160px] ${c.bg} ${c.border} ${
                    isSelected ? "ring-2 ring-offset-2 ring-amber-400 scale-105 shadow-lg" : "hover:shadow-md hover:scale-[1.02]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{stage.icon}</span>
                    <span className="text-[9px] font-bold rounded-full bg-white/60 dark:bg-white/10 px-1.5 py-0.5">{i + 1}</span>
                  </div>
                  <p className={`text-xs font-bold ${c.text}`}>{stage.label}</p>
                  <p className="text-[10px] text-muted-foreground mb-2">{stage.bn}</p>
                  <div className="space-y-0.5">
                    {agents.slice(0, 4).map((a) => (
                      <div key={a.id} className="text-[8px] truncate flex items-center gap-0.5">
                        <span className={`h-1 w-1 rounded-full ${c.dot}`} />
                        {a.name.replace("Agent", "")}
                      </div>
                    ))}
                    {agents.length > 4 && (
                      <div className="text-[8px] text-muted-foreground">+{agents.length - 4} আরও</div>
                    )}
                  </div>
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <div className="flex items-center px-1">
                    <div className="alo-flow h-0.5 w-6 rounded-full" />
                    <ArrowRight className="h-3 w-3 text-amber-500 -ml-1" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Selected stage detail */}
      {selectedStage && (
        <Card className="p-5 alo-fade-up">
          {(() => {
            const stage = PIPELINE_STAGES.find((s) => s.id === selectedStage)!;
            const agents = stageAgents(stage.category);
            const c = catColor[stage.category];
            return (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{stage.icon}</span>
                  <div>
                    <h3 className={`font-bold ${c.text}`}>{stage.label} <span className="text-muted-foreground font-normal">/ {stage.bn}</span></h3>
                    <p className="text-xs text-muted-foreground">{stage.description}</p>
                  </div>
                  <Badge className={`ml-auto ${c.bg} ${c.border} ${c.text} border`} variant="outline">
                    {agents.length} এজেন্ট
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {agents.map((a, i) => (
                    <div
                      key={a.id}
                      className={`rounded-lg border p-3 alo-stagger ${c.bg} ${c.border}`}
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className={`text-xs font-bold ${c.text}`}>{a.name}</p>
                        <span className={`h-2 w-2 rounded-full ${c.dot} ${a.status === "active" ? "alo-pulse" : "opacity-40"}`} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mb-1.5">{a.role}</p>
                      <div className="flex flex-wrap gap-1">
                        {a.tools.slice(0, 3).map((t) => (
                          <Badge key={t} variant="outline" className="text-[8px] font-mono">{t}</Badge>
                        ))}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                        <span className="text-[9px] text-muted-foreground">{a.provider}</span>
                        <span className="text-[9px] font-medium">${a.estimatedCostUsd.toFixed(4)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </Card>
      )}

      {/* Category summary */}
      <Card className="p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4 text-amber-600" /> ক্যাটাগরি সারাংশ
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
          {AGENT_CATEGORIES.map((cat) => {
            const count = AGENTS.filter((a) => a.category === cat.id).length;
            const c = catColor[cat.id];
            return (
              <div
                key={cat.id}
                className={`rounded-lg border p-2 text-center ${c.bg} ${c.border} alo-stagger`}
              >
                <div className={`h-2 w-2 rounded-full ${c.dot} mx-auto mb-1`} />
                <p className={`text-[10px] font-bold ${c.text}`}>{catLabel[cat.id] ?? cat.label}</p>
                <p className="text-lg font-bold">{count}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Operating principle */}
      <Card className="p-5 alo-card-grad border-0">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Workflow className="h-4 w-4 text-amber-600" /> পরিচালনা নীতি
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {[
            "Own AI তৈরি করে",
            "RAG জ্ঞান দেয়",
            "Protective Mode যাচাই করে",
            "Quality Agent উন্নত করে",
            "Admin অনুমোদন দেয়",
            "Official API প্রকাশ করে",
            "Analytics সংগ্রহ করে",
            "Self-Learning সুপারিশ করে",
          ].map((step, i, arr) => (
            <div key={step} className="flex items-center gap-2">
              <span className="rounded-lg bg-white/60 dark:bg-white/10 px-2.5 py-1 text-xs font-medium">
                {i + 1}. {step}
              </span>
              {i < arr.length - 1 && <ArrowRight className="h-3 w-3 text-amber-500 shrink-0" />}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Admin সবসময় নিয়ন্ত্রণে থাকেন। কোনো কনটেন্ট অনুমোদন ছাড়া প্রকাশিত হয় না।
        </p>
      </Card>
    </div>
  );
}
