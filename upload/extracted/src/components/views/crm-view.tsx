"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppStore } from "@/stores/app-store";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Plus,
  Search,
  Users,
  Handshake,
  Contact,
  Ticket,
  Loader2,
  ChevronRight,
  DollarSign,
  Building2,
  Mail,
  Briefcase,
  LayoutGrid,
  List,
  X,
  AlertCircle,
  TrendingUp,
  Filter,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  source: string;
  status: "New" | "Contacted" | "Qualified" | "Unqualified" | "Lost";
  score: number;
  phone?: string;
  createdAt: string;
}

interface Deal {
  id: string;
  title: string;
  value: number;
  stage: "Prospect" | "Qualified" | "Proposal" | "Negotiation" | "Won" | "Lost";
  contactName: string;
  contactEmail: string;
  probability: number;
  createdAt: string;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  company: string;
  position: string;
  phone: string;
  avatar?: string;
  status: "Active" | "Inactive";
}

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  priority: "Low" | "Medium" | "High" | "Critical";
  assignee: string;
  contactName: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Demo Data ─────────────────────────────────────────────────────────────────

const DEMO_LEADS: Lead[] = [
  { id: "l1", name: "Sarah Chen", email: "sarah@techvault.io", company: "TechVault Inc", source: "Website", status: "New", score: 78, phone: "+1-555-0101", createdAt: "2025-01-15" },
  { id: "l2", name: "Marcus Johnson", email: "marcus@blueridge.co", company: "BlueRidge Capital", source: "Referral", status: "Contacted", score: 65, phone: "+1-555-0102", createdAt: "2025-01-12" },
  { id: "l3", name: "Elena Rodriguez", email: "elena@novadesign.com", company: "Nova Design Studio", source: "LinkedIn", status: "Qualified", score: 92, phone: "+1-555-0103", createdAt: "2025-01-10" },
  { id: "l4", name: "David Park", email: "david@skylineventures.com", company: "Skyline Ventures", source: "Conference", status: "New", score: 45, phone: "+1-555-0104", createdAt: "2025-01-18" },
  { id: "l5", name: "Aisha Patel", email: "aisha@quantumleap.dev", company: "QuantumLeap", source: "Cold Email", status: "Contacted", score: 58, phone: "+1-555-0105", createdAt: "2025-01-08" },
  { id: "l6", name: "James Mitchell", email: "james@oakwoodent.com", company: "Oakwood Enterprises", source: "Website", status: "Qualified", score: 85, phone: "+1-555-0106", createdAt: "2025-01-05" },
  { id: "l7", name: "Lisa Wang", email: "lisa@apexlogistics.com", company: "Apex Logistics", source: "Referral", status: "Unqualified", score: 22, phone: "+1-555-0107", createdAt: "2025-01-20" },
  { id: "l8", name: "Robert Fischer", email: "robert@nuwaveenergy.com", company: "NuWave Energy", source: "Conference", status: "Lost", score: 15, phone: "+1-555-0108", createdAt: "2024-12-28" },
  { id: "l9", name: "Priya Sharma", email: "priya@zenithai.co", company: "Zenith AI", source: "LinkedIn", status: "New", score: 71, phone: "+1-555-0109", createdAt: "2025-01-22" },
  { id: "l10", name: "Tom Bradley", email: "tom@greenpath.io", company: "GreenPath Solutions", source: "Website", status: "Contacted", score: 60, phone: "+1-555-0110", createdAt: "2025-01-14" },
];

