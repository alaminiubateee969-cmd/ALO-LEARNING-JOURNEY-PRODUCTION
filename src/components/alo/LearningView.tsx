"use client";

import { useEffect, useState } from "react";
import { SectionHeader, StatCard } from "./primitives";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { CURRICULUM_UNITS } from "@/lib/reference-curriculum";
import { TrendingUp, Brain, Trophy, Calendar, AlertTriangle, Target, Clock, MessageSquare } from "lucide-react";

interface Rec {
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
  icon: string;
}

interface Learning {
  period: string;
  sourceMessage: string;
  totals: Record<string, number>;
  byPlatform: Record<string, Record<string, number>>;
  bestPlatform: string;
  bestPlatformViews: number;
  engagement: number;
  sensitiveRate: number;
  bestDay: string;
  bestDayViews: number;
  publishedCount: number;
  recommendations: Rec[];
}

const platformEmoji: Record<string, string> = {
  facebook: "📘", instagram: "📸", youtube: "▶️", tiktok: "🎵", whatsapp: "💬",
};

export default function LearningView() {
  const { toast } = useToast();
  const [data, setData] = useState<Learning | null>(null);
  const [reviewedIds, setReviewedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/learning")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl alo-shimmer" />
        ))}
      </div>
    );
  }

  const priorityColor: Record<string, string> = {
    high: "border-rose-200 bg-rose-50/50",
    medium: "border-amber-200 bg-amber-50/40",
    low: "border-emerald-200 bg-emerald-50/40",
  };
  const priorityBadge: Record<string, string> = {
    high: "bg-rose-100 text-rose-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="alo-fade-up space-y-6">
      <SectionHeader
        title="Weekly Data Summary"
        bn="সাপ্তাহিক ডেটা সারাংশ"
        desc="Heuristic summaries use stored analytics snapshots, comment records, and post statuses only; platform data and delivery are not verified. Suggestions are not applied to content or scheduled as actions."
        icon={<Brain className="h-5 w-5" />}
        action={
          <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">
            <TrendingUp className="h-3 w-3 mr-1" /> সপ্তাহ {data.period}
          </Badge>
        }
      />
      <Card className="border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">{data.sourceMessage}</Card>

      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <StatCard label="Stored view samples" value={data.totals.views ?? 0} sub="Sum · last 7 days" icon={<TrendingUp className="h-4 w-4" />} tone="sky" />
        <StatCard label="Stored reach samples" value={data.totals.reach ?? 0} sub="Sum · last 7 days" icon={<Target className="h-4 w-4" />} tone="emerald" />
        <StatCard label="Engagement proxy" value={`${data.engagement}%`} sub="Shares + saves + comments ÷ reach" icon={<MessageSquare className="h-4 w-4" />} tone="amber" />
        <StatCard label="Sensitive-comment share" value={`${data.sensitiveRate}%`} sub="Stored comments · last 7 days" icon={<AlertTriangle className="h-4 w-4" />} tone="rose" />
        <StatCard label="Records marked published" value={data.publishedCount} sub="Delivery unverified" icon={<Trophy className="h-4 w-4" />} tone="violet" />
      </div>

      {/* Best platform + best day */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 alo-card-grad border-0">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-rose-400 p-3 text-2xl">
              {platformEmoji[data.bestPlatform] ?? "🏆"}
            </div>
            <div>
              <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Highest stored view-sample sum</p>
              <p className="text-xl font-bold capitalize">{data.bestPlatform}</p>
              <p className="text-xs text-muted-foreground">{data.bestPlatformViews.toLocaleString()} stored values · unverified</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 alo-card-grad border-0">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-emerald-400 to-sky-400 p-3">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Highest stored view-sample day</p>
              <p className="text-xl font-bold">{data.bestDay}</p>
              <p className="text-xs text-muted-foreground">{data.bestDayViews.toLocaleString()} stored values</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 alo-card-grad border-0">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-violet-400 to-pink-400 p-3">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Example window · not measured</p>
              <p className="text-xl font-bold">7–9 PM</p>
              <p className="text-xs text-muted-foreground">Not based on account analytics</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Per-platform breakdown */}
      <Card className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-amber-600" /> Stored snapshot values by platform
        </h3>
        <div className="space-y-4">
          {Object.entries(data.byPlatform).map(([p, m]) => {
            const views = m.views ?? 0;
            const maxViews = Math.max(...Object.values(data.byPlatform).map((x) => x.views ?? 0), 1);
            return (
              <div key={p}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span>{platformEmoji[p] ?? "📱"}</span>
                    <span className="capitalize">{p}</span>
                  </span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>👁 {views.toLocaleString()}</span>
                    <span>↗ {(m.reach ?? 0).toLocaleString()}</span>
                    <span>💬 {(m.comments ?? 0)}</span>
                    <span>🔁 {(m.shares ?? 0)}</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-400 transition-all duration-700"
                    style={{ width: `${(views / maxViews) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-muted-foreground">Stored engagement proxy</span>
            <span className="font-medium">{data.engagement}%</span>
          </div>
          <Progress value={Math.min(100, data.engagement * 5)} className="h-2" />
        </div>
      </Card>

      {/* Recommendations */}
      <Card className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-600" /> Rule-based suggestions
          <Badge variant="outline" className="text-[9px] ml-1">Advisory · not applied or saved</Badge>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.recommendations.map((r, i) => (
            <div
              key={i}
              className={`rounded-xl border p-4 alo-stagger alo-glow-hover ${priorityColor[r.priority]}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">{r.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm">{r.title}</p>
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${priorityBadge[r.priority]}`}>
                      {r.priority}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{r.detail}</p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setReviewedIds((ids) => [...ids, i]);
                        toast({
                          title: "Marked reviewed for this session only",
                          description: "No content, schedule, safety rule, or stored setting was changed.",
                        });
                      }}
                      disabled={reviewedIds.includes(i)}
                      className="rounded-md border border-border px-2 py-1 text-[10px] font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {reviewedIds.includes(i) ? "Reviewed · session only" : "Mark reviewed · session only"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Workshop curriculum — adapted from the reference link review */}
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">📚 Workshop Curriculum (Reference-Adapted)</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Self-contained workshop units with practice plans and retrospectives — structure adapted from huggingface/education-toolkit, leandromoreira/digital_video_introduction, 0voice/audio_video_streaming, and the cursor/plugins teaching pattern. Original ALO wording; every unit links its official source.
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">{CURRICULUM_UNITS.length} units</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {CURRICULUM_UNITS.map((unit) => (
            <div key={unit.id} className="rounded-xl border border-border/70 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                  {unit.durationMinutes[0]}–{unit.durationMinutes[1]} min
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{unit.audience}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{unit.track}</span>
              </div>
              <h4 className="mt-2 text-sm font-semibold">{unit.title}</h4>
              <p className="mt-1 text-[11px] italic text-muted-foreground">{unit.sourceLineage}</p>
              <ul className="mt-2 space-y-1">
                {unit.outcomes.map((o) => (
                  <li key={o} className="text-xs text-muted-foreground">• {o}</li>
                ))}
              </ul>
              <div className="mt-2 space-y-1.5">
                {unit.modules.map((m) => (
                  <div key={m.name} className="rounded-lg bg-muted/40 p-2">
                    <p className="text-xs font-semibold">{m.name}</p>
                    <p className="text-[11px] text-muted-foreground">{m.detail}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 rounded-lg bg-emerald-500/10 p-2 text-[11px] text-emerald-800 dark:text-emerald-300">
                🔄 Retrospective: {unit.retrospective}
              </p>
              <a
                href={unit.officialReference}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-[11px] text-sky-600 underline dark:text-sky-400"
              >
                Official source repository ↗
              </a>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
