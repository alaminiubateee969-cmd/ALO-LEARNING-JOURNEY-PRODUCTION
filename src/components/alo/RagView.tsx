"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Search, Upload, Loader2, FileText, Database } from "lucide-react";

interface Doc {
  id: string;
  title: string;
  sourceType: string;
  content: string;
  chunkCount: number;
  createdAt: string;
}

export default function RagView() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState("manual");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [ingesting, setIngesting] = useState(false);

  // search
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const load = () =>
    fetch("/api/rag/ingest")
      .then((r) => r.json())
      .then((d) => setDocs(d.docs))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const ingest = async () => {
    if (!title.trim() || !content.trim()) {
      toast({ title: "শিরোনাম ও কনটেন্ট দিন", variant: "destructive" });
      return;
    }
    setIngesting(true);
    try {
      const res = await fetch("/api/rag/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          sourceType,
          content,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      toast({ title: "ইনজেস্ট সম্পন্ন", description: `${data.chunkCount} chunks তৈরি হয়েছে` });
      setTitle(""); setContent(""); setTags("");
      load();
    } finally {
      setIngesting(false);
    }
  };

  const search = async () => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const res = await fetch("/api/rag/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      setResults(data.results);
      if (data.results.length === 0) toast({ title: "কোনো ম্যাচ নেই", description: `"${data.query}"` });
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="alo-fade-up">
      <SectionHeader
        title="RAG Knowledge Base"
        bn="জ্ঞানভাণ্ডার"
        desc="কোম্পানি-প্রাইভেট RAG। PDF/DOCX/CSV/URL/FAQ/Policy ইনজেস্ট করুন, হাইব্রিড সার্চ করুন এবং সোর্স সাইটেশন সহ ফলাফল পান।"
        icon={<BookOpen className="h-5 w-5" />}
        action={
          <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">
            <Database className="h-3 w-3 mr-1" /> {docs.length} documents
          </Badge>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ingest */}
        <Card className="p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Upload className="h-4 w-4 text-amber-600" /> ডকুমেন্ট ইনজেস্ট
          </h3>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">শিরোনাম</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="যেমন: প্যারেন্টিং হ্যান্ডবুক v2" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">সোর্স টাইপ</Label>
                <Select value={sourceType} onValueChange={setSourceType}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["manual", "pdf", "docx", "csv", "url", "faq", "policy"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">ট্যাগ (কমা দিয়ে)</Label>
                <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="parenting, handbook" />
              </div>
            </div>
            <div>
              <Label className="text-xs">কনটেন্ট</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} placeholder="ডকুমেন্টের টেক্সট এখানে পেস্ট করুন..." />
            </div>
            <Button onClick={ingest} disabled={ingesting} className="w-full bg-violet-600 hover:bg-violet-700">
              {ingesting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              ইনজেস্ট করুন (chunk + index)
            </Button>
          </div>
        </Card>

        {/* Search */}
        <Card className="p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Search className="h-4 w-4 text-violet-600" /> হাইব্রিড সার্চ
          </h3>
          <div className="flex gap-2 mb-3">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="যেমন: স্ক্রিন টাইম কত হওয়া উচিত?"
            />
            <Button onClick={search} disabled={searching} variant="outline">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <ScrollArea className="h-80 alo-scrollbar pr-2">
            {results.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                সার্চ করুন — keyword + semantic ম্যাচ সোর্স সাইটেশন সহ দেখানো হবে।
              </div>
            ) : (
              <div className="space-y-2">
                {results.map((r, i) => (
                  <div key={i} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-3 w-3 text-violet-600 shrink-0" />
                        <span className="text-sm font-medium truncate">{r.source_title}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] shrink-0">{(r.relevance_score * 100).toFixed(0)}%</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{r.retrieved_text}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="outline" className="text-[9px]">{r.source_type}</Badge>
                      <span className="text-[10px] text-muted-foreground">{r.citation}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>
      </div>

      {/* Document list */}
      <Card className="p-5 mt-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Database className="h-4 w-4 text-violet-600" /> ইনজেস্টেড ডকুমেন্ট
        </h3>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse bg-muted/40 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {docs.map((d) => (
              <div key={d.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm truncate">{d.title}</p>
                  <Badge variant="outline" className="text-[9px]">{d.sourceType}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.content}</p>
                <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                  <span>{d.chunkCount} chunks</span>
                  <span>{new Date(d.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
