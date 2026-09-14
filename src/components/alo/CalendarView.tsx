"use client";

import { useEffect, useState, useRef } from "react";
import { SectionHeader, StatusPill } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PLATFORMS } from "@/lib/platforms";
import { Calendar, ChevronLeft, ChevronRight, Clock, CheckCircle2, Send, Loader2 } from "lucide-react";

interface Post {
  id: string;
  platform: string;
  topic: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
}

interface CalData {
  year: number;
  month: number;
  monthName: string;
  firstDay: number;
  daysInMonth: number;
  byDay: Record<number, Post[]>;
  totalPosts: number;
  today: string;
}

const WEEKDAYS = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র", "শনি"];
const MONTHS_BN = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];

const statusColor: Record<string, string> = {
  scheduled: "bg-amber-100 text-amber-700 border-amber-200",
  queued: "bg-sky-100 text-sky-700 border-sky-200",
  published: "bg-emerald-100 text-emerald-700 border-emerald-200",
  failed: "bg-rose-100 text-rose-700 border-rose-200",
};

const platformEmoji: Record<string, string> = {
  facebook: "📘", instagram: "📸", youtube: "▶️", tiktok: "🎵", whatsapp: "💬", telegram: "✈️", linkedin: "💼", x: "✖️", pinterest: "📌", threads: "🧵", gbp: "📍",
};

export default function CalendarView() {
  const { toast } = useToast();
  const [data, setData] = useState<CalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });

  const load = () => {
    setLoading(true);
    fetch(`/api/calendar?year=${viewDate.year}&month=${viewDate.month}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    // Fetch calendar data whenever the viewed month changes.
    let cancelled = false;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/calendar?year=${viewDate.year}&month=${viewDate.month}`);
        const d = await res.json();
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetchData();
    return () => { cancelled = true; };
  }, [viewDate]);

  const prevMonth = () => {
    setViewDate((d) => {
      const m = d.month - 1;
      if (m < 0) return { year: d.year - 1, month: 11 };
      return { ...d, month: m };
    });
  };

  const nextMonth = () => {
    setViewDate((d) => {
      const m = d.month + 1;
      if (m > 11) return { year: d.year + 1, month: 0 };
      return { ...d, month: m };
    });
  };

  const goToday = () => {
    setViewDate({ year: new Date().getFullYear(), month: new Date().getMonth() });
  };

  const today = new Date();
  const isToday = (day: number) =>
    viewDate.year === today.getFullYear() &&
    viewDate.month === today.getMonth() &&
    day === today.getDate();

  // Build calendar cells (empty cells before day 1 + days)
  const cells: (number | null)[] = [];
  for (let i = 0; i < (data?.firstDay ?? 0); i++) cells.push(null);
  for (let d = 1; d <= (data?.daysInMonth ?? 30); d++) cells.push(d);

  // Stats
  const scheduledCount = Object.values(data?.byDay ?? {}).flat().filter((p) => p.status === "scheduled").length;
  const publishedCount = Object.values(data?.byDay ?? {}).flat().filter((p) => p.status === "published").length;

  return (
    <div className="alo-fade-up space-y-5">
      <SectionHeader
        title="Content Calendar"
        bn="কনটেন্ট ক্যালেন্ডার"
        desc="মাসিক ক্যালেন্ডারে নির্ধারিত ও প্রকাশিত পোস্ট দেখুন। প্রতিটি দিনের পোস্ট সংখ্যা ও প্ল্যাটফর্ম এক নজরে।"
        icon={<Calendar className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
              <Clock className="h-3 w-3 mr-1" /> {scheduledCount} নির্ধারিত
            </Badge>
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              <CheckCircle2 className="h-3 w-3 mr-1" /> {publishedCount} প্রকাশিত
            </Badge>
          </div>
        }
      />

      {/* Month navigation */}
      <Card className="p-4 alo-card-grad border-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-bold min-w-[180px] text-center">
              {MONTHS_BN[viewDate.month]} {viewDate.year}
            </h2>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={goToday}>
              আজ
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={load}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "রিফ্রেশ"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Calendar grid */}
      <Card className="p-3 sm:p-4">
        {loading || !data ? (
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg alo-shimmer" />
            ))}
          </div>
        ) : (
          <>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-center text-[10px] sm:text-xs font-semibold text-muted-foreground py-1">
                  {d}
                </div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {cells.map((day, i) => {
                if (day === null) {
                  return <div key={i} className="h-20 sm:h-28 rounded-lg bg-muted/20" />;
                }
                const dayPosts = data.byDay[day] ?? [];
                const today_ = isToday(day);
                return (
                  <div
                    key={i}
                    className={`h-20 sm:h-28 rounded-lg border p-1.5 overflow-hidden transition-all hover:shadow-md alo-stagger ${
                      today_
                        ? "border-amber-400 bg-amber-50/40 dark:bg-amber-900/10 ring-1 ring-amber-300"
                        : dayPosts.length > 0
                        ? "border-border/60 bg-card hover:border-amber-300"
                        : "border-border/40 bg-muted/10"
                    }`}
                    style={{ animationDelay: `${i * 12}ms` }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] sm:text-xs font-bold ${today_ ? "text-amber-600" : "text-muted-foreground"}`}>
                        {day}
                      </span>
                      {dayPosts.length > 0 && (
                        <span className="text-[8px] sm:text-[9px] rounded-full bg-amber-500 text-white px-1.5 font-bold">
                          {dayPosts.length}
                        </span>
                      )}
                    </div>
                    {/* Post chips */}
                    <div className="space-y-0.5">
                      {dayPosts.slice(0, 3).map((p) => (
                        <div
                          key={p.id}
                          className={`text-[8px] sm:text-[9px] truncate rounded px-1 py-0.5 border ${statusColor[p.status] ?? "bg-muted"}`}
                          title={p.topic}
                          onClick={() => toast({ title: p.topic, description: `${p.platform} · ${p.status}` })}
                        >
                          <span className="mr-0.5">{platformEmoji[p.platform] ?? "📱"}</span>
                          <span className="hidden sm:inline">{p.topic.slice(0, 12)}</span>
                          <span className="sm:hidden">{p.topic.slice(0, 6)}</span>
                        </div>
                      ))}
                      {dayPosts.length > 3 && (
                        <div className="text-[8px] text-muted-foreground text-center">
                          +{dayPosts.length - 3} আরও
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* Legend */}
      <Card className="p-4">
        <h3 className="text-xs font-semibold mb-3 text-muted-foreground">লিজেন্ড</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(statusColor).filter(([k]) => ["scheduled", "queued", "published", "failed"].includes(k)).map(([status, cls]) => (
            <div key={status} className={`rounded-md px-2 py-1 text-[10px] border ${cls}`}>
              {status === "scheduled" ? "নির্ধারিত" : status === "queued" ? "সারিবদ্ধ" : status === "published" ? "প্রকাশিত" : "ব্যর্থ"}
            </div>
          ))}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-amber-400 ring-1 ring-amber-300" /> আজ
          </div>
        </div>
      </Card>
    </div>
  );
}