const DEMO_DEALS: Deal[] = [
  { id: "d1", title: "Enterprise SaaS License", value: 125000, stage: "Negotiation", contactName: "Elena Rodriguez", contactEmail: "elena@novadesign.com", probability: 75, createdAt: "2025-01-05" },
  { id: "d2", title: "Consulting Retainer", value: 48000, stage: "Proposal", contactName: "Marcus Johnson", contactEmail: "marcus@blueridge.co", probability: 50, createdAt: "2025-01-10" },
  { id: "d3", title: "Platform Migration", value: 200000, stage: "Qualified", contactName: "Sarah Chen", contactEmail: "sarah@techvault.io", probability: 40, createdAt: "2025-01-12" },
  { id: "d4", title: "Marketing Automation Suite", value: 35000, stage: "Won", contactName: "James Mitchell", contactEmail: "james@oakwoodent.com", probability: 100, createdAt: "2024-12-20" },
  { id: "d5", title: "Data Analytics Dashboard", value: 89000, stage: "Prospect", contactName: "Priya Sharma", contactEmail: "priya@zenithai.co", probability: 15, createdAt: "2025-01-18" },
  { id: "d6", title: "Cloud Infrastructure Setup", value: 150000, stage: "Proposal", contactName: "David Park", contactEmail: "david@skylineventures.com", probability: 55, createdAt: "2025-01-08" },
  { id: "d7", title: "API Integration Package", value: 42000, stage: "Won", contactName: "Aisha Patel", contactEmail: "aisha@quantumleap.dev", probability: 100, createdAt: "2024-12-15" },
  { id: "d8", title: "Custom CRM Module", value: 67000, stage: "Lost", contactName: "Robert Fischer", contactEmail: "robert@nuwaveenergy.com", probability: 0, createdAt: "2024-12-01" },
  { id: "d9", title: "Security Audit Package", value: 55000, stage: "Negotiation", contactName: "Tom Bradley", contactEmail: "tom@greenpath.io", probability: 70, createdAt: "2025-01-15" },
  { id: "d10", title: "AI Chatbot Deployment", value: 78000, stage: "Prospect", contactName: "Lisa Wang", contactEmail: "lisa@apexlogistics.com", probability: 20, createdAt: "2025-01-20" },
];

const DEMO_CONTACTS: Contact[] = [
  { id: "c1", name: "Sarah Chen", email: "sarah@techvault.io", company: "TechVault Inc", position: "CTO", phone: "+1-555-0101", status: "Active" },
  { id: "c2", name: "Marcus Johnson", email: "marcus@blueridge.co", company: "BlueRidge Capital", position: "VP of Operations", phone: "+1-555-0102", status: "Active" },
  { id: "c3", name: "Elena Rodriguez", email: "elena@novadesign.com", company: "Nova Design Studio", position: "Creative Director", phone: "+1-555-0103", status: "Active" },
  { id: "c4", name: "David Park", email: "david@skylineventures.com", company: "Skyline Ventures", position: "Managing Partner", phone: "+1-555-0104", status: "Active" },
  { id: "c5", name: "Aisha Patel", email: "aisha@quantumleap.dev", company: "QuantumLeap", position: "Head of Engineering", phone: "+1-555-0105", status: "Active" },
  { id: "c6", name: "James Mitchell", email: "james@oakwoodent.com", company: "Oakwood Enterprises", position: "CEO", phone: "+1-555-0106", status: "Active" },
  { id: "c7", name: "Lisa Wang", email: "lisa@apexlogistics.com", company: "Apex Logistics", position: "COO", phone: "+1-555-0107", status: "Inactive" },
  { id: "c8", name: "Robert Fischer", email: "robert@nuwaveenergy.com", company: "NuWave Energy", position: "Director of IT", phone: "+1-555-0108", status: "Inactive" },
  { id: "c9", name: "Priya Sharma", email: "priya@zenithai.co", company: "Zenith AI", position: "Product Manager", phone: "+1-555-0109", status: "Active" },
  { id: "c10", name: "Tom Bradley", email: "tom@greenpath.io", company: "GreenPath Solutions", position: "Sustainability Lead", phone: "+1-555-0110", status: "Active" },
  { id: "c11", name: "Karen Mills", email: "karen@brightcore.tech", company: "BrightCore Technologies", position: "HR Director", phone: "+1-555-0111", status: "Active" },
  { id: "c12", name: "Nathan Brooks", email: "nathan@pinnacleins.com", company: "Pinnacle Insurance", position: "Claims Manager", phone: "+1-555-0112", status: "Active" },
];

