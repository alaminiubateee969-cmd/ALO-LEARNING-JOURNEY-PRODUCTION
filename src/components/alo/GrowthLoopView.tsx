"use client";

import { useEffect, useState } from "react";
import { SectionHeader, StatCard, StatusPill, ProviderTag } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp, Target, FlaskConical, FolderPlus, Loader2, CheckCircle2,
  ArrowRight, BarChart3, Users, Sparkles, RefreshCw, Trophy,
} from "lucide-react";

interface Opportunity {
  id: string;
  topic: string;
  searchDemand: number;
  parentRelevance: number;
  bangladeshRelevance: number;
  competition: number;
  videoPotential: number;
  brandFit: number;
  finalScore: number;
  rationale: string | null;
  approved: boolean;
  provider: string;
  createdAt: string;
}

interface HookTest {
  id: string;
  topic: string;
  hookText: string;
  variant: string;
  impressions: number;
  hookRetention: number;
  watchTime: number;
  completion: number;
  isWinner: boolean;
  status: string;
  createdAt: string;
}

interface Campaign {
  id: string;
  title: string;
  topic: string;
  status: string;
  platformCount: number;
  totalAssets: number;
  views: number;
  reach: number;
  engagement: number;
  followerGain: number;
  audienceRelevance: number;
  conversionRate: number;
  lesson: string | null;
  createdAt: string;
}

interface GrowthData {
  opportunities: Opportunity[];
  hookTests: HookTest[];
  campaigns: Campaign[];
  stats: {
    totalOpportunities: number;
    approvedOpportunities: number;
    avgScore: number;
    activeHookTests: number;
    hookWinners: number;
    activeCampaigns: number;
    measuredCampaigns: number;
    totalViews: number;
    totalFollowerGain: number;
    avgAudienceRelevance: number;
  };
}

const LOOP_STAGES = [
  { id: "research", label: "Research", bn: "গবেষণা", icon: "🔍" },
  { id: "select", label: "Select Best", bn: "নির্বাচন", icon: "🎯" },
  { id: "create", label: "Create", bn: "তৈরি", icon: "✨" },
  { id: "check", label: "Check", bn: "যাচাই", icon: "✓" },
  { id: "publish", label: "Publish", bn: "প্রকাশ", icon: "🚀" },
  { id: "measure", label: "Measure", bn: "পরিমাপ", icon: "📊" },
  { id: "learn", label: "Learn", bn: "শেখা", icon: "📚" },
  { id: "recreate", label: "Recreate Better", bn: "উন্নত করা", icon: "↺" },
];

