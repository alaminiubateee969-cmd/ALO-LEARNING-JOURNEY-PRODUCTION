"use client";

import { useEffect, useState } from "react";
import { SectionHeader, StatusPill, ProviderTag } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PLATFORMS } from "@/lib/platforms";
import { MessageSquare, ShieldAlert, Send, Loader2, CheckCircle2, AlertTriangle, Bot, User } from "lucide-react";

interface Comment {
  id: string;
  platform: string;
  authorName: string;
  authorHandle: string | null;
  text: string;
  postTopic: string | null;
  category: string;
  riskLevel: string;
  status: string;
  draftReply: string | null;
  createdAt: string;
}

const CATEGORY_META: Record<string, { label: string; tone: "safe" | "warn" | "danger" }> = {
  safe_general: { label: "Safe general", tone: "safe" },
  question: { label: "Question", tone: "safe" },
  praise: { label: "Praise", tone: "safe" },
  complaint: { label: "Complaint", tone: "warn" },
  medical_sensitive: { label: "Medical sensitive", tone: "danger" },
  development_sensitive: { label: "Development sensitive", tone: "danger" },
  abuse_risk: { label: "Abuse risk", tone: "danger" },
  emergency: { label: "Emergency", tone: "danger" },
  spam: { label: "Spam", tone: "warn" },
  toxic: { label: "Toxic", tone: "danger" },
};

const toneClass = (t: "safe" | "warn" | "danger") =>
  t === "safe" ? "bg-emerald-100 text-emerald-700" : t === "warn" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";

