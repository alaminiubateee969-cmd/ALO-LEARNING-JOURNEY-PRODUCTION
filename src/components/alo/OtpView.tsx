"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KeyRound, RefreshCw, ShieldCheck, AlertTriangle } from "lucide-react";

type OtpStatus = "pending" | "delivered" | "verified" | "expired" | "failed";
interface OtpRequestRow {
  id: string;
  channel: string;
  recipientLabel: string;
  purpose: string;
  status: OtpStatus;
  attempts: number;
  maxAttempts: number;
  expiresAt: string;
  verifiedAt: string | null;
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
interface OtpConfiguration {
  required: boolean;
  available: boolean;
  authConfigured: boolean;
}

const EMPTY_STATS: OtpStats = { total: 0, pending: 0, delivered: 0, verified: 0, expired: 0, failed: 0 };
const STATUS_CLASS: Record<OtpStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  delivered: "bg-sky-100 text-sky-800",
  verified: "bg-emerald-100 text-emerald-800",
  expired: "bg-slate-100 text-slate-700",
  failed: "bg-rose-100 text-rose-800",
};

export default function OtpView() {
  const [requests, setRequests] = useState<OtpRequestRow[]>([]);
  const [stats, setStats] = useState<OtpStats>(EMPTY_STATS);
  const [configuration, setConfiguration] = useState<OtpConfiguration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [historyResponse, configResponse] = await Promise.all([
        fetch("/api/otp", { cache: "no-store" }),
        fetch("/api/auth/otp/config", { cache: "no-store" }),
      ]);
      const configData = await configResponse.json();
      setConfiguration(configData);
      if (!historyResponse.ok) {
        const result = await historyResponse.json().catch(() => ({}));
        throw new Error(result.error || "OTP history is unavailable.");
      }
      const history = await historyResponse.json();
      setRequests(Array.isArray(history.requests) ? history.requests : []);
      setStats(history.stats ?? EMPTY_STATS);
    } catch (issue) {
      setRequests([]);
      setStats(EMPTY_STATS);
      setError(issue instanceof Error ? issue.message : "OTP status could not be checked.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  return (
    <div className="alo-fade-up space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-700 dark:text-amber-300">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">OTP &amp; sign-in security</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Administrator sign-in uses the separate, hashed SMS challenge flow. General SMS, email, WhatsApp, and voice OTP delivery is disabled until a real provider is implemented and verified.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4" /> Administrator sign-in OTP</div>
          <p className="mt-2 text-sm text-muted-foreground">
            {configuration?.required ? "Required for sign-in." : "Optional in this environment."} {configuration?.available ? "SMS delivery configuration is present; handset delivery is not confirmed by this status check." : "SMS delivery is not configured."}
          </p>
          <Badge className={`mt-3 ${configuration?.authConfigured ? "bg-emerald-600" : "bg-amber-600"}`}>
            {configuration?.authConfigured ? "Authentication configured" : "Setup required"}
          </Badge>
        </Card>
        <Card className="p-4">
          <div className="font-medium">General OTP delivery</div>
          <p className="mt-2 text-sm text-muted-foreground">
            No code is generated, stored, or shown here. Configure and test an approved delivery provider before enabling this feature.
          </p>
          <Badge variant="outline" className="mt-3">Disabled · no provider verified</Badge>
        </Card>
      </div>

      {error && (
        <Card className="border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
          <div className="flex items-start gap-2 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div>
            <h2 className="font-semibold">Stored request history</h2>
            <p className="text-xs text-muted-foreground">Only masked recipient labels and status metadata are returned; OTP hashes are never exposed.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(stats).map(([key, value]) => (
              <Badge key={key} variant="outline">{key}: {value}</Badge>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading status…</div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No stored general OTP requests are available.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground">
                <th className="p-3">Recipient</th><th className="p-3">Channel</th><th className="p-3">Purpose</th><th className="p-3">Status</th><th className="p-3">Attempts</th><th className="p-3">Created</th>
              </tr></thead>
              <tbody>{requests.map((request) => (
                <tr key={request.id} className="border-b last:border-0">
                  <td className="p-3 font-mono">{request.recipientLabel}</td>
                  <td className="p-3">{request.channel}</td>
                  <td className="p-3">{request.purpose}</td>
                  <td className="p-3"><Badge className={STATUS_CLASS[request.status] ?? ""}>{request.status}</Badge></td>
                  <td className="p-3">{request.attempts}/{request.maxAttempts}</td>
                  <td className="p-3">{new Date(request.createdAt).toLocaleString()}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
