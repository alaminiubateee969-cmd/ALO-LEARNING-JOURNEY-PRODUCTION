"use client";

import { useEffect, useState } from "react";
import { SectionHeader, ProviderTag } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { TOPIC_PRESETS } from "@/lib/platforms";
import PipelineRunner from "./PipelineRunner";
import { Sparkles, Loader2, FileText, Image as ImageIcon, Mic, Hash, Tag, Cpu, ShieldCheck, BookOpen } from "lucide-react";

interface Pkg {
  reelScript: string;
  hooks: string[];
  seoKeywords: string[];
  captions: Record<string, string>;
  hashtags: string[];
  imagePrompt: string;
  voiceDirection: string;
  cta: string;
  disclaimerBn: string;
  qualityScore: number;
  ragCitations: { title: string; type: string; relevance: number }[];
}

export default function ContentStudio({
  seed,
  onConsumeSeed,
}: {
  seed?: { topic: string; audience: string } | null;
  onConsumeSeed?: () => void;
}) {
  const { toast } = useToast();
  const [topic, setTopic] = useState(TOPIC_PRESETS[0].topic);
  const [audience, setAudience] = useState(TOPIC_PRESETS[0].audience);
  const [loading, setLoading] = useState(false);
  const [pkg, setPkg] = useState<Pkg | null>(null);
  const [meta, setMeta] = useState<{ provider: string; usedFallback: boolean; latencyMs: number } | null>(null);
  const [ragQuery, setRagQuery] = useState("");
  const [ragResults, setRagResults] = useState<any[]>([]);
  const [ragLoading, setRagLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageMeta, setImageMeta] = useState<{ provider: string; usedFallback: boolean } | null>(null);

  // Consume promoted seed from Topics view
  useEffect(() => {
    if (seed) {
      setTopic(seed.topic);
      setAudience(seed.audience);
      onConsumeSeed?.();
    }
  }, [seed, onConsumeSeed]);

  const generate = async () => {
    if (!topic.trim()) {
      toast({ title: "টপিক দিন", description: "একটি টপিক লিখুন বা প্রিসেট বাছুন।", variant: "destructive" });
      return;
    }
    setLoading(true);
    setPkg(null);
    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, audience }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed");
      setPkg(data.full);
      setMeta({ provider: data.provider, usedFallback: data.usedFallback, latencyMs: data.latencyMs });
      toast({
        title: data.usedFallback ? "Local fallback দিয়ে তৈরি হয়েছে" : "LLM দিয়ে তৈরি হয়েছে",
        description: `Provider: ${data.provider} · ${data.latencyMs}ms · Approval queue-তে যুক্ত হয়েছে`,
      });
    } catch (e) {
      toast({ title: "ব্যর্থ", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const searchRag = async () => {
    if (!ragQuery.trim()) return;
    setRagLoading(true);
    try {
      const res = await fetch("/api/rag/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: ragQuery }),
      });
      const data = await res.json();
      setRagResults(data.results);
    } finally {
      setRagLoading(false);
    }
  };

  const generateImage = async () => {
    if (!pkg?.imagePrompt) return;
    setImageLoading(true);
    setImageUrl(null);
    setImageMeta(null);
    try {
      const res = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: pkg.imagePrompt,
          filename: `alo_${Date.now()}`,
        }),
      });
      const data = await res.json();
      setImageUrl(data.url);
      setImageMeta({ provider: data.provider, usedFallback: data.usedFallback });
      toast({
        title: data.usedFallback ? "Local placeholder তৈরি হয়েছে" : "ইমেজ তৈরি হয়েছে ✨",
        description: data.usedFallback ? "provider_missing — SVG placeholder" : `Provider: ${data.provider}`,
      });
    } catch (e) {
      toast({ title: "ইমেজ তৈরি ব্যর্থ", description: String(e), variant: "destructive" });
    } finally {
      setImageLoading(false);
    }
  };

  return (
    <div className="alo-fade-up">
      <SectionHeader
        title="Content Studio"
        bn="কনটেন্ট স্টুডিও"
        desc="একটি টপিক দিন → TrendResearch → RAG → Writer → Hook → SEO → Caption → Hashtag → ImagePrompt → Voice → Quality — সব একসাথে প্যাকেজ, Approval queue-এ।"
        icon={<Sparkles className="h-5 w-5" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Input panel */}
        <Card className="p-5 lg:col-span-1">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-600" /> টপিক ইনপুট
          </h3>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">টপিক</Label>
              <Textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={3}
                placeholder="যেমন: ১৮ মাসের শিশুর ভাষা বিকাশে মায়ের ভূমিকা"
              />
            </div>
            <div>
              <Label className="text-xs">টার্গেট অডিয়েন্স</Label>
              <Input value={audience} onChange={(e) => setAudience(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">দ্রুত প্রিসেট</Label>
              <div className="flex flex-wrap gap-1.5">
                {TOPIC_PRESETS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => { setTopic(p.topic); setAudience(p.audience); }}
                    className="rounded-full bg-muted hover:bg-amber-100 hover:text-amber-700 px-2.5 py-1 text-[10px] transition-colors text-left max-w-[180px] truncate"
                    title={p.topic}
                  >
                    {p.topic.slice(0, 22)}…
                  </button>
                ))}
              </div>
            </div>
            <Button
              onClick={generate}
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> এজেন্ট কাজ করছে…</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> প্যাকেজ তৈরি করুন</>
              )}
            </Button>
            {meta && (
              <div className="rounded-lg bg-muted/50 p-2.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Provider</span>
                  <ProviderTag provider={meta.provider} fallback={meta.usedFallback} />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-muted-foreground">Latency</span>
                  <span className="font-medium">{meta.latencyMs}ms</span>
                </div>
              </div>
            )}
          </div>

          {/* RAG mini-search */}
          <div className="mt-5 pt-4 border-t border-border/50">
            <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
              <BookOpen className="h-3 w-3 text-violet-600" /> RAG দ্রুত খুঁজুন
            </h4>
            <div className="flex gap-2">
              <Input
                value={ragQuery}
                onChange={(e) => setRagQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchRag()}
                placeholder="যেমন: স্ক্রিন টাইম"
                className="text-xs h-8"
              />
              <Button size="sm" variant="outline" onClick={searchRag} disabled={ragLoading}>
                {ragLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "খুঁজুন"}
              </Button>
            </div>
            {ragResults.length > 0 && (
              <ScrollArea className="h-32 alo-scrollbar mt-2">
                <div className="space-y-1.5">
                  {ragResults.map((r, i) => (
                    <div key={i} className="rounded border border-border/40 p-2 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{r.source_title}</span>
                        <Badge variant="outline" className="text-[9px]">{(r.relevance_score * 100).toFixed(0)}%</Badge>
                      </div>
                      <p className="text-muted-foreground line-clamp-2 mt-0.5">{r.retrieved_text}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </Card>

        {/* Output panel */}
        <Card className="p-5 lg:col-span-2 min-h-[500px]">
          {!pkg && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-center py-16 text-muted-foreground">
              <Sparkles className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">এখানে সম্পূর্ণ কনটেন্ট প্যাকেজ দেখা যাবে</p>
              <p className="text-xs mt-1">টপিক দিন এবং &quot;প্যাকেজ তৈরি করুন&quot; চাপুন</p>
            </div>
          )}
          {loading && (
            <div className="h-full flex flex-col items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500 mb-3" />
              <p className="text-sm font-medium mb-4">এজেন্ট পাইপলাইন চলছে…</p>
              <div className="w-full">
                <PipelineRunner active={loading} />
              </div>
            </div>
          )}
          {pkg && (
            <Tabs defaultValue="script" className="w-full">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                    <ShieldCheck className="h-3 w-3 mr-1" /> Protective Mode: pending
                  </Badge>
                  <Badge variant="outline">Quality {pkg.qualityScore}/100</Badge>
                </div>
                <span className="text-[11px] text-muted-foreground">Approval queue-এ যুক্ত</span>
              </div>
              <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto">
                <TabsTrigger value="script" className="text-[11px] py-1.5"><FileText className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Script</span></TabsTrigger>
                <TabsTrigger value="hooks" className="text-[11px] py-1.5"><Sparkles className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Hooks</span></TabsTrigger>
                <TabsTrigger value="captions" className="text-[11px] py-1.5"><FileText className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Captions</span></TabsTrigger>
                <TabsTrigger value="seo" className="text-[11px] py-1.5"><Tag className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">SEO</span></TabsTrigger>
                <TabsTrigger value="media" className="text-[11px] py-1.5"><ImageIcon className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Media</span></TabsTrigger>
                <TabsTrigger value="rag" className="text-[11px] py-1.5"><BookOpen className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">RAG</span></TabsTrigger>
              </TabsList>

              <TabsContent value="script" className="mt-3">
                <div className="rounded-lg bg-muted/40 p-4 whitespace-pre-wrap text-sm font-mono leading-relaxed">
                  {pkg.reelScript}
                </div>
                <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                  <strong>CTA:</strong> {pkg.cta}
                </div>
                <div className="mt-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
                  <strong>Disclaimer:</strong> {pkg.disclaimerBn}
                </div>
              </TabsContent>

              <TabsContent value="hooks" className="mt-3 space-y-2">
                {pkg.hooks.map((h, i) => (
                  <div key={i} className="rounded-lg border border-border/60 p-3 flex items-start gap-3">
                    <span className="rounded-full bg-amber-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center shrink-0">{i + 1}</span>
                    <p className="text-sm">{h}</p>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="captions" className="mt-3">
                <ScrollArea className="h-96 alo-scrollbar pr-2">
                  <div className="space-y-2">
                    {Object.entries(pkg.captions).map(([platform, caption]) => (
                      <div key={platform} className="rounded-lg border border-border/60 p-3">
                        <Badge variant="outline" className="text-[10px] capitalize mb-1.5">{platform}</Badge>
                        <p className="text-sm whitespace-pre-wrap">{caption}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="seo" className="mt-3 space-y-3">
                <div>
                  <p className="text-xs font-semibold mb-1.5 flex items-center gap-1"><Tag className="h-3 w-3" /> SEO Keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pkg.seoKeywords.map((k) => (
                      <Badge key={k} variant="outline" className="text-[10px]">{k}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold mb-1.5 flex items-center gap-1"><Hash className="h-3 w-3" /> Hashtags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pkg.hashtags.map((h) => (
                      <Badge key={h} variant="outline" className="text-[10px] bg-emerald-50 border-emerald-200 text-emerald-700">{h}</Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="media" className="mt-3 space-y-3">
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs font-semibold mb-1 flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Image Prompt</p>
                  <p className="text-sm text-muted-foreground">{pkg.imagePrompt}</p>
                </div>
                {/* Image generation */}
                <div className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold flex items-center gap-1">
                      <ImageIcon className="h-3 w-3 text-amber-600" /> ImageGeneratorAgent
                    </p>
                    <Button size="sm" onClick={generateImage} disabled={imageLoading} className="h-7 text-xs bg-amber-500 hover:bg-amber-600">
                      {imageLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      ইমেজ তৈরি করুন
                    </Button>
                  </div>
                  {imageLoading && (
                    <div className="aspect-square w-full max-w-sm mx-auto rounded-lg alo-shimmer" />
                  )}
                  {imageUrl && !imageLoading && (
                    <div className="space-y-2">
                      <div className="relative aspect-square w-full max-w-sm mx-auto rounded-lg overflow-hidden border border-border/60 bg-muted/30">
                        <img src={imageUrl} alt="Generated content visual" className="w-full h-full object-cover" />
                      </div>
                      {imageMeta && (
                        <div className="flex items-center justify-center gap-2 text-[10px]">
                          <span className="text-muted-foreground">Provider:</span>
                          <span className={`rounded-md px-1.5 py-0.5 font-medium ${imageMeta.usedFallback ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {imageMeta.usedFallback ? "local placeholder (provider_missing)" : imageMeta.provider}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {!imageUrl && !imageLoading && (
                    <p className="text-[11px] text-muted-foreground text-center py-4">
                      ImagePromptAgent-এর প্রম্পট থেকে ইমেজ তৈরি করতে উপরের বাটন চাপুন।
                    </p>
                  )}
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs font-semibold mb-1 flex items-center gap-1"><Mic className="h-3 w-3" /> Voice Direction</p>
                  <p className="text-sm text-muted-foreground">{pkg.voiceDirection}</p>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs">
                  <p className="font-semibold text-amber-800 flex items-center gap-1"><Cpu className="h-3 w-3" /> Video/Voice generation</p>
                  <p className="text-amber-700 mt-1">এই পরিবেশে FFmpeg/TTS নেই — external_setup_required। Voice ও Video এজেন্ট প্রদানকারী কল করবে। ইমেজ জেনারেশন উপলব্ধ (উপরে)।</p>
                </div>
              </TabsContent>

              <TabsContent value="rag" className="mt-3">
                <div className="space-y-2">
                  {pkg.ragCitations.map((c, i) => (
                    <div key={i} className="rounded-lg border border-border/60 p-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{c.title}</p>
                        <p className="text-[11px] text-muted-foreground">type: {c.type}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{(c.relevance * 100).toFixed(0)}% match</Badge>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </Card>
      </div>
    </div>
  );
}
