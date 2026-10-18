"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Palette, Globe, Mail, Bell, Cpu, Save, Loader2, RefreshCw } from "lucide-react";

interface Settings {
  brandName: string;
  brandNameBn: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  domain: string;
  timezone: string;
  language: string;
  emergencyStop: boolean;
  autoApproveLowRisk: boolean;
  notifyOnSensitive: boolean;
  notifyOnFailure: boolean;
  maxJobsPerCron: string;
  maxHeavyJobsPerCron: string;
}

const TIMEZONES = ["Asia/Dhaka", "Asia/Kolkata", "Asia/Karachi", "UTC", "America/New_York", "Europe/London"];
const LANGUAGES = [
  { value: "bn", label: "বাংলা" },
  { value: "en", label: "English" },
  { value: "bn-en", label: "বাংলা + English" },
];

export default function BrandSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setSettings(d.settings))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const update = (key: keyof Settings, value: any) => {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      toast({ title: "সেটিংস সংরক্ষিত হয়েছে ✅", description: "ব্র্যান্ড ও সিস্টেম সেটিংস আপডেট হয়েছে" });
      load();
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 rounded-lg alo-shimmer" />
        ))}
      </div>
    );
  }

  const colorSwatch = (color: string, label: string, key: keyof Settings) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2 mt-1">
        <input
          type="color"
          value={color}
          onChange={(e) => update(key, e.target.value)}
          className="h-9 w-12 rounded border border-border cursor-pointer"
        />
        <Input value={color} onChange={(e) => update(key, e.target.value)} className="h-9 font-mono text-xs" />
      </div>
    </div>
  );

  const toggleRow = (
    checked: boolean,
    onChange: (v: boolean) => void,
    label: string,
    desc: string
  ) => (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Brand identity */}
      <Card className="p-5 alo-glow-hover">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Palette className="h-4 w-4 text-amber-600" /> ব্র্যান্ড পরিচয়
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">ব্র্যান্ড নাম (EN)</Label>
            <Input value={settings.brandName} onChange={(e) => update("brandName", e.target.value)} className="h-9 mt-1" />
          </div>
          <div>
            <Label className="text-xs">ব্র্যান্ড নাম (BN)</Label>
            <Input value={settings.brandNameBn} onChange={(e) => update("brandNameBn", e.target.value)} className="h-9 mt-1" />
          </div>
        </div>
        <div className="mt-3">
          <Label className="text-xs">ট্যাগলাইন</Label>
          <Textarea value={settings.tagline} onChange={(e) => update("tagline", e.target.value)} rows={2} className="mt-1 text-sm" />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          {colorSwatch(settings.primaryColor, "প্রাথমিক রং", "primaryColor")}
          {colorSwatch(settings.secondaryColor, "গৌণ রং", "secondaryColor")}
          {colorSwatch(settings.accentColor, "অ্যাকসেন্ট রং", "accentColor")}
        </div>
        {/* Brand preview */}
        <div className="mt-4 rounded-lg border border-border/60 p-4 flex items-center gap-3">
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center shadow-md shrink-0"
            style={{ background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.secondaryColor})` }}
          >
            <span className="text-white text-lg font-bold">আ</span>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">
              {settings.brandNameBn} <span style={{ color: settings.primaryColor }}>Learning Journey</span>
            </p>
            <p className="text-xs text-muted-foreground truncate">{settings.tagline}</p>
          </div>
        </div>
      </Card>

      {/* Domain & localization */}
      <Card className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Globe className="h-4 w-4 text-emerald-600" /> ডোমেন ও ভাষা
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">ডোমেন</Label>
            <Input value={settings.domain} onChange={(e) => update("domain", e.target.value)} className="h-9 mt-1 font-mono text-sm" />
          </div>
          <div>
            <Label className="text-xs">টাইমজোন</Label>
            <Select value={settings.timezone} onValueChange={(v) => update("timezone", v)}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">ভাষা</Label>
            <Select value={settings.language} onValueChange={(v) => update("language", v)}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Email delivery / OTP are intentionally not shown as configurable until transport and security controls exist. */}
      <Card className="p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Mail className="h-4 w-4 text-sky-600" /> Email marketing & OTP
          <Badge variant="outline" className="ml-1 text-[9px]">not connected</Badge>
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Marketing Kits can create and review email drafts, but this application has no SMTP delivery or unsubscribe endpoint. Admin sign-in is email/password; email/HTTP OTP issue and verify routes are not implemented. No mail or OTP is sent. Do not paste SMTP passwords into this settings page.
        </p>
      </Card>

      {/* Notifications */}
      <Card className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Bell className="h-4 w-4 text-rose-600" /> Notification preferences
          <Badge variant="outline" className="text-[9px] ml-1">not implemented</Badge>
        </h3>
        <p className="mb-2 text-xs leading-relaxed text-muted-foreground">These values are saved as configuration only. No notification delivery service or automatic approval process is implemented.</p>
        {toggleRow(settings.notifyOnSensitive, (v) => update("notifyOnSensitive", v), "Sensitive-content notification preference", "Stored only; no alert is sent when sensitive content is recorded.")}
        {toggleRow(settings.notifyOnFailure, (v) => update("notifyOnFailure", v), "Failure notification preference", "Stored only; no alert is sent for publishing or agent failures.")}
        {toggleRow(settings.autoApproveLowRisk, (v) => update("autoApproveLowRisk", v), "Automatic low-risk approval preference (inactive)", "Stored only; content is not automatically approved by this setting.")}
      </Card>

      {/* Queue limits */}
      <Card className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Cpu className="h-4 w-4 text-violet-600" /> Queue settings
          <Badge variant="outline" className="text-[9px] ml-1">not enforced</Badge>
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Light jobs per run · stored value</Label>
            <Input type="number" value={settings.maxJobsPerCron} onChange={(e) => update("maxJobsPerCron", e.target.value)} className="h-9 mt-1" min="1" max="20" />
          </div>
          <div>
            <Label className="text-xs">Heavy jobs per run · stored value</Label>
            <Input type="number" value={settings.maxHeavyJobsPerCron} onChange={(e) => update("maxHeavyJobsPerCron", e.target.value)} className="h-9 mt-1" min="0" max="5" />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Values are stored for planning only. This checkout has no cron scheduler or background worker and does not enforce job limits, locks, timeouts, or retry/backoff behavior.
        </p>
      </Card>

      {/* Save bar */}
      <div className="flex items-center justify-between gap-2 sticky bottom-4 bg-background/80 backdrop-blur-md rounded-lg border border-border/60 p-3">
        <Button variant="outline" size="sm" onClick={load} className="h-8 text-xs">
          <RefreshCw className="h-3 w-3 mr-1" /> রিসেট
        </Button>
        <Button onClick={save} disabled={saving} className="bg-amber-500 hover:bg-amber-600">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          সেটিংস সংরক্ষণ করুন
        </Button>
      </div>
    </div>
  );
}
