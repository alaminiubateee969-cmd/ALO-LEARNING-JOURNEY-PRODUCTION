'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/app-store';
import { useApiQuery, useApiMutation } from '@/hooks/use-api-query';
import { api } from '@/lib/api-client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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
  Plus,
  Pencil,
  Trash2,
  Play,
  Loader2,
  AlertTriangle,
  PhoneCall,
  Bot,
  ShieldAlert,
  RefreshCw,
  Clock,
  Mic,
  Globe,
  Settings2,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

type AgentPurpose = 'inbound_receptionist' | 'outbound_sales' | 'support' | 'survey';
type ApprovalMode = 'suspend' | 'auto_approve' | 'auto_reject';

interface VoiceAgent {
  id: string;
  name: string;
  description: string | null;
  purpose: string;
  language: string;
  voiceId: string | null;
  speakingStyle: string | null;
  systemPrompt: string | null;
  greetingMessage: string | null;
  fallbackResponse: string | null;
  maxCallDurationSec: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  workingDays: number[];
  allowlistedTools: string[];
  approvalMode: ApprovalMode;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface VoiceAgentsResponse {
  agents: VoiceAgent[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const PURPOSE_OPTIONS: { value: AgentPurpose; label: string; desc: string }[] = [
  { value: 'inbound_receptionist', label: 'Inbound Receptionist', desc: 'Greet and route inbound callers' },
  { value: 'outbound_sales', label: 'Outbound Sales', desc: 'Reach out to leads and qualify them' },
  { value: 'support', label: 'Support', desc: 'Answer customer support questions' },
  { value: 'survey', label: 'Survey', desc: 'Run scripted surveys and capture responses' },
];

const LANGUAGE_OPTIONS = [
  { value: 'bn-BD', label: 'Bangla (বাংলা)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'hi-IN', label: 'Hindi (हिन्दी)' },
  { value: 'ur-PK', label: 'Urdu (اردو)' },
];

const VOICE_OPTIONS = [
  { value: 'bn_female_01', label: 'Bangla Female 01' },
  { value: 'bn_male_01', label: 'Bangla Male 01' },
  { value: 'en_female_01', label: 'English Female 01' },
  { value: 'en_male_01', label: 'English Male 01' },
];

const TOOL_OPTIONS = [
  'crm_lookup_lead',
  'crm_create_lead',
  'crm_update_lead',
  'knowledge_base_search',
  'schedule_callback',
  'transfer_to_human',
  'send_sms',
  'send_email',
  'record_call',
  'hangup',
];

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 0]; // Mon=1 ... Sun=0 (JS getDay)

const APPROVAL_OPTIONS: { value: ApprovalMode; label: string }[] = [
  { value: 'suspend', label: 'Suspend (wait for human)' },
  { value: 'auto_approve', label: 'Auto-approve' },
  { value: 'auto_reject', label: 'Auto-reject' },
];

interface FormState {
  name: string;
  description: string;
  purpose: AgentPurpose;
  language: string;
  voiceId: string;
  speakingStyle: string;
  systemPrompt: string;
  greetingMessage: string;
  fallbackResponse: string;
  maxCallDurationSec: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  workingDays: number[];
  allowlistedTools: string[];
  approvalMode: ApprovalMode;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  purpose: 'support',
  language: 'bn-BD',
  voiceId: 'bn_female_01',
  speakingStyle: 'professional',
  systemPrompt: '',
  greetingMessage: '',
  fallbackResponse: '',
  maxCallDurationSec: 300,
  workingHoursStart: '09:00',
  workingHoursEnd: '18:00',
  workingDays: [1, 2, 3, 4, 5],
  allowlistedTools: ['crm_lookup_lead', 'crm_create_lead'],
  approvalMode: 'suspend',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function purposeBadgeClass(p: string): string {
  switch (p) {
    case 'inbound_receptionist':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'outbound_sales':
      return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    case 'support':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'survey':
      return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'draft':
      return 'bg-muted text-muted-foreground border-border';
    case 'archived':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'paused':
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

// ─── Forbidden / Loading / Error components ────────────────────────────────────

function ForbiddenScreen() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
        <ShieldAlert className="w-8 h-8 text-red-500" />
      </div>
      <h2 className="text-xl font-semibold">Forbidden</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-md">
        Only <span className="font-medium text-foreground">Super Admins</span> can manage AI Voice
        Agents. Your current role does not have permission to view this page.
      </p>
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="flex items-center gap-3 py-4">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-destructive">Failed to load voice agents</p>
          <p className="text-xs text-muted-foreground truncate">{message}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
        </Button>
      </CardContent>
    </Card>
  );
}

function VoiceAgentCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48 mt-1" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-12 w-full" />
      </CardContent>
      <CardFooter>
        <Skeleton className="h-8 w-full" />
      </CardFooter>
    </Card>
  );
}

// ─── Voice Agent Card ──────────────────────────────────────────────────────────

interface VoiceAgentCardProps {
  agent: VoiceAgent;
  onEdit: (a: VoiceAgent) => void;
  onDelete: (a: VoiceAgent) => void;
  onTest: (a: VoiceAgent) => void;
  onToggleStatus: (a: VoiceAgent, next: boolean) => void;
}

function VoiceAgentCard({ agent, onEdit, onDelete, onTest, onToggleStatus }: VoiceAgentCardProps) {
  const isActive = agent.status === 'active';

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base flex items-center gap-2 truncate">
              <Bot className="h-4 w-4 text-orange-500 shrink-0" />
              <span className="truncate">{agent.name}</span>
            </CardTitle>
            <CardDescription className="text-xs truncate mt-0.5">
              {agent.description || 'No description'}
            </CardDescription>
          </div>
          <Switch
            checked={isActive}
            onCheckedChange={(v) => onToggleStatus(agent, v)}
            aria-label="Toggle active"
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className={purposeBadgeClass(agent.purpose)}>
            {agent.purpose.replace(/_/g, ' ')}
          </Badge>
          <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
            <Globe className="h-3 w-3 mr-0.5" />
            {agent.language}
          </Badge>
          <Badge variant="outline" className={statusBadgeClass(agent.status)}>
            {agent.status}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Mic className="h-3.5 w-3.5" />
            <span className="truncate">{agent.voiceId || 'default'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span className="truncate">
              {agent.workingHoursStart}–{agent.workingHoursEnd}
            </span>
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Greeting preview
          </p>
          <p className="text-xs line-clamp-2 italic">
            {agent.greetingMessage || '(no greeting configured)'}
          </p>
        </div>

        {agent.allowlistedTools.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              {agent.allowlistedTools.length} tool(s)
            </p>
            <div className="flex flex-wrap gap-1">
              {agent.allowlistedTools.slice(0, 3).map((t) => (
                <Badge key={t} variant="secondary" className="text-[9px] px-1.5 h-4">
                  {t}
                </Badge>
              ))}
              {agent.allowlistedTools.length > 3 && (
                <Badge variant="secondary" className="text-[9px] px-1.5 h-4">
                  +{agent.allowlistedTools.length - 3}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={() => onTest(agent)}>
          <Play className="h-3.5 w-3.5 mr-1" /> Test
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onEdit(agent)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(agent)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </CardFooter>
    </Card>
  );
}

// ─── Create / Edit Dialog ──────────────────────────────────────────────────────

interface AgentDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: VoiceAgent | null;
  onSaved: () => void;
}

function AgentDialog({ open, onOpenChange, initial, onSaved }: AgentDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          name: initial.name,
          description: initial.description || '',
          purpose: (initial.purpose as AgentPurpose) || 'support',
          language: initial.language || 'bn-BD',
          voiceId: initial.voiceId || 'bn_female_01',
          speakingStyle: initial.speakingStyle || 'professional',
          systemPrompt: initial.systemPrompt || '',
          greetingMessage: initial.greetingMessage || '',
          fallbackResponse: initial.fallbackResponse || '',
          maxCallDurationSec: initial.maxCallDurationSec || 300,
          workingHoursStart: initial.workingHoursStart || '09:00',
          workingHoursEnd: initial.workingHoursEnd || '18:00',
          workingDays: Array.isArray(initial.workingDays) ? initial.workingDays : [1, 2, 3, 4, 5],
          allowlistedTools: Array.isArray(initial.allowlistedTools)
            ? initial.allowlistedTools
            : ['crm_lookup_lead', 'crm_create_lead'],
          approvalMode: (initial.approvalMode as ApprovalMode) || 'suspend',
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, initial]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const toggleTool = (tool: string) => {
    setForm((p) => ({
      ...p,
      allowlistedTools: p.allowlistedTools.includes(tool)
        ? p.allowlistedTools.filter((t) => t !== tool)
        : [...p.allowlistedTools, tool],
    }));
  };

  const toggleDay = (day: number) => {
    setForm((p) => ({
      ...p,
      workingDays: p.workingDays.includes(day)
        ? p.workingDays.filter((d) => d !== day)
        : [...p.workingDays, day].sort(),
    }));
  };

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (initial) {
        await api.patch(`/api/v1/voice-agents/${initial.id}`, payload);
        toast.success('Voice agent updated');
      } else {
        await api.post('/api/v1/voice-agents', payload);
        toast.success('Voice agent created');
      }
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, initial, onOpenChange, onSaved]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-orange-500" />
            {initial ? 'Edit Voice Agent' : 'Create Voice Agent'}
          </DialogTitle>
          <DialogDescription>
            Configure an AI voice agent — language defaults to Bangla (bn-BD).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name + description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="va-name">Name *</Label>
              <Input
                id="va-name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Receptionist Bot"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="va-language">Language</Label>
              <Select value={form.language} onValueChange={(v) => set('language', v)}>
                <SelectTrigger id="va-language" className="w-full">
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
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="va-desc">Description</Label>
            <Input
              id="va-desc"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Short summary of what this agent does"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="va-purpose">Purpose</Label>
              <Select value={form.purpose} onValueChange={(v) => set('purpose', v as AgentPurpose)}>
                <SelectTrigger id="va-purpose" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PURPOSE_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex flex-col">
                        <span>{p.label}</span>
                        <span className="text-[10px] text-muted-foreground">{p.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="va-voice">Voice ID</Label>
              <Select value={form.voiceId} onValueChange={(v) => set('voiceId', v)}>
                <SelectTrigger id="va-voice" className="w-full">
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="va-style">Speaking Style</Label>
              <Input
                id="va-style"
                value={form.speakingStyle}
                onChange={(e) => set('speakingStyle', e.target.value)}
                placeholder="professional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="va-maxdur">Max Call (sec)</Label>
              <Input
                id="va-maxdur"
                type="number"
                min={30}
                max={3600}
                value={form.maxCallDurationSec}
                onChange={(e) => set('maxCallDurationSec', Number(e.target.value) || 300)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="va-approval">Approval Mode</Label>
              <Select
                value={form.approvalMode}
                onValueChange={(v) => set('approvalMode', v as ApprovalMode)}
              >
                <SelectTrigger id="va-approval" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPROVAL_OPTIONS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />
          <p className="text-xs font-medium text-muted-foreground">Working Hours & Days</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="va-start">Start</Label>
              <Input
                id="va-start"
                type="time"
                value={form.workingHoursStart}
                onChange={(e) => set('workingHoursStart', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="va-end">End</Label>
              <Input
                id="va-end"
                type="time"
                value={form.workingHoursEnd}
                onChange={(e) => set('workingHoursEnd', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Working Days</Label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_LABELS.map((label, idx) => {
                const value = WEEKDAY_VALUES[idx];
                const checked = form.workingDays.includes(value);
                return (
                  <label
                    key={label}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border cursor-pointer text-xs transition-colors ${
                      checked
                        ? 'bg-orange-500/10 border-orange-500/40 text-orange-600'
                        : 'border-border text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggleDay(value)} />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>

          <Separator />
          <p className="text-xs font-medium text-muted-foreground">Conversation Config</p>

          <div className="space-y-1.5">
            <Label htmlFor="va-prompt">System Prompt</Label>
            <Textarea
              id="va-prompt"
              rows={4}
              value={form.systemPrompt}
              onChange={(e) => set('systemPrompt', e.target.value)}
              placeholder="You are a polite receptionist for [company]. Route calls to support if user mentions technical issues."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="va-greeting">Greeting Message</Label>
            <Textarea
              id="va-greeting"
              rows={2}
              value={form.greetingMessage}
              onChange={(e) => set('greetingMessage', e.target.value)}
              placeholder="আসসালামু আলাইকুম, [company]-এ স্বাগতম। কীভাবে সাহায্য করতে পারি?"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="va-fallback">Fallback Response</Label>
            <Textarea
              id="va-fallback"
              rows={2}
              value={form.fallbackResponse}
              onChange={(e) => set('fallbackResponse', e.target.value)}
              placeholder="দুঃখিত, আমি সেটা বুঝতে পারিনি। আপনি কি অপারেটরের সাথে কথা বলতে চান?"
            />
          </div>

          <Separator />
          <p className="text-xs font-medium text-muted-foreground">Allowlisted Tools</p>
          <div className="flex flex-wrap gap-1.5">
            {TOOL_OPTIONS.map((t) => {
              const checked = form.allowlistedTools.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTool(t)}
                  className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${
                    checked
                      ? 'bg-orange-500/15 border-orange-500/40 text-orange-600'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {t}
                </button>
              );
            })}
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
              <Settings2 className="h-4 w-4 mr-1" />
            )}
            {initial ? 'Save Changes' : 'Create Agent'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete confirm dialog ─────────────────────────────────────────────────────

function DeleteDialog({
  agent,
  open,
  onOpenChange,
  onDeleted,
}: {
  agent: VoiceAgent | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!agent) return;
    setDeleting(true);
    try {
      await api.del(`/api/v1/voice-agents/${agent.id}`);
      toast.success('Voice agent deleted');
      onOpenChange(false);
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }, [agent, onOpenChange, onDeleted]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Voice Agent
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <span className="font-medium text-foreground">{agent?.name}</span>?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main View ─────────────────────────────────────────────────────────────────

export function VoiceAgentsView() {
  const { user } = useAppStore();
  const isSuperAdmin = user?.role === 'super_admin';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<VoiceAgent | null>(null);
  const [deleteAgent, setDeleteAgent] = useState<VoiceAgent | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, isLoading, error, refetch } = useApiQuery<VoiceAgentsResponse>('/api/v1/voice-agents');

  const agents = data?.agents || [];

  const openCreate = () => {
    setEditingAgent(null);
    setDialogOpen(true);
  };

  const openEdit = (a: VoiceAgent) => {
    setEditingAgent(a);
    setDialogOpen(true);
  };

  const openDelete = (a: VoiceAgent) => {
    setDeleteAgent(a);
    setDeleteOpen(true);
  };

  const handleTest = useCallback((a: VoiceAgent) => {
    toast.info(`Test call simulation started for "${a.name}" (bn-BD voice)`, {
      description: a.greetingMessage || 'Greeting not set — using default',
    });
  }, []);

  const toggleStatusMutation = useApiMutation<Partial<VoiceAgent>, VoiceAgent>({
    method: 'PATCH',
    onSuccess: () => {
      refetch();
      toast.success('Status updated');
    },
    onError: (e) => toast.error(e),
  });

  const handleToggleStatus = useCallback(
    (a: VoiceAgent, next: boolean) => {
      toggleStatusMutation.mutate(
        { status: next ? 'active' : 'paused' },
        `/api/v1/voice-agents/${a.id}`,
      );
    },
    [toggleStatusMutation],
  );

  if (!isSuperAdmin) {
    return <ForbiddenScreen />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <PhoneCall className="h-6 w-6 text-orange-500" />
            AI Voice Agents
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build, configure, and deploy AI voice agents for your contact center.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="h-4 w-4 mr-1" /> Create Agent
        </Button>
      </div>

      {/* Error banner */}
      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {/* Loading skeleton */}
      {isLoading && !data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <VoiceAgentCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && agents.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mb-4">
              <Bot className="h-7 w-7 text-orange-500" />
            </div>
            <p className="text-base font-medium">No voice agents yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Create your first AI receptionist to start handling calls automatically.
            </p>
            <Button
              onClick={openCreate}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Plus className="h-4 w-4 mr-1" /> Create your first agent
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Grid of voice agents */}
      {!isLoading && agents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <VoiceAgentCard
              key={agent.id}
              agent={agent}
              onEdit={openEdit}
              onDelete={openDelete}
              onTest={handleTest}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <AgentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editingAgent}
        onSaved={refetch}
      />

      {/* Delete dialog */}
      <DeleteDialog
        agent={deleteAgent}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={refetch}
      />
    </div>
  );
}

export default VoiceAgentsView;
