'use client';

import React, { useState, useCallback, useMemo } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import {
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Phone,
  Play,
  Pause,
  PhoneOff,
  Forward,
  Eye,
  Loader2,
  AlertTriangle,
  Plus,
  Filter,
  RefreshCw,
  Mic,
  Clock,
  User,
  ArrowRight,
  Disc3 as RecordingIcon,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

type CallDirection = 'inbound' | 'outbound';
type CallStatus = 'ringing' | 'active' | 'hold' | 'closed' | 'failed' | 'transfer' | 'queued';

interface CallEvent {
  id: string;
  type: string;
  timestamp: string;
  description: string | null;
  metadata: unknown;
}

interface Call {
  id: string;
  direction: CallDirection;
  status: CallStatus;
  from: string;
  to: string;
  fromName?: string | null;
  toName?: string | null;
  agentId?: string | null;
  humanAgentId?: string | null;
  durationSec: number;
  startedAt: string;
  endedAt: string | null;
  recordingUrl: string | null;
  hasRecording: boolean;
  transcript?: string | null;
  summary?: string | null;
  events?: CallEvent[];
  eventCount?: number;
  createdAt: string;
}

interface CallsResponse {
  calls: Call[];
}

interface CallDetail extends Call {
  events: CallEvent[];
  transcript: string | null;
  summary: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function statusBadgeClass(status: CallStatus): string {
  switch (status) {
    case 'ringing':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'active':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'hold':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'closed':
      return 'bg-muted text-muted-foreground border-border';
    case 'failed':
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    case 'transfer':
      return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function formatDuration(sec: number): string {
  if (!sec || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function DirectionIcon({ direction }: { direction: CallDirection }) {
  if (direction === 'inbound') return <PhoneIncoming className="h-3.5 w-3.5 text-blue-500" />;
  return <PhoneOutgoing className="h-3.5 w-3.5 text-orange-500" />;
}

// ─── Stats banner ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="py-4 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}>
          {icon}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold leading-none mt-0.5">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Originate Dialog ──────────────────────────────────────────────────────────

interface OriginateDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOriginated: () => void;
}

function OriginateDialog({ open, onOpenChange, onOriginated }: OriginateDialogProps) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [agentId, setAgentId] = useState('');
  const [direction, setDirection] = useState<CallDirection>('outbound');
  const [saving, setSaving] = useState(false);

  const handleOriginate = useCallback(async () => {
    if (!from.trim() || !to.trim()) {
      toast.error('from and to are required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/v1/calls/originate', {
        from,
        to,
        agentId: agentId || undefined,
        direction,
      });
      toast.success('Call originated');
      setFrom('');
      setTo('');
      setAgentId('');
      setDirection('outbound');
      onOpenChange(false);
      onOriginated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Originate failed');
    } finally {
      setSaving(false);
    }
  }, [from, to, agentId, direction, onOpenChange, onOriginated]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-orange-500" />
            Originate Call
          </DialogTitle>
          <DialogDescription>
            Place an outbound call or simulate an inbound call.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="orig-dir">Direction</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as CallDirection)}>
              <SelectTrigger id="orig-dir" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="outbound">Outbound</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="orig-from">From *</Label>
              <Input
                id="orig-from"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="+8801XXXXXXXXX"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orig-to">To *</Label>
              <Input
                id="orig-to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="+8801XXXXXXXXX"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="orig-agent">Agent ID (optional)</Label>
            <Input
              id="orig-agent"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder="agent_xxx"
            />
            <p className="text-[11px] text-muted-foreground">
              Route the call to a specific human agent. Leave blank for queue.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleOriginate}
            disabled={saving}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <PhoneCall className="h-4 w-4 mr-1" />
            )}
            Originate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Call detail drawer ─────────────────────────────────────────────────────────

interface CallDrawerProps {
  callId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRefresh: () => void;
}

function CallDrawer({ callId, open, onOpenChange, onRefresh }: CallDrawerProps) {
  const { data: call, isLoading, error } = useApiQuery<CallDetail>(
    callId ? `/api/v1/calls/${callId}` : null,
  );

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const runTransition = useCallback(
    async (kind: 'hold' | 'resume' | 'hangup') => {
      if (!callId) return;
      setActionLoading(kind);
      try {
        if (kind === 'hangup') {
          await api.post(`/api/v1/calls/${callId}/hangup`, {});
        } else {
          await api.post(`/api/v1/calls/${callId}/${kind}`, {});
        }
        toast.success(`Call ${kind} successful`);
        onRefresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `${kind} failed`);
      } finally {
        setActionLoading(null);
      }
    },
    [callId, onRefresh],
  );

  const handleTransfer = useCallback(async () => {
    if (!callId) return;
    const destination = window.prompt('Transfer destination (phone number or agent id):');
    if (!destination) return;
    setActionLoading('transfer');
    try {
      await api.post(`/api/v1/calls/${callId}/transfer`, {
        destination,
        reason: 'manual transfer from call center',
      });
      toast.success('Call transferred');
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setActionLoading(null);
    }
  }, [callId, onRefresh]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-orange-500" />
            Call Detail
          </SheetTitle>
          <SheetDescription>
            {call ? `${call.direction} • ${call.status}` : 'Loading call…'}
          </SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="space-y-3 p-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {error && (
          <div className="mx-4 mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span className="text-xs">{error}</span>
          </div>
        )}

        {call && !isLoading && (
          <div className="px-4 pb-6 space-y-4">
            {/* Caller info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <PhoneIncoming className="h-3 w-3" /> From
                </p>
                <p className="font-medium">{call.fromName || call.from}</p>
                <p className="text-xs text-muted-foreground">{call.from}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <PhoneOutgoing className="h-3 w-3" /> To
                </p>
                <p className="font-medium">{call.toName || call.to}</p>
                <p className="text-xs text-muted-foreground">{call.to}</p>
              </div>
            </div>

            <Separator />

            {/* Meta */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Status</p>
                <Badge variant="outline" className={statusBadgeClass(call.status)}>
                  {call.status}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Duration</p>
                <p className="font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {formatDuration(call.durationSec)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Started</p>
                <p className="font-medium">{format(new Date(call.startedAt), 'MMM d HH:mm')}</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={actionLoading !== null || call.status === 'hold'}
                onClick={() => runTransition('hold')}
              >
                {actionLoading === 'hold' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Pause className="h-3.5 w-3.5" />
                )}
                Hold
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={actionLoading !== null || call.status !== 'hold'}
                onClick={() => runTransition('resume')}
              >
                {actionLoading === 'resume' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Resume
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={actionLoading !== null || call.status === 'closed'}
                onClick={handleTransfer}
              >
                {actionLoading === 'transfer' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Forward className="h-3.5 w-3.5" />
                )}
                Transfer
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={actionLoading !== null || call.status === 'closed'}
                onClick={() => runTransition('hangup')}
              >
                {actionLoading === 'hangup' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PhoneOff className="h-3.5 w-3.5" />
                )}
                Hangup
              </Button>
            </div>

            {/* Recording player */}
            {call.recordingUrl && (
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <RecordingIcon className="h-3.5 w-3.5 text-red-500" />
                  Recording
                </p>
                <audio controls src={call.recordingUrl} className="w-full h-8" />
                <a
                  href={call.recordingUrl}
                  download
                  className="text-[11px] text-orange-600 hover:underline"
                >
                  Download audio
                </a>
              </div>
            )}

            {/* Summary */}
            {call.summary && (
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  AI Summary
                </p>
                <p className="text-xs leading-relaxed">{call.summary}</p>
              </div>
            )}

            {/* Transcript */}
            {call.transcript && (
              <div className="rounded-md border p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  Transcript
                </p>
                <pre className="text-xs whitespace-pre-wrap leading-relaxed font-sans max-h-60 overflow-y-auto">
                  {call.transcript}
                </pre>
              </div>
            )}

            {/* Timeline */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                Call Timeline
              </p>
              <ol className="space-y-2 relative border-l border-border ml-2 pl-3">
                {(call.events || []).length === 0 && (
                  <li className="text-xs text-muted-foreground">No events yet.</li>
                )}
                {(call.events || []).map((ev) => (
                  <li key={ev.id} className="text-xs">
                    <p className="font-medium text-foreground">{ev.type}</p>
                    <p className="text-muted-foreground">
                      {format(new Date(ev.timestamp), 'HH:mm:ss')}
                      {ev.description ? ` · ${ev.description}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Main View ─────────────────────────────────────────────────────────────────

export function CallsView() {
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [drawerCallId, setDrawerCallId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [originateOpen, setOriginateOpen] = useState(false);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (directionFilter !== 'all') params.set('direction', directionFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    params.set('limit', '50');
    return params.toString();
  }, [directionFilter, statusFilter]);

  const { data, isLoading, error, refetch } = useApiQuery<CallsResponse>(
    `/api/v1/calls?${queryParams}`,
  );

  // Filter by date range client-side (since API doesn't support range natively in this impl)
  const calls = useMemo(() => {
    if (!data?.calls) return [];
    let list = data.calls;
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      list = list.filter((c) => new Date(c.startedAt).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86_400_000;
      list = list.filter((c) => new Date(c.startedAt).getTime() <= to);
    }
    return list;
  }, [data, dateFrom, dateTo]);

  // Stats
  const activeCount = calls.filter((c) => c.status === 'active' || c.status === 'ringing').length;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCalls = calls.filter((c) => new Date(c.startedAt).getTime() >= todayStart.getTime());
  const avgDuration =
    calls.length > 0
      ? Math.round(calls.reduce((acc, c) => acc + (c.durationSec || 0), 0) / calls.length)
      : 0;

  const openDetail = useCallback((id: string) => {
    setDrawerCallId(id);
    setDrawerOpen(true);
  }, []);

  const handleOriginateSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <PhoneCall className="h-6 w-6 text-orange-500" />
            Call Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live calls, recordings, transcripts, and supervisor controls.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={refetch} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => setOriginateOpen(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Plus className="h-4 w-4 mr-1" /> Originate Call
          </Button>
        </div>
      </div>

      {/* Stats badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Active calls"
          value={String(activeCount)}
          icon={<PhoneCall className="h-4 w-4 text-emerald-500" />}
          tone="bg-emerald-500/10"
        />
        <StatCard
          label="Today's calls"
          value={String(todayCalls.length)}
          icon={<Phone className="h-4 w-4 text-blue-500" />}
          tone="bg-blue-500/10"
        />
        <StatCard
          label="Avg duration"
          value={formatDuration(avgDuration)}
          icon={<Clock className="h-4 w-4 text-orange-500" />}
          tone="bg-orange-500/10"
        />
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="py-3 flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground">Direction</Label>
            <Select value={directionFilter} onValueChange={setDirectionFilter}>
              <SelectTrigger size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="ringing">Ringing</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="hold">Hold</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-36 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-36 text-xs"
            />
          </div>
          {(directionFilter !== 'all' || statusFilter !== 'all' || dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDirectionFilter('all');
                setStatusFilter('all');
                setDateFrom('');
                setDateTo('');
              }}
              className="text-xs"
            >
              Reset
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Error banner */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">Failed to load calls</p>
              <p className="text-xs text-muted-foreground truncate">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {isLoading && !data && (
        <Card>
          <CardContent className="py-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full mb-2" />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && !error && calls.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mb-4">
              <PhoneMissed className="h-7 w-7 text-orange-500" />
            </div>
            <p className="text-base font-medium">No calls yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Originate your first call to start managing your contact center activity.
            </p>
            <Button
              onClick={() => setOriginateOpen(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Plus className="h-4 w-4 mr-1" /> Originate Call
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Calls table */}
      {!isLoading && calls.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Direction</TableHead>
                  <TableHead>From → To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Recording</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <DirectionIcon direction={c.direction} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="font-medium truncate max-w-[120px]">
                          {c.fromName || c.from}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium truncate max-w-[120px]">
                          {c.toName || c.to}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadgeClass(c.status)}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {formatDuration(c.durationSec)}
                    </TableCell>
                    <TableCell>
                      {c.humanAgentId || c.agentId ? (
                        <span className="text-xs flex items-center gap-1 text-muted-foreground">
                          <User className="h-3 w-3" />
                          {(c.humanAgentId || c.agentId || '').slice(0, 10)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.hasRecording || c.recordingUrl ? (
                        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                          <Mic className="h-3 w-3 mr-0.5" />
                          REC
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(c.startedAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDetail(c.id)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Call detail drawer */}
      <CallDrawer
        callId={drawerCallId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onRefresh={refetch}
      />

      {/* Originate dialog */}
      <OriginateDialog
        open={originateOpen}
        onOpenChange={setOriginateOpen}
        onOriginated={handleOriginateSuccess}
      />
    </div>
  );
}

export default CallsView;
