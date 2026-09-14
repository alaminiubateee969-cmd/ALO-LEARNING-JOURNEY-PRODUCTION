"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard, Brain, Sparkles, ClipboardCheck, BookOpen,
  Send, BarChart3, Terminal, Users, Settings, Menu, Heart, ShieldCheck, Bell, MessageSquare, Lightbulb, GraduationCap, History, Database, Search, Command, Video, DollarSign, Calendar, Workflow, RefreshCw, Phone, TrendingUp, Mail,
} from "lucide-react";
import Dashboard from "@/components/alo/Dashboard";
import AgentsView from "@/components/alo/AgentsView";
import ContentStudio from "@/components/alo/ContentStudio";
import ApprovalQueue from "@/components/alo/ApprovalQueue";
import RagView from "@/components/alo/RagView";
import SocialView from "@/components/alo/SocialView";
import AnalyticsView from "@/components/alo/AnalyticsView";
import TelegramView from "@/components/alo/TelegramView";
import FamilyView from "@/components/alo/FamilyView";
import SettingsView from "@/components/alo/SettingsView";
import CommentsView from "@/components/alo/CommentsView";
import TopicsView from "@/components/alo/TopicsView";
import LearningView from "@/components/alo/LearningView";
import PackageHistoryView from "@/components/alo/PackageHistoryView";
import BackupsView from "@/components/alo/BackupsView";
import CommandPalette from "@/components/alo/CommandPalette";
import NotificationPanel from "@/components/alo/NotificationPanel";
import CompanySwitcher from "@/components/alo/CompanySwitcher";
import ThemeToggle from "@/components/alo/ThemeToggle";
import ActivityTimeline from "@/components/alo/ActivityTimeline";
import VideoPipelineView from "@/components/alo/VideoPipelineView";
import PublishingQueueView from "@/components/alo/PublishingQueueView";
import CostUsageView from "@/components/alo/CostUsageView";
import CalendarView from "@/components/alo/CalendarView";
import WorkflowView from "@/components/alo/WorkflowView";
import OnboardingTour, { TourRestartButton } from "@/components/alo/OnboardingTour";
import QuickActionsFab from "@/components/alo/QuickActionsFab";
import ExportButton from "@/components/alo/ExportButton";
import LoopAIView from "@/components/alo/LoopAIView";
import FamilyStudioView from "@/components/alo/FamilyStudioView";
import CommunicationsView from "@/components/alo/CommunicationsView";
import GrowthLoopView from "@/components/alo/GrowthLoopView";
import CommandCenterView from "@/components/alo/CommandCenterView";
import SeoView from "@/components/alo/SeoView";
import InkboxView from "@/components/alo/InkboxView";

type Section =
  | "dashboard" | "agents" | "loop" | "growth" | "command" | "seo" | "inkbox" | "topics" | "studio" | "approval" | "rag"
  | "social" | "analytics" | "comments" | "telegram" | "family" | "family-studio"
  | "history" | "video" | "calendar" | "workflow" | "communications" | "learning" | "backups" | "publishing" | "costs" | "settings";

