"use client";

import { useEffect, useState } from "react";
import { SectionHeader, StatusPill } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { History, Loader2, FileText, Sparkles, Hash, Tag, Image as ImageIcon, Mic, CheckCircle2 } from "lucide-react";

interface Pkg {
  id: string;
  topic: string;
  reelScript: string;
  hooksJson: string;
  seoKeywords: string;
  captionsJson: string;
  hashtagsJson: string;
  imagePrompt: string;
  voiceDirection: string;
  cta: string;
  disclaimerBn: string;
  qualityScore: number;
  safetyStatus: string;
  ragCitations: string;
  createdAt: string;
}

export default function PackageHistoryView({ onDuplicate }: { onDuplicate?: (topic: string) => void }) {
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Pkg | null>(null);

  useEffect(() => {
    fetch("/api/content/package")
      .then((r) => r.json())
      .then((d) => setPackages(d.packages))
      .finally(() => setLoading(false));
  }, []);

  const safeParse = (s: string | null, fallback: any) => {
    if (!s) return fallback;
    try { return JSON.parse(s); } catch { return fallback; }
  };

  return (
    <div className="alo-fade-up">
      <SectionHeader
        title="Content History"
        bn="কনটেন্ট ইতিহাস"
        desc="ContentWriterAgent দ্বারা তৈরি সকল প্যাকেজ ব্রাউজ করুন। সম্পূর্ণ স্ক্রিপ্ট, ক্যাপশন, হুক ও কোয়ালিটি স্কোর দেখুন।"
        icon={<History className="h-5 w-5" />}
        action={
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
            <History className="h-3 w-3 mr-1" /> {packages.length} প্যাকেজ
          </Badge>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl alo-shimmer" />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <Card className="p-12 text-center">
          <History className="h-12 w-12 mx-auto mb-3 text-amber-400" />
          <p className="font-medium text-sm">কোনো প্যাকেজ নেই</p>
          <p className="text-xs text-muted-foreground mt-1">Content Studio থেকে প্যাকেজ তৈরি করুন।</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {packages.map((p, i) => {
            const hooks = safeParse(p.hooksJson, []);
            const captions = safeParse(p.captionsJson, {});
            const hashtags = safeParse(p.hashtagsJson, []);
            return (
              <Card
                key={p.id}
                onClick={() => setSelected(p)}
                className="p-4 cursor-pointer hover:shadow-md hover:border-amber-300 transition-all alo-stagger alo-glow-hover"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="rounded-lg bg-gradient-to-br from-amber-400/20 to-rose-400/20 p-1.5">
                    <FileText className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[9px]">Q {p.qualityScore}</Badge>
                    <StatusPill status={p.safetyStatus === "pending" ? "pending" : p.safetyStatus === "safe" ? "safe" : "needs_revision"} />
                  </div>
                </div>
                <h3 className="font-semibold text-sm leading-snug line-clamp-2">{p.topic}</h3>
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 italic">
                  &quot;{hooks[0] ?? p.reelScript.slice(0, 60)}&quot;
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[9px]"><Sparkles className="h-2 w-2 mr-0.5" />{hooks.length} hooks</Badge>
                  <Badge variant="outline" className="text-[9px]"><FileText className="h-2 w-2 mr-0.5" />{Object.keys(captions).length} captions</Badge>
                  <Badge variant="outline" className="text-[9px]"><Hash className="h-2 w-2 mr-0.5" />{hashtags.length} tags</Badge>
                </div>
                <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                  <span className="text-amber-600 font-medium">বিস্তারিত →</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-600" /> {selected?.topic}
            </DialogTitle>
            <DialogDescription>
              Q{selected?.qualityScore} · {selected?.safetyStatus} · {selected && new Date(selected.createdAt).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <ScrollArea className="max-h-[60vh] alo-scrollbar pr-3">
              <div className="space-y-4 text-sm">
                {/* Script */}
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs font-semibold mb-1 flex items-center gap-1"><FileText className="h-3 w-3" /> Reel Script</p>
                  <pre className="whitespace-pre-wrap text-xs font-mono text-muted-foreground">{selected.reelScript}</pre>
                </div>

                {/* Hooks */}
                <div>
                  <p className="text-xs font-semibold mb-1.5 flex items-center gap-1"><Sparkles className="h-3 w-3 text-amber-600" /> Hooks ({safeParse(selected.hooksJson, []).length})</p>
                  <div className="space-y-1">
                    {safeParse(selected.hooksJson, []).map((h: string, i: number) => (
                      <div key={i} className="rounded border border-border/40 p-2 text-xs flex items-start gap-2">
                        <span className="rounded-full bg-amber-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center shrink-0">{i + 1}</span>
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Captions */}
                <div>
                  <p className="text-xs font-semibold mb-1.5 flex items-center gap-1"><FileText className="h-3 w-3 text-sky-600" /> Captions ({Object.keys(safeParse(selected.captionsJson, {})).length})</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto alo-scrollbar">
                    {Object.entries(safeParse(selected.captionsJson, {})).map(([platform, caption]: [string, any]) => (
                      <div key={platform} className="rounded border border-border/40 p-2 text-xs">
                        <Badge variant="outline" className="text-[9px] capitalize mb-1">{platform}</Badge>
                        <p className="text-muted-foreground">{caption}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SEO + Hashtags */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-semibold mb-1.5 flex items-center gap-1"><Tag className="h-3 w-3 text-violet-600" /> SEO</p>
                    <div className="flex flex-wrap gap-1">
                      {safeParse(selected.seoKeywords, []).map((k: string) => (
                        <Badge key={k} variant="outline" className="text-[9px]">{k}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-1.5 flex items-center gap-1"><Hash className="h-3 w-3 text-emerald-600" /> Hashtags</p>
                    <div className="flex flex-wrap gap-1">
                      {safeParse(selected.hashtagsJson, []).map((h: string) => (
                        <Badge key={h} variant="outline" className="text-[9px] bg-emerald-50 border-emerald-200 text-emerald-700">{h}</Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Media prompts */}
                <div className="grid grid-cols-1 gap-2">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs font-semibold mb-1 flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Image Prompt</p>
                    <p className="text-xs text-muted-foreground">{selected.imagePrompt}</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs font-semibold mb-1 flex items-center gap-1"><Mic className="h-3 w-3" /> Voice Direction</p>
                    <p className="text-xs text-muted-foreground">{selected.voiceDirection}</p>
                  </div>
                </div>

                {/* CTA + Disclaimer */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                    <p className="text-xs font-semibold text-amber-800 mb-1">CTA</p>
                    <p className="text-xs text-amber-700">{selected.cta}</p>
                  </div>
                  <div className="rounded-lg bg-rose-50 border border-rose-200 p-3">
                    <p className="text-xs font-semibold text-rose-800 mb-1">Disclaimer</p>
                    <p className="text-xs text-rose-700">{selected.disclaimerBn}</p>
                  </div>
                </div>

                {/* RAG citations */}
                <div>
                  <p className="text-xs font-semibold mb-1.5 flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-violet-600" /> RAG Citations</p>
                  <div className="space-y-1">
                    {safeParse(selected.ragCitations, []).map((c: any, i: number) => (
                      <div key={i} className="rounded border border-border/40 p-2 text-xs flex items-center justify-between">
                        <span>{c.title}</span>
                        <Badge variant="outline" className="text-[9px]">{c.type} · {(c.relevance * 100).toFixed(0)}%</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
          {onDuplicate && selected && (
            <div className="border-t border-border/60 px-4 py-3 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">এই প্যাকেজটি Content Studio-তে পুনরায় খুলুন</span>
              <Button
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-xs h-8"
                onClick={() => {
                  onDuplicate(selected.topic);
                  setSelected(null);
                }}
              >
                <Sparkles className="h-3 w-3 mr-1" /> Studio-তে খুলুন
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
