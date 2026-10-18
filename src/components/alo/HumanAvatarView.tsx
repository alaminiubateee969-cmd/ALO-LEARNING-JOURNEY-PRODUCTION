"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  UserCircle,
  Sparkles,
  Video,
  Wand2,
  Play,
  RefreshCw,
  Image as ImageIcon,
  Users,
  Clapperboard,
  Plus,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Film,
  Mic,
  Heart,
  ShieldCheck,
  Layers,
  Activity,
  ChevronsRight,
  Volume2,
  Trash2,
  XCircle,
  Download,
} from "lucide-react";

/* ----------------------------- Types ----------------------------- */

interface AvatarPreset {
  id: string;
  name: string;
  bnName: string;
  persona: string;
  gender: "male" | "female";
  ageRange: string;
  voiceProfile: string;
  voiceSpeed?: number;
  faceDescription: string;
  backgroundStory?: string;
  outfitStyle?: string;
  sceneContext?: string;
  bestFor?: string;
}

interface HumanAvatar {
  id: string;
  name: string;
  persona: string;
  gender: string;
  ageRange: string;
  faceDescription: string;
  voiceProfile: string;
  voiceSpeed: number;
  outfitStyle?: string | null;
  sceneContext?: string | null;
  backgroundStory?: string | null;
  portraitUrl?: string | null;
  portraitStatus: string;
  active: boolean;
  videoCount: number;
  createdAt: string;
}

interface PersonaLabel {
  en: string;
  bn: string;
}

interface AvatarMeta {
  avatars: HumanAvatar[];
  presets: AvatarPreset[];
  personaLabels: Record<string, PersonaLabel>;
  outfitPresets: string[];
  scenePresets: string[];
  stats: {
    total: number;
    active: number;
    generated: number;
    pending: number;
    failed: number;
    totalVideos: number;
  };
  byPersona: Record<string, number>;
}

interface Scene {
  heading: string;
  text: string;
  audioUrl: string;
  imageUrl: string;
  durationSec: number;
}

interface AvatarVideo {
  id: string;
  avatarId: string;
  prompt: string;
  script?: string | null;
  scenesJson?: string | null;
  targetDuration: number;
  actualDuration?: number | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  status: string;
  progress: number;
  currentStep?: string | null;
  lipSyncUsed?: boolean;
  lipSyncReason?: string | null;
  errorMessage?: string | null;
  quality: string;
  createdAt: string;
}

interface VideoStats {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  totalDurationSec: number;
  lipSyncUsed: number;
}

interface GenerateVideoResult {
  ok: boolean;
  video?: AvatarVideo;
  title?: string;
  intro?: string;
  outro?: string;
  scenes?: Scene[];
  totalScenes?: number;
  actualDurationSec?: number;
  targetDurationSec?: number;
  lipSyncUsed?: boolean;
  lipSyncReason?: string;
  avatarName?: string;
  voiceProfile?: string;
  error?: string;
  videoId?: string;
}

/* ----------------------------- Constants ----------------------------- */

const VOICES: { id: string; label: string; bn: string; style: string }[] = [
  { id: "tongtong", label: "TongTong", bn: "টংটং", style: "Warm maternal" },
  { id: "chuichui", label: "ChuiChui", bn: "চুইচুই", style: "Youthful bright" },
  { id: "xiaochen", label: "XiaoChen", bn: "শিয়াওচেন", style: "Professional female" },
  { id: "jam", label: "Jam", bn: "জ্যাম", style: "Elderly wise" },
  { id: "kazi", label: "Kazi", bn: "কাজী", style: "Authoritative male" },
  { id: "douji", label: "Douji", bn: "দৌজি", style: "Friendly father" },
  { id: "luodo", label: "LuoDo", bn: "লুয়োডো", style: "Calm narrator" },
];

const PERSONAS: { id: string; en: string; bn: string; emoji: string }[] = [
  { id: "mother", en: "Mother", bn: "মা", emoji: "👩" },
  { id: "father", en: "Father", bn: "বাবা", emoji: "👨" },
  { id: "teacher", en: "Teacher", bn: "শিক্ষক", emoji: "🧑‍🏫" },
  { id: "narrator", en: "Narrator", bn: "কথক", emoji: "🎙️" },
  { id: "doctor", en: "Doctor", bn: "ডাক্তার", emoji: "👩‍⚕️" },
  { id: "expert", en: "Expert", bn: "বিশেষজ্ঞ", emoji: "🧓" },
];

const GENDERS = [
  { id: "female", en: "Female", bn: "মহিলা" },
  { id: "male", en: "Male", bn: "পুরুষ" },
];

const AGE_RANGES = ["22-28", "28-34", "32-38", "40-48", "50-58"];

const DURATION_PRESETS: { value: number; label: string; bn: string }[] = [
  { value: 60, label: "1 min", bn: "১ মিনিট" },
  { value: 300, label: "5 min", bn: "৫ মিনিট" },
  { value: 600, label: "10 min", bn: "১০ মিনিট" },
  { value: 1200, label: "20 min", bn: "২০ মিনিট" },
  { value: 3600, label: "1 hour", bn: "১ ঘণ্টা" },
];

const QUALITY_PRESETS: {
  value: string;
  label: string;
  bn: string;
  desc: string;
}[] = [
  {
    value: "standard",
    label: "Standard",
    bn: "স্ট্যান্ডার্ড",
    desc: "CRF 23 · medium preset · fast",
  },
  {
    value: "hd",
    label: "HD",
    bn: "এইচডি",
    desc: "CRF 20 · medium preset · sharper",
  },
  {
    value: "cinematic",
    label: "Cinematic",
    bn: "সিনেমা",
    desc: "CRF 23 · slow preset · premium grade",
  },
];

const POLL_INTERVAL_MS = 3000;

/* ----------------------------- Helpers ----------------------------- */

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return "0s";
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const r = Math.round(sec - m * 60);
  return `${m}m ${r}s`;
}

function personaLabel(labels: Record<string, PersonaLabel> | undefined, key: string) {
  if (!labels || !labels[key]) return key;
  const l = labels[key];
  return `${l.en} · ${l.bn}`;
}

function personaBn(labels: Record<string, PersonaLabel> | undefined, key: string) {
  return labels && labels[key] ? labels[key].bn : key;
}

