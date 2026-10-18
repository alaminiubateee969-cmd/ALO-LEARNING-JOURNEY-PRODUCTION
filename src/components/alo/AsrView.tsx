"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  FileAudio,
  Upload,
  Mic,
  Download,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  X,
  Loader2,
  Clock,
  Type,
  Languages,
  HardDrive,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Activity,
} from "lucide-react";

interface AudioTranscription {
  id: string;
  fileName: string;
  fileSize: number;
  format: string;
  language: string;
  transcription: string | null;
  wordCount: number;
  durationSec: number | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

interface AsrStats {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  totalWords: number;
  totalDuration: number;
  totalSize: number;
}

interface AsrListResponse {
  recent: AudioTranscription[];
  stats: AsrStats;
  supportedFormats: string[];
  maxFileSize: number;
}

interface TranscribeResponse {
  ok: boolean;
  id?: string;
  fileName?: string;
  format?: string;
  language?: string;
  transcription?: string;
  wordCount?: number;
  durationSec?: number | null;
  transcriptUrl?: string;
  error?: string;
}

const fmtSize = (bytes: number): string => {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const fmtDuration = (sec: number | null | undefined): string => {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const fmtTime = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const statusBadge = (status: string) => {
  switch (status) {
    case "completed":
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800 text-[10px] gap-1">
          <CheckCircle2 className="h-3 w-3" /> Completed
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800 text-[10px] gap-1">
          <XCircle className="h-3 w-3" /> Failed
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800 text-[10px] gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Pending
        </Badge>
      );
    default:
      return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  }
};

export default function AsrView() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [list, setList] = useState<AudioTranscription[]>([]);
  const [stats, setStats] = useState<AsrStats | null>(null);
  const [supportedFormats, setSupportedFormats] = useState<string[]>(["wav", "mp3", "m4a", "flac", "ogg"]);
  const [maxFileSize, setMaxFileSize] = useState<number>(104857600);
  const [loadingList, setLoadingList] = useState(true);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<string>("auto");
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [result, setResult] = useState<TranscribeResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadList = useCallback(() => {
    fetch("/api/asr-transcribe")
      .then((r) => r.json())
      .then((d: AsrListResponse) => {
        setList(d.recent || []);
        setStats(d.stats || null);
        setSupportedFormats(d.supportedFormats || ["wav", "mp3", "m4a", "flac", "ogg"]);
        setMaxFileSize(d.maxFileSize || 104857600);
      })
      .catch(() => {
        /* ignore */
      })
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const detectFormat = (file: File): string => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (supportedFormats.includes(ext)) return ext;
    if (file.type === "audio/wav" || file.type === "audio/x-wav") return "wav";
    if (file.type === "audio/mpeg" || file.type === "audio/mp3") return "mp3";
    if (file.type === "audio/mp4" || file.type === "audio/x-m4a") return "m4a";
    if (file.type === "audio/flac") return "flac";
    if (file.type === "audio/ogg") return "ogg";
    return ext || "wav";
  };

  const handleFileSelected = (file: File | undefined) => {
    if (!file) return;
    setInlineError(null);
    setResult(null);
    const fmt = detectFormat(file);
    if (!supportedFormats.includes(fmt)) {
      setInlineError(`Unsupported format ".${fmt}". Supported: ${supportedFormats.join(", ").toUpperCase()}`);
      setSelectedFile(null);
      return;
    }
    if (file.size > maxFileSize) {
      setInlineError(`File too large (${fmtSize(file.size)}). Max ${(maxFileSize / 1024 / 1024).toFixed(0)} MB.`);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  };

  const onBrowse = () => fileInputRef.current?.click();

  const onTranscribe = async () => {
    if (!selectedFile) {
      setInlineError("Please select an audio file first.");
      return;
    }
    setProcessing(true);
    setInlineError(null);
    setResult(null);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error || new Error("File read failed"));
        reader.readAsDataURL(selectedFile);
      });
      const base64 = dataUrl.split(",")[1];
      const format = detectFormat(selectedFile);

      const res = await fetch("/api/asr-transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64: base64,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          format,
          language,
        }),
      });
      const d: TranscribeResponse = await res.json();
      if (!res.ok || !d.ok) {
        setInlineError(d.error || `Transcription failed (HTTP ${res.status})`);
        toast({
          title: "Transcription failed",
          description: d.error || `HTTP ${res.status}`,
          variant: "destructive",
        });
      } else {
        setResult(d);
        toast({
          title: "Transcription complete",
          description: `${d.wordCount} words • ${fmtDuration(d.durationSec)}`,
        });
        loadList();
      }
    } catch (e) {
      const msg = (e as Error).message || String(e);
      setInlineError(msg);
      toast({ title: "Transcription failed", description: msg, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setResult(null);
    setInlineError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const statTiles = [
    { label: "Total", bn: "মোট", value: stats?.total ?? 0, icon: <FileAudio className="h-4 w-4" />, tone: "slate" },
    { label: "Completed", bn: "সম্পন্ন", value: stats?.completed ?? 0, icon: <CheckCircle2 className="h-4 w-4" />, tone: "emerald" },
    { label: "Failed", bn: "ব্যর্থ", value: stats?.failed ?? 0, icon: <XCircle className="h-4 w-4" />, tone: "rose" },
    { label: "Pending", bn: "অপেক্ষমাণ", value: stats?.pending ?? 0, icon: <Clock className="h-4 w-4" />, tone: "amber" },
    { label: "Total Words", bn: "মোট শব্দ", value: stats?.totalWords ?? 0, icon: <Type className="h-4 w-4" />, tone: "teal" },
    { label: "Total Duration", bn: "মোট সময়", value: fmtDuration(stats?.totalDuration), icon: <Activity className="h-4 w-4" />, tone: "cyan" },
    { label: "Total Size", bn: "মোট আকার", value: fmtSize(stats?.totalSize ?? 0), icon: <HardDrive className="h-4 w-4" />, tone: "slate" },
  ];

  const toneClasses: Record<string, string> = {
    slate: "border-slate-200 bg-slate-50/50 dark:bg-slate-900/20 dark:border-slate-800 text-slate-700 dark:text-slate-300",
    emerald: "border-emerald-200 bg-emerald-50/60 dark:bg-emerald-900/15 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300",
    rose: "border-rose-200 bg-rose-50/60 dark:bg-rose-900/15 dark:border-rose-800 text-rose-700 dark:text-rose-300",
    amber: "border-amber-200 bg-amber-50/60 dark:bg-amber-900/15 dark:border-amber-800 text-amber-700 dark:text-amber-300",
    teal: "border-teal-200 bg-teal-50/60 dark:bg-teal-900/15 dark:border-teal-800 text-teal-700 dark:text-teal-300",
    cyan: "border-cyan-200 bg-cyan-50/60 dark:bg-cyan-900/15 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300",
  };

  return (
    <div className="alo-fade-up space-y-5">
      {/* Header card */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-teal-400/25 to-cyan-400/15 p-2.5 text-teal-600 alo-glow">
              <Mic className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                ASR Transcription Studio
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                <span className="alo-text-grad">অডিও ফাইল থেকে টেক্সট ট্রান্সক্রিপশন</span> · Speech-to-Text
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="h-8" onClick={loadList} disabled={loadingList}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loadingList ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats row */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {statTiles.map((s) => (
            <div
              key={s.label}
              className={`rounded-xl border p-3 transition-shadow hover:shadow-sm ${toneClasses[s.tone]}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 truncate">{s.label}</p>
                <span className="opacity-70">{s.icon}</span>
              </div>
              <p className="text-lg font-bold tabular-nums leading-none">{s.value}</p>
              <p className="text-[10px] mt-1 opacity-70 truncate">{s.bn}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* LEFT — Upload + Transcribe (3/5) */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Upload className="h-4 w-4 text-teal-600" />
                Upload &amp; Transcribe
              </h2>
              <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-800 text-[10px]">
                {supportedFormats.map((f) => f.toUpperCase()).join(" · ")}
              </Badge>
            </div>

            {/* Dropzone */}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg"
              className="hidden"
              onChange={(e) => handleFileSelected(e.target.files?.[0])}
            />
            {!selectedFile ? (
              <div
                role="button"
                tabIndex={0}
                aria-label="Upload audio file"
                onClick={onBrowse}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onBrowse();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragging(false);
                }}
                onDrop={onDrop}
                className={`group relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer min-h-[180px]
                  ${dragging
                    ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20 scale-[1.01]"
                    : "border-border hover:border-teal-400 hover:bg-teal-50/40 dark:hover:bg-teal-900/10"
                  }`}
              >
                <div className={`rounded-full p-3 transition-transform group-hover:scale-110 ${dragging ? "bg-teal-100 dark:bg-teal-800/40" : "bg-muted"}`}>
                  <FileAudio className={`h-7 w-7 ${dragging ? "text-teal-600" : "text-muted-foreground"}`} />
                </div>
                <p className="text-sm font-medium">
                  {dragging ? "Drop the audio file here" : "Click to browse or drag & drop"}
                </p>
                <p className="text-xs text-muted-foreground">
                  অডিও ফাইল আপলোড করুন · WAV, MP3, M4A, FLAC, OGG
                </p>
                <p className="text-[10px] text-muted-foreground/70">
                  Max {(maxFileSize / 1024 / 1024).toFixed(0)} MB
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-teal-200 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-900/15 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white dark:bg-teal-900/30 p-2.5 text-teal-600 shrink-0">
                    <FileAudio className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <Badge variant="outline" className="text-[10px] uppercase bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800">
                        {detectFormat(selectedFile)}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">{fmtSize(selectedFile.size)}</Badge>
                      <Badge variant="outline" className="text-[10px]">{selectedFile.type || "audio/*"}</Badge>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={clearFile} aria-label="Remove file">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Language select + transcribe button */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="asr-lang" className="flex items-center gap-1.5 text-xs">
                  <Languages className="h-3.5 w-3.5 text-teal-600" />
                  Language / ভাষা
                </Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="asr-lang" className="w-full">
                    <SelectValue placeholder="Auto-detect" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect (স্বয়ংক্রিয়)</SelectItem>
                    <SelectItem value="bn">Bengali (বাংলা)</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="zh">Chinese (中文)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={onTranscribe}
                disabled={!selectedFile || processing}
                className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white h-9"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Transcribing…
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4 mr-2" />
                    Transcribe Audio
                  </>
                )}
              </Button>
            </div>

            {/* Inline error */}
            {inlineError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-900/15 dark:border-rose-800 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
                <p className="text-xs text-rose-700 dark:text-rose-300">{inlineError}</p>
              </div>
            )}

            {/* Result area */}
            {result && (
              <div className="mt-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <h3 className="text-sm font-semibold">Transcription Result / ফলাফল</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800">
                      <Type className="h-3 w-3" /> {result.wordCount} words
                    </Badge>
                    <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800">
                      <Clock className="h-3 w-3" /> {fmtDuration(result.durationSec)}
                    </Badge>
                  </div>
                </div>
                <Textarea
                  readOnly
                  value={result.transcription || ""}
                  className="min-h-[140px] max-h-[280px] resize-y bg-white dark:bg-background text-sm leading-relaxed"
                  placeholder="(no transcription returned)"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => copyText(result.transcription || "")} className="h-8">
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Text
                      </>
                    )}
                  </Button>
                  {result.transcriptUrl && (
                    <Button size="sm" variant="outline" asChild className="h-8">
                      <a href={result.transcriptUrl} download>
                        <Download className="h-3.5 w-3.5 mr-1.5" /> Download .txt
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT — Recent transcriptions (2/5) */}
        <div className="lg:col-span-2">
          <Card className="p-5 sm:p-6 h-full">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-teal-600" />
                Recent Transcriptions
              </h2>
              <Badge variant="outline" className="text-[10px]">{list.length}</Badge>
            </div>

            {loadingList ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-lg alo-shimmer" />
                ))}
              </div>
            ) : list.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <FileAudio className="h-9 w-9 mx-auto mb-2 opacity-30" />
                No transcriptions yet.
                <p className="text-[11px] mt-1">এখনও কোনো ট্রান্সক্রিপশন নেই।</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[600px] alo-scrollbar pr-2">
                <div className="space-y-2">
                  {list.map((item) => {
                    const expanded = expandedId === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`rounded-xl border transition-colors ${expanded ? "border-teal-300 dark:border-teal-700 bg-teal-50/30 dark:bg-teal-900/10" : "border-border hover:border-teal-200 dark:hover:border-teal-800"}`}
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : item.id)}
                          className="w-full text-left p-3 flex items-start gap-2"
                        >
                          <div className="mt-0.5 shrink-0 text-teal-600">
                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-medium truncate flex-1 min-w-0">{item.fileName}</p>
                              {statusBadge(item.status)}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                              <Badge variant="outline" className="text-[9px] uppercase">{item.format}</Badge>
                              <Badge variant="outline" className="text-[9px] gap-1">
                                <Languages className="h-2.5 w-2.5" /> {item.language}
                              </Badge>
                              <Badge variant="outline" className="text-[9px] gap-1">
                                <Type className="h-2.5 w-2.5" /> {item.wordCount}
                              </Badge>
                              <Badge variant="outline" className="text-[9px] gap-1">
                                <Clock className="h-2.5 w-2.5" /> {fmtDuration(item.durationSec)}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground ml-auto">{fmtTime(item.createdAt)}</span>
                            </div>
                          </div>
                        </button>
                        {expanded && (
                          <div className="px-3 pb-3 space-y-2">
                            {item.status === "failed" ? (
                              <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-900/15 p-2.5 flex items-start gap-2">
                                <AlertTriangle className="h-3.5 w-3.5 text-rose-600 mt-0.5 shrink-0" />
                                <p className="text-[11px] text-rose-700 dark:text-rose-300">{item.errorMessage || "Transcription failed"}</p>
                              </div>
                            ) : (
                              <div className="rounded-lg border border-border bg-muted/30 dark:bg-muted/10 p-2.5">
                                <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                                  {item.transcription || <span className="text-muted-foreground italic">No transcription text</span>}
                                </p>
                              </div>
                            )}
                            {item.transcription && (
                              <div className="flex items-center gap-1.5">
                                <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => copyText(item.transcription!)}>
                                  <Copy className="h-3 w-3 mr-1" /> Copy
                                </Button>
                                <Button size="sm" variant="ghost" asChild className="h-7 text-[11px]">
                                  <a href={`/asr-output/transcript_${item.id}.txt`} download>
                                    <Download className="h-3 w-3 mr-1" /> .txt
                                  </a>
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
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
      <p className="text-[11px] text-muted-foreground text-center px-2">
        Supported: WAV, MP3, M4A, FLAC, OGG · Max 100 MB · Audio should have clear speech for best accuracy.
      </p>
    </div>
  );
}