const DEMO_TICKETS: Ticket[] = [
  { id: "t1", subject: "Cannot export report to PDF", description: "User unable to export monthly reports.", status: "Open", priority: "High", assignee: "Support Team", contactName: "Elena Rodriguez", createdAt: "2025-01-20", updatedAt: "2025-01-20" },
  { id: "t2", subject: "Dashboard loading slow after update", description: "Performance degradation since v2.4.", status: "In Progress", priority: "Critical", assignee: "Engineering", contactName: "Sarah Chen", createdAt: "2025-01-19", updatedAt: "2025-01-21" },
  { id: "t3", subject: "Billing discrepancy on invoice #4821", description: "Overcharged by $200 on last invoice.", status: "Open", priority: "Medium", assignee: "Finance", contactName: "Marcus Johnson", createdAt: "2025-01-18", updatedAt: "2025-01-18" },
  { id: "t4", subject: "Request for API rate limit increase", description: "Current limit of 1000 req/min insufficient.", status: "In Progress", priority: "Low", assignee: "Engineering", contactName: "David Park", createdAt: "2025-01-17", updatedAt: "2025-01-20" },
  { id: "t5", subject: "SSO integration not working", description: "SAML SSO login fails with timeout error.", status: "Resolved", priority: "High", assignee: "Engineering", contactName: "James Mitchell", createdAt: "2025-01-15", updatedAt: "2025-01-19" },
  { id: "t6", subject: "Feature request: dark mode for mobile", description: "Users requesting dark mode on mobile app.", status: "Open", priority: "Low", assignee: "Product", contactName: "Aisha Patel", createdAt: "2025-01-22", updatedAt: "2025-01-22" },
  { id: "t7", subject: "Data sync issue between modules", description: "CRM and billing data out of sync.", status: "Closed", priority: "Critical", assignee: "Engineering", contactName: "Tom Bradley", createdAt: "2025-01-10", updatedAt: "2025-01-16" },
  { id: "t8", subject: "Password reset emails not sending", description: "SMTP configuration issue causing failed emails.", status: "Resolved", priority: "High", assignee: "DevOps", contactName: "Priya Sharma", createdAt: "2025-01-14", updatedAt: "2025-01-18" },
  { id: "t9", subject: "Webhook delivery failures", description: "Multiple webhook endpoints returning 5xx.", status: "In Progress", priority: "Medium", assignee: "Engineering", contactName: "Lisa Wang", createdAt: "2025-01-21", updatedAt: "2025-01-22" },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const STATUS_STYLES: Record<string, string> = {
  New: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  Contacted: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  Qualified: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  Unqualified: "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  Lost: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800",
};

const TICKET_STATUS_STYLES: Record<string, string> = {
  Open: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  "In Progress": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  Resolved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  Closed: "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-400 border-slate-200 dark:border-slate-700",
};

const PRIORITY_STYLES: Record<string, string> = {
  Low: "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  Medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  High: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  Critical: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800",
};

const STAGE_COLORS: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  Prospect: { bg: "bg-slate-500/10", border: "border-slate-500/30", text: "text-slate-600 dark:text-slate-300", accent: "bg-slate-500" },
  Qualified: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-600 dark:text-blue-300", accent: "bg-blue-500" },
  Proposal: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-600 dark:text-amber-300", accent: "bg-amber-500" },
  Negotiation: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-600 dark:text-orange-300", accent: "bg-orange-500" },
  Won: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-600 dark:text-emerald-300", accent: "bg-emerald-500" },
  Lost: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-600 dark:text-red-300", accent: "bg-red-500" },
};

const PIPELINE_STAGES = ["Prospect", "Qualified", "Proposal", "Negotiation", "Won", "Lost"] as const;

