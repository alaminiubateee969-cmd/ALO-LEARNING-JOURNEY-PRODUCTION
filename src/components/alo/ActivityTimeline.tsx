"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Activity, Loader2 } from "lucide-react";

interface ActivityItem {
  id: string;
  kind: "agent_run" | "approval" | "publish" | "comment" | "audit";
  title: string;
  detail: string;
  icon: string;
  tone: "info" | "success" | "warn" | "danger";
  timestamp: string;
}

const toneDot: Record<string, string> = {
  info: "bg-sky-500",
  success: "bg-emerald-500",
  warn: "bg-amber-500",
  danger: "bg-rose-500",
};

const kindLabel: Record<string, string> = {
  agent_run: "এজেন্ট",
  approval: "অনুমোদন",
  publish: "প্রকাশনা",
  comment: "মন্তব্য",
  audit: "অডিট",
};

function fmtTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "এইমাত্র";
  if (m < 60) return `${m}মি`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}ঘ`;
  const d = Math.floor(h / 24);
  return `${d}দিন`;
}

export default function ActivityTimeline() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () =>
      fetch("/api/activity")
        .then((r) => r.json())
        .then((d) => setItems(d.items))
        .finally(() => setLoading(false));
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-amber-600" /> কার্যকলাপ টাইমলাইন
        </h3>
        <Badge variant="outline" className="text-[9px]">{items.length} ইভেন্ট</Badge>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg alo-shimmer" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-sm">
          <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
          কোনো সাম্প্রতিক কার্যকলাপ নেই
        </div>
      ) : (
        <ScrollArea className="h-80 alo-scrollbar pr-2">
          <div className="relative">
            {/* vertical line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border/60" />
            <div className="space-y-1">
              {items.map((item, i) => (
                <div
                  key={item.id}
                  className="relative flex items-start gap-3 pl-0 py-1.5 alo-stagger"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  {/* dot */}
                  <div className={`relative z-10 mt-1 h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-background ${toneDot[item.tone]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm">{item.icon}</span>
                      <p className="text-xs font-medium truncate flex-1 min-w-0">{item.title}</p>
                      <span className="text-[9px] text-muted-foreground shrink-0">{fmtTime(item.timestamp)}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{item.detail}</p>
                  </div>
                  <Badge variant="outline" className="text-[8px] shrink-0 opacity-60">{kindLabel[item.kind]}</Badge>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      )}
    </Card>
  );
}
