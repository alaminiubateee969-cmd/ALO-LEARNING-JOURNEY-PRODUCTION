"use client";

import { useMemo, useState } from "react";
import { AGENTS, AGENT_CATEGORIES, type AgentCategory } from "@/lib/agents";
import { SectionHeader, StatusPill, ProviderTag } from "./primitives";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Search, Sparkles, Cpu, ShieldCheck } from "lucide-react";

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

export default function AgentsView() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<AgentCategory | "all">("all");
  const [selected, setSelected] = useState<(typeof AGENTS)[number] | null>(null);

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

  return (
    <div className="alo-fade-up">
      <SectionHeader
        title="Own AI Agents"
        bn="৪০টি এজেন্ট"
        desc="আমাদের নিজস্ব মাল্টি-এজেন্ট অর্কেস্ট্রেশন। External providers (when configured) শুধু inference tool — মূল ব্রেন এই এজেন্ট কার্নেল।"
        icon={<Brain className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              {AGENTS.filter((a) => a.status === "active").length} active
            </Badge>
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
              {AGENTS.filter((a) => a.status === "blocked_external_setup").length} blocked
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
            onClick={() => setSelected(a)}
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
              <ProviderTag provider={a.provider} fallback={a.provider === "local"} />
              <span className="text-[10px] text-muted-foreground">${a.estimatedCostUsd.toFixed(3)}</span>
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

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
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
            <ScrollArea className="max-h-[60vh] alo-scrollbar pr-3">
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-[10px] uppercase text-muted-foreground">Provider / Model</p>
                    <p className="font-medium text-xs mt-0.5">{selected.provider}</p>
                    <p className="text-[11px] text-muted-foreground">{selected.model}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-[10px] uppercase text-muted-foreground">Status / Last run</p>
                    <p className="font-medium text-xs mt-0.5"><StatusPill status={selected.status} /></p>
                    <p className="text-[11px] text-muted-foreground">{selected.lastRunAt ?? "never"}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold mb-1">Description</p>
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
                    <p className="text-xs font-semibold mb-1">Tools</p>
                    <div className="flex flex-wrap gap-1">
                      {selected.tools.map((t) => (
                        <Badge key={t} variant="outline" className="text-[9px]">{t}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-1">Permissions</p>
                    <div className="flex flex-wrap gap-1">
                      {selected.permissions.map((p) => (
                        <Badge key={p} variant="outline" className="text-[9px] bg-amber-50 border-amber-200 text-amber-700">{p}</Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-semibold mb-1">Knowledge scope</p>
                    <div className="flex flex-wrap gap-1">
                      {selected.knowledgeScope.map((k) => (
                        <Badge key={k} variant="outline" className="text-[9px]">{k}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-1">Memory scope</p>
                    <div className="flex flex-wrap gap-1">
                      {selected.memoryScope.map((m) => (
                        <Badge key={m} variant="outline" className="text-[9px]">{m}</Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {selected.lastError && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                    <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Last error
                    </p>
                    <p className="text-[11px] text-amber-700 mt-1">{selected.lastError}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <Button size="sm" className="bg-amber-500 hover:bg-amber-600">
                    <Sparkles className="h-3 w-3 mr-1" /> Trigger run
                  </Button>
                  <span className="text-[11px] text-muted-foreground">
                    est. ${selected.estimatedCostUsd.toFixed(4)} · retries {selected.retryCount}
                  </span>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
