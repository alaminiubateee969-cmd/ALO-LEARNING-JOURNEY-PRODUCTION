"use client";

import { useEffect, useState } from "react";
import { SectionHeader, StatusPill } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Database, HardDriveDownload, Trash2, Loader2, ShieldCheck, Clock, HardDrive } from "lucide-react";

interface Backup {
  id: string;
  filename: string;
  createdAt: string;
  sizeBytes: number;
  tables: Record<string, number | null>;
  status: "complete" | "partial" | "failed";
  encrypted: boolean;
  failedModels: string[];
  excludedModels: string[];
}

interface Stats {
  total: number;
  totalSizeMb: number;
  retentionDays: number;
  expiredCount: number;
}

export default function BackupsView() {
  const { toast } = useToast();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () =>
    fetch("/api/backups")
      .then((r) => r.json())
      .then((d) => { setBackups(d.backups); setStats(d.stats); })
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    setBusy("create");
    try {
      const res = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      const data = await res.json();
      if (!res.ok || !data.backup) throw new Error(data.error ?? "backup_create_failed");
      toast({
        title: data.backup.status === "complete" ? "Snapshot created" : "Partial snapshot created",
        description: `${data.backup.id} · ${data.backup.status} · ${data.backup.failedModels.length} failed · ${data.backup.excludedModels.length} excluded. This is not a restorable database backup.`,
      });
      load();
    } catch (error) {
      toast({ title: "Snapshot creation failed", description: error instanceof Error ? error.message : "backup_create_failed", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const verifyBackup = async (id: string) => {
    setBusy(`verify-${id}`);
    try {
      const res = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", id }),
      });
      const data = await res.json();
      toast({
        title: data.integrityVerified ? "Backup integrity verified" : "Backup integrity check failed",
        description: data.message ?? data.error ?? "No database restore was performed.",
        variant: data.integrityVerified ? "default" : "destructive",
      });
      load();
    } catch (error) {
      toast({ title: "Backup verification failed", description: error instanceof Error ? error.message : "backup_verify_failed", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this local snapshot file? This cannot be undone and does not delete or restore database rows.")) return;
    setBusy(`delete-${id}`);
    try {
      const res = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "backup_delete_failed");
      toast({ title: "Local snapshot deleted" });
      load();
    } catch (error) {
      toast({ title: "Snapshot deletion failed", description: error instanceof Error ? error.message : "backup_delete_failed", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const fmtSize = (b: number) => {
    if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(2) + " MB";
    if (b >= 1024) return (b / 1024).toFixed(1) + " KB";
    return b + " B";
  };

  return (
    <div className="alo-fade-up space-y-5">
      <SectionHeader
        title="Backups & Restore"
        bn="ব্যাকআপ ও রিস্টোর"
        desc="ম্যানুয়াল encrypted database-table snapshot. OTP challenge rows ও media/uploads বাদ থাকে; এটি live database restore করে না এবং scheduled/off-site backup নয়।"
        icon={<Database className="h-5 w-5" />}
        action={
          <Button onClick={create} disabled={busy === "create"} className="bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white">
            {busy === "create" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <HardDriveDownload className="h-4 w-4 mr-2" />}
            নতুন ব্যাকআপ
          </Button>
        }
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4 alo-card-grad border-0">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-amber-600" />
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">মোট ব্যাকআপ</p>
                <p className="text-xl font-bold">{stats.total}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 alo-card-grad border-0">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-emerald-600" />
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">স্টোরেজ</p>
                <p className="text-xl font-bold">{stats.totalSizeMb} MB</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 alo-card-grad border-0">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-sky-600" />
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Review threshold</p>
                <p className="text-xl font-bold">{stats.retentionDays} দিন</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 alo-card-grad border-0">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-rose-600" />
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">মেয়াদোত্তীর্ণ</p>
                <p className="text-xl font-bold">{stats.expiredCount}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Backups list */}
      <Card className="p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Database className="h-4 w-4 text-amber-600" /> ব্যাকআপ তালিকা
        </h3>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg alo-shimmer" />
            ))}
          </div>
        ) : backups.length === 0 ? (
          <div className="text-center py-12">
            <Database className="h-12 w-12 mx-auto mb-3 text-amber-400" />
            <p className="font-medium text-sm">কোনো ব্যাকআপ নেই</p>
            <p className="text-xs text-muted-foreground mt-1">Create a local encrypted table snapshot; it is not a database restore point.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[500px] alo-scrollbar pr-2">
            <div className="space-y-2">
              {backups.map((b, i) => {
                const totalRows = Object.values(b.tables).reduce<number>((sum, count) => sum + (count ?? 0), 0);
                const unreadableTables = Object.values(b.tables).filter((count) => count === null).length;
                return (
                  <div
                    key={b.id}
                    className="rounded-lg border border-border/60 p-3 alo-stagger alo-glow-hover"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{b.id}</code>
                          <StatusPill status={b.status === "complete" ? "safe" : b.status === "partial" ? "pending" : "failed"} />
                          {b.encrypted && (
                            <Badge variant="outline" className="text-[9px] bg-emerald-50 border-emerald-200 text-emerald-700">
                              <ShieldCheck className="h-2.5 w-2.5 mr-0.5" /> encrypted
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                          <span>📅 {new Date(b.createdAt).toLocaleString()}</span>
                          <span>💾 {fmtSize(b.sizeBytes)}</span>
                          <span>📊 {Object.keys(b.tables).length} table reads · {totalRows} observed rows{unreadableTables ? ` · ${unreadableTables} unreadable` : ""}</span>
                        </div>
                        {/* Table breakdown */}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {Object.entries(b.tables).slice(0, 8).map(([t, n]) => (
                            <Badge key={t} variant="outline" className="text-[9px] font-mono">
                              {t}: {n === null ? "unavailable" : n}
                            </Badge>
                          ))}
                          {Object.keys(b.tables).length > 8 && (
                            <Badge variant="outline" className="text-[9px]">+{Object.keys(b.tables).length - 8} more</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => verifyBackup(b.id)}
                          disabled={busy === `verify-${b.id}`}
                        >
                          {busy === `verify-${b.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ShieldCheck className="h-3 w-3 mr-1" />}
                          Verify
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          onClick={() => remove(b.id)}
                          disabled={busy === `delete-${b.id}`}
                        >
                          {busy === `delete-${b.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </Card>

      <Card className="p-4 bg-amber-50 border-amber-200">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <p className="font-semibold">Snapshot limitations</p>
            <p className="mt-1">
              Snapshot payloads are encrypted with AES-256-GCM. This endpoint excludes OTP challenges and uploaded/media files, does not automatically delete items after the 14-day review threshold, and only verifies payload integrity—it does not restore a database. Use an independently stored MySQL dump and a tested isolated restore procedure for recovery.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
