"use client";

import { useEffect, useState, useRef } from "react";
import { SectionHeader, StatusPill } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Upload, Lock, ShieldCheck, Trash2, AlertTriangle, ImageIcon, Video, Mic,
  Plus, Loader2, Heart, FileText, CheckCircle2, XCircle, RefreshCw, Play, Folder,
} from "lucide-react";

interface Profile {
  id: string;
  personName: string;
  personType: string;
  consentConfirmed: boolean;
  consentDate: string | null;
  guardianName: string | null;
  voiceConsent: boolean;
  faceConsent: boolean;
  active: boolean;
  _count?: { referenceAssets: number };
  referenceAssets?: Asset[];
}

interface Asset {
  id: string;
  assetType: string;
  angleType: string | null;
  context: string | null;
  expression: string | null;
  lighting: string | null;
  clothing: string | null;
  filePath: string;
  fileName: string | null;
  fileSize: number;
  mimeType: string | null;
  qualityScore: number;
  isDuplicate: boolean;
  approved: boolean;
  uploadedAt: string;
}

interface Project {
  id: string;
  title: string;
  prompt: string;
  status: string;
  currentStage: string | null;
  qualityScore: number;
  createdAt: string;
  profiles: { id: string; personName: string; personType: string }[];
}

const PERSON_TYPES = [
  { id: "me", label: "Me (আমি)", icon: "👨" },
  { id: "wife", label: "Wife (স্ত্রী)", icon: "👩" },
  { id: "child", label: "Child (সন্তান)", icon: "👶" },
];

const ANGLE_TYPES = ["front", "left", "right", "three_quarter", "full_body", "close_up"];
const CONTEXTS = ["indoor", "outdoor", "casual", "formal"];
const EXPRESSIONS = ["smiling", "neutral", "surprised", "serious", "laughing"];
const LIGHTINGS = ["natural", "studio", "low_light", "golden_hour"];
const CLOTHINGS = ["casual", "formal", "sportswear", "traditional"];

const PIPELINE_STAGES = [
  "creative_director", "script", "storyboard", "scene", "casting",
  "identity", "image", "video", "motion", "voice", "lip_sync",
  "camera", "lighting", "audio", "editing", "upscaling",
  "quality_judge", "final_director"
];

