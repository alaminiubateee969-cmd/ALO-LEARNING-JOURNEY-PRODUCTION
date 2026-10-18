"use client";

import { useMemo, useState } from "react";
import { SectionHeader, ProviderTag } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, FileText, Code2, Copy, Globe, ShieldCheck } from "lucide-react";
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

const PSEO_TEMPLATES = [
  { slug: "/study-abroad/uk/masters-2027", title: "Study Masters in the UK (2027 Intake): CAS & Official Checklist", intent: "transactional-informational", schema: "Course" },
  { slug: "/study-abroad/canada/sds-pal-guide", title: "Canada Study Permit & PAL Checklist for Bangladeshi Students", intent: "informational", schema: "FAQPage" },
  { slug: "/study-abroad/germany/aps-blocked-account", title: "Germany APS Certificate & Sperrkonto Step-by-Step Guide", intent: "informational", schema: "HowTo" },
  { slug: "/parenting/1-2y/language-milestones-bn", title: "১৮–২৪ মাসের শিশুর ভাষা বিকাশ ও ১০ মিনিটের দৈনিক রুটিন", intent: "informational", schema: "Article" },
  { slug: "/parenting/3-5y/screen-free-play-bn", title: "৩–৫ বছর বয়সী শিশুর স্ক্রিন-মুক্ত মনোযোগ বৃদ্ধির খেলা", intent: "informational", schema: "FAQPage" },
  { slug: "/parenting/0-1y/sleep-bonding-routine-bn", title: "নবজাতক ও ০–১ বছর বয়সী শিশুর নিরাপদ ঘুমের রুটিন", intent: "informational", schema: "Article" },
];