function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
    scripting: "bg-sky-100 text-sky-700 hover:bg-sky-100",
    generating_audio: "bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-100",
    generating_images: "bg-violet-100 text-violet-700 hover:bg-violet-100",
    composing: "bg-amber-100 text-amber-700 hover:bg-amber-100",
    completed: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
    failed: "bg-rose-100 text-rose-700 hover:bg-rose-100",
    generated: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  };
  return map[status] ?? "bg-slate-100 text-slate-600 hover:bg-slate-100";
}

function qualityBadgeClass(q: string): string {
  if (q === "cinematic") return "bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-100";
  if (q === "hd") return "bg-amber-100 text-amber-700 hover:bg-amber-100";
  return "bg-slate-100 text-slate-600 hover:bg-slate-100";
}

function parseScenes(scenesJson: string | null | undefined): Scene[] {
  if (!scenesJson) return [];
  try {
    const parsed = JSON.parse(scenesJson);
    if (Array.isArray(parsed)) return parsed as Scene[];
    return [];
  } catch {
    return [];
  }
}

function parseScriptTitle(scriptJson: string | null | undefined): string | null {
  if (!scriptJson) return null;
  try {
    const parsed = JSON.parse(scriptJson);
    return parsed?.title ?? null;
  } catch {
    return null;
  }
}

/* ----------------------------- Sub-components ----------------------------- */

