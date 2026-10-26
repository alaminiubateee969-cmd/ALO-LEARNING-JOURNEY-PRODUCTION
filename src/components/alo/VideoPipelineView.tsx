"use client";

import { useState } from "react";
import { SectionHeader, StatusPill } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Video, Film, Plus, Trash2, Clock, ImageIcon, Mic, Play, Loader2, Clapperboard, Sparkles, Download, AlertTriangle } from "lucide-react";

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

export default function VideoPipelineView({ onOpenPhotoStudio }: { onOpenPhotoStudio?: () => void }) {
  const { toast } = useToast();
  const [scenes, setScenes] = useState<Scene[]>(DEFAULT_SCENES);
  const [title, setTitle] = useState("শিশুর ভাষা বিকাশে মায়ের ভূমিকা");
  const [selected, setSelected] = useState<Scene | null>(null);
  const [images, setImages] = useState<Record<string, string>>({});
  const [imagesBusy, setImagesBusy] = useState(false);
  const [renderBusy, setRenderBusy] = useState(false);
  const [renderResult, setRenderResult] = useState<{ videoUrl: string; srtUrl?: string | null; durationSec: number; width: number; height: number } | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  const totalDuration = scenes.reduce((s, sc) => s + sc.duration, 0);

  const generateStoryboardImages = async () => {
    if (imagesBusy) return;
    setImagesBusy(true);
    setRenderError(null);
    const next: Record<string, string> = { ...images };
    let failures = 0;
    try {
      for (const scene of scenes) {
        if (next[scene.id]) continue;
        const prompt = [
          "Warm Bengali editorial illustration, child-safe, no text,",
          scene.visualPrompt || scene.title,
          `character: ${scene.character}, shot: ${scene.shotType}, mood: ${scene.emotion}`,
        ].join(" ");
        try {
          const response = await fetch("/api/images/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, filename: `sb_${scene.id}_${Date.now()}.png` }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || !data.url || /\.svg$/i.test(String(data.url))) {
            failures++;
            continue;
          }
          next[scene.id] = String(data.url);
          setImages({ ...next });
        } catch {
          failures++;
        }
      }
      if (failures > 0) {
        toast({
          title: `${failures}টি দৃশ্যের ছবি তৈরি হয়নি`,
          description: "Free image model unavailable for those scenes — Photo → Video Studio দিয়ে নিজের ছবি ব্যবহার করুন।",
          variant: "destructive",
        });
      } else {
        toast({ title: "স্টোরিবোর্ড ছবি প্রস্তুত ✅", description: "এখন Render চাপলে আসল MP4 তৈরি হবে।" });
      }
    } finally {
      setImagesBusy(false);
    }
  };

  const renderStoryboard = async () => {
    if (renderBusy) return;
    const ready = scenes.filter((scene) => images[scene.id]);
    if (ready.length === 0) {
      toast({ title: "আগে Storyboard Images তৈরি করুন", description: "অথবা Photo → Video Studio-তে নিজের ছবি দিন।", variant: "destructive" });
      return;
    }
    setRenderBusy(true);
    setRenderError(null);
    setRenderResult(null);
    try {
      const formData = new FormData();
      formData.append("imagePaths", JSON.stringify(ready.map((scene) => images[scene.id])));
      formData.append("captions_json", JSON.stringify(ready.map((scene) => scene.voiceover)));
      formData.append("narration", ready.map((scene) => scene.voiceover).join("\n"));
      formData.append("title", title);
      formData.append("aspect", "vertical");
      formData.append("quality", "standard");
      formData.append("motion", "auto");
      formData.append("transition", "fade");
      formData.append("shotSec", String(Math.round(ready.reduce((sum, scene) => sum + scene.duration, 0) / ready.length)));
      formData.append("captions", "1");
      formData.append("music", "hopeful");
      formData.append("engine", "local");
      const response = await fetch("/api/video/from-photo", { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        setRenderError(String(data.detail ?? data.error ?? response.status));
        toast({ title: "রেন্ডার ব্যর্থ", description: String(data.detail ?? data.error ?? response.status), variant: "destructive" });
        return;
      }
      setRenderResult({ videoUrl: data.videoUrl, srtUrl: data.srtUrl, durationSec: data.durationSec, width: data.width, height: data.height });
      toast({ title: "ভিডিও তৈরি হয়েছে ✅", description: `${data.durationSec}s · ${data.width}×${data.height}` });
    } catch (error) {
      setRenderError((error as Error).message);
    } finally {
      setRenderBusy(false);
    }
  };

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

  return (
    <div className="alo-fade-up space-y-5">
      <SectionHeader
        title="Video Pipeline"
        bn="ভিডিও স্টোরিবোর্ড"
        desc="VideoDirectorAgent স্ক্রিপ্ট থেকে দৃশ্য-ভিত্তিক স্টোরিবোর্ড তৈরি করে — চরিত্র, শট, ভিজ্যুয়াল প্রম্পট, ভয়েসওভার ও সময় সহ।"
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

      {/* Title + export bar */}
      <Card className="p-4 alo-card-grad border-0">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <Label className="text-xs">ভিডিও শিরোনাম</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-9" onClick={generateStoryboardImages} disabled={imagesBusy}>
              {imagesBusy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5 mr-1.5" />}
              {imagesBusy ? "ছবি তৈরি হচ্ছে…" : "Storyboard Images"}
            </Button>
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 h-9" onClick={renderStoryboard} disabled={renderBusy}>
              {renderBusy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
              {renderBusy ? "রেন্ডার হচ্ছে…" : "Render Video (MP4)"}
            </Button>
          </div>
        </div>
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
                    <div className="flex items-center gap-2">
                      {images[s.id] ? (
                        <img src={images[s.id]} alt={s.title} className="h-9 w-9 rounded object-cover shrink-0" />
                      ) : (
                        <span className="h-9 w-9 rounded bg-muted flex items-center justify-center shrink-0">
                          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/60" />
                        </span>
                      )}
                      <p className="text-[11px] text-muted-foreground line-clamp-2 flex-1">{s.visualPrompt}</p>
                    </div>
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
                  <Video className="h-2.5 w-2.5" /> এই দৃশ্যের জন্য FFmpeg দরকার —
                  <StatusPill status="blocked_external_setup" />
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Own-photo CTA */}
      <Card className="p-4 border-0 bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-violet-500/15">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="rounded-xl bg-white/70 dark:bg-white/10 p-2.5">
            <Sparkles className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">নিজের ছবি আপলোড করে সরাসরি ভিডিও বানান</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Photo → Video Studio: ছবি + বাংলা ভয়েস + মিউজিক + ক্যাপশন → এক ক্লিকে MP4। কোনো paid API নেই।
            </p>
          </div>
          <Button size="sm" className="h-9 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600" onClick={onOpenPhotoStudio}>
            <Clapperboard className="h-3.5 w-3.5 mr-1.5" /> Photo → Video খুলুন
          </Button>
        </div>
      </Card>

      {renderError && (
        <Card className="p-3 border border-rose-300 bg-rose-50 dark:bg-rose-950/30">
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> রেন্ডার ব্যর্থ
          </p>
          <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80 mt-1 break-words">{renderError}</p>
        </Card>
      )}

      {renderResult && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              <Film className="h-4 w-4 text-emerald-600" /> স্টোরিবোর্ড ভিডিও
            </h3>
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              {renderResult.durationSec}s · {renderResult.width}×{renderResult.height}
            </Badge>
          </div>
          <video src={renderResult.videoUrl} controls playsInline className="w-full max-h-[420px] rounded-xl bg-black" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700" asChild>
              <a href={renderResult.videoUrl} download>
                <Download className="h-3 w-3 mr-1" /> MP4 ডাউনলোড
              </a>
            </Button>
            {renderResult.srtUrl && (
              <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                <a href={renderResult.srtUrl} download>SRT ডাউনলোড</a>
              </Button>
            )}
          </div>
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
