"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionHeader } from "./primitives";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowDown, ArrowUp, Captions, Clapperboard, Download, Film, ImagePlus, Loader2,
  Lock, Music2, PlayCircle, RefreshCw, Sparkles, Trash2, Upload, Wand2, X,
} from "lucide-react";
import {
  ASPECT_PRESETS,
  CAPTION_STYLES,
  MOTION_PRESETS,
  MUSIC_MOODS,
  PHOTO_VIDEO_LIMITS,
  QUALITY_PRESETS,
  TRANSITION_PRESETS,
  type AspectPresetId,
  type CaptionStyle,
  type MotionId,
  type PhotoVideoRenderResult,
  type QualityId,
  type TransitionId,
} from "@/lib/photo-video";

type PhotoEntry = {
  key: string;
  file: File;
  previewUrl: string;
  motion: MotionId | "auto";
};

type GeneratedImage = { path: string; name: string; sizeBytes: number; modifiedAt: string };

type RenderJob = {
  id: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  srtUrl?: string | null;
  durationSec?: number;
  width?: number;
  height?: number;
  sizeBytes?: number;
  createdAt?: string;
  shots?: { index: number; caption: string; motion: string }[];
};

const STAGES = [
  "Reading photos",
  "Preparing still frames",
  "Writing voice (local TTS)",
  "Composing music bed",
  "Animating camera moves",
  "Joining shots + captions",
  "Validating audio + video",
];

const VOICES = [
  { id: "bn", label: "বাংলা · Bangla (bn)" },
  { id: "bn+f2", label: "বাংলা নারী · Bangla female (bn+f2)" },
  { id: "en", label: "English (en)" },
  { id: "en+f3", label: "English female (en+f3)" },
  { id: "hi", label: "Hindi (hi)" },
];

