'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useApiQuery, useApiMutation } from '@/hooks/use-api-query';
import { api } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import { formatDistanceToNow } from 'date-fns';
import {
  PhoneCall,
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Pause,
  Play,
  Forward,
  Headphones,
  Users,
  Clock,
  UserCheck,
  Coffee,
  Utensils,
  ListChecks,
  Volume2,
  Activity,
  Ear,
  MessageCircle,
  PhoneForwarded,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Voicemail,
  Hash,
  Eraser,
  History,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

type AgentStatus = 'offline' | 'available' | 'busy' | 'after_call' | 'break' | 'lunch' | 'training';

interface AgentStatusEntry {
  id: string;
  userId: string;
  status: AgentStatus;
  statusChangedAt: string;
  currentCallId: string | null;
  callsToday: number;
  avgHandleTimeSec: number;
  breakEndsAt: string | null;
  user?: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  };
}

interface AgentStatusResponse {
  agentStatuses: AgentStatusEntry[];
}

interface SupervisorAgent {
  userId: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
  role: string | null;
  status: AgentStatus;
  statusChangedAt: string;
  currentCallId: string | null;
  callsToday: number;
  avgHandleTimeSec: number;
  breakEndsAt: string | null;
}

interface SupervisorQueue {
  id: string;
  name: string;
  maxSize: number;
}

