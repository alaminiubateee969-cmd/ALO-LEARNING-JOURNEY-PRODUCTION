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
import { Progress } from '@/components/ui/progress';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  CreditCard,
  Phone,
  Brain,
  Volume2,
  Mic,
  HardDrive,
  Receipt,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Plus,
  ShoppingCart,
  Calendar,
  DollarSign,
  BarChart3,
  CheckCircle2,
  Clock,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Plan {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  maxPhoneNumbers: number;
  maxUsers: number;
  maxAiMinutes: number;
  maxTtsCharacters: number;
  maxAsrSeconds: number;
  maxRecordingStorageMb: number;
  maxOutboundCallsPerDay: number;
  features: string[];
  trialDays: number;
}

interface Subscription {
  plan: string;
  status: string;
  billingCycle: string;
  endsAt: string | null;
  isTrial: boolean;
  trialEndsAt: string | null;
}

interface Credit {
  type: string;
  balance: number;
  autoRechargeThreshold: number;
  autoRechargeAmount: number;
}

interface UsageTotals {
  calls: {
    calls: number;
    aiHandled: number;
    humanHandled: number;
    duration: number;
    recordingMb: number;
  };
  tts: { chars: number; audioSec: number; cost: number };
  asr: { audioSec: number; chars: number; cost: number };
  estimatedTotalCostUsd: number;
}

interface PerDayEntry {
  day: string;
  totalCalls: number;
  aiHandledCalls: number;
  humanHandledCalls: number;
}

interface UsageResponse {
  period: { days: number; since: string };
  subscription: Subscription | null;
  credits: Credit[];
  totals: UsageTotals;
  perDay: {
    calls: PerDayEntry[];
    tts: unknown[];
    asr: unknown[];
  };
}

interface PlansResponse {
  plans: Plan[];
}

interface CreditsResponse {
  credits: Credit[];
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  status: string;
  dueAt: string | null;
  sentAt: string | null;
  paidAt: string | null;
  paymentCount: number;
  createdAt: string;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
}

interface InvoicesResponse {
  invoices: Invoice[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const CREDIT_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; tone: string }> = {
  ai_minutes: {
    label: 'AI Minutes',
    icon: <Brain className="h-4 w-4 text-orange-500" />,
    tone: 'bg-orange-500/10',
  },
  tts_chars: {
    label: 'TTS Characters',
    icon: <Volume2 className="h-4 w-4 text-blue-500" />,
    tone: 'bg-blue-500/10',
  },
  asr_seconds: {
    label: 'ASR Seconds',
    icon: <Mic className="h-4 w-4 text-purple-500" />,
    tone: 'bg-purple-500/10',
  },
  recording_mb: {
    label: 'Recording MB',
    icon: <HardDrive className="h-4 w-4 text-emerald-500" />,
    tone: 'bg-emerald-500/10',
  },
};

const CREDIT_TYPE_OPTIONS = Object.keys(CREDIT_TYPE_LABELS);

// ─── SVG Bar Chart ────────────────────────────────────────────────────────────

function CallsChart({ data }: { data: PerDayEntry[] }) {
  const width = 720;
  const height = 220;
  const padding = { top: 10, right: 8, bottom: 24, left: 32 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const max = Math.max(1, ...data.map((d) => d.totalCalls));
  const barW = data.length > 0 ? innerW / data.length : 0;

  const yTicks = [0, Math.ceil(max / 4), Math.ceil(max / 2), Math.ceil((max * 3) / 4), max];

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto"
        role="img"
        aria-label="Calls per day bar chart"
      >
        {/* Y gridlines */}
        {yTicks.map((t, i) => {
          const y = padding.top + innerH - (t / max) * innerH;
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.1}
                strokeWidth={1}
              />
              <text
                x={padding.left - 4}
                y={y + 4}
                fontSize={9}
                fill="currentColor"
                fillOpacity={0.6}
                textAnchor="end"
              >
                {t}
              </text>
            </g>
          );
        })}
        {/* Bars */}
        {data.map((d, i) => {
          const h = (d.totalCalls / max) * innerH;
          const x = padding.left + i * barW + 1;
          const y = padding.top + innerH - h;
          const w = Math.max(barW - 2, 1);
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={w}
                height={Math.max(h, 1)}
                rx={2}
                fill="#F97316"
                opacity={0.85}
              />
              {/* X label every ~5 days */}
              {i % 5 === 0 && (
                <text
                  x={x + w / 2}
                  y={height - 8}
                  fontSize={9}
                  fill="currentColor"
                  fillOpacity={0.6}
                  textAnchor="middle"
                >
                  {format(new Date(d.day), 'MMM d')}
                </text>
              )}
            </g>
          );
        })}
        {/* Baseline */}
        <line
          x1={padding.left}
          y1={padding.top + innerH}
          x2={width - padding.right}
          y2={padding.top + innerH}
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}

