'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useApiQuery, useApiMutation } from '@/hooks/use-api-query';
import { api } from '@/lib/api-client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Mic,
  Volume2,
  AudioWaveform,
  Upload,
  Link2,
  Play,
  Download,
  Loader2,
  AlertTriangle,
  Sparkles,
  Plus,
  UserCheck,
  ShieldCheck,
  Ban,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Headphones,
  FileAudio,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TtsResult {
  audioUrl: string | null;
  durationSec: number | null;
  provider: string;
  modelId: string;
  simulated: boolean;
  warning?: string | null;
  charactersProcessed: number;
}

interface AsrSegment {
  start: number;
  end: number;
  speaker?: string | null;
  text: string;
}

interface AsrResult {
  transcript: string;
  segments: AsrSegment[];
  language: string;
  provider: string;
  simulated: boolean;
  warning?: string | null;
  durationSec?: number | null;
}

interface VoiceCloneAuthorization {
  id: string;
  ownerName: string;
  ownerEmail: string | null;
  consentScope: string;
  consentFormUrl: string;
  identityVerified: boolean;
  revokedAt: string | null;
  revocationReason?: string | null;
  expiresAt: string | null;
  createdAt: string;
  _count?: { usageLogs?: number };
}

interface VoiceCloneAuthorizationsResponse {
  authorizations: VoiceCloneAuthorization[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const LANGUAGE_OPTIONS = [
  { value: 'bn-BD', label: 'Bangla (বাংলা)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'ur-PK', label: 'Urdu' },
];

const VOICE_OPTIONS = [
  { value: 'bn_female_01', label: 'Bangla Female 01' },
  { value: 'bn_male_01', label: 'Bangla Male 01' },
  { value: 'en_female_01', label: 'English Female 01' },
  { value: 'en_male_01', label: 'English Male 01' },
];

// ─── TTS Tab ───────────────────────────────────────────────────────────────────

function TtsTab() {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('bn-BD');
  const [voiceId, setVoiceId] = useState('bn_female_01');
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [result, setResult] = useState<TtsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!text.trim()) {
      toast.error('Text is required');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const r = await api.post<TtsResult>('/api/v1/tts', {
        text,
        language,
        voiceId,
        speed,
        pitch,
        outputFormat: 'mp3',
      });
      setResult(r);
      if (r.simulated) {
        toast.warning('TTS provider simulated — see warning below');
      } else {
        toast.success('Audio generated');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'TTS failed');
    } finally {
      setLoading(false);
    }
  }, [text, language, voiceId, speed, pitch]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Volume2 className="h-4 w-4 text-orange-500" /> Input
          </CardTitle>
          <CardDescription className="text-xs">
            Generate natural-sounding speech from text. Default voice: Bangla Female.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tts-text">Text *</Label>
            <Textarea
              id="tts-text"
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="আসসালামু আলাইকুম, [company]-এ স্বাগতম। কীভাবে সাহায্য করতে পারি?"
              maxLength={5000}
            />
            <p className="text-[11px] text-muted-foreground text-right">
              {text.length}/5000
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tts-lang">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="tts-lang" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tts-voice">Voice</Label>
              <Select value={voiceId} onValueChange={setVoiceId}>
                <SelectTrigger id="tts-voice" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VOICE_OPTIONS.map((v) => (
                    <SelectItem key={v.value} value={v.value}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="tts-speed">Speed</Label>
              <span className="text-xs font-mono text-muted-foreground">{speed.toFixed(1)}x</span>
            </div>
            <Slider
              id="tts-speed"
              min={0.5}
              max={2.0}
              step={0.1}
              value={[speed]}
              onValueChange={(v) => setSpeed(v[0])}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="tts-pitch">Pitch</Label>
              <span className="text-xs font-mono text-muted-foreground">{pitch.toFixed(1)}</span>
            </div>
            <Slider
              id="tts-pitch"
              min={0.5}
              max={2.0}
              step={0.1}
              value={[pitch]}
              onValueChange={(v) => setPitch(v[0])}
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={loading || !text.trim()}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            Generate Audio
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AudioWaveform className="h-4 w-4 text-blue-500" /> Output
          </CardTitle>
          <CardDescription className="text-xs">
            Generated audio playback and download link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          )}

          {!loading && !result && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Headphones className="h-10 w-10 mb-2 text-muted-foreground/30" />
              <p className="text-sm">No audio generated yet.</p>
              <p className="text-xs">Fill in text and click Generate.</p>
            </div>
          )}

