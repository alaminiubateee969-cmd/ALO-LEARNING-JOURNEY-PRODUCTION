"use client";

import { useEffect, useState } from "react";
import { SectionHeader, StatusPill, ProviderTag } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Sparkles, Trash2, ArrowRight, Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Idea {
  id: string;
  topic: string;
  hook: string;
  angle: string;
  audience: string;
  status: string;
  createdAt: string;
}

export default function TopicsView({ onPromote }: { onPromote: (topic: string, audience: string) => void }) {
  const { toast } = useToast();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [seed, setSeed] = useState("");
  const [generating, setGenerating] = useState(false);
  const [q, setQ] = useState("");
  const [meta, setMeta] = useState<{ provider: string; usedFallback: boolean } | null>(null);

  const load = () =>
    fetch("/api/ideas")
      .then((r) => r.json())
      .then((d) => setIdeas(d.ideas))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const generate = async () => {
    setGenerating(true);
    setMeta(null);
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: seed || "প্যারেন্টিং" }),
      });
      const data = await res.json();
      setMeta({ provider: data.provider, usedFallback: data.usedFallback });
      toast({
        title: data.usedFallback ? "Local fallback দিয়ে তৈরি" : "LLM দিয়ে তৈরি ✨",
        description: `${data.ideas.length}টি নতুন আইডিয়া · ${data.provider}`,
      });
      load();
    } finally {
      setGenerating(false);
    }
  };

  const remove = async (id: string) => {
    await fetch("/api/ideas", { method: "DELETE" });
    // use POST delete for reliability with id in body
    await fetch("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    toast({ title: "আইডিয়া মুছে ফেলা হয়েছে" });
    load();
  };

  const promote = (idea: Idea) => {
    onPromote(idea.topic, idea.audience);
    toast({ title: "Content Studio-তে পাঠানো হয়েছে ✨", description: idea.topic.slice(0, 40) });
  };

  const filtered = ideas.filter((i) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return i.topic.toLowerCase().includes(s) || i.hook.toLowerCase().includes(s) || i.angle.toLowerCase().includes(s);
  });

  return (
    <div className="alo-fade-up">
      <SectionHeader
        title="Topic Ideas"
        bn="আইডিয়া ব্রাউজ"
        desc="TrendResearchAgent + TopicIdeationAgent থেকে তৈরি আইডিয়া ব্রাউজ করুন। এক ক্লিকে Content Studio-তে পাঠিয়ে সম্পূর্ণ প্যাকেজ তৈরি করুন।"
        icon={<Lightbulb className="h-5 w-5" />}
        action={
          <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">
            <Sparkles className="h-3 w-3 mr-1" /> {ideas.length} আইডিয়া
          </Badge>
        }
      />

      {/* Generate bar */}
      <Card className="p-4 mb-4 alo-card-grad border-0">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && generate()}
              placeholder="বীজ টপিক দিন (যেমন: ভাষা বিকাশ, ঘুম, স্ক্রিন টাইম)..."
              className="pl-9"
            />
          </div>
          <Button onClick={generate} disabled={generating} className="bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white">
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            নতুন আইডিয়া তৈরি করুন
          </Button>
        </div>
        {meta && (
          <div className="flex items-center gap-2 mt-2 text-[11px]">
            <span className="text-muted-foreground">শেষ প্রদানকারী:</span>
            <ProviderTag provider={meta.provider} fallback={meta.usedFallback} />
          </div>
        )}
      </Card>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="আইডিয়া ফিল্টার করুন..."
          className="max-w-xs h-9 text-sm"
        />
        <span className="text-xs text-muted-foreground">{filtered.length} / {ideas.length}</span>
      </div>

      {/* Ideas grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl alo-shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Lightbulb className="h-12 w-12 mx-auto mb-3 text-amber-400" />
          <p className="font-medium text-sm">কোনো আইডিয়া নেই</p>
          <p className="text-xs text-muted-foreground mt-1">উপরে বীজ টপিক দিন এবং &quot;নতুন আইডিয়া তৈরি করুন&quot; চাপুন।</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((idea, i) => (
            <Card
              key={idea.id}
              className="p-4 flex flex-col alo-glow-hover alo-stagger border-border/60"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="rounded-lg bg-gradient-to-br from-amber-400/20 to-rose-400/20 p-1.5">
                  <Lightbulb className="h-4 w-4 text-amber-600" />
                </div>
                <StatusPill status={idea.status === "packaged" ? "approved" : "pending"} />
              </div>
              <h3 className="font-semibold text-sm leading-snug line-clamp-2">{idea.topic}</h3>
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 italic">&quot;{idea.hook}&quot;</p>
              <div className="mt-2 space-y-1 text-[11px]">
                <div className="flex items-start gap-1.5">
                  <span className="text-muted-foreground shrink-0">কোণ:</span>
                  <span className="text-foreground/80">{idea.angle}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-muted-foreground shrink-0">দর্শক:</span>
                  <span className="text-foreground/80">{idea.audience}</span>
                </div>
              </div>
              <div className="mt-auto pt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs bg-amber-500 hover:bg-amber-600"
                  onClick={() => promote(idea)}
                >
                  <ArrowRight className="h-3 w-3 mr-1" /> প্যাকেজ তৈরি করুন
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  onClick={() => remove(idea.id)}
                  title="মুছুন"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
