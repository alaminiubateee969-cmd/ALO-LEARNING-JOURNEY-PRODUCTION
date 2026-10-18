"use client";

import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, CheckCheck, Trash2, Loader2 } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  body: string;
  kind: string;
  read: boolean;
  createdAt: string;
}

const kindStyle: Record<string, { dot: string; bg: string; text: string }> = {
  info: { dot: "bg-sky-500", bg: "bg-sky-50", text: "text-sky-700" },
  success: { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" },
  warn: { dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700" },
  danger: { dot: "bg-rose-500", bg: "bg-rose-50", text: "text-rose-700" },
};

export default function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        setNotifications(d.notifications);
        setUnread(d.unread);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const markAll = async () => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all" }),
    });
    load();
  };

  const clearAll = async () => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear_all" }),
    });
    load();
  };

  const fmtTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "এইমাত্র";
    if (m < 60) return `${m} মিনিট আগে`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ঘণ্টা আগে`;
    const d = Math.floor(h / 24);
    return `${d} দিন আগে`;
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) load(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center alo-pulse">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 p-0" align="end">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-600" />
            <span className="font-semibold text-sm">নোটিফিকেশন</span>
            {unread > 0 && (
              <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 text-[9px] h-4 px-1.5">
                {unread} নতুন
              </Badge>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[10px] px-2"
              onClick={markAll}
              disabled={unread === 0}
              title="সব পঠিত হিসেবে চিহ্নিত করুন"
            >
              <CheckCheck className="h-3 w-3 mr-1" /> পঠিত
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[10px] px-2 text-rose-600 hover:text-rose-700"
              onClick={clearAll}
              disabled={notifications.length === 0}
              title="সব মুছুন"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <ScrollArea className="h-80 alo-scrollbar">
          {loading && notifications.length === 0 ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg alo-shimmer" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">কোনো নোটিফিকেশন নেই</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {notifications.map((n) => {
                const style = kindStyle[n.kind] ?? kindStyle.info;
                return (
                  <div
                    key={n.id}
                    className={`px-3 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer ${!n.read ? style.bg : ""}`}
                    onClick={async () => {
                      if (!n.read) {
                        await fetch("/api/notifications", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "mark_one", id: n.id }),
                        });
                        load();
                      }
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${style.dot} ${!n.read ? "alo-pulse" : "opacity-30"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">{n.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                        <p className="text-[9px] text-muted-foreground/70 mt-1">{fmtTime(n.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
