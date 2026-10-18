"use client";

import { useState } from "react";
import { SectionHeader } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QualityPipelineSummary } from "./PipelineRunner";
import type { QualityAgentPass } from "@/lib/ai";
import { useToast } from "@/hooks/use-toast";
import { Video, Film, Plus, Trash2, Clock, Users, ImageIcon, Mic, Play, Loader2, Clapperboard, Download, Sparkles } from "lucide-react";

interface Scene {
  id: string;
  number: number;
  title: string;
  duration: number; // seconds
  character: string;
  shotType: string;
  visualPrompt: string;
  voiceover: string;
  emotion: string;
}

const DEFAULT_SCENES: Scene[] = [
  {
    id: "s1",
    number: 1,
    title: "হুক — মায়ের হাসিমুখ",
    duration: 3,
    character: "mother",
    shotType: "close-up",
    visualPrompt: "মা সকালের আলোয় হাসিমুখে শিশুর দিকে তাকাচ্ছেন, warm morning light, soft focus background",
    voiceover: "শিশুর ভাষা বিকাশে প্রথম ৩ বছর সবচেয়ে গুরুত্বপূর্ণ 💛",
    emotion: "warm",
  },
  {
    id: "s2",
    number: 2,
    title: "সমস্যা — বাবার উদ্বেগ",
    duration: 5,
    character: "father",
    shotType: "medium",
    visualPrompt: "বাবা চিন্তিত মুখে ফোনে প্যারেন্টিং আর্টিকেল পড়ছেন, slightly desaturated, concerned expression",
    voiceover: "অনেক পিতামাতাই ভাবেন — 'আমার শিশু কি সঠিক সময়ে কথা বলছে?'",
    emotion: "concerned",
  },
  {
    id: "s3",
    number: 3,
    title: "সমাধান — শিক্ষিকার পরামর্শ",
    duration: 8,
    character: "teacher",
    shotType: "medium",
    visualPrompt: "শিক্ষিকা বই হাতে শিশুকে গল্প পড়ে শোনাচ্ছেন, bright classroom, hopeful mood",
    voiceover: "প্রতিদিন ১০ মিনিট একসাথে বই পড়ুন। দেখবেন পরিবর্তন আসছে ✨",
    emotion: "hopeful",
  },
  {
    id: "s4",
    number: 4,
    title: "CTA — পরিবারের বন্ডিং",
    duration: 4,
    character: "narrator",
    shotType: "wide",
    visualPrompt: "পরিবার একসাথে বই পড়ছে, warm golden hour light, heartwarming family scene",
    voiceover: "আপনার অভিজ্ঞতা কমেন্টে শেয়ার করুন 💛 আলো লার্নিং জার্নি",
    emotion: "joyful",
  },
];

const CHARACTERS = [
  { id: "baby_girl", name: "Baby Girl", emoji: "👶" },
  { id: "mother", name: "Mother", emoji: "👩" },
  { id: "father", name: "Father", emoji: "👨" },
  { id: "teacher", name: "Teacher", emoji: "🧑‍🏫" },
  { id: "narrator", name: "Narrator", emoji: "🎙️" },
];

const SHOT_TYPES = ["wide", "medium", "close-up", "over-shoulder", "top-down"];
const EMOTIONS = ["warm", "hopeful", "concerned", "joyful", "calm", "excited"];

