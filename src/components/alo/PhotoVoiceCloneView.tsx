"use client";
import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, Mic, Image as ImageIcon, ShieldCheck, Loader2, Play, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * Phase 1: Photo + Voice Sample Upload → FamilyProfile with consent
 * - Photo: image/*, max 10MB, stored as FamilyReferenceAsset (photo, front)
 * - Voice: audio/* or mic recording, max 60s, stored as voice asset
 * - Consent: required, plus guardianName if child
 * - After upload, admin can immediately create FamilyProject from script idea
 */
export default function PhotoVoiceCloneView() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"me" | "wife" | "child">("me");
  const [personName, setPersonName] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [consent, setConsent] = useState(false);
  const [scriptIdea, setScriptIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast({ title: "Only image files", variant: "destructive" }); return; }
    if (f.size > 10 * 1024 * 1024) { toast({ title: "Photo ≤10MB", variant: "destructive" }); return; }
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const onVoiceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("audio/")) { toast({ title: "Only audio files", variant: "destructive" }); return; }
    if (f.size > 20 * 1024 * 1024) { toast({ title: "Voice ≤20MB (~60s)", variant: "destructive" }); return; }
    setVoiceFile(f);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg" });
      const chunks: BlobPart[] = [];
      rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: rec.mimeType });
        const f = new File([blob], `voice-sample-${Date.now()}.webm`, { type: blob.type });
        setVoiceFile(f);
        stream.getTracks().forEach(t => t.stop());
        toast({ title: "Voice captured ✅", description: `${(blob.size/1024).toFixed(0)}KB — will be cloned with consent` });
      };
      rec.start();
      mediaRecorderRef.current = rec;
      setIsRecording(true);
      toast({ title: "Recording…", description: "Speak clearly 20–40s, then Stop" });
    } catch {
      toast({ title: "Mic permission denied", variant: "destructive" });
    }
  };
  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const submit = async () => {
    if (!personName.trim()) { toast({ title: "Person name required", variant: "destructive" }); return; }
    if (mode === "child" && !guardianName.trim()) { toast({ title: "Guardian name required for child", variant: "destructive" }); return; }
    if (!photoFile) { toast({ title: "Photo required", variant: "destructive" }); return; }
    if (!voiceFile) { toast({ title: "Voice sample required (file or mic)", variant: "destructive" }); return; }
    if (!consent) { toast({ title: "Consent required", description: "You must confirm you have permission to clone this likeness/voice", variant: "destructive" }); return; }

    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("personName", personName);
      fd.set("personType", mode);
      if (guardianName) fd.set("guardianName", guardianName);
      fd.set("consentConfirmed", "true");
      fd.set("faceConsent", "true");
      fd.set("voiceConsent", "true");
      fd.set("scriptIdea", scriptIdea);
      fd.set("photo", photoFile);
      fd.set("voiceSample", voiceFile);

      const res = await fetch("/api/family/clone", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || `Clone failed (${res.status})`);
      setResult(data);
      toast({ title: "Clone assets saved ✅", description: `FamilyProfile ${data.profile?.personName || personName} + ${data.assets?.length || 2} assets → ready for video` });
    } catch (e) {
      toast({ title: "Clone failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 alo-glow-hover border-amber-200">
        <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-600" /> Photo + Voice → Same-Person Video (consent required)</h3>
        <p className="text-xs text-muted-foreground mt-1">Upload a person’s photo + voice sample → system creates that same face/voice across all scenes. Script idea → SEO → social auto-post is then available. Child requires guardian. All clones are stored as <code>FamilyProfile</code> + <code>FamilyReferenceAsset</code> for reuse.</p>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Person type *</Label>
            <select value={mode} onChange={e => setMode(e.target.value as any)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm mt-1">
              <option value="me">me (self)</option>
              <option value="wife">wife/partner</option>
              <option value="child">child (needs guardian)</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Person name *</Label>
            <Input value={personName} onChange={e => setPersonName(e.target.value)} placeholder="e.g. Farzana / Rahim" className="h-9 mt-1" />
          </div>
          {mode === "child" ? (
            <div>
              <Label className="text-xs">Guardian name *</Label>
              <Input value={guardianName} onChange={e => setGuardianName(e.target.value)} placeholder="Parent/guardian full name" className="h-9 mt-1" />
            </div>
          ) : <div className="flex items-end"><Badge variant="outline" className="text-[10px]">consentConfirmed will be logged</Badge></div>}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Photo (image/*, ≤10MB) *</Label>
            <Input type="file" accept="image/*" onChange={onPhotoChange} className="h-9 mt-1" />
            {photoPreview && <img src={photoPreview} alt="preview" className="mt-2 h-40 w-full object-cover rounded-lg border" />}
            <p className="text-[11px] text-muted-foreground mt-1">Clear front face, good light. Stored to <code>storage/uploads/family</code> + faceDescription derived for ComfyUI LTX image-to-video.</p>
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1"><Mic className="h-3 w-3" /> Voice sample (audio/*, ≤20MB or mic 20–40s) *</Label>
            <Input type="file" accept="audio/*" onChange={onVoiceChange} className="h-9 mt-1" />
            <div className="mt-2 flex gap-2">
              {!isRecording ? <Button size="sm" variant="outline" onClick={startRecording}><Mic className="h-3 w-3 mr-1" /> Record</Button> : <Button size="sm" variant="destructive" onClick={stopRecording}><span className="h-2 w-2 bg-white rounded-full animate-pulse mr-1" /> Stop</Button>}
              {voiceFile && <span className="text-xs text-muted-foreground self-center truncate">{voiceFile.name} — {(voiceFile.size/1024).toFixed(0)}KB · {voiceFile.type}</span>}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Speak naturally, no background music. Stored as <code>FamilyReferenceAsset</code> voice. XTTS/Piper clone adapter uses this as reference (consent-gated).</p>
          </div>
        </div>

        <div>
          <Label className="text-xs">Script idea (optional — auto-create FamilyProject + SEO + publish queue)</Label>
          <Textarea value={scriptIdea} onChange={e => setScriptIdea(e.target.value)} rows={3} placeholder="e.g. শিশুর রাতে ভালো ঘুমের ৩টি কৌশল — calm, for parents, Bengali..." className="mt-1 text-sm" />
        </div>

        <label className="flex gap-2 items-start p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200">
          <Checkbox checked={consent} onCheckedChange={v => setConsent(v === true)} className="mt-0.5" />
          <span className="text-xs leading-relaxed">
            <strong>আমি নিশ্চিত করছি</strong> — এই ব্যক্তির (বা শিশুর অভিভাবকের) লিখিত সম্মতি আমার কাছে আছে এবং এই ছবি/কণ্ঠ ব্যবহার করে ভিডিও তৈরি করার অনুমতি আছে। সম্মতি ছাড়া ক্লোন নিষিদ্ধ। I confirm written consent for this likeness/voice. <ShieldCheck className="inline h-3 w-3 text-emerald-600 ml-1" />
          </span>
        </label>

        <Button onClick={submit} disabled={busy} className="w-full bg-amber-500 hover:bg-amber-600 h-10">
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          {busy ? "Uploading & saving…" : "Create cloned profile → Video + SEO + Queue"}
        </Button>

        {result && (
          <Card className="p-3 bg-emerald-50 border-emerald-200 text-xs">
            <p className="font-semibold text-emerald-700">✅ Saved</p>
            <pre className="mt-1 whitespace-pre-wrap text-emerald-800/80">{JSON.stringify(result, null, 2).slice(0, 2000)}</pre>
            <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => window.location.hash = "#family-studio"}><Play className="h-3 w-3 mr-1" /> Go to Family Studio → generate video</Button>
          </Card>
        )}
      </Card>

      <Card className="p-4 bg-zinc-50 dark:bg-zinc-900/50 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">What happens next (SEO → auto-post pipeline already exists):</p>
        <ol className="list-decimal pl-5 mt-1 space-y-0.5">
          <li>Saved to <code>FamilyProfile</code> + 2× <code>FamilyReferenceAsset</code> (photo front + voice). Reusable — same face/voice shared in every future video.</li>
          <li>If you gave a script idea, a <code>FamilyProject</code> is created (status draft) → you can open <code>Family Studio → Your Projects → Generate</code> → it calls <code>POST /api/avatar-video</code> (LTX-2/ComfyUI worker when configured, local fallback otherwise) → same-person video.</li>
          <li>SEO: <code>POST /api/content/brief</code> → keywords/hashtags/cta → auto-fills <code>MarketingKit</code> fields.</li>
          <li>Publish queue: <code>PublishedPost</code> created as <code>scheduled</code> → <code>PublishingQueueView</code> + <code>CalendarView</code> → Buffer-style scheduler publishes to FB/IG/YouTube/TikTok when tokens connected.</li>
        </ol>
      </Card>
    </div>
  );
}
