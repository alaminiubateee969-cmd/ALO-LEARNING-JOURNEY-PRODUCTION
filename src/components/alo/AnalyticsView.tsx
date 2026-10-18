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
  providerAnalyticsFetched: boolean;
  message: string;
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

  // Combine stored snapshot values by day. These are not live provider analytics.
  const days = Array.from(new Set(
    Object.values(data.byPlatform).flatMap((metrics) => metrics.views?.map((item) => item.day) ?? [])
  )).sort();
  const viewsSeries = days.map((day) => ({
    day,
    value: Object.values(data.byPlatform).reduce(
      (total, metrics) => total + (metrics.views?.find((item) => item.day === day)?.value ?? 0),
      0,
    ),
  }));
  const maxView = Math.max(...viewsSeries.map((v) => v.value), 1);

  return (
    <div className="alo-fade-up">
      <SectionHeader
        title="Analytics"
        bn="অ্যানালিটিক্স"
        desc="Values below are stored analytics-snapshot records from the last seven days. This page does not fetch platform analytics; source and completeness are unverified. Post entries are records marked published, not verified deliveries."
        icon={<BarChart3 className="h-5 w-5" />}
        action={<ExportButton />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-4">
        <StatCard label="Views snapshot values" value={t.views?.toLocaleString() ?? 0} sub="Sum · last 7 days" icon={<Eye className="h-4 w-4" />} tone="sky" />
        <StatCard label="Reach snapshot values" value={t.reach?.toLocaleString() ?? 0} sub="Sum · last 7 days" icon={<TrendingUp className="h-4 w-4" />} tone="emerald" />
        <StatCard label="Watch-time samples" value={`${t.watch_time ?? 0}m`} sub="Sum · last 7 days" icon={<Clock className="h-4 w-4" />} tone="amber" />
        <StatCard label="Retention samples" value={`${t.retention ?? 0}%`} sub="Average · last 7 days" icon={<BarChart3 className="h-4 w-4" />} tone="violet" />
        <StatCard label="Follower samples" value={t.followers?.toLocaleString() ?? 0} sub="Sum · last 7 days" icon={<Users className="h-4 w-4" />} tone="rose" />
        <StatCard label="Share samples" value={t.shares ?? 0} sub="Sum · last 7 days" icon={<Send className="h-4 w-4" />} tone="emerald" />
        <StatCard label="Save samples" value={t.saves ?? 0} sub="Sum · last 7 days" icon={<Sparkles className="h-4 w-4" />} tone="amber" />
        <StatCard label="Lead samples" value={t.leads ?? 0} sub="Sum · last 7 days" icon={<Sparkles className="h-4 w-4" />} tone="violet" />
        <StatCard label="Comment samples" value={t.comments ?? 0} sub="Sum · last 7 days" icon={<Users className="h-4 w-4" />} tone="sky" />
        <StatCard label="Marked published" value={data.publishedPosts.length} sub="Delivery unverified" icon={<Send className="h-4 w-4" />} tone="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Views trend chart */}
        <Card className="lg:col-span-2 p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-600" /> Stored view-snapshot values · last 7 days
          </h3>
          <div className="flex items-end justify-between gap-2 h-48">
            {viewsSeries.length === 0 ? (
              <p className="w-full self-center text-center text-sm text-muted-foreground">No stored view snapshots in this period. No provider data is fetched here.</p>
            ) : viewsSeries.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-amber-500 to-rose-400 transition-all hover:opacity-80"
                    style={{ height: `${(v.value / maxView) * 100}%` }}
                    title={`${v.value} stored snapshot values`}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{v.day.slice(5)}</span>
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
            <BarChart3 className="h-4 w-4 text-violet-600" /> Stored values by platform
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
          <Send className="h-4 w-4 text-emerald-600" /> Records marked published · delivery unverified
        </h3>
        <ScrollArea className="max-h-72 alo-scrollbar pr-2">
          <div className="space-y-2">
            {data.publishedPosts.map((post) => (
              <div key={post.id} className="rounded-lg border border-border/60 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{post.topic}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Stored provider ID (unverified): <code className="bg-muted px-1 rounded">{post.providerPostId ?? "—"}</code>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[10px] capitalize">{post.platform}</Badge>
                  {post.url ? (
                    <a href={post.url} target="_blank" rel="noreferrer" className="text-[10px] text-amber-600 hover:underline">
                      Stored URL ↗
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
            {data.publishedPosts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No post records are marked published.</p>
            )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
