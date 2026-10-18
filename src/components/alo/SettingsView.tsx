"use client";

import { useEffect, useState } from "react";
import { SectionHeader, StatusPill } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Settings, Server, ShieldCheck, ScrollText, Loader2, AlertOctagon, Activity } from "lucide-react";
import BrandSettings from "./BrandSettings";

interface Health {
  status: string;
  checks: { name: string; ok: boolean; detail: string }[];
  note: string;
}

export default function SettingsView() {
  const { toast } = useToast();
  const [health, setHealth] = useState<Health | null>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [emergency, setEmergency] = useState(false);

  const load = () => {
    Promise.all([
      fetch("/api/health").then((r) => r.json()),
      fetch("/api/audit").then((r) => r.json()),
    ])
      .then(([h, a]) => {
        setHealth(h);
        setAudit(a.logs);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const toggleEmergency = () => {
    setEmergency((v) => !v);
    toast({
      title: !emergency ? "জরুরি বন্ধ সক্রিয় 🛑" : "সিস্টেম পুনরায় চালু 🟢",
      description: !emergency ? "সব প্রকাশনা ও মিডিয়া জেনারেশন স্থগিত।" : "পাইপলাইন পুনরায় চালু হয়েছে।",
      variant: !emergency ? "destructive" : "default",
    });
  };

  return (
    <div className="alo-fade-up">
      <SectionHeader
        title="Settings & Ops"
        bn="সেটিংস ও পরিচালনা"
        desc="সার্ভার সক্ষমতা যাচাই, audit log, emergency stop, ব্র্যান্ড সেটিংস ও সিস্টেম স্ট্যাটাস।"
        icon={<Settings className="h-5 w-5" />}
        action={
          <Button
            variant={emergency ? "default" : "destructive"}
            onClick={toggleEmergency}
            className={emergency ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            <AlertOctagon className="h-4 w-4 mr-2" />
            {emergency ? "Resume" : "Emergency Stop"}
          </Button>
        }
      />

      {emergency && (
        <Card className="p-4 mb-4 bg-rose-50 border-rose-300">
          <div className="flex items-center gap-3">
            <AlertOctagon className="h-5 w-5 text-rose-600 alo-pulse" />
            <div className="text-sm text-rose-800">
              <p className="font-semibold">Emergency Stop সক্রিয়</p>
              <p className="text-xs">সব প্রকাশনা ও মিডিয়া জেনারেশন স্থগিত আছে। Resume চাপলে পুনরায় চালু হবে।</p>
            </div>
          </div>
        </Card>
      )}

      {/* Brand & system settings */}
      <BrandSettings />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Server health */}
        <Card className="p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Server className="h-4 w-4 text-amber-600" /> সার্ভার সক্ষমতা
          </h3>
          {loading || !health ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 animate-pulse bg-muted/40 rounded" />
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <StatusPill status={health.status === "COMPLETE" ? "safe" : "pending"} />
                <span className="text-sm font-medium">{health.status}</span>
              </div>
              <div className="space-y-1.5">
                {health.checks.map((c) => (
                  <div key={c.name} className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-border/40 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${c.ok ? "bg-emerald-500" : "bg-amber-500"}`} />
                      <span className="font-medium">{c.name}</span>
                    </div>
                    <span className="text-muted-foreground truncate text-right">{c.detail}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">{health.note}</p>
            </>
          )}
        </Card>

        {/* Pipeline status overview */}
        <Card className="p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-violet-600" /> পাইপলাইন নীতি
          </h3>
          <div className="space-y-3 text-xs">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="font-semibold mb-1">Own AI Agent নীতি</p>
              <p className="text-muted-foreground">
                External providers (OpenAI/Gemini/Claude/ElevenLabs ইত্যাদি) শুধু inference tool। মূল ব্রেন আমাদের নিজস্ব Agent Kernel + Orchestrator + RAG + Protective Mode।
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="font-semibold mb-1">cPanel-safe queue</p>
              <p className="text-muted-foreground">
                প্রতি cron run: সর্বোচ্চ ১০টি light job + ১–৩টি heavy media job। Lock, timeout, backoff সহ। Permanent worker নেই।
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="font-semibold mb-1">Protective Mode</p>
              <p className="text-muted-foreground">
                প্রতিটি content/image/voice/video/reply/post অনুমোদনের আগে child safety, medical claims, parent shaming, fear, brand tone যাচাই।
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="font-semibold mb-1">সৎ স্ট্যাটাস</p>
              <p className="text-muted-foreground">
                শুধু চারটি অবস্থা: <code className="bg-muted px-1 rounded">COMPLETE</code>, <code className="bg-muted px-1 rounded">PARTIAL</code>, <code className="bg-muted px-1 rounded">BLOCKED_EXTERNAL_SETUP</code>, <code className="bg-muted px-1 rounded">FAILED</code>। কখনো fake success নয়।
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Audit log */}
      <Card className="p-5 mt-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-violet-600" /> Audit Log (সম্পূর্ণ)
        </h3>
        <ScrollArea className="h-80 alo-scrollbar pr-2">
          <div className="space-y-1">
            {audit.map((a) => (
              <div key={a.id} className="flex items-start gap-2 text-xs py-1.5 border-b border-border/40 last:border-0">
                <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${
                  a.severity === "warn" ? "bg-amber-500" :
                  a.severity === "error" || a.severity === "critical" ? "bg-rose-500" : "bg-emerald-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a.action}</span>
                    <Badge variant="outline" className="text-[9px]">{a.severity}</Badge>
                  </div>
                  <p className="text-muted-foreground truncate">{a.detail}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(a.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
