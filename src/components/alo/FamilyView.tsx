"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FAMILY_CHARACTERS } from "@/lib/platforms";
import { Users, ShieldCheck, Loader2, AlertTriangle, Upload } from "lucide-react";

interface Model {
  id: string;
  characterName: string;
  personType: string;
  consentConfirmed: boolean;
  consentDate: string | null;
  active: boolean;
  createdAt: string;
}

export default function FamilyView() {
  const { toast } = useToast();
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [personType, setPersonType] = useState("user_owned");
  const [consent, setConsent] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = () =>
    fetch("/api/family")
      .then((r) => r.json())
      .then((d) => setModels(d.models))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!name.trim()) {
      toast({ title: "নাম দিন", variant: "destructive" });
      return;
    }
    if (!consent) {
      toast({ title: "Consent আবশ্যক", description: "Consent checkbox নিশ্চিত না হলে ক্যারেক্টার তৈরি হবে না।", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterName: name, personType, consentConfirmed: consent }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error);
      }
      toast({ title: "ক্যারেক্টার তৈরি হয়েছে ✅", description: `${name} — consent confirmed` });
      setName(""); setConsent(false);
      load();
    } catch (e) {
      toast({ title: "ব্যর্থ", description: String(e), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="alo-fade-up">
      <SectionHeader
        title="Family Models"
        bn="ফ্যামিলি ক্যারেক্টার"
        desc="ব্র্যান্ড ফ্যামিলি (Baby Girl, Mother, Father, Teacher, Narrator) অথবা user-owned digital character। Consent ছাড়া কোনো character তৈরি হয় না।"
        icon={<Users className="h-5 w-5" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Brand family presets */}
        <Card className="p-5">
          <h3 className="font-semibold mb-3">ব্র্যান্ড ফ্যামিলি</h3>
          <div className="space-y-2">
            {FAMILY_CHARACTERS.map((c) => (
              <div key={c.id} className="rounded-lg border border-border/60 p-3 flex items-center gap-3">
                <span className="text-2xl">{c.emoji}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{c.name} <span className="text-muted-foreground">· {c.bn}</span></p>
                  <p className="text-[11px] text-muted-foreground">{c.personType}</p>
                </div>
                <Badge variant="outline" className="text-[9px] bg-emerald-50 border-emerald-200 text-emerald-700">brand</Badge>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-800">
            ব্র্যান্ড ক্যারেক্টারগুলো identity-consistent — সব কনটেন্টে একই চেহারা, পোশাক ও ভয়েস বজায় থাকে।
          </div>
        </Card>

        {/* Create user-owned */}
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Upload className="h-4 w-4 text-amber-600" /> User-owned digital character
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">ক্যারেক্টার নাম</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="যেমন: রিয়া" />
            </div>
            <div>
              <Label className="text-xs">Person type</Label>
              <Select value={personType} onValueChange={setPersonType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["user_owned", "mother", "father", "teacher", "narrator"].map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            <Upload className="h-5 w-5 mx-auto mb-1 opacity-50" />
            Front face · Left profile · Right profile · Smiling face · (optional) full-body · (optional) voice sample
            <p className="text-[10px] mt-1">ফাইল আপলোড ডেমোতে সিমুলেটেড — storage/uploads/family/</p>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3">
            <Checkbox
              id="consent"
              checked={consent}
              onCheckedChange={(v) => setConsent(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="consent" className="text-xs text-rose-800 leading-relaxed cursor-pointer">
              আমি নিশ্চিত করছি যে এই ছবি ও ভয়েস আমার নিজের, অথবা ব্যবহারের জন্য আইনি অনুমতি আছে।
              <span className="block text-[10px] text-rose-600 mt-0.5">
                Consent নিশ্চিত না হলে কোনো digital character তৈরি হবে না।
              </span>
            </Label>
          </div>

          <Button onClick={create} disabled={creating} className="mt-3 w-full bg-amber-500 hover:bg-amber-600">
            {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
            Consent সহ ক্যারেক্টার তৈরি করুন
          </Button>
        </Card>
      </div>

      {/* Existing models */}
      <Card className="p-5 mt-4">
        <h3 className="font-semibold mb-3">নিবন্ধিত ক্যারেক্টার</h3>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse bg-muted/40 rounded-lg" />
            ))}
          </div>
        ) : models.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-40" />
            এখনো কোনো user-owned character নেই।
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {models.map((m) => (
              <div key={m.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{m.characterName}</p>
                  <Badge variant="outline" className="text-[9px]">{m.personType}</Badge>
                </div>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                  <ShieldCheck className="h-3 w-3 text-emerald-600" />
                  consent {m.consentDate ? new Date(m.consentDate).toLocaleDateString() : "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