function StatTile({
  label,
  value,
  icon,
  tone = "rose",
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "rose" | "amber" | "emerald" | "fuchsia" | "slate";
}) {
  const tones: Record<string, string> = {
    rose: "from-rose-500/15 to-rose-500/5 text-rose-700 dark:text-rose-300",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-700 dark:text-amber-300",
    emerald:
      "from-emerald-500/15 to-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    fuchsia:
      "from-fuchsia-500/15 to-fuchsia-500/5 text-fuchsia-700 dark:text-fuchsia-300",
    slate: "from-slate-500/15 to-slate-500/5 text-slate-700 dark:text-slate-300",
  };
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${tones[tone]} p-3 border border-transparent`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">
          {label}
        </span>
        {icon && <span className="opacity-80">{icon}</span>}
      </div>
      <p className="text-xl font-bold mt-1 text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}

function AvatarCardSkeleton() {
  return (
    <Card className="p-0 overflow-hidden">
      <Skeleton className="aspect-[3/4] w-full rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-7 w-full" />
      </div>
    </Card>
  );
}

function VideoCardSkeleton() {
  return (
    <Card className="p-0 overflow-hidden">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-7 w-1/3" />
      </div>
    </Card>
  );
}

/* ----------------------------- Main Component ----------------------------- */

export default function HumanAvatarView() {
  const { toast } = useToast();

  // ----- meta + videos -----
  const [meta, setMeta] = useState<AvatarMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [videos, setVideos] = useState<AvatarVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [videoStats, setVideoStats] = useState<VideoStats | null>(null);

  // ----- ui state -----
  const [activeTab, setActiveTab] = useState<string>("avatars");
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);

  // ----- create avatar dialog -----
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    persona: "mother",
    gender: "female",
    ageRange: "28-34",
    faceDescription: "",
    voiceProfile: "tongtong",
    voiceSpeed: 0.95,
    outfitStyle: "saree",
    sceneContext: "home living room",
    backgroundStory: "",
  });

  // ----- generate video -----
  const [genPrompt, setGenPrompt] = useState("");
  const [genDuration, setGenDuration] = useState(60);
  const [genQuality, setGenQuality] = useState("standard");
  const [generating, setGenerating] = useState(false);
  const [liveVideo, setLiveVideo] = useState<AvatarVideo | null>(null);
  const [finalResult, setFinalResult] = useState<GenerateVideoResult | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [pollingAvatarId, setPollingAvatarId] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const postInFlight = useRef(false);

  // ----- video library: play dialog -----
  const [playVideo, setPlayVideo] = useState<AvatarVideo | null>(null);

  /* ----- Load meta ----- */
  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    try {
      const res = await fetch("/api/human-avatars", { cache: "no-store" });
      const data = await res.json();
      setMeta(data as AvatarMeta);
    } catch (e) {
      toast({
        title: "Failed to load avatars",
        description: String(e),
        variant: "destructive",
      });
    } finally {
      setMetaLoading(false);
    }
  }, [toast]);

  /* ----- Load videos ----- */
  const loadVideos = useCallback(async () => {
    setVideosLoading(true);
    try {
      const res = await fetch("/api/avatar-video", { cache: "no-store" });
      const data = await res.json();
      setVideos(data.videos || []);
      setVideoStats(data.stats || null);
    } catch (e) {
      toast({
        title: "Failed to load videos",
        description: String(e),
        variant: "destructive",
      });
    } finally {
      setVideosLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadMeta();
    loadVideos();
  }, [loadMeta, loadVideos]);

  /* ----- Polling effect -----
     While pollingAvatarId is set, fetch GET /api/avatar-video?avatarId=X
     every POLL_INTERVAL_MS to update progress. Stop on completed/failed. */
  useEffect(() => {
    if (!pollingAvatarId) return;

    const pollOnce = async () => {
      try {
        const res = await fetch(
          `/api/avatar-video?avatarId=${encodeURIComponent(pollingAvatarId)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = await res.json();
        const list: AvatarVideo[] = data.videos || [];
        if (list.length === 0) return;

        // Find latest video for this avatar (most recent createdAt)
        const latest = list[0]; // API returns ordered desc
        setLiveVideo(latest);

        if (latest.status === "completed" || latest.status === "failed") {
          // stop polling
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          setPollingAvatarId(null);

          if (latest.status === "failed") {
            setGenError(
              "Video generation failed on the server. Check logs and try again."
            );
            setGenerating(false);
          } else if (latest.status === "completed" && !finalResult) {
            // POST may still be in flight — synthesize a minimal result
            // from the live video so the UI shows the player + scenes.
            const scenes = parseScenes(latest.scenesJson);
            const title = parseScriptTitle(latest.script) || latest.prompt;
            setFinalResult({
              ok: true,
              video: latest,
              title,
              intro: "",
              outro: "",
              scenes,
              totalScenes: scenes.length,
              actualDurationSec: latest.actualDuration ?? 0,
              targetDurationSec: latest.targetDuration,
              lipSyncUsed: latest.lipSyncUsed,
              lipSyncReason: latest.lipSyncReason || undefined,
              avatarName: undefined,
              voiceProfile: undefined,
            });
            setGenerating(false);
            toast({
              title: "Video ready!",
              description: `"${title}" — ${formatDuration(latest.actualDuration)}`,
            });
          }
        }
      } catch {
        // ignore transient polling errors
      }
    };

    // immediate first poll
    pollOnce();
    pollingRef.current = setInterval(pollOnce, POLL_INTERVAL_MS);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [pollingAvatarId]);

  /* ----- Handlers ----- */

  const handleSeedPresets = async () => {
    toast({
      title: "Seeding 6 preset avatars…",
      description: "এই মুহূর্তে ৬টি প্রিসেট তৈরি হচ্ছে",
    });
    try {
      const res = await fetch("/api/human-avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed_presets" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "seed failed");
      toast({
        title: `Seeded ${data.seeded} avatars`,
        description: data.details?.slice(0, 3).join(" · "),
      });
      loadMeta();
    } catch (e) {
      toast({
        title: "Seed failed",
        description: String(e),
        variant: "destructive",
      });
    }
  };

  const handleCreateFromPreset = async (presetId: string) => {
    try {
      const res = await fetch("/api/human-avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          presetId,
          generatePortrait: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "create failed");
      toast({
        title: "Avatar created from preset",
        description: data.portraitUrl
          ? `Portrait generated ✓ — ${data.avatar?.name}`
          : `Avatar saved (portrait pending) — ${data.avatar?.name}`,
      });
      loadMeta();
    } catch (e) {
      toast({
        title: "Create from preset failed",
        description: String(e),
        variant: "destructive",
      });
    }
  };

  const handleRegeneratePortrait = async (avatarId: string, name: string) => {
    toast({
      title: `Regenerating portrait for ${name}…`,
      description: "এটি কিছু সময় নিতে পারে",
    });
    try {
      const res = await fetch("/api/human-avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_portrait", avatarId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "regen failed");
      toast({
        title: "Portrait regenerated",
        description: `New portrait for ${name} ✓`,
      });
      loadMeta();
    } catch (e) {
      toast({
        title: "Portrait regeneration failed",
        description: String(e),
        variant: "destructive",
      });
    }
  };

  const handleDeleteAvatar = async (avatarId: string, name: string) => {
    if (!confirm(`Delete avatar "${name}"? This also deletes all its videos + files. এটি স্থায়ী।`)) return;
    try {
      const res = await fetch("/api/human-avatars", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: avatarId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "delete failed");
      toast({
        title: "Avatar deleted",
        description: `${name} — ${data.filesDeleted || 0} files cleaned, ${data.cascadedVideos || 0} videos removed`,
      });
      loadMeta();
      loadVideos();
    } catch (e) {
      toast({
        title: "Delete failed",
        description: String(e),
        variant: "destructive",
      });
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm("Delete this video + its files? এটি স্থায়ী।")) return;
    try {
      const res = await fetch("/api/avatar-video", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: videoId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "delete failed");
      toast({
        title: "Video deleted",
        description: `${data.filesDeleted || 0} files cleaned`,
      });
      loadVideos();
      loadMeta();
      setPlayVideo(null);
    } catch (e) {
      toast({
        title: "Delete failed",
        description: String(e),
        variant: "destructive",
      });
    }
  };

  const handleCreateCustom = async () => {
    if (
      !createForm.name.trim() ||
      !createForm.faceDescription.trim()
    ) {
      toast({
        title: "Missing fields",
        description: "নাম ও মুখমণ্ডল বিবরণ আবশ্যক।",
        variant: "destructive",
      });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/human-avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          ...createForm,
          generatePortrait: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "create failed");
      if (data.warning) {
        toast({
          title: "Avatar created (portrait failed)",
          description: data.warning,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Avatar created!",
          description: `${data.avatar?.name} — portrait ready ✓`,
        });
      }
      setCreateOpen(false);
      setCreateForm((p) => ({ ...p, name: "", faceDescription: "", backgroundStory: "" }));
      loadMeta();
    } catch (e) {
      toast({
        title: "Create avatar failed",
        description: String(e),
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handlePickAvatarForVideo = (avatar: HumanAvatar) => {
    setSelectedAvatarId(avatar.id);
    setFinalResult(null);
    setLiveVideo(null);
    setGenError(null);
    setActiveTab("generate");
    toast({
      title: `Selected ${avatar.name}`,
      description: "এখন ভিডিও প্রম্পট লিখুন",
    });
  };

  const handleGenerateVideo = async () => {
    if (!selectedAvatarId) {
      toast({
        title: "Select an avatar first",
        description: "প্রথমে অ্যাভাটার নির্বাচন করুন।",
        variant: "destructive",
      });
      setActiveTab("avatars");
      return;
    }
    if (!genPrompt.trim()) {
      toast({
        title: "Prompt required",
        description: "ভিডিওর বিষয় লিখুন।",
        variant: "destructive",
      });
      return;
    }
    const avatar = meta?.avatars.find((a) => a.id === selectedAvatarId);
    if (avatar && avatar.portraitStatus !== "generated") {
      toast({
        title: "Avatar portrait not ready",
        description:
          "প্রথমে এই অ্যাভাটারের পোর্ট্রেট তৈরি করুন (Regenerate Portrait)।",
        variant: "destructive",
      });
      return;
    }

    // reset UI
    setGenerating(true);
    setFinalResult(null);
    setLiveVideo(null);
    setGenError(null);
    setPollingAvatarId(selectedAvatarId);
    postInFlight.current = true;

    toast({
      title: "Generating video…",
      description: "স্ক্রিপ্ট → ভয়েস → ছবি → FFmpeg — কয়েক মিনিট সময় লাগতে পারে।",
    });

    try {
      const res = await fetch("/api/avatar-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarId: selectedAvatarId,
          prompt: genPrompt,
          targetDuration: genDuration,
          quality: genQuality,
        }),
      });
      const data: GenerateVideoResult = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Video generation failed");
      }
      setFinalResult(data);
      setGenerating(false);
      // polling may already have set this; that's fine, this is the more
      // complete result with scenes + intro + outro.
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      setPollingAvatarId(null);
      toast({
        title: "Video ready!",
        description: `"${data.title}" — ${formatDuration(data.actualDurationSec)}`,
      });
      // refresh video library so the new one appears
      loadVideos();
      // refresh meta to update videoCount
      loadMeta();
    } catch (e) {
      setGenError(String(e));
      setGenerating(false);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      setPollingAvatarId(null);
      toast({
        title: "Video generation failed",
        description: String(e),
        variant: "destructive",
      });
    } finally {
      postInFlight.current = false;
    }
  };

  /* ----- Derived ----- */
  const selectedAvatar = useMemo(
    () => meta?.avatars.find((a) => a.id === selectedAvatarId) || null,
    [meta, selectedAvatarId]
  );

  const completedVideos = useMemo(
    () => videos.filter((v) => v.status === "completed"),
    [videos]
  );

  const inProgressPct = liveVideo?.progress ?? 0;
  const inProgressStep = liveVideo?.currentStep ?? "Preparing…";

  /* ===================== Render ===================== */

  return (
    <div className="alo-fade-up space-y-5">
      {/* ---------- Header card ---------- */}
      <Card className="p-4 sm:p-5 bg-gradient-to-br from-rose-500/10 via-amber-500/5 to-fuchsia-500/10 border-0 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-2xl bg-gradient-to-br from-rose-400 to-amber-400 p-2.5 text-white shadow-md shrink-0">
              <UserCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 flex-wrap">
                Human Avatar Studio
                <span className="alo-text-grad text-sm font-semibold">
                  / হিউম্যান অ্যাভাটার স্টুডিও
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                AI-নির্মিত মানবসদৃশ অ্যাভাটার — স্বাভাবিক ভয়েস ও ধারাবাহিক মুখমণ্ডল
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleSeedPresets}
              variant="outline"
              size="sm"
              className="h-8 bg-white/60 dark:bg-white/10 border-rose-300/60 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Seed 6 Presets
            </Button>
            <Button
              onClick={() => setCreateOpen(true)}
              size="sm"
              className="h-8 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white border-0"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create Custom Avatar
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
          <StatTile
            label="Total"
            value={meta?.stats.total ?? 0}
            icon={<Users className="h-3 w-3" />}
            tone="rose"
          />
          <StatTile
            label="Active"
            value={meta?.stats.active ?? 0}
            icon={<Activity className="h-3 w-3" />}
            tone="emerald"
          />
          <StatTile
            label="Portraits"
            value={meta?.stats.generated ?? 0}
            icon={<ImageIcon className="h-3 w-3" />}
            tone="amber"
          />
          <StatTile
            label="Pending"
            value={meta?.stats.pending ?? 0}
            icon={<Clock className="h-3 w-3" />}
            tone="fuchsia"
          />
          <StatTile
            label="Failed"
            value={meta?.stats.failed ?? 0}
            icon={<AlertTriangle className="h-3 w-3" />}
            tone="slate"
          />
          <StatTile
            label="Videos"
            value={meta?.stats.totalVideos ?? 0}
            icon={<Video className="h-3 w-3" />}
            tone="rose"
          />
        </div>
      </Card>

      {/* ---------- Tabs ---------- */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto alo-scrollbar -mx-1 px-1">
          <TabsList className="h-auto w-full sm:w-fit justify-start">
            <TabsTrigger value="avatars" className="gap-1.5 py-1.5">
              <Users className="h-3.5 w-3.5" />
              <span>Avatars</span>
              <span className="text-[10px] opacity-60">/ অ্যাভাটার</span>
            </TabsTrigger>
            <TabsTrigger value="generate" className="gap-1.5 py-1.5">
              <Wand2 className="h-3.5 w-3.5" />
              <span>Generate Video</span>
              <span className="text-[10px] opacity-60">/ ভিডিও তৈরি</span>
            </TabsTrigger>
            <TabsTrigger value="library" className="gap-1.5 py-1.5">
              <Film className="h-3.5 w-3.5" />
              <span>Video Library</span>
              <span className="text-[10px] opacity-60">/ লাইব্রেরি</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ============== Tab 1: Avatars ============== */}
        <TabsContent value="avatars" className="space-y-5 mt-4">
          {/* Avatar gallery */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                <UserCircle className="h-4 w-4 text-rose-600" />
                Avatar Gallery
                <span className="text-xs text-muted-foreground font-normal">
                  / অ্যাভাটার গ্যালারি
                </span>
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMeta}
                disabled={metaLoading}
                className="h-7 text-xs"
              >
                <RefreshCw
                  className={`h-3 w-3 mr-1.5 ${metaLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>

            {metaLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <AvatarCardSkeleton key={i} />
                ))}
              </div>
            ) : !meta || meta.avatars.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <UserCircle className="h-10 w-10 mx-auto mb-2 text-rose-300" />
                <p className="text-sm text-muted-foreground">
                  কোনো অ্যাভাটার নেই — শুরু করতে{" "}
                  <span className="font-semibold text-rose-700">
                    &ldquo;Seed 6 Presets&rdquo;
                  </span>{" "}
                  বা কাস্টম অ্যাভাটার তৈরি করুন।
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {meta.avatars.map((a, i) => (
                  <Card
                    key={a.id}
                    className="p-0 overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all duration-200 alo-stagger"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    {/* Portrait */}
                    <div className="relative aspect-[3/4] bg-gradient-to-br from-rose-100/60 to-amber-100/40 dark:from-rose-950/40 dark:to-amber-950/30 overflow-hidden">
                      {a.portraitUrl && a.portraitStatus === "generated" ? (
                        <img
                          src={a.portraitUrl}
                          alt={`${a.name} portrait`}
                          className="h-full w-full object-cover hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="h-full w-full flex flex-col items-center justify-center text-rose-400">
                          {a.portraitStatus === "failed" ? (
                            <AlertTriangle className="h-10 w-10 mb-1" />
                          ) : (
                            <Loader2 className="h-10 w-10 mb-1 animate-spin" />
                          )}
                          <p className="text-[11px] font-semibold uppercase tracking-wide">
                            {a.portraitStatus}
                          </p>
                        </div>
                      )}
                      {/* Status badge */}
                      <div className="absolute top-2 right-2">
                        {a.portraitStatus !== "generated" && (
                          <Badge className={statusBadgeClass(a.portraitStatus)}>
                            {a.portraitStatus}
                          </Badge>
                        )}
                      </div>
                      {/* Video count */}
                      {a.videoCount > 0 && (
                        <div className="absolute top-2 left-2">
                          <Badge className="bg-rose-600/90 text-white hover:bg-rose-600/90">
                            <Video className="h-2.5 w-2.5 mr-0.5" />
                            {a.videoCount}
                          </Badge>
                        </div>
                      )}
                      {/* Active dot */}
                      {a.active && (
                        <div className="absolute bottom-2 right-2">
                          <span
                            title="Active"
                            className="inline-flex items-center justify-center h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-black alo-pulse"
                          />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-semibold text-sm truncate">
                          {a.name}
                        </h4>
                        <Badge
                          variant="outline"
                          className="text-[9px] shrink-0 border-rose-300 text-rose-700 bg-rose-50"
                        >
                          {personaBn(meta.personaLabels, a.persona)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Badge
                          variant="outline"
                          className="text-[9px] font-normal"
                        >
                          {a.gender} · {a.ageRange}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[9px] font-normal border-amber-300 text-amber-700 bg-amber-50"
                        >
                          <Mic className="h-2 w-2 mr-0.5" />
                          {a.voiceProfile}
                        </Badge>
                        {a.outfitStyle && (
                          <Badge
                            variant="outline"
                            className="text-[9px] font-normal"
                          >
                            {a.outfitStyle}
                          </Badge>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1.5 pt-1">
                        <Button
                          size="sm"
                          onClick={() => handlePickAvatarForVideo(a)}
                          className="flex-1 h-8 text-xs bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white border-0"
                        >
                          <Video className="h-3 w-3 mr-1" />
                          Generate Video
                          <ChevronsRight className="h-3 w-3 ml-1" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRegeneratePortrait(a.id, a.name)}
                          className="h-8 w-8 p-0 border-rose-300 text-rose-600 hover:bg-rose-50"
                          title="Regenerate portrait"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteAvatar(a.id, a.name)}
                          className="h-8 w-8 p-0 border-red-300 text-red-600 hover:bg-red-50"
                          title="Delete avatar + all videos"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Presets reference */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-amber-600" />
                Preset Library
                <span className="text-xs text-muted-foreground font-normal">
                  / প্রিসেট লাইব্রেরি (৬টি)
                </span>
              </h3>
              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                <Layers className="h-3 w-3 mr-1" />
                {meta?.presets.length ?? 6} ready
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(meta?.presets || []).map((p) => (
                <Card
                  key={p.id}
                  className="p-3 bg-gradient-to-br from-rose-50/50 to-amber-50/30 dark:from-rose-950/20 dark:to-amber-950/10 border-rose-200/60 hover:border-rose-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{p.name}</p>
                      <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">
                        {p.bnName}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[9px] shrink-0 border-rose-300 text-rose-700 bg-rose-50"
                    >
                      {personaBn(meta?.personaLabels, p.persona)}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">
                    {p.bestFor}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Badge
                      variant="outline"
                      className="text-[9px] font-normal border-amber-300 text-amber-700 bg-amber-50"
                    >
                      <Mic className="h-2 w-2 mr-0.5" />
                      {p.voiceProfile}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] font-normal">
                      {p.gender} · {p.ageRange}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCreateFromPreset(p.id)}
                    className="w-full mt-3 h-7 text-[11px] border-rose-300 text-rose-700 hover:bg-rose-50"
                  >
                    <Wand2 className="h-3 w-3 mr-1" />
                    Use this preset
                  </Button>
                </Card>
              ))}
              {!meta && (
                <>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* ============== Tab 2: Generate Video ============== */}
        <TabsContent value="generate" className="space-y-4 mt-4">
          {/* Form card */}
          <Card className="p-4 sm:p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-4 text-sm">
              <Clapperboard className="h-4 w-4 text-rose-600" />
              Video Generation
              <span className="text-xs text-muted-foreground font-normal">
                / ভিডিও তৈরি
              </span>
            </h3>

            {/* Selected avatar preview */}
            <div className="space-y-2 mb-4">
              <Label className="text-xs flex items-center gap-1">
                <UserCircle className="h-3 w-3" />
                Selected Avatar
                <span className="text-muted-foreground font-normal">
                  / নির্বাচিত অ্যাভাটার
                </span>
              </Label>
              {selectedAvatar ? (
                <Card className="p-3 flex items-center gap-3 border-rose-200 bg-rose-50/40 dark:bg-rose-950/10">
                  <div className="h-14 w-14 rounded-lg overflow-hidden bg-rose-100 shrink-0">
                    {selectedAvatar.portraitUrl ? (
                      <img
                        src={selectedAvatar.portraitUrl}
                        alt={selectedAvatar.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <UserCircle className="h-6 w-6 text-rose-400" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">
                      {selectedAvatar.name}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      <Badge
                        variant="outline"
                        className="text-[9px] border-rose-300 text-rose-700 bg-rose-50"
                      >
                        {personaLabel(meta?.personaLabels, selectedAvatar.persona)}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[9px] border-amber-300 text-amber-700 bg-amber-50"
                      >
                        <Mic className="h-2 w-2 mr-0.5" />
                        {selectedAvatar.voiceProfile} · {selectedAvatar.voiceSpeed}x
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setActiveTab("avatars")}
                    className="h-7 text-xs shrink-0"
                  >
                    Change
                  </Button>
                </Card>
              ) : (
                <Card className="p-4 border-dashed text-center">
                  <p className="text-xs text-muted-foreground">
                    কোনো অ্যাভাটার নির্বাচিত নেই —{" "}
                    <button
                      onClick={() => setActiveTab("avatars")}
                      className="text-rose-700 font-semibold hover:underline"
                    >
                      Avatars ট্যাবে যান
                    </button>
                  </p>
                </Card>
              )}
            </div>

            {/* Prompt */}
            <div className="space-y-2 mb-4">
              <Label className="text-xs flex items-center gap-1">
                <Wand2 className="h-3 w-3" />
                Prompt
                <span className="text-muted-foreground font-normal">
                  / কী নিয়ে ভিডিও বানাবেন?
                </span>
              </Label>
              <Textarea
                value={genPrompt}
                onChange={(e) => setGenPrompt(e.target.value)}
                rows={3}
                placeholder="৬ মাসের শিশুর ঘুমের সমস্যা ও সমাধান"
                className="text-sm resize-y"
              />
              <p className="text-[10px] text-muted-foreground">
                এক বা দুই লাইনে বিষয় লিখুন — LLM সম্পূর্ণ স্ক্রিপ্ট তৈরি করবে।
              </p>
            </div>

            {/* Target duration */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Target Duration
                  <span className="text-muted-foreground font-normal">
                    / লক্ষ্য দৈর্ঘ্য
                  </span>
                </Label>
                <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">
                  {Math.floor(genDuration / 60)} min ({genDuration} sec)
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {DURATION_PRESETS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setGenDuration(d.value)}
                    className={`rounded-lg border px-2 py-2 text-xs transition-all ${
                      genDuration === d.value
                        ? "border-rose-400 bg-rose-50 text-rose-700 shadow-sm ring-1 ring-rose-300"
                        : "border-border/60 hover:border-rose-300 hover:bg-rose-50/50"
                    }`}
                  >
                    <p className="font-semibold">{d.label}</p>
                    <p className="text-[10px] text-muted-foreground">{d.bn}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Quality */}
            <div className="space-y-2 mb-4">
              <Label className="text-xs flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Quality
                <span className="text-muted-foreground font-normal">/ গুণমান</span>
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {QUALITY_PRESETS.map((q) => (
                  <button
                    key={q.value}
                    onClick={() => setGenQuality(q.value)}
                    className={`rounded-lg border px-3 py-2 text-left transition-all ${
                      genQuality === q.value
                        ? "border-rose-400 bg-rose-50 text-rose-700 shadow-sm ring-1 ring-rose-300"
                        : "border-border/60 hover:border-rose-300 hover:bg-rose-50/50"
                    }`}
                  >
                    <p className="text-sm font-semibold">
                      {q.label}{" "}
                      <span className="text-[10px] text-muted-foreground">
                        · {q.bn}
                      </span>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {q.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Action button */}
            <Button
              onClick={handleGenerateVideo}
              disabled={generating || !selectedAvatar || !genPrompt.trim()}
              className="w-full h-11 bg-gradient-to-r from-rose-500 via-fuchsia-500 to-amber-500 hover:from-rose-600 hover:via-fuchsia-600 hover:to-amber-600 text-white border-0 shadow-md"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Generate Video
                </>
              )}
            </Button>

            {/* Inline error */}
            {genError && (
              <div className="mt-4 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold">Generation failed</p>
                  <p className="text-xs mt-0.5 break-words">{genError}</p>
                </div>
              </div>
            )}
          </Card>

          {/* Progress card (during generation) */}
          {generating && liveVideo && (
            <Card className="p-4 sm:p-5 border-rose-200 bg-gradient-to-br from-rose-50/50 to-amber-50/30">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
                  {liveVideo.status || "in progress"}
                </h4>
                <Badge className="bg-rose-600 text-white">{inProgressPct}%</Badge>
              </div>
              <Progress
                value={inProgressPct}
                className="h-2 bg-rose-100 [&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-rose-500 [&>[data-slot=progress-indicator]]:to-amber-500"
              />
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-rose-500" />
                {inProgressStep}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Polling every {POLL_INTERVAL_MS / 1000}s — এটি কয়েক মিনিট সময় নিতে পারে।
              </p>
            </Card>
          )}

          {/* Result card */}
          {finalResult && finalResult.ok && (
            <Card className="p-4 sm:p-5 border-emerald-300 bg-gradient-to-br from-emerald-50/40 to-rose-50/30">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Video Ready
                  <span className="text-xs text-muted-foreground font-normal">
                    / ভিডিও প্রস্তুত
                  </span>
                </h4>
                {finalResult.lipSyncUsed ? (
                  <Badge className="bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-100">
                    <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                    Lip-synced
                  </Badge>
                ) : finalResult.lipSyncReason === "not_configured" ? (
                  <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100" title="LIPSYNC_SERVICE_URL not set">
                    Lip-sync unavailable
                  </Badge>
                ) : finalResult.lipSyncReason ? (
                  <Badge className="bg-red-100 text-red-700 hover:bg-red-100" title={finalResult.lipSyncReason}>
                    <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                    Lip-sync failed
                  </Badge>
                ) : null}
              </div>

              <h3 className="text-base font-bold mb-1">
                {finalResult.title || "Untitled"}
              </h3>
              {finalResult.intro && (
                <p className="text-xs text-muted-foreground mb-3 italic">
                  {finalResult.intro}
                </p>
              )}

              {/* Meta chips */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {finalResult.avatarName && (
                  <Badge variant="outline" className="text-[10px]">
                    <UserCircle className="h-2.5 w-2.5 mr-0.5" />
                    {finalResult.avatarName}
                  </Badge>
                )}
                {finalResult.voiceProfile && (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-amber-300 text-amber-700 bg-amber-50"
                  >
                    <Mic className="h-2.5 w-2.5 mr-0.5" />
                    {finalResult.voiceProfile}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px]">
                  <Clock className="h-2.5 w-2.5 mr-0.5" />
                  {formatDuration(finalResult.actualDurationSec)} /{" "}
                  {formatDuration(finalResult.targetDurationSec)}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  <Layers className="h-2.5 w-2.5 mr-0.5" />
                  {finalResult.totalScenes ?? finalResult.scenes?.length ?? 0} scenes
                </Badge>
                <Badge className={qualityBadgeClass(genQuality)}>
                  {genQuality}
                </Badge>
              </div>

              {/* Video player */}
              {finalResult.video?.videoUrl && (
                <div className="rounded-lg overflow-hidden border border-border/60 bg-black mb-4">
                  <video
                    controls
                    className="w-full max-h-[480px]"
                    poster={finalResult.video?.thumbnailUrl || undefined}
                  >
                    <source src={finalResult.video.videoUrl} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}

              {/* Thumbnail */}
              {finalResult.video?.thumbnailUrl &&
                !finalResult.video?.videoUrl && (
                  <img
                    src={finalResult.video.thumbnailUrl}
                    alt="thumbnail"
                    className="w-full rounded-lg border border-border/60 mb-4"
                  />
                )}

              {/* Scenes breakdown */}
              {finalResult.scenes && finalResult.scenes.length > 0 && (
                <ScenesBreakdown scenes={finalResult.scenes} />
              )}

              {finalResult.outro && (
                <p className="text-xs text-muted-foreground italic mt-3">
                  {finalResult.outro}
                </p>
              )}
            </Card>
          )}
        </TabsContent>

        {/* ============== Tab 3: Video Library ============== */}
        <TabsContent value="library" className="space-y-4 mt-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <StatTile
              label="Total"
              value={videoStats?.total ?? 0}
              icon={<Film className="h-3 w-3" />}
              tone="rose"
            />
            <StatTile
              label="Completed"
              value={videoStats?.completed ?? 0}
              icon={<CheckCircle2 className="h-3 w-3" />}
              tone="emerald"
            />
            <StatTile
              label="Failed"
              value={videoStats?.failed ?? 0}
              icon={<AlertTriangle className="h-3 w-3" />}
              tone="slate"
            />
            <StatTile
              label="In Progress"
              value={videoStats?.inProgress ?? 0}
              icon={<Loader2 className="h-3 w-3" />}
              tone="amber"
            />
            <StatTile
              label="Total Duration"
              value={formatDuration(videoStats?.totalDurationSec)}
              icon={<Clock className="h-3 w-3" />}
              tone="fuchsia"
            />
            <StatTile
              label="Lip-synced"
              value={videoStats?.lipSyncUsed ?? 0}
              icon={<Sparkles className="h-3 w-3" />}
              tone="rose"
            />
          </div>

          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              <Film className="h-4 w-4 text-rose-600" />
              Completed Videos
              <span className="text-xs text-muted-foreground font-normal">
                / সম্পন্ন ভিডিও
              </span>
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadVideos}
              disabled={videosLoading}
              className="h-7 text-xs"
            >
              <RefreshCw
                className={`h-3 w-3 mr-1.5 ${videosLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>

          {videosLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <VideoCardSkeleton key={i} />
              ))}
            </div>
          ) : completedVideos.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <Film className="h-10 w-10 mx-auto mb-2 text-rose-300" />
              <p className="text-sm text-muted-foreground">
                কোনো সম্পন্ন ভিডিও নেই —{" "}
                <button
                  onClick={() => setActiveTab("generate")}
                  className="font-semibold text-rose-700 hover:underline"
                >
                  Generate Video
                </button>{" "}
                ট্যাবে যান।
              </p>
            </Card>
          ) : (
            <div className="max-h-[600px] overflow-y-auto alo-scrollbar pr-1 -mr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedVideos.map((v, i) => {
                  const title =
                    parseScriptTitle(v.script) ||
                    v.prompt.slice(0, 60) ||
                    "Untitled";
                  const avatar = meta?.avatars.find((a) => a.id === v.avatarId);
                  return (
                    <Card
                      key={v.id}
                      className="p-0 overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all duration-200 alo-stagger"
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      {/* Thumbnail */}
                      <button
                        onClick={() => setPlayVideo(v)}
                        className="relative w-full aspect-video bg-gradient-to-br from-rose-100 to-amber-100 dark:from-rose-950/30 dark:to-amber-950/20 group cursor-pointer"
                      >
                        {v.thumbnailUrl ? (
                          <img
                            src={v.thumbnailUrl}
                            alt={title}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <Film className="h-8 w-8 text-rose-400" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <div className="rounded-full bg-white/90 p-2 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="h-4 w-4 text-rose-600" fill="currentColor" />
                          </div>
                        </div>
                        <div className="absolute bottom-1 right-1">
                          <Badge className="bg-black/80 text-white hover:bg-black/80">
                            <Clock className="h-2 w-2 mr-0.5" />
                            {formatDuration(v.actualDuration)}
                          </Badge>
                        </div>
                      </button>

                      <CardContent className="p-3 space-y-2">
                        <h4 className="font-semibold text-sm line-clamp-2 min-h-[2.5rem]">
                          {title}
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          <Badge
                            variant="outline"
                            className="text-[9px] border-rose-300 text-rose-700 bg-rose-50"
                          >
                            <UserCircle className="h-2 w-2 mr-0.5" />
                            {avatar?.name ?? "—"}
                          </Badge>
                          <Badge className={qualityBadgeClass(v.quality)}>
                            {v.quality}
                          </Badge>
                          {/* Honest lip-sync state display */}
                          {v.lipSyncUsed ? (
                            <Badge className="bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-100">
                              <Sparkles className="h-2 w-2 mr-0.5" />
                              Lip-synced
                            </Badge>
                          ) : v.lipSyncReason === "not_configured" ? (
                            <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100" title="LIPSYNC_SERVICE_URL not set — talking-portrait mode">
                              Lip-sync unavailable
                            </Badge>
                          ) : v.lipSyncReason === "http_error" || v.lipSyncReason === "invalid_output" || v.lipSyncReason === "timeout" || v.lipSyncReason === "provider_error" ? (
                            <Badge className="bg-red-100 text-red-700 hover:bg-red-100" title={v.lipSyncReason || ""}>
                              <AlertTriangle className="h-2 w-2 mr-0.5" />
                              Lip-sync failed
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">
                              No lip-sync
                            </Badge>
                          )}
                          <Badge className={statusBadgeClass(v.status)}>
                            {v.status}
                          </Badge>
                        </div>
                        {v.status === "failed" && v.errorMessage && (
                          <div className="text-[10px] text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 rounded px-2 py-1 mt-1 line-clamp-2">
                            <AlertTriangle className="h-2.5 w-2.5 inline mr-1" />
                            {v.errorMessage}
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-muted-foreground">
                            {timeAgo(v.createdAt)}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPlayVideo(v)}
                              className="h-7 text-[11px] border-rose-300 text-rose-700 hover:bg-rose-50"
                            >
                              <Play className="h-2.5 w-2.5 mr-1" />
                              Play
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteVideo(v.id)}
                              className="h-7 w-7 p-0 border-red-300 text-red-600 hover:bg-red-50"
                              title="Delete video + files"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ---------- Create Custom Avatar Dialog ---------- */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto alo-scrollbar">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-rose-600" />
              Create Custom Avatar
              <span className="text-sm text-muted-foreground font-normal">
                / কাস্টম অ্যাভাটার
              </span>
            </DialogTitle>
            <DialogDescription>
              একটি নতুন মানবসদৃশ অ্যাভাটার তৈরি করুন — portrait সাথে সাথে তৈরি হবে।
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Name <span className="text-rose-500">*</span>{" "}
                  <span className="text-muted-foreground">/ নাম</span>
                </Label>
                <Input
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g. মিতা"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Persona <span className="text-muted-foreground">/ ব্যক্তিত্ব</span>
                </Label>
                <Select
                  value={createForm.persona}
                  onValueChange={(v) =>
                    setCreateForm((p) => ({ ...p, persona: v }))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERSONAS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.emoji} {p.en} · {p.bn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Gender <span className="text-muted-foreground">/ লিঙ্গ</span>
                </Label>
                <Select
                  value={createForm.gender}
                  onValueChange={(v) =>
                    setCreateForm((p) => ({ ...p, gender: v }))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.en} · {g.bn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Age Range <span className="text-muted-foreground">/ বয়স</span>
                </Label>
                <Select
                  value={createForm.ageRange}
                  onValueChange={(v) =>
                    setCreateForm((p) => ({ ...p, ageRange: v }))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGE_RANGES.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Face Description <span className="text-rose-500">*</span>{" "}
                <span className="text-muted-foreground">/ মুখমণ্ডল বিবরণ</span>
              </Label>
              <Textarea
                value={createForm.faceDescription}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, faceDescription: e.target.value }))
                }
                rows={3}
                placeholder="warm Bengali mother, soft oval face, gentle brown eyes, shoulder-length dark hair…"
                className="text-xs resize-y"
              />
              <p className="text-[10px] text-muted-foreground">
                বিস্তারিত বিবরণ দিলে পোর্ট্রেট আরও বাস্তব ও ধারাবাহিক হবে।
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Voice Profile <span className="text-muted-foreground">/ ভয়েস</span>
                </Label>
                <Select
                  value={createForm.voiceProfile}
                  onValueChange={(v) =>
                    setCreateForm((p) => ({ ...p, voiceProfile: v }))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICES.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.label} · {v.bn} ({v.style})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Outfit Style <span className="text-muted-foreground">/ পোশাক</span>
                </Label>
                <Select
                  value={createForm.outfitStyle}
                  onValueChange={(v) =>
                    setCreateForm((p) => ({ ...p, outfitStyle: v }))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(meta?.outfitPresets || []).map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center justify-between">
                <span>
                  Voice Speed{" "}
                  <span className="text-muted-foreground">/ ভয়েস গতি</span>
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {createForm.voiceSpeed.toFixed(2)}x
                </Badge>
              </Label>
              <Slider
                value={[createForm.voiceSpeed]}
                min={0.5}
                max={2.0}
                step={0.05}
                onValueChange={(vals) =>
                  setCreateForm((p) => ({ ...p, voiceSpeed: vals[0] }))
                }
              />
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>0.5x slow</span>
                <span>1.0x</span>
                <span>2.0x fast</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Scene Context <span className="text-muted-foreground">/ দৃশ্য</span>
              </Label>
              <Select
                value={createForm.sceneContext}
                onValueChange={(v) =>
                  setCreateForm((p) => ({ ...p, sceneContext: v }))
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(meta?.scenePresets || []).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Background Story{" "}
                <span className="text-muted-foreground">/ পেছনের গল্প</span>
              </Label>
              <Textarea
                value={createForm.backgroundStory}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, backgroundStory: e.target.value }))
                }
                rows={2}
                placeholder="একজন নরম স্বভাবের মা, যিনি নিজের অভিজ্ঞতা থেকে পরামর্শ দেন…"
                className="text-xs resize-y"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCustom}
              disabled={creating}
              className="bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white border-0"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating + generating portrait…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Create Avatar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Play Video Dialog ---------- */}
      <Dialog
        open={!!playVideo}
        onOpenChange={(o) => !o && setPlayVideo(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-4 w-4 text-rose-600" />
              {playVideo
                ? parseScriptTitle(playVideo.script) ||
                  playVideo.prompt.slice(0, 60) ||
                  "Untitled"
                : ""}
            </DialogTitle>
            <DialogDescription>
              {playVideo
                ? `${timeAgo(playVideo.createdAt)} · ${formatDuration(
                    playVideo.actualDuration
                  )} · ${playVideo.quality}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {playVideo?.videoUrl && (
            <video
              controls
              autoPlay
              className="w-full max-h-[60vh] rounded-lg bg-black"
              poster={playVideo.thumbnailUrl || undefined}
            >
              <source src={playVideo.videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          )}

          {playVideo && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-rose-700">Prompt:</span>{" "}
                {playVideo.prompt}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  <Clock className="h-2.5 w-2.5 mr-0.5" />
                  {formatDuration(playVideo.actualDuration)}
                </Badge>
                <Badge className={qualityBadgeClass(playVideo.quality)}>
                  {playVideo.quality}
                </Badge>
                {playVideo.lipSyncUsed ? (
                  <Badge className="bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-100">
                    <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                    Lip-synced
                  </Badge>
                ) : playVideo.lipSyncReason === "not_configured" ? (
                  <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100" title="LIPSYNC_SERVICE_URL not set — talking-portrait mode">
                    Lip-sync unavailable
                  </Badge>
                ) : playVideo.lipSyncReason ? (
                  <Badge className="bg-red-100 text-red-700 hover:bg-red-100" title={playVideo.lipSyncReason || ""}>
                    <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                    Lip-sync failed
                  </Badge>
                ) : null}
              </div>
              {/* Scenes breakdown for library video */}
              {parseScenes(playVideo.scenesJson).length > 0 && (
                <ScenesBreakdown scenes={parseScenes(playVideo.scenesJson)} />
              )}
              <div className="flex justify-between items-center pt-2 border-t border-rose-100 dark:border-rose-900/30">
                <a
                  href={playVideo.videoUrl || "#"}
                  download
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-rose-300 text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  <Download className="h-3 w-3" />
                  Download MP4
                </a>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeleteVideo(playVideo.id)}
                  className="h-8 border-red-300 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------------- Scenes Breakdown ----------------------- */

function ScenesBreakdown({ scenes }: { scenes: Scene[] }) {
  const [open, setOpen] = useState(false);

  if (scenes.length === 0) return null;

  return (
    <div className="mt-3 border-t border-border/40 pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="text-xs font-semibold flex items-center gap-1.5">
          <Layers className="h-3 w-3 text-rose-600" />
          Scenes Breakdown
          <span className="text-muted-foreground font-normal">
            / দৃশ্য বিবরণ ({scenes.length})
          </span>
        </span>
        <ChevronsRight
          className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-3 space-y-2 max-h-[400px] overflow-y-auto alo-scrollbar pr-1">
          {scenes.map((s, i) => (
            <Card
              key={i}
              className="p-2 bg-muted/20 border-border/40 hover:border-rose-300/60 transition-colors"
            >
              <div className="flex items-start gap-2">
                <div className="rounded-md bg-gradient-to-br from-rose-400/20 to-amber-400/20 p-1.5 text-center shrink-0">
                  <p className="text-xs font-bold text-rose-700 dark:text-rose-300">
                    {i + 1}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-semibold truncate">{s.heading}</p>
                    <Badge variant="outline" className="text-[9px] shrink-0">
                      <Clock className="h-2 w-2 mr-0.5" />
                      {formatDuration(s.durationSec)}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                    {s.text}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {s.imageUrl && (
                      <a
                        href={s.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[10px] text-rose-700 hover:underline"
                      >
                        <ImageIcon className="h-2.5 w-2.5" />
                        view image
                      </a>
                    )}
                    {s.audioUrl && (
                      <div className="flex items-center gap-1">
                        <Volume2 className="h-2.5 w-2.5 text-amber-600" />
                        <audio
                          controls
                          src={s.audioUrl}
                          className="h-6"
                          style={{ maxWidth: "240px" }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