const NAV: { id: Section; label: string; bn: string; icon: React.ReactNode; group: string }[] = [
  { id: "dashboard", label: "Dashboard", bn: "ড্যাশবোর্ড", icon: <LayoutDashboard className="h-4 w-4" />, group: "Overview" },
  { id: "agents", label: "AI Agents", bn: "এজেন্ট", icon: <Brain className="h-4 w-4" />, group: "Overview" },
  { id: "workflow", label: "Workflow", bn: "ওয়ার্কফ্লো", icon: <Workflow className="h-4 w-4" />, group: "Overview" },
  { id: "loop", label: "Loop AI", bn: "লুপ এআই", icon: <RefreshCw className="h-4 w-4" />, group: "Overview" },
  { id: "growth", label: "Growth Loop", bn: "গ্রোথ", icon: <TrendingUp className="h-4 w-4" />, group: "Overview" },
  { id: "command", label: "Command Center", bn: "কমান্ড", icon: <Terminal className="h-4 w-4" />, group: "Overview" },
  { id: "inkbox", label: "Inkbox Layer", bn: "ইনকবক্স", icon: <Mail className="h-4 w-4" />, group: "Overview" },
  { id: "topics", label: "Topic Ideas", bn: "আইডিয়া", icon: <Lightbulb className="h-4 w-4" />, group: "Pipeline" },
  { id: "studio", label: "Content Studio", bn: "স্টুডিও", icon: <Sparkles className="h-4 w-4" />, group: "Pipeline" },
  { id: "approval", label: "Approval Queue", bn: "অনুমোদন", icon: <ClipboardCheck className="h-4 w-4" />, group: "Pipeline" },
  { id: "rag", label: "RAG Knowledge", bn: "জ্ঞান", icon: <BookOpen className="h-4 w-4" />, group: "Pipeline" },
  { id: "seo", label: "SEO Center", bn: "এসইও", icon: <Search className="h-4 w-4" />, group: "Pipeline" },
  { id: "history", label: "Content History", bn: "ইতিহাস", icon: <History className="h-4 w-4" />, group: "Pipeline" },
  { id: "social", label: "Social", bn: "সংযোগ", icon: <Send className="h-4 w-4" />, group: "Distribution" },
  { id: "analytics", label: "Analytics", bn: "অ্যানালিটিক্স", icon: <BarChart3 className="h-4 w-4" />, group: "Distribution" },
  { id: "comments", label: "Comments", bn: "মন্তব্য", icon: <MessageSquare className="h-4 w-4" />, group: "Distribution" },
  { id: "telegram", label: "Telegram", bn: "টেলিগ্রাম", icon: <Terminal className="h-4 w-4" />, group: "Distribution" },
  { id: "publishing", label: "Publishing Queue", bn: "প্রকাশনা", icon: <Send className="h-4 w-4" />, group: "Distribution" },
  { id: "calendar", label: "Calendar", bn: "ক্যালেন্ডার", icon: <Calendar className="h-4 w-4" />, group: "Distribution" },
  { id: "communications", label: "Communications", bn: "যোগাযোগ", icon: <Phone className="h-4 w-4" />, group: "Distribution" },
  { id: "family", label: "Family Models", bn: "ক্যারেক্টার", icon: <Users className="h-4 w-4" />, group: "Media" },
  { id: "video", label: "Video Pipeline", bn: "ভিডিও", icon: <Video className="h-4 w-4" />, group: "Media" },
  { id: "family-studio", label: "Family Studio", bn: "ফ্যামিলি", icon: <Heart className="h-4 w-4" />, group: "Media" },
  { id: "learning", label: "Self-Learning", bn: "শেখা", icon: <GraduationCap className="h-4 w-4" />, group: "System" },
  { id: "costs", label: "Cost & Usage", bn: "খরচ", icon: <DollarSign className="h-4 w-4" />, group: "System" },
  { id: "backups", label: "Backups", bn: "ব্যাকআপ", icon: <Database className="h-4 w-4" />, group: "System" },
  { id: "settings", label: "Settings & Ops", bn: "সেটিংস", icon: <Settings className="h-4 w-4" />, group: "System" },
];

const GROUPS = ["Overview", "Pipeline", "Distribution", "Media", "System"];

