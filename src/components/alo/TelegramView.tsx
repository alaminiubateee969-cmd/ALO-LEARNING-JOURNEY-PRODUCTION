"use client";

import { useEffect, useState } from "react";
import { SectionHeader, StatusPill } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { TELEGRAM_COMMANDS } from "@/lib/platforms";
import { Send, Terminal, Loader2, ShieldCheck } from "lucide-react";

interface Cmd {
  id: string;
  command: string;
  senderId: string;
  status: string;
  response: string;
  createdAt: string;
}

export default function TelegramView() {
  const { toast } = useToast();
  const [commands, setCommands] = useState<Cmd[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const load = () =>
    fetch("/api/telegram")
      .then((r) => r.json())
      .then((d) => setCommands(d.commands))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const send = async (cmd?: string) => {
    const c = cmd ?? input;
    if (!c.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: c }),
      });
      const data = await res.json();
      toast({ title: data.row.status === "executed" ? "কমান্ড সফল ✅" : data.row.status, description: data.row.response });
      setInput("");
      load();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="alo-fade-up">
      <SectionHeader
        title="Telegram Command Center"
        bn="টেলিগ্রাম কমান্ড"
        desc="অনুমোদিত অ্যাডমিন chat ID ছাড়া কেউ কমান্ড চালাতে পারবে না। প্রতিদিনের রিপোর্ট স্বয়ংক্রিয়ভাবে পাঠানো হয়।"
        icon={<Send className="h-5 w-5" />}
        action={
          <Badge className="bg-cyan-100 text-cyan-700 hover:bg-cyan-100">
            <ShieldCheck className="h-3 w-3 mr-1" /> Allow-list সক্রিয়
          </Badge>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Console */}
        <Card className="p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-cyan-600" /> কনসোল
          </h3>
          <div className="flex gap-2 mb-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="/ideas  অথবা  /approve 004"
              className="font-mono text-sm"
            />
            <Button onClick={() => send()} disabled={sending} className="bg-cyan-600 hover:bg-cyan-700">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {TELEGRAM_COMMANDS.slice(0, 9).map((c) => (
              <button
                key={c.cmd}
                onClick={() => send(c.cmd.replace(/<[^>]+>/, ""))}
                className="text-left rounded-lg bg-muted hover:bg-cyan-50 hover:text-cyan-700 p-2 transition-colors"
              >
                <p className="text-[11px] font-mono font-medium truncate">{c.cmd}</p>
                <p className="text-[9px] text-muted-foreground truncate">{c.desc}</p>
              </button>
            ))}
          </div>
        </Card>

        {/* Command list reference */}
        <Card className="p-5">
          <h3 className="font-semibold mb-3">সকল কমান্ড</h3>
          <ScrollArea className="h-72 alo-scrollbar pr-2">
            <div className="space-y-1">
              {TELEGRAM_COMMANDS.map((c) => (
                <div key={c.cmd} className="flex items-start gap-2 py-1.5 border-b border-border/40 last:border-0">
                  <code className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded shrink-0">{c.cmd}</code>
                  <span className="text-[11px] text-muted-foreground flex-1">{c.desc}</span>
                  {c.admin && <Badge variant="outline" className="text-[9px] bg-amber-50 border-amber-200 text-amber-700">admin</Badge>}
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* History */}
      <Card className="p-5 mt-4">
        <h3 className="font-semibold mb-3">সাম্প্রতিক কমান্ড</h3>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse bg-muted/40 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {commands.map((c) => (
              <div key={c.id} className="rounded-lg border border-border/60 p-3 flex items-start gap-3">
                <StatusPill status={c.status} />
                <div className="flex-1 min-w-0">
                  <code className="text-xs font-mono">{c.command}</code>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{c.response}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(c.createdAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
            {commands.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">এখনো কোনো কমান্ড নেই।</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
