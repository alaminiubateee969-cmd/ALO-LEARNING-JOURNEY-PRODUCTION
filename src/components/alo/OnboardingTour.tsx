"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, X, ArrowRight, ArrowLeft, Check, Rocket } from "lucide-react";

interface TourStep {
  id: string;
  title: string;
  bn: string;
  desc: string;
  icon: string;
  section?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "স্বাগতম!",
    bn: "আলো Learning Journey",
    desc: "৪০টি AI এজেন্ট, RAG জ্ঞানভাণ্ডার, Protective Mode ও সম্পূর্ণ কনটেন্ট পাইপলাইন নিয়ে বাংলা প্যারেন্টিং কনটেন্ট অটোমেশন প্ল্যাটফর্ম। চলুন দ্রুত একটি টুর নিই ✨",
    icon: "💛",
  },
  {
    id: "dashboard",
    title: "ড্যাশবোর্ড",
    bn: "Dashboard",
    desc: "১২+ KPI, স্পার্কলাইন ট্রেন্ড, পাইপলাইন ওভারভিউ, নোটিফিকেশন, অডিট লগ ও কার্যকলাপ টাইমলাইন এক নজরে।",
    icon: "📊",
    section: "dashboard",
  },
  {
    id: "studio",
    title: "কনটেন্ট স্টুডিও",
    bn: "Content Studio",
    desc: "একটি টপিক দিন → ১১টি এজেন্ট একসাথে স্ক্রিপ্ট, হুক, ক্যাপশন, SEO, হ্যাশট্যাগ, ইমেজ প্রম্পট ও ভয়েস তৈরি করে। তারপর Approval Queue-এ যায়।",
    icon: "✨",
    section: "studio",
  },
  {
    id: "approval",
    title: "অনুমোদন সারি",
    bn: "Approval Queue",
    desc: "Protective Mode রিভিউ শেষে প্রতিটি কনটেন্ট অ্যাডমিনের অনুমোদনের অপেক্ষায় থাকে। কোনো কনটেন্ট অনুমোদন ছাড়া প্রকাশিত হয় না।",
    icon: "📋",
    section: "approval",
  },
  {
    id: "agents",
    title: "৪০টি AI এজেন্ট",
    bn: "AI Agents",
    desc: "আমাদের নিজস্ব এজেন্ট কার্নেল — MasterOrchestrator থেকে QueueSupervisor পর্যন্ত। External providers শুধু inference tool।",
    icon: "🧠",
    section: "agents",
  },
  {
    id: "workflow",
    title: "এজেন্ট ওয়ার্কফ্লো",
    bn: "Workflow",
    desc: "১০-ধাপের পাইপলাইন ফ্লো ডায়াগ্রাম — Trend Research থেকে Analytics & Learning পর্যন্ত কীভাবে এজেন্টগুলো সংযুক্ত।",
    icon: "🔄",
    section: "workflow",
  },
  {
    id: "palette",
    title: "কমান্ড প্যালেট",
    bn: "Cmd+K",
    desc: "যেকোনো সময় Cmd+K (বা Ctrl+K) চাপলে গ্লোবাল সার্চ খুলে যায় — নেভিগেট, এজেন্ট, প্ল্যাটফর্ম, কমান্ড খুঁজুন।",
    icon: "⌘",
  },
  {
    id: "done",
    title: "প্রস্তুত!",
    bn: "You're all set",
    desc: "এখন আপনি প্রস্তুত। Content Studio থেকে শুরু করুন, অথবা Topic Ideas ব্রাউজ করুন। মনে রাখবেন — আলো — ভালোবাসা দিয়ে শেখার পথ 💛✨",
    icon: "🚀",
    section: "dashboard",
  },
];

export default function OnboardingTour({
  onNavigate,
}: {
  onNavigate: (section: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Show tour only on first visit (localStorage flag)
    const seen = typeof window !== "undefined" ? localStorage.getItem("alo-tour-seen") : null;
    if (!seen) {
      const t = setTimeout(() => setOpen(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const close = () => {
    setOpen(false);
    setStep(0);
    if (typeof window !== "undefined") localStorage.setItem("alo-tour-seen", "1");
  };

  const next = () => {
    const s = TOUR_STEPS[step];
    if (s.section && step < TOUR_STEPS.length - 1) {
      onNavigate(s.section);
    }
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      close();
    }
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!open) return null;

  const current = TOUR_STEPS[step];
  const progress = ((step + 1) / TOUR_STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={close}>
      <Card
        className="max-w-md w-full p-6 alo-border-anim relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 h-7 w-7"
          onClick={close}
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-muted rounded-t-lg overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-rose-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step content */}
        <div className="text-center pt-2">
          <div className="text-5xl mb-3 alo-stagger" key={current.id}>
            {current.icon}
          </div>
          <Badge variant="outline" className="text-[9px] mb-2">
            ধাপ {step + 1} / {TOUR_STEPS.length}
          </Badge>
          <h2 className="text-xl font-bold alo-fade-up" key={current.title}>
            {current.title}
          </h2>
          <p className="text-sm text-amber-600 font-medium mt-0.5">{current.bn}</p>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{current.desc}</p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={prev}
            disabled={step === 0}
            className="h-8 text-xs"
          >
            <ArrowLeft className="h-3 w-3 mr-1" /> পূর্ববর্তী
          </Button>

          {/* Dots */}
          <div className="flex gap-1">
            {TOUR_STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-amber-500" : i < step ? "w-1.5 bg-amber-300" : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>

          {step < TOUR_STEPS.length - 1 ? (
            <Button size="sm" onClick={next} className="h-8 bg-amber-500 hover:bg-amber-600">
              পরবর্তী <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={close} className="h-8 bg-emerald-600 hover:bg-emerald-700">
              <Check className="h-3 w-3 mr-1" /> সম্পন্ন
            </Button>
          )}
        </div>

        {/* Skip */}
        {step < TOUR_STEPS.length - 1 && (
          <button
            onClick={close}
            className="block mx-auto mt-3 text-[10px] text-muted-foreground hover:text-foreground"
          >
            টুর স্কিপ করুন
          </button>
        )}
      </Card>
    </div>
  );
}

// Floating help button to restart the tour
export function TourRestartButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="fixed bottom-4 right-4 z-50 h-9 shadow-lg alo-glow"
      onClick={onClick}
      title="টুর পুনরায় দেখুন"
    >
      <Rocket className="h-3.5 w-3.5 mr-1.5 text-amber-600" />
      <span className="text-xs">টুর</span>
    </Button>
  );
}