function NavList({ active, onPick }: { active: Section; onPick: (s: Section) => void }) {
  return (
    <nav className="space-y-4">
      {GROUPS.map((g) => (
        <div key={g}>
          <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {g}
          </p>
          <div className="space-y-0.5">
            {NAV.filter((n) => n.group === g).map((n) => (
              <button
                key={n.id}
                onClick={() => onPick(n.id)}
                className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all ${
                  active === n.id
                    ? "bg-gradient-to-r from-amber-500/15 to-rose-500/10 text-amber-700 dark:text-amber-300 font-semibold shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span className={active === n.id ? "text-amber-600" : ""}>{n.icon}</span>
                <span className="flex-1 text-left">{n.label}</span>
                <span className="text-[10px] opacity-60">{n.bn}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function Home() {
  const [section, setSection] = useState<Section>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [studioSeed, setStudioSeed] = useState<{ topic: string; audience: string } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [tourKey, setTourKey] = useState(0);

  const pick = (s: Section) => {
    setSection(s);
    setMobileOpen(false);
  };

  const promoteToStudio = (topic: string, audience: string) => {
    setStudioSeed({ topic, audience });
    setSection("studio");
  };

  // Global Cmd+K / Ctrl+K shortcut to open the command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="min-h-screen flex flex-col alo-bg">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 overflow-y-auto alo-scrollbar">
              <div className="p-4 border-b border-border/60">
                <BrandMark />
              </div>
              <div className="p-3">
                <NavList active={section} onPick={pick} />
              </div>
            </SheetContent>
          </Sheet>

          {/* Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-rose-400 flex items-center justify-center shadow-md shrink-0">
              <Heart className="h-4 w-4 text-white" fill="white" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight truncate">
                আলো <span className="alo-text-grad">Learning Journey</span>
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight truncate">
                Admin Command Center · v3.1
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1.5 ml-2">
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">
              <ShieldCheck className="h-3 w-3 mr-1" /> Protective Mode
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1 alo-pulse" /> System healthy
            </Badge>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <CompanySwitcher />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:flex items-center gap-2 h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              <Search className="h-3.5 w-3.5" />
              <span>খুঁজুন...</span>
              <kbd className="inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1 py-0.5 text-[9px] font-mono">
                <Command className="h-2.5 w-2.5" />K
              </kbd>
            </Button>
            <Button variant="ghost" size="icon" className="relative sm:hidden" onClick={() => setPaletteOpen(true)}>
              <Search className="h-4 w-4" />
            </Button>
            <NotificationPanel />
            <ThemeToggle />
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400 to-rose-400 flex items-center justify-center text-white text-xs font-bold">
              A
            </div>
          </div>
        </div>
      </header>

      {/* Body: sidebar + main */}
      <div className="flex flex-1 min-h-0">
        <aside className="hidden lg:block w-60 shrink-0 border-r border-border/60 bg-background/50 backdrop-blur-sm overflow-y-auto alo-scrollbar">
          <div className="p-3 sticky top-0">
            <NavList active={section} onPick={pick} />
          </div>
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto alo-scrollbar">
          {/* Breadcrumb context bar */}
          <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/40 px-4 sm:px-6 py-2 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">আলো</span>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-muted-foreground">{NAV.find((n) => n.id === section)?.group ?? "Overview"}</span>
            <span className="text-muted-foreground/40">/</span>
            <span className="font-medium text-amber-600">{NAV.find((n) => n.id === section)?.label ?? section}</span>
            <span className="ml-auto text-[10px] text-muted-foreground hidden sm:block">
              {NAV.find((n) => n.id === section)?.bn}
            </span>
          </div>
          <div key={section} className="p-4 sm:p-6 max-w-7xl mx-auto alo-fade-up">
            {section === "dashboard" && <Dashboard onNavigate={(s) => setSection(s as Section)} />}
            {section === "agents" && <AgentsView />}
            {section === "workflow" && <WorkflowView />}
            {section === "loop" && <LoopAIView />}
            {section === "growth" && <GrowthLoopView />}
            {section === "command" && <CommandCenterView />}
            {section === "inkbox" && <InkboxView />}
            {section === "seo" && <SeoView />}
            {section === "topics" && <TopicsView onPromote={promoteToStudio} />}
            {section === "studio" && <ContentStudio seed={studioSeed} onConsumeSeed={() => setStudioSeed(null)} />}
            {section === "approval" && <ApprovalQueue />}
            {section === "rag" && <RagView />}
            {section === "history" && <PackageHistoryView onDuplicate={(topic) => promoteToStudio(topic, "পিতামাতা")} />}
            {section === "social" && <SocialView />}
            {section === "analytics" && <AnalyticsView />}
            {section === "comments" && <CommentsView />}
            {section === "telegram" && <TelegramView />}
            {section === "publishing" && <PublishingQueueView />}
            {section === "calendar" && <CalendarView />}
            {section === "communications" && <CommunicationsView />}
            {section === "family" && <FamilyView />}
            {section === "video" && <VideoPipelineView />}
            {section === "family-studio" && <FamilyStudioView />}
            {section === "learning" && <LearningView />}
            {section === "backups" && <BackupsView />}
            {section === "costs" && <CostUsageView />}
            {section === "settings" && <SettingsView />}
          </div>
        </main>
      </div>

      {/* Global Command Palette (Cmd+K) */}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onNavigate={(s) => setSection(s as Section)}
      />

      {/* Onboarding tour (first visit) */}
      <OnboardingTour
        key={tourKey}
        onNavigate={(s) => setSection(s as Section)}
      />

      {/* Tour restart button */}
      <TourRestartButton onClick={() => { if (typeof window !== "undefined") localStorage.removeItem("alo-tour-seen"); setTourKey((k) => k + 1); }} />

      {/* Quick actions FAB */}
      <QuickActionsFab onNavigate={(s) => setSection(s as Section)} />

      {/* Export button (contextual — shown on data sections) */}
      {["analytics", "comments", "history", "publishing"].includes(section) && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
          <ExportButton />
        </div>
      )}

      {/* Sticky footer */}
      <footer className="mt-auto border-t border-border/60 bg-background/80 backdrop-blur-sm">
        <div className="px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <Heart className="h-3 w-3 text-rose-500" fill="currentColor" />
            আলো — ভালোবাসা দিয়ে শেখার পথ 💛✨
          </p>
          <p className="flex items-center gap-3">
            <span>Own AI Agents · RAG · Protective Mode</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">learn.aloeducation.com</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-rose-400 flex items-center justify-center shadow-md">
        <Heart className="h-4 w-4 text-white" fill="white" />
      </div>
      <div>
        <p className="font-bold text-sm leading-tight">
          আলো <span className="alo-text-grad">Learning Journey</span>
        </p>
        <p className="text-[10px] text-muted-foreground">Admin Command Center</p>
      </div>
    </div>
  );
}
