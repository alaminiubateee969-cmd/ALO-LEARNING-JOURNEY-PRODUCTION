"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  KeyRound,
  ShieldCheck,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Smartphone,
  Mail,
  MessageCircle,
  Phone,
  ListChecks,
  Hash,
  Timer,
  XCircle,
  Sparkles,
} from "lucide-react";

/* ------------------------------- types ------------------------------- */

type Channel = "sms" | "email" | "whatsapp" | "voice";
type Purpose = "verification" | "login" | "transaction" | "reset";
type OtpStatus =
  | "pending"
  | "delivered"
  | "verified"
  | "expired"
  | "failed";

interface OtpRequestRow {
  id: string;
  channel: string;
  recipient: string;
  code: string;
  purpose: string;
  status: OtpStatus;
  attempts: number;
  maxAttempts: number;
  expiresAt: string;
  createdAt: string;
}

interface OtpStats {
  total: number;
  pending: number;
  delivered: number;
  verified: number;
  expired: number;
  failed: number;
}

interface OtpListResponse {
  requests: OtpRequestRow[];
  stats: OtpStats;
}

interface SendResponse {
  ok: boolean;
  id?: string;
  channel?: Channel;
  recipient?: string;
  purpose?: Purpose;
  status?: string;
  expiresAt?: string;
  ttlSeconds?: number;
  devPreviewCode?: string;
  error?: string | null;
}

interface VerifyResponse {
  ok: boolean;
  status?: string;
  recipient?: string;
  purpose?: string;
  verifiedAt?: string;
  error?: string;
  attemptsRemaining?: number;
}

/* --------------------------- visual config --------------------------- */

const CHANNEL_META: Record<
  Channel,
  { label: string; bn: string; icon: React.ReactNode; tint: string }
