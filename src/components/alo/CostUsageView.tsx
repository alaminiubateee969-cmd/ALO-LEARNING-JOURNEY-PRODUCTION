"use client";

import { useEffect, useState } from "react";
import { SectionHeader, StatCard } from "./primitives";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Cloud, Cpu, HardDrive, Server, Zap } from "lucide-react";

interface AgentConfig {
  id: string;
  name: string;
  category: string;
  provider: string;
  model: string;
  status: string;
}

interface Data {
  agentConfigs: AgentConfig[];
  providers: { count: number; label: string }[];
  categories: { category: string; count: number }[];
  summary: {
    totalDefinitions: number;
    localCount: number;
    externalOptionalCount: number;
    paidApiRoutesConfigured: number;
    costTelemetry: "not_metered";
  };
}

const providerMeta: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  local: { icon: <HardDrive className="h-4 w-4" />, color: "text-emerald-600", bg: "bg-emerald-100", label: "Local provider definition" },
  "external-optional": { icon: <Server className="h-4 w-4" />, color: "text-violet-600", bg: "bg-violet-100", label: "Optional external definition" },
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

export default function CostUsageView() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/costs")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load provider definitions.");
        setData(result);
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : "Could not load provider definitions.");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl alo-shimmer" />
        ))}
      </div>
    );
  }

  if (!data) {
    return <Card className="p-6 text-sm text-muted-foreground">Cost telemetry is not available. {loadError}</Card>;
  }

  const summary = data.summary;
  const totalDefinitions = Math.max(summary.totalDefinitions, 1);

  return (
    <div className="alo-fade-up space-y-5">
      <SectionHeader
        title="AI Cost Telemetry & Provider Configuration"
        bn="খরচ ও ব্যবহার"
        desc="Actual API usage, provider invoices, compute, storage, and electricity are not metered by this application. This page lists configured agent definitions only; it does not report spend or prove provider availability."
        icon={<Activity className="h-5 w-5" />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <StatCard label="Cost telemetry" value="Not metered" sub="API and infrastructure costs unknown" icon={<Activity className="h-4 w-4" />} tone="amber" />
        <StatCard label="Configured definitions" value={summary.totalDefinitions} sub="not live workers" icon={<Cpu className="h-4 w-4" />} tone="sky" />
        <StatCard label="Local provider definitions" value={summary.localCount} sub="availability not probed" icon={<HardDrive className="h-4 w-4" />} tone="emerald" />
        <StatCard label="Optional external definitions" value={summary.externalOptionalCount} sub="definitions only" icon={<Server className="h-4 w-4" />} tone="violet" />
        <StatCard label="Paid AI API routes" value={summary.paidApiRoutesConfigured} sub="disabled in reviewed generation routes" icon={<Cloud className="h-4 w-4" />} tone="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Cloud className="h-4 w-4 text-amber-600" /> Configured provider definitions
          </h3>
          <div className="space-y-3">
            {data.providers.map((provider) => {
              const meta = providerMeta[provider.label] ?? { icon: <Server className="h-4 w-4" />, color: "text-slate-600", bg: "bg-slate-100", label: provider.label };
              const pct = (provider.count / totalDefinitions) * 100;
              return (
                <div key={provider.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className={`rounded-lg p-1 ${meta.bg} ${meta.color}`}>{meta.icon}</span>
                      {meta.label}
                      <Badge variant="outline" className="text-[9px]">{provider.count} definitions</Badge>
                    </span>
                    <span className="tabular-nums font-semibold">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${provider.label === "local" ? "bg-emerald-400" : "bg-violet-400"} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
            Provider labels come from the static agent catalog. No model or external API endpoint is probed by this report.
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-violet-600" /> Configured definitions by category
          </h3>
          <div className="space-y-2.5">
            {data.categories.map((category) => {
              const pct = (category.count / totalDefinitions) * 100;
              const colors: Record<string, string> = {
                orchestration: "bg-amber-400",
                research: "bg-sky-400",
                content: "bg-violet-400",
                safety: "bg-rose-400",
                media: "bg-emerald-400",
                publishing: "bg-cyan-400",
                community: "bg-pink-400",
                learning: "bg-indigo-400",
                ops: "bg-slate-400",
              };
              return (
                <div key={category.category}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{catLabel[category.category] ?? category.category}</span>
                    <span className="text-muted-foreground tabular-nums">{category.count} definitions</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${colors[category.category] ?? "bg-slate-400"} transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-amber-600" /> Configured model definitions · not metered usage
        </h3>
        <ScrollArea className="max-h-96 alo-scrollbar pr-2">
          <div className="space-y-1">
            {data.agentConfigs.map((agent, index) => {
              const meta = providerMeta[agent.provider] ?? providerMeta["external-optional"];
              return (
                <div
                  key={agent.id}
                  className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/40 transition-colors alo-stagger"
                  style={{ animationDelay: `${index * 15}ms` }}
                >
                  <span className={`rounded-lg p-1 ${meta.bg} ${meta.color} shrink-0`}>{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium truncate">{agent.name}</p>
                      <Badge variant="outline" className="text-[8px] shrink-0">{agent.status}</Badge>
                    </div>
                    <p className="text-[9px] text-muted-foreground truncate">{agent.model} · {catLabel[agent.category] ?? agent.category}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground text-right shrink-0">Configured · cost not metered</span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
