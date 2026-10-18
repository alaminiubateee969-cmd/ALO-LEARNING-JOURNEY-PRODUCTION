"use client";

import { useEffect, useState } from "react";
import { SectionHeader, StatusPill } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ClipboardCheck, ShieldCheck, CheckCircle2, XCircle, Loader2, AlertTriangle, Send } from "lucide-react";

interface Item {
  id: string;
  topic: string;
  type: string;
  title: string;
  summary: string;
  riskLevel: string;
  blockedReasons: string | null;
  requiredEdits: string | null;
  status: string;
  createdAt: string;
}

const typeIcon: Record<string, string> = {
  content: "📝",
  image: "🖼️",
  voice: "🎙️",
  video: "🎬",
  comment: "💬",
};

export default function ApprovalQueue() {
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Item | null>(null);
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState<any>(null);
  const [acting, setActing] = useState(false);

  const load = () =>
    fetch("/api/approvals")
      .then((r) => r.json())
      .then((d) => setItems(d.items))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const openItem = (it: Item) => {
    setSelected(it);
    setNote("");
    setReview(null);
  };

  const runReview = async () => {
    if (!selected) return;
    setReviewing(true);
    try {
      const res = await fetch("/api/protective-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: selected.summary, type: selected.type }),
      });
      const data = await res.json();
      setReview(data.review);
    } finally {
      setReviewing(false);
    }
  };

  const act = async (action: "approve" | "reject" | "revise") => {
    if (!selected) return;
    setActing(true);
    try {
      await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, action, note }),
      });
      toast({
        title: action === "approve" ? "অনুমোদিত হয়েছে ✅" : action === "reject" ? "প্রত্যাখ্যাত ❌" : "সংশোধনে ফেরত 🔄",
        description: `${selected.title}`,
      });
      setSelected(null);
      load();
    } finally {
      setActing(false);
    }
  };

  const pending = items.filter((i) => i.status === "pending");
  const done = items.filter((i) => i.status !== "pending");

  return (
    <div className="alo-fade-up">
      <SectionHeader
        title="Approval Queue"
        bn="অনুমোদন সারি"
        desc="Protective Mode রিভিউ শেষে প্রতিটি আর্টিফ্যাক্ট অ্যাডমিনের অনুমোদনের অপেক্ষায় থাকে। কোনো কনটেন্ট অনুমোদন ছাড়া প্রকাশিত হয় না।"
        icon={<ClipboardCheck className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{pending.length} pending</Badge>
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{done.length} reviewed</Badge>
          </div>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-32 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {pending.map((it) => (
            <Card key={it.id} className="p-4 hover:shadow-md hover:border-amber-300 transition-all cursor-pointer" onClick={() => openItem(it)}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{typeIcon[it.type] ?? "📄"}</span>
                  <div>
                    <p className="font-semibold text-sm">{it.title}</p>
                    <p className="text-[11px] text-muted-foreground">{it.topic}</p>
                  </div>
                </div>
                <StatusPill status={it.riskLevel === "high" ? "blocked" : "pending"} />
              </div>
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{it.summary}</p>
              {it.blockedReasons && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {JSON.parse(it.blockedReasons).map((r: string) => (
                    <Badge key={r} variant="outline" className="text-[9px] bg-rose-50 border-rose-200 text-rose-700">{r}</Badge>
                  ))}
                </div>
              )}
              <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">{new Date(it.createdAt).toLocaleString()}</span>
                <span className="text-[10px] text-amber-600 font-medium">রিভিউ করুন →</span>
              </div>
            </Card>
          ))}
          {pending.length === 0 && (
            <Card className="md:col-span-2 p-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
              কোনো অনুমোদনের অপেক্ষায় নেই।
            </Card>
          )}
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground">সম্প্রতিক সিদ্ধান্ত</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {done.slice(0, 6).map((it) => (
              <Card key={it.id} className="p-3 opacity-80">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm">{typeIcon[it.type]} {it.title}</span>
                  <StatusPill status={it.status} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selected && typeIcon[selected.type]} {selected?.title}
            </DialogTitle>
            <DialogDescription>{selected?.topic} · {selected?.type}</DialogDescription>
          </DialogHeader>
          {selected && (
            <ScrollArea className="max-h-[55vh] alo-scrollbar pr-3">
              <div className="space-y-4">
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs font-semibold mb-1">Summary</p>
                  <p className="text-sm">{selected.summary}</p>
                </div>

                {selected.blockedReasons && (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 p-3">
                    <p className="text-xs font-semibold text-rose-800 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Blocked reasons</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {JSON.parse(selected.blockedReasons).map((r: string) => (
                        <Badge key={r} variant="outline" className="text-[9px] bg-rose-50 border-rose-200 text-rose-700">{r}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {selected.requiredEdits && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                    <p className="text-xs font-semibold text-amber-800">Required edits</p>
                    <ul className="text-xs text-amber-700 mt-1 list-disc list-inside">
                      {JSON.parse(selected.requiredEdits).map((r: string) => (<li key={r}>{r}</li>))}
                    </ul>
                  </div>
                )}

                {/* Protective Mode review */}
                <div className="rounded-lg border border-border/60 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-emerald-600" /> Protective Mode রিভিউ</p>
                    <Button size="sm" variant="outline" onClick={runReview} disabled={reviewing}>
                      {reviewing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ShieldCheck className="h-3 w-3 mr-1" />}
                      রান করুন
                    </Button>
                  </div>
                  {!review && !reviewing && (
                    <p className="text-[11px] text-muted-foreground">SafetyGuardianAgent রান করে child safety, medical claims, parent shaming, fear, brand tone ইত্যাদি যাচাই করুন।</p>
                  )}
                  {review && (
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <StatusPill status={review.approved ? "safe" : "needs_revision"} />
                        <span>risk: <strong>{review.riskLevel}</strong></span>
                        {review.needsHumanReview && <Badge variant="outline" className="text-[9px] bg-rose-50 border-rose-200 text-rose-700">human review</Badge>}
                      </div>
                      {review.blockedReasons?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {review.blockedReasons.map((r: string) => (
                            <Badge key={r} variant="outline" className="text-[9px] bg-rose-50 border-rose-200 text-rose-700">{r}</Badge>
                          ))}
                        </div>
                      )}
                      {review.requiredEdits?.length > 0 && (
                        <ul className="list-disc list-inside text-amber-700">
                          {review.requiredEdits.map((r: string) => (<li key={r}>{r}</li>))}
                        </ul>
                      )}
                      {review.checksPassed?.length > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">Checks passed:</p>
                          <div className="flex flex-wrap gap-1">
                            {review.checksPassed.map((c: string) => (
                              <Badge key={c} variant="outline" className="text-[9px] bg-emerald-50 border-emerald-200 text-emerald-700">{c}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {review.finalDisclaimer && (
                        <div className="rounded bg-amber-50 border border-amber-200 p-2 text-amber-800">
                          {review.finalDisclaimer}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="অ্যাডমিন নোট (ঐচ্ছিক)…"
                    rows={2}
                  />
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => act("revise")} disabled={acting}>
              <AlertTriangle className="h-4 w-4 mr-1" /> Revise
            </Button>
            <Button variant="destructive" onClick={() => act("reject")} disabled={acting}>
              <XCircle className="h-4 w-4 mr-1" /> Reject
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => act("approve")} disabled={acting}>
              {acting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Approve & Queue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