export default function GrowthLoopView() {
  const { toast } = useToast();
  const [data, setData] = useState<GrowthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [topicInput, setTopicInput] = useState("");
  const [hookTopic, setHookTopic] = useState("");

  const load = () => {
    fetch("/api/growth")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, []);

  const scoreTopic = async () => {
    if (!topicInput.trim()) { toast({ title: "টপিক দিন", variant: "destructive" }); return; }
    setBusy("score");
    try {
      const res = await fetch("/api/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "score_topic", topic: topicInput }),
      });
      const d = await res.json();
      toast({
        title: d.score.approved ? `অনুমোদিত ✅ (${d.score.finalScore}/100)` : `স্কোর: ${d.score.finalScore}/100`,
        description: d.score.rationale?.slice(0, 80) ?? "",
        variant: d.score.approved ? "default" : "destructive",
      });
      setTopicInput("");
      load();
    } finally { setBusy(null); }
  };

  const generateHooks = async () => {
    if (!hookTopic.trim()) { toast({ title: "টপিক দিন", variant: "destructive" }); return; }
    setBusy("hooks");
    try {
      const res = await fetch("/api/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_hooks", topic: hookTopic }),
      });
      const d = await res.json();
      toast({ title: `${d.hooks.length} হুক ভ্যারিয়েন্ট তৈরি ✨`, description: `A/B/C/D/E — ${d.provider}` });
      load();
    } finally { setBusy(null); }
  };

  const declareWinner = async (topic: string) => {
    setBusy(`winner-${topic}`);
    try {
      const res = await fetch("/api/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "declare_winner", topic }),
      });
      const d = await res.json();
      if (d.error) { toast({ title: d.error, variant: "destructive" }); }
      else { toast({ title: `Winner: Variant ${d.winner.variant} 🏆`, description: `${d.winner.hookRetention}% retention` }); }
      load();
    } finally { setBusy(null); }
  };

  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 rounded-xl alo-shimmer" />)}
      </div>
    );
  }

  const s = data.stats;
  const scoreColor = (score: number) => score >= 90 ? "text-emerald-600" : score >= 80 ? "text-amber-600" : "text-rose-600";

  return (
    <div className="alo-fade-up space-y-5">
      <SectionHeader
        title="Growth Loop"
        bn="গ্রোথ লুপ"
        desc="সম্পূর্ণ কনটেন্ট-গ্রোথ সাইকেল: Research → Select → Create → Check → Publish → Measure → Learn → Recreate Better. শুধু ভিডিও নয় — সম্পূর্ণ অডিয়েন্স-বিল্ডিং ইঞ্জিন।"
        icon={<TrendingUp className="h-5 w-5" />}
      />

      {/* Growth stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <StatCard label="অপার্চুনিটি স্কোর" value={s.avgScore} sub={`${s.approvedOpportunities}/${s.totalOpportunities} approved`} icon={<Target className="h-4 w-4" />} tone="amber" />
        <StatCard label="হুক টেস্ট" value={s.activeHookTests} sub={`${s.hookWinners} winners`} icon={<FlaskConical className="h-4 w-4" />} tone="violet" />
        <StatCard label="সক্রিয় ক্যাম্পেইন" value={s.activeCampaigns} sub={`${s.measuredCampaigns} measured`} icon={<FolderPlus className="h-4 w-4" />} tone="emerald" />
        <StatCard label="মোট ভিউ" value={s.totalViews.toLocaleString()} sub="campaigns" icon={<BarChart3 className="h-4 w-4" />} tone="sky" />
        <StatCard label="অডিয়েন্স রেলেভেন্স" value={`${s.avgAudienceRelevance}%`} sub="relevant parents" icon={<Users className="h-4 w-4" />} tone="rose" />
      </div>

      {/* Loop cycle visualization */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="h-4 w-4 text-amber-600" />
          <h3 className="font-semibold text-sm">গ্রোথ লুপ সাইকেল</h3>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto alo-scrollbar pb-2">
          {LOOP_STAGES.map((stage, i) => (
            <div key={stage.id} className="flex items-center shrink-0">
              <div className="rounded-lg border border-border/60 p-2.5 min-w-[90px] text-center bg-muted/20">
                <div className="text-xl">{stage.icon}</div>
                <p className="text-[10px] font-bold mt-1">{stage.label}</p>
                <p className="text-[8px] text-muted-foreground">{stage.bn}</p>
              </div>
              {i < LOOP_STAGES.length - 1 && <ArrowRight className="h-3 w-3 text-amber-500 mx-0.5 shrink-0" />}
            </div>
          ))}
          <div className="text-lg ml-1 text-amber-500">↺</div>
        </div>
      </Card>

      <Tabs defaultValue="opportunities">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="opportunities" className="text-xs"><Target className="h-3 w-3 mr-1" />Opportunity</TabsTrigger>
          <TabsTrigger value="hooks" className="text-xs"><FlaskConical className="h-3 w-3 mr-1" />Hook A/B</TabsTrigger>
          <TabsTrigger value="campaigns" className="text-xs"><FolderPlus className="h-3 w-3 mr-1" />Campaigns</TabsTrigger>
        </TabsList>

        {/* OPPORTUNITY TAB */}
        <TabsContent value="opportunities" className="mt-4 space-y-3">
          <Card className="p-4 alo-card-grad border-0">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-600" /> টপিক স্কোর করুন
            </h3>
            <div className="flex gap-2">
              <Input value={topicInput} onChange={(e) => setTopicInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && scoreTopic()} placeholder="যেমন: ২ বছরের শিশুকে রং শেখানো" className="h-9" />
              <Button onClick={scoreTopic} disabled={busy === "score"} className="bg-amber-500 hover:bg-amber-600">
                {busy === "score" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Target className="h-4 w-4 mr-1" />}
                স্কোর করুন
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">৮০+ স্কোর = প্রোডাকশনে অনুমোদিত। ৬ ডাইমেনশনে LLM স্কোরিং।</p>
          </Card>

          {data.opportunities.length === 0 ? (
            <Card className="p-12 text-center">
              <Target className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">কোনো স্কোর করা টপিক নেই। উপরে টপিক দিন।</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {data.opportunities.map((o, i) => (
                <Card key={o.id} className="p-4 alo-stagger alo-glow-hover" style={{ animationDelay: `${i * 30}ms` }}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm truncate">{o.topic}</p>
                        {o.approved && <Badge className="bg-emerald-100 text-emerald-700 text-[9px]">✓ Approved</Badge>}
                        <ProviderTag provider={o.provider} fallback={o.provider === "local-fallback"} />
                      </div>
                      <p className="text-[11px] text-muted-foreground">{o.rationale ?? "—"}</p>
                    </div>
                    <div className="text-center shrink-0">
                      <p className={`text-2xl font-bold ${scoreColor(o.finalScore)}`}>{o.finalScore}</p>
                      <p className="text-[9px] text-muted-foreground">/100</p>
                    </div>
                  </div>
                  {/* Score breakdown */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mt-2">
                    {[
                      { label: "Search", value: o.searchDemand },
                      { label: "Parent", value: o.parentRelevance },
                      { label: "BD", value: o.bangladeshRelevance },
                      { label: "Comp.", value: o.competition },
                      { label: "Video", value: o.videoPotential },
                      { label: "Brand", value: o.brandFit },
                    ].map((d) => (
                      <div key={d.label} className="text-center">
                        <p className="text-[8px] text-muted-foreground">{d.label}</p>
                        <p className={`text-xs font-bold ${scoreColor(d.value)}`}>{d.value}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* HOOK A/B TAB */}
        <TabsContent value="hooks" className="mt-4 space-y-3">
          <Card className="p-4 alo-card-grad border-0">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-violet-600" /> হুক A/B টেস্ট
            </h3>
            <div className="flex gap-2">
              <Input value={hookTopic} onChange={(e) => setHookTopic(e.target.value)} onKeyDown={(e) => e.key === "Enter" && generateHooks()} placeholder="টপিক দিন" className="h-9" />
              <Button onClick={generateHooks} disabled={busy === "hooks"} className="bg-violet-600 hover:bg-violet-700">
                {busy === "hooks" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                ৫ হুক তৈরি
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">৫টি ভিন্ন সাইকোলজিক্যাল স্ট্র্যাটেজি (curiosity, shock, question, benefit, story)।</p>
          </Card>

          {data.hookTests.length === 0 ? (
            <Card className="p-12 text-center">
              <FlaskConical className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">কোনো হুক টেস্ট নেই। টপিক দিন।</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {/* Group by topic */}
              {Array.from(new Set(data.hookTests.map((h) => h.topic))).map((topic) => {
                const hooks = data.hookTests.filter((h) => h.topic === topic);
                const hasCompleted = hooks.some((h) => h.status === "completed");
                const winner = hooks.find((h) => h.isWinner);
                return (
                  <Card key={topic} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-semibold text-sm">{topic}</p>
                      {hasCompleted && !winner && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => declareWinner(topic)} disabled={busy === `winner-${topic}`}>
                          {busy === `winner-${topic}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Trophy className="h-3 w-3 mr-1" />}
                          Winner নির্বাচন
                        </Button>
                      )}
                      {winner && <Badge className="bg-amber-100 text-amber-700 text-[9px]"><Trophy className="h-2.5 w-2.5 mr-0.5" />Winner: {winner.variant}</Badge>}
                    </div>
                    <div className="space-y-1.5">
                      {hooks.map((h) => (
                        <div key={h.id} className={`flex items-center gap-3 p-2 rounded-lg ${h.isWinner ? "bg-amber-50 dark:bg-amber-900/10 border border-amber-200" : "bg-muted/30"}`}>
                          <span className="rounded-full bg-violet-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center shrink-0">{h.variant}</span>
                          <p className="text-xs flex-1 min-w-0 truncate">{h.hookText}</p>
                          {h.status === "completed" && (
                            <div className="flex items-center gap-2 text-[10px] shrink-0">
                              <span title="3-sec retention">{h.hookRetention}%</span>
                              <span title="watch time">{h.watchTime}s</span>
                            </div>
                          )}
                          <StatusPill status={h.isWinner ? "approved" : h.status === "completed" ? "safe" : "pending"} />
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* CAMPAIGNS TAB */}
        <TabsContent value="campaigns" className="mt-4 space-y-3">
          {data.campaigns.length === 0 ? (
            <Card className="p-12 text-center">
              <FolderPlus className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">কোনো ক্যাম্পেইন নেই।</p>
              <p className="text-xs text-muted-foreground mt-1">অনুমোদিত টপিক থেকে ক্যাম্পেইন তৈরি করুন।</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {data.campaigns.map((c, i) => (
                <Card key={c.id} className="p-4 alo-stagger" style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm">{c.title}</p>
                      <p className="text-[11px] text-muted-foreground">{c.topic}</p>
                    </div>
                    <StatusPill status={c.status === "published" ? "approved" : c.status === "measured" ? "safe" : c.status === "learned" ? "safe" : "pending"} />
                  </div>
                  {c.status === "measured" || c.status === "learned" ? (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-2">
                      {[
                        { label: "Views", value: c.views.toLocaleString() },
                        { label: "Reach", value: c.reach.toLocaleString() },
                        { label: "Engagement", value: `${c.engagement}%` },
                        { label: "Followers", value: `+${c.followerGain}` },
                        { label: "Relevance", value: `${c.audienceRelevance}%` },
                        { label: "Conversion", value: `${c.conversionRate}%` },
                      ].map((m) => (
                        <div key={m.label} className="text-center">
                          <p className="text-[8px] text-muted-foreground uppercase">{m.label}</p>
                          <p className="text-xs font-bold">{m.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
                      <span>📊 {c.platformCount} platforms</span>
                      <span>📦 {c.totalAssets} assets</span>
                    </div>
                  )}
                  {c.lesson && (
                    <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2 text-[11px] text-amber-800 dark:bg-amber-900/10 dark:text-amber-200">
                      <strong>শিক্ষা:</strong> {c.lesson}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Honest note */}
      <Card className="p-4 bg-amber-50 border-amber-200 dark:bg-amber-900/10">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 dark:text-amber-200">
            <p className="font-semibold">সততার নীতি</p>
            <p className="mt-1">
              এই সিস্টেম &quot;ভাইরাল গ্যারান্টি&quot; দেয় না। এটি সম্ভাব্যতা বাড়ায় — সঠিক অডিয়েন্স (বাংলাদেশি বাবা-মা)
              খুঁজে পাওয়া, একাধিক creative variant টেস্ট করা, পারফরম্যান্স থেকে শেখা, এবং পরবর্তী কনটেন্ট উন্নত করা।
              ভিউ নয় — relevant audience বৃদ্ধিই আসল লক্ষ্য।
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
