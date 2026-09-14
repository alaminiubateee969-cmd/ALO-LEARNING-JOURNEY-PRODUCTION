"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Lightbulb, Sparkles, ClipboardCheck, Send, BarChart3 } from "lucide-react";

interface QuickAction {
  id: string;
  label: string;
  bn: string;
  icon: React.ReactNode;
  section: string;
  color: string;
}

const ACTIONS: QuickAction[] = [
  { id: "idea", label: "New Idea", bn: "নতুন আইডিয়া", icon: <Lightbulb className="h-4 w-4" />, section: "topics", color: "text-violet-600" },
  { id: "studio", label: "Generate Content", bn: "কনটেন্ট তৈরি", icon: <Sparkles className="h-4 w-4" />, section: "studio", color: "text-amber-600" },
  { id: "approval", label: "Review Approvals", bn: "অনুমোদন দেখুন", icon: <ClipboardCheck className="h-4 w-4" />, section: "approval", color: "text-rose-600" },
  { id: "publish", label: "Publishing Queue", bn: "প্রকাশনা সারি", icon: <Send className="h-4 w-4" />, section: "publishing", color: "text-emerald-600" },
  { id: "analytics", label: "View Analytics", bn: "অ্যানালিটিক্স", icon: <BarChart3 className="h-4 w-4" />, section: "analytics", color: "text-sky-600" },
];

export default function QuickActionsFab({ onNavigate }: { onNavigate: (section: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          className="fixed bottom-4 left-4 z-50 h-12 w-12 rounded-full bg-gradient-to-br from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 shadow-lg alo-glow p-0"
          title="দ্রুত অ্যাকশন"
        >
          <Plus className={`h-5 w-5 text-white transition-transform duration-300 ${open ? "rotate-45" : ""}`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56 mb-2">
        {ACTIONS.map((a) => (
          <DropdownMenuItem
            key={a.id}
            onClick={() => { onNavigate(a.section); setOpen(false); }}
            className="cursor-pointer py-2.5"
          >
            <span className={`mr-2 ${a.color}`}>{a.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-medium">{a.label}</p>
              <p className="text-[10px] text-muted-foreground">{a.bn}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
