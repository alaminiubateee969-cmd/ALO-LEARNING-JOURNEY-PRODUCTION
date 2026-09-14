"use client";

import { useState } from "react";
import { SectionHeader, StatusPill, ProviderTag } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, FileText, CheckCircle2 } from "lucide-react";
import { CATEGORIES, AGE_GROUPS, SEO_CLUSTERS } from "@/lib/content-categories";

interface Brief {
  title: string;
  category: string;
  ageGroup: string;
  searchIntent: string;
  targetKeywords: string[];
  contentOutline: { heading: string; points: string[] }[];
  faqs: { q: string; a: string }[];
  seoTitle: string;
  metaDescription: string;
  schemaType: string;
  internalLinks: string[];
  estimatedReadTime: number;
  qualityScore: number;
}

export default function SeoView() {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("parenting");
  const [ageGroup, setAgeGroup] = useState("1-2y");
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [provider, setProvider] = useState("");

  const generate = async () => {
    if (!topic.trim()) { toast({ title: "টপিক দিন", variant: "destructive" }); return; }
    setLoading(true);
    setBrief(null);
    try {
      const res = await fetch("/api/content/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, category, ageGroup }),
      });
      const data = await res.json();
      setBrief(data.brief);
      setProvider(data.provider);
      toast({
        title: data.publishReady ? "SEO Brief তৈরি ✅ (publish-ready)" : `স্কোর: ${data.brief.qualityScore}/100`,
        description: `Provider: ${data.provider}`,
      });
    } finally { setLoading(false); }
  };

  return (
    <div className="alo-fade-up space-y-5">
      <SectionHeader
        title="SEO Command Center"
        bn="এসইও কমান্ড সেন্টার"
        desc="রিয়েল LLM দিয়ে কনটেন্ট ব্রিফ তৈরি — keyword cluster, content outline, FAQ, SEO title, meta description, schema। ৮৫+ স্কোর = publish-ready।"
        icon={<Search className="h-5 w-5" />}
      />

      {/* SEO clusters overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {SEO_CLUSTERS.map((cluster, i) => (
          <Card key={i} className="p-4 alo-stagger alo-glow-hover" style={{ animationDelay: `${i * 50}ms` }}>
            <p className="font-semibold text-sm">{cluster.bn}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{cluster.name}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {cluster.keywords.slice(0, 3).map((kw) => (
                <Badge key={kw} variant="outline" className="text-[8px] truncate max-w-[100px]">{kw}</Badge>
              ))}
            </div>
            <p className="text-[9px] text-muted-foreground mt-2">{cluster.subtopics.length} subtopics</p>
          </Card>
        ))}
      </div>

      {/* Brief generation form */}
      <Card className="p-4 alo-card-grad border-0">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-amber-600" /> কনটেন্ট ব্রিফ তৈরি করুন
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <Label className="text-xs">টপিক</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => e.key === "Enter" && generate()} placeholder="শিশুর ঘুমের রুটিন" className="h-9 mt-1" />
          </div>
          <div>
            <Label className="text-xs">ক্যাটাগরি</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-60">
                {CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">বয়স গ্রুপ</Label>
            <Select value={ageGroup} onValueChange={setAgeGroup}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AGE_GROUPS.map((a) => <SelectItem key={a.id} value={a.id}>{a.icon} {a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={generate} disabled={loading} className="bg-amber-500 hover:bg-amber-600">
          {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
          ব্রিফ তৈরি করুন
        </Button>
      </Card>

      {/* Brief result */}
      {brief && (
        <Card className="p-5 alo-fade-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-600" /> {brief.title}
            </h3>
            <div className="flex items-center gap-2">
              <ProviderTag provider={provider} fallback={provider === "local-fallback"} />
              <Badge className={brief.qualityScore >= 85 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                {brief.qualityScore >= 85 ? <><CheckCircle2 className="h-3 w-3 mr-0.5" />Publish-ready</> : `Score: ${brief.qualityScore}`}
              </Badge>
            </div>
          </div>

          <div className="space-y-4 text-sm">
            {/* Keywords */}
            <div>
              <p className="text-xs font-semibold mb-1">Target Keywords</p>
              <div className="flex flex-wrap gap-1">
                {brief.targetKeywords.map((kw) => <Badge key={kw} variant="outline" className="text-[10px]">{kw}</Badge>)}
              </div>
            </div>

            {/* SEO metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded-lg bg-muted/40 p-2">
                <p className="text-[10px] text-muted-foreground">SEO Title</p>
                <p className="text-xs font-medium">{brief.seoTitle}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-2">
                <p className="text-[10px] text-muted-foreground">Meta Description</p>
                <p className="text-xs">{brief.metaDescription}</p>
              </div>
            </div>

            {/* Outline */}
            <div>
              <p className="text-xs font-semibold mb-1">Content Outline</p>
              <div className="space-y-1.5">
                {brief.contentOutline.map((section, i) => (
                  <div key={i} className="rounded-lg border border-border/40 p-2">
                    <p className="text-xs font-medium">{i + 1}. {section.heading}</p>
                    <ul className="text-[11px] text-muted-foreground ml-4 mt-0.5">
                      {section.points.map((p, j) => <li key={j}>• {p}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* FAQs */}
            <div>
              <p className="text-xs font-semibold mb-1">FAQs ({brief.faqs.length})</p>
              <div className="space-y-1">
                {brief.faqs.map((faq, i) => (
                  <div key={i} className="rounded-lg bg-muted/30 p-2">
                    <p className="text-xs font-medium">Q: {faq.q}</p>
                    <p className="text-[11px] text-muted-foreground">A: {faq.a}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>Schema: {brief.schemaType}</span>
              <span>Read time: {brief.estimatedReadTime} min</span>
              <span>Intent: {brief.searchIntent}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
