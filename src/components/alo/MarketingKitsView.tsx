"use client";

import { useMemo, useState } from "react";
import {
  BookOpen, Check, ClipboardCheck, Copy, Download, ExternalLink,
  Loader2, Megaphone, Search, Sparkles, Target, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeader } from "./primitives";
import { MARKETING_KITS, MARKETING_SKILLS_CATALOG } from "@/lib/marketing-kits";
import type { HumanizerResult } from "@/lib/humanizer";
import { useToast } from "@/hooks/use-toast";
import { QualityPipelineSummary } from "./PipelineRunner";
import type { QualityAgentPass } from "@/lib/ai";

function renderTemplate(text: string, fields: Record<string, string>) {
  return text.replace(/\{\{([a-z0-9_]+)\}\}/gi, (_match, key: string) => fields[key]?.trim() || `[${key.replaceAll("_", " ")}]`);
}

function assetCacheKey(kitId: string, assetId: string) {
  return `${kitId}/${assetId}`;
}

const SAMPLE_AI_TEXT = `In today's fast-paced world, when it comes to international university admissions, students face a tapestry of choices. It's not just about picking a course; it's about unlocking your potential. Let's face it: navigating deadlines — especially across multiple portals — can feel overwhelming.

No guesswork. No hidden steps. No confusion.

- **Comprehensive Guidance:** We leverage verified university pages to facilitate your shortlist.
- **Seamless Planning:** Utilize our checklist for {{course}} at {{institution}} before [verify current date].

That is the real win. Read that again.`;

