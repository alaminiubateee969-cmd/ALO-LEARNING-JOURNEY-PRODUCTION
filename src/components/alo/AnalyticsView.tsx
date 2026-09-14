"use client";

import { useEffect, useState } from "react";
import { SectionHeader, StatCard } from "./primitives";
import ExportButton from "./ExportButton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart3, Eye, TrendingUp, Clock, Users, Sparkles, Send } from "lucide-react";
import { PLATFORMS } from "@/lib/platforms";

interface Data {
  byPlatform: Record<string, Record<string, { day: string; value: number }[]>>;
  totals: Record<string, number>;
  publishedPosts: { id: string; platform: string; providerPostId: string | null; url: string | null; topic: string; status: string; publishedAt: string | null }[];
}

const platformColor: Record<string, string> = {
  facebook: "#1877f2",
  instagram: "#e1306c",
  youtube: "#ff0000",
  tiktok: "#000000",
  whatsapp: "#25d366",
};

export default function AnalyticsView() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="h-24 animate-pulse bg-muted/40" />
        ))}
      </div>
    );
  }

  const t = data.totals;

  // Build a combined views series across platforms
  const days = data.byPlatform.facebook?.views?.map((d) => d.day) ?? [];
  const viewsSeries = days.map((day, i) => {
    let total = 0;
    for (const p of Object.keys(data.byPlatform)) {
      total += data.byPlatform[p]?.views?.[i]?.value ?? 0;
    }
    return { day, value: total };
  });
  const maxView = Math.max(...viewsSeries.map((v) => v.value), 1);

  return (
    <div className="alo-fade-up">
      <SectionHeader
        title="Analytics"
        bn="অ্যানালিটিক্স"
        desc="সংযুক্ত প্ল্যাটফর্ম থেকে views, reach, watch time, retention, shares, saves, leads — ৭ দিনের ট্রেন্ড সহ।"
        icon={<BarChart3 className="h-5 w-5" />}
        action={<ExportButton />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-4">
        <StatCard label="Views" value={t.views?.toLocaleString() ?? 0} sub="৭ দিন" icon={<Eye className="h-4 w-4" />} tone="sky" />
        <StatCard label="Reach" value={t.reach?.toLocaleString() ?? 0} sub="৭ দিন" icon={<TrendingUp className="h-4 w-4" />} tone="emerald" />
        <StatCard label="Watch Time" value={`${t.watch_time ?? 0}m`} sub="total" icon={<Clock className="h-4 w-4" />} tone="amber" />
        <StatCard label="Retention" value={`${t.retention ?? 0}`} sub="sum %" icon={<BarChart3 className="h-4 w-4" />} tone="violet" />
        <StatCard label="Followers" value={t.followers?.toLocaleString() ?? 0} sub="total" icon={<Users className="h-4 w-4" />} tone="rose" />
        <StatCard label="Shares" value={t.shares ?? 0} icon={<Send className="h-4 w-4" />} tone="emerald" />
        <StatCard label="Saves" value={t.saves ?? 0} icon={<Sparkles className="h-4 w-4" />} tone="amber" />
        <StatCard label="Leads" value={t.leads ?? 0} icon={<Sparkles className="h-4 w-4" />} tone="violet" />
        <StatCard label="Comments" value={t.comments ?? 0} icon={<Users className="h-4 w-4" />} tone="sky" />
        <StatCard label="Published" value={data.publishedPosts.filter((p) => p.status === "published").length} sub="real IDs" icon={<Send className="h-4 w-4" />} tone="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Views trend chart */}
        <Card className="lg:col-span-2 p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-600" /> Views ট্রেন্ড (৭ দিন, সব প্ল্যাটফর্ম)
          </h3>
          <div className="flex items-end justify-between gap-2 h-48">
            {viewsSeries.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-amber-500 to-rose-400 transition-all hover:opacity-80"
                    style={{ height: `${(v.value / maxView) * 100}%` }}
                    title={`${v.value} views`}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{v.day}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {Object.keys(data.byPlatform).map((p) => {
              const def = PLATFORMS.find((x) => x.id === p);
              return (
                <div key={p} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: platformColor[p] }} />
                  <span className="capitalize">{def?.name ?? p}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Per-platform breakdown */}
        <Card className="p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-violet-600" /> প্ল্যাটফর্ম ভাগ
          </h3>
          <div className="space-y-3">
            {Object.entries(data.byPlatform).map(([p, metrics]) => {
              const def = PLATFORMS.find((x) => x.id === p);
              const views = metrics.views?.reduce((s, d) => s + d.value, 0) ?? 0;
              return (
                <div key={p}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5">
                      <span>{def?.icon}</span>
                      <span className="font-medium">{def?.name ?? p}</span>
                    </span>
                    <span className="tabular-nums">{views.toLocaleString()}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (views / maxView) * 100)}%`, background: platformColor[p] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Published posts */}
      <Card className="p-5 mt-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Send className="h-4 w-4 text-emerald-600" /> প্রকাশিত পোস্ট (real provider IDs)
        </h3>
        <ScrollArea className="max-h-72 alo-scrollbar pr-2">
          <div className="space-y-2">
            {data.publishedPosts.map((post) => (
              <div key={post.id} className="rounded-lg border border-border/60 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{post.topic}</p>
                  <p className="text-[11px] text-muted-foreground">
                    provider ID: <code className="bg-muted px-1 rounded">{post.providerPostId ?? "—"}</code>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[10px] capitalize">{post.platform}</Badge>
                  {post.url ? (
                    <a href={post.url} target="_blank" rel="noreferrer" className="text-[10px] text-amber-600 hover:underline">
                      URL ↗
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
            {data.publishedPosts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">এখনো কিছু প্রকাশিত হয়নি।</p>
            )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
