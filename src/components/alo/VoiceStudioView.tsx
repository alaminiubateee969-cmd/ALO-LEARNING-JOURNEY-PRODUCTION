"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Mic,
  Volume2,
  Play,
  Download,
  Loader2,
  Gauge,
  AudioWaveform,
  CheckCircle2,
  XCircle,
  Clock,
  Hash,
  Activity,
  Sparkles,
  AudioLines,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";

// ============================================================
// Types — mirror the /api/voice-studio contract
// ============================================================

interface VoiceProfile {
  label: string;
  style: string;
  bestFor: string;
}

interface VoiceGeneration {
  id: string;
  text: string;
  voice: string;
  speed: number;
  volume: number;
  format: string;
  language: string;
  filePath: string | null;
  durationSec: number | null;
  charCount: number;
  status: string; // pending | completed | failed
  errorMessage: string | null;
  createdAt: string;
}

interface VoiceStudioStats {
  total: number;
  completed: number;
  failed: number;
  totalChars: number;
  totalDuration: number;
}

interface VoiceStudioData {
  voices: Record<string, VoiceProfile>;
  recent: VoiceGeneration[];
  stats: VoiceStudioStats;
  voiceUsage: Record<string, number>;
  supportedFormats: string[];
  speedRange: { min: number; max: number; default: number };
  volumeRange: { min: number; max: number; default: number };
  maxInputLength: number;
}

interface GenerateResponse {
  ok: boolean;
  id?: string;
  voice?: string;
  voiceLabel?: string;
  voiceStyle?: string;
  speed?: number;
  volume?: number;
  format?: string;
  language?: string;
  charCount?: number;
  chunksGenerated?: number;
  audioUrl?: string;
  durationSec?: number | null;
  allChunks?: string[];
  error?: string;
}

// Voice emoji mapping for a touch of personality
const VOICE_EMOJI: Record<string, string> = {
  tongtong: "🌻",
  chuichui: "🐣",
  xiaochen: "🎙️",
  jam: "🎩",
  kazi: "📘",
  douji: "💬",
  luodo: "🎭",
};

const LANGUAGE_OPTIONS = [
  { value: "bn", label: "Bengali", bn: "বাংলা" },
  { value: "en", label: "English", bn: "ইংরেজি" },
  { value: "zh", label: "Chinese", bn: "চাইনিজ" },
];

const FORMAT_OPTIONS = [
  { value: "wav", label: "WAV", note: "Recommended" },
  { value: "mp3", label: "MP3", note: "Smaller file" },
  { value: "pcm", label: "PCM", note: "Raw audio" },
];

function speedLabel(v: number): string {
  if (v <= 0.6) return "Slow · ধীর";
  if (v <= 0.9) return "Calm · শান্ত";
  if (v <= 1.1) return "Normal · স্বাভাবিক";
  if (v <= 1.5) return "Brisk · চটপটে";
  return "Fast · দ্রুত";
}

function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return "0.0s";
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  if (diff < 60_000) return "এইমাত্র";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} মিনিট আগে`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ঘণ্টা আগে`;
  return `${Math.floor(diff / 86_400_000)} দিন আগে`;
}

