"use client";

import { useEffect, useState } from "react";
import { SectionHeader, StatusPill } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PLATFORMS } from "@/lib/platforms";
import { Send, ShieldCheck, KeyRound, Loader2, Link2, Unlink } from "lucide-react";

interface Conn {
  id: string;
  platform: string;
  accountName: string;
  handle: string | null;
  status: string;
  tokenExpiry: string | null;
  lastSyncAt: string | null;
}

export default function SocialView() {
  const { toast } = useToast();
  const [list, setList] = useState<{ connection: Conn | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () =>
    fetch("/api/social")
      .then((r) => r.json())
      .then((d) => setList(d.connections))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const act = async (platform: string, action: "connect" | "disconnect") => {
    setBusy(platform);
    try {
      const res = await fetch("/api/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, action }),
      });
      const data = await res.json();
      toast({
        title: action === "connect" ? "OAuth শুরু" : "সংযোগ বিচ্ছিন্ন",
        description: `${platform} → ${data.status}`,
        variant: data.status === "external_setup_required" ? "destructive" : "default",
      });
      load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="alo-fade-up">
      <SectionHeader
        title="Social Connections"
        bn="সোশ্যাল সংযোগ"
        desc="অফিশিয়াল OAuth দিয়ে সংযোগ। আমরা কখনো পাসওয়ার্ড বা OTP সংরক্ষণ করি না। encrypted access/refresh token, scope validation, auto-refresh।"
        icon={<Send className="h-5 w-5" />}
        action={
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            <ShieldCheck className="h-3 w-3 mr-1" /> OAuth + PKCE
          </Badge>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {loading
          ? Array.from({ length: 11 }).map((_, i) => (
              <Card key={i} className="h-44 animate-pulse bg-muted/40" />
            ))
          : list.map((item, i) => {
              const p = PLATFORMS[i];
              const c = item.connection;
              return (
                <Card key={p.id} className="p-4 flex flex-col">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-xl ${p.bgColor} p-2.5 text-2xl`}>{p.icon}</div>
                      <div>
                        <p className="font-semibold text-sm">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground">{p.bn}</p>
                      </div>
                    </div>
                    <StatusPill status={c?.status ?? "not_connected"} />
                  </div>

                  {c && (
                    <div className="mt-3 space-y-1 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Account</span>
                        <span className="font-medium truncate max-w-[140px]">{c.accountName}</span>
                      </div>
                      {c.tokenExpiry && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Token expires</span>
                          <span className="font-medium">{new Date(c.tokenExpiry).toLocaleDateString()}</span>
                        </div>
                      )}
                      {c.lastSyncAt && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Last sync</span>
                          <span className="font-medium">{new Date(c.lastSyncAt).toLocaleTimeString()}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-3 pt-2 border-t border-border/50">
                    <p className="text-[10px] text-muted-foreground mb-1.5">Scopes</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {p.scopes.map((s) => (
                        <Badge key={s} variant="outline" className="text-[9px]">{s}</Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mt-auto flex gap-2">
                    {c?.status === "connected" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 text-xs"
                        onClick={() => act(p.id, "disconnect")}
                        disabled={busy === p.id}
                      >
                        {busy === p.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Unlink className="h-3 w-3 mr-1" />}
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs bg-amber-500 hover:bg-amber-600"
                        onClick={() => act(p.id, "connect")}
                        disabled={busy === p.id}
                      >
                        {busy === p.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Link2 className="h-3 w-3 mr-1" />}
                        Connect via OAuth
                      </Button>
                    )}
                  </div>

                  {/* Media sizes */}
                  <details className="mt-2 group">
                    <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                      {p.mediaSizes.length} media sizes
                    </summary>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {p.mediaSizes.map((s) => (
                        <Badge key={s.label} variant="outline" className="text-[9px]">
                          {s.label} {s.w}×{s.h}
                        </Badge>
                      ))}
                    </div>
                  </details>
                </Card>
              );
            })}
      </div>

      <Card className="p-4 mt-4 bg-amber-50 border-amber-200">
        <div className="flex items-start gap-3">
          <KeyRound className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <p className="font-semibold">গুরুত্বপূর্ণ — OAuth বাস্তবতা</p>
            <p className="mt-1">
              প্রতিটি প্ল্যাটফর্মের নিজস্ব OAuth flow ও app review প্রক্রিয়া আছে। সংযোগ শুধু তখনই &quot;connected&quot; হবে যখন একটি বাস্তব provider token ও account ID পাওয়া যাবে। এই ডেমোতে external_setup_required স্ট্যাটাস সৎভাবে দেখানো হয়েছে।
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