interface SupervisorResponse {
  agents: SupervisorAgent[];
  summary: {
    total: number;
    available: number;
    busy: number;
    onBreak: number;
    offline: number;
    activeCalls: number;
  };
  queues: SupervisorQueue[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: AgentStatus; label: string; icon: React.ReactNode; tone: string }[] = [
  { value: 'available', label: 'Available', icon: <UserCheck className="h-3.5 w-3.5" />, tone: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  { value: 'busy', label: 'Busy', icon: <PhoneCall className="h-3.5 w-3.5" />, tone: 'bg-red-500/10 text-red-600 border-red-500/20' },
  { value: 'after_call', label: 'After-call', icon: <ListChecks className="h-3.5 w-3.5" />, tone: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  { value: 'break', label: 'Break', icon: <Coffee className="h-3.5 w-3.5" />, tone: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  { value: 'lunch', label: 'Lunch', icon: <Utensils className="h-3.5 w-3.5" />, tone: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
];

function statusBadgeClass(status: AgentStatus): string {
  const opt = STATUS_OPTIONS.find((o) => o.value === status);
  return opt?.tone || 'bg-muted text-muted-foreground border-border';
}

function formatDuration(sec: number): string {
  if (!sec || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── My Workspace ─────────────────────────────────────────────────────────────

function DialPad({ onDial }: { onDial: (digit: string) => void }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  return (
    <div className="grid grid-cols-3 gap-1.5 max-w-[200px]">
      {keys.map((k) => (
        <Button
          key={k}
          variant="outline"
          size="sm"
          className="h-11 text-base font-mono"
          onClick={() => onDial(k)}
        >
          {k}
        </Button>
      ))}
    </div>
  );
}

function MyWorkspace() {
  const { user } = useAppStore();
  const [dialString, setDialString] = useState('');
  const [callNotes, setCallNotes] = useState('');
  const [muted, setMuted] = useState(false);
  const [queuedDialing, setQueuedDialing] = useState(false);

  const { data: statusData, isLoading, error, refetch } = useApiQuery<AgentStatusResponse>(
    '/api/v1/agent-status',
  );

  const myStatus = useMemo(() => {
    if (!statusData?.agentStatuses || !user) return null;
    return statusData.agentStatuses.find((s) => s.userId === user.id) || null;
  }, [statusData, user]);

  const queuedCalls = useMemo(() => {
    // For demo — show simulated queued calls alongside real agent statuses.
    // Real queue list endpoint would be /api/v1/call-queues/[id]/waiting
    return statusData?.agentStatuses.filter((s) => s.status === 'busy').slice(0, 5) || [];
  }, [statusData]);

  const updateStatus = useApiMutation<Partial<{ status: AgentStatus }>, { status: AgentStatus }>({
    method: 'POST',
    path: '/api/v1/agent-status',
    onSuccess: () => {
      refetch();
      toast.success('Status updated');
    },
    onError: (e) => toast.error(e),
  });

  const handleDial = useCallback((digit: string) => {
    setDialString((p) => (p.length < 20 ? p + digit : p));
  }, []);

  const handleOriginate = useCallback(async () => {
    if (!dialString.trim()) {
      toast.error('Enter a number to dial');
      return;
    }
    setQueuedDialing(true);
    try {
      await api.post('/api/v1/calls/originate', {
        from: user?.email || 'agent',
        to: dialString,
        direction: 'outbound',
      });
      toast.success('Outbound call placed');
      setDialString('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Originate failed');
    } finally {
      setQueuedDialing(false);
    }
  }, [dialString, user]);

  // Mocked "current call" — in production this would come from a websocket subscription
  const currentCall = myStatus?.currentCallId
    ? { id: myStatus.currentCallId, from: '+8801XXXXXXXXX', name: 'Incoming caller', startedAt: myStatus.statusChangedAt }
    : null;

  return (
    <div className="space-y-4">
      {/* Status selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-orange-500" /> My Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={myStatus?.status === opt.value ? 'default' : 'outline'}
                onClick={() => updateStatus.mutate({ status: opt.value })}
                disabled={updateStatus.isLoading}
                className={myStatus?.status === opt.value ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}
              >
                {opt.icon}
                {opt.label}
              </Button>
            ))}
            <div className="ml-auto text-xs text-muted-foreground">
              {myStatus
                ? `Since ${formatDistanceToNow(new Date(myStatus.statusChangedAt), { addSuffix: true })}`
                : isLoading
                  ? 'Loading…'
                  : 'No status set'}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive flex-1">{error}</p>
            <Button size="sm" variant="outline" onClick={refetch}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Current call panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PhoneCall className="h-4 w-4 text-emerald-500" /> Current Call
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentCall ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-md bg-emerald-500/5 border border-emerald-500/20">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <PhoneCall className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{currentCall.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{currentCall.from}</p>
                  </div>
                  <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                    Active
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Button size="sm" variant="outline" className="flex flex-col items-center gap-0.5 h-16">
                    <Pause className="h-4 w-4" />
                    <span className="text-[10px]">Hold</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={`flex flex-col items-center gap-0.5 h-16 ${muted ? 'bg-red-500/10 border-red-500/30 text-red-600' : ''}`}
                    onClick={() => {
                      setMuted((m) => !m);
                      toast.info(muted ? 'Unmuted' : 'Muted');
                    }}
                  >
                    {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    <span className="text-[10px]">{muted ? 'Unmute' : 'Mute'}</span>
                  </Button>
                  <Button size="sm" variant="outline" className="flex flex-col items-center gap-0.5 h-16">
                    <Forward className="h-4 w-4" />
                    <span className="text-[10px]">Transfer</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex flex-col items-center gap-0.5 h-16"
                  >
                    <PhoneOff className="h-4 w-4" />
                    <span className="text-[10px]">Hangup</span>
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="call-notes">Call Notes</Label>
                  <Textarea
                    id="call-notes"
                    rows={3}
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                    placeholder="Type notes during the call (auto-saved to CRM)…"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                  <Phone className="h-10 w-10 mb-2 text-muted-foreground/30" />
                  <p className="text-sm font-medium">No active call</p>
                  <p className="text-xs">Dial a number below to place an outbound call.</p>
                </div>
                <Separator />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="dial-input" className="flex items-center gap-1 text-xs">
                      <Hash className="h-3 w-3" /> Dial
                    </Label>
                    <div className="flex gap-1">
                      <Input
                        id="dial-input"
                        value={dialString}
                        onChange={(e) => setDialString(e.target.value)}
                        placeholder="+8801XXXXXXXXX"
                        className="font-mono"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDialString('')}
                        title="Clear"
                      >
                        <Eraser className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      onClick={handleOriginate}
                      disabled={queuedDialing || !dialString.trim()}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      {queuedDialing ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <PhoneForwarded className="h-4 w-4 mr-1" />
                      )}
                      Place Call
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs">Dial Pad</Label>
                    <div className="mt-2">
                      <DialPad onDial={handleDial} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CRM sidebar / Customer 360 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-blue-500" /> Customer 360
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentCall ? (
              <div className="space-y-3 text-sm">
                <div className="rounded-md border p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Customer</p>
                  <p className="font-medium">{currentCall.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{currentCall.from}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Recent Activity</p>
                  {[
                    { label: 'Last call', value: '2 days ago', icon: <PhoneCall className="h-3 w-3" /> },
                    { label: 'Open ticket', value: 'Support #1234', icon: <MessageCircle className="h-3 w-3" /> },
                    { label: 'Lifetime value', value: '$1,240', icon: <Volume2 className="h-3 w-3" /> },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        {item.icon} {item.label}
                      </span>
                      <span className="font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Users className="h-8 w-8 mb-2 text-muted-foreground/30" />
                <p className="text-xs">Customer timeline appears when a call is active.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Queued calls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Voicemail className="h-4 w-4 text-orange-500" /> Queued Calls
            <Badge variant="secondary" className="text-[10px]">{queuedCalls.length}</Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Calls waiting to be picked up.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}
          {!isLoading && queuedCalls.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              <Coffee className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              Queue is empty. Great job!
            </div>
          )}
          {!isLoading && queuedCalls.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Caller</TableHead>
                  <TableHead>Waiting</TableHead>
                  <TableHead>Queue</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queuedCalls.map((q, i) => (
                  <TableRow key={q.id}>
                    <TableCell className="text-sm">Caller #{i + 1}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(q.statusChangedAt), { addSuffix: false })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                        Default
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline">
                        <PhoneCall className="h-3 w-3 mr-1" /> Pick Up
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Supervisor ─────────────────────────────────────────────────────────────────

function SupervisorTab() {
  const { user } = useAppStore();
  const isSupervisor = user?.role === 'super_admin' || user?.role === 'manager' || user?.role === 'admin';

  const { data, isLoading, error, refetch } = useApiQuery<SupervisorResponse>(
    '/api/v1/supervisor/agents',
  );

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const runSupervisorAction = useCallback(
    async (kind: 'listen' | 'whisper' | 'barge-in', callId: string) => {
      setActionLoading(`${kind}-${callId}`);
      try {
        await api.post(`/api/v1/supervisor/${kind}/${callId}`, {});
        toast.success(`Supervisor ${kind} started`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `${kind} failed`);
      } finally {
        setActionLoading(null);
      }
    },
    [],
  );

  if (!isSupervisor) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
          <AlertTriangle className="h-7 w-7 text-red-500" />
        </div>
        <p className="text-base font-medium">Supervisor access required</p>
        <p className="text-sm text-muted-foreground mt-1">
          Only managers and admins can view the supervisor dashboard.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="flex items-center gap-3 py-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">Failed to load supervisor data</p>
            <p className="text-xs text-muted-foreground truncate">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={refetch}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Agents', value: data?.summary.total ?? 0, icon: <Users className="h-4 w-4 text-blue-500" />, tone: 'bg-blue-500/10' },
          { label: 'Available', value: data?.summary.available ?? 0, icon: <UserCheck className="h-4 w-4 text-emerald-500" />, tone: 'bg-emerald-500/10' },
          { label: 'On Break', value: data?.summary.onBreak ?? 0, icon: <Coffee className="h-4 w-4 text-amber-500" />, tone: 'bg-amber-500/10' },
          { label: 'Active Calls', value: data?.summary.activeCalls ?? 0, icon: <PhoneCall className="h-4 w-4 text-red-500" />, tone: 'bg-red-500/10' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="py-3 flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.tone}`}>
                {s.icon}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <p className="text-base font-semibold leading-none mt-0.5">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-orange-500" /> Agent Status
          </CardTitle>
          <CardDescription className="text-xs">
            Real-time status of all agents in your tenant.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}
          {!isLoading && (!data?.agents || data.agents.length === 0) && (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              <Users className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              No agent statuses recorded yet.
            </div>
          )}
          {!isLoading && data?.agents && data.agents.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Current Call</TableHead>
                  <TableHead>Calls Today</TableHead>
                  <TableHead>Avg Handle</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.agents.map((agent) => (
                  <TableRow key={agent.userId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-orange-500/15 text-orange-600 flex items-center justify-center text-xs font-bold">
                          {(agent.name || agent.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {agent.name || 'Unnamed'}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">{agent.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadgeClass(agent.status)}>
                        {agent.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {agent.currentCallId ? (
                        <span className="font-mono text-orange-600">{agent.currentCallId.slice(0, 12)}…</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{agent.callsToday}</TableCell>
                    <TableCell className="text-xs font-mono">{formatDuration(agent.avgHandleTimeSec)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          disabled={!agent.currentCallId || actionLoading === `listen-${agent.currentCallId}` || actionLoading === `barge-in-${agent.currentCallId}` || actionLoading === `whisper-${agent.currentCallId}`}
                          onClick={() => agent.currentCallId && runSupervisorAction('listen', agent.currentCallId)}
                          title="Listen in"
                        >
                          {actionLoading === `listen-${agent.currentCallId}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Ear className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          disabled={!agent.currentCallId || actionLoading === `whisper-${agent.currentCallId}` || actionLoading === `listen-${agent.currentCallId}` || actionLoading === `barge-in-${agent.currentCallId}`}
                          onClick={() => agent.currentCallId && runSupervisorAction('whisper', agent.currentCallId)}
                          title="Whisper to agent"
                        >
                          {actionLoading === `whisper-${agent.currentCallId}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <MessageCircle className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-orange-600"
                          disabled={!agent.currentCallId || actionLoading === `barge-in-${agent.currentCallId}` || actionLoading === `listen-${agent.currentCallId}` || actionLoading === `whisper-${agent.currentCallId}`}
                          onClick={() => agent.currentCallId && runSupervisorAction('barge-in', agent.currentCallId)}
                          title="Barge in"
                        >
                          {actionLoading === `barge-in-${agent.currentCallId}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <PhoneForwarded className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Queue monitoring */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4 text-blue-500" /> Queue Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(!data?.queues || data.queues.length === 0) ? (
            <div className="px-6 py-6 text-center text-sm text-muted-foreground">
              <ListChecks className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              No active queues.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Queue</TableHead>
                  <TableHead>Max Size</TableHead>
                  <TableHead>Waiting Callers</TableHead>
                  <TableHead>Longest Wait</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.queues.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="text-sm font-medium">{q.name}</TableCell>
                    <TableCell className="text-xs font-mono">{q.maxSize}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                        0
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">—</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main View ─────────────────────────────────────────────────────────────────

export function ContactCenterView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Headphones className="h-6 w-6 text-orange-500" />
          Contact Center
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Agent workspace and supervisor dashboard in one place.
        </p>
      </div>

      <Tabs defaultValue="workspace">
        <TabsList>
          <TabsTrigger value="workspace">
            <PhoneCall className="h-3.5 w-3.5 mr-1" />
            My Workspace
          </TabsTrigger>
          <TabsTrigger value="supervisor">
            <Users className="h-3.5 w-3.5 mr-1" />
            Supervisor
          </TabsTrigger>
        </TabsList>
        <TabsContent value="workspace" className="mt-4">
          <MyWorkspace />
        </TabsContent>
        <TabsContent value="supervisor" className="mt-4">
          <SupervisorTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ContactCenterView;
