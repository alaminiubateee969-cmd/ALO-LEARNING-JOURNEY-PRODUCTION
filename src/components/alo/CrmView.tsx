"use client";

import { useEffect, useState } from "react";
import { SectionHeader, StatCard, StatusPill } from "./primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Users, Briefcase, FileText, Megaphone, Plus, Loader2, TrendingUp, DollarSign, Target } from "lucide-react";

interface Lead { id: string; name: string; email: string|null; phone: string|null; company: string|null; source: string; service: string|null; budget: string|null; status: string; notes: string|null; createdAt: string; }
interface Client { id: string; name: string; email: string; phone: string|null; company: string|null; type: string; status: string; createdAt: string; }
interface Project { id: string; name: string; service: string; status: string; budget: number|null; deadline: string|null; createdAt: string; }
interface Invoice { id: string; amount: number; currency: string; status: string; dueDate: string|null; paidAt: string|null; createdAt: string; }
interface Campaign { id: string; name: string; channel: string; status: string; sentCount: number; openCount: number; createdAt: string; }

export default function CrmView() {
  const { toast } = useToast();
  const [tab, setTab] = useState("leads");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadService, setLeadService] = useState("website");

  const load = () => {
    Promise.all([
      fetch("/api/crm/leads").then(r => r.json()),
      fetch("/api/crm/clients").then(r => r.json()),
      fetch("/api/crm/projects").then(r => r.json()),
      fetch("/api/crm/invoices").then(r => r.json()),
      fetch("/api/crm/campaigns").then(r => r.json()),
    ]).then(([l, c, p, i, m]) => {
      setLeads(l.leads || []);
      setClients(c.clients || []);
      setProjects(p.projects || []);
      setInvoices(i.invoices || []);
      setCampaigns(m.campaigns || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const createLead = async () => {
    if (!leadName.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    const res = await fetch("/api/crm/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", name: leadName, email: leadEmail, phone: leadPhone, service: leadService, source: "website" }),
    });
    const d = await res.json();
    toast({ title: "Lead created ✅" });
    setShowLeadForm(false); setLeadName(""); setLeadEmail(""); setLeadPhone("");
    load();
  };

  const updateLeadStatus = async (id: string, status: string) => {
    await fetch("/api/crm/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_status", id, status }),
    });
    toast({ title: `Lead → ${status}` });
    load();
  };

  if (loading) return <div className="grid grid-cols-4 gap-3">{Array.from({length:4}).map((_,i)=><div key={i} className="h-24 rounded-xl alo-shimmer" />)}</div>;

  return (
    <div className="alo-fade-up space-y-5">
      <SectionHeader title="CRM Dashboard" bn="সিআরএম" desc="Lead management, client tracking, project pipeline, invoices, and marketing campaigns." icon={<Users className="h-5 w-5" />} action={<Button onClick={() => setShowLeadForm(!showLeadForm)} className="bg-amber-500 hover:bg-amber-600"><Plus className="h-4 w-4 mr-1" /> New Lead</Button>} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Leads" value={leads.length} icon={<Target className="h-4 w-4" />} tone="amber" />
        <StatCard label="Clients" value={clients.length} icon={<Users className="h-4 w-4" />} tone="emerald" />
        <StatCard label="Projects" value={projects.length} icon={<Briefcase className="h-4 w-4" />} tone="sky" />
        <StatCard label="Invoices" value={invoices.length} icon={<FileText className="h-4 w-4" />} tone="violet" />
        <StatCard label="Campaigns" value={campaigns.length} icon={<Megaphone className="h-4 w-4" />} tone="rose" />
      </div>

      {showLeadForm && (
        <Card className="p-4 alo-card-grad border-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div><Label className="text-xs">Name</Label><Input value={leadName} onChange={e=>setLeadName(e.target.value)} className="h-9 mt-1" /></div>
            <div><Label className="text-xs">Email</Label><Input value={leadEmail} onChange={e=>setLeadEmail(e.target.value)} className="h-9 mt-1" /></div>
            <div><Label className="text-xs">Phone</Label><Input value={leadPhone} onChange={e=>setLeadPhone(e.target.value)} className="h-9 mt-1" /></div>
            <div><Label className="text-xs">Service</Label><select value={leadService} onChange={e=>setLeadService(e.target.value)} className="h-9 w-full rounded border bg-background px-2 text-sm"><option value="website">Website</option><option value="crm">CRM</option><option value="automation">Automation</option><option value="ai">AI</option><option value="video">Video</option><option value="seo">SEO</option></select></div>
          </div>
          <Button onClick={createLead} className="mt-3 bg-amber-500 hover:bg-amber-600">Create Lead</Button>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="leads" className="text-xs">Leads</TabsTrigger>
          <TabsTrigger value="clients" className="text-xs">Clients</TabsTrigger>
          <TabsTrigger value="projects" className="text-xs">Projects</TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs">Invoices</TabsTrigger>
          <TabsTrigger value="campaigns" className="text-xs">Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-4">
          <div className="space-y-2">
            {leads.map((l, i) => (
              <Card key={l.id} className="p-3 alo-stagger" style={{ animationDelay: `${i*30}ms` }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{l.name}</p>
                    <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                      {l.email && <span>✉️ {l.email}</span>}
                      {l.phone && <span>📞 {l.phone}</span>}
                      {l.service && <Badge variant="outline" className="text-[8px]">{l.service}</Badge>}
                    </div>
                  </div>
                  <select value={l.status} onChange={e=>updateLeadStatus(l.id, e.target.value)} className="h-7 rounded border bg-background px-1 text-[10px]">
                    <option value="new">New</option>
                    <option value="qualified">Qualified</option>
                    <option value="proposal">Proposal</option>
                    <option value="negotiation">Negotiation</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
              </Card>
            ))}
            {leads.length === 0 && <Card className="p-8 text-center text-muted-foreground text-sm">No leads yet</Card>}
          </div>
        </TabsContent>

        <TabsContent value="clients" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {clients.map((c, i) => (
              <Card key={c.id} className="p-3" >
                <p className="font-semibold text-sm">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.email}</p>
                <Badge variant="outline" className="text-[9px] mt-1">{c.type}</Badge>
              </Card>
            ))}
            {clients.length === 0 && <Card className="p-8 text-center text-muted-foreground text-sm">No clients yet</Card>}
          </div>
        </TabsContent>

        <TabsContent value="projects" className="mt-4">
          <div className="space-y-2">
            {projects.map((p, i) => (
              <Card key={p.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div><p className="font-semibold text-sm">{p.name}</p><p className="text-[10px] text-muted-foreground">{p.service} · {p.budget ? `${p.budget} BDT` : "no budget"}</p></div>
                  <StatusPill status={p.status === "completed" ? "approved" : p.status === "development" ? "running" : "pending"} />
                </div>
              </Card>
            ))}
            {projects.length === 0 && <Card className="p-8 text-center text-muted-foreground text-sm">No projects yet</Card>}
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <div className="space-y-2">
            {invoices.map((inv, i) => (
              <Card key={inv.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div><p className="font-semibold text-sm">{inv.amount} {inv.currency}</p><p className="text-[10px] text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString()}</p></div>
                  <StatusPill status={inv.status === "paid" ? "approved" : inv.status === "overdue" ? "failed" : "pending"} />
                </div>
              </Card>
            ))}
            {invoices.length === 0 && <Card className="p-8 text-center text-muted-foreground text-sm">No invoices yet</Card>}
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4">
          <div className="space-y-2">
            {campaigns.map((m, i) => (
              <Card key={m.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div><p className="font-semibold text-sm">{m.name}</p><div className="flex gap-2 text-[10px] text-muted-foreground"><Badge variant="outline" className="text-[8px]">{m.channel}</Badge><span>Sent: {m.sentCount}</span><span>Open: {m.openCount}</span></div></div>
                  <StatusPill status={m.status === "completed" ? "approved" : m.status === "running" ? "running" : "pending"} />
                </div>
              </Card>
            ))}
            {campaigns.length === 0 && <Card className="p-8 text-center text-muted-foreground text-sm">No campaigns yet</Card>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