function formatSeconds(value: number): string {
  const total = Math.max(0, Math.round(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatBytes(value: number): string {
  if (!value) return "—";
  if (value > 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(value / 1024)} KB`;
}

export default function PhotoToVideoStudio() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState("আমার ছবি থেকে ভিডিও");
  const [narration, setNarration] = useState("");
  const [voice, setVoice] = useState("bn");
  const [aspect, setAspect] = useState<AspectPresetId>("vertical");
  const [quality, setQuality] = useState<QualityId>("standard");
  const [motion, setMotion] = useState<MotionId | "auto">("auto");
  const [transition, setTransition] = useState<TransitionId>("fade");
  const [transitionSec, setTransitionSec] = useState(0.6);
  const [shotSec, setShotSec] = useState(4);
  const [captions, setCaptions] = useState(true);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle["id"]>("editorial");
  const [music, setMusic] = useState<string>("hopeful");
  const [musicVolume, setMusicVolume] = useState(0.16);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [scriptBusy, setScriptBusy] = useState(false);

  const [rendering, setRendering] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [result, setResult] = useState<PhotoVideoRenderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RenderJob[]>([]);
  const [generated, setGenerated] = useState<GeneratedImage[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickedPaths, setPickedPaths] = useState<string[]>([]);

  const applyGallery = useCallback((data: { renders?: unknown; images?: unknown }) => {
    setRecent(Array.isArray(data.renders) ? (data.renders as RenderJob[]) : []);
    setGenerated(Array.isArray(data.images) ? (data.images as GeneratedImage[]) : []);
  }, []);

  const loadRecent = useCallback(async () => {
    try {
      const response = await fetch("/api/video/from-photo", { cache: "no-store" });
      if (!response.ok) return;
      applyGallery(await response.json());
    } catch {
      /* gallery is optional */
    }
  }, [applyGallery]);

  // Initial gallery load (promise chain so the effect itself stays side-effect only).
  useEffect(() => {
    fetch("/api/video/from-photo", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) applyGallery(data);
      })
      .catch(() => {});
  }, [applyGallery]);

  useEffect(() => {
    if (!rendering) return;
    const timer = setInterval(() => {
      setStageIndex((current) => (current < STAGES.length - 1 ? current + 1 : current));
    }, 2200);
    return () => clearInterval(timer);
  }, [rendering]);

  useEffect(() => () => photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl)), []);

  const totalPhotos = photos.length + pickedPaths.length;
  const estimatedSeconds = useMemo(() => {
    const base = totalPhotos * shotSec;
    return Math.max(0, base - Math.max(0, totalPhotos - 1) * transitionSec);
  }, [totalPhotos, shotSec, transitionSec]);

  const addFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    const accepted: PhotoEntry[] = [];
    for (const file of incoming) {
      if (!file.type.startsWith("image/")) {
        toast({ title: "শুধু ছবি আপলোড করুন", description: `${file.name} is not an image`, variant: "destructive" });
        continue;
      }
      if (file.size > PHOTO_VIDEO_LIMITS.maxImageBytes) {
        toast({ title: "ছবিটি খুব বড়", description: `${file.name} > 15MB`, variant: "destructive" });
        continue;
      }
      accepted.push({ key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`, file, previewUrl: URL.createObjectURL(file), motion: "auto" });
    }
    if (accepted.length === 0) return;
    setPhotos((current) => {
      const merged = [...current, ...accepted].slice(0, PHOTO_VIDEO_LIMITS.maxImages);
      if (current.length + accepted.length > PHOTO_VIDEO_LIMITS.maxImages) {
        toast({ title: `সর্বোচ্চ ${PHOTO_VIDEO_LIMITS.maxImages}টি ছবি`, variant: "destructive" });
      }
      return merged;
    });
  };

  const move = (index: number, direction: -1 | 1) => {
    setPhotos((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removePhoto = (key: string) => {
    setPhotos((current) => {
      const target = current.find((photo) => photo.key === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((photo) => photo.key !== key);
    });
  };

  const togglePicked = (path: string) => {
    setPickedPaths((current) => {
      if (current.includes(path)) return current.filter((value) => value !== path);
      if (current.length + photos.length >= PHOTO_VIDEO_LIMITS.maxImages) {
        toast({ title: `সর্বোচ্চ ${PHOTO_VIDEO_LIMITS.maxImages}টি ছবি`, variant: "destructive" });
        return current;
      }
      return [...current, path];
    });
  };

  /**
   * Draft the narration with our own agent (local model + free-tier allowlist
   * via /api/voice/script). The owner always reviews before rendering.
   */
  const draftScript = async () => {
    if (scriptBusy) return;
    if (!title.trim()) {
      toast({ title: "আগে শিরোনাম দিন", description: "The agent needs a topic to write about.", variant: "destructive" });
      return;
    }
    setScriptBusy(true);
    try {
      const response = await fetch("/api/voice/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: title, audience: "বাংলাদেশি পিতামাতা" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.text) {
        toast({
          title: "স্ক্রিপ্ট তৈরি হয়নি",
          description: String(data.error ?? "Local model unavailable — নিজে লিখে দিন বা পরে আবার চেষ্টা করুন।"),
          variant: "destructive",
        });
        return;
      }
      setNarration(String(data.text).slice(0, PHOTO_VIDEO_LIMITS.maxNarrationChars));
      toast({
        title: "খসড়া স্ক্রিপ্ট তৈরি ✅",
        description: `${data.provider ?? "local"} · ${Array.isArray(data.lines) ? data.lines.length : 0} লাইন — রেন্ডারের আগে দেখে নিন।`,
      });
    } catch (error) {
      toast({ title: "এজেন্ট সংযোগ ব্যর্থ", description: (error as Error).message, variant: "destructive" });
    } finally {
      setScriptBusy(false);
    }
  };

  const render = async () => {
    if (totalPhotos === 0) {
      toast({ title: "প্রথমে ছবি আপলোড করুন", description: "At least one photo is required", variant: "destructive" });
      return;
    }
    setRendering(true);
    setStageIndex(0);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      photos.forEach((photo) => formData.append("images", photo.file, photo.file.name));
      if (pickedPaths.length > 0) formData.append("imagePaths", JSON.stringify(pickedPaths));
      formData.append("title", title);
      formData.append("narration", narration);
      formData.append("voice", voice);
      formData.append("aspect", aspect);
      formData.append("quality", quality);
      formData.append("motion", motion);
      formData.append("transition", transition);
      formData.append("transitionSec", String(transitionSec));
      formData.append("shotSec", String(shotSec));
      formData.append("captions", captions ? "1" : "0");
      formData.append("captionStyle", captionStyle);
      formData.append("music", music);
      formData.append("musicVolume", String(musicVolume));
      formData.append("engine", "local");
      if (audioFile) formData.append("audio", audioFile, audioFile.name);

      const response = await fetch("/api/video/from-photo", { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        setError(data.detail || data.error || "Render failed");
        toast({ title: "ভিডিও তৈরি হয়নি", description: String(data.detail ?? data.error ?? response.status), variant: "destructive" });
        return;
      }
      setResult(data as PhotoVideoRenderResult);
      toast({ title: "ভিডিও তৈরি হয়েছে ✅", description: `${formatSeconds(data.durationSec)} · ${data.width}×${data.height}` });
      void loadRecent();
    } catch (fetchError) {
      setError((fetchError as Error).message);
      toast({ title: "নেটওয়ার্ক সমস্যা", description: (fetchError as Error).message, variant: "destructive" });
    } finally {
      setRendering(false);
    }
  };

  const reset = () => {
    photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    setPhotos([]);
    setPickedPaths([]);
    setAudioFile(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="alo-fade-up space-y-5">
      <SectionHeader
        title="Photo → Video Studio"
        bn="ছবি থেকে ভিডিও"
        desc="ছবি আপলোড করুন — নিজের এজেন্ট ক্যামেরা মোশন, বাংলা ভয়েস, মিউজিক ও ক্যাপশন দিয়ে সম্পূর্ণ MP4 ভিডিও বানিয়ে দেয়। সব ধাপ লোকাল ও ফ্রি।"
        icon={<Clapperboard className="h-5 w-5" />}
        action={
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              <Lock className="h-3 w-3 mr-1" /> Free-only
            </Badge>
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
              <Film className="h-3 w-3 mr-1" /> {totalPhotos} photo{totalPhotos === 1 ? "" : "s"}
            </Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* ---------------- Left: photos ---------------- */}
        <div className="xl:col-span-2 space-y-4">
          <Card className="p-4 alo-card-grad border-0 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                <ImagePlus className="h-4 w-4 text-amber-600" /> ১. ছবি দিন
              </h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowPicker((value) => !value)}>
                  <Sparkles className="h-3 w-3 mr-1" /> Image Studio থেকে
                </Button>
                <Button size="sm" className="h-8 text-xs bg-amber-500 hover:bg-amber-600" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3 w-3 mr-1" /> আপলোড
                </Button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files) addFiles(event.target.files);
                event.target.value = "";
              }}
            />

            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                if (event.dataTransfer.files) addFiles(event.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-xl border-2 border-dashed px-4 py-7 text-center cursor-pointer transition-colors ${
                dragging ? "border-amber-400 bg-amber-50/60 dark:bg-amber-500/10" : "border-border/70 hover:border-amber-300 hover:bg-muted/40"
              }`}
            >
              <Upload className="h-6 w-6 mx-auto mb-2 text-amber-500" />
              <p className="text-sm font-medium">ছবি এখানে ড্র্যাগ করুন বা ক্লিক করুন</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                JPG · PNG · WebP · HEIC — সর্বোচ্চ {PHOTO_VIDEO_LIMITS.maxImages}টি ছবি, প্রতিটি ১৫MB পর্যন্ত
              </p>
            </div>

            {showPicker && (
              <div className="rounded-lg border border-border/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">Image Studio-র সাম্প্রতিক ছবি</p>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowPicker(false)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                {generated.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">কোনো ছবি পাওয়া যায়নি — Image Studio Pro-তে ছবি তৈরি করুন।</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto alo-scrollbar">
                    {generated.map((image) => {
                      const picked = pickedPaths.includes(image.path);
                      return (
                        <button
                          key={image.path}
                          onClick={() => togglePicked(image.path)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            picked ? "border-amber-500 ring-2 ring-amber-200" : "border-transparent hover:border-amber-300"
                          }`}
                          title={image.name}
                        >
                          <img src={image.path} alt={image.name} className="h-full w-full object-cover" />
                          {picked && (
                            <span className="absolute top-1 right-1 bg-amber-500 text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {photos.length > 0 && (
              <div className="space-y-2">
                {photos.map((photo, index) => (
                  <div key={photo.key} className="flex items-center gap-3 rounded-lg border border-border/60 p-2">
                    <span className="h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 to-rose-400 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <img src={photo.previewUrl} alt={photo.file.name} className="h-12 w-12 rounded-md object-cover shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{photo.file.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatBytes(photo.file.size)}</p>
                    </div>
                    <Select
                      value={photo.motion}
                      onValueChange={(value) =>
                        setPhotos((current) =>
                          current.map((entry) => (entry.key === photo.key ? { ...entry, motion: value as MotionId | "auto" } : entry))
                        )
                      }
                    >
                      <SelectTrigger className="h-7 w-32 text-[11px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto motion</SelectItem>
                        {MOTION_PRESETS.map((preset) => (
                          <SelectItem key={preset.id} value={preset.id}>{preset.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-col">
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => move(index, 1)} disabled={index === photos.length - 1} aria-label="Move down">
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-600" onClick={() => removePhoto(photo.key)} aria-label="Remove photo">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {pickedPaths.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {pickedPaths.map((path) => (
                  <Badge key={path} variant="outline" className="text-[10px] gap-1">
                    {path.split("/").pop()}
                    <button onClick={() => togglePicked(path)} aria-label="Remove generated image">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </Card>

          {/* Voice + narration */}
          <Card className="p-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              <Music2 className="h-4 w-4 text-amber-600" /> ২. অডিও — ভয়েস ও মিউজিক
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px]">ভয়েস (local TTS)</Label>
                <Select value={voice} onValueChange={setVoice}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VOICES.map((option) => (
                      <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">মিউজিক মোড</Label>
                <Select value={music} onValueChange={setMusic}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MUSIC_MOODS.map((option) => (
                      <SelectItem key={option.id} value={option.id}>{option.labelBn} · {option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-[11px]">ন্যারেশন স্ক্রিপ্ট (প্রতি লাইন = প্রতি ছবি)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{narration.length}/{PHOTO_VIDEO_LIMITS.maxNarrationChars}</span>
                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={draftScript} disabled={scriptBusy}>
                    {scriptBusy ? <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" /> : <Wand2 className="h-2.5 w-2.5 mr-1" />}
                    এজেন্ট দিয়ে লিখুন
                  </Button>
                </div>
              </div>
              <Textarea
                value={narration}
                onChange={(event) => setNarration(event.target.value.slice(0, PHOTO_VIDEO_LIMITS.maxNarrationChars))}
                rows={5}
                className="text-xs mt-1"
                placeholder={"প্রতিটি ছবির জন্য এক লাইন লিখুন অথবা একটি প্যারাগ্রাফ দিন — এজেন্ট নিজেই ভাগ করে নেবে।\nআজকের বিষয়টি খুবই সহজ।\nধাপে ধাপে এগিয়ে যান।"}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                খালি রাখলে ভিডিও নীরব থাকবে (মিউজিক থাকলে শুধু মিউজিক)। প্রতি ছবির সময় ভয়েসের দৈর্ঘ্য অনুযায়ী ঠিক হবে।
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px]">নিজের ভয়েস ট্র্যাক (ঐচ্ছিক)</Label>
                <Input
                  type="file"
                  accept="audio/*"
                  className="h-8 text-xs mt-1"
                  onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)}
                />
                {audioFile && (
                  <p className="text-[10px] text-emerald-600 mt-1">{audioFile.name} · {formatBytes(audioFile.size)} — ন্যারেশন স্ক্রিপ্টের বদলে এটি ব্যবহার হবে।</p>
                )}
              </div>
              <div>
                <Label className="text-[11px]">মিউজিক ভলিউম · {(musicVolume * 100).toFixed(0)}%</Label>
                <input
                  type="range"
                  min={0}
                  max={PHOTO_VIDEO_LIMITS.maxMusicVolume * 100}
                  value={musicVolume * 100}
                  onChange={(event) => setMusicVolume(Number(event.target.value) / 100)}
                  className="w-full accent-amber-500 mt-3"
                />
              </div>
            </div>
          </Card>

          {/* Result */}
          {result && (
            <Card className="p-4 border-0 bg-gradient-to-br from-emerald-500/10 to-amber-500/10 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2 text-sm">
                  <PlayCircle className="h-4 w-4 text-emerald-600" /> ভিডিও প্রস্তুত
                </h3>
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                  {formatSeconds(result.durationSec)} · {result.width}×{result.height} · {formatBytes(result.sizeBytes)}
                </Badge>
              </div>
              <video
                key={result.videoUrl}
                src={result.videoUrl}
                poster={result.thumbnailUrl || undefined}
                controls
                playsInline
                className="w-full max-h-[440px] rounded-xl bg-black"
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="rounded-lg bg-background/70 p-2">
                  <p className="text-muted-foreground">ভয়েস</p>
                  <p className="font-semibold">{result.voiceEngine ?? "silent"}</p>
                </div>
                <div className="rounded-lg bg-background/70 p-2">
                  <p className="text-muted-foreground">মিউজিক</p>
                  <p className="font-semibold">{result.musicEngine ?? "none"}</p>
                </div>
                <div className="rounded-lg bg-background/70 p-2">
                  <p className="text-muted-foreground">ক্যাপশন</p>
                  <p className="font-semibold">{result.captionsBurned ? "burned + .srt" : "off"}</p>
                </div>
                <div className="rounded-lg bg-background/70 p-2">
                  <p className="text-muted-foreground">খরচ</p>
                  <p className="font-semibold text-emerald-600">$0.00 (free)</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700" asChild>
                  <a href={result.videoUrl} download={`${result.id}.mp4`}>
                    <Download className="h-3 w-3 mr-1" /> MP4 ডাউনলোড
                  </a>
                </Button>
                {result.srtUrl && (
                  <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                    <a href={result.srtUrl} download={`${result.id}.srt`}>
                      <Captions className="h-3 w-3 mr-1" /> SRT সাবটাইটেল
                    </a>
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={reset}>
                  <RefreshCw className="h-3 w-3 mr-1" /> নতুন ভিডিও
                </Button>
              </div>
              {result.shots.length > 0 && (
                <div className="rounded-lg border border-border/60 p-2 space-y-1 max-h-36 overflow-y-auto alo-scrollbar">
                  {result.shots.map((shot) => (
                    <div key={shot.index} className="flex items-start gap-2 text-[11px]">
                      <span className="font-mono text-amber-600 shrink-0">{formatSeconds(shot.startSec)}</span>
                      <Badge variant="outline" className="text-[9px] shrink-0">{shot.motion}</Badge>
                      <span className="text-muted-foreground line-clamp-1">{shot.caption || "(no caption)"}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {error && (
            <Card className="p-3 border border-rose-300 bg-rose-50 dark:bg-rose-950/30">
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">রেন্ডার ব্যর্থ</p>
              <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80 mt-1 break-words">{error}</p>
            </Card>
          )}
        </div>

        {/* ---------------- Right: settings ---------------- */}
        <div className="space-y-4">
          <Card className="p-4 space-y-3 xl:sticky xl:top-20">
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              <Wand2 className="h-4 w-4 text-amber-600" /> ৩. ভিডিও সেটিংস
            </h3>

            <div>
              <Label className="text-[11px]">শিরোনাম (প্রথম ফ্রেমে দেখাবে)</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value.slice(0, PHOTO_VIDEO_LIMITS.maxTitleChars))} className="h-8 text-xs mt-1" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px]">অ্যাসপেক্ট</Label>
                <Select value={aspect} onValueChange={(value) => setAspect(value as AspectPresetId)}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASPECT_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>{preset.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">কোয়ালিটি</Label>
                <Select value={quality} onValueChange={(value) => setQuality(value as QualityId)}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QUALITY_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>{preset.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-[11px]">ক্যামেরা মোশন</Label>
              <Select value={motion} onValueChange={(value) => setMotion(value as MotionId | "auto")}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (প্রতি ছবিতে ভিন্ন মোশন)</SelectItem>
                  {MOTION_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>{preset.labelBn} · {preset.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[11px]">ট্রানজিশন</Label>
              <Select value={transition} onValueChange={(value) => setTransition(value as TransitionId)}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRANSITION_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>{preset.labelBn} · {preset.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px]">প্রতি ছবি · {shotSec}s</Label>
                <input
                  type="range"
                  min={PHOTO_VIDEO_LIMITS.minShotSec}
                  max={PHOTO_VIDEO_LIMITS.maxShotSec}
                  step={0.5}
                  value={shotSec}
                  onChange={(event) => setShotSec(Number(event.target.value))}
                  className="w-full accent-amber-500 mt-2"
                />
              </div>
              <div>
                <Label className="text-[11px]">ট্রানজিশন · {transitionSec.toFixed(1)}s</Label>
                <input
                  type="range"
                  min={0}
                  max={PHOTO_VIDEO_LIMITS.maxTransitionSec}
                  step={0.1}
                  value={transitionSec}
                  onChange={(event) => setTransitionSec(Number(event.target.value))}
                  className="w-full accent-amber-500 mt-2"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 p-2">
              <div>
                <p className="text-xs font-medium flex items-center gap-1">
                  <Captions className="h-3 w-3" /> ক্যাপশন বার্ন
                </p>
                <p className="text-[10px] text-muted-foreground">Hind Siliguri ফন্ট + .srt ফাইল</p>
              </div>
              <Switch checked={captions} onCheckedChange={setCaptions} />
            </div>

            {captions && (
              <Select value={captionStyle} onValueChange={(value) => setCaptionStyle(value as CaptionStyle["id"])}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CAPTION_STYLES.map((style) => (
                    <SelectItem key={style.id} value={style.id}>{style.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="rounded-lg bg-muted/50 p-2.5 text-[11px] space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">ছবি</span><span className="font-semibold">{totalPhotos}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">আনুমানিক দৈর্ঘ্য</span><span className="font-semibold">{formatSeconds(estimatedSeconds)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">রেজোলিউশন</span><span className="font-semibold">{ASPECT_PRESETS.find((preset) => preset.id === aspect)?.width}×{ASPECT_PRESETS.find((preset) => preset.id === aspect)?.height}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">খরচ</span><span className="font-semibold text-emerald-600">$0.00</span></div>
            </div>

            <Button
              className="w-full h-10 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white"
              onClick={render}
              disabled={rendering || totalPhotos === 0}
            >
              {rendering ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> তৈরি হচ্ছে…</> : <><Film className="h-4 w-4 mr-2" /> ভিডিও তৈরি করুন</>}
            </Button>

            {rendering && (
              <div className="space-y-1">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-rose-400 transition-all duration-700"
                    style={{ width: `${((stageIndex + 1) / STAGES.length) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">{STAGES[stageIndex]}…</p>
              </div>
            )}
          </Card>

          <Card className="p-3 border-0 bg-gradient-to-br from-emerald-500/10 to-sky-500/10">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-emerald-600" /> Free-only pipeline
            </p>
            <ul className="mt-1.5 space-y-1 text-[10px] text-muted-foreground">
              <li>• FFmpeg zoompan — নিজের সার্ভারে</li>
              <li>• Piper / eSpeak / formant TTS — লোকাল</li>
              <li>• Procedural music synth — কোনো লাইসেন্স ফি নেই</li>
              <li>• Sora / Veo / Kling / HeyGen ব্লকড</li>
            </ul>
          </Card>
        </div>
      </div>

      {/* ---------------- Recent renders ---------------- */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2 text-sm">
            <Film className="h-4 w-4 text-amber-600" /> সাম্প্রতিক রেন্ডার
          </h3>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void loadRecent()}>
            <RefreshCw className="h-3 w-3 mr-1" /> রিফ্রেশ
          </Button>
        </div>
        {recent.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            এখনো কোনো ফটো-ভিডিও তৈরি হয়নি। প্রথম ছবি আপলোড করে শুরু করুন।
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {recent.map((job) => (
              <a
                key={job.id}
                href={job.videoUrl ?? `/api/media/video/${job.id}`}
                target="_blank"
                rel="noreferrer"
                className="group rounded-xl overflow-hidden border border-border/60 hover:border-amber-400 transition-colors"
              >
                <div className="relative aspect-[9/16] bg-muted">
                  {job.thumbnailUrl ? (
                    <img src={job.thumbnailUrl} alt={job.id} className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                      <Film className="h-6 w-6" />
                    </div>
                  )}
                  <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                    {formatSeconds(job.durationSec ?? 0)}
                  </span>
                </div>
                <div className="p-2">
                  <p className="text-[10px] font-mono truncate">{job.id}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {job.shots?.length ?? 0} shots · {formatBytes(job.sizeBytes ?? 0)}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