export default function VoiceStudioView() {
  const { toast } = useToast();
  const [data, setData] = useState<VoiceStudioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // form state
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("tongtong");
  const [speed, setSpeed] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [format, setFormat] = useState("wav");
  const [language, setLanguage] = useState("bn");

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ---------------------------------------------------------
  // Load voice studio meta + recent generations
  // ---------------------------------------------------------
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/voice-studio", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as VoiceStudioData;
      setData(json);
      // auto-pick the most-used voice on first load
      if (json.voiceUsage && Object.keys(json.voiceUsage).length > 0) {
        const top = Object.entries(json.voiceUsage).sort(
          (a, b) => b[1] - a[1]
        )[0][0];
        if (json.voices[top]) setVoice(top);
      }
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------
  const voices = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.voices).map(([id, v]) => ({
      id,
      ...v,
      emoji: VOICE_EMOJI[id] ?? "🎙️",
      usage: data.voiceUsage[id] ?? 0,
    }));
  }, [data]);

  const maxVoiceUsage = useMemo(
    () => voices.reduce((m, v) => Math.max(m, v.usage), 0) || 1,
    [voices]
  );

  const charCount = text.trim().length;
  const overLimit = data ? charCount > data.maxInputLength : false;
  const chunksPredicted = data
    ? Math.max(1, Math.ceil(charCount / data.maxInputLength))
    : 1;

  // ---------------------------------------------------------
  // Generate audio
  // ---------------------------------------------------------
  const handleGenerate = async () => {
    if (!text.trim()) {
      toast({
        title: "টেক্সট দিন",
        description: "অন্তত কিছু টেক্সট লিখুন",
        variant: "destructive",
      });
      return;
    }
    setGenerating(true);
    setGenError(null);
    setResult(null);
    try {
      const res = await fetch("/api/voice-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice, speed, volume, format, language }),
      });
      const json = (await res.json()) as GenerateResponse;
      if (!res.ok || !json.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setResult(json);
      toast({
        title: "অডিও তৈরি হয়েছে",
        description: `${json.voiceLabel} · ${json.chunksGenerated} চাঙ্ক · ${formatDuration(json.durationSec)}`,
      });
      // refresh recent list
      void loadData();
      // autoplay
      setTimeout(() => audioRef.current?.play().catch(() => {}), 100);
    } catch (e) {
      const msg = (e as Error).message;
      setGenError(msg);
      toast({
        title: "তৈরি ব্যর্থ",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = () => {
    setText("");
    setResult(null);
    setGenError(null);
    if (data) {
      setSpeed(data.speedRange.default);
      setVolume(data.volumeRange.default);
    }
    setFormat("wav");
    setLanguage("bn");
    setVoice("tongtong");
  };

  // ---------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------
  if (loading && !data) {
    return (
      <div className="alo-fade-up space-y-5">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-violet-500/15 p-3 text-violet-600">
              <Mic className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="h-6 w-48 rounded-md bg-muted animate-pulse" />
              <div className="mt-2 h-4 w-64 rounded-md bg-muted animate-pulse" />
            </div>
          </div>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 p-6 h-96 animate-pulse bg-muted/40" />
          <Card className="p-6 h-96 animate-pulse bg-muted/40" />
        </div>
      </div>
    );
  }

  if (loadError && !data) {
    return (
      <div className="alo-fade-up">
        <Card className="p-6 border-rose-200 bg-rose-50/50">
          <div className="flex items-center gap-3 text-rose-700">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <p className="font-semibold">ভয়েস স্টুডিও লোড ব্যর্থ</p>
              <p className="text-sm text-rose-600/80">{loadError}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="mt-4" onClick={loadData}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> আবার চেষ্টা করুন
          </Button>
        </Card>
      </div>
    );
  }

  const stats = data?.stats;
  const maxInput = data?.maxInputLength ?? 1024;

  return (
    <div className="alo-fade-up space-y-5">
      {/* ============== HEADER CARD ============== */}
      <Card className="p-5 alo-card-grad border-0 relative overflow-hidden">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-500/10 blur-2xl" />
        <div className="flex flex-wrap items-start justify-between gap-4 relative">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-violet-500/20 to-emerald-500/20 p-3 text-violet-600 alo-glow">
              <Mic className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Voice Studio{" "}
                <span className="alo-text-grad">/ ভয়েস স্টুডিও</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5 max-w-xl">
                ৭টি ভয়েস প্রোফাইলে টেক্সট থেকে স্পিচ তৈরি করুন ·
                <span className="text-violet-600/80 font-medium">
                  {" "}
                  7 voice profiles
                </span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={loadData} disabled={loading}>
              <RotateCcw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
              রিফ্রেশ
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-5">
          <StatTile
            label="Total · মোট"
            value={stats?.total ?? 0}
            icon={<Activity className="h-3.5 w-3.5" />}
            tone="violet"
          />
          <StatTile
            label="Completed · সম্পন্ন"
            value={stats?.completed ?? 0}
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            tone="emerald"
          />
          <StatTile
            label="Failed · ব্যর্থ"
            value={stats?.failed ?? 0}
            icon={<XCircle className="h-3.5 w-3.5" />}
            tone="rose"
          />
          <StatTile
            label="Total Chars · অক্ষর"
            value={stats?.totalChars ?? 0}
            icon={<Hash className="h-3.5 w-3.5" />}
            tone="amber"
          />
          <StatTile
            label="Duration · সময়"
            value={formatDuration(stats?.totalDuration ?? 0)}
            icon={<Clock className="h-3.5 w-3.5" />}
            tone="slate"
          />
        </div>
      </Card>

      {/* ============== MAIN GRID ============== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ============== LEFT — GENERATION FORM ============== */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <AudioLines className="h-4 w-4 text-violet-600" />
                অডিও তৈরি করুন
              </h2>
              <Button size="sm" variant="ghost" onClick={handleReset} className="h-7 text-xs">
                <RotateCcw className="h-3 w-3 mr-1" /> রিসেট
              </Button>
            </div>

            {/* Text input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="vs-text" className="text-xs flex items-center gap-1.5">
                  <Mic className="h-3 w-3 text-violet-600" /> টেক্সট · Text to speak
                </Label>
                <div className="flex items-center gap-2 text-[10px]">
                  <span
                    className={cn(
                      "tabular-nums font-medium",
                      overLimit ? "text-amber-600" : "text-muted-foreground"
                    )}
                  >
                    {charCount} / {maxInput} chars
                  </span>
                  {overLimit && (
                    <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">
                      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                      অটো-চাঙ্ক · {chunksPredicted} টুকরো
                    </Badge>
                  )}
                </div>
              </div>
              <Textarea
                id="vs-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder="এখানে বাংলা বা ইংরেজি টেক্সট লিখুন... যেমন: আলো লার্নিং জার্নিতে স্বাগতম!"
                className="resize-y text-sm leading-relaxed"
              />
              <p className="text-[10px] text-muted-foreground">
                দীর্ঘ টেক্সট স্বয়ংক্রিয়ভাবে একাধিক চাঙ্কে বিভক্ত হবে ·
                Long text auto-splits into multiple chunks.
              </p>
            </div>

            {/* Voice picker */}
            <div className="mt-5">
              <Label className="text-xs mb-2 block flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-violet-600" /> ভয়েস প্রোফাইল · Voice Profile
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {voices.map((v) => {
                  const selected = voice === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVoice(v.id)}
                      className={cn(
                        "text-left rounded-xl border p-3 transition-all duration-200 group relative overflow-hidden",
                        "hover:shadow-md hover:-translate-y-0.5",
                        selected
                          ? "border-violet-400 ring-2 ring-violet-300/60 bg-violet-50/50 dark:bg-violet-950/20"
                          : "border-border/60 bg-card hover:border-violet-300/60"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{v.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate flex items-center gap-1">
                            {v.label}
                            {selected && (
                              <CheckCircle2 className="h-3 w-3 text-violet-600 shrink-0" />
                            )}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {v.style}
                          </p>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground/80 mt-1.5 line-clamp-2">
                        ✦ {v.bestFor}
                      </p>
                      {v.usage > 0 && (
                        <span className="absolute top-1.5 right-1.5 text-[9px] tabular-nums bg-muted/70 px-1.5 py-0.5 rounded-md text-muted-foreground">
                          ×{v.usage}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Speed + Volume controls */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Gauge className="h-3 w-3 text-violet-600" /> গতি · Speed
                  </Label>
                  <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-200">
                    {speed.toFixed(1)}x · {speedLabel(speed)}
                  </Badge>
                </div>
                <Slider
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  value={[speed]}
                  onValueChange={(v) => setSpeed(v[0])}
                  className="w-full"
                />
                <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                  <span>0.5x · ধীর</span>
                  <span>1.0x · স্বাভাবিক</span>
                  <span>2.0x · দ্রুত</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Volume2 className="h-3 w-3 text-violet-600" /> ভলিউম · Volume
                  </Label>
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                    {volume.toFixed(1)}×
                  </Badge>
                </div>
                <Slider
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={[volume]}
                  onValueChange={(v) => setVolume(v[0])}
                  className="w-full"
                />
                <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                  <span>0.1× · নিঃশব্দ</span>
                  <span>1.0× · স্বাভাবিক</span>
                  <span>10× · সর্বোচ্চ</span>
                </div>
              </div>
            </div>

            {/* Format + Language */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs mb-1.5 block flex items-center gap-1.5">
                  <AudioWaveform className="h-3 w-3 text-violet-600" /> ফরম্যাট · Format
                </Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAT_OPTIONS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        <span className="font-medium">{f.label}</span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          · {f.note}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs mb-1.5 block flex items-center gap-1.5">
                  <Mic className="h-3 w-3 text-violet-600" /> ভাষা · Language
                </Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        <span className="font-medium">{l.label}</span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          · {l.bn}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Generate button */}
            <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button
                onClick={handleGenerate}
                disabled={generating || !text.trim()}
                className="bg-violet-600 hover:bg-violet-700 text-white h-10 flex-1 sm:flex-none"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    তৈরি হচ্ছে... · Generating
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Audio · অডিও তৈরি করুন
                  </>
                )}
              </Button>
              <span className="text-[11px] text-muted-foreground">
                {chunksPredicted > 1
                  ? `${chunksPredicted} চাঙ্ক তৈরি হবে · ${charCount} chars`
                  : charCount > 0
                    ? `${charCount} chars · ${formatDuration(charCount / 15)} est`
                    : "টেক্সট লিখুন"}
              </span>
            </div>

            {/* Inline error */}
            {genError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50/70 dark:bg-rose-950/20 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-rose-700 dark:text-rose-400">
                    তৈরি ব্যর্থ · Generation failed
                  </p>
                  <p className="text-rose-600/80 dark:text-rose-300/80 mt-0.5 break-words">
                    {genError}
                  </p>
                </div>
              </div>
            )}

            {/* Result */}
            {result && result.ok && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <p className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">
                      অডিও প্রস্তুত · Audio ready
                    </p>
                  </div>
                  {result.audioUrl && (
                    <Button asChild size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white">
                      <a href={result.audioUrl} download>
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        ডাউনলোড · Download
                      </a>
                    </Button>
                  )}
                </div>

                {result.audioUrl && (
                  <audio
                    ref={audioRef}
                    controls
                    src={result.audioUrl}
                    className="w-full h-10"
                  />
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <MetaChip
                    icon={<Mic className="h-3 w-3" />}
                    label="ভয়েস"
                    value={result.voiceLabel ?? result.voice ?? "-"}
                  />
                  <MetaChip
                    icon={<Clock className="h-3 w-3" />}
                    label="সময়"
                    value={formatDuration(result.durationSec)}
                  />
                  <MetaChip
                    icon={<AudioLines className="h-3 w-3" />}
                    label="চাঙ্ক"
                    value={`${result.chunksGenerated}`}
                  />
                  <MetaChip
                    icon={<Hash className="h-3 w-3" />}
                    label="অক্ষর"
                    value={`${result.charCount}`}
                  />
                </div>

                {result.allChunks && result.allChunks.length > 1 && (
                  <div className="pt-2 border-t border-emerald-200/60">
                    <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
                      <AudioWaveform className="h-2.5 w-2.5" />
                      সব চাঙ্ক · {result.allChunks.length} chunks
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {result.allChunks.map((c, i) => (
                        <a
                          key={c}
                          href={c}
                          download
                          className="inline-flex items-center gap-1 rounded-md bg-white/70 dark:bg-white/5 border border-emerald-200/60 px-2 py-0.5 text-[10px] hover:bg-emerald-100/60 transition-colors"
                        >
                          <Play className="h-2.5 w-2.5" />
                          chunk {i + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* ============== RIGHT — USAGE STATS + RECENT ============== */}
        <div className="space-y-4">
          {/* Voice usage */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-violet-600" />
              ভয়েস ব্যবহার · Voice Usage
            </h3>
            {voices.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                কোনো ব্যবহার নেই · No usage yet
              </p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 vs-scroll">
                {voices.map((v) => {
                  const pct = (v.usage / maxVoiceUsage) * 100;
                  const isSel = voice === v.id;
                  return (
                    <div key={v.id} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span
                          className={cn(
                            "flex items-center gap-1.5 font-medium truncate",
                            isSel && "text-violet-700 dark:text-violet-300"
                          )}
                        >
                          <span>{v.emoji}</span>
                          {v.label}
                          {isSel && (
                            <span className="text-[9px] bg-violet-100 text-violet-700 px-1 rounded">
                              সক্রিয়
                            </span>
                          )}
                        </span>
                        <span className="tabular-nums text-muted-foreground shrink-0">
                          {v.usage}×
                        </span>
                      </div>
                      <Progress
                        value={pct}
                        className={cn(
                          "h-1.5",
                          isSel
                            ? "[&_div]:bg-violet-500"
                            : "[&_div]:bg-emerald-400/70"
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Recent generations */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-violet-600" />
              সাম্প্রতিক · Recent Generations
            </h3>
            {!data?.recent || data.recent.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mic className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">এখনও কোনো অডিও তৈরি হয়নি</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto pr-1 space-y-2 vs-scroll">
                {data.recent.map((g) => {
                  const profile = data.voices[g.voice];
                  const emoji = VOICE_EMOJI[g.voice] ?? "🎙️";
                  const done = g.status === "completed";
                  const failed = g.status === "failed";
                  return (
                    <div
                      key={g.id}
                      className={cn(
                        "rounded-lg border p-2.5 transition-colors",
                        failed
                          ? "border-rose-200/60 bg-rose-50/30 dark:bg-rose-950/10"
                          : done
                            ? "border-emerald-200/60 bg-emerald-50/30 dark:bg-emerald-950/10"
                            : "border-amber-200/60 bg-amber-50/30 dark:bg-amber-950/10"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-base shrink-0">{emoji}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 h-4 bg-violet-50 text-violet-700 border-violet-200"
                            >
                              {profile?.label ?? g.voice}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Hash className="h-2 w-2" />
                              {g.charCount}
                            </span>
                            {g.durationSec != null && g.durationSec > 0 && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Clock className="h-2 w-2" />
                                {formatDuration(g.durationSec)}
                              </span>
                            )}
                            <StatusDot status={g.status} />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1 italic">
                            “{g.text}”
                          </p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[9px] text-muted-foreground">
                              {formatRelativeTime(g.createdAt)}
                            </span>
                            {done && g.filePath && (
                              <a
                                href={g.filePath}
                                download
                                className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 font-medium"
                              >
                                <Play className="h-2.5 w-2.5" />
                                Play
                              </a>
                            )}
                          </div>
                          {failed && g.errorMessage && (
                            <p className="text-[9px] text-rose-600/80 mt-1 line-clamp-1">
                              ⚠ {g.errorMessage}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ============== FOOTER NOTE ============== */}
      <Card className="p-3 border-dashed">
        <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1.5 flex-wrap">
          <AlertTriangle className="h-3 w-3 text-amber-500" />
          Max 1024 chars per chunk; longer text auto-splits into multiple audio files.
          <span className="text-muted-foreground/70">
            · দীর্ঘ টেক্সট স্বয়ংক্রিয়ভাবে একাধিক ফাইলে বিভক্ত হবে।
          </span>
        </p>
      </Card>

      {/* Custom scrollbar styles */}
      <style jsx>{`
        :global(.vs-scroll) {
          scrollbar-width: thin;
          scrollbar-color: rgb(139 92 246 / 0.4) transparent;
        }
        :global(.vs-scroll::-webkit-scrollbar) {
          width: 5px;
          height: 5px;
        }
        :global(.vs-scroll::-webkit-scrollbar-track) {
          background: transparent;
        }
        :global(.vs-scroll::-webkit-scrollbar-thumb) {
          background: rgb(139 92 246 / 0.35);
          border-radius: 9999px;
        }
        :global(.vs-scroll::-webkit-scrollbar-thumb:hover) {
          background: rgb(139 92 246 / 0.6);
        }
      `}</style>
    </div>
  );
}

// ============================================================
// Small inline sub-components
// ============================================================

function StatTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone: "violet" | "emerald" | "rose" | "amber" | "slate";
}) {
  const tones: Record<string, string> = {
    violet: "from-violet-500/15 to-violet-500/5 text-violet-700 dark:text-violet-300",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    rose: "from-rose-500/15 to-rose-500/5 text-rose-700 dark:text-rose-300",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-700 dark:text-amber-300",
    slate: "from-slate-500/15 to-slate-500/5 text-slate-700 dark:text-slate-300",
  };
  return (
    <div
      className={cn(
        "rounded-xl bg-gradient-to-br border border-white/10 dark:border-white/5 p-2.5",
        tones[tone]
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-medium uppercase tracking-wide opacity-70 truncate">
          {label}
        </p>
        {icon && <span className="opacity-70">{icon}</span>}
      </div>
      <p className="text-lg font-bold mt-0.5 tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function MetaChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-white/70 dark:bg-white/5 border border-emerald-200/40 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="text-xs font-semibold mt-0.5 truncate">{value}</p>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, { c: string; label: string }> = {
    completed: { c: "text-emerald-600", label: "✓" },
    failed: { c: "text-rose-600", label: "✕" },
    pending: { c: "text-amber-600", label: "…" },
  };
  const s = map[status] ?? { c: "text-slate-500", label: status };
  return (
    <span className={cn("text-[10px] font-bold ml-auto", s.c)} title={status}>
      {s.label}
    </span>
  );
}
