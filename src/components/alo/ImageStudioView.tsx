"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SectionHeader } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Image as ImageIcon,
  Wand2,
  Download,
  Copy,
  Layers,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ImageOff,
  Maximize2,
  X,
  Palette,
  Frame,
  Database,
} from "lucide-react";

// ---------- Types ----------
interface PresetInfo {
  id: string;
  label: string;
  samplePrompt: string;
}

interface SizeInfo {
  size: string;
  purpose: string;
}

interface GalleryFile {
  name: string;
  url: string;
  size: number;
  mtime: string;
}

interface StudioMeta {
  presets: PresetInfo[];
  sizes: SizeInfo[];
  supportedSizes: string[];
  gallery: GalleryFile[];
  cacheSize: number;
}

interface GenResult {
  index: number;
  prompt: string;
  enrichedPrompt?: string;
  url: string;
  size: string;
  bytes: number;
  cached: boolean;
  error?: string;
}

interface GenResponse {
  ok: boolean;
  batchId?: string;
  preset?: string | null;
  size?: string;
  total?: number;
  succeeded?: number;
  failed?: number;
  cached?: number;
  results?: GenResult[];
  error?: string;
}

// ---------- Constants ----------
const PRESET_TONES: Record<string, string> = {
  "parenting-warm": "from-amber-400/25 to-rose-400/15 text-amber-700 dark:text-amber-300 ring-amber-300/50",
  "education-clean": "from-emerald-400/25 to-teal-400/15 text-emerald-700 dark:text-emerald-300 ring-emerald-300/50",
  "marketing-bold": "from-fuchsia-500/25 to-pink-500/15 text-fuchsia-700 dark:text-fuchsia-300 ring-fuchsia-300/50",
  "social-square": "from-pink-400/25 to-rose-400/15 text-pink-700 dark:text-pink-300 ring-pink-300/50",
  cinematic: "from-violet-500/25 to-fuchsia-500/15 text-violet-700 dark:text-violet-300 ring-violet-300/50",
  "minimal-line": "from-slate-400/25 to-zinc-400/15 text-slate-700 dark:text-slate-300 ring-slate-300/50",
  "watercolor-soft": "from-rose-300/25 to-amber-300/15 text-rose-700 dark:text-rose-300 ring-rose-300/50",
  "isometric-3d": "from-cyan-400/25 to-emerald-400/15 text-cyan-700 dark:text-cyan-300 ring-cyan-300/50",
};

const PRESENT_NONE = "__none__";
const MAX_PROMPTS = 8;

