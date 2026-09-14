"use client";

import { useEffect, useState } from "react";
import { SectionHeader, StatusPill } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { PLATFORMS } from "@/lib/platforms";
import { Send, Clock, CheckCircle2, XCircle, Loader2, Calendar, Plus, ExternalLink, RefreshCw, AlertTriangle } from "lucide-react";

interface Post {
  id: string;
  platform: string;
  providerPostId: string | null;
  url: string | null;
  topic: string;
  status: string;
  createdAt: string;
  publishedAt: string | null;
  scheduledAt: string | null;
}

function fmtCountdown(scheduledAt: string | null) {
  if (!scheduledAt) return null;
  const diff = new Date(scheduledAt).getTime() - Date.now();
  if (diff <= 0) return "এখনই";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) {
    const d = Math.floor(h / 24);
    return `${d}দিন ${h % 24}ঘ`;
  }
  return `${h}ঘ ${m}মি`;
}

export default function PublishingQueueView() {
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState({ total: 0, scheduled: 0, queued: 0, published: 0, failed: 0, externalSetup: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "scheduled" | "queued" | "published" | "failed">("all");
  // Schedule form
  const [showForm, setShowForm] = useState(false);
  const [formPlatform, setFormPlatform] = useState("facebook");
  const [formTopic, setFormTopic] = useState("");
  const [formHours, setFormHours] = useState("2");

  const load = () =>
    fetch("/api/publishing")
      .then((r) => r.json())
      .then((d) => { setPosts(d.posts); setStats(d.stats); })
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const publishNow = async (id: string) => {
    setBusy(`publish-${id}`);
    try {
      const res = await fetch("/api/publishing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish_now", id }),
      });
      const data = await res.json();
      toast({ title: "প্রকাশিত হয়েছে ✅", description: `${data.post.platform} · ${data.post.providerPostId}` });
      load();
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (id: string) => {
    setBusy(`cancel-${id}`);
    try {
      await fetch("/api/publishing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", id }),
      });
      toast({ title: "বাতিল করা হয়েছে", variant: "destructive" });
      load();
    } finally {
      setBusy(null);
    }
  };

  const schedule = async () => {
    if (!formTopic.trim()) {
      toast({ title: "টপিক দিন", variant: "destructive" });
      return;
    }
    setBusy("schedule");
    try {
      const scheduledAt = new Date(Date.now() + Number(formHours) * 3600000).toISOString();
      await fetch("/api/publishing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "schedule", platform: formPlatform, topic: formTopic, scheduledAt }),
      });
      toast({ title: "সারিবদ্ধ হয়েছে ✅", description: `${formPlatform} · ${formHours}ঘ পরে` });
      setFormTopic("");
      setShowForm(false);
      load();
    } finally {
      setBusy(null);
    }
  };

  const filtered = posts.filter((p) => filter === "all" || p.status === filter);

  const statusIcon: Record<string, React.ReactNode> = {
    scheduled: <Clock className="h-3.5 w-3.5 text-amber-600" />,
    queued: <Clock className="h-3.5 w-3.5 text-sky-600" />,
    published: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />,
    failed: <XCircle className="h-3.5 w-3.5 text-rose-600" />,
    external_setup_required: <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />,
  };

  return (
    <div className="alo-fade-up space-y-5">
      <SectionHeader
        title="Publishing Queue"
        bn="প্রকাশনা সারি"
        desc="নির্ধারিত ও সারিবদ্ধ পোস্ট দেখুন। PublisherAgent অনুমোদনের পর আসল provider post ID ও URL সংগ্রহ করে।"
        icon={<Send className="h-5 w-5" />}
        action={
          <Button onClick={() => setShowForm(!showForm)} className="bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white">
            <Plus className="h-4 w-4 mr-1.5" /> নতুন পোস্ট নির্ধারণ
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "নির্ধারিত", value: stats.scheduled, icon: <Clock className="h-3.5 w-3.5" />, tone: "bg-amber-100 text-amber-700" },
          { label: "সারিবদ্ধ", value: stats.queued, icon: <Clock className="h-3.5 w-3.5" />, tone: "bg-sky-100 text-sky-700" },
          { label: "প্রকাশিত", value: stats.published, icon: <CheckCircle2 className="h-3.5 w-3.5" />, tone: "bg-emerald-100 text-emerald-700" },
          { label: "ব্যর্থ", value: stats.failed, icon: <XCircle className="h-3.5 w-3.5" />, tone: "bg-rose-100 text-rose-700" },
          { label: "মোট", value: stats.total, icon: <Send className="h-3.5 w-3.5" />, tone: "bg-violet-100 text-violet-700" },
        ].map((s) => (
          <Card key={s.label} className="p-3 alo-card-grad border-0">
            <div className="flex items-center gap-2">
              <span className={`rounded-lg p-1.5 ${s.tone}`}>{s.icon}</span>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Schedule form */}
      {showForm && (
        <Card className="p-4 alo-border-anim">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-600" /> নতুন পোস্ট নির্ধারণ
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">প্ল্যাটফর্ম</Label>
              <Select value={formPlatform} onValueChange={setFormPlatform}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.icon} {p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">টপিক</Label>
              <Input value={formTopic} onChange={(e) => setFormTopic(e.target.value)} placeholder="যেমন: শিশুর ঘুমের রুটিন" className="h-9" />
            </div>
            <div>
              <Label className="text-xs">ঘণ্টা পরে</Label>
              <Input type="number" value={formHours} onChange={(e) => setFormHours(e.target.value)} className="h-9" min="0" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button onClick={schedule} disabled={busy === "schedule"} className="bg-amber-500 hover:bg-amber-600">
              {busy === "schedule" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Calendar className="h-4 w-4 mr-1" />}
              নির্ধারণ করুন
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>বাতিল</Button>
          </div>
        </Card>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "scheduled", "queued", "published", "failed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f ? "bg-amber-500 text-white" : "bg-muted hover:bg-muted/70"
            }`}
          >
            {f === "all" ? "সব" : f === "scheduled" ? "নির্ধারিত" : f === "queued" ? "সারিবদ্ধ" : f === "published" ? "প্রকাশিত" : "ব্যর্থ"}
            {f !== "all" && ` (${stats[f as keyof typeof stats] ?? 0})`}
          </button>
        ))}
        <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={load}>
          <RefreshCw className="h-3 w-3 mr-1" /> রিফ্রেশ
        </Button>
      </div>

      {/* Posts list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg alo-shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Send className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">এই ফিল্টারে কোনো পোস্ট নেই</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p, i) => {
            const pdef = PLATFORMS.find((x) => x.id === p.platform);
            const countdown = fmtCountdown(p.scheduledAt);
            return (
              <Card
                key={p.id}
                className="p-3 alo-stagger alo-glow-hover border-border/60"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xl shrink-0">{pdef?.icon ?? "📱"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{p.topic}</p>
                      <StatusPill status={p.status} />
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                      <span className="capitalize">{p.platform}</span>
                      {countdown && p.status === "scheduled" && (
                        <span className="flex items-center gap-0.5 text-amber-600 font-medium">
                          <Clock className="h-2.5 w-2.5" /> {countdown}
                        </span>
                      )}
                      {p.providerPostId && (
                        <span className="font-mono">ID: {p.providerPostId}</span>
                      )}
                      {p.publishedAt && (
                        <span>{new Date(p.publishedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {(p.status === "scheduled" || p.status === "queued") && (
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => publishNow(p.id)}
                        disabled={busy === `publish-${p.id}`}
                      >
                        {busy === `publish-${p.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                        এখন প্রকাশ
                      </Button>
                    )}
                    {p.url && (
                      <a href={p.url} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                    )}
                    {(p.status === "scheduled" || p.status === "queued") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50"
                        onClick={() => cancel(p.id)}
                        disabled={busy === `cancel-${p.id}`}
                      >
                        <XCircle className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