export default function CommentsView() {
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [stats, setStats] = useState({ total: 0, new: 0, sensitive: 0, replied: 0, escalated: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Comment | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ provider: string; usedFallback: boolean } | null>(null);
  const [filter, setFilter] = useState<"all" | "new" | "sensitive">("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const load = () =>
    fetch("/api/comments")
      .then((r) => r.json())
      .then((d) => { setComments(d.comments); setStats(d.stats); })
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const open = (c: Comment) => {
    setSelected(c);
    setDraft(c.draftReply ?? "");
    setMeta(null);
  };

  const call = async (action: string, id?: string) => {
    setBusy(action);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id ?? selected?.id, action }),
      });
      const data = await res.json();
      if (action === "classify" && selected) {
        setMeta({ provider: data.provider, usedFallback: data.usedFallback });
        toast({ title: "শ্রেণীবদ্ধ হয়েছে", description: `${data.comment.category} · ${data.rationale?.slice(0, 60)}` });
      } else if (action === "draft" && selected) {
        setMeta({ provider: data.provider, usedFallback: data.usedFallback });
        setDraft(data.comment.draftReply);
        toast({ title: "ড্রাফট উত্তর তৈরি", description: `tone: ${data.tone}` });
      } else if (action === "send") {
        toast({ title: "উত্তর পাঠানো হয়েছে ✅" });
        setSelected(null);
      } else if (action === "escalate") {
        toast({ title: "এসকেলেটেড ⚠️", description: "মানব পর্যালোচনায় পাঠানো হয়েছে", variant: "destructive" });
        setSelected(null);
      } else if (action === "ignore") {
        toast({ title: "উপেক্ষা করা হয়েছে" });
        setSelected(null);
      }
      load();
    } finally {
      setBusy(null);
    }
  };

  const sendEdited = async () => {
    if (!selected || !draft.trim()) return;
    setBusy("send");
    try {
      // persist edited draft first
      await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, action: "draft" }),
      });
      // then send
      await call("send");
    } finally {
      setBusy(null);
    }
  };

  const filtered = comments.filter((c) => {
    if (filter === "new" && !(c.status === "new" || c.status === "classified")) return false;
    if (filter === "sensitive" && !["medical_sensitive", "development_sensitive", "abuse_risk", "emergency"].includes(c.category)) return false;
    if (platformFilter !== "all" && c.platform !== platformFilter) return false;
    if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!c.text.toLowerCase().includes(q) && !c.authorName.toLowerCase().includes(q) && !(c.postTopic ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const availablePlatforms = Array.from(new Set(comments.map((c) => c.platform)));
  const availableCategories = Array.from(new Set(comments.map((c) => c.category)));

  return (
    <div className="alo-fade-up">
      <SectionHeader
        title="Comments Inbox"
        bn="মন্তব্য ইনবক্স"
        desc="CommentModerationAgent শ্রেণীবদ্ধ করে, CommunityReplyAgent শুধু safe মন্তব্যের জন্য উত্তর ড্রাফট করে। সংবেদনশীল মন্তব্য মানব পর্যালোচনায় যায়।"
        icon={<MessageSquare className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100">{stats.new} new</Badge>
            <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">{stats.sensitive} sensitive</Badge>
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{stats.replied} replied</Badge>
          </div>
        }
      />

      {/* Quick filters */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {(["all", "new", "sensitive"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f ? "bg-amber-500 text-white" : "bg-muted hover:bg-muted/70"
            }`}
          >
            {f === "all" ? "সব" : f === "new" ? `নতুন (${stats.new})` : `সংবেদনশীল (${stats.sensitive})`}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="খুঁজুন..."
            className="h-7 w-32 sm:w-40 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="h-7 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
          >
            <option value="all">সব প্ল্যাটফর্ম</option>
            {availablePlatforms.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-7 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
          >
            <option value="all">সব ক্যাটাগরি</option>
            {availableCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground mb-3">
        {filtered.length} / {comments.length} মন্তব্য দেখানো হচ্ছে
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-28 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => {
            const cat = CATEGORY_META[c.category] ?? { label: c.category, tone: "warn" as const };
            const pdef = PLATFORMS.find((x) => x.id === c.platform);
            return (
              <Card
                key={c.id}
                onClick={() => open(c)}
                className={`p-4 cursor-pointer hover:shadow-md transition-all ${
                  cat.tone === "danger" ? "border-rose-200 bg-rose-50/40" : cat.tone === "warn" ? "border-amber-200 bg-amber-50/30" : "hover:border-amber-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg">{pdef?.icon ?? "💬"}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{c.authorName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{c.authorHandle ?? c.platform}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${toneClass(cat.tone)}`}>
                    {cat.label}
                  </span>
                </div>
                <p className="text-xs mt-2 line-clamp-2">{c.text}</p>
                {c.postTopic && <p className="text-[10px] text-muted-foreground mt-1.5 truncate">📌 {c.postTopic}</p>}
                <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
                  <StatusPill status={c.status === "new" ? "pending" : c.status === "replied" ? "approved" : c.status === "escalated" ? "blocked" : c.status} />
                  <span className="text-[10px] text-amber-600 font-medium">খুলুন →</span>
                </div>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <Card className="md:col-span-2 lg:col-span-3 p-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
              এই ফিল্টারে কোনো মন্তব্য নেই।
            </Card>
          )}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selected && PLATFORMS.find((x) => x.id === selected.platform)?.icon} মন্তব্য পর্যালোচনা
            </DialogTitle>
            <DialogDescription>
              {selected?.authorName} · {selected?.platform} · {selected?.postTopic}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <ScrollArea className="max-h-[60vh] alo-scrollbar pr-3">
              <div className="space-y-4">
                {/* Original comment */}
                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-amber-400 to-rose-400 flex items-center justify-center text-white text-xs">
                      {selected.authorName[0]}
                    </div>
                    <span className="text-xs font-medium">{selected.authorName}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(selected.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm">{selected.text}</p>
                </div>

                {/* Classification */}
                <div className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold flex items-center gap-1">
                      <Bot className="h-3 w-3 text-violet-600" /> CommentModerationAgent
                    </p>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const cat = CATEGORY_META[selected.category] ?? { label: selected.category, tone: "warn" as const };
                        return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${toneClass(cat.tone)}`}>{cat.label}</span>;
                      })()}
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => call("classify")} disabled={busy === "classify"}>
                        {busy === "classify" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ShieldAlert className="h-3 w-3 mr-1" />}
                        শ্রেণীবদ্ধ করুন
                      </Button>
                    </div>
                  </div>
                  {meta && (
                    <div className="flex items-center gap-2 text-[10px]">
                      <ProviderTag provider={meta.provider} fallback={meta.usedFallback} />
                      <span className="text-muted-foreground">risk: <strong>{selected.riskLevel}</strong></span>
                    </div>
                  )}
                  {selected.riskLevel === "high" && (
                    <div className="mt-2 rounded bg-rose-50 border border-rose-200 p-2 text-[11px] text-rose-700 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      এই মন্তব্যটি সংবেদনশীল — স্বয়ংক্রিয় উত্তর নয়, মানব পর্যালোচনা দরকার।
                    </div>
                  )}
                </div>

                {/* Draft reply */}
                <div className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold flex items-center gap-1">
                      <User className="h-3 w-3 text-amber-600" /> CommunityReplyAgent ড্রাফট
                    </p>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => call("draft")} disabled={busy === "draft" || selected.riskLevel === "high"}>
                      {busy === "draft" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Bot className="h-3 w-3 mr-1" />}
                      ড্রাফট তৈরি
                    </Button>
                  </div>
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    placeholder="ড্রাফট উত্তর এখানে দেখা যাবে... সম্পাদনা করতে পারেন।"
                    disabled={selected.riskLevel === "high"}
                  />
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => call("ignore")} disabled={!!busy}>
              উপেক্ষা
            </Button>
            {selected?.riskLevel === "high" ? (
              <Button variant="destructive" onClick={() => call("escalate")} disabled={!!busy}>
                {busy === "escalate" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShieldAlert className="h-4 w-4 mr-1" />}
                মানব পর্যালোচনায় পাঠান
              </Button>
            ) : (
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={sendEdited} disabled={!draft.trim() || !!busy}>
                {busy === "send" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                উত্তর পাঠান
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
