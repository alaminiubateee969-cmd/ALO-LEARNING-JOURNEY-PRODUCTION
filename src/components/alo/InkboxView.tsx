"use client";

import { useEffect, useState } from "react";
import { SectionHeader, StatusPill } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, MessageSquare, ArrowRight, ShieldCheck, AlertTriangle, RefreshCw, Cpu } from "lucide-react";

interface InkboxHealth {
  available: boolean;
  status: string;
  endpoint: string | null;
  channels: string[];
  lastError: string | null;
  fallbackActive: boolean;
}

interface AgentMessageRow {
  id: string;
  senderAgentId: string;
  recipientAgentId: string;
  objective: string;
  status: string;
  channel: string;
  priority: string;
  hopCount: number;
  failureReason: string | null;
  fallbackUsed: boolean;
  createdAt: string;
}

interface InkboxData {
  health: InkboxHealth;
  identities: any[];
  messages: AgentMessageRow[];
  architecture: {
    core: string;
    adapter: string;
    fallback: string;
    principle: string;
  };
}

export default function InkboxView() {
  const { toast } = useToast();
  const [data, setData] = useState<InkboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  const load = () => {
    fetch("/api/inkbox")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const testFallback = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/inkbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_fallback" }),
      });
      const d = await res.json();
      toast({
        title: d.fallbackUsed ? "Fallback tested ✅" : "Inkbox available",
        description: d.message?.slice(0, 80),
      });
      load();
    } finally { setTesting(false); }
  };

  const sendMessage = async (sender: string, recipient: string, objective: string) => {
    try {
      const res = await fetch("/api/inkbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_message", senderAgentId: sender, recipientAgentId: recipient, objective }),
      });
      const d = await res.json();
      toast({
        title: `Message ${d.status}`,
        description: `${sender} → ${recipient} via ${d.channel}${d.fallbackUsed ? " (fallback)" : ""}`,
      });
      load();
    } catch (e) {
      toast({ title: "Failed", description: String(e), variant: "destructive" });
    }
  };

  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl alo-shimmer" />)}
      </div>
    );
  }

  const h = data.health;

  return (
    <div className="alo-fade-up space-y-5">
      <SectionHeader
        title="Inkbox Identity Layer"
        bn="ইনকবক্স আইডেন্টিটি"
        desc="OPTIONAL communication/identity adapter। ALO কোর (agents + orchestrator + DB) এর উপর Inkbox নির্ভর করে না। Inkbox বিচ্ছিন্ন হলে ALO কাজ চালিয়ে যায়।"
        icon={<Mail className="h-5 w-5" />}
        action={
          <Button onClick={testFallback} disabled={testing} variant="outline" size="sm" className="h-8">
            {testing ? <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1" />}
            Fallback Test
          </Button>
        }
      />

      {/* Architecture diagram */}
      <Card className="p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Cpu className="h-4 w-4 text-amber-600" /> Clean Architecture
        </h3>
        <div className="flex flex-col items-center gap-2 text-xs">
          <div className="rounded-lg bg-amber-100 dark:bg-amber-900/20 px-4 py-2 font-semibold text-amber-700 dark:text-amber-300">
            🧠 ALO Agents (brains)
          </div>
          <ArrowRight className="h-3 w-3 text-muted-foreground rotate-90" />
          <div className="rounded-lg bg-violet-100 dark:bg-violet-900/20 px-4 py-2 font-semibold text-violet-700 dark:text-violet-300">
            ⚙️ ALO Orchestrator (manager)
          </div>
          <ArrowRight className="h-3 w-3 text-muted-foreground rotate-90" />
          <div className="rounded-lg bg-sky-100 dark:bg-sky-900/20 px-4 py-2 font-semibold text-sky-700 dark:text-sky-300">
            🗄️ ALO Database (source of truth)
          </div>
          <ArrowRight className="h-3 w-3 text-muted-foreground rotate-90" />
          <div className={`rounded-lg px-4 py-2 font-semibold border-2 ${h.available ? "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-300" : "bg-muted/40 text-muted-foreground border-dashed border-border"}`}>
            📬 Inkbox {h.available ? "(connected)" : "(disconnected — ALO still works)"}
          </div>
          <ArrowRight className="h-3 w-3 text-muted-foreground rotate-90" />
          <div className="rounded-lg bg-rose-100 dark:bg-rose-900/20 px-4 py-2 font-semibold text-rose-700 dark:text-rose-300">
            🛡️ Human Approval (safety boundary)
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground text-center mt-3 max-w-md mx-auto">
          {data.architecture.principle}
        </p>
      </Card>

      {/* Health status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className={`p-4 ${h.available ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200" : "bg-amber-50 dark:bg-amber-900/10 border-amber-200"}`}>
          <div className="flex items-center gap-2 mb-2">
            {h.available ? <ShieldCheck className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
            <h3 className="font-semibold text-sm">Inkbox Status</h3>
          </div>
          <StatusPill status={h.available ? "connected" : "blocked_external_setup"} />
          <p className="text-[11px] text-muted-foreground mt-2">{h.lastError ?? "No errors"}</p>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-2">Fallback Channel</h3>
          <StatusPill status={h.fallbackActive ? "active" : "idle"} />
          <p className="text-[11px] text-muted-foreground mt-2">
            {h.fallbackActive
              ? "ALO is using internal DB channel for agent communication. All core operations continue normally."
              : "Inkbox is handling communication. No fallback needed."}
          </p>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-2">Available Channels</h3>
          <div className="flex flex-wrap gap-1">
            {h.channels.length > 0 ? h.channels.map((c) => (
              <Badge key={c} variant="outline" className="text-[9px]">{c}</Badge>
            )) : (
              <Badge variant="outline" className="text-[9px] bg-muted">none configured</Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Phone/SMS/iMessage require provider verification before enabling.
          </p>
        </Card>
      </div>

      {/* A2A Message Log */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-amber-600" /> Agent-to-Agent Messages
          </h3>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => sendMessage("master_orchestrator", "content_writer", "Generate parenting content")}>
            Test A2A
          </Button>
        </div>
        {data.messages.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
            কোনো A2A বার্তা নেই। &quot;Test A2A&quot; চাপুন।
          </div>
        ) : (
          <ScrollArea className="max-h-72 alo-scrollbar pr-2">
            <div className="space-y-1.5">
              {data.messages.map((msg) => (
                <div key={msg.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/40 text-xs">
                  <span className="font-medium truncate max-w-[100px]">{msg.senderAgentId}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate max-w-[100px]">{msg.recipientAgentId}</span>
                  <span className="text-muted-foreground truncate flex-1">{msg.objective}</span>
                  <Badge variant="outline" className={`text-[8px] ${msg.channel === "inkbox" ? "bg-emerald-50" : "bg-amber-50"}`}>
                    {msg.channel}
                  </Badge>
                  <StatusPill status={msg.status === "delivered" ? "safe" : msg.status === "escalated" ? "blocked" : "pending"} />
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </Card>

      {/* Agent Identities */}
      <Card className="p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Cpu className="h-4 w-4 text-violet-600" /> Agent Identities
        </h3>
        {data.identities.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            কোনো Inkbox identity কনফিগার করা নেই। এটি স্বাভাবিক — ALO কাজ চালিয়ে যাচ্ছে।
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.identities.map((ident: any) => (
              <div key={ident.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{ident.name}</p>
                  <StatusPill status={ident.status === "connected" ? "connected" : "not_connected"} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Agent: {ident.agentId}</p>
                {ident.lastError && <p className="text-[9px] text-amber-600 mt-1">{ident.lastError}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
