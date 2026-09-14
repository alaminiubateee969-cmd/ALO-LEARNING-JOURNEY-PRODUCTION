"use client";

import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-react";
import { AGENTS } from "@/lib/agents";
import { PLATFORMS } from "@/lib/platforms";
import { TELEGRAM_COMMANDS } from "@/lib/platforms";

interface PaletteItem {
  id: string;
  label: string;
  bn?: string;
  group: string;
  icon: string;
  action: () => void;
  keywords?: string;
}

export default function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onNavigate: (section: string) => void;
}) {
  const [q, setQ] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const navItems: PaletteItem[] = [
    { id: "nav-dashboard", label: "Dashboard", bn: "ড্যাশবোর্ড", group: "Navigate", icon: "📊", action: () => onNavigate("dashboard") },
    { id: "nav-agents", label: "AI Agents", bn: "এজেন্ট", group: "Navigate", icon: "🧠", action: () => onNavigate("agents") },
    { id: "nav-topics", label: "Topic Ideas", bn: "আইডিয়া", group: "Navigate", icon: "💡", action: () => onNavigate("topics") },
    { id: "nav-studio", label: "Content Studio", bn: "স্টুডিও", group: "Navigate", icon: "✨", action: () => onNavigate("studio") },
    { id: "nav-approval", label: "Approval Queue", bn: "অনুমোদন", group: "Navigate", icon: "📋", action: () => onNavigate("approval") },
    { id: "nav-rag", label: "RAG Knowledge", bn: "জ্ঞান", group: "Navigate", icon: "📚", action: () => onNavigate("rag") },
    { id: "nav-social", label: "Social Connections", bn: "সংযোগ", group: "Navigate", icon: "📤", action: () => onNavigate("social") },
    { id: "nav-analytics", label: "Analytics", bn: "অ্যানালিটিক্স", group: "Navigate", icon: "📈", action: () => onNavigate("analytics") },
    { id: "nav-comments", label: "Comments Inbox", bn: "মন্তব্য", group: "Navigate", icon: "💬", action: () => onNavigate("comments") },
    { id: "nav-telegram", label: "Telegram", bn: "টেলিগ্রাম", group: "Navigate", icon: "✈️", action: () => onNavigate("telegram") },
    { id: "nav-family", label: "Family Models", bn: "ক্যারেক্টার", group: "Navigate", icon: "👨‍👩‍👧", action: () => onNavigate("family") },
    { id: "nav-history", label: "Content History", bn: "ইতিহাস", group: "Navigate", icon: "📜", action: () => onNavigate("history") },
    { id: "nav-learning", label: "Self-Learning", bn: "শেখা", group: "Navigate", icon: "🎓", action: () => onNavigate("learning") },
    { id: "nav-backups", label: "Backups", bn: "ব্যাকআপ", group: "Navigate", icon: "💾", action: () => onNavigate("backups") },
    { id: "nav-settings", label: "Settings & Ops", bn: "সেটিংস", group: "Navigate", icon: "⚙️", action: () => onNavigate("settings") },
  ];

  const agentItems: PaletteItem[] = AGENTS.slice(0, 12).map((a) => ({
    id: `agent-${a.id}`,
    label: a.name,
    bn: a.role,
    group: "AI Agents",
    icon: "🤖",
    keywords: a.description + " " + a.tools.join(" "),
    action: () => onNavigate("agents"),
  }));

  const platformItems: PaletteItem[] = PLATFORMS.map((p) => ({
    id: `plat-${p.id}`,
    label: p.name,
    bn: p.bn,
    group: "Platforms",
    icon: p.icon,
    keywords: p.scopes.join(" "),
    action: () => onNavigate("social"),
  }));

  const telegramItems: PaletteItem[] = TELEGRAM_COMMANDS.slice(0, 8).map((c) => ({
    id: `tg-${c.cmd}`,
    label: c.cmd,
    bn: c.desc,
    group: "Telegram Commands",
    icon: "✈️",
    action: () => onNavigate("telegram"),
  }));

  const allItems = [...navItems, ...agentItems, ...platformItems, ...telegramItems];

  const filtered = q
    ? allItems.filter((it) => {
        const s = q.toLowerCase();
        return (
          it.label.toLowerCase().includes(s) ||
          (it.bn?.toLowerCase().includes(s) ?? false) ||
          (it.keywords?.toLowerCase().includes(s) ?? false) ||
          it.group.toLowerCase().includes(s)
        );
      })
    : allItems;

  // group filtered items
  const groups: { name: string; items: PaletteItem[] }[] = [];
  for (const it of filtered) {
    let g = groups.find((x) => x.name === it.group);
    if (!g) {
      g = { name: it.group, items: [] };
      groups.push(g);
    }
    g.items.push(it);
  }

  const flatFiltered = groups.flatMap((g) => g.items);

  // Reset query and active index when opened
  useEffect(() => {
    if (open) {
      setQ("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keep active index in range
  useEffect(() => {
    if (activeIdx >= flatFiltered.length) setActiveIdx(0);
  }, [flatFiltered.length, activeIdx]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(flatFiltered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatFiltered[activeIdx];
      if (item) {
        item.action();
        onOpenChange(false);
      }
    } else if (e.key === "Escape") {
      onOpenChange(false);
    }
  };

  let runningIdx = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden" style={{ top: "15%" }}>
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActiveIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="নেভিগেট করুন, এজেন্ট/প্ল্যাটফর্ম/কমান্ড খুঁজুন..."
            className="border-0 focus-visible:ring-0 h-8"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
            ESC
          </kbd>
        </div>
        <ScrollArea className="max-h-[60vh] alo-scrollbar">
          {flatFiltered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
              কোনো ম্যাচ নেই — &quot;{q}&quot;
            </div>
          ) : (
            <div className="py-1">
              {groups.map((g) => (
                <div key={g.name}>
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 bg-muted/30">
                    {g.name}
                  </p>
                  {g.items.map((it) => {
                    const idx = runningIdx++;
                    const isActive = idx === activeIdx;
                    return (
                      <button
                        key={it.id}
                        onMouseEnter={() => setActiveIdx(idx)}
                        onClick={() => { it.action(); onOpenChange(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                          isActive ? "bg-amber-100/60 text-amber-900" : "hover:bg-muted/60"
                        }`}
                      >
                        <span className="text-base shrink-0">{it.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{it.label}</p>
                          {it.bn && <p className="text-[11px] text-muted-foreground truncate">{it.bn}</p>}
                        </div>
                        {isActive && <CornerDownLeft className="h-3 w-3 text-amber-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="border-t border-border/60 px-3 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><ArrowUp className="h-2.5 w-2.5" /><ArrowDown className="h-2.5 w-2.5" /> navigate</span>
            <span className="flex items-center gap-1"><CornerDownLeft className="h-2.5 w-2.5" /> select</span>
          </div>
          <span>{flatFiltered.length} results</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