async function fetchWithToken<T>(path: string, fallback: T): Promise<T> {
  try {
    const token = localStorage.getItem("mos_token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(path, { headers });
    if (res.ok) {
      const json = await res.json();
      if (json && typeof json === "object" && "data" in json) return json.data as T;
      return json as T;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

// ─── Score Bar ──────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 80) return "bg-emerald-500";
    if (s >= 60) return "bg-amber-500";
    if (s >= 40) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${getColor(score)}`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs font-medium text-muted-foreground tabular-nums w-6 text-right">{score}</span>
    </div>
  );
}

// ─── Glass Card ──────────────────────────────────────────────────────────────────

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <Card
      className={`border-white/20 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg ${className}`}
    >
      {children}
    </Card>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="rounded-2xl bg-muted/50 p-4 mb-4">
        <Icon className="h-10 w-10 text-muted-foreground/50" />
      </div>
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">{description}</p>
    </motion.div>
  );
}

// ─── Leads Tab ──────────────────────────────────────────────────────────────────

function LeadsTab({ leads, isLoading }: { leads: Lead[]; isLoading: boolean }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", company: "", source: "Website", phone: "" });
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    let result = leads;
    if (statusFilter !== "all") result = result.filter((l) => l.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.company.toLowerCase().includes(q)
      );
    }
    return result;
  }, [leads, statusFilter, search]);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem("mos_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      await fetch("/api/crm/leads", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...formData, status: "New", score: 50 }),
      });
      toast.success("Lead created successfully");
      setDialogOpen(false);
      setFormData({ name: "", email: "", company: "", source: "Website", phone: "" });
    } catch {
      toast.error("Failed to create lead");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="rounded-xl border border-white/20 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b last:border-0">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-2 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-1">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-white/80 dark:bg-slate-800/80 backdrop-blur border-white/20 dark:border-white/10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px] h-9 bg-white/80 dark:bg-slate-800/80 backdrop-blur border-white/20 dark:border-white/10">
              <Filter className="h-3.5 w-3.5 mr-1" />
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="New">New</SelectItem>
              <SelectItem value="Contacted">Contacted</SelectItem>
              <SelectItem value="Qualified">Qualified</SelectItem>
              <SelectItem value="Unqualified">Unqualified</SelectItem>
              <SelectItem value="Lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md shadow-orange-500/25"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-white/20 dark:border-white/10">
            <DialogHeader>
              <DialogTitle className="bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
                Create New Lead
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateLead} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lead-name">Full Name</Label>
                <Input id="lead-name" placeholder="John Smith" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required disabled={submitting} className="bg-white/80 dark:bg-slate-800/80" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-email">Email</Label>
                <Input id="lead-email" type="email" placeholder="john@company.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required disabled={submitting} className="bg-white/80 dark:bg-slate-800/80" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="lead-company">Company</Label>
                  <Input id="lead-company" placeholder="Acme Inc" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} disabled={submitting} className="bg-white/80 dark:bg-slate-800/80" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-phone">Phone</Label>
                  <Input id="lead-phone" placeholder="+1-555-0000" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} disabled={submitting} className="bg-white/80 dark:bg-slate-800/80" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-source">Source</Label>
                <Select value={formData.source} onValueChange={(v) => setFormData({ ...formData, source: v })} disabled={submitting}>
                  <SelectTrigger className="bg-white/80 dark:bg-slate-800/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Website">Website</SelectItem>
                    <SelectItem value="Referral">Referral</SelectItem>
                    <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                    <SelectItem value="Conference">Conference</SelectItem>
                    <SelectItem value="Cold Email">Cold Email</SelectItem>
                    <SelectItem value="Social Media">Social Media</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white">
                  {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  Create Lead
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Leads Table */}
      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No leads found" description={search || statusFilter !== "all" ? "Try adjusting your filters" : "Add your first lead to get started"} />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-white/20 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-lg"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent bg-white/40 dark:bg-slate-800/40">
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Name</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Email</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider hidden md:table-cell">Company</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider hidden lg:table-cell">Source</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                  {filtered.map((lead, idx) => (
                    <motion.tr
                      key={lead.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03, duration: 0.3 }}
                      className="border-b border-white/10 last:border-0 hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <TableCell className="font-medium text-sm">{lead.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{lead.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground/50" />
                          {lead.company}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">{lead.source}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[11px] ${STATUS_STYLES[lead.status] || ""}`}>
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ScoreBar score={lead.score} />
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>
          <div className="px-4 py-3 border-t border-white/10 bg-white/30 dark:bg-slate-800/30 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length} of {leads.length} leads
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {Math.round(leads.filter((l) => l.score >= 60).length / leads.length * 100)}%
              </span>
              qualified
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── Deals Tab ──────────────────────────────────────────────────────────────────

function DealCard({ deal }: { deal: Deal }) {
  const stageStyle = STAGE_COLORS[deal.stage];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      className={`rounded-lg border ${stageStyle.border} ${stageStyle.bg} p-3 cursor-pointer transition-shadow hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold leading-tight">{deal.title}</h4>
        <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: stageStyle.accent.replace("bg-", "") }} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-bold">{formatCurrency(deal.value)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          <span className="truncate">{deal.contactName}</span>
        </div>
        <Progress value={deal.probability} className="h-1.5" />
        <p className="text-[10px] text-muted-foreground text-right tabular-nums">{deal.probability}% probability</p>
      </div>
    </motion.div>
  );
}

function DealsTab({ deals, isLoading }: { deals: Deal[]; isLoading: boolean }) {
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  const grouped = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    for (const stage of PIPELINE_STAGES) {
      map[stage] = deals.filter((d) => d.stage === stage);
    }
    return map;
  }, [deals]);

  const totals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const stage of PIPELINE_STAGES) {
      map[stage] = grouped[stage].reduce((sum, d) => sum + d.value, 0);
    }
    return map;
  }, [grouped]);

  const totalPipeline = useMemo(() => deals.filter((d) => !["Won", "Lost"].includes(d.stage)).reduce((s, d) => s + d.value, 0), [deals]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="flex-1 h-8 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pipeline Summary */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Deal Pipeline</h3>
          <p className="text-xs text-muted-foreground">
            Total pipeline value: <span className="font-bold text-orange-600 dark:text-orange-400">{formatCurrency(totalPipeline)}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
            <DollarSign className="h-3 w-3 mr-1" />
            Won: {formatCurrency(totals.Won)}
          </Badge>
          <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800">
            <DollarSign className="h-3 w-3 mr-1" />
            Lost: {formatCurrency(totals.Lost)}
          </Badge>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
        <ScrollBar orientation="horizontal" />
        {PIPELINE_STAGES.map((stage) => {
          const stageDeals = grouped[stage];
          const stageColor = STAGE_COLORS[stage];
          return (
            <motion.div
              key={stage}
              className="flex-shrink-0 w-56 lg:w-64 space-y-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: PIPELINE_STAGES.indexOf(stage) * 0.08 }}
            >
              {/* Stage Header */}
              <div className={`rounded-lg border ${stageColor.border} ${stageColor.bg} px-3 py-2`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${stageColor.accent}`} />
                    <h4 className={`text-xs font-bold uppercase tracking-wider ${stageColor.text}`}>{stage}</h4>
                  </div>
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-white/60 dark:bg-slate-800/60">
                    {stageDeals.length}
                  </Badge>
                </div>
                <p className={`text-xs mt-1 font-semibold ${stageColor.text}`}>
                  {formatCurrency(totals[stage])}
                </p>
              </div>

              {/* Cards */}
              <div className="space-y-2.5 min-h-[80px]">
                <AnimatePresence>
                  {stageDeals.map((deal) => (
                    <div key={deal.id} onClick={() => setSelectedDeal(deal)}>
                      <DealCard deal={deal} />
                    </div>
                  ))}
                </AnimatePresence>
                {stageDeals.length === 0 && (
                  <div className="rounded-lg border border-dashed border-muted-foreground/20 p-4 text-center">
                    <p className="text-[10px] text-muted-foreground/50">No deals</p>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Deal Detail Dialog */}
      <Dialog open={!!selectedDeal} onOpenChange={() => setSelectedDeal(null)}>
        <DialogContent className="sm:max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-white/20 dark:border-white/10">
          {selectedDeal && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">{selectedDeal.title}</DialogTitle>
                <DialogDescription>
                  Created {new Date(selectedDeal.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-3">
                    <p className="text-[10px] uppercase font-semibold text-orange-600 dark:text-orange-400 tracking-wider">Value</p>
                    <p className="text-lg font-bold text-orange-700 dark:text-orange-300">{formatCurrency(selectedDeal.value)}</p>
                  </div>
                  <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                    <p className="text-[10px] uppercase font-semibold text-blue-600 dark:text-blue-400 tracking-wider">Probability</p>
                    <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{selectedDeal.probability}%</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className={STATUS_STYLES[selectedDeal.stage] || ""}>{selectedDeal.stage}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{selectedDeal.contactName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{selectedDeal.contactEmail}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Contacts Tab ────────────────────────────────────────────────────────────────

function ContactCard({ contact }: { contact: Contact }) {
  const initials = contact.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const colors = [
    "from-orange-400 to-orange-600",
    "from-blue-400 to-blue-600",
    "from-emerald-400 to-emerald-600",
    "from-amber-400 to-amber-600",
    "from-cyan-400 to-cyan-600",
    "from-rose-400 to-rose-600",
  ];
  const colorIndex = contact.name.charCodeAt(0) % colors.length;

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.02 }}
      className="rounded-xl border border-white/20 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-4 cursor-pointer transition-shadow hover:shadow-lg group"
    >
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${colors[colorIndex]} flex items-center justify-center text-white text-xs font-bold shadow-md`}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold truncate">{contact.name}</h4>
            <Badge variant="outline" className={`text-[10px] shrink-0 ${contact.status === "Active" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" : "bg-slate-50 text-slate-500 dark:bg-slate-800/30 dark:text-slate-400 border-slate-200 dark:border-slate-700"}`}>
              {contact.status}
            </Badge>
          </div>
          <div className="mt-1 space-y-0.5">
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
              <Mail className="h-3 w-3 shrink-0" />
              {contact.email}
            </p>
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
              <Building2 className="h-3 w-3 shrink-0" />
              {contact.company}
            </p>
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
              <Briefcase className="h-3 w-3 shrink-0" />
              {contact.position}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ContactsTab({ contacts, isLoading }: { contacts: Contact[]; isLoading: boolean }) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    let result = contacts;
    if (statusFilter !== "all") result = result.filter((c) => c.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.company.toLowerCase().includes(q) ||
          c.position.toLowerCase().includes(q)
      );
    }
    return result;
  }, [contacts, statusFilter, search]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-1">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-white/80 dark:bg-slate-800/80 backdrop-blur border-white/20 dark:border-white/10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[140px] h-9 bg-white/80 dark:bg-slate-800/80 backdrop-blur border-white/20 dark:border-white/10">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1 bg-white/60 dark:bg-slate-800/60 backdrop-blur rounded-lg border border-white/20 dark:border-white/10 p-1">
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="h-7 w-7 p-0"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="h-7 w-7 p-0"
          >
            <List className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState icon={Contact} title="No contacts found" description="No contacts match your search criteria" />
      ) : viewMode === "grid" ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          <AnimatePresence>
            {filtered.map((contact, idx) => (
              <motion.div
                key={contact.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.3 }}
              >
                <ContactCard contact={contact} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-white/20 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-lg"
        >
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent bg-white/40 dark:bg-slate-800/40">
                <TableHead className="font-semibold text-xs uppercase tracking-wider">Name</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider">Email</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider hidden md:table-cell">Company</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider hidden lg:table-cell">Position</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((contact) => (
                <TableRow key={contact.id} className="border-b border-white/10 last:border-0 hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors">
                  <TableCell className="font-medium text-sm">{contact.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{contact.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden md:table-cell">{contact.company}</TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">{contact.position}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[11px] ${contact.status === "Active" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" : "bg-slate-50 text-slate-500 dark:bg-slate-800/30 dark:text-slate-400 border-slate-200 dark:border-slate-700"}`}>
                      {contact.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </motion.div>
      )}

      {/* Footer Stats */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>Showing {filtered.length} of {contacts.length} contacts</span>
        <span>{contacts.filter((c) => c.status === "Active").length} active</span>
      </div>
    </div>
  );
}

// ─── Tickets Tab ────────────────────────────────────────────────────────────────

function TicketsTab({ tickets, isLoading }: { tickets: Ticket[]; isLoading: boolean }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    let result = tickets;
    if (statusFilter !== "all") result = result.filter((t) => t.status === statusFilter);
    if (priorityFilter !== "all") result = result.filter((t) => t.priority === priorityFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.subject.toLowerCase().includes(q) ||
          t.contactName.toLowerCase().includes(q) ||
          t.assignee.toLowerCase().includes(q)
      );
    }
    return result;
  }, [tickets, statusFilter, priorityFilter, search]);

  const stats = useMemo(() => {
    const open = tickets.filter((t) => t.status === "Open").length;
    const inProgress = tickets.filter((t) => t.status === "In Progress").length;
    const critical = tickets.filter((t) => t.priority === "Critical" && t.status !== "Closed").length;
    return { open, inProgress, critical };
  }, [tickets]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-full max-w-sm" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <GlassCard className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Open Tickets</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.open}</p>
              </div>
              <div className="rounded-xl bg-orange-500/10 p-2.5">
                <AlertCircle className="h-5 w-5 text-orange-500" />
              </div>
            </div>
          </GlassCard>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <GlassCard className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">In Progress</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.inProgress}</p>
              </div>
              <div className="rounded-xl bg-blue-500/10 p-2.5">
                <Loader2 className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </GlassCard>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <GlassCard className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Critical</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.critical}</p>
              </div>
              <div className="rounded-xl bg-red-500/10 p-2.5">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-white/80 dark:bg-slate-800/80 backdrop-blur border-white/20 dark:border-white/10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px] h-9 bg-white/80 dark:bg-slate-800/80 backdrop-blur border-white/20 dark:border-white/10">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Resolved">Resolved</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-[140px] h-9 bg-white/80 dark:bg-slate-800/80 backdrop-blur border-white/20 dark:border-white/10">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tickets List */}
      {filtered.length === 0 ? (
        <EmptyState icon={Ticket} title="No tickets found" description="No tickets match your search criteria" />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-2.5"
        >
          <AnimatePresence>
            {filtered.map((ticket, idx) => (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: idx * 0.03, duration: 0.25 }}
                className="rounded-xl border border-white/20 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-4 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all cursor-pointer group shadow-sm hover:shadow-md"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors truncate">
                        {ticket.subject}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{ticket.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {ticket.contactName}
                      </span>
                      <span className="hidden sm:inline flex items-center gap-1">
                        <ChevronRight className="h-3 w-3" />
                        {ticket.assignee}
                      </span>
                      <span>
                        {new Date(ticket.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={`text-[11px] ${PRIORITY_STYLES[ticket.priority] || ""}`}>
                      {ticket.priority}
                    </Badge>
                    <Badge variant="outline" className={`text-[11px] ${TICKET_STATUS_STYLES[ticket.status] || ""}`}>
                      {ticket.status}
                    </Badge>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>Showing {filtered.length} of {tickets.length} tickets</span>
        <span>{stats.open + stats.inProgress} tickets need attention</span>
      </div>
    </div>
  );
}

// ─── Main CrmView ──────────────────────────────────────────────────────────────

export function CrmView() {
  const { user } = useAppStore();
  const [activeTab, setActiveTab] = useState("leads");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [leadsData, dealsData, contactsData, ticketsData] = await Promise.all([
        fetchWithToken<Lead[]>("/api/crm/leads", DEMO_LEADS),
        fetchWithToken<Deal[]>("/api/crm/deals", DEMO_DEALS),
        fetchWithToken<Contact[]>("/api/crm/contacts", DEMO_CONTACTS),
        fetchWithToken<Ticket[]>("/api/crm/tickets", DEMO_TICKETS),
      ]);
      setLeads(leadsData);
      setDeals(dealsData);
      setContacts(contactsData);
      setTickets(ticketsData);
    } catch {
      setLeads(DEMO_LEADS);
      setDeals(DEMO_DEALS);
      setContacts(DEMO_CONTACTS);
      setTickets(DEMO_TICKETS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const leadStats = useMemo(() => {
    const total = leads.length;
    const qualified = leads.filter((l) => ["Qualified", "Contacted"].includes(l.status)).length;
    const avgScore = total > 0 ? Math.round(leads.reduce((s, l) => s + l.score, 0) / total) : 0;
    return { total, qualified, avgScore };
  }, [leads]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 bg-clip-text text-transparent">
            CRM
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage leads, deals, contacts, and support tickets
          </p>
        </div>
        {user && (
          <p className="text-xs text-muted-foreground">
            Signed in as <span className="font-medium">{user.name}</span>
          </p>
        )}
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 p-2.5 shadow-md shadow-orange-500/20">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Leads</p>
                <p className="text-xl font-bold tabular-nums">{isLoading ? "—" : leadStats.total}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-3 w-3" />
              <span>{isLoading ? "—" : `${leadStats.qualified} qualified`}</span>
            </div>
          </GlassCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 p-2.5 shadow-md shadow-blue-500/20">
                <Handshake className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Active Deals</p>
                <p className="text-xl font-bold tabular-nums">{isLoading ? "—" : deals.filter((d) => !["Won", "Lost"].includes(d.stage)).length}</p>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">
              Pipeline: <span className="font-semibold text-blue-600 dark:text-blue-400">{isLoading ? "—" : formatCurrency(deals.filter((d) => !["Won", "Lost"].includes(d.stage)).reduce((s, d) => s + d.value, 0))}</span>
            </div>
          </GlassCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 p-2.5 shadow-md shadow-amber-500/20">
                <Contact className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Contacts</p>
                <p className="text-xl font-bold tabular-nums">{isLoading ? "—" : contacts.length}</p>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{isLoading ? "—" : contacts.filter((c) => c.status === "Active").length}</span> active
            </div>
          </GlassCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-red-400 to-red-600 p-2.5 shadow-md shadow-red-500/20">
                <Ticket className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Open Tickets</p>
                <p className="text-xl font-bold tabular-nums">{isLoading ? "—" : tickets.filter((t) => t.status === "Open").length}</p>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">
              <span className="font-semibold text-orange-600 dark:text-orange-400">{isLoading ? "—" : tickets.filter((t) => t.priority === "Critical" && t.status !== "Closed").length}</span> critical
            </div>
          </GlassCard>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/20 dark:border-white/10 p-1 h-auto">
          <TabsTrigger
            value="leads"
            className="gap-1.5 rounded-md data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-orange-500/20 px-4 py-2 text-sm font-medium transition-all"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Leads</span>
          </TabsTrigger>
          <TabsTrigger
            value="deals"
            className="gap-1.5 rounded-md data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-blue-500/20 px-4 py-2 text-sm font-medium transition-all"
          >
            <Handshake className="h-4 w-4" />
            <span className="hidden sm:inline">Deals</span>
          </TabsTrigger>
          <TabsTrigger
            value="contacts"
            className="gap-1.5 rounded-md data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-amber-500/20 px-4 py-2 text-sm font-medium transition-all"
          >
            <Contact className="h-4 w-4" />
            <span className="hidden sm:inline">Contacts</span>
          </TabsTrigger>
          <TabsTrigger
            value="tickets"
            className="gap-1.5 rounded-md data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-red-500/20 px-4 py-2 text-sm font-medium transition-all"
          >
            <Ticket className="h-4 w-4" />
            <span className="hidden sm:inline">Tickets</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leads">
          <LeadsTab leads={leads} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="deals">
          <DealsTab deals={deals} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="contacts">
          <ContactsTab contacts={contacts} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="tickets">
          <TicketsTab tickets={tickets} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CrmView;
