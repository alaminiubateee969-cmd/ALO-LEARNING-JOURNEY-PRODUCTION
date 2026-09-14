"use client";

import { useState } from "react";
import { SectionHeader, StatusPill } from "./primitives";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, MessageSquare, Mail, Send, AlertTriangle, Lock } from "lucide-react";

const CHANNELS = [
  { id: "calls", label: "AI Calls", bn: "কল", icon: <Phone className="h-4 w-4" />, status: "BLOCKED_EXTERNAL_SETUP" },
  { id: "sms", label: "SMS", bn: "এসএমএস", icon: <MessageSquare className="h-4 w-4" />, status: "BLOCKED_EXTERNAL_SETUP" },
  { id: "whatsapp", label: "WhatsApp", bn: "হোয়াটসঅ্যাপ", icon: <Send className="h-4 w-4" />, status: "BLOCKED_EXTERNAL_SETUP" },
  { id: "email", label: "Email", bn: "ইমেইল", icon: <Mail className="h-4 w-4" />, status: "BLOCKED_EXTERNAL_SETUP" },
];

export default function CommunicationsView() {
  const [active, setActive] = useState("calls");

  return (
    <div className="alo-fade-up space-y-5">
      <SectionHeader
        title="Communications Command Center"
        bn="যোগাযোগ কমান্ড সেন্টার"
        desc="AI কল, SMS, WhatsApp, ইমেইল — সকল চ্যানেল। প্রতিটির জন্য প্রদানকারী ক্রেডেনশিয়াল প্রয়োজন (BLOCKED_EXTERNAL_SETUP)। কখনো অননুমোদিত অ্যাকাউন্ট ব্যবহার করা হবে না।"
        icon={<Phone className="h-5 w-5" />}
      />

      <Tabs value={active} onValueChange={setActive}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          {CHANNELS.map((c) => (
            <TabsTrigger key={c.id} value={c.id} className="text-xs">
              <span className="mr-1.5">{c.icon}</span>
              <span className="hidden sm:inline">{c.label}</span>
              <span className="sm:hidden">{c.bn}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {CHANNELS.map((channel) => (
          <TabsContent key={channel.id} value={channel.id} className="mt-4">
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-gradient-to-br from-amber-400/20 to-rose-400/20 p-3 text-amber-600 shrink-0">
                  {channel.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold">{channel.label}</h3>
                    <StatusPill status="blocked_external_setup" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {channel.id === "calls" && "AI voice calling এর জন্য Twilio/Vonage ক্রেডেনশিয়াল প্রয়োজন। AI নিজেকে AI হিসেবে পরিচয় দেবে — কখনো মানুষের ছদ্মবেশ করবে না।"}
                    {channel.id === "sms" && "SMS প্রেরণের জন্য Twilio/MessageBird ক্রেডেনশিয়াল প্রয়োজন। Opt-out ব্যবস্থাপনা বাধ্যতামূলক।"}
                    {channel.id === "whatsapp" && "অফিশিয়াল WhatsApp Business API প্রয়োজন। অননুমোদিত অ্যাকাউন্ট ব্যবহার কঠোরভাবে নিষিদ্ধ।"}
                    {channel.id === "email" && "SMTP কনফিগারেশন প্রয়োজন (Settings-এ কনফিগার করুন)। এই স্যান্ডবক্সে sendmail উপলব্ধ নয়।"}
                  </p>

                  {/* Requirements */}
                  <div className="rounded-lg bg-muted/40 p-3 mb-3">
                    <p className="text-xs font-semibold mb-2">প্রয়োজনীয়তা:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {channel.id === "calls" && (
                        <>
                          <li>• Twilio Account SID + Auth Token</li>
                          <li>• ক্রয়কৃত ফোন নম্বর</li>
                          <li>• Voice webhook URL</li>
                          <li>• AI identification disclosure (আইনি প্রয়োজনীয়তা)</li>
                          <li>• Human transfer fallback</li>
                        </>
                      )}
                      {channel.id === "sms" && (
                        <>
                          <li>• Twilio Account SID + Auth Token</li>
                          <li>• SMS-capable ফোন নম্বর</li>
                          <li>• Opt-out keyword management (STOP/UNSUBSCRIBE)</li>
                          <li>• Consent log per recipient</li>
                        </>
                      )}
                      {channel.id === "whatsapp" && (
                        <>
                          <li>• WhatsApp Business API অ্যাকাউন্ট</li>
                          <li>• Facebook Business Manager verification</li>
                          <li>• Approved message templates</li>
                          <li>• 24h customer service window compliance</li>
                        </>
                      )}
                      {channel.id === "email" && (
                        <>
                          <li>• SMTP host + port + credentials</li>
                          <li>• Verified sender domain</li>
                          <li>• SPF/DKIM/DMARC records</li>
                          <li>• Unsubscribe link in every email</li>
                        </>
                      )}
                    </ul>
                  </div>

                  {/* Safety notice */}
                  <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 dark:bg-rose-900/10">
                    <div className="flex items-start gap-2">
                      <Lock className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-rose-800 dark:text-rose-200">
                        <strong>নিরাপত্তা নীতি:</strong> কখনো অননুমোদিত অ্যাকাউন্ট ব্যবহার করা হবে না।
                        কখনো spam করা হবে না। প্রতিটি বার্তায় consent যাচাই হবে।
                        AI কলে নিজেকে AI হিসেবে পরিচয় দিতে হবে।
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