// ─── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({
  subscription,
  plans,
  onUpgrade,
}: {
  subscription: Subscription | null;
  plans: Plan[];
  onUpgrade: () => void;
}) {
  if (!subscription) {
    return (
      <Card>
        <CardContent className="py-6 flex flex-col items-center justify-center text-center gap-3">
          <CreditCard className="h-8 w-8 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium">No active subscription</p>
            <p className="text-xs text-muted-foreground">Subscribe to a plan to unlock all features.</p>
          </div>
          <Button onClick={onUpgrade} className="bg-orange-500 hover:bg-orange-600 text-white">
            Browse Plans
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currentPlan = plans.find((p) => p.displayName === subscription.plan);
  const trialEnd = subscription.trialEndsAt ? new Date(subscription.trialEndsAt) : null;
  const trialDaysLeft = trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86_400_000))
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-orange-500" />
              {subscription.plan || 'Free'}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {currentPlan?.description || 'Current subscription plan'}
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={
              subscription.status === 'active'
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
            }
          >
            {subscription.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground">Price</p>
            <p className="font-semibold flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              {currentPlan?.priceMonthly ?? 0}/mo
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Cycle</p>
            <p className="font-medium capitalize">{subscription.billingCycle || 'monthly'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Trial</p>
            <p className="font-medium flex items-center gap-1">
              {subscription.isTrial ? (
                <>
                  <Clock className="h-3 w-3 text-amber-500" />
                  {trialDaysLeft}d left
                </>
              ) : (
                '—'
              )}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Renews</p>
            <p className="font-medium">
              {subscription.endsAt
                ? format(new Date(subscription.endsAt), 'MMM d, yyyy')
                : '—'}
            </p>
          </div>
        </div>

        {subscription.isTrial && trialEnd && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            Trial ends on {format(trialEnd, 'MMM d, yyyy')} — upgrade to keep your service active.
          </div>
        )}

        <Button onClick={onUpgrade} variant="outline" className="w-full">
          Change Plan
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Usage stat card ──────────────────────────────────────────────────────────

function UsageStatCard({
  label,
  value,
  limit,
  unit,
  icon,
  tone,
}: {
  label: string;
  value: number;
  limit: number;
  unit: string;
  icon: React.ReactNode;
  tone: string;
}) {
  const pct = limit > 0 ? Math.min(100, (value / limit) * 100) : 0;
  const isOver = pct >= 100;
  return (
    <Card>
      <CardContent className="py-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tone}`}>
              {icon}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold leading-none mt-0.5">
                {value.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{unit}</span>
              </p>
            </div>
          </div>
          {isOver && (
            <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
              Limit
            </Badge>
          )}
        </div>
        <Progress value={pct} className={`h-1.5 ${isOver ? '[&>[data-slot=progress-indicator]]:bg-red-500' : ''}`} />
        <p className="text-[11px] text-muted-foreground">
          {pct.toFixed(0)}% of {limit.toLocaleString()} {unit} limit
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Purchase credits dialog ───────────────────────────────────────────────────

interface PurchaseDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPurchased: () => void;
}

function PurchaseDialog({ open, onOpenChange, onPurchased }: PurchaseDialogProps) {
  const [creditType, setCreditType] = useState('ai_minutes');
  const [amount, setAmount] = useState(100);
  const [saving, setSaving] = useState(false);

  const handlePurchase = useCallback(async () => {
    if (amount <= 0) {
      toast.error('Amount must be positive');
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/v1/billing/credits', { creditType, amount });
      toast.success(`Purchased ${amount} ${creditType}`);
      onOpenChange(false);
      onPurchased();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Purchase failed');
    } finally {
      setSaving(false);
    }
  }, [creditType, amount, onOpenChange, onPurchased]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-orange-500" />
            Purchase Credits
          </DialogTitle>
          <DialogDescription>
            Top up your prepaid balance for a specific credit type.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="purchase-type">Credit Type</Label>
            <Select value={creditType} onValueChange={setCreditType}>
              <SelectTrigger id="purchase-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CREDIT_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {CREDIT_TYPE_LABELS[t].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="purchase-amount">Amount</Label>
            <Input
              id="purchase-amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handlePurchase}
            disabled={saving}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            Purchase
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main View ─────────────────────────────────────────────────────────────────

export function BillingView() {
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const { data: usage, isLoading: usageLoading, error: usageError, refetch: refetchUsage } =
    useApiQuery<UsageResponse>('/api/v1/billing/usage');

  const { data: plansData, refetch: refetchPlans } = useApiQuery<PlansResponse>('/api/v1/billing/plans');
  const { data: creditsData, refetch: refetchCredits } = useApiQuery<CreditsResponse>('/api/v1/billing/credits');
  const { data: invoicesData, refetch: refetchInvoices } = useApiQuery<InvoicesResponse>('/api/v1/billing/invoices?limit=20');

  const plans = plansData?.plans || [];
  const credits = creditsData?.credits || [];
  const invoices = invoicesData?.invoices || [];

  const refreshAll = useCallback(() => {
    refetchUsage();
    refetchPlans();
    refetchCredits();
    refetchInvoices();
  }, [refetchUsage, refetchPlans, refetchCredits, refetchInvoices]);

  const handlePayInvoice = useCallback(async (inv: Invoice) => {
    try {
      await api.post('/api/v1/billing/payments', {
        invoiceId: inv.id,
        amount: inv.total,
        currency: inv.currency,
        method: 'card',
      });
      toast.success(`Payment submitted for ${inv.invoiceNumber}`);
      refetchInvoices();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Payment failed');
    }
  }, [refetchInvoices]);

  // Plan limits (use current plan if available, else fallback)
  const planLimits = useMemo(() => {
    const sub = usage?.subscription;
    const plan = plans.find((p) => p.displayName === sub?.plan) || plans[0];
    return {
      calls: plan?.maxOutboundCallsPerDay ?? 50,
      aiMinutes: plan?.maxAiMinutes ?? 100,
      ttsChars: plan?.maxTtsCharacters ?? 10000,
      asrSeconds: plan?.maxAsrSeconds ?? 3600,
    };
  }, [usage, plans]);

  // Reversed calls per day for chart (oldest first)
  const chartData = useMemo(() => {
    return [...(usage?.perDay?.calls || [])].reverse();
  }, [usage]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-orange-500" />
            Billing & Usage
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your subscription, monitor usage, and review invoices.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={refreshAll} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {usageError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive flex-1">{usageError}</p>
            <Button size="sm" variant="outline" onClick={refetchUsage}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Current plan + trial card */}
      {usageLoading && !usage ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : (
        <PlanCard
          subscription={usage?.subscription ?? null}
          plans={plans}
          onUpgrade={() => toast.info('Plan change wizard coming soon')}
        />
      )}

      {/* Usage this period */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-orange-500" />
          <h2 className="text-base font-semibold">Usage This Period</h2>
          {usage?.period?.since && (
            <Badge variant="secondary" className="text-[10px]">
              <Calendar className="h-3 w-3 mr-0.5" />
              Last {usage.period.days} days
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <UsageStatCard
            label="Calls"
            value={usage?.totals?.calls?.calls ?? 0}
            limit={planLimits.calls}
            unit="calls"
            icon={<Phone className="h-4 w-4 text-blue-500" />}
            tone="bg-blue-500/10"
          />
          <UsageStatCard
            label="AI Minutes"
            value={Math.round((usage?.totals?.calls?.duration ?? 0) / 60)}
            limit={planLimits.aiMinutes}
            unit="min"
            icon={<Brain className="h-4 w-4 text-orange-500" />}
            tone="bg-orange-500/10"
          />
          <UsageStatCard
            label="TTS Chars"
            value={usage?.totals?.tts?.chars ?? 0}
            limit={planLimits.ttsChars}
            unit="chars"
            icon={<Volume2 className="h-4 w-4 text-purple-500" />}
            tone="bg-purple-500/10"
          />
          <UsageStatCard
            label="ASR Seconds"
            value={usage?.totals?.asr?.audioSec ?? 0}
            limit={planLimits.asrSeconds}
            unit="sec"
            icon={<Mic className="h-4 w-4 text-emerald-500" />}
            tone="bg-emerald-500/10"
          />
        </div>
      </div>

      {/* Credit balance */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-orange-500" />
            <h2 className="text-base font-semibold">Credit Balance</h2>
          </div>
          <Button
            size="sm"
            onClick={() => setPurchaseOpen(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Purchase Credits
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CREDIT_TYPE_OPTIONS.map((type) => {
            const meta = CREDIT_TYPE_LABELS[type];
            const c = credits.find((cr) => cr.type === type);
            return (
              <Card key={type}>
                <CardContent className="py-4 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${meta.tone}`}>
                    {meta.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {meta.label}
                    </p>
                    <p className="text-lg font-semibold leading-none mt-0.5">
                      {(c?.balance ?? 0).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Usage chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-orange-500" />
            Calls per Day (Last 30 Days)
          </CardTitle>
          <CardDescription className="text-xs">
            Total daily call volume across your tenant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usageLoading ? (
            <Skeleton className="h-44 w-full" />
          ) : chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <BarChart3 className="h-8 w-8 mb-2 text-muted-foreground/30" />
              <p className="text-sm">No call data for this period yet.</p>
            </div>
          ) : (
            <CallsChart data={chartData} />
          )}
        </CardContent>
      </Card>

      {/* Recent invoices */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-orange-500" />
            Recent Invoices
          </CardTitle>
          <CardDescription className="text-xs">
            Your most recent billing invoices.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              <Receipt className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              No invoices yet.
            </div>
          )}
          {invoices.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const isDue = inv.status === 'sent' || inv.status === 'overdue';
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="text-sm font-medium font-mono">
                        {inv.invoiceNumber}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(inv.periodStart), 'MMM d')} – {format(new Date(inv.periodEnd), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {inv.currency} {inv.total.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            inv.status === 'paid'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : inv.status === 'overdue'
                                ? 'bg-red-500/10 text-red-600 border-red-500/20'
                                : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                          }
                        >
                          {inv.status === 'paid' && <CheckCircle2 className="h-3 w-3 mr-0.5" />}
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {inv.dueAt ? format(new Date(inv.dueAt), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {isDue ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-orange-500/10 text-orange-600 border-orange-500/30 hover:bg-orange-500/20"
                            onClick={() => handlePayInvoice(inv)}
                          >
                            <CreditCard className="h-3.5 w-3.5 mr-1" /> Pay
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PurchaseDialog
        open={purchaseOpen}
        onOpenChange={setPurchaseOpen}
        onPurchased={refetchCredits}
      />
    </div>
  );
}

export default BillingView;
