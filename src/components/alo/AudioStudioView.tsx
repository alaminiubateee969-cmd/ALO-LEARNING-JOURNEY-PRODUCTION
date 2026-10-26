"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { QualityPipelineSummary } from "./PipelineRunner";
import type { QualityAgentPass } from "@/lib/ai";
import { Music2, Mic2, Loader2, RefreshCw, Download, ExternalLink, HardDrive, AlertTriangle } from "lucide-react";

type Status = {
  mode: string;
  paidApiCalls: boolean;
  text: { available: boolean; serviceAvailable: boolean; model: string; installedModels: string[]; error?: string };
  images: { available: boolean; checkpoint: string | null; error?: string };
  media: { ffmpeg: boolean; ffprobe: boolean; speech: { piperAvailable: boolean; espeakAvailable: boolean; usable: boolean } };
};

type Song = {
  id: string;
  audioUrl: string;
  lyrics: { title: string; lyrics: string; styleNote: string };
  mood: string;
  bpm: number;
  instrumental: { durationSeconds: number; sampleRate: number; generator: string };
  lyricsProvider: string;
  lyricsUsedFallback: boolean;
  lyricsQualityPipeline: QualityAgentPass[];
};

type VoiceAudio = { id: string; audioUrl: string; engine: string; durationSeconds: number };

const MOODS = [
  { value: "calm", label: "শান্ত · Calm" },
  { value: "hopeful", label: "আশাবাদী · Hopeful" },
  { value: "playful", label: "খেলাধুলার · Playful" },
  { value: "reflective", label: "ভাবুক · Reflective" },
];

/** Mureka-inspired starter templates ("Need inspiration? Explore templates") — each fills theme/mood/length. */
const SONG_TEMPLATES = [
  { id: "morning-learning", label: "🌅 শেখার সকাল · Morning learning", topic: "একসাথে বই পড়া ও শেখার সকাল", mood: "hopeful", durationSeconds: 45 },
  { id: "journey-anthem", label: "✈️ যাত্রার গান · Journey anthem", topic: "স্বপ্ন নিয়ে নতুন দেশে পড়াশোনার যাত্রা", mood: "hopeful", durationSeconds: 60 },
  { id: "playground", label: "⚽ খেলার মাঠ · Playground", topic: "বন্ধুদের সাথে খেলার মাঠে আনন্দ", mood: "playful", durationSeconds: 30 },
  { id: "lullaby", label: "🌙 ঘুমের লোরি · Lullaby", topic: "রাতের নরম আলোয় ঘুমের লোরি", mood: "reflective", durationSeconds: 60 },
  { id: "celebration", label: "🎉 উৎসব · Celebration", topic: "পরিবার নিয়ে উৎসবের আনন্দ", mood: "playful", durationSeconds: 45 },
] as const;