          {!loading && result && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                  Provider: {result.provider}
                </Badge>
                <Badge variant="outline">
                  {result.charactersProcessed} chars
                </Badge>
                {result.durationSec != null && (
                  <Badge variant="outline">
                    {result.durationSec.toFixed(1)}s
                  </Badge>
                )}
                {result.simulated ? (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                    Simulated
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3 mr-0.5" /> Real
                  </Badge>
                )}
              </div>

              {result.simulated && result.warning && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {result.warning}
                  </p>
                </div>
              )}

              {result.audioUrl ? (
                <>
                  <audio controls src={result.audioUrl} className="w-full" />
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <a href={result.audioUrl} download>
                      <Download className="h-3.5 w-3.5 mr-1" /> Download Audio
                    </a>
                  </Button>
                </>
              ) : (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                  No audio URL returned (provider may have failed).
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── ASR Tab ───────────────────────────────────────────────────────────────────

function AsrTab() {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [audioUrl, setAudioUrl] = useState('');
  const [language, setLanguage] = useState('bn-BD');
  const [enableDiarization, setEnableDiarization] = useState(false);
  const [result, setResult] = useState<AsrResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File too large (max 25MB)');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      const r = reader.result as string;
      // Strip data URL prefix
      const base64Data = r.includes(',') ? r.split(',')[1] : r;
      setBase64(base64Data);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleTranscribe = useCallback(async () => {
    if (mode === 'upload' && !base64) {
      toast.error('Upload an audio file first');
      return;
    }
    if (mode === 'url' && !audioUrl.trim()) {
      toast.error('Paste an audio URL first');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const payload: Record<string, unknown> = {
        language,
        enableDiarization,
      };
      if (mode === 'upload') {
        payload.audioBase64 = base64;
      } else {
        payload.audioUrl = audioUrl;
      }
      const r = await api.post<AsrResult>('/api/v1/asr', payload);
      setResult(r);
      if (r.simulated) {
        toast.warning('ASR provider simulated — see warning');
      } else {
        toast.success('Transcription complete');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ASR failed');
    } finally {
      setLoading(false);
    }
  }, [mode, base64, audioUrl, language, enableDiarization]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mic className="h-4 w-4 text-blue-500" /> Input
          </CardTitle>
          <CardDescription className="text-xs">
            Upload an audio file or paste a URL, then transcribe to text.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === 'upload' ? 'default' : 'outline'}
              onClick={() => setMode('upload')}
            >
              <Upload className="h-3.5 w-3.5 mr-1" /> Upload
            </Button>
            <Button
              size="sm"
              variant={mode === 'url' ? 'default' : 'outline'}
              onClick={() => setMode('url')}
            >
              <Link2 className="h-3.5 w-3.5 mr-1" /> URL
            </Button>
          </div>

          {mode === 'upload' ? (
            <div className="space-y-1.5">
              <Label>Audio File</Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:border-orange-500/50 hover:bg-orange-500/5 transition-colors"
              >
                <FileAudio className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-xs font-medium">
                  {fileName ? fileName : 'Click to choose file'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">MP3 / WAV / M4A · max 25MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              {fileName && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted-foreground"
                  onClick={() => {
                    setFileName(null);
                    setBase64(null);
                  }}
                >
                  Remove file
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="asr-url">Audio URL</Label>
              <Input
                id="asr-url"
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                placeholder="https://example.com/audio.mp3"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="asr-lang">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="asr-lang" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex flex-col justify-end">
              <div className="flex items-center gap-2 space-y-0 pb-2">
                <Switch
                  id="asr-diar"
                  checked={enableDiarization}
                  onCheckedChange={setEnableDiarization}
                />
                <Label htmlFor="asr-diar" className="text-xs cursor-pointer">
                  Enable diarization
                  <span className="block text-[10px] text-muted-foreground">
                    Separate speakers
                  </span>
                </Label>
              </div>
            </div>
          </div>

          <Button
            onClick={handleTranscribe}
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Mic className="h-4 w-4 mr-1" />
            )}
            Transcribe
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AudioWaveform className="h-4 w-4 text-orange-500" /> Transcript
          </CardTitle>
          <CardDescription className="text-xs">
            Transcription with optional speaker labels and timestamps.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {!loading && !result && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Mic className="h-10 w-10 mb-2 text-muted-foreground/30" />
              <p className="text-sm">No transcription yet.</p>
              <p className="text-xs">Upload audio and click Transcribe.</p>
            </div>
          )}

          {!loading && result && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                  Provider: {result.provider}
                </Badge>
                <Badge variant="outline">{result.language}</Badge>
                {result.simulated ? (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                    Simulated
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    Real
                  </Badge>
                )}
              </div>

              {result.simulated && result.warning && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">{result.warning}</p>
                </div>
              )}

              {result.segments && result.segments.length > 0 && enableDiarization ? (
                <div className="space-y-2 max-h-[420px] overflow-y-auto">
                  {result.segments.map((seg, i) => (
                    <div key={i} className="rounded-md border p-2.5 text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        {seg.speaker ? (
                          <Badge variant="secondary" className="text-[10px] h-4">
                            {seg.speaker}
                          </Badge>
                        ) : null}
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {seg.start.toFixed(1)}s → {seg.end.toFixed(1)}s
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed">{seg.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.transcript}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Voice Clone Tab ───────────────────────────────────────────────────────────

interface NewAuthDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

function NewAuthDialog({ open, onOpenChange, onCreated }: NewAuthDialogProps) {
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [consentFormUrl, setConsentFormUrl] = useState('');
  const [consentScope, setConsentScope] = useState('ivr_prompts');
  const [identityVerified, setIdentityVerified] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!ownerName.trim() || !consentFormUrl.trim() || !consentScope.trim()) {
      toast.error('Owner name, consent form URL, and scope are required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/v1/voice-clone-authorizations', {
        ownerName,
        ownerEmail,
        consentFormUrl,
        consentScope,
        identityVerified,
      });
      toast.success('Voice clone authorization created');
      setOwnerName('');
      setOwnerEmail('');
      setConsentFormUrl('');
      setConsentScope('ivr_prompts');
      setIdentityVerified(false);
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }, [ownerName, ownerEmail, consentFormUrl, consentScope, identityVerified, onOpenChange, onCreated]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-orange-500" />
            New Voice Clone Authorization
          </DialogTitle>
          <DialogDescription>
            Per compliance §3 Module C, voice cloning requires explicit verifiable consent.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="vc-name">Owner Name *</Label>
            <Input
              id="vc-name"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="John Doe"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vc-email">Owner Email</Label>
            <Input
              id="vc-email"
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="john@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vc-consent-url">Consent Form URL *</Label>
            <Input
              id="vc-consent-url"
              value={consentFormUrl}
              onChange={(e) => setConsentFormUrl(e.target.value)}
              placeholder="https://cdn.example.com/consent-signed.pdf"
            />
            <p className="text-[11px] text-muted-foreground">
              Must be a signed PDF documenting consent.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vc-scope">Consent Scope</Label>
            <Select value={consentScope} onValueChange={setConsentScope}>
              <SelectTrigger id="vc-scope" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ivr_prompts">IVR prompts</SelectItem>
                <SelectItem value="marketing_announcements">Marketing announcements</SelectItem>
                <SelectItem value="personal_assistant">Personal assistant</SelectItem>
                <SelectItem value="audiobook">Audiobook narration</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 space-y-0">
            <Switch
              id="vc-verified"
              checked={identityVerified}
              onCheckedChange={setIdentityVerified}
            />
            <Label htmlFor="vc-verified" className="text-sm cursor-pointer">
              Identity verified (KYC)
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4 mr-1" />
            )}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AuthCardProps {
  auth: VoiceCloneAuthorization;
  onRevoked: () => void;
}

function AuthCard({ auth, onRevoked }: AuthCardProps) {
  const [synthesizeText, setSynthesizeText] = useState('');
  const [synthLoading, setSynthLoading] = useState(false);
  const [synthResult, setSynthResult] = useState<{ url: string | null; simulated: boolean; error?: string } | null>(null);
  const [revoking, setRevoking] = useState(false);

  const isRevoked = !!auth.revokedAt;
  const isExpired = auth.expiresAt ? new Date(auth.expiresAt).getTime() < Date.now() : false;
  const active = !isRevoked && !isExpired;

  const handleSynth = useCallback(async () => {
    if (!synthesizeText.trim()) {
      toast.error('Text is required');
      return;
    }
    setSynthLoading(true);
    setSynthResult(null);
    try {
      const r = await api.post<{
        audio: { url: string | null };
        provider: { simulated: boolean; error?: string };
      }>(`/api/v1/voice-clone-authorizations/${auth.id}/synthesize`, {
        text: synthesizeText,
      });
      setSynthResult({
        url: r.audio.url,
        simulated: r.provider.simulated,
        error: r.provider.error,
      });
      if (r.provider.simulated) {
        toast.warning('Voice clone simulated — see warning');
      } else {
        toast.success('Synthesized with cloned voice');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Synthesis failed');
    } finally {
      setSynthLoading(false);
    }
  }, [synthesizeText, auth.id]);

  const handleRevoke = useCallback(async () => {
    const reason = window.prompt('Reason for revocation (required):');
    if (!reason) return;
    setRevoking(true);
    try {
      await api.post(`/api/v1/voice-clone-authorizations/${auth.id}/revoke`, { reason });
      toast.success('Voice clone authorization revoked');
      onRevoked();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Revoke failed');
    } finally {
      setRevoking(false);
    }
  }, [auth.id, onRevoked]);

  return (
    <Card className={isRevoked ? 'opacity-60' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-orange-500 shrink-0" />
              <span className="truncate">{auth.ownerName}</span>
            </CardTitle>
            <CardDescription className="text-xs truncate">
              {auth.ownerEmail || 'No email on file'}
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={
              isRevoked
                ? 'bg-red-500/10 text-red-600 border-red-500/20'
                : isExpired
                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
            }
          >
            {isRevoked ? 'Revoked' : isExpired ? 'Expired' : 'Active'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Scope</p>
            <p className="font-medium">{auth.consentScope}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Identity Verified</p>
            <p className="font-medium flex items-center gap-1">
              {auth.identityVerified ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Yes
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 text-amber-500" /> No
                </>
              )}
            </p>
          </div>
        </div>

        {active && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <Label htmlFor={`synth-${auth.id}`}>Synthesize with this voice</Label>
              <Textarea
                id={`synth-${auth.id}`}
                rows={2}
                value={synthesizeText}
                onChange={(e) => setSynthesizeText(e.target.value)}
                placeholder="Type text to speak with this cloned voice…"
                className="text-sm"
              />
              <Button
                size="sm"
                onClick={handleSynth}
                disabled={synthLoading || !synthesizeText.trim()}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                {synthLoading ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                )}
                Synthesize
              </Button>
            </div>

            {synthResult && (
              <div className="rounded-md border p-2 space-y-2">
                {synthResult.simulated && (
                  <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Simulated provider
                  </div>
                )}
                {synthResult.url ? (
                  <audio controls src={synthResult.url} className="w-full h-8" />
                ) : (
                  <p className="text-xs text-destructive">
                    {synthResult.error || 'No audio URL returned.'}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <Separator />
        <Button
          size="sm"
          variant="outline"
          onClick={handleRevoke}
          disabled={revoking || isRevoked}
          className="w-full text-red-600 hover:text-red-700 hover:bg-red-500/5"
        >
          {revoking ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <Ban className="h-3.5 w-3.5 mr-1" />
          )}
          Revoke Authorization
        </Button>
      </CardContent>
    </Card>
  );
}

function VoiceCloneTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading, error, refetch } = useApiQuery<VoiceCloneAuthorizationsResponse>(
    '/api/v1/voice-clone-authorizations',
  );
  const authorizations = data?.authorizations || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-orange-500" />
            <span className="font-medium">Voice Clone Authorizations</span>
            <Badge variant="secondary" className="text-[10px]">{authorizations.length}</Badge>
          </div>
          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> New Authorization
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">Failed to load authorizations</p>
              <p className="text-xs text-muted-foreground truncate">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={refetch}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && !data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-40 mt-1" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && !error && authorizations.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ShieldCheck className="h-10 w-10 text-muted-foreground/30 mb-2" />
            <p className="text-sm font-medium">No voice clone authorizations yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Capture explicit consent from a voice owner before cloning.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && authorizations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {authorizations.map((auth) => (
            <AuthCard key={auth.id} auth={auth} onRevoked={refetch} />
          ))}
        </div>
      )}

      <NewAuthDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={refetch} />
    </div>
  );
}

// ─── Main View ─────────────────────────────────────────────────────────────────

export function VoiceStudioView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-orange-500" />
          AI Voice Studio
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Text-to-speech, speech-to-text, and voice cloning — all in one studio.
        </p>
      </div>

      <Tabs defaultValue="tts">
        <TabsList>
          <TabsTrigger value="tts">
            <Volume2 className="h-3.5 w-3.5 mr-1" />
            Text-to-Speech
          </TabsTrigger>
          <TabsTrigger value="asr">
            <Mic className="h-3.5 w-3.5 mr-1" />
            Speech-to-Text
          </TabsTrigger>
          <TabsTrigger value="clone">
            <UserCheck className="h-3.5 w-3.5 mr-1" />
            Voice Clone
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tts" className="mt-4">
          <TtsTab />
        </TabsContent>
        <TabsContent value="asr" className="mt-4">
          <AsrTab />
        </TabsContent>
        <TabsContent value="clone" className="mt-4">
          <VoiceCloneTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default VoiceStudioView;