export default function SeoView() {
  const { toast } = useToast();
  const [tab, setTab] = useState("brief");
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("parenting");
  const [ageGroup, setAgeGroup] = useState("1-2y");
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [provider, setProvider] = useState("");

  // On-Page SEO Audit inputs
  const [auditTitle, setAuditTitle] = useState("১৮ মাসের শিশুর ভাষা বিকাশ ও প্রতিদিনের বন্ডিং | আলো Learning Journey");
  const [auditMeta, setAuditMeta] = useState("প্রতিদিন মাত্র ১০ মিনিট স্ক্রিন-মুক্ত কথোপকথন ও ছবির বই পড়া কীভাবে ১৮ মাসের শিশুর ভাষা ও মনোযোগ বিকাশে সাহায্য করে তার সহজ গাইড।");
  const [auditH1, setAuditH1] = useState("১৮ মাসের শিশুর ভাষা বিকাশ: পিতামাতার জন্য প্রতিদিনের ১০ মিনিটের গাইড");

  const generate = async () => {
    if (!topic.trim()) {
      toast({ title: "টপিক দিন", variant: "destructive" });
      return;
    }
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
        title: data.usedFallback ? "Fallback SEO brief draft created — not evaluated" : "SEO brief draft created — manual review required",
        description: data.usedFallback
          ? "Configured local model unavailable; this brief is not scored or publication-ready."
          : "Any model self-rating is not a fact-check, approval, or publication readiness decision.",
      });
    } finally {
      setLoading(false);
    }
  };

  const jsonLdString = useMemo(() => {
    if (!brief) return "";
    return JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        headline: brief.seoTitle,
        description: brief.metaDescription,
        keywords: brief.targetKeywords.join(", "),
        mainEntity: brief.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: f.a,
          },
        })),
      },
      null,
      2
    );
  }, [brief]);

  const auditChecks = useMemo(() => {
    const titleLen = auditTitle.trim().length;
    const metaLen = auditMeta.trim().length;
    const h1Len = auditH1.trim().length;
    return [
      {
        name: "Title Tag Length (40–70 chars)",
        value: `${titleLen} chars`,
        passed: titleLen >= 35 && titleLen <= 75,
        tip: "Keep title tags concise with the primary Bengali/English keyword near the front.",
      },
      {
        name: "Meta Description Length (90–165 chars)",
        value: `${metaLen} chars`,
        passed: metaLen >= 80 && metaLen <= 170,
        tip: "Summarize the reader benefit clearly without clickbait or medical/visa guarantees.",
      },
      {
        name: "Single Clear H1 Heading",
        value: `${h1Len} chars`,
        passed: h1Len >= 20 && h1Len <= 110,
        tip: "Match search intent directly in the H1 heading.",
      },
      {
        name: "AI Search / GEO Citation Readiness",
        value: "FAQPage JSON-LD enabled",
        passed: true,
        tip: "Structured Q&A pairs help answer engines cite accurate, child-safe guidance.",
      },
    ];
  }, [auditTitle, auditMeta, auditH1]);

  return (
    <div className="alo-fade-up space-y-5">
      <SectionHeader
        title="SEO & OpenSEO Command Center"
        bn="এসইও কমান্ড সেন্টার"
        desc="Keyword clusters, AI content briefs, JSON-LD Schema.org generator, On-Page SEO & GEO Audit, and Programmatic SEO (pSEO) matrix."
        icon={<Search className="h-5 w-5" />}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3 sm:w-auto">
          <TabsTrigger value="brief" className="gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" />
            SEO Brief & Schema
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" />
            On-Page & GEO Audit
          </TabsTrigger>
          <TabsTrigger value="pseo" className="gap-1.5 text-xs">
            <Globe className="h-3.5 w-3.5" />
            Programmatic SEO (pSEO)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="brief" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {SEO_CLUSTERS.map((cluster, i) => (
              <Card key={i} className="p-4 alo-stagger alo-glow-hover" style={{ animationDelay: `${i * 50}ms` }}>
                <p className="font-semibold text-sm">{cluster.bn}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{cluster.name}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {cluster.keywords.slice(0, 3).map((kw) => (
                    <Badge key={kw} variant="outline" className="text-[8px] truncate max-w-[100px]">
                      {kw}
                    </Badge>
                  ))}
                </div>
                <p className="text-[9px] text-muted-foreground mt-2">{cluster.subtopics.length} subtopics</p>
              </Card>
            ))}
          </div>

          <Card className="p-4 alo-card-grad border-0">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-600" /> কনটেন্ট ব্রিফ তৈরি করুন
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <Label className="text-xs">টপিক</Label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && generate()}
                  placeholder="শিশুর ঘুমের রুটিন"
                  className="h-9 mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">ক্যাটাগরি</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">বয়স গ্রুপ</Label>
                <Select value={ageGroup} onValueChange={setAgeGroup}>
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGE_GROUPS.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.icon} {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={generate} disabled={loading} className="bg-amber-500 hover:bg-amber-600 text-white">
              {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
              ব্রিফ তৈরি করুন
            </Button>
          </Card>

          {brief && (
            <Card className="p-5 alo-fade-up space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-600" /> {brief.title}
                </h3>
                <div className="flex items-center gap-2">
                  <ProviderTag provider={provider} fallback={provider === "local-fallback"} />
                  <Badge variant="outline" title="This brief has not been approved for publication.">
                    Draft · manual review required
                  </Badge>
                  <Badge variant="outline">
                    {provider === "local-fallback" || brief.qualityScore <= 0
                      ? "Quality not evaluated"
                      : `Model self-rating: ${brief.qualityScore}/100`}
                  </Badge>
                </div>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs font-semibold mb-1">Target Keywords</p>
                  <div className="flex flex-wrap gap-1">
                    {brief.targetKeywords.map((kw) => (
                      <Badge key={kw} variant="outline" className="text-[10px]">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>

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

                <div>
                  <p className="text-xs font-semibold mb-1">Content Outline</p>
                  <div className="space-y-1.5">
                    {brief.contentOutline.map((section, i) => (
                      <div key={i} className="rounded-lg border border-border/40 p-2">
                        <p className="text-xs font-medium">
                          {i + 1}. {section.heading}
                        </p>
                        <ul className="text-[11px] text-muted-foreground ml-4 mt-0.5">
                          {section.points.map((p, j) => (
                            <li key={j}>• {p}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

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

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold flex items-center gap-1.5">
                      <Code2 className="h-3.5 w-3.5 text-amber-600" />
                      JSON-LD Schema.org Structured Data
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        void navigator.clipboard.writeText(jsonLdString);
                        toast({ title: "JSON-LD copied" });
                      }}
                    >
                      <Copy className="h-3 w-3" />
                      Copy JSON-LD
                    </Button>
                  </div>
                  <pre className="max-h-48 overflow-auto rounded-lg border border-border/60 bg-muted/30 p-3 font-mono text-[11px]">
                    {jsonLdString}
                  </pre>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ON-PAGE & GEO AUDIT TAB */}
        <TabsContent value="audit" className="mt-4 space-y-4">
          <Card className="p-4 sm:p-5 space-y-4">
            <h3 className="text-sm font-semibold">On-Page SEO & AI Search Visibility (GEO) Auditor</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs">Title Tag</Label>
                <Input value={auditTitle} onChange={(e) => setAuditTitle(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">H1 Heading</Label>
                <Input value={auditH1} onChange={(e) => setAuditH1(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Meta Description</Label>
                <Input value={auditMeta} onChange={(e) => setAuditMeta(e.target.value)} className="mt-1" />
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {auditChecks.map((chk) => (
                <Card key={chk.name} className="p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{chk.name}</span>
                    <Badge className={chk.passed ? "bg-emerald-600 text-white text-[10px]" : "bg-amber-600 text-white text-[10px]"}>
                      {chk.value}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{chk.tip}</p>
                </Card>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* PROGRAMMATIC SEO (pSEO) MATRIX TAB */}
        <TabsContent value="pseo" className="mt-4 space-y-4">
          <Card className="p-4 sm:p-5 space-y-3">
            <h3 className="text-sm font-semibold">Programmatic SEO (pSEO) Hub-and-Spoke Matrix</h3>
            <p className="text-xs text-muted-foreground">
              High-utility template pages pairing Country × Intake and Age Group × Milestone without thin content. Click any template to load its topic into the Brief Generator.
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {PSEO_TEMPLATES.map((tpl) => (
                <Card key={tpl.slug} className="p-3.5 flex flex-col justify-between">
                  <div>
                    <code className="text-[10px] text-amber-600 font-mono">{tpl.slug}</code>
                    <p className="mt-1 font-semibold text-xs">{tpl.title}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/50">
                    <Badge variant="outline" className="text-[9px]">
                      {tpl.schema}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        setTopic(tpl.title);
                        setTab("brief");
                      }}
                    >
                      Load into Brief
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