export default function FamilyStudioView() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showProject, setShowProject] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("profiles");
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [uploadMeta, setUploadMeta] = useState({ assetType: "photo", angleType: "front", context: "casual", expression: "neutral", lighting: "natural", clothing: "casual" });
  const fileRef = useRef<HTMLInputElement>(null);

  // Create form
  const [name, setName] = useState("");
  const [personType, setPersonType] = useState("me");
  const [guardian, setGuardian] = useState("");
  const [faceConsent, setFaceConsent] = useState(false);
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [overallConsent, setOverallConsent] = useState(false);

  // Project form
  const [projectPrompt, setProjectPrompt] = useState("");
  const [castIds, setCastIds] = useState<string[]>([]);

  const load = () => {
    Promise.all([
      fetch("/api/family-studio").then((r) => r.json()),
      fetch("/api/family-projects").then((r) => r.json()),
    ])
      .then(([d1, d2]) => {
        setProfiles(d1.profiles ?? []);
        setProjects(d2.projects ?? []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const loadProfile = async (id: string) => {
    const res = await fetch(`/api/family-studio?profileId=${id}`);
    const d = await res.json();
    setSelectedProfile(d.profile);
  };

  const create = async () => {
    if (!name.trim() || !overallConsent) {
      toast({ title: "নাম ও consent আবশ্যক", variant: "destructive" });
      return;
    }
    if (personType === "child" && !guardian.trim()) {
      toast({ title: "শিশুর জন্য অভিভাবকের নাম আবশ্যক", variant: "destructive" });
      return;
    }
    setBusy("create");
    try {
      const res = await fetch("/api/family-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create", personName: name, personType,
          guardianName: guardian || null, faceConsent, voiceConsent,
          consentConfirmed: overallConsent,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      toast({ title: "প্রোফাইল তৈরি ✅", description: `${name} — consent confirmed` });
      setShowCreate(false);
      setName(""); setGuardian(""); setFaceConsent(false); setVoiceConsent(false); setOverallConsent(false);
      load();
    } catch (e) {
      toast({ title: "ব্যর্থ", description: String(e), variant: "destructive" });
    } finally { setBusy(null); }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedProfile || !e.target.files?.length) return;
    setBusy("upload");
    try {
      const formData = new FormData();
      formData.append("profileId", selectedProfile.id);
      formData.append("assetType", uploadMeta.assetType);
      formData.append("angleType", uploadMeta.angleType);
      formData.append("context", uploadMeta.context);
      formData.append("expression", uploadMeta.expression);
      formData.append("lighting", uploadMeta.lighting);
      formData.append("clothing", uploadMeta.clothing);
      for (const file of Array.from(e.target.files)) {
        formData.append("files", file);
      }
      const res = await fetch("/api/family-studio", { method: "POST", body: formData });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast({ title: `${d.uploaded} ফাইল আপলোড হয়েছে ✅`, description: `${uploadMeta.assetType} — ${uploadMeta.angleType}` });
      loadProfile(selectedProfile.id);
      load();
    } catch (e) {
      toast({ title: "আপলোড ব্যর্থ", description: String(e), variant: "destructive" });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const approveAsset = async (id: string) => {
    setBusy(`approve-${id}`);
    try {
      await fetch("/api/family-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_asset", id }),
      });
      toast({ title: "অনুমোদিত ✅" });
      if (selectedProfile) loadProfile(selectedProfile.id);
    } finally { setBusy(null); }
  };

  const deleteAsset = async (id: string) => {
    setBusy(`delete-${id}`);
    try {
      await fetch("/api/family-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_asset", id }),
      });
      toast({ title: "অ্যাসেট মুছে ফেলা হয়েছে" });
      if (selectedProfile) loadProfile(selectedProfile.id);
      load();
    } finally { setBusy(null); }
  };

  const revoke = async (id: string) => {
    setBusy(`revoke-${id}`);
    try {
      await fetch("/api/family-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke_consent", id }),
      });
      toast({ title: "Consent বাতিল করা হয়েছে", variant: "destructive" });
      load();
    } finally { setBusy(null); }
  };

  const remove = async (id: string) => {
    setBusy(`delete-profile-${id}`);
    try {
      await fetch("/api/family-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      toast({ title: "প্রোফাইল মুছে ফেলা হয়েছে" });
      load();
    } finally { setBusy(null); }
  };

  const createProject = async () => {
    if (!projectPrompt.trim()) {
      toast({ title: "প্রম্পট দিন", variant: "destructive" });
      return;
    }
    setBusy("project");
    try {
      const res = await fetch("/api/family-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_project",
          prompt: projectPrompt,
          castProfileIds: castIds,
          title: projectPrompt.slice(0, 40),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast({ title: "প্রজেক্ট তৈরি ✅", description: `${castIds.length} cast members` });
      setShowProject(false);
      setProjectPrompt(""); setCastIds([]);
      load();
    } catch (e) {
      toast({ title: "ব্যর্থ", description: String(e), variant: "destructive" });
    } finally { setBusy(null); }
  };

  const startPipeline = async (projectId: string) => {
    setBusy(`pipeline-${projectId}`);
    try {
      const res = await fetch("/api/family-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start_pipeline", projectId }),
      });
      const d = await res.json();
      toast({ title: `${d.stagesCreated}-stage pipeline initialized 🔄`, description: d.message?.slice(0, 60) });
      load();
    } finally { setBusy(null); }
  };

  const fmtSize = (b: number) => b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)}MB` : b >= 1024 ? `${(b / 1024).toFixed(0)}KB` : `${b}B`;

  return (
    <div className="alo-fade-up space-y-5">
      <SectionHeader
        title="Private Family AI Studio"
        bn="প্রাইভেট ফ্যামিলি স্টুডিও"
        desc="পরিবারের পরিচয় প্রোফাইল — আপনি, আপনার স্ত্রী, আপনার সন্তান। সম্পূর্ণ প্রাইভেট, consent-gated। Multi-asset reference library, identity consistency, one-click production pipeline।"
        icon={<Heart className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowProject(true)} className="h-8">
              <Folder className="h-3.5 w-3.5 mr-1.5" /> নতুন প্রজেক্ট
            </Button>
            <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white h-8">
              <Plus className="h-4 w-4 mr-1.5" /> প্রোফাইল
            </Button>
          </div>
        }
      />

      {/* Privacy warning */}
      <Card className="p-4 bg-rose-50 border-rose-200 dark:bg-rose-900/10">
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800 dark:text-rose-200">
            <p className="font-semibold">প্রাইভেসি — পাবলিক অবতার সার্ভিস নয়</p>
            <p className="mt-1">
              শুধুমাত্র অনুমোদিত পরিবারের ব্যক্তিগত ব্যবহারের জন্য। সম্পূর্ণ consent-gated।
              শিশুর জন্য অভিভাবকের অনুমতি বাধ্যতামূলক। Face/voice consistency = BLOCKED_EXTERNAL_SETUP
              (বিশেষায়িত ML মডেল প্রয়োজন)। AI-উৎপাদিত কনটেন্ট প্ল্যাটফর্ম/আইন অনুযায়ী disclosure পেতে পারে।
            </p>
          </div>
        </div>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="profiles" className="text-xs"><Users className="h-3 w-3 mr-1" />Profiles</TabsTrigger>
          <TabsTrigger value="references" className="text-xs"><ImageIcon className="h-3 w-3 mr-1" />References</TabsTrigger>
          <TabsTrigger value="projects" className="text-xs"><Folder className="h-3 w-3 mr-1" />Projects</TabsTrigger>
          <TabsTrigger value="pipeline" className="text-xs"><Play className="h-3 w-3 mr-1" />Pipeline</TabsTrigger>
          <TabsTrigger value="quality" className="text-xs"><ShieldCheck className="h-3 w-3 mr-1" />Quality</TabsTrigger>
        </TabsList>

        {/* PROFILES TAB */}
        <TabsContent value="profiles" className="mt-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-48 rounded-xl alo-shimmer" />)}
            </div>
          ) : profiles.length === 0 ? (
            <Card className="p-12 text-center">
              <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-medium text-sm">কোনো ফ্যামিলি প্রোফাইল নেই</p>
              <p className="text-xs text-muted-foreground mt-1">&quot;প্রোফাইল&quot; চেপে শুরু করুন।</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {profiles.map((p, i) => {
                const ptype = PERSON_TYPES.find((t) => t.id === p.personType);
                return (
                  <Card key={p.id} className="p-4 alo-stagger alo-glow-hover" style={{ animationDelay: `${i * 60}ms` }}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-3xl">{ptype?.icon ?? "👤"}</span>
                        <div>
                          <p className="font-bold text-sm">{p.personName}</p>
                          <p className="text-[10px] text-muted-foreground">{ptype?.label ?? p.personType}</p>
                        </div>
                      </div>
                      <StatusPill status={p.active ? "active" : "blocked"} />
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      <Badge variant="outline" className={`text-[9px] ${p.faceConsent ? "bg-emerald-50 border-emerald-200 text-emerald-700" : ""}`}>
                        <ShieldCheck className="h-2.5 w-2.5 mr-0.5" /> Face {p.faceConsent ? "✓" : "✗"}
                      </Badge>
                      <Badge variant="outline" className={`text-[9px] ${p.voiceConsent ? "bg-emerald-50 border-emerald-200 text-emerald-700" : ""}`}>
                        <Mic className="h-2.5 w-2.5 mr-0.5" /> Voice {p.voiceConsent ? "✓" : "✗"}
                      </Badge>
                      {p.guardianName && (
                        <Badge variant="outline" className="text-[9px] bg-amber-50 border-amber-200 text-amber-700">
                          👨‍👩‍👧 {p.guardianName}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs mb-3">
                      <span className="text-muted-foreground">রেফারেন্স অ্যাসেট</span>
                      <span className="font-bold">{p._count?.referenceAssets ?? 0}</span>
                    </div>
                    {p.active && (
                      <Button size="sm" variant="outline" className="w-full h-7 text-xs mb-2" onClick={() => { loadProfile(p.id); setActiveTab("references"); }}>
                        <ImageIcon className="h-3 w-3 mr-1" /> রেফারেন্স লাইব্রেরি খুলুন
                      </Button>
                    )}
                    <div className="flex gap-1.5">
                      {p.active && (
                        <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1 text-amber-600" onClick={() => revoke(p.id)} disabled={!!busy}>
                          Consent বাতিল
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50" onClick={() => remove(p.id)} disabled={!!busy}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* REFERENCES TAB */}
        <TabsContent value="references" className="mt-4">
          {!selectedProfile ? (
            <Card className="p-12 text-center">
              <ImageIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">একটি প্রোফাইল নির্বাচন করুন রেফারেন্স লাইব্রেরি দেখতে</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Upload panel */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Upload className="h-4 w-4 text-amber-600" /> ব্যাচ আপলোড — {selectedProfile.personName}
                  </h3>
                  <Badge variant="outline" className="text-[9px]">{selectedProfile.referenceAssets?.length ?? 0} অ্যাসেট</Badge>
                </div>
                {/* Metadata selectors */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
                  <Select value={uploadMeta.assetType} onValueChange={(v) => setUploadMeta((m) => ({ ...m, assetType: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="photo">Photo</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="voice">Voice</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={uploadMeta.angleType} onValueChange={(v) => setUploadMeta((m) => ({ ...m, angleType: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{ANGLE_TYPES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={uploadMeta.context} onValueChange={(v) => setUploadMeta((m) => ({ ...m, context: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{CONTEXTS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={uploadMeta.expression} onValueChange={(v) => setUploadMeta((m) => ({ ...m, expression: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{EXPRESSIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={uploadMeta.lighting} onValueChange={(v) => setUploadMeta((m) => ({ ...m, lighting: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{LIGHTINGS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={uploadMeta.clothing} onValueChange={(v) => setUploadMeta((m) => ({ ...m, clothing: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{CLOTHINGS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {/* File input (batch) */}
                <div
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-amber-300 transition-colors"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files) { fileRef.current!.files = e.dataTransfer.files; onFileChange({ target: { files: e.dataTransfer.files } } as any); } }}
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm font-medium">ফাইল টেনে আনুন বা ক্লিক করুন</p>
                  <p className="text-xs text-muted-foreground mt-1">একাধিক ফাইল নির্বাচন করতে পারেন (batch upload)</p>
                  <input ref={fileRef} type="file" multiple className="hidden" onChange={onFileChange} accept="image/*,video/*,audio/*" />
                </div>
                {busy === "upload" && <p className="text-xs text-amber-600 mt-2"><Loader2 className="h-3 w-3 inline mr-1 animate-spin" />আপলোড হচ্ছে…</p>}
              </Card>

              {/* Asset grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {selectedProfile.referenceAssets?.map((a) => (
                  <Card key={a.id} className={`p-2 alo-stagger ${!a.approved ? "opacity-70" : ""}`}>
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="text-[8px] capitalize">{a.assetType}</Badge>
                      {a.approved ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-muted-foreground" />}
                    </div>
                    <div className="aspect-square rounded bg-muted/30 mb-1 flex items-center justify-center">
                      {a.assetType === "photo" && <ImageIcon className="h-6 w-6 text-muted-foreground/40" />}
                      {a.assetType === "video" && <Video className="h-6 w-6 text-muted-foreground/40" />}
                      {a.assetType === "voice" && <Mic className="h-6 w-6 text-muted-foreground/40" />}
                    </div>
                    <p className="text-[8px] truncate">{a.fileName ?? a.filePath.split("/").pop()}</p>
                    <div className="flex items-center justify-between text-[8px] text-muted-foreground mt-0.5">
                      <span>{fmtSize(a.fileSize)}</span>
                      <span>Q:{(a.qualityScore * 100).toFixed(0)}</span>
                    </div>
                    <div className="flex gap-0.5 mt-1">
                      {!a.approved && (
                        <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-emerald-600" onClick={() => approveAsset(a.id)} disabled={busy === `approve-${a.id}`}>
                          <CheckCircle2 className="h-3 w-3" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-rose-600" onClick={() => deleteAsset(a.id)} disabled={busy === `delete-${a.id}`}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </Card>
                ))}
                {(!selectedProfile.referenceAssets || selectedProfile.referenceAssets.length === 0) && (
                  <Card className="col-span-full p-8 text-center text-sm text-muted-foreground">
                    কোনো রেফারেন্স অ্যাসেট নেই। উপরে আপলোড করুন।
                  </Card>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* PROJECTS TAB */}
        <TabsContent value="projects" className="mt-4">
          {projects.length === 0 ? (
            <Card className="p-12 text-center">
              <Folder className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">কোনো প্রজেক্ট নেই। &quot;নতুন প্রজেক্ট&quot; চাপুন।</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => (
                <Card key={p.id} className="p-4 alo-glow-hover">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm">{p.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{p.prompt}</p>
                    </div>
                    <StatusPill status={p.status === "completed" ? "approved" : p.status === "failed" ? "failed" : p.status === "running" ? "running" : "pending"} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground mb-2">
                    <span>👥 {p.profiles.map((pr) => pr.personName).join(", ") || "—"}</span>
                    {p.currentStage && <span>• 🔄 {p.currentStage}</span>}
                    {p.qualityScore > 0 && <span>• ⭐ {p.qualityScore}</span>}
                  </div>
                  <Button size="sm" className="h-7 text-xs bg-amber-500 hover:bg-amber-600" onClick={() => startPipeline(p.id)} disabled={busy === `pipeline-${p.id}`}>
                    {busy === `pipeline-${p.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                    Pipeline শুরু
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* PIPELINE TAB */}
        <TabsContent value="pipeline" className="mt-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Play className="h-4 w-4 text-amber-600" /> ১৮-স্টেজ মিডিয়া পাইপলাইন
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {PIPELINE_STAGES.map((stage, i) => (
                <div key={stage} className="rounded-lg border border-border/60 p-2 text-center alo-stagger" style={{ animationDelay: `${i * 30}ms` }}>
                  <p className="text-[10px] font-bold">{i + 1}</p>
                  <p className="text-[9px] capitalize">{stage.replace(/_/g, " ")}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              Image stage = local/provider (কাজ করে)। Video, voice, lip-sync, upscaling = BLOCKED_EXTERNAL_SETUP
              (বিশেষায়িত মডেল প্রয়োজন)। প্রতিটি স্টেজ quality score + identity score উৎপাদন করে।
              ব্যর্থ হলে retry → ব্যর্থ হলে escalate।
            </p>
          </Card>
        </TabsContent>

        {/* QUALITY TAB */}
        <TabsContent value="quality" className="mt-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-600" /> Quality Judge + Identity Consistency
            </h3>
            <div className="space-y-2">
              {["identity_consistency", "facial_realism", "expression", "eyes", "hands", "body", "lighting", "clothing", "background", "motion", "temporal_consistency", "voice_consistency", "lip_sync", "audio", "story", "composition", "resolution"].map((metric) => (
                <div key={metric} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-xs">
                  <span className="capitalize">{metric.replace(/_/g, " ")}</span>
                  <StatusPill status="blocked_external_setup" />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              সকল quality metrics এর জন্য বিশেষায়িত ML মডেল প্রয়োজন (face comparison, voice matching, etc.)।
              শুধুমাত্র PASS আউটপুট final asset হয়। ব্যর্থ হলে responsible stage-এ ফেরত যায়।
            </p>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create profile dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-600" /> নতুন ফ্যামিলি প্রোফাইল
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">নাম</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">সম্পর্ক</Label>
              <Select value={personType} onValueChange={setPersonType}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PERSON_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.icon} {t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {personType === "child" && (
              <div>
                <Label className="text-xs">অভিভাবকের নাম (বাধ্যতামূলক)</Label>
                <Input value={guardian} onChange={(e) => setGuardian(e.target.value)} className="h-9 mt-1" />
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="face-c" checked={faceConsent} onCheckedChange={(v) => setFaceConsent(v === true)} />
                <Label htmlFor="face-c" className="text-xs cursor-pointer">Face consent</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="voice-c" checked={voiceConsent} onCheckedChange={(v) => setVoiceConsent(v === true)} />
                <Label htmlFor="voice-c" className="text-xs cursor-pointer">Voice consent</Label>
              </div>
            </div>
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3">
              <div className="flex items-start gap-2">
                <Checkbox id="overall-c" checked={overallConsent} onCheckedChange={(v) => setOverallConsent(v === true)} className="mt-0.5" />
                <Label htmlFor="overall-c" className="text-xs text-rose-800 cursor-pointer leading-relaxed">
                  আমি নিশ্চিত করছি যে এই ছবি/ভিডিও/ভয়েস আমার নিজের বা আইনি অনুমতি আছে। শিশুর ক্ষেত্রে আমি অভিভাবক।
                </Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>বাতিল</Button>
            <Button onClick={create} disabled={busy === "create"} className="bg-amber-500 hover:bg-amber-600">
              {busy === "create" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
              তৈরি করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create project dialog */}
      <Dialog open={showProject} onOpenChange={setShowProject}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="h-4 w-4 text-amber-600" /> নতুন ফ্যামিলি প্রজেক্ট
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">প্রম্পট</Label>
              <Input value={projectPrompt} onChange={(e) => setProjectPrompt(e.target.value)} placeholder="যেমন: ৩০ সেকেন্ডের ভিডিও আমি ও আমার স্ত্রী" className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Cast (পরিবারের সদস্য)</Label>
              <div className="space-y-1 mt-1">
                {profiles.filter((p) => p.active).map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`cast-${p.id}`}
                      checked={castIds.includes(p.id)}
                      onCheckedChange={(v) => {
                        if (v) setCastIds((s) => [...s, p.id]);
                        else setCastIds((s) => s.filter((x) => x !== p.id));
                      }}
                    />
                    <Label htmlFor={`cast-${p.id}`} className="text-xs cursor-pointer">
                      {PERSON_TYPES.find((t) => t.id === p.personType)?.icon} {p.personName}
                    </Label>
                  </div>
                ))}
                {profiles.filter((p) => p.active).length === 0 && (
                  <p className="text-xs text-muted-foreground">প্রথমে একটি প্রোফাইল তৈরি করুন।</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProject(false)}>বাতিল</Button>
            <Button onClick={createProject} disabled={busy === "project"} className="bg-amber-500 hover:bg-amber-600">
              {busy === "project" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Folder className="h-4 w-4 mr-1" />}
              প্রজেক্ট তৈরি
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
