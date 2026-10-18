"use client";

import { useEffect, useState } from "react";
import { SectionHeader, StatCard, StatusPill } from "./primitives";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Cpu, Activity, RefreshCw, Play, AlertTriangle, CheckCircle2, TrendingUp, Layers } from "lucide-react";

interface LoopPhase {
  id: string; label: string; bn: string; icon: string;
}

interface LoopCycle {
  id: string; objective: string; phase: string; status: string;
  qualityScore: number; retryCount: number; costUsd: number;
  errorType: string | null; lesson: string | null;
  startedAt: string; completedAt: string | null;
}

interface WorkforceData {
  stats: {
    totalDepartments: number; totalAgents: number; totalEmployees: number;
    activeCycles: number; completedCycles: number; failedCycles: number;
  };
  departments: any[];
  byFamily: Record<string, { count: number; agents: number }>;
  families: { id: string; label: string; bn: string; icon: string }[];
  loopPhases: LoopPhase[];
  loopCycles: LoopCycle[];
  activeCycle: LoopCycle | null;
  coreAgents: number;
}

export default function LoopAIView() {
  const { toast } = useToast();
  const [data, setData] = useState<WorkforceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const load = () => {
    fetch("/api/workforce")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  const startLoop = async () => {
    setStarting(true);
    try {
      // Simulate starting a loop cycle — in production this would trigger
      // the real orchestration engine
      toast({ title: "LOOP AI সাইকেল শুরু 🔄", description: "Observe → Understand → Plan → ... → Learn" });
      setTimeout(() => { load(); setStarting(false); }, 2000);
    } finally {
      setStarting(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl alo-shimmer" />
        ))}
      </div>
    );
  }

  const s = data.stats;
  const phaseOrder = data.loopPhases.map((p) => p.id);
  const activePhaseIdx = data.activeCycle ? phaseOrder.indexOf(data.activeCycle.phase) : -1;

  return (
    <div className="alo-fade-up space-y-5">
      <SectionHeader
        title="Loop AI Command Center"
        bn="লুপ এআই কমান্ড সেন্টার"
        desc="২,০০০ AI এমপ্লয়ি ও ১০০ ডিপার্টমেন্ট পরিচালনাকারী অর্কেস্ট্রেশন ইন্টেলিজেন্স। প্রতিটি সাইকেল: Observe → Understand → Plan → ... → Learn → Repeat"
        icon={<Cpu className="h-5 w-5" />}
        action={
          <Button onClick={startLoop} disabled={starting} className="bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white">
            <Play className="h-4 w-4 mr-2" /> নতুন সাইকেল শুরু
          </Button>
        }
      />

      {/* Workforce stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="ডিপার্টমেন্ট" value={s.totalDepartments} sub="১০০ টার্গেট" icon={<Layers className="h-4 w-4" />} tone="amber" />
        <StatCard label="AI এমপ্লয়ি" value={s.totalAgents} sub="২,০০০ টার্গেট" icon={<Cpu className="h-4 w-4" />} tone="violet" />
        <StatCard label="কোর এজেন্ট" value={data.coreAgents} sub="স্ট্যাটিক রোস্টার" icon={<Cpu className="h-4 w-4" />} tone="emerald" />
        <StatCard label="সক্রিয় সাইকেল" value={s.activeCycles} sub="running" icon={<Activity className="h-4 w-4" />} tone="sky" />
        <StatCard label="সম্পন্ন" value={s.completedCycles} sub="completed" icon={<CheckCircle2 className="h-4 w-4" />} tone="emerald" />
        <StatCard label="ব্যর্থ" value={s.failedCycles} sub="failed" icon={<AlertTriangle className="h-4 w-4" />} tone="rose" />
      </div>

      {/* Loop cycle visualization */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-amber-600" /> LOOP সাইকেল
          </h3>
          {data.activeCycle && (
            <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500 mr-1 alo-pulse" />
              {data.activeCycle.objective.slice(0, 30)}...
            </Badge>
          )}
        </div>
        {/* Phase flow */}
        <div className="flex items-center gap-1 overflow-x-auto alo-scrollbar pb-2">
          {data.loopPhases.map((phase, i) => {
            const isActive = i === activePhaseIdx;
            const isDone = activePhaseIdx > i;
            return (
              <div key={phase.id} className="flex items-center shrink-0">
                <div className={`rounded-lg border-2 p-2.5 min-w-[80px] text-center transition-all ${
                  isActive ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20 alo-glow scale-105" :
                  isDone ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/10 opacity-70" :
                  "border-border/60 bg-muted/20"
                }`}>
                  <div className="text-xl">{phase.icon}</div>
                  <p className={`text-[10px] font-bold mt-1 ${isActive ? "text-amber-600" : isDone ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {phase.label}
                  </p>
                  <p className="text-[8px] text-muted-foreground">{phase.bn}</p>
                  {isDone && <CheckCircle2 className="h-3 w-3 text-emerald-500 mx-auto mt-0.5" />}
                  {isActive && <span className="block h-1 w-1 rounded-full bg-amber-500 mx-auto mt-0.5 alo-pulse" />}
                </div>
                {i < data.loopPhases.length - 1 && (
                  <div className={`h-0.5 w-3 ${isDone ? "bg-emerald-300" : "bg-border/40"}`} />
                )}
              </div>
            );
          })}
          {/* Repeat arrow */}
          <div className="flex items-center ml-1 shrink-0">
            <div className="text-lg text-amber-500">↻</div>
          </div>
        </div>
      </Card>

      {/* Departments by family */}
      <Card className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Layers className="h-4 w-4 text-violet-600" /> ডিপার্টমেন্ট পরিবার
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {data.families.map((f) => {
            const stats = data.byFamily[f.id] ?? { count: 0, agents: 0 };
            return (
              <div key={f.id} className="rounded-lg border border-border/60 p-3 alo-stagger alo-glow-hover">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{f.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{f.label}</p>
                    <p className="text-[9px] text-muted-foreground">{f.bn}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">{stats.count} বিভাগ</span>
                  <span className="font-bold text-amber-600">{stats.agents}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Loop cycle history */}
      <Card className="p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-amber-600" /> সাম্প্রতিক সাইকেল
        </h3>
        <ScrollArea className="max-h-72 alo-scrollbar pr-2">
          {data.loopCycles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-30" />
              এখনো কোনো সাইকেল নেই। &quot;নতুন সাইকেল শুরু&quot; চাপুন।
            </div>
          ) : (
            <div className="space-y-1.5">
              {data.loopCycles.map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/40 text-xs">
                  <StatusPill status={c.status === "running" ? "running" : c.status === "completed" ? "approved" : "failed"} />
                  <span className="font-medium truncate flex-1">{c.objective}</span>
                  <Badge variant="outline" className="text-[9px]">{c.phase}</Badge>
                  {c.qualityScore > 0 && <span className="text-[10px]">Q:{c.qualityScore}</span>}
                  {c.retryCount > 0 && <span className="text-[10px] text-amber-600">↻{c.retryCount}</span>}
                  <span className="text-[10px] text-muted-foreground">${c.costUsd.toFixed(4)}</span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Honest status note */}
      <Card className="p-4 bg-amber-50 border-amber-200 dark:bg-amber-900/10">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 dark:text-amber-200">
            <p className="font-semibold">সত্যিকারের স্ট্যাটাস</p>
            <p className="mt-1">
              ডিপার্টমেন্ট ও এজেন্ট সংখ্যা ডেটা মডেলে নিবন্ধিত। বাস্তব এজেন্ট এক্সিকিউশনের জন্য
              অর্কেস্ট্রেশন ইঞ্জিন (ওয়ার্কার প্রসেস) প্রয়োজন — এই স্যান্ডবক্সে স্থায়ী ওয়ার্কার নেই।
              মূল AI ফাংশন (LLM, image-gen) কাজ করে। ভিডিও/ভয়েস/কল/SMS = BLOCKED_EXTERNAL_SETUP।
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
