"use client";

import { useMemo, useState } from "react";
import { AGENTS, AGENT_CATEGORIES, type AgentCategory } from "@/lib/agents";
import { SectionHeader, StatusPill } from "./primitives";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Brain, Search, Sparkles, Cpu, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";

const catIcon: Record<AgentCategory, string> = {
  orchestration: "🧠",
  research: "🔍",
  content: "✍️",
  safety: "🛡️",
  media: "🎨",
  publishing: "📤",
  community: "💬",
  learning: "📈",
  ops: "⚙️",
};

interface AgentRunResponse {
  ok: boolean;
  status: string;
  usedFallback: boolean;
  runId: string;
  auditId: string;
  agentId: string;
  agentName: string;
  model: string;
  latencyMs: number;
  estimatedCostUsd: number | null;
  costTelemetry: "not_metered";
  output: Record<string, unknown>;
}

export default function AgentsView() {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<AgentCategory | "all">("all");
  const [selected, setSelected] = useState<(typeof AGENTS)[number] | null>(null);
  const [taskPrompt, setTaskPrompt] = useState(
    "শিশুর ভাষা বিকাশ ও UK/Canada উচ্চশিক্ষা গাইড — প্রতিদিনের ১৫ মিনিট রুটিন"
  );
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<AgentRunResponse | null>(null);

  const filtered = useMemo(() => {
    return AGENTS.filter((a) => {
      if (cat !== "all" && a.category !== cat) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return (
        a.name.toLowerCase().includes(s) ||
        a.role.toLowerCase().includes(s) ||
        a.description.toLowerCase().includes(s) ||
        a.tools.some((t) => t.toLowerCase().includes(s))
      );
    });
  }, [q, cat]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: AGENTS.length };
    for (const c of AGENT_CATEGORIES) m[c.id] = AGENTS.filter((a) => a.category === c.id).length;
    return m;
  }, []);

  const triggerAgentRun = async (agentId: string) => {
    setRunning(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, prompt: taskPrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Agent execution failed");
      setLastResult(data);
      toast({
        title: data.status === "success" && !data.usedFallback
          ? `${data.agentName} returned a local model response`
          : `${data.agentName} returned fallback output — human review required`,
        description: `Run ${data.runId.slice(0, 12)} · ${data.model} · declared tools are not executed by this route`,
        variant: data.status === "success" && !data.usedFallback ? "default" : "destructive",
      });
    } catch (err) {
      toast({
        title: "Agent execution failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="alo-fade-up">
      <SectionHeader
        title="Agent Catalog · On-demand Local Models"
        bn="এআই এজেন্ট ক্যাটালগ"
        desc="These are configured agent definitions, not autonomous background workers. The generic run endpoint calls a local model only; it does not execute declared tools. Unavailable-model responses are labeled as fallback and require human review."
        icon={<Brain className="h-5 w-5" />}
        action={
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
              {AGENTS.length} configured · no worker probe
            </Badge>
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
              No paid AI API calls
            </Badge>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="এজেন্ট খুঁজুন — name, role, tool..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setCat("all")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            cat === "all" ? "bg-amber-500 text-white" : "bg-muted hover:bg-muted/70"
          }`}
        >
          All ({counts.all})
        </button>
        {AGENT_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              cat === c.id ? "bg-amber-500 text-white" : "bg-muted hover:bg-muted/70"
            }`}
          >
            {catIcon[c.id]} {c.label} ({counts[c.id]})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map((a) => (
          <Card
            key={a.id}
            onClick={() => {
              setSelected(a);
              setLastResult(null);
            }}
            className="p-4 cursor-pointer hover:shadow-md hover:border-amber-300 transition-all group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-2xl">{catIcon[a.category]}</div>
              <StatusPill status={a.status} />
            </div>
            <h3 className="font-semibold text-sm mt-2 group-hover:text-amber-700 transition-colors">
              {a.name}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{a.role}</p>
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
              {a.description}
            </p>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
              <Badge variant="outline" className="text-[10px]">Configured: {a.provider}</Badge>
              <span className="text-[10px] font-medium text-muted-foreground">On-demand · infrastructure cost not measured</span>
            </div>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Cpu className="h-8 w-8 mx-auto mb-2 opacity-50" />
          কোনো এজেন্ট মেলেনি।
        </div>
      )}

      <Dialog
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) {
            setSelected(null);
            setLastResult(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-hidden">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="text-3xl">{selected && catIcon[selected.category]}</div>
              <div>
                <DialogTitle>{selected?.name}</DialogTitle>
                <DialogDescription>{selected?.role}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {selected && (
            <ScrollArea className="max-h-[68vh] alo-scrollbar pr-3">
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-[10px] uppercase text-muted-foreground">Provider / Model</p>
                    <p className="font-medium text-xs mt-0.5">{selected.provider}</p>
                    <p className="text-[11px] text-muted-foreground">{selected.model}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Configured only; provider availability is checked on a run, and infrastructure cost is not measured.</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-[10px] uppercase text-muted-foreground">Status / Last run</p>
                    <div className="font-medium text-xs mt-0.5">
                      <StatusPill status={selected.status} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{selected.lastRunAt ?? "No verified run recorded"}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold mb-1">Intended role (not executed by generic route)</p>
                  <p className="text-muted-foreground">{selected.description}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold mb-1">System Prompt</p>
                  <pre className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-[11px] font-mono text-muted-foreground">
                    {selected.systemPrompt}
                  </pre>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-semibold mb-1">Declared tools (not executed here)</p>
                    <div className="flex flex-wrap gap-1">
                      {selected.tools.map((t) => (
                        <Badge key={t} variant="outline" className="text-[9px]">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-1">Declared permissions (not enforced here)</p>
                    <div className="flex flex-wrap gap-1">
                      {selected.permissions.map((p) => (
                        <Badge
                          key={p}
                          variant="outline"
                          className="text-[9px] bg-amber-50 border-amber-200 text-amber-700"
                        >
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-2.5">
                  <p className="text-xs font-semibold text-amber-900">
                    Run {selected.name} on demand (local model; declared tools not executed)
                  </p>
                  <Input
                    value={taskPrompt}
                    onChange={(e) => setTaskPrompt(e.target.value)}
                    placeholder="এজেন্টের জন্য টপিক বা নির্দেশনা লিখুন..."
                    className="bg-background text-xs"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      disabled={running || !taskPrompt.trim()}
                      onClick={() => void triggerAgentRun(selected.id)}
                      className="bg-amber-500 hover:bg-amber-600 text-white"
                    >
                      {running ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Running Local Agent…
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Trigger Local Run
                        </>
                      )}
                    </Button>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      Local-only model route · infrastructure cost not measured
                    </span>
                  </div>
                </div>

                {lastResult && (
                  <div className={`rounded-xl border p-3 space-y-2 ${lastResult.status === "success" && !lastResult.usedFallback ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`text-xs font-semibold flex items-center gap-1.5 ${lastResult.status === "success" && !lastResult.usedFallback ? "text-emerald-900" : "text-amber-900"}`}>
                        {lastResult.status === "success" && !lastResult.usedFallback
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          : <ShieldCheck className="h-4 w-4 text-amber-600" />}
                        {lastResult.agentName} · {lastResult.status === "success" && !lastResult.usedFallback ? "local model response" : "fallback output — human review required"} · {lastResult.latencyMs}ms
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        Run {lastResult.runId.slice(0, 10)} · {lastResult.status}
                      </Badge>
                    </div>
                    <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-lg bg-background p-2.5 font-mono text-[11px] text-foreground">
                      {JSON.stringify(lastResult.output, null, 2)}
                    </pre>
                  </div>
                )}

                {selected.lastError && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                    <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Last error
                    </p>
                    <p className="text-[11px] text-amber-700 mt-1">{selected.lastError}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
