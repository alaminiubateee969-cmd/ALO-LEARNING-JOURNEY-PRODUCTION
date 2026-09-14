"use client";

import { useEffect, useState } from "react";
import { StatCard, StatusPill, ProviderTag } from "./primitives";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity, ShieldCheck, Brain, Sparkles, Send, CheckCircle2,
  AlertTriangle, Eye, TrendingUp, Clock, Users, Bell, Database, Cpu,
} from "lucide-react";
import { PLATFORMS } from "@/lib/platforms";
import ActivityTimeline from "./ActivityTimeline";
import Sparkline from "./Sparkline";

// Sparkline mini-charts row — fetches 7-day analytics and renders
// small trend lines for views, reach, shares, saves.
function SparklineRow() {
  const [series, setSeries] = useState<Record<string, number[]>>({});
  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => {
        // Sum each metric across all platforms per day
        const platforms = Object.keys(d.byPlatform ?? {});
        if (platforms.length === 0) return;
        const days = d.byPlatform[platforms[0]]?.views?.length ?? 0;
        const metrics = ["views", "reach", "shares", "saves"];
        const out: Record<string, number[]> = {};
        for (const m of metrics) {
          out[m] = Array.from({ length: days }, (_, i) => {
            let sum = 0;
            for (const p of platforms) sum += d.byPlatform[p]?.[m]?.[i]?.value ?? 0;
            return sum;
          });
        }
        setSeries(out);
      })
      .catch(() => {});
  }, []);

  const cards = [
    { label: "Views ট্রেন্ড", data: series.views ?? [], color: "#0ea5e9", fill: "rgba(14,165,233,0.2)", icon: <Eye className="h-3.5 w-3.5" /> },
    { label: "Reach ট্রেন্ড", data: series.reach ?? [], color: "#10b981", fill: "rgba(16,185,129,0.2)", icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { label: "Shares ট্রেন্ড", data: series.shares ?? [], color: "#f43f5e", fill: "rgba(244,63,94,0.2)", icon: <Users className="h-3.5 w-3.5" /> },
    { label: "Saves ট্রেন্ড", data: series.saves ?? [], color: "#f59e0b", fill: "rgba(245,158,11,0.2)", icon: <Sparkles className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c, i) => {
        const total = c.data.reduce((s, v) => s + v, 0);
        const last = c.data[c.data.length - 1] ?? 0;
        const first = c.data[0] ?? 0;
        const change = first > 0 ? ((last - first) / first * 100).toFixed(0) : "0";
        const up = Number(change) >= 0;
        return (
          <Card
            key={c.label}
            className="p-3 alo-stagger alo-glow-hover border-border/60"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                {c.icon} {c.label}
              </span>
              <span className={`text-[10px] font-bold ${up ? "text-emerald-600" : "text-rose-600"}`}>
                {up ? "↑" : "↓"} {Math.abs(Number(change))}%
              </span>
            </div>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-lg font-bold tabular-nums">{total.toLocaleString()}</p>
                <p className="text-[9px] text-muted-foreground">৭ দিন</p>
              </div>
              <Sparkline
                data={c.data}
                width={100}
                height={32}
                color={c.color}
                fillFrom={c.fill}
                fillTo="rgba(0,0,0,0)"
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

interface DashData {
  widgets: Record<string, number | string>;
  agentCounts: { total: number; active: number; blocked: number; idle: number };
  platforms: any[];
  approvals: any[];
  audit: any[];
  notifications: any[];
  ragDocCount: number;
  recentRuns: any[];
}

const fmt = (n: number | string) =>
  typeof n === "number" ? n.toLocaleString("en-US") : n;

export default function Dashboard({ onNavigate }: { onNavigate: (s: string) => void }) {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () =>
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <Card key={i} className="h-28 animate-pulse bg-muted/40" />
        ))}
      </div>
    );
  }

  const w = data.widgets;

  return (
    <div className="space-y-6 alo-fade-up">
      {/* Hero strip */}
      <Card className="relative overflow-hidden border-0 alo-card-grad alo-border-anim p-5 sm:p-6 mb-6">
        {/* floating orbs */}
        <div className="alo-orb alo-float" style={{ width: 180, height: 180, background: "rgba(245,158,11,0.5)", top: -40, right: -20 }} />
        <div className="alo-orb alo-float" style={{ width: 140, height: 140, background: "rgba(236,72,153,0.4)", bottom: -50, left: 200, animationDelay: "2s" }} />
        <div className="alo-orb alo-float" style={{ width: 100, height: 100, background: "rgba(16,185,129,0.35)", top: 20, left: 480, animationDelay: "4s" }} />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
              Own AI Agent Platform · Protective Mode ON
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold mt-1">
              স্বাগতম, <span className="alo-text-grad">আলো অ্যাডমিন</span> 💛
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              আলো — ভালোবাসা দিয়ে শেখার পথ। ৪০টি AI এজেন্ট, RAG জ্ঞানভাণ্ডার ও
              Protective Mode নিয়ে আজকের কনটেন্ট পাইপলাইন দেখুন।
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              <ShieldCheck className="h-3 w-3 mr-1" /> Protective Mode সক্রিয়
            </Badge>
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
              <Cpu className="h-3 w-3 mr-1" /> Local {w.localModelUsage}%
            </Badge>
          </div>
        </div>
      </Card>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard className="alo-stagger" label="Connected Platforms" value={w.connectedPlatforms} sub={`${PLATFORMS.length} মোট`} icon={<Send className="h-4 w-4" />} tone="emerald" />
        <StatCard label="Active Agents" value={`${w.activeAgents}/${data.agentCounts.total}`} sub={`${w.providerFailures} blocked`} icon={<Brain className="h-4 w-4" />} tone="amber" />
        <StatCard label="Pending Approval" value={w.pendingApproval} sub="অনুমোদনের অপেক্ষায়" icon={<CheckCircle2 className="h-4 w-4" />} tone="rose" />
        <StatCard label="Published Posts" value={w.publishedPosts} sub="real provider IDs" icon={<Send className="h-4 w-4" />} tone="emerald" />
        <StatCard label="Topic Ideas" value={w.topicIdeas} sub="RAG-supported" icon={<Sparkles className="h-4 w-4" />} tone="violet" />
        <StatCard label="Failed Jobs" value={w.failedJobs} sub="retry queue" icon={<AlertTriangle className="h-4 w-4" />} tone="rose" />
        <StatCard label="Views" value={fmt(w.views)} sub="৭ দিন" icon={<Eye className="h-4 w-4" />} tone="sky" />
        <StatCard label="Reach" value={fmt(w.reach)} sub="৭ দিন" icon={<TrendingUp className="h-4 w-4" />} tone="emerald" />
        <StatCard label="Watch Time (min)" value={fmt(w.watchTime)} sub={`retention ${w.retention}`} icon={<Clock className="h-4 w-4" />} tone="amber" />
        <StatCard label="Shares" value={fmt(w.shares)} sub={`saves ${fmt(w.saves)}`} icon={<Users className="h-4 w-4" />} tone="rose" />
        <StatCard label="Leads" value={fmt(w.leads)} sub={`WA joins ${w.whatsappJoins}`} icon={<Sparkles className="h-4 w-4" />} tone="violet" />
        <StatCard label="API Cost" value={`$${w.apiCostUsd}`} sub="per cycle" icon={<Activity className="h-4 w-4" />} tone="slate" />
      </div>

      {/* Sparkline mini-charts row */}
      <SparklineRow />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pipeline overview */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-600" /> কনটেন্ট পাইপলাইন
            </h3>
            <button onClick={() => onNavigate("studio")} className="text-xs text-amber-600 hover:underline">
              Content Studio খুলুন →
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Ideas", value: w.topicIdeas, c: "from-violet-500/20 to-violet-500/5" },
              { label: "Packages", value: w.contentPackages, c: "from-amber-500/20 to-amber-500/5" },
              { label: "Approval", value: w.pendingApproval, c: "from-rose-500/20 to-rose-500/5" },
              { label: "Published", value: w.publishedPosts, c: "from-emerald-500/20 to-emerald-500/5" },
            ].map((s, i) => (
              <div key={i} className={`rounded-xl bg-gradient-to-br ${s.c} p-3 text-center`}>
                <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-muted-foreground">Local vs Provider usage</span>
              <span className="font-medium">{w.localModelUsage}% local</span>
            </div>
            <Progress value={w.localModelUsage as number} className="h-2" />
            <p className="text-[11px] text-muted-foreground mt-2">
              Cost Router প্রথমে local মডেল ব্যবহার করে; paid provider শুধু প্রয়োজনে।
            </p>
          </div>
        </Card>

        {/* Notifications */}
        <Card className="p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4 text-rose-600" /> নোটিফিকেশন
          </h3>
          <ScrollArea className="h-56 alo-scrollbar pr-2">
            <div className="space-y-2">
              {data.notifications.map((n: any) => (
                <div key={n.id} className="rounded-lg border border-border/60 p-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-xs">{n.title}</p>
                    <Badge variant="outline" className={
                      n.kind === "warn" ? "border-amber-300 text-amber-700 text-[9px]" :
                      n.kind === "danger" ? "border-rose-300 text-rose-700 text-[9px]" :
                      n.kind === "success" ? "border-emerald-300 text-emerald-700 text-[9px]" :
                      "text-[9px]"
                    }>{n.kind}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{n.body}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Platform connections */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Send className="h-4 w-4 text-emerald-600" /> সোশ্যাল সংযোগ
            </h3>
            <button onClick={() => onNavigate("social")} className="text-xs text-amber-600 hover:underline">
              সব দেখুন →
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {data.platforms.slice(0, 9).map((p: any) => (
              <div key={p.id} className="rounded-lg border border-border/60 p-2.5 flex items-center gap-2">
                <span className="text-lg">{p.icon}</span>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{p.name}</p>
                  <StatusPill status={p.connection?.status ?? "not_connected"} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Audit log */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Database className="h-4 w-4 text-violet-600" /> সাম্প্রতিক Audit Log
            </h3>
            <button onClick={() => onNavigate("settings")} className="text-xs text-amber-600 hover:underline">
              সব দেখুন →
            </button>
          </div>
          <ScrollArea className="h-56 alo-scrollbar pr-2">
            <div className="space-y-1.5">
              {data.audit.map((a: any) => (
                <div key={a.id} className="flex items-start gap-2 text-xs py-1.5 border-b border-border/40 last:border-0">
                  <span className={`mt-0.5 h-1.5 w-1.5 rounded-full shrink-0 ${
                    a.severity === "warn" ? "bg-amber-500" :
                    a.severity === "error" || a.severity === "critical" ? "bg-rose-500" : "bg-emerald-500"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{a.action}</p>
                    <p className="text-muted-foreground truncate">{a.detail}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(a.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* Recent agent runs */}
      <Card className="p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-3">
          <Cpu className="h-4 w-4 text-amber-600" /> সাম্প্রতিক এজেন্ট রান
        </h3>
        {data.recentRuns.length === 0 ? (
          <p className="text-sm text-muted-foreground">এখনো কোনো রান নেই। Content Studio থেকে শুরু করুন।</p>
        ) : (
          <div className="space-y-1.5">
            {data.recentRuns.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-border/40 last:border-0">
                <StatusPill status={r.status} />
                <span className="font-medium truncate flex-1">{r.agentId}</span>
                {r.inputBrief && <span className="text-muted-foreground truncate hidden sm:block">{r.inputBrief}</span>}
                <span className="text-[10px] text-muted-foreground">${r.costEstUsd.toFixed(4)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Activity timeline */}
      <ActivityTimeline />
    </div>
  );
}
