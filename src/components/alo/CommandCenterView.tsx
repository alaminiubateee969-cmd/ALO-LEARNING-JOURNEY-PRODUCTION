"use client";

import { useState } from "react";
import { SectionHeader, StatusPill, ProviderTag } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Terminal, Loader2, Sparkles, Send, TrendingUp, Video, FileText, Calendar, BarChart3 } from "lucide-react";

const COMMAND_SUGGESTIONS = [
  { cmd: "Create today's parenting content.", bn: "আজকের কনটেন্ট তৈরি করুন", icon: "✨" },
  { cmd: "Find 5 high-potential Bangla parenting topics.", bn: "৫টি টপিক খুঁজুন", icon: "🔍" },
  { cmd: "Make a 60-second video about teaching colors.", bn: "৬০ সেকেন্ডের ভিডিও", icon: "🎬" },
  { cmd: "Generate SEO article about baby sleep.", bn: "SEO আর্টিকেল", icon: "📝" },
  { cmd: "Create next week's content calendar.", bn: "ক্যালেন্ডার তৈরি করুন", icon: "📅" },
  { cmd: "Show yesterday's best-performing content.", bn: "অ্যানালিটিক্স দেখুন", icon: "📊" },
];

export default function CommandCenterView() {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const execute = async (cmd?: string) => {
    const command = cmd || input;
    if (!command.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      const data = await res.json();
      setResult(data);
      toast({
        title: `Intent: ${data.parsed?.intent}`,
        description: `Action: ${data.action} (${data.provider})`,
      });
    } catch (e) {
      toast({ title: "Command failed", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="alo-fade-up space-y-5">
      <SectionHeader
        title="Command Center"
        bn="কমান্ড সেন্টার"
        desc="প্রাকৃতিক ভাষায় কমান্ড দিন — বাংলা বা English। MasterOrchestratorAgent কমান্ড বুঝে সঠিক এজেন্ট ট্রিগার করবে।"
        icon={<Terminal className="h-5 w-5" />}
      />

      {/* Command input */}
      <Card className="p-4 alo-card-grad border-0">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && execute()}
            placeholder='যেমন: "৫টি প্যারেন্টিং টপিক খুঁজুন" বা "৬০ সেকেন্ডের ভিডিও তৈরি করুন"'
            className="h-10"
          />
          <Button onClick={() => execute()} disabled={loading} className="bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        {/* Suggestions */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {COMMAND_SUGGESTIONS.map((s) => (
            <button
              key={s.cmd}
              onClick={() => { setInput(s.cmd); execute(s.cmd); }}
              className="rounded-full bg-muted hover:bg-amber-100 hover:text-amber-700 px-2.5 py-1 text-[10px] transition-colors flex items-center gap-1"
            >
              <span>{s.icon}</span>
              <span className="truncate max-w-[120px]">{s.bn}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Result */}
      {result && (
        <Card className="p-5 alo-fade-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" /> ফলাফল
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[9px]">{result.parsed?.intent}</Badge>
              <ProviderTag provider={result.provider} fallback={result.provider === "local-fallback"} />
            </div>
          </div>

          <ScrollArea className="max-h-96 alo-scrollbar pr-2">
            {/* Intent-specific display */}
            {result.action === "ideas_generated" && result.ideas && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-2">Generated {result.ideas.length} ideas via {result.ideasProvider}:</p>
                {result.ideas.map((idea: any, i: number) => (
                  <div key={i} className="rounded-lg border border-border/60 p-3 alo-stagger" style={{ animationDelay: `${i * 50}ms` }}>
                    <p className="font-semibold text-sm">{idea.topic}</p>
                    <p className="text-xs text-muted-foreground italic mt-1">"{idea.hook}"</p>
                    <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
                      <span>📌 {idea.angle}</span>
                      <span>👥 {idea.audience}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {result.action === "topic_scored" && result.score && (
              <div className="space-y-3">
                <div className="text-center">
                  <p className={`text-4xl font-bold ${result.score.finalScore >= 80 ? "text-emerald-600" : result.score.finalScore >= 60 ? "text-amber-600" : "text-rose-600"}`}>
                    {result.score.finalScore}
                  </p>
                  <p className="text-xs text-muted-foreground">/100</p>
                  {result.score.finalScore >= 80 && <Badge className="bg-emerald-100 text-emerald-700 mt-2">✓ Approved for production</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{result.score.rationale}</p>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries({
                    "Search": result.score.searchDemand,
                    "Parent": result.score.parentRelevance,
                    "BD": result.score.bangladeshRelevance,
                    "Comp.": result.score.competition,
                    "Video": result.score.videoPotential,
                    "Brand": result.score.brandFit,
                  }).map(([k, v]: [string, any]) => (
                    <div key={k} className="text-center rounded-lg bg-muted/40 p-2">
                      <p className="text-[9px] text-muted-foreground">{k}</p>
                      <p className="text-sm font-bold">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.action === "video_params_ready" && result.videoParams && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Video generation parameters ready:</p>
                <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
                  <p><strong>Topic:</strong> {result.videoParams.topic}</p>
                  <p><strong>Duration:</strong> {result.videoParams.duration}s</p>
                  <p><strong>Platforms:</strong> {result.videoParams.platforms.join(", ")}</p>
                  <p><strong>Characters:</strong> {result.videoParams.characters.join(", ") || "none specified"}</p>
                </div>
                <p className="text-[11px] text-amber-600">Call POST /api/video/cinematic with these params to generate the video.</p>
              </div>
            )}

            {result.action === "calendar_ready" && result.calendar && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.calendar.map((day: any, i: number) => (
                  <div key={i} className="rounded-lg border border-border/60 p-2 text-xs">
                    <p className="font-semibold">{day.day}</p>
                    <p className="text-muted-foreground">{day.theme}</p>
                    <Badge variant="outline" className="text-[8px] mt-1">{day.category}</Badge>
                  </div>
                ))}
              </div>
            )}

            {result.action === "analytics_summary" && (
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center rounded-lg bg-muted/40 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Views</p>
                  <p className="text-xl font-bold">{result.totalViews?.toLocaleString()}</p>
                </div>
                <div className="text-center rounded-lg bg-muted/40 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Reach</p>
                  <p className="text-xl font-bold">{result.totalReach?.toLocaleString()}</p>
                </div>
                <div className="text-center rounded-lg bg-muted/40 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Shares</p>
                  <p className="text-xl font-bold">{result.totalShares?.toLocaleString()}</p>
                </div>
              </div>
            )}

            {result.action === "publish_check" && (
              <div className="text-center py-4">
                <p className="text-sm">{result.message}</p>
                {result.pendingApprovals > 0 && (
                  <Badge className="bg-amber-100 text-amber-700 mt-2">{result.pendingApprovals} pending</Badge>
                )}
              </div>
            )}

            {(result.action === "content_brief_ready" || result.action === "create_content") && (
              <div className="text-center py-4">
                <p className="text-sm">{result.message}</p>
              </div>
            )}
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}
