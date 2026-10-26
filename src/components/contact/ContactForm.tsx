"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Send, CheckCircle2, AlertCircle } from "lucide-react";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, message, topic }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ ok: false, msg: data.message || data.error || "Failed to send — try again." });
        return;
      }
      if (data.delivered) {
        setResult({ ok: true, msg: "✅ Message sent! We'll reply from info@learn.aloeducation.com within 24 hours." });
        setName(""); setEmail(""); setPhone(""); setTopic(""); setMessage("");
      } else {
        setResult({ ok: true, msg: data.warning || "Saved — our team will reply shortly (email delivery pending configuration)." });
      }
    } catch (err) {
      setResult({ ok: false, msg: err instanceof Error ? err.message : "Network error — try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5 bg-white dark:bg-zinc-900 shadow-sm">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} required className="h-9 mt-1" placeholder="Your full name" />
          </div>
          <div>
            <Label className="text-xs">Email *</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} required type="email" className="h-9 mt-1" placeholder="you@example.com" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Phone (optional)</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-9 mt-1" placeholder="01805-020103" />
          </div>
          <div>
            <Label className="text-xs">Topic (optional)</Label>
            <Input value={topic} onChange={e => setTopic(e.target.value)} className="h-9 mt-1" placeholder="Admissions, Course, Partnership..." />
          </div>
        </div>
        <div>
          <Label className="text-xs">Message *</Label>
          <Textarea value={message} onChange={e => setMessage(e.target.value)} required rows={5} className="mt-1" placeholder="How can we help you? Write at least 10 characters..." />
          <p className="text-[11px] text-muted-foreground mt-1">{message.length}/4000</p>
        </div>

        {result && (
          <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${result.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200" : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-200"}`}>
            {result.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
            <span className="leading-relaxed">{result.msg}</span>
          </div>
        )}

        <Button type="submit" disabled={busy} className="w-full bg-amber-500 hover:bg-amber-600 h-10">
          {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</> : <><Send className="h-4 w-4 mr-2" /> Send message</>}
        </Button>

        <p className="text-[11px] text-center text-muted-foreground">
          By sending, you agree we may reply via email/phone. We never share your contact. Calls: <a href="tel:+8801805020103" className="underline">01805-020103</a> · Facebook: <a href="https://www.facebook.com/ALOLearningJourney" target="_blank" rel="noreferrer" className="underline">ALOLearningJourney</a>
        </p>
      </form>
    </Card>
  );
}