// ---------- Helpers ----------
function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ---------- Component ----------
export default function ImageStudioView() {
  const { toast } = useToast();

  // Meta state (from GET)
  const [meta, setMeta] = useState<StudioMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);

  // Form state
  const [promptsText, setPromptsText] = useState(
    "a Bengali mother reading a storybook to her toddler at bedtime\na father and child planting a sapling in a sunny garden\na teacher helping a young student draw on a chalkboard"
  );
  const [preset, setPreset] = useState<string>("parenting-warm");
  const [size, setSize] = useState<string>("1024x1024");

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<GenResult[]>([]);
  const [lastBatch, setLastBatch] = useState<{
    batchId: string;
    total: number;
    succeeded: number;
    failed: number;
    cached: number;
  } | null>(null);

  // Lightbox
  const [lightbox, setLightbox] = useState<GenResult | GalleryFile | null>(null);

  const promptLines = useMemo(
    () =>
      promptsText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0),
    [promptsText]
  );

  // Load metadata + gallery
  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    try {
      const res = await fetch("/api/image-studio?gallery=true", { cache: "no-store" });
      const data: StudioMeta = await res.json();
      setMeta(data);
    } catch (e) {
      toast({
        title: "Failed to load studio",
        description: String(e),
        variant: "destructive",
      });
    } finally {
      setMetaLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  // Generate images
  const handleGenerate = async () => {
    if (promptLines.length === 0) {
      toast({
        title: "No prompts",
        description: "অন্তত একটি প্রম্পট লিখুন।",
        variant: "destructive",
      });
      return;
    }
    if (promptLines.length > MAX_PROMPTS) {
      toast({
        title: "Too many prompts",
        description: `সর্বোচ্চ ${MAX_PROMPTS}টি প্রম্পট অনুমোদিত।`,
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    setProgress({ done: 0, total: promptLines.length });
    setResults([]);

    const batchId = `batch_${Date.now()}`;
    const body = {
      prompts: promptLines,
      size,
      preset: preset === PRESENT_NONE ? undefined : preset,
      batchId,
    };

    try {
      const res = await fetch("/api/image-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: GenResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Generation failed");
      }

      // Animate results in one by one for perceived progress
      const out: GenResult[] = [];
      for (const r of data.results ?? []) {
        out.push(r);
        setResults([...out]);
        setProgress({ done: out.length, total: promptLines.length });
        // small delay for visual feedback
        await new Promise((resolve) => setTimeout(resolve, 120));
      }

      setLastBatch({
        batchId: data.batchId ?? batchId,
        total: data.total ?? out.length,
        succeeded: data.succeeded ?? out.filter((r) => !!r.url).length,
        failed: data.failed ?? out.filter((r) => !r.url).length,
        cached: data.cached ?? out.filter((r) => r.cached).length,
      });

      toast({
        title: `Generated ${data.succeeded ?? 0}/${data.total ?? 0} images`,
        description: `${data.cached ?? 0} cached · ${data.failed ?? 0} failed`,
      });

      // Refresh gallery + cache count
      loadMeta();
    } catch (e) {
      toast({
        title: "Generation failed",
        description: String(e),
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  };

  const copyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: "প্রম্পট কপি হয়েছে" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const insertPromptLine = (sample: string) => {
    const trimmed = sample.replace(/\.\.\.$/, "").trim();
    setPromptsText((prev) => (prev.trim() ? `${prev}\n${trimmed}` : trimmed));
    toast({ title: "Sample prompt added", description: "নতুন লাইনে যোগ হয়েছে" });
  };

  // ---------- Render ----------
  return (
    <div className="alo-fade-up space-y-5">
      <SectionHeader
        title="Image Studio Pro"
        bn="ইমেজ স্টুডিও প্রো"
        desc="৮টি স্টাইল প্রিসেট, ৭টি সাইজ, ব্যাচ জেনারেশন — প্রম্পট+সাইজ হ্যাশ দিয়ে ক্যাশিং।"
        icon={<ImageIcon className="h-5 w-5" />}
        action={
          <Button
            onClick={loadMeta}
            disabled={metaLoading}
            variant="outline"
            size="sm"
            className="h-8"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${metaLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        }
      />

      {/* Header card with stats badges */}
      <Card className="p-4 sm:p-5 bg-gradient-to-br from-fuchsia-500/10 via-rose-500/5 to-amber-500/10 border-0 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-fuchsia-600" />
              Image Studio Pro
              <span className="alo-text-grad text-sm font-semibold">
                / ইমেজ স্টুডিও প্রো
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              ৮টি স্টাইল প্রিসেট, ৭টি সাইজ, ব্যাচ জেনারেশন
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
              <Database className="h-3 w-3 mr-1" />
              {metaLoading ? "…" : meta?.cacheSize ?? 0} cached
            </Badge>
            <Badge className="bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-100">
              <Palette className="h-3 w-3 mr-1" />
              {meta?.presets.length ?? 8} presets
            </Badge>
            <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">
              <Frame className="h-3 w-3 mr-1" />
              {meta?.sizes.length ?? 7} sizes
            </Badge>
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              <Layers className="h-3 w-3 mr-1" />
              batch up to {MAX_PROMPTS}
            </Badge>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* LEFT — Generation form */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="p-4 sm:p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <Wand2 className="h-4 w-4 text-fuchsia-600" />
              Generation Form
              <span className="text-xs text-muted-foreground font-normal">
                / জেনারেশন ফর্ম
              </span>
            </h3>

            {/* Prompts textarea */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1.5">
                  <ImageIcon className="h-3 w-3" />
                  Prompts
                  <span className="text-muted-foreground font-normal">
                    / প্রম্পট তালিকা
                  </span>
                </Label>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    promptLines.length > MAX_PROMPTS
                      ? "border-rose-400 text-rose-700 bg-rose-50"
                      : "bg-muted/40"
                  }`}
                >
                  {promptLines.length}/{MAX_PROMPTS} lines
                </Badge>
              </div>
              <Textarea
                value={promptsText}
                onChange={(e) => setPromptsText(e.target.value)}
                rows={6}
                placeholder="এক লাইনে একটি প্রম্পট। সর্বোচ্চ ৮টি।&#10;a mother reading to her child&#10;a teacher helping a student"
                className="text-xs sm:text-sm font-mono resize-y"
              />
              <p className="text-[10px] text-muted-foreground">
                এক লাইনে একটি প্রম্পট। সর্বোচ্চ ৮টি। প্রতিটি লাইন আলাদা ছবি তৈরি করবে।
              </p>
            </div>

            {/* Style preset picker */}
            <div className="mt-4 space-y-2">
              <Label className="text-xs flex items-center gap-1.5">
                <Palette className="h-3 w-3" />
                Style Preset
                <span className="text-muted-foreground font-normal">
                  / স্টাইল প্রিসেট
                </span>
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* None (raw prompt) card */}
                <button
                  type="button"
                  onClick={() => setPreset(PRESENT_NONE)}
                  className={`rounded-lg border p-2 text-left transition-all hover:shadow-md ${
                    preset === PRESENT_NONE
                      ? "border-fuchsia-400 ring-2 ring-fuchsia-300/60 bg-fuchsia-50 dark:bg-fuchsia-950/30"
                      : "border-border/60 hover:border-fuchsia-300 bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <ImageOff className="h-3 w-3 text-muted-foreground" />
                    <p className="text-[11px] font-semibold">None</p>
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1 line-clamp-2">
                    Raw prompt — কোনো স্টাইল যোগ করবেন না
                  </p>
                </button>

                {metaLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-[58px] rounded-lg" />
                    ))
                  : meta?.presets.map((p) => {
                      const isSelected = preset === p.id;
                      const tone =
                        PRESET_TONES[p.id] ??
                        "from-slate-400/20 to-slate-400/10 text-slate-700 ring-slate-300/50";
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPreset(p.id)}
                          className={`rounded-lg border bg-gradient-to-br p-2 text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${
                            isSelected
                              ? `ring-2 ${tone} border-transparent`
                              : "border-border/60 hover:border-fuchsia-300 bg-muted/30"
                          }`}
                          title={p.samplePrompt}
                        >
                          <p className="text-[11px] font-semibold capitalize truncate">
                            {p.label}
                          </p>
                          <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2 leading-tight">
                            {p.samplePrompt}
                          </p>
                        </button>
                      );
                    })}
              </div>
            </div>

            {/* Size picker */}
            <div className="mt-4 space-y-2">
              <Label className="text-xs flex items-center gap-1.5">
                <Frame className="h-3 w-3" />
                Output Size
                <span className="text-muted-foreground font-normal">
                  / সাইজ
                </span>
              </Label>
              {metaLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={size} onValueChange={setSize}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meta?.sizes.map((s) => (
                      <SelectItem key={s.size} value={s.size}>
                        <span className="font-mono font-semibold">{s.size}</span>
                        <span className="text-muted-foreground"> — {s.purpose}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="flex flex-wrap gap-1.5 mt-1">
                {meta?.sizes.slice(0, 4).map((s) => (
                  <button
                    key={s.size}
                    type="button"
                    onClick={() => setSize(s.size)}
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                      size === s.size
                        ? "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300"
                        : "border-border/60 bg-muted/30 hover:border-fuchsia-300"
                    }`}
                  >
                    {s.size}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button + progress */}
            <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Button
                onClick={handleGenerate}
                disabled={generating || promptLines.length === 0}
                className="bg-gradient-to-r from-fuchsia-600 to-rose-500 hover:from-fuchsia-700 hover:to-rose-600 text-white h-10 sm:w-auto"
              >
                {generating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Generate Images
                    <span className="ml-1 opacity-80 text-xs">
                      ({promptLines.length})
                    </span>
                  </>
                )}
              </Button>

              {progress && (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                    <span>
                      Batch progress / ব্যাচ প্রগ্রেস
                    </span>
                    <span className="font-mono">
                      {progress.done}/{progress.total}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-fuchsia-500 to-rose-400 transition-all duration-300"
                      style={{
                        width: `${
                          progress.total > 0
                            ? (progress.done / progress.total) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Last batch summary */}
            {lastBatch && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {lastBatch.succeeded} succeeded
                </Badge>
                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                  <Database className="h-3 w-3 mr-1" />
                  {lastBatch.cached} cached
                </Badge>
                {lastBatch.failed > 0 && (
                  <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {lastBatch.failed} failed
                  </Badge>
                )}
                <span className="text-muted-foreground font-mono truncate">
                  {lastBatch.batchId}
                </span>
              </div>
            )}
          </Card>

          {/* Results grid */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-fuchsia-600" />
                Results
                <span className="text-xs text-muted-foreground font-normal">
                  / ফলাফল
                </span>
              </h3>
              {results.length > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  {results.length} image{results.length === 1 ? "" : "s"}
                </Badge>
              )}
            </div>

            {generating && results.length === 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Array.from({ length: Math.max(3, promptLines.length || 3) }).map(
                  (_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="aspect-square w-full rounded-lg" />
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  )
                )}
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">No images yet</p>
                <p className="text-xs">
                  প্রম্পট লিখে &quot;Generate Images&quot; চাপুন।
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {results.map((r) => (
                  <div
                    key={r.index}
                    className="rounded-xl border border-border/60 bg-card overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5"
                  >
                    <div className="relative aspect-square bg-muted/40 overflow-hidden group">
                      {r.url ? (
                        <img
                          src={r.url}
                          alt={r.prompt}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-rose-500">
                          <ImageOff className="h-8 w-8 mb-1 opacity-60" />
                          <p className="text-[10px] font-medium">Failed</p>
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        {r.cached ? (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[9px]">
                            <Database className="h-2.5 w-2.5 mr-0.5" />
                            Cached
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[9px]">
                            <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                            New
                          </Badge>
                        )}
                      </div>
                      {r.url && (
                        <button
                          type="button"
                          onClick={() => setLightbox(r)}
                          className="absolute top-2 right-2 rounded-md bg-black/40 hover:bg-black/60 text-white p-1.5 transition-colors"
                          aria-label="View full"
                        >
                          <Maximize2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="p-2.5 space-y-2">
                      <p
                        className="text-[11px] leading-tight line-clamp-2"
                        title={r.prompt}
                      >
                        {r.prompt}
                      </p>
                      {r.enrichedPrompt && r.enrichedPrompt !== r.prompt && (
                        <p
                          className="text-[9px] text-muted-foreground line-clamp-2 italic"
                          title={r.enrichedPrompt}
                        >
                          ✦ {r.enrichedPrompt}
                        </p>
                      )}
                      {r.error && (
                        <div className="text-[9px] text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded px-1.5 py-1 flex items-start gap-1">
                          <AlertTriangle className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                          <span className="break-words">{r.error}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[9px] text-muted-foreground font-mono">
                          {r.size}
                          {r.bytes > 0 && ` · ${formatBytes(r.bytes)}`}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-fuchsia-600"
                            onClick={() => copyPrompt(r.prompt)}
                            disabled={!r.prompt}
                            title="Copy prompt"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          {r.url && (
                            <a
                              href={r.url}
                              download={`${r.prompt.slice(0, 30).replace(/[^a-z0-9]+/gi, "_") || "image"}.png`}
                              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-fuchsia-600 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/30 transition-colors"
                              title="Download"
                            >
                              <Download className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT — Gallery + Presets reference */}
        <div className="lg:col-span-2 space-y-4">
          {/* Gallery */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-rose-500" />
                Recent Gallery
                <span className="text-xs text-muted-foreground font-normal">
                  / সাম্প্রতিক
                </span>
              </h3>
              <Badge variant="outline" className="text-[10px]">
                {meta?.gallery.length ?? 0} / 24
              </Badge>
            </div>

            {metaLoading ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-md" />
                ))}
              </div>
            ) : !meta?.gallery || meta.gallery.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-xs">কোনো ছবি নেই।</p>
                <p className="text-[10px]">Generate করুন — এখানে দেখা যাবে।</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[420px] alo-scrollbar pr-2">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {meta.gallery.map((g) => (
                    <button
                      key={g.name}
                      type="button"
                      onClick={() => setLightbox(g)}
                      className="relative aspect-square rounded-md overflow-hidden bg-muted/40 group"
                      title={`${g.name} · ${formatBytes(g.size)}`}
                    >
                      <img
                        src={g.url}
                        alt={g.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        loading="lazy"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[8px] text-white flex items-center gap-0.5">
                          <Clock className="h-2 w-2" />
                          {timeAgo(g.mtime)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </Card>

          {/* Presets reference */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Palette className="h-4 w-4 text-fuchsia-600" />
                Presets Reference
                <span className="text-xs text-muted-foreground font-normal">
                  / প্রিসেট তালিকা
                </span>
              </h3>
            </div>

            {metaLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : (
              <ScrollArea className="max-h-[360px] alo-scrollbar pr-2">
                <div className="space-y-1.5">
                  {meta?.presets.map((p) => {
                    const tone =
                      PRESET_TONES[p.id] ??
                      "from-slate-400/15 to-slate-400/5 text-slate-700";
                    const isActive = preset === p.id;
                    return (
                      <div
                        key={p.id}
                        className={`rounded-lg border p-2 transition-all ${
                          isActive
                            ? "border-fuchsia-400 ring-1 ring-fuchsia-300/50 bg-fuchsia-50/50 dark:bg-fuchsia-950/20"
                            : "border-border/60 hover:border-fuchsia-300"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={`h-2 w-2 rounded-full bg-gradient-to-br ${tone.split(" ")[0]} ${
                                tone.split(" ")[1]
                              } shrink-0`}
                            />
                            <p className="text-xs font-semibold capitalize truncate">
                              {p.label}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-fuchsia-600"
                              onClick={() => copyPrompt(p.samplePrompt)}
                              title="Copy sample"
                            >
                              <Copy className="h-2.5 w-2.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-fuchsia-600"
                              onClick={() => insertPromptLine(p.samplePrompt)}
                              title="Use as prompt"
                            >
                              <Wand2 className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-1 line-clamp-2 leading-tight">
                          {p.samplePrompt}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </Card>
        </div>
      </div>

      {/* Footer note */}
      <Card className="p-3 bg-muted/30 border-dashed">
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 justify-center text-center">
          <Database className="h-3 w-3 shrink-0" />
          Images cached by prompt+size hash. Same prompt+size returns instantly.
          <span className="hidden sm:inline">
            — প্রম্পট+সাইজ হ্যাশ দিয়ে ক্যাশ হয়। একই প্রম্পট+সাইজ তাৎক্ষণিক ফেরত আসে।
          </span>
        </p>
      </Card>

      {/* Lightbox */}
      <Dialog
        open={!!lightbox}
        onOpenChange={(open) => !open && setLightbox(null)}
      >
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-background/95">
          <DialogTitle className="sr-only">
            Image preview
          </DialogTitle>
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-2 right-2 z-10 rounded-full bg-black/50 hover:bg-black/70 text-white p-1.5 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          {lightbox && (
            <div className="flex flex-col">
              <div className="bg-black flex items-center justify-center max-h-[70vh]">
                <img
                  src={(lightbox as any).url || (lightbox as any).url}
                  alt={(lightbox as any).prompt || (lightbox as any).name}
                  className="max-h-[70vh] w-auto object-contain"
                />
              </div>
              <div className="p-3 space-y-1.5">
                {"prompt" in lightbox ? (
                  <>
                    <p className="text-xs font-medium line-clamp-2">
                      {lightbox.prompt}
                    </p>
                    {lightbox.enrichedPrompt &&
                      lightbox.enrichedPrompt !== lightbox.prompt && (
                        <p className="text-[10px] text-muted-foreground italic line-clamp-3">
                          ✦ {lightbox.enrichedPrompt}
                        </p>
                      )}
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="font-mono">{lightbox.size}</span>
                      {lightbox.bytes > 0 && (
                        <span>· {formatBytes(lightbox.bytes)}</span>
                      )}
                      {lightbox.cached && (
                        <Badge className="bg-amber-100 text-amber-800 text-[9px] py-0 h-4">
                          Cached
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() =>
                          copyPrompt(lightbox.prompt)
                        }
                      >
                        <Copy className="h-3 w-3 mr-1" /> Copy prompt
                      </Button>
                      {lightbox.url && (
                        <a
                          href={lightbox.url}
                          download={`${
                            lightbox.prompt
                              .slice(0, 30)
                              .replace(/[^a-z0-9]+/gi, "_") || "image"
                          }.png`}
                          className="inline-flex items-center h-7 px-3 rounded-md bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs transition-colors"
                        >
                          <Download className="h-3 w-3 mr-1" /> Download
                        </a>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-mono truncate">
                      {lightbox.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{formatBytes(lightbox.size)}</span>
                      <span>· {timeAgo(lightbox.mtime)}</span>
                    </div>
                    {lightbox.url && (
                      <a
                        href={lightbox.url}
                        download={lightbox.name}
                        className="inline-flex items-center h-7 px-3 rounded-md bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs transition-colors mt-1"
                      >
                        <Download className="h-3 w-3 mr-1" /> Download
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