export default function MarketingKitsView({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { toast } = useToast();
  const [mainTab, setMainTab] = useState("kits");
  const [selectedId, setSelectedId] = useState(MARKETING_KITS[0]?.id ?? "");
  const [activeAssets, setActiveAssets] = useState<Record<string, string>>({});
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, Record<string, string>>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [polishBusy, setPolishBusy] = useState(false);
  const [humanizeAssetBusy, setHumanizeAssetBusy] = useState(false);
  const [polishedBodies, setPolishedBodies] = useState<Record<string, string>>({});
  const [polishPipeline, setPolishPipeline] = useState<Record<string, QualityAgentPass[]>>({});

  // 50 Marketing Skills state
  const [skillQuery, setSkillQuery] = useState("");
  const [skillGroup, setSkillGroup] = useState("all");

  // Humanizer Studio state
  const [humanizerInput, setHumanizerInput] = useState(SAMPLE_AI_TEXT);
  const [humanizerBusy, setHumanizerBusy] = useState(false);
  const [humanizerResult, setHumanizerResult] = useState<HumanizerResult | null>(null);

  const selected = MARKETING_KITS.find((kit) => kit.id === selectedId) ?? MARKETING_KITS[0];
  const fields = selected
    ? { ...Object.fromEntries(selected.fields.map((field) => [field.key, field.defaultValue])), ...fieldOverrides[selected.id] }
    : {};
  const activeAssetId = selected ? activeAssets[selected.id] ?? selected.assets[0]?.id ?? "" : "";
  const filteredKits = useMemo(
    () =>
      MARKETING_KITS.filter((kit) => {
        if (category !== "all" && kit.category !== category) return false;
        const needle = query.trim().toLowerCase();
        return !needle || [kit.title, kit.objective, kit.audience, kit.category, kit.topic].some((value) => value.toLowerCase().includes(needle));
      }),
    [category, query]
  );

  const filteredSkills = useMemo(
    () =>
      MARKETING_SKILLS_CATALOG.filter((skill) => {
        if (skillGroup !== "all" && skill.group !== skillGroup) return false;
        const needle = skillQuery.trim().toLowerCase();
        return !needle || [skill.slug, skill.title, skill.summary, skill.aloApplication, skill.deliverable].some((v) => v.toLowerCase().includes(needle));
      }),
    [skillGroup, skillQuery]
  );

  function updateField(key: string, value: string) {
    if (!selected) return;
    setFieldOverrides((current) => ({
      ...current,
      [selected.id]: { ...current[selected.id], [key]: value },
    }));
    const keyPrefix = `${selected.id}/`;
    setPolishedBodies((current) => Object.fromEntries(Object.entries(current).filter(([k]) => !k.startsWith(keyPrefix))));
    setPolishPipeline((current) => Object.fromEntries(Object.entries(current).filter(([k]) => !k.startsWith(keyPrefix))));
  }

  function selectAsset(assetId: string) {
    if (!selected) return;
    setActiveAssets((current) => ({ ...current, [selected.id]: assetId }));
  }

  const activeAsset = selected?.assets.find((asset) => asset.id === activeAssetId) ?? selected?.assets[0];
  const activeCacheKey = selected && activeAsset ? assetCacheKey(selected.id, activeAsset.id) : "";
  const originalRenderedBody = activeAsset ? renderTemplate(activeAsset.body, fields) : "";
  const renderedBody = activeCacheKey ? polishedBodies[activeCacheKey] ?? originalRenderedBody : originalRenderedBody;
  const hasUnfilledValues = /\[(?:add|verify|confirm|insert|course|intake|first name|institution|deadline|time|date)/i.test(renderedBody);
  const allReviewed = Boolean(selected?.guardrails.length && selected.guardrails.every((_item, index) => reviewed[`${selected.id}-${index}`]));

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied`, description: "Review the final wording and links before use." });
    } catch {
      toast({ title: "Clipboard permission required", description: "Select and copy the text manually from the preview.", variant: "destructive" });
    }
  }

  async function polishEmailDraft() {
    if (!selected || !activeAsset || activeAsset.channel !== "Email" || !activeCacheKey) return;
    setPolishBusy(true);
    try {
      const response = await fetch("/api/marketing/email-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: activeAsset.body, audience: selected.audience, objective: selected.objective }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not refine this email draft.");
      setPolishedBodies((current) => ({ ...current, [activeCacheKey]: renderTemplate(body.draft, fields) }));
      setPolishPipeline((current) => ({ ...current, [activeCacheKey]: body.qualityPipeline ?? [] }));
      toast({
        title: body.usedFallback ? "Template retained; local model unavailable" : "Email draft revised through local model prompts",
        description: "Draft only. No email was sent; verify claims, consent, preferences and every placeholder.",
      });
    } catch (error) {
      toast({ title: "Email draft not refined", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setPolishBusy(false);
    }
  }

  async function humanizeActiveAsset() {
    if (!selected || !activeAsset || !activeCacheKey) return;
    setHumanizeAssetBusy(true);
    try {
      const response = await fetch("/api/marketing/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: renderedBody }),
      });
      const body = (await response.json()) as HumanizerResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not humanize copy.");
      setPolishedBodies((current) => ({ ...current, [activeCacheKey]: body.humanized }));
      toast({
        title: `Humanizer pass complete (${body.scoreAfter}/100)`,
        description: body.changesSummary[0] ?? "Preserved placeholders and claims.",
      });
    } catch (error) {
      toast({ title: "Humanizer pass failed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setHumanizeAssetBusy(false);
    }
  }

  async function runStandaloneHumanizer() {
    if (!humanizerInput.trim()) return;
    setHumanizerBusy(true);
    try {
      const response = await fetch("/api/marketing/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: humanizerInput }),
      });
      const body = (await response.json()) as HumanizerResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Humanizer error");
      setHumanizerResult(body);
      toast({
        title: `Detected ${body.patternsDetected.length} AI writing tell(s)`,
        description: `Score improved from ${body.scoreBefore} to ${body.scoreAfter}/100`,
      });
    } catch (error) {
      toast({ title: "Could not run Humanizer", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setHumanizerBusy(false);
    }
  }

  function downloadKit() {
    if (!selected) return;
    const content = selected.assets
      .map((asset) => {
        const key = assetCacheKey(selected.id, asset.id);
        const body = polishedBodies[key] ?? renderTemplate(asset.body, fields);
        return `${asset.channel.toUpperCase()} — ${asset.title}\n\n${body}`;
      })
      .join(`\n\n${"=".repeat(60)}\n\n`);
    const file = new Blob([`${selected.title}\n\n${content}\n\nReview checklist\n${selected.guardrails.map((item) => `- ${item}`).join("\n")}`], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selected.id}-marketing-kit.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function createCampaign() {
    if (!selected || !allReviewed) return;
    setBusy(true);
    try {
      const response = await fetch("/api/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_campaign",
          title: selected.title,
          topic: selected.topic,
          platformCount: selected.assets.length,
          totalAssets: selected.assets.length,
        }),
      });
      const body = await response.json();
      if (!response.ok || body.error) throw new Error(body.error ?? "Could not create the campaign.");
      toast({ title: "Campaign added to Growth Loop", description: selected.title });
      onNavigate("growth");
    } catch (error) {
      toast({ title: "Campaign not created", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 alo-fade-up">
      <SectionHeader
        title="Marketing Kits & Skills"
        bn="মার্কেটিং কিট ও স্কিল"
        desc="19 editable multi-channel campaign kits (UK, Canada, USA, Australia, Germany, IELTS, Scholarships, Bengali Parenting, AARRR, CRO & timed drip cadences), 50 Marketing Skills reference matrix, and local Anti-AI-Slop Humanizer."
        icon={<Megaphone className="h-5 w-5" />}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://web.facebook.com/ALOLearningJourney"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open Facebook page
            </a>
            <Badge variant="outline" className="h-8 gap-1.5 px-3 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              {MARKETING_KITS.length} kits · {MARKETING_SKILLS_CATALOG.length} skills
            </Badge>
          </div>
        }
      />

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="grid w-full grid-cols-3 sm:w-auto">
          <TabsTrigger value="kits" className="gap-1.5 text-xs">
            <Megaphone className="h-3.5 w-3.5" />
            Campaign Kits ({MARKETING_KITS.length})
          </TabsTrigger>
          <TabsTrigger value="skills" className="gap-1.5 text-xs">
            <BookOpen className="h-3.5 w-3.5" />
            50 Marketing Skills ({MARKETING_SKILLS_CATALOG.length})
          </TabsTrigger>
          <TabsTrigger value="humanizer" className="gap-1.5 text-xs">
            <Wand2 className="h-3.5 w-3.5" />
            Humanizer Studio (Anti-AI-Slop)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kits" className="mt-4 space-y-4">
          <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            The supplied Facebook page could not be verified from this environment. These are editable draft kits—not copy derived from that page. Confirm brand voice, offers, dates, links, and claims with the page owner before publishing.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-amber-700">
                <Target className="h-4 w-4" />
                <span className="text-xs font-semibold">One objective</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Every kit starts with an audience, a clear purpose, and an honest next step—not a generic blast.
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-violet-700">
                <ClipboardCheck className="h-4 w-4" />
                <span className="text-xs font-semibold">Review before use</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Dates, entry requirements, URLs, and claims remain editable placeholders until a human verifies them.
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-emerald-700">
                <Check className="h-4 w-4" />
                <span className="text-xs font-semibold">Consent-aware</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Copying or creating a campaign does not send messages. Use promotional content only for appropriate, opted-in audiences.
              </p>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[310px_minmax(0,1fr)]">
            <aside className="space-y-3">
              <Card className="space-y-3 p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a campaign kit…" className="pl-9" />
                </div>
                <select
                  aria-label="Filter kits by purpose"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All categories ({MARKETING_KITS.length})</option>
                  {Array.from(new Set(MARKETING_KITS.map((kit) => kit.category))).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </Card>
              <div className="max-h-[42rem] space-y-2 overflow-y-auto pr-1 alo-scrollbar">
                {filteredKits.map((kit) => (
                  <button
                    key={kit.id}
                    type="button"
                    onClick={() => setSelectedId(kit.id)}
                    aria-pressed={selected?.id === kit.id}
                    className={`w-full rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 ${
                      selected?.id === kit.id ? "border-amber-500 bg-amber-500/10 shadow-sm" : "border-border/70 bg-card hover:bg-muted/50"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm">{kit.title}</span>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[9px] text-muted-foreground">{kit.category}</span>
                    </span>
                    <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">{kit.objective}</span>
                    <span className="mt-2 block text-[10px] text-muted-foreground">
                      {kit.assets.length} assets ·{" "}
                      {kit.assets
                        .map((asset) => asset.channel)
                        .filter((value, index, array) => array.indexOf(value) === index)
                        .join(" · ")}
                    </span>
                  </button>
                ))}
                {filteredKits.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">No kits match this search.</Card>}
              </div>
            </aside>

            {selected && (
              <div className="min-w-0 space-y-4">
                <Card className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Badge variant="outline" className="mb-2">
                        {selected.category}
                      </Badge>
                      <h2 className="text-lg font-semibold">{selected.title}</h2>
                      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{selected.objective}</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={downloadKit}>
                      <Download className="h-4 w-4" />
                      Download kit
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-3 rounded-xl bg-muted/35 p-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Audience</p>
                      <p className="mt-1 text-xs leading-relaxed">{selected.audience}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Message angle</p>
                      <p className="mt-1 text-xs leading-relaxed">{selected.angle}</p>
                    </div>
                    {selected.trigger && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Automation trigger</p>
                        <p className="mt-1 font-mono text-xs leading-relaxed">{selected.trigger}</p>
                      </div>
                    )}
                    {selected.sendWindow && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Send window guidance</p>
                        <p className="mt-1 text-xs leading-relaxed">{selected.sendWindow}</p>
                      </div>
                    )}
                  </div>
                </Card>

                {selected.cadence && selected.cadence.length > 0 && (
                  <Card className="p-4 sm:p-5">
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold">Timed drip cadence (planning only — ALO never sends automatically)</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Angle rotation from coreyhaines31/marketingskills follow-up research: each touch adds one new value piece. Day offsets are planning metadata.
                      </p>
                    </div>
                    <ol className="space-y-2">
                      {selected.cadence.map((step) => (
                        <li key={`${step.day}-${step.channel}`} className="flex flex-wrap items-start gap-2 rounded-lg border border-border/60 p-2.5">
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-700 dark:text-amber-400">Day {step.day}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{step.channel}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-semibold">{step.angle}</span>
                            <span className="block text-xs text-muted-foreground">{step.note}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </Card>
                )}

                <Card className="p-4 sm:p-5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">Personalise the placeholders</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">Unedited placeholders are intentionally obvious; replace them before copying.</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{selected.fields.length} fields</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {selected.fields.map((field) => (
                      <div key={field.key} className="space-y-1">
                        <Label htmlFor={`kit-${selected.id}-${field.key}`} className="text-xs">
                          {field.label}
                        </Label>
                        <Input
                          id={`kit-${selected.id}-${field.key}`}
                          value={fields[field.key] ?? field.defaultValue}
                          onChange={(event) => updateField(field.key, event.target.value)}
                          maxLength={300}
                        />
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="overflow-hidden">
                  <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">Channel assets</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">Choose a channel, inspect the rendered copy, and copy or download it for human review.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selected.assets.map((asset) => (
                        <Button
                          key={asset.id}
                          type="button"
                          size="sm"
                          variant={asset.id === activeAsset?.id ? "default" : "outline"}
                          className={asset.id === activeAsset?.id ? "bg-amber-500 text-white hover:bg-amber-600" : ""}
                          onClick={() => selectAsset(asset.id)}
                        >
                          {asset.channel}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {activeAsset && (
                    <div className="space-y-3 p-4 sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="font-semibold">{activeAsset.title}</h4>
                          <p className="text-xs text-muted-foreground">{activeAsset.channel}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {activeAsset.channel === "Email" && (
                            <Button type="button" size="sm" variant="outline" disabled={polishBusy} onClick={() => void polishEmailDraft()}>
                              {polishBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                              {polishBusy ? "Reviewing…" : "Revise draft with local model prompts"}
                            </Button>
                          )}
                          <Button type="button" size="sm" variant="outline" disabled={humanizeAssetBusy} onClick={() => void humanizeActiveAsset()}>
                            {humanizeAssetBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                            Humanize copy
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => void copyText(renderedBody, activeAsset.channel)}>
                            <Copy className="h-3.5 w-3.5" />
                            Copy asset
                          </Button>
                        </div>
                      </div>
                      {polishPipeline[activeCacheKey]?.length > 0 && <QualityPipelineSummary passes={polishPipeline[activeCacheKey]} />}
                      {hasUnfilledValues && (
                        <div
                          role="status"
                          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100"
                        >
                          Some placeholders still need a value or verification. Preview and copied text retain the bracketed reminder.
                        </div>
                      )}
                      <pre className="max-h-[34rem] overflow-auto whitespace-pre-wrap rounded-xl border border-border/70 bg-background p-4 font-sans text-sm leading-relaxed text-foreground">
                        {renderedBody}
                      </pre>
                      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <ExternalLink className="h-3 w-3" />
                        Local-agent email refinement uses the template/merge-tag version before contact fields are filled. No messages are sent; verify preferences and source material yourself.
                      </p>
                    </div>
                  )}
                </Card>

                <Card className="p-4 sm:p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-amber-600" />
                    <h3 className="text-sm font-semibold">Before you publish or send</h3>
                  </div>
                  <div className="space-y-2">
                    {selected.guardrails.map((rule, index) => {
                      const id = `${selected.id}-${index}`;
                      return (
                        <label
                          key={id}
                          className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/60 p-2.5 text-xs leading-relaxed hover:bg-muted/30"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(reviewed[id])}
                            onChange={(event) => setReviewed((current) => ({ ...current, [id]: event.target.checked }))}
                            className="mt-0.5 h-4 w-4 accent-amber-600"
                          />
                          <span>{rule}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                    <p className="max-w-xl text-[11px] leading-relaxed text-muted-foreground">
                      Creating a Growth Loop campaign records a plan only. It does not publish assets, connect an external service, or send a message.
                    </p>
                    <Button
                      type="button"
                      onClick={createCampaign}
                      disabled={!allReviewed || busy}
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Create Growth Loop campaign
                    </Button>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>

        {/* 50 MARKETING SKILLS CATALOG TAB */}
        <TabsContent value="skills" className="mt-4 space-y-4">
          <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={skillQuery}
                onChange={(event) => setSkillQuery(event.target.value)}
                placeholder="Search 50 marketing skills (e.g. copywriting, cro, programmatic-seo, aarrr)…"
                className="pl-9"
              />
            </div>
            <select
              aria-label="Filter marketing skills by discipline"
              value={skillGroup}
              onChange={(event) => setSkillGroup(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-64"
            >
              <option value="all">All 6 disciplines ({MARKETING_SKILLS_CATALOG.length})</option>
              {Array.from(new Set(MARKETING_SKILLS_CATALOG.map((item) => item.group))).map((grp) => (
                <option key={grp} value={grp}>
                  {grp}
                </option>
              ))}
            </select>
          </Card>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredSkills.map((skill) => (
              <Card key={skill.slug} className="flex flex-col justify-between p-4 alo-glow-hover">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <code className="rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      /{skill.slug}
                    </code>
                    <Badge variant="outline" className="text-[10px]">
                      {skill.group}
                    </Badge>
                  </div>
                  <h3 className="mt-2 font-semibold text-sm">{skill.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{skill.summary}</p>
                </div>
                <div className="mt-3 space-y-1.5 border-t border-border/60 pt-2.5 text-[11px]">
                  <p>
                    <span className="font-semibold text-foreground">ALO workflow:</span>{" "}
                    <span className="text-muted-foreground">{skill.aloApplication}</span>
                  </p>
                  <p>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">Deliverable:</span>{" "}
                    <span className="text-muted-foreground">{skill.deliverable}</span>
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* HUMANIZER STUDIO TAB */}
        <TabsContent value="humanizer" className="mt-4 space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Humanizer: Remove AI Writing Patterns</h2>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                  Inspects and rewrites AI-sounding prose for structural tells (§1 Not-X-but-Y contrasts, §2 one-line dramatic closers, §3 staged openers, §6 forced negative triads, §8 em-dash habits, §11 stock AI vocabulary, and §19 mechanical bold-label lists) while preserving merge tags like <code>{"{{course}}"}</code> and bracketed verification notes.
                </p>
              </div>
              <Button type="button" onClick={() => void runStandaloneHumanizer()} disabled={humanizerBusy} className="bg-amber-500 text-white hover:bg-amber-600">
                {humanizerBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Run Humanizer Pass
              </Button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="humanizer-input" className="text-xs font-semibold">
                  Input draft (paste copy to inspect)
                </Label>
                <Textarea
                  id="humanizer-input"
                  value={humanizerInput}
                  onChange={(event) => setHumanizerInput(event.target.value)}
                  rows={11}
                  className="font-sans text-sm leading-relaxed"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Humanized output (clean, direct prose)</Label>
                  {humanizerResult && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        Before: {humanizerResult.scoreBefore}/100
                      </Badge>
                      <Badge className="bg-emerald-600 text-white text-[10px]">
                        After: {humanizerResult.scoreAfter}/100
                      </Badge>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => void copyText(humanizerResult.humanized, "Humanized copy")}>
                        <Copy className="h-3 w-3" />
                        Copy
                      </Button>
                    </div>
                  )}
                </div>
                <pre className="min-h-[15.5rem] whitespace-pre-wrap rounded-xl border border-border/70 bg-muted/25 p-3.5 font-sans text-sm leading-relaxed">
                  {humanizerResult ? humanizerResult.humanized : "Click 'Run Humanizer Pass' to inspect and rewrite the draft."}
                </pre>
              </div>
            </div>

            {humanizerResult && (
              <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Detected AI tells ({humanizerResult.patternsDetected.length})
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {humanizerResult.patternsDetected.map((item) => (
                    <Card key={item.id} className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">
                          {item.section} · {item.name}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] uppercase ${
                            item.severity === "strong" ? "border-rose-400 text-rose-600" : "border-amber-400 text-amber-600"
                          }`}
                        >
                          {item.severity}
                        </Badge>
                      </div>
                      <p className="mt-1.5 rounded bg-muted/50 px-2 py-1 font-mono text-[11px] text-foreground">&ldquo;{item.example}&rdquo;</p>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{item.explanation}</p>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