> = {
  sms: {
    label: "SMS",
    bn: "এসএমএস",
    icon: <Smartphone className="h-3.5 w-3.5" />,
    tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  email: {
    label: "Email",
    bn: "ইমেইল",
    icon: <Mail className="h-3.5 w-3.5" />,
    tint: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  whatsapp: {
    label: "WhatsApp",
    bn: "হোয়াটসঅ্যাপ",
    icon: <MessageCircle className="h-3.5 w-3.5" />,
    tint: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  },
  voice: {
    label: "Voice",
    bn: "ভয়েস",
    icon: <Phone className="h-3.5 w-3.5" />,
    tint: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  },
};

const PURPOSE_META: Record<Purpose, { label: string; bn: string }> = {
  verification: { label: "Verification", bn: "যাচাইকরণ" },
  login: { label: "Login", bn: "লগইন" },
  transaction: { label: "Transaction", bn: "লেনদেন" },
  reset: { label: "Reset", bn: "রিসেট" },
};

const STATUS_META: Record<
  OtpStatus,
  { label: string; bn: string; className: string }
> = {
  pending: {
    label: "Pending",
    bn: "অপেক্ষমান",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  delivered: {
    label: "Delivered",
    bn: "পৌঁছেছে",
    className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  },
  verified: {
    label: "Verified",
    bn: "যাচাই হয়েছে",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  expired: {
    label: "Expired",
    bn: "মেয়াদোত্তীর্ণ",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
  },
  failed: {
    label: "Failed",
    bn: "ব্যর্থ",
    className: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  },
};

const STAT_TILES: {
  key: keyof OtpStats;
  label: string;
  bn: string;
  className: string;
}[] = [
  {
    key: "total",
    label: "Total",
    bn: "মোট",
    className:
      "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200",
  },
  {
    key: "pending",
    label: "Pending",
    bn: "অপেক্ষমান",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  {
    key: "delivered",
    label: "Delivered",
    bn: "পৌঁছেছে",
    className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  },
  {
    key: "verified",
    label: "Verified",
    bn: "যাচাই হয়েছে",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  {
    key: "expired",
    label: "Expired",
    bn: "মেয়াদোত্তীর্ণ",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
  },
  {
    key: "failed",
    label: "Failed",
    bn: "ব্যর্থ",
    className: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  },
];

/* --------------------------- helpers --------------------------- */

function maskRecipient(recipient: string): string {
  if (!recipient) return "—";
  // email: a***@domain.com
  if (recipient.includes("@")) {
    const [u, d] = recipient.split("@");
    if (!u || !d) return recipient;
    const head = u.slice(0, Math.min(2, u.length));
    return `${head}${"•".repeat(Math.max(2, u.length - 2))}@${d}`;
  }
  // phone: keep country code & last 2
  const trimmed = recipient.replace(/\s|-/g, "");
  if (trimmed.length <= 4) return "•".repeat(trimmed.length);
  const head = trimmed.startsWith("+") ? "+" : "";
  const body = trimmed.startsWith("+") ? trimmed.slice(1) : trimmed;
  const last2 = body.slice(-2);
  return `${head}${"•".repeat(Math.max(2, body.length - 2))}${last2}`;
}

function formatMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function formatTime(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/* --------------------------- component --------------------------- */

export default function OtpView() {
  const { toast } = useToast();

  // --- data ---
  const [requests, setRequests] = useState<OtpRequestRow[]>([]);
  const [stats, setStats] = useState<OtpStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- send form state ---
  const [sendRecipient, setSendRecipient] = useState("");
  const [channel, setChannel] = useState<Channel>("sms");
  const [purpose, setPurpose] = useState<Purpose>("verification");
  const [ttlSeconds, setTtlSeconds] = useState<number>(300);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // active send result (dev preview)
  const [activeSend, setActiveSend] = useState<SendResponse | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  // --- verify form state ---
  const [verifyRecipient, setVerifyRecipient] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<
    | { ok: true; recipient?: string; purpose?: string; verifiedAt?: string }
    | { ok: false; error?: string; attemptsRemaining?: number }
    | null
  >(null);

  /* ----------------------- data fetching ----------------------- */

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    try {
      const res = await fetch("/api/otp");
      const data: OtpListResponse = await res.json();
      setRequests(data.requests ?? []);
      setStats(data.stats ?? null);
    } catch (e) {
      if (!silent) setSendError(String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // prefill verify recipient when a send completes
  useEffect(() => {
    if (activeSend?.recipient) setVerifyRecipient(activeSend.recipient);
  }, [activeSend]);

  /* ----------------------- countdown timer ----------------------- */

  useEffect(() => {
    if (!activeSend?.expiresAt) return;
    const compute = () => {
      const ms = new Date(activeSend.expiresAt!).getTime() - Date.now();
      setSecondsLeft(Math.max(0, Math.floor(ms / 1000)));
    };
    compute();
    const t = window.setInterval(compute, 1000);
    return () => window.clearInterval(t);
  }, [activeSend]);

  /* ----------------------- send handler ----------------------- */

  const handleSend = async () => {
    setSendError(null);
    if (!sendRecipient.trim()) {
      setSendError("Recipient is required / প্রাপক প্রয়োজন");
      return;
    }
    setSending(true);
    setActiveSend(null);
    setVerifyResult(null);
    try {
      const res = await fetch("/api/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          recipient: sendRecipient.trim(),
          channel,
          purpose,
          ttlSeconds,
        }),
      });
      const data: SendResponse = await res.json();
      if (!res.ok || !data.ok) {
        setSendError(data.error ?? `Failed (${res.status})`);
        toast({
          title: "Send failed",
          description: data.error ?? `HTTP ${res.status}`,
          variant: "destructive",
        });
        return;
      }
      setActiveSend(data);
      toast({
        title: "OTP sent",
        description: `${channel.toUpperCase()} → ${maskRecipient(
          sendRecipient.trim()
        )}`,
      });
      load(true);
    } catch (e) {
      setSendError(String(e));
    } finally {
      setSending(false);
    }
  };

  /* ----------------------- verify handler ----------------------- */

  const handleVerify = async () => {
    setVerifyResult(null);
    if (!verifyRecipient.trim() || !verifyCode.trim()) {
      setVerifyResult({
        ok: false,
        error: "Recipient and code are required / প্রাপক ও কোড প্রয়োজন",
      });
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          recipient: verifyRecipient.trim(),
          code: verifyCode.trim(),
        }),
      });
      const data: VerifyResponse = await res.json();
      if (res.ok && data.ok) {
        setVerifyResult({
          ok: true,
          recipient: data.recipient,
          purpose: data.purpose,
          verifiedAt: data.verifiedAt,
        });
        toast({
          title: "Verified ✓",
          description: `${verifyRecipient.trim()} → ${data.purpose ?? "verification"}`,
        });
        load(true);
      } else {
        setVerifyResult({
          ok: false,
          error: data.error ?? `Failed (${res.status})`,
          attemptsRemaining: data.attemptsRemaining,
        });
      }
    } catch (e) {
      setVerifyResult({ ok: false, error: String(e) });
    } finally {
      setVerifying(false);
    }
  };

  /* ----------------------- derived ----------------------- */

  const codeExpiringSoon = secondsLeft > 0 && secondsLeft <= 30;
  const codeExpired = activeSend && secondsLeft <= 0;

  const statTiles = useMemo(() => {
    if (!stats) return [];
    return STAT_TILES.map((t) => ({ ...t, value: stats[t.key] ?? 0 }));
  }, [stats]);

  /* ----------------------- loading skeleton ----------------------- */

  if (loading) {
    return (
      <div className="alo-fade-up space-y-5">
        <div className="h-28 rounded-2xl alo-shimmer" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="h-80 rounded-2xl alo-shimmer" />
          <div className="h-80 rounded-2xl alo-shimmer" />
        </div>
        <div className="h-64 rounded-2xl alo-shimmer" />
      </div>
    );
  }

  /* ----------------------- render ----------------------- */

  return (
    <div className="alo-fade-up space-y-5">
      {/* ============ HEADER CARD ============ */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500/10 via-amber-500/10 to-teal-500/10 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-emerald-400/30 to-amber-400/30 p-3 text-emerald-700 dark:text-emerald-300 alo-glow">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                OTP / Verification Service{" "}
                <span className="alo-text-grad">ওটিপি সার্ভিস</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Generate, dispatch, and verify 6-digit one-time passcodes across
                SMS, email, WhatsApp &amp; voice channels.{" "}
                <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                  ছয় অঙ্কের কোড তৈরি, প্রেরণ এবং যাচাই।
                </span>
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(true)}
            disabled={refreshing}
            className="h-8"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${
                refreshing ? "animate-spin" : ""
              }`}
            />
            Refresh
          </Button>
        </div>

        {/* stats row */}
        <div className="mt-5 flex flex-wrap gap-2">
          {statTiles.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              Loading stats…
            </span>
          ) : (
            statTiles.map((t) => (
              <Badge
                key={t.key}
                variant="outline"
                className={`px-2.5 py-1 text-[11px] font-semibold gap-1.5 ${t.className} border-0`}
              >
                <span className="tabular-nums text-sm font-bold">{t.value}</span>
                <span className="opacity-80">
                  {t.label} · <span className="font-normal">{t.bn}</span>
                </span>
              </Badge>
            ))
          )}
        </div>
      </Card>

      {/* ============ TWO COLUMN GRID ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ---------- LEFT: SEND OTP ---------- */}
        <Card className="p-6 border-0 bg-gradient-to-br from-emerald-500/5 to-amber-500/5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/30 p-2 text-emerald-700 dark:text-emerald-300">
                <Send className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-semibold leading-tight">
                  Send OTP{" "}
                  <span className="text-muted-foreground font-normal text-sm">
                    / কোড পাঠান
                  </span>
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Dispatch a fresh 6-digit code to a recipient.
                </p>
              </div>
            </div>
            {activeSend?.ok && (
              <Badge
                className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-0"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Sent
              </Badge>
            )}
          </div>

          <div className="space-y-4">
            {/* recipient */}
            <div className="space-y-1.5">
              <Label htmlFor="otp-recipient" className="text-xs">
                Recipient <span className="text-muted-foreground">/ প্রাপক</span>
              </Label>
              <Input
                id="otp-recipient"
                value={sendRecipient}
                onChange={(e) => setSendRecipient(e.target.value)}
                placeholder="+8801XXXXXXXXX  ·  user@example.com"
                className="font-mono text-sm h-10"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-[10px] text-muted-foreground">
                Phone for SMS / WhatsApp / Voice · Email for the email channel.
              </p>
            </div>

            {/* channel + purpose */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Channel <span className="text-muted-foreground">/ চ্যানেল</span>
                </Label>
                <Select
                  value={channel}
                  onValueChange={(v) => setChannel(v as Channel)}
                >
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CHANNEL_META) as Channel[]).map((c) => {
                      const m = CHANNEL_META[c];
                      return (
                        <SelectItem key={c} value={c}>
                          <span className="flex items-center gap-2">
                            {m.icon}
                            <span>{m.label}</span>
                            <span className="text-muted-foreground text-[10px]">
                              · {m.bn}
                            </span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">
                  Purpose <span className="text-muted-foreground">/ উদ্দেশ্য</span>
                </Label>
                <Select
                  value={purpose}
                  onValueChange={(v) => setPurpose(v as Purpose)}
                >
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PURPOSE_META) as Purpose[]).map((p) => {
                      const m = PURPOSE_META[p];
                      return (
                        <SelectItem key={p} value={p}>
                          <span>
                            {m.label}{" "}
                            <span className="text-muted-foreground text-[10px]">
                              · {m.bn}
                            </span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ttl slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1.5">
                  <Timer className="h-3.5 w-3.5 text-amber-600" />
                  TTL{" "}
                  <span className="text-muted-foreground">/ মেয়াদ</span>
                </Label>
                <Badge
                  variant="outline"
                  className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-0 font-mono"
                >
                  {ttlSeconds}s · {formatMMSS(ttlSeconds)}
                </Badge>
              </div>
              <Slider
                min={60}
                max={900}
                step={30}
                value={[ttlSeconds]}
                onValueChange={(v) => setTtlSeconds(v[0] ?? 300)}
                className="py-2"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>60s</span>
                <span>5m</span>
                <span>10m</span>
                <span>15m</span>
              </div>
            </div>

            {/* send button */}
            <Button
              onClick={handleSend}
              disabled={sending}
              className="w-full h-10 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm"
            >
              {sending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {sending ? "Sending…" : "Send OTP"}
            </Button>

            {/* inline error */}
            {sendError && (
              <div className="flex items-start gap-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/50 p-3">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-700 dark:text-rose-300">
                  {sendError}
                </p>
              </div>
            )}

            {/* dev preview box */}
            {activeSend?.ok && activeSend.devPreviewCode && (
              <div
                className={`relative overflow-hidden rounded-xl border-2 p-4 ${
                  codeExpired
                    ? "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40"
                    : codeExpiringSoon
                    ? "border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20"
                    : "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                      Dev Preview · ডেভ প্রিভিউ
                    </span>
                  </div>
                  <div
                    className={`flex items-center gap-1 font-mono text-xs font-semibold ${
                      codeExpired
                        ? "text-slate-500"
                        : codeExpiringSoon
                        ? "text-rose-600"
                        : "text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {codeExpired ? "expired" : formatMMSS(secondsLeft)}
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <span className="font-mono text-4xl sm:text-5xl font-bold tracking-[0.3em] text-foreground tabular-nums select-all">
                    {activeSend.devPreviewCode}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  In production this code is delivered via the provider and{" "}
                  <span className="font-semibold">never</span> returned to the
                  client.
                </p>
                {/* progress bar */}
                {!codeExpired && activeSend.ttlSeconds && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
                    <div
                      className={`h-full transition-all duration-1000 ease-linear ${
                        codeExpiringSoon ? "bg-rose-500" : "bg-emerald-500"
                      }`}
                      style={{
                        width: `${
                          activeSend.ttlSeconds > 0
                            ? (secondsLeft / activeSend.ttlSeconds) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* ---------- RIGHT: VERIFY OTP ---------- */}
        <Card className="p-6 border-0 bg-gradient-to-br from-teal-500/5 to-emerald-500/5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-teal-100 dark:bg-teal-900/30 p-2 text-teal-700 dark:text-teal-300">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-semibold leading-tight">
                  Verify OTP{" "}
                  <span className="text-muted-foreground font-normal text-sm">
                    / কোড যাচাই
                  </span>
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Confirm a recipient&apos;s one-time code.
                </p>
              </div>
            </div>
            {verifyResult?.ok && (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-0">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            )}
          </div>

          <div className="space-y-4">
            {/* recipient */}
            <div className="space-y-1.5">
              <Label htmlFor="otp-verify-recipient" className="text-xs">
                Recipient{" "}
                <span className="text-muted-foreground">/ প্রাপক</span>
              </Label>
              <Input
                id="otp-verify-recipient"
                value={verifyRecipient}
                onChange={(e) => setVerifyRecipient(e.target.value)}
                placeholder="auto-filled from last send"
                className="font-mono text-sm h-10"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-[10px] text-muted-foreground">
                Must match the recipient used when sending the OTP.
              </p>
            </div>

            {/* code input */}
            <div className="space-y-1.5">
              <Label htmlFor="otp-verify-code" className="text-xs">
                Code <span className="text-muted-foreground">/ কোড</span>
              </Label>
              <Input
                id="otp-verify-code"
                value={verifyCode}
                onChange={(e) =>
                  setVerifyCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleVerify();
                }}
                placeholder="••••••"
                inputMode="numeric"
                maxLength={6}
                className="font-mono text-2xl tracking-[0.4em] h-14 text-center"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>6 digits only</span>
                <span>{verifyCode.length}/6</span>
              </div>
            </div>

            {/* verify button */}
            <Button
              onClick={handleVerify}
              disabled={verifying || verifyCode.length !== 6}
              className="w-full h-10 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-sm disabled:opacity-60"
            >
              {verifying ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4 mr-2" />
              )}
              {verifying ? "Verifying…" : "Verify Code"}
            </Button>

            {/* results */}
            {verifyResult && verifyResult.ok && (
              <div className="rounded-xl border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4">
                <div className="flex items-start gap-2.5">
                  <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/50 p-1.5">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                      Verified successfully · সফলভাবে যাচাই হয়েছে
                    </p>
                    <div className="mt-1.5 space-y-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                      {verifyResult.recipient && (
                        <p>
                          <span className="opacity-70">Recipient:</span>{" "}
                          <span className="font-mono">
                            {maskRecipient(verifyResult.recipient)}
                          </span>
                        </p>
                      )}
                      {verifyResult.purpose && (
                        <p>
                          <span className="opacity-70">Purpose:</span>{" "}
                          {verifyResult.purpose}
                        </p>
                      )}
                      {verifyResult.verifiedAt && (
                        <p>
                          <span className="opacity-70">At:</span>{" "}
                          {formatTime(verifyResult.verifiedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {verifyResult && !verifyResult.ok && (
              <div className="rounded-xl border-2 border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 p-4">
                <div className="flex items-start gap-2.5">
                  <div className="rounded-full bg-rose-100 dark:bg-rose-900/50 p-1.5">
                    <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-rose-800 dark:text-rose-200">
                      Verification failed · যাচাই ব্যর্থ
                    </p>
                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
                      {verifyResult.error ?? "Unknown error"}
                    </p>
                    {typeof verifyResult.attemptsRemaining === "number" && (
                      <div className="mt-2 flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-0 text-[10px]"
                        >
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {verifyResult.attemptsRemaining} attempts remaining ·
                          বাকি প্রচেষ্টা
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ============ RECENT REQUESTS TABLE ============ */}
      <Card className="p-6 border-0 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-amber-100 dark:bg-amber-900/30 p-2 text-amber-700 dark:text-amber-300">
              <ListChecks className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-semibold leading-tight">
                Recent OTP Requests{" "}
                <span className="text-muted-foreground font-normal text-sm">
                  / সাম্প্রতিক অনুরোধ
                </span>
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Last {requests.length} OTP dispatches · codes masked for security.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {requests.length} records
          </Badge>
        </div>

        {requests.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <KeyRound className="h-10 w-10 mx-auto mb-3 opacity-25" />
            <p>No OTP requests yet. Send one to begin.</p>
            <p className="text-[11px] mt-1">
              এখনো কোনো ওটিপি অনুরোধ নেই। উপরের ফর্ম থেকে একটি পাঠান।
            </p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto alo-scrollbar rounded-lg border border-border/40">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[11px] uppercase tracking-wide">
                    Recipient
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">
                    Channel
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">
                    Purpose
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">
                    Status
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-right">
                    Attempts
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">
                    Created
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">
                    Expires
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => {
                  const chMeta =
                    CHANNEL_META[r.channel as Channel] ?? CHANNEL_META.sms;
                  const pMeta =
                    PURPOSE_META[r.purpose as Purpose] ?? PURPOSE_META.verification;
                  const sMeta =
                    STATUS_META[r.status as OtpStatus] ?? STATUS_META.pending;
                  return (
                    <TableRow
                      key={r.id}
                      className="text-xs hover:bg-muted/40 transition-colors"
                    >
                      <TableCell className="font-mono py-2.5">
                        {maskRecipient(r.recipient)}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Badge
                          variant="outline"
                          className={`border-0 text-[10px] gap-1 ${chMeta.tint}`}
                        >
                          {chMeta.icon}
                          {chMeta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className="text-foreground">{pMeta.label}</span>
                        <span className="text-muted-foreground ml-1 text-[10px]">
                          · {pMeta.bn}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Badge
                          variant="outline"
                          className={`border-0 text-[10px] gap-1 ${sMeta.className}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current alo-pulse" />
                          {sMeta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5 text-right font-mono tabular-nums">
                        <span
                          className={
                            r.attempts >= r.maxAttempts
                              ? "text-rose-600 font-semibold"
                              : r.attempts > 0
                              ? "text-amber-600 font-semibold"
                              : "text-muted-foreground"
                          }
                        >
                          {r.attempts}
                        </span>
                        <span className="text-muted-foreground">
                          /{r.maxAttempts}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-muted-foreground">
                        {formatTime(r.createdAt)}
                      </TableCell>
                      <TableCell className="py-2.5 text-muted-foreground">
                        {formatTime(r.expiresAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