export default function VideoPipelineView() {
  const { toast } = useToast();
  const [scenes, setScenes] = useState<Scene[]>(DEFAULT_SCENES);
  const [title, setTitle] = useState("শিশুর ভাষা বিকাশে মায়ের ভূমিকা");
  const [selected, setSelected] = useState<Scene | null>(null);
  const [rendering, setRendering] = useState(false);
  const [directing, setDirecting] = useState(false);
  const [storyboardPasses, setStoryboardPasses] = useState<QualityAgentPass[]>([]);
  const [renderMode, setRenderMode] = useState<"cinematic" | "social">("cinematic");
  const [renderError, setRenderError] = useState("");
  const [renderedVideo, setRenderedVideo] = useState<{
    jobId: string;
    video: { fileUrl: string; duration: number; fileSizeMb?: number; fileSize?: number };
    srtUrl?: string;
    scenes?: Array<{ index: number; caption: string; assetPath: string; source: string }>;
    visualAssetStatus?: string;
    note?: string;
    qualityPipeline: QualityAgentPass[];
  } | null>(null);

  const totalDuration = scenes.reduce((s, sc) => s + sc.duration, 0);

  const addScene = () => {
    const newScene: Scene = {
      id: `s${Date.now()}`,
      number: scenes.length + 1,
      title: "নতুন দৃশ্য",
      duration: 3,
      character: "mother",
      shotType: "medium",
      visualPrompt: "",
      voiceover: "",
      emotion: "warm",
    };
    setScenes([...scenes, newScene]);
    setSelected(newScene);
    toast({ title: "নতুন দৃশ্য যোগ হয়েছে" });
  };

  const removeScene = (id: string) => {
    setScenes(scenes.filter((s) => s.id !== id).map((s, i) => ({ ...s, number: i + 1 })));
    if (selected?.id === id) setSelected(null);
  };

  const updateScene = (id: string, field: keyof Scene, value: any) => {
    setScenes(scenes.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    if (selected?.id === id) setSelected({ ...selected, [field]: value });
  };

  const charEmoji = (id: string) => CHARACTERS.find((c) => c.id === id)?.emoji ?? "🎬";

  const directStoryboard = async (customTopic?: string): Promise<Scene[] | null> => {
    const targetTopic = (customTopic ?? title).trim();
    if (!targetTopic) {
      toast({ title: "শিরোনাম দিন", description: "স্টোরিবোর্ড তৈরির জন্য একটি টপিক লিখুন।", variant: "destructive" });
      return null;
    }
    setDirecting(true);
    setRenderError("");
    try {
      const response = await fetch("/api/video/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: targetTopic, audience: "বাংলাদেশি পিতামাতা ও শিক্ষার্থী" }),
      });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.scenes)) {
        throw new Error(data.error ?? "Storyboard generation failed");
      }
      setScenes(data.scenes);
      setSelected(data.scenes[0] ?? null);
      setStoryboardPasses(data.qualityPipeline ?? []);
      const usedFallback = data.usedFallback !== false;
      toast({
        title: usedFallback ? "Template storyboard ready" : "Local-model storyboard ready",
        description: usedFallback
          ? `${data.scenes.length}টি দৃশ্য · ${data.totalDuration}s · Built-in template fallback; no model-based review was run.`
          : `${data.scenes.length}টি দৃশ্য · ${data.totalDuration}s · Provider: ${String(data.provider ?? "local model")}. No separate critic or child-safety review was run.`,
      });
      return data.scenes;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Storyboard generation failed";
      setRenderError(message);
      toast({ title: "স্টোরিবোর্ড তৈরি হয়নি", description: message, variant: "destructive" });
      return null;
    } finally {
      setDirecting(false);
    }
  };

  const renderVideo = async (mode: "cinematic" | "social" = renderMode, customScenes?: Scene[]) => {
    const activeScenes = customScenes ?? scenes;
    const activeDuration = activeScenes.reduce((s, sc) => s + sc.duration, 0);
    if (activeDuration < 10 || activeDuration > 600) {
      toast({ title: "সময়সীমা ঠিক করুন", description: "ভিডিওর দৈর্ঘ্য ১০–৬০০ সেকেন্ডের মধ্যে হতে হবে।", variant: "destructive" });
      return;
    }
    setRenderMode(mode);
    setRendering(true);
    setRenderError("");
    setRenderedVideo(null);
    try {
      const endpoint = mode === "cinematic" ? "/api/video/cinematic" : "/api/video/generate";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: title,
          text: activeScenes.map((scene) => scene.voiceover.trim()).filter(Boolean).join("\n"),
          visualPrompts: activeScenes.map((scene) => scene.visualPrompt),
          visualStyle: "warm Bengali editorial illustration",
          mood: "hopeful",
          duration: activeDuration,
          voice: "bn",
        }),
      });
      const data = await response.json();
      if (!response.ok || data.status === "FAILED") throw new Error(data.error ?? data.message ?? "Local video render failed");
      setRenderedVideo({ ...data, qualityPipeline: data.qualityPipeline ?? [] });
      toast({ title: "Local video render completed", description: `${data.video?.duration ?? activeDuration}s · ${data.visualAssetStatus ?? mode}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Local video render failed";
      setRenderError(message);
      toast({ title: "ভিডিও তৈরি হয়নি", description: message, variant: "destructive" });
    } finally {
      setRendering(false);
    }
  };

  const directAndRenderOneClick = async () => {
    const generated = await directStoryboard(title);
    if (generated && generated.length > 0) {
      await renderVideo("cinematic", generated);
    }
  };

  return (
    <div className="alo-fade-up space-y-5">
      <SectionHeader
        title="Video Pipeline"
        bn="ভিডিও স্টোরিবোর্ড"
        desc="লোকাল মডেল পাওয়া গেলে storyboard draft তৈরি হয়; না হলে built-in template fallback ব্যবহৃত হয়। প্রকাশের আগে তথ্য ও ভিজ্যুয়াল যাচাই করুন।"
        icon={<Video className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
              <Clock className="h-3 w-3 mr-1" /> {totalDuration}s
            </Badge>
            <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">
              <Film className="h-3 w-3 mr-1" /> {scenes.length} দৃশ্য
            </Badge>
          </div>
        }
      />

      {/* Local rendering path, title, and export controls */}
      <Card className="p-4 alo-card-grad border-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
              <Film className="h-3 w-3 mr-1" /> Local rendering path · runtime availability not checked
            </Badge>
            <span className="text-muted-foreground">
              Storyboard: local model or built-in template · images: ComfyUI or placeholder · speech, music, and video: local tools
            </span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-stretch lg:items-end gap-3">
          <div className="flex-1 w-full">
            <Label className="text-xs">ভিডিও শিরোনাম / টপিক (যেকোনো টপিক লিখুন বা নিচের প্রিসেট বেছে নিন)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void directStoryboard()}
              disabled={directing || rendering}
              className="h-9 border-amber-300 text-amber-800 hover:bg-amber-50"
            >
              {directing ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Generating storyboard…</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Generate storyboard draft</>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void renderVideo("social")}
              disabled={rendering || directing}
              className="h-9"
            >
              {rendering && renderMode === "social" ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Rendering Reel…</>
              ) : (
                <><Film className="h-3.5 w-3.5 mr-1.5" /> Render Social Reel</>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void renderVideo("cinematic")}
              disabled={rendering || directing}
              className="bg-amber-500 hover:bg-amber-600 h-9 text-white"
            >
              {rendering && renderMode === "cinematic" ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Rendering Cinematic…</>
              ) : (
                <><Play className="h-3.5 w-3.5 mr-1.5" /> Render Cinematic + SRT</>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void directAndRenderOneClick()}
              disabled={rendering || directing}
              className="bg-emerald-600 hover:bg-emerald-700 h-9 text-white"
            >
              {directing || rendering ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Working…</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Storyboard + Render MP4</>
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] font-medium text-muted-foreground mr-1">Quick Topics:</span>
          {[
            "শিশুর ভাষা বিকাশে মায়ের ভূমিকা",
            "UK Study Visa CAS ও ব্যাংক স্পন্সর গাইড",
            "Canada SDS ও PAL ভিসা চেকলিস্ট",
            "IELTS 7.0 প্রস্তুতির প্রতিদিন ১৫ মিনিট রুটিন",
            "শিশুর স্ক্রিন টাইম কমিয়ে বই পড়ার অভ্যাস",
          ].map((presetTopic) => (
            <button
              key={presetTopic}
              type="button"
              onClick={() => {
                setTitle(presetTopic);
                void directStoryboard(presetTopic);
              }}
              disabled={directing || rendering}
              className="rounded-full border border-border/70 bg-background/80 px-2.5 py-0.5 text-[11px] hover:border-amber-400 hover:text-amber-700 transition-colors"
            >
              {presetTopic}
            </button>
          ))}
        </div>

        {storyboardPasses.length > 0 && (
          <div className="pt-2">
            <QualityPipelineSummary passes={storyboardPasses} />
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Scene list */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Clapperboard className="h-4 w-4 text-amber-600" /> দৃশ্য তালিকা
            </h3>
            <Button size="sm" variant="outline" onClick={addScene} className="h-8 text-xs">
              <Plus className="h-3 w-3 mr-1" /> দৃশ্য যোগ করুন
            </Button>
          </div>

          {/* Timeline visualization */}
          <Card className="p-3">
            <div className="flex h-8 rounded-lg overflow-hidden gap-0.5">
              {scenes.map((s, i) => {
                const pct = (s.duration / totalDuration) * 100;
                const colors = ["bg-amber-400", "bg-rose-400", "bg-emerald-400", "bg-sky-400", "bg-violet-400"];
                return (
                  <div
                    key={s.id}
                    className={`${colors[i % colors.length]} relative group cursor-pointer hover:opacity-80 transition-opacity`}
                    style={{ width: `${pct}%` }}
                    onClick={() => setSelected(s)}
                    title={`দৃশ্য ${s.number}: ${s.title} (${s.duration}s)`}
                  >
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                      {s.number}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
              <span>0s</span>
              <span>{totalDuration}s</span>
            </div>
          </Card>

          {/* Scene cards */}
          <div className="space-y-2">
            {scenes.map((s, i) => (
              <Card
                key={s.id}
                onClick={() => setSelected(s)}
                className={`p-3 cursor-pointer transition-all alo-stagger alo-glow-hover ${
                  selected?.id === s.id ? "border-amber-400 ring-1 ring-amber-300" : "border-border/60"
                }`}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-gradient-to-br from-amber-400/20 to-rose-400/20 p-2 text-center shrink-0">
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{s.number}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm truncate">{s.title}</h4>
                      <Badge variant="outline" className="text-[9px] shrink-0">
                        <Clock className="h-2 w-2 mr-0.5" />{s.duration}s
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1">
                      <span className="flex items-center gap-0.5">{charEmoji(s.character)} {s.character}</span>
                      <span>·</span>
                      <span>{s.shotType}</span>
                      <span>·</span>
                      <span className="italic">{s.emotion}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{s.visualPrompt}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50 shrink-0"
                    onClick={(e) => { e.stopPropagation(); removeScene(s.id); }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Scene editor */}
        <Card className="p-4 lg:sticky lg:top-20 h-fit">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Film className="h-4 w-4 text-amber-600" /> দৃশ্য সম্পাদনা
          </h3>
          {!selected ? (
            <div className="text-center py-10 text-muted-foreground">
              <Film className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-xs">সম্পাদনা করতে একটি দৃশ্য নির্বাচন করুন</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label className="text-[10px]">দৃশ্য শিরোনাম</Label>
                <Input
                  value={selected.title}
                  onChange={(e) => updateScene(selected.id, "title", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">সময় (সেকেন্ড)</Label>
                  <Input
                    type="number"
                    value={selected.duration}
                    onChange={(e) => updateScene(selected.id, "duration", Number(e.target.value))}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px]">চরিত্র</Label>
                  <Select value={selected.character} onValueChange={(v) => updateScene(selected.id, "character", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHARACTERS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.emoji} {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">শট টাইপ</Label>
                  <Select value={selected.shotType} onValueChange={(v) => updateScene(selected.id, "shotType", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SHOT_TYPES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px]">আবেগ</Label>
                  <Select value={selected.emotion} onValueChange={(v) => updateScene(selected.id, "emotion", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EMOTIONS.map((e) => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-[10px] flex items-center gap-1"><ImageIcon className="h-2.5 w-2.5" /> ভিজ্যুয়াল প্রম্পট</Label>
                <Textarea
                  value={selected.visualPrompt}
                  onChange={(e) => updateScene(selected.id, "visualPrompt", e.target.value)}
                  rows={3}
                  className="text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px] flex items-center gap-1"><Mic className="h-2.5 w-2.5" /> ভয়েসওভার</Label>
                <Textarea
                  value={selected.voiceover}
                  onChange={(e) => updateScene(selected.id, "voiceover", e.target.value)}
                  rows={2}
                  className="text-xs"
                />
              </div>
              <div className="pt-2 border-t border-border/40">
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Video className="h-2.5 w-2.5" /> Local FFmpeg + speech engine required; ComfyUI images are optional.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {renderError && <Card role="alert" className="border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-100">{renderError}</Card>}
      {renderedVideo && (
        <Card className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Rendered local 9:16 video</h3>
              <p className="text-xs text-muted-foreground">
                {renderedVideo.video.duration}s · {renderedVideo.visualAssetStatus ?? renderMode} · job {renderedVideo.jobId}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {renderedVideo.srtUrl && (
                <a
                  href={renderedVideo.srtUrl}
                  download
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download .SRT Subtitles
                </a>
              )}
              <a
                href={renderedVideo.video.fileUrl}
                download
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" />
                Download MP4
              </a>
            </div>
          </div>
          <video controls preload="metadata" className="max-h-[70vh] w-full rounded-xl bg-black" src={renderedVideo.video.fileUrl}>
            Your browser does not support video playback.
          </video>
          {renderedVideo.scenes && renderedVideo.scenes.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold">Generated Scene Keyframe Stills ({renderedVideo.scenes.length})</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {renderedVideo.scenes.map((sc) => (
                  <a
                    key={sc.index}
                    href={sc.assetPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group overflow-hidden rounded-lg border border-border/60 bg-muted/20 p-1.5 text-left"
                  >
                    <img src={sc.assetPath} alt={sc.caption} className="aspect-[9/16] w-full rounded object-cover" />
                    <p className="mt-1 truncate text-[10px] text-muted-foreground">
                      Scene {sc.index + 1}: {sc.caption}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}
          {renderedVideo.note && <p className="text-[11px] leading-relaxed text-muted-foreground">{renderedVideo.note}</p>}
          {renderedVideo.qualityPipeline.length > 0 && <QualityPipelineSummary passes={renderedVideo.qualityPipeline} />}
        </Card>
      )}

      {/* Export specs */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Video className="h-4 w-4 text-amber-600" /> ভিডিও স্পেকস
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {[
            { label: "রেজোলিউশন", value: "1080×1920" },
            { label: "ফরম্যাট", value: "MP4 (H.264)" },
            { label: "মোট সময়", value: `${totalDuration}s` },
            { label: "ফ্রেম রেট", value: "30fps" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-muted/40 p-2.5">
              <p className="text-[10px] text-muted-foreground uppercase">{s.label}</p>
              <p className="font-semibold mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
