"use client";

import { useState } from "react";
import { SectionHeader, StatusPill } from "./primitives";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, MessageSquare, Mail, Send, Lock } from "lucide-react";

const CHANNELS = [
  { id: "calls", label: "AI Calls", bn: "কল", icon: <Phone className="h-4 w-4" /> },
  { id: "sms", label: "SMS", bn: "এসএমএস", icon: <MessageSquare className="h-4 w-4" /> },
  { id: "whatsapp", label: "WhatsApp", bn: "হোয়াটসঅ্যাপ", icon: <Send className="h-4 w-4" /> },
  { id: "email", label: "Email", bn: "ইমেইল", icon: <Mail className="h-4 w-4" /> },
];

export default function CommunicationsView() {
  const [active, setActive] = useState("calls");

  return (
    <div className="alo-fade-up space-y-5">
      <SectionHeader
        title="Communications readiness · not implemented"
        bn="যোগাযোগ কমান্ড সেন্টার"
        desc="These are planned channels and potential setup requirements only. No call, SMS, WhatsApp, or email integration, consent enforcement, or outbound message delivery is configured here; this checklist is not a compliance certification."
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
                    {channel.id === "calls" && "Not implemented. Any future voice integration would require a reviewed provider, consent controls, AI disclosure, and human handoff; no call can be placed here."}
                    {channel.id === "sms" && "Not implemented. No SMS provider or consent/opt-out enforcement is connected; no message can be sent here."}
                    {channel.id === "whatsapp" && "Not implemented. No WhatsApp Business API or message-delivery client is connected."}
                    {channel.id === "email" && "Not implemented. No SMTP sender or email settings integration is connected."}
                  </p>

                  {/* Requirements */}
                  <div className="rounded-lg bg-muted/40 p-3 mb-3">
                    <p className="text-xs font-semibold mb-2">Potential setup requirements (not verified):</p>
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
                        <strong>Proposed safeguards only:</strong> This page does not enforce consent, opt-out, sender verification, or AI disclosure. Verify these controls before any external integration.
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