export default function AudioStudioView() {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState("");
  const [voiceText, setVoiceText] = useState("");
  const [voiceId, setVoiceId] = useState("bn");
  const [scriptTopic, setScriptTopic] = useState("");
  const [scriptAudience, setScriptAudience] = useState("বাংলাদেশি পিতামাতা");
  const [scriptBusy, setScriptBusy] = useState(false);
  const [scriptUsedFallback, setScriptUsedFallback] = useState(false);
  const [scriptPipeline, setScriptPipeline] = useState<QualityAgentPass[]>([]);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceResult, setVoiceResult] = useState<VoiceAudio | null>(null);
  const [voiceError, setVoiceError] = useState("");
  const [songTopic, setSongTopic] = useState("");
  const [mood, setMood] = useState("hopeful");
  const [songDuration, setSongDuration] = useState(45);
  const [vocalPerspective, setVocalPerspective] = useState<"neutral" | "female" | "male">("neutral");
  const [songBpm, setSongBpm] = useState(88);
  const [songBusy, setSongBusy] = useState(false);
  const [songResult, setSongResult] = useState<Song | null>(null);
  const [songError, setSongError] = useState("");

  useEffect(() => {
    fetch("/api/ai/local-status", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Local status unavailable");
        setStatus(data);
      })
      .catch((error) => setStatusError(error instanceof Error ? error.message : "Could not load local status"));
  }, []);

  const draftVoiceScript = async () => {
    setScriptBusy(true);
    setVoiceResult(null);
    setVoiceError("");
    setScriptPipeline([]);
    try {
      const response = await fetch("/api/voice/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: scriptTopic, audience: scriptAudience }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Local narration drafting failed");
      setVoiceText(data.text);
      setScriptPipeline(data.qualityPipeline ?? []);
      setScriptUsedFallback(Boolean(data.usedFallback));
      toast({
        title: data.usedFallback ? "Template script ready; local model unavailable" : "Narration draft revised through local model prompts",
        description: "Edit and fact-check the script before generating speech. No audio was created yet.",
      });
    } catch (error) {
      toast({ title: "Narration draft not created", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setScriptBusy(false);
    }
  };

  const generateVoice = async () => {
    setVoiceBusy(true);
    setVoiceError("");
    setVoiceResult(null);
    try {
      const response = await fetch("/api/voice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: voiceText, voice: voiceId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Local voice generation failed");
      setVoiceResult(data);
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : "Local voice generation failed");
    } finally {
      setVoiceBusy(false);
    }
  };

  const generateSong = async () => {
    setSongBusy(true);
    setSongError("");
    setSongResult(null);
    try {
      const response = await fetch("/api/music/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: vocalPerspective === "neutral" ? songTopic : `${songTopic} (narrator voice: ${vocalPerspective})`,
          mood,
          durationSeconds: songDuration,
          bpm: songBpm,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Local song generation failed");
      setSongResult(data);
    } catch (error) {
      setSongError(error instanceof Error ? error.message : "Local song generation failed");
    } finally {
      setSongBusy(false);
    }
  };

  function handleVoiceTextChange(value: string) {
    setVoiceText(value);
    setVoiceResult(null);
    setVoiceError("");
    setScriptPipeline([]);
    setScriptUsedFallback(false);
  }

  function handleVoiceIdChange(value: string) {
    setVoiceId(value);
    setVoiceResult(null);
    setVoiceError("");
  }

  const localReady = Boolean(status?.media.speech.usable);

  return (
    <div className="alo-fade-up space-y-5">
      <SectionHeader
        title="Voice & Music Studio"
        bn="ভয়েস ও মিউজিক স্টুডিও"
        desc="Local-only speech, Bengali songwriting drafts, and original procedural instrumental tracks. No paid AI APIs; no synthetic singing is claimed."
        icon={<Music2 className="h-5 w-5" />}
      />

      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><HardDrive className="h-4 w-4 text-emerald-600" /><h2 className="font-semibold">Local engine readiness</h2><Badge variant="outline">{status?.mode ?? "checking"}</Badge></div>
            <p className="mt-1 text-xs text-muted-foreground">Requests stay on this server and its configured private model hosts. If Ollama is offline, lyric/script features report a template fallback.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => {
            setStatusError("");
            fetch("/api/ai/local-status", { cache: "no-store" }).then((response) => response.json()).then(setStatus).catch((error) => setStatusError(error instanceof Error ? error.message : "Could not load local status"));
          }}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Refresh status</Button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <EngineBadge label="Local text model" ready={status?.text.available ?? false} detail={status?.text.available ? `${status.text.model}${status.text.installedModels.includes(status.text.model) ? " · model found" : " · check installed tag"}` : status?.text.error || "Ollama not responding"} />
          <EngineBadge label="Image model" ready={status?.images.available ?? false} detail={status?.images.available ? status.images.checkpoint || "ComfyUI ready" : status?.images.error || "ComfyUI/checkpoint not ready"} />
          <EngineBadge label="Speech" ready={localReady} detail={status?.media.speech.piperAvailable ? "Piper local voice available" : status?.media.speech.espeakAvailable ? "eSpeak local voice available" : "Install Piper or eSpeak"} />
          <EngineBadge label="FFmpeg video" ready={Boolean(status?.media.ffmpeg && status?.media.ffprobe)} detail={status?.media.ffmpeg && status?.media.ffprobe ? "FFmpeg + ffprobe ready" : "Install FFmpeg + ffprobe"} />
        </div>
        {statusError && <p className="mt-3 text-xs text-rose-600">{statusError}</p>}
        {!status?.text.available && <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Ollama is not connected. Media rendering can still use local template lyrics and the built-in instrumental synthesizer; LLM-quality Bengali writing needs the operator to install a local model.</p>}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2"><Mic2 className="h-4 w-4 text-violet-600" /><div><h2 className="font-semibold">Local voice-over</h2><p className="text-xs text-muted-foreground">Piper voice model if configured, otherwise eSpeak. This is speech, not singing.</p></div></div>
          <div className="space-y-3">
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              <div><h3 className="text-xs font-semibold">Draft narration with local model prompts</h3><p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">A writer prompt → critique prompt → revision prompt to the same local model. This is not an independent or factual/safety review; it creates editable spoken copy only.</p></div>
              <div className="grid gap-2 sm:grid-cols-2"><div><Label htmlFor="voice-script-topic" className="text-[10px]">Topic</Label><Input id="voice-script-topic" value={scriptTopic} onChange={(event) => setScriptTopic(event.target.value)} disabled={scriptBusy || voiceBusy} maxLength={240} placeholder="শিশুর সাথে গল্প পড়া" /></div><div><Label htmlFor="voice-script-audience" className="text-[10px]">Audience</Label><Input id="voice-script-audience" value={scriptAudience} onChange={(event) => setScriptAudience(event.target.value)} disabled={scriptBusy || voiceBusy} maxLength={300} /></div></div>
              <Button type="button" size="sm" variant="outline" disabled={scriptBusy || voiceBusy || !scriptTopic.trim()} onClick={draftVoiceScript}>{scriptBusy ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Drafting…</> : <><RefreshCw className="mr-2 h-3.5 w-3.5" />Draft / refresh narration</>}</Button>
            </div>
            {scriptPipeline.length > 0 && <div className="space-y-2"><Badge variant="outline" className={scriptUsedFallback ? "border-amber-300 text-amber-700" : "border-emerald-300 text-emerald-700"}>{scriptUsedFallback ? "Template fallback · human review required" : "Same-model prompt revision · human review required"}</Badge><QualityPipelineSummary passes={scriptPipeline} /></div>}
            <div><Label htmlFor="voice-text" className="text-xs">Text to speak</Label><Textarea id="voice-text" value={voiceText} onChange={(event) => handleVoiceTextChange(event.target.value)} disabled={scriptBusy || voiceBusy} rows={5} maxLength={5_000} placeholder="বাংলা বা ইংরেজি narration লিখুন…" /></div>
            <div><Label htmlFor="voice-id" className="text-xs">Installed voice ID</Label><Input id="voice-id" value={voiceId} onChange={(event) => setVoiceId(event.target.value)} maxLength={24} placeholder="bn" /></div>
            <Button type="button" onClick={generateVoice} disabled={voiceBusy || !voiceText.trim()} className="w-full bg-violet-600 text-white hover:bg-violet-700">{voiceBusy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Local voice generating…</> : <><Mic2 className="mr-2 h-4 w-4" />Generate spoken audio</>}</Button>
            {voiceError && <p role="alert" className="text-xs text-rose-600">{voiceError}</p>}
            {voiceResult && <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3"><div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-medium">{voiceResult.engine} · about {Math.round(voiceResult.durationSeconds)} sec</span><a className="inline-flex items-center gap-1 text-violet-700 hover:underline" href={voiceResult.audioUrl} download><Download className="h-3.5 w-3.5" />Download WAV</a></div><audio controls preload="metadata" className="w-full" src={voiceResult.audioUrl}>Your browser does not support audio playback.</audio></div>}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2"><Music2 className="h-4 w-4 text-amber-600" /><div><h2 className="font-semibold">Songwriter + instrumental composer</h2><p className="text-xs text-muted-foreground">Lyrics use local Ollama or an honest fallback; the audio is a locally synthesized instrumental.</p></div></div>
          <div className="space-y-3">
            <div><Label htmlFor="song-topic" className="text-xs">Song theme</Label><Input id="song-topic" value={songTopic} onChange={(event) => setSongTopic(event.target.value)} maxLength={240} placeholder="যেমন: একসাথে বই পড়া ও শেখা" /></div>
            <div>
              <Label className="text-xs">Inspiration templates</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {SONG_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setSongTopic(t.topic); setMood(t.mood); setSongDuration(t.durationSeconds); }}
                    className="rounded-full border border-border/70 px-2.5 py-1 text-[10px] transition-colors hover:bg-amber-500/10 hover:border-amber-400"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="vocal-perspective" className="text-xs">Vocal perspective (lyrics voice)</Label>
              <select id="vocal-perspective" value={vocalPerspective} onChange={(event) => setVocalPerspective(event.target.value as "neutral" | "female" | "male")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="neutral">Neutral / narrator</option>
                <option value="female">Female narrator</option>
                <option value="male">Male narrator</option>
              </select>
            </div>
            <div>
              <Label htmlFor="song-bpm" className="text-xs">Tempo (BPM)</Label>
              <select id="song-bpm" value={songBpm} onChange={(event) => setSongBpm(Number(event.target.value))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value={72}>72 — slow & gentle</option>
                <option value={88}>88 — default</option>
                <option value={104}>104 — upbeat</option>
                <option value={120}>120 — lively</option>
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="song-mood" className="text-xs">Mood</Label><select id="song-mood" value={mood} onChange={(event) => setMood(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{MOODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
              <div><Label htmlFor="song-duration" className="text-xs">Instrumental length</Label><select id="song-duration" value={songDuration} onChange={(event) => setSongDuration(Number(event.target.value))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value={30}>30 seconds</option><option value={45}>45 seconds</option><option value={60}>60 seconds</option><option value={90}>90 seconds</option></select></div>
            </div>
            <Button type="button" onClick={generateSong} disabled={songBusy || !songTopic.trim()} className="w-full bg-gradient-to-r from-amber-500 to-rose-500 text-white hover:from-amber-600 hover:to-rose-600">{songBusy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Drafting lyrics + synthesizing instrumental…</> : <><Music2 className="mr-2 h-4 w-4" />Write lyrics + make instrumental</>}</Button>
            {songError && <p role="alert" className="text-xs text-rose-600">{songError}</p>}
            {songResult && <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{songResult.lyrics.title}</h3><p className="text-[11px] text-muted-foreground">Lyrics: {songResult.lyricsProvider}{songResult.lyricsUsedFallback ? " · local template fallback" : ""} · {songResult.mood} · {songResult.bpm} BPM</p></div><a className="inline-flex items-center gap-1 text-xs text-amber-700 hover:underline" href={songResult.audioUrl} download><Download className="h-3.5 w-3.5" />WAV</a></div>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-background p-3 font-sans text-sm leading-relaxed">{songResult.lyrics.lyrics}</pre>
              {songResult.lyricsQualityPipeline?.length > 0 && <QualityPipelineSummary passes={songResult.lyricsQualityPipeline} />}
              <audio controls preload="metadata" className="w-full" src={songResult.audioUrl}>Your browser does not support audio playback.</audio>
              <p className="text-[11px] leading-relaxed text-muted-foreground">Instrumental engine: {songResult.instrumental.generator}. This WAV contains no sung vocals; lyrics are a separate draft. Review the lyrics before publishing.</p>
            </div>}
          </div>
        </Card>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">Media files are stored on this server and audio links require your signed-in session in production. The supplied Facebook page is linked here for reference; its posts were not fetched or verified in this build.</p>
        <a href="https://web.facebook.com/ALOLearningJourney" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted"><ExternalLink className="h-3.5 w-3.5" />Open provided Facebook page</a>
      </Card>
    </div>
  );
}

function EngineBadge({ label, ready, detail }: { label: string; ready: boolean; detail: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold">{label}</p><Badge variant="outline" className={ready ? "border-emerald-300 text-emerald-700" : "border-amber-300 text-amber-700"}>{ready ? "ready" : "not ready"}</Badge></div>
      <p className="mt-1 truncate text-[10px] text-muted-foreground" title={detail}>{detail}</p>
    </div>
  );
}
