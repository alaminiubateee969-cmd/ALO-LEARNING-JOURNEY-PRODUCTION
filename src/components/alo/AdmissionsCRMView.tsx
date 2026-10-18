"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine, CalendarClock, CheckCircle2, CircleDollarSign, Compass,
  ExternalLink, FileText, LayoutGrid, ListFilter, Loader2, Plus, Radar,
  RefreshCw, Search, Table2, UsersRound, UserRoundPlus, Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LEAD_STAGE_LABELS, LEAD_STAGES } from "@/lib/crm-constants";
import { SectionHeader, SegmentedControl, StatCard } from "./primitives";
import AdmissionPipeline from "./crm/AdmissionPipeline";
import LeadFormDialog from "./crm/LeadFormDialog";
import LeadDetailsDialog from "./crm/LeadDetailsDialog";
import QuotationBuilderDialog from "./crm/QuotationBuilderDialog";
import QuotationPreviewDialog from "./crm/QuotationPreviewDialog";
import { crmFetch, formatCurrency, formatDate, getApiError } from "./crm/api";
import type { LeadRecord, QuotationRecord } from "./crm/types";
import { useToast } from "@/hooks/use-toast";

interface CrmStats {
  total: number;
  new: number;
  followUpsDue: number;
  openQuotations: number;
}

interface CountryGuide {
  id: string;
  country: string;
  flag: string;
  currency: string;
  defaultFxToBdt: number;
  avgAnnualTuition: number;
  avgAnnualLiving: number;
  intakes: string[];
  officialAuthority: string;
  officialUrl: string;
  keyMilestoneDoc: string;
  checklist: string[];
}

const COUNTRY_GUIDES: CountryGuide[] = [
  {
    id: "uk",
    country: "United Kingdom",
    flag: "🇬🇧",
    currency: "GBP",
    defaultFxToBdt: 156,
    avgAnnualTuition: 16500,
    avgAnnualLiving: 12000,
    intakes: ["September (Main)", "January (Secondary)", "May (Selected)"],
    officialAuthority: "UK Visas & Immigration (GOV.UK)",
    officialUrl: "https://www.gov.uk/student-visa",
    keyMilestoneDoc: "Confirmation of Acceptance for Studies (CAS)",
    checklist: [
      "Verify university licensed Student sponsor status on GOV.UK.",
      "Check academic & English requirement (IELTS UKVI / PTE / institutional waiver).",
      "Prepare 28-day continuous financial maintenance evidence per GOV.UK rules.",
      "Complete Pre-CAS interview & TB test certificate from an approved clinic.",
      "Verify Immigration Health Surcharge (IHS) & Student visa fee on GOV.UK.",
    ],
  },
  {
    id: "canada",
    country: "Canada",
    flag: "🇨🇦",
    currency: "CAD",
    defaultFxToBdt: 88,
    avgAnnualTuition: 21000,
    avgAnnualLiving: 20635,
    intakes: ["Fall (September)", "Winter (January)", "Spring (May)"],
    officialAuthority: "IRCC (canada.ca)",
    officialUrl: "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada.html",
    keyMilestoneDoc: "Letter of Acceptance (LOA) + Provincial Attestation Letter (PAL)",
    checklist: [
      "Confirm Designated Learning Institution (DLI) number & PGWP eligibility on canada.ca.",
      "Check whether a Provincial Attestation Letter (PAL) is required for the study level.",
      "Verify current IRCC cost-of-living financial threshold & GIC options.",
      "Prepare clear Study Plan explaining programme fit and career path.",
      "Complete biometrics & upfront medical exam with an IRCC panel physician.",
    ],
  },
  {
    id: "usa",
    country: "United States",
    flag: "🇺🇸",
    currency: "USD",
    defaultFxToBdt: 120,
    avgAnnualTuition: 28000,
    avgAnnualLiving: 15000,
    intakes: ["Fall (August/September)", "Spring (January)", "Summer (May)"],
    officialAuthority: "DHS Study in the States / EducationUSA",
    officialUrl: "https://studyinthestates.dhs.gov/",
    keyMilestoneDoc: "Form I-20 + SEVIS I-901 Fee Receipt",
    checklist: [
      "Build balanced 3-tier shortlist (Ambitious, Target, Practical) from accredited institutions.",
      "Verify departmental deadlines, GRE/GMAT policies, and English score minimums.",
      "Prepare liquid financial sponsor documentation for Form I-20 issuance.",
      "Pay SEVIS I-901 fee and complete DS-160 for the F-1 visa interview.",
    ],
  },
  {
    id: "australia",
    country: "Australia",
    flag: "🇦🇺",
    currency: "AUD",
    defaultFxToBdt: 79,
    avgAnnualTuition: 32000,
    avgAnnualLiving: 29710,
    intakes: ["Semester 1 (February)", "Semester 2 (July)", "Trimester 3 (November)"],
    officialAuthority: "Department of Home Affairs (Subclass 500)",
    officialUrl: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500",
    keyMilestoneDoc: "Confirmation of Enrolment (CoE) + Genuine Student (GS)",
    checklist: [
      "Verify CRICOS course & provider registration code.",
      "Draft authentic, evidence-backed Genuine Student (GS) responses.",
      "Arrange Overseas Student Health Cover (OSHC) for the full visa duration.",
      "Verify Subclass 500 financial capacity requirements on Home Affairs.",
    ],
  },
  {
    id: "germany",
    country: "Germany",
    flag: "🇩🇪",
    currency: "EUR",
    defaultFxToBdt: 130,
    avgAnnualTuition: 1500,
    avgAnnualLiving: 11904,
    intakes: ["Winter Semester (October)", "Summer Semester (April)"],
    officialAuthority: "DAAD / Make it in Germany",
    officialUrl: "https://www.daad.de/en/",
    keyMilestoneDoc: "Zulassungsbescheid + APS Certificate + Sperrkonto",
    checklist: [
      "Check Anabin H+ university recognition & DAAD subject ECTS requirements.",
      "Initiate Academic Evaluation Centre (APS) certification early.",
      "Submit uni-assist VPD or direct university portal application before cutoff.",
      "Open an approved German Blocked Account (Sperrkonto) & student health insurance.",
    ],
  },
];

const LOCAL_REVIEW_STEPS = [
  { step: 1, name: "Workspace record lookup", detail: "Stored CRM lead record; no duplicate search" },
  { step: 2, name: "Stored contact and consent fields", detail: "CRM fields only; no external verification" },
  { step: 3, name: "Configured country-guide lookup", detail: "Static guide list; no portal fetch" },
  { step: 4, name: "Recorded intake and follow-up fields", detail: "CRM fields only; no reminder scheduler" },
];

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40";

function stagePill(stage: string) {
  if (stage === "enrolled") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (stage === "lost") return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  if (stage === "proposal_sent") return "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300";
  return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
}

function consentPill(status: string) {
  if (status === "consented") return "bg-emerald-100 text-emerald-800";
  if (status === "opted_out") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-700";
}

function getFollowUpState(value: string | null, stage: string) {
  if (!value || stage === "enrolled" || stage === "lost") return "";
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  if (due < today) return "overdue";
  if (due.getTime() === today.getTime()) return "today";
  return "scheduled";
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(leads: LeadRecord[]) {
  const columns = ["Name", "Email", "Phone", "Target country", "Study level", "Course interest", "Intake", "Stage", "Source", "Marketing preference", "Next follow-up", "Created"];
  const rows = leads.map((lead) => [lead.fullName, lead.email, lead.phone, lead.targetCountry, lead.studyLevel, lead.courseInterest, lead.intake, lead.stage, lead.source, lead.consentStatus, lead.nextFollowUp ? formatDate(lead.nextFollowUp) : "", formatDate(lead.createdAt)]);
  const csv = "\uFEFF" + [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `alo-enquiries-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function PipelineBoard({
  leads,
  onOpen,
  onStageChange,
}: {
  leads: LeadRecord[];
  onOpen: (lead: LeadRecord) => void;
  onStageChange: (lead: LeadRecord, stage: string) => void;
}) {
  return (
    <div className="overflow-x-auto pb-3 alo-scrollbar">
      <div className="grid min-w-[1470px] grid-cols-7 gap-2">
        {LEAD_STAGES.map((stage) => {
          const records = leads.filter((lead) => lead.stage === stage);
          return (
            <section key={stage} aria-label={`${LEAD_STAGE_LABELS[stage]}: ${records.length} enquiries`} className="min-h-64 rounded-xl bg-muted/40 p-2">
              <div className="mb-2 flex items-start justify-between gap-1 px-1 pt-1">
                <h3 className="text-[11px] font-semibold leading-snug">{LEAD_STAGE_LABELS[stage]}</h3>
                <span className="rounded-full bg-background px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">{records.length}</span>
              </div>
              <div className="space-y-2">
                {records.map((lead) => {
                  const followUpState = getFollowUpState(lead.nextFollowUp, lead.stage);
                  return (
                    <Card key={lead.id} className="p-2.5 shadow-sm">
                      <button type="button" className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60" onClick={() => onOpen(lead)}>
                        <span className="block truncate text-xs font-semibold">{lead.fullName}</span>
                        <span className="mt-1 block truncate text-[10px] text-muted-foreground">{[lead.targetCountry, lead.courseInterest].filter(Boolean).join(" · ") || "Study plan not set"}</span>
                      </button>
                      <div className="mt-2 flex items-center justify-between gap-1">
                        {lead.nextFollowUp ? <span className={`truncate text-[9px] ${followUpState === "overdue" ? "font-semibold text-rose-600" : followUpState === "today" ? "font-semibold text-amber-700" : "text-muted-foreground"}`}>{followUpState === "overdue" ? "Overdue · " : followUpState === "today" ? "Today · " : "Next · "}{formatDate(lead.nextFollowUp)}</span> : <span className="text-[9px] text-muted-foreground">No follow-up</span>}
                      </div>
                      <select aria-label={`Move ${lead.fullName} to another stage`} className="mt-2 h-7 w-full rounded-md border border-border bg-background px-1.5 text-[10px]" value={lead.stage} onChange={(event) => onStageChange(lead, event.target.value)}>
                        {LEAD_STAGES.map((value) => <option key={value} value={value}>{LEAD_STAGE_LABELS[value]}</option>)}
                      </select>
                    </Card>
                  );
                })}
                {records.length === 0 && <div className="rounded-lg border border-dashed border-border/80 px-2 py-6 text-center text-[10px] text-muted-foreground">No enquiries</div>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function LeadCard({ lead, onOpen }: { lead: LeadRecord; onOpen: (lead: LeadRecord) => void }) {
  const followUpState = getFollowUpState(lead.nextFollowUp, lead.stage);
  return (
    <Card className="p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={() => onOpen(lead)} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60">
          <span className="block truncate font-semibold">{lead.fullName}</span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">{[lead.targetCountry, lead.courseInterest].filter(Boolean).join(" · ") || "Education enquiry"}</span>
        </button>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${stagePill(lead.stage)}`}>{LEAD_STAGE_LABELS[lead.stage as keyof typeof LEAD_STAGE_LABELS] ?? lead.stage}</span>
      </div>
      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        {lead.email && <p className="truncate">{lead.email}</p>}
        {lead.phone && <p>{lead.phone}</p>}
        <p>{lead.studyLevel || "Study level not set"}{lead.intake ? ` · ${lead.intake}` : ""}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${consentPill(lead.consentStatus)}`}>Marketing {lead.consentStatus === "consented" ? "opt-in" : lead.consentStatus === "opted_out" ? "opt-out" : "unknown"}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] text-muted-foreground">{lead.source}</span>
        {lead._count && <span className="ml-auto text-[9px] text-muted-foreground">{lead._count.activities} updates · {lead._count.quotations} quotes</span>}
      </div>
      <div className={`mt-3 flex items-center gap-1.5 border-t border-border/60 pt-2 text-[11px] ${followUpState === "overdue" ? "font-semibold text-rose-600" : followUpState === "today" ? "font-semibold text-amber-700" : "text-muted-foreground"}`}>
        <CalendarClock className="h-3.5 w-3.5" />
        {lead.nextFollowUp ? `${followUpState === "overdue" ? "Overdue" : followUpState === "today" ? "Due today" : "Follow-up"} · ${formatDate(lead.nextFollowUp)}` : "No follow-up scheduled"}
      </div>
    </Card>
  );
}

function QuoteCard({ quote, onOpen }: { quote: QuotationRecord; onOpen: (quote: QuotationRecord) => void }) {
  return (
    <Card className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{quote.number}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${quote.status === "accepted" ? "bg-emerald-100 text-emerald-800" : quote.status === "declined" || quote.status === "expired" ? "bg-slate-100 text-slate-700" : quote.status === "sent" ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-800"}`}>{quote.status}</span>
        </div>
        <p className="mt-1 truncate text-sm">{quote.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">For {quote.lead?.fullName ?? "Enquiry"} · Created {formatDate(quote.createdAt)}{quote.validUntil ? ` · Valid until ${formatDate(quote.validUntil)}` : ""}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{quote.items.length} line item{quote.items.length === 1 ? "" : "s"}</p>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="text-lg font-semibold tabular-nums">{formatCurrency(quote.total, quote.currency)}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => onOpen(quote)}><FileText className="h-3.5 w-3.5" />Review</Button>
      </div>
    </Card>
  );
}

export default function AdmissionsCRMView() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [quotes, setQuotes] = useState<QuotationRecord[]>([]);
  const [stats, setStats] = useState<CrmStats>({ total: 0, new: 0, followUpsDue: 0, openQuotations: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [dueOnly, setDueOnly] = useState(false);
  const [enquiryViewMode, setEnquiryViewMode] = useState<"cards" | "table">("cards");
  const [pipelineStage, setPipelineStage] = useState("all");
  const [quoteQuery, setQuoteQuery] = useState("");
  const [quoteStatus, setQuoteStatus] = useState("all");
  const [tab, setTab] = useState("pipeline");
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);
  const [leadDetailOpen, setLeadDetailOpen] = useState(false);
  const [quoteLead, setQuoteLead] = useState<LeadRecord | null>(null);
  const [quoteBuilderOpen, setQuoteBuilderOpen] = useState(false);
  const [selectLeadOpen, setSelectLeadOpen] = useState(false);
  const [quoteLeadId, setQuoteLeadId] = useState("");
  const [selectedQuote, setSelectedQuote] = useState<QuotationRecord | null>(null);
  const [quotePreviewOpen, setQuotePreviewOpen] = useState(false);

  // Static country-guide browsing and checklist state
  const [selectedCountryId, setSelectedCountryId] = useState("uk");
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [attachLeadId, setAttachLeadId] = useState("");
  const [attachingChecklist, setAttachingChecklist] = useState(false);

  // Local CRM review-summary state
  const [enrichLeadId, setEnrichLeadId] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [enrichmentReport, setEnrichmentReport] = useState<null | {
    leadName: string;
    country: string;
    course: string;
    consentStatus: string;
    matchedGuide: string;
    officialUrl: string | null;
    steps: Array<{ step: number; name: string; status: string; detail: string }>;
  }>(null);

  const activeCountry = COUNTRY_GUIDES.find((c) => c.id === selectedCountryId) ?? COUNTRY_GUIDES[0];

  const load = useCallback(async () => {
    try {
      const [leadResponse, quoteResponse] = await Promise.all([crmFetch("/api/crm/leads"), crmFetch("/api/crm/quotes")]);
      if (!leadResponse.ok) throw new Error(await getApiError(leadResponse, "Could not load enquiries."));
      if (!quoteResponse.ok) throw new Error(await getApiError(quoteResponse, "Could not load quotations."));
      const [leadBody, quoteBody] = await Promise.all([leadResponse.json(), quoteResponse.json()]);
      setError("");
      const loadedLeads = leadBody.leads as LeadRecord[];
      setLeads(loadedLeads);
      setStats(leadBody.stats as CrmStats);
      setQuotes(quoteBody.quotes as QuotationRecord[]);
      if (loadedLeads.length > 0) {
        setAttachLeadId((prev) => prev || loadedLeads[0].id);
        setEnrichLeadId((prev) => prev || loadedLeads[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the CRM workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    const companyChanged = () => void refresh();
    window.addEventListener("alo-company-changed", companyChanged);
    window.addEventListener("storage", companyChanged);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("alo-company-changed", companyChanged);
      window.removeEventListener("storage", companyChanged);
    };
  }, [load, refresh]);

  const filteredLeads = useMemo(() => leads.filter((lead) => {
    if (stageFilter !== "all" && lead.stage !== stageFilter) return false;
    const followUpState = getFollowUpState(lead.nextFollowUp, lead.stage);
    if (dueOnly && followUpState !== "overdue" && followUpState !== "today") return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [lead.fullName, lead.email, lead.phone, lead.targetCountry, lead.courseInterest, lead.studyLevel, lead.intake].some((value) => value?.toLowerCase().includes(needle));
  }), [leads, stageFilter, dueOnly, query]);

  const filteredQuotes = useMemo(() => quotes.filter((quote) => {
    if (quoteStatus !== "all" && quote.status !== quoteStatus) return false;
    const needle = quoteQuery.trim().toLowerCase();
    return !needle || [quote.number, quote.title, quote.lead?.fullName].some((value) => value?.toLowerCase().includes(needle));
  }), [quotes, quoteStatus, quoteQuery]);

  const visiblePipelineLeads = useMemo(() => leads.filter((lead) => pipelineStage === "all" || lead.stage === pipelineStage), [leads, pipelineStage]);

  const openLead = (lead: LeadRecord) => {
    setSelectedLead(lead);
    setLeadDetailOpen(true);
  };

  const patchStage = async (lead: LeadRecord, stage: string) => {
    if (stage === lead.stage) return;
    setError("");
    try {
      const response = await crmFetch(`/api/crm/leads/${encodeURIComponent(lead.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!response.ok) throw new Error(await getApiError(response, "Could not move this enquiry."));
      const body = await response.json();
      setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, ...body.lead } : item));
      void load();
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Could not move this enquiry.");
    }
  };

  const attachCountryChecklistToLead = async () => {
    if (!attachLeadId) return;
    setAttachingChecklist(true);
    try {
      const summary = `[${activeCountry.country} Readiness Checklist draft — ${activeCountry.keyMilestoneDoc}] Configured source link (not fetched or verified): ${activeCountry.officialUrl} | Steps: ${activeCountry.checklist.join(" • ")}`;
      const response = await crmFetch(`/api/crm/leads/${encodeURIComponent(attachLeadId)}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "note", body: summary.slice(0, 950) }),
      });
      if (!response.ok) throw new Error(await getApiError(response, "Could not attach checklist note."));
      toast({
        title: `${activeCountry.country} checklist logged to enquiry`,
        description: "Saved as a checklist draft with a configured source link. Confirm current requirements on the linked official site before advising.",
      });
      void load();
    } catch (err) {
      toast({
        title: "Checklist not attached",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setAttachingChecklist(false);
    }
  };

  const buildLocalCrmReviewSummary = async () => {
    const target = leads.find((lead) => lead.id === enrichLeadId) ?? leads[0];
    if (!target) return;
    setEnriching(true);
    try {
      const normalizedCountry = target.targetCountry?.trim().toLowerCase() ?? "";
      const matchedCountry = COUNTRY_GUIDES.find((guide) =>
        normalizedCountry === guide.id ||
        normalizedCountry === guide.country.toLowerCase() ||
        normalizedCountry.includes(guide.country.toLowerCase())
      ) ?? null;

      const steps = [
        {
          step: 1,
          name: "Workspace record lookup",
          status: "RECORD FOUND",
          detail: `Loaded CRM record ${target.id.slice(0, 10)}; no duplicate phone/email search was run.`,
        },
        {
          step: 2,
          name: "Stored contact and consent fields",
          status: target.consentStatus === "consented" && target.consentRecordedAt ? "CONSENT DATE RECORDED" : "REVIEW CONSENT RECORD",
          detail: `Stored email: ${target.email || "not set"} · stored phone: ${target.phone || "not set"} · consent: ${target.consentStatus} · consent date: ${target.consentRecordedAt || "not recorded"}. No contact or consent verification was performed.`,
        },
        {
          step: 3,
          name: "Configured country-guide lookup",
          status: matchedCountry ? "CONFIGURED GUIDE MATCH" : "NO CONFIGURED GUIDE MATCH",
          detail: matchedCountry
            ? `Matched the configured ${matchedCountry.country} guide (${matchedCountry.keyMilestoneDoc}) and source link ${matchedCountry.officialUrl}; the site was not fetched or verified.`
            : `No configured guide matched ${target.targetCountry || "the unspecified country"}; no external lookup was performed.`,
        },
        {
          step: 4,
          name: "Recorded intake and follow-up fields",
          status: target.nextFollowUp ? "FOLLOW-UP DATE RECORDED" : "NO FOLLOW-UP DATE",
          detail: `Stored intake: ${target.intake || "not set"} · course: ${target.courseInterest || "not set"} · next follow-up: ${target.nextFollowUp || "not set"}. No calendar event or reminder was scheduled.`,
        },
      ];
      const report = {
        leadName: target.fullName,
        country: target.targetCountry || "Not specified",
        course: target.courseInterest || "Not specified",
        consentStatus: target.consentStatus,
        matchedGuide: matchedCountry?.keyMilestoneDoc ?? "No configured guide match",
        officialUrl: matchedCountry?.officialUrl ?? null,
        steps,
      };
      const note = `[Local CRM review summary] Country: ${report.country}. Configured guide: ${report.matchedGuide}. Source link: ${report.officialUrl ?? "none"}. No duplicate search, external verification, portal fetch, or follow-up scheduling was performed.`;
      const response = await crmFetch(`/api/crm/leads/${encodeURIComponent(target.id)}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "note", body: note }),
      });
      if (!response.ok) throw new Error(await getApiError(response, "Could not save the CRM review note."));

      setEnrichmentReport(report);
      toast({
        title: "CRM review summary saved",
        description: matchedCountry
          ? `${target.fullName}: configured ${matchedCountry.country} guide matched; its portal and current requirements were not checked.`
          : `${target.fullName}: no configured country guide matched. No external service was called; infrastructure cost is not measured.`,
      });
      void load();
    } catch (err) {
      toast({
        title: "CRM review summary not saved",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setEnriching(false);
    }
  };

  const openQuoteBuilder = (lead: LeadRecord) => {
    setQuoteLead(lead);
    setLeadDetailOpen(false);
    setQuoteBuilderOpen(true);
  };

  const proceedWithSelectedLead = () => {
    const lead = leads.find((item) => item.id === quoteLeadId);
    if (!lead) return;
    setSelectLeadOpen(false);
    openQuoteBuilder(lead);
  };

  const handleQuoteCreated = (quote: QuotationRecord) => {
    setQuotes((current) => [quote, ...current]);
    setSelectedQuote(quote);
    setQuotePreviewOpen(true);
    void load();
  };

  const onQuoteUpdated = (quote: QuotationRecord) => {
    setQuotes((current) => current.map((item) => item.id === quote.id ? quote : item));
    setSelectedQuote(quote);
    void load();
  };

  const onQuoteDeleted = (id: string) => {
    setQuotes((current) => current.filter((quote) => quote.id !== id));
    setSelectedQuote(null);
    void load();
  };

  const handleLeadUpdated = (updated: LeadRecord) => {
    setLeads((current) => current.map((lead) => lead.id === updated.id ? { ...lead, ...updated } : lead));
    setSelectedLead((current) => current?.id === updated.id ? { ...current, ...updated } : current);
    void load();
  };

  const handleLeadDeleted = (id: string) => {
    setLeads((current) => current.filter((lead) => lead.id !== id));
    setQuotes((current) => current.filter((quote) => quote.leadId !== id));
    setSelectedLead(null);
    void load();
  };

  const handleLeadCreated = (lead: LeadRecord) => {
    setLeads((current) => [lead, ...current]);
    setSelectedLead(lead);
    setLeadDetailOpen(true);
    void load();
  };

  const openQuotePicker = () => {
    if (leads.length === 0) {
      setError("Create an enquiry before preparing a quotation.");
      setTab("enquiries");
      return;
    }
    setQuoteLeadId(leads[0].id);
    setSelectLeadOpen(true);
  };

  return (
    <div className="space-y-5 alo-fade-up">
      <SectionHeader
        title="Admissions CRM"
        bn="এনকোয়ারি ও স্টাডি অ্যাব্রোড"
        desc="Enquiry records, a Kanban pipeline, printable BDT/GBP quotations, static 5-country study-planning guides, and a local CRM review summary. Country guides and follow-up dates are not live-verified or automatically scheduled."
        icon={<UsersRound className="h-5 w-5" />}
        action={<div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={refreshing}>{refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Refresh</Button><Button type="button" size="sm" onClick={() => setNewLeadOpen(true)} className="bg-amber-500 text-white hover:bg-amber-600"><UserRoundPlus className="h-4 w-4" />New enquiry</Button></div>}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Enquiries" value={stats.total} sub="in this workspace" icon={<UsersRound className="h-4 w-4" />} tone="amber" />
        <StatCard label="New" value={stats.new} sub="awaiting qualification" icon={<Plus className="h-4 w-4" />} tone="violet" />
        <StatCard label="Follow-ups due" value={stats.followUpsDue} sub="today or overdue · open enquiries" icon={<CalendarClock className="h-4 w-4" />} tone={stats.followUpsDue ? "rose" : "emerald"} />
        <StatCard label="Open quotations" value={stats.openQuotations} sub="draft or sent" icon={<CircleDollarSign className="h-4 w-4" />} tone="sky" />
      </div>

      <AdmissionPipeline leads={leads} selectedStage={pipelineStage} onSelectStage={(stage) => { setPipelineStage(stage); setStageFilter(stage); setTab(stage === "all" ? "pipeline" : "enquiries"); }} />

      {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <TabsList className="grid h-auto w-full grid-cols-2 sm:w-auto sm:grid-cols-5">
            <TabsTrigger value="pipeline" className="gap-1.5 text-xs"><Workflow className="h-3.5 w-3.5" />Pipeline board</TabsTrigger>
            <TabsTrigger value="enquiries" className="gap-1.5 text-xs"><UsersRound className="h-3.5 w-3.5" />Enquiries ({leads.length})</TabsTrigger>
            <TabsTrigger value="quotations" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" />Quotations ({quotes.length})</TabsTrigger>
            <TabsTrigger value="destinations" className="gap-1.5 text-xs"><Compass className="h-3.5 w-3.5" />Country Guides</TabsTrigger>
            <TabsTrigger value="enrichment" className="gap-1.5 text-xs"><Radar className="h-3.5 w-3.5" />CRM Review</TabsTrigger>
          </TabsList>
          {tab === "quotations" ? (
            <Button type="button" size="sm" onClick={openQuotePicker} className="bg-emerald-600 text-white hover:bg-emerald-700"><CircleDollarSign className="h-4 w-4" />New quotation</Button>
          ) : tab === "enquiries" ? (
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                value={enquiryViewMode}
                onChange={setEnquiryViewMode}
                ariaLabel="Switch enquiry view mode"
                options={[
                  { id: "cards", label: "Cards", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
                  { id: "table", label: "Table", icon: <Table2 className="h-3.5 w-3.5" /> },
                ]}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => downloadCsv(filteredLeads)} disabled={!filteredLeads.length}><ArrowDownToLine className="h-4 w-4" />Export CSV</Button>
              <Button type="button" size="sm" onClick={() => setNewLeadOpen(true)} className="bg-amber-500 text-white hover:bg-amber-600"><UserRoundPlus className="h-4 w-4" />New enquiry</Button>
            </div>
          ) : null}
        </div>

        <TabsContent value="pipeline" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Move an enquiry with the stage selector, or open its record to review the activity and follow-up history.</p><span className="text-xs text-muted-foreground">{leads.length} loaded · latest 250</span></div>
          {loading ? <div className="grid min-w-[1300px] grid-cols-7 gap-2">{Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-52 rounded-xl alo-shimmer" />)}</div> : leads.length === 0 ? <Card className="p-12 text-center"><Workflow className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" /><p className="font-medium">Your admissions pipeline is ready</p><p className="mt-1 text-sm text-muted-foreground">Add an enquiry to start tracking progress.</p><Button className="mt-4 bg-amber-500 text-white hover:bg-amber-600" onClick={() => setNewLeadOpen(true)}><UserRoundPlus className="h-4 w-4" />Add first enquiry</Button></Card> : <PipelineBoard leads={visiblePipelineLeads} onOpen={openLead} onStageChange={patchStage} />}
        </TabsContent>

        <TabsContent value="enquiries" className="mt-4 space-y-4">
          <Card className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, contact, country, course…" className="pl-9" /></div>
            <select aria-label="Filter enquiries by stage" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-52" value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}><option value="all">All stages</option>{LEAD_STAGES.map((stage) => <option key={stage} value={stage}>{LEAD_STAGE_LABELS[stage]}</option>)}</select>
            <Button type="button" size="sm" variant={dueOnly ? "default" : "outline"} onClick={() => setDueOnly((value) => !value)} aria-pressed={dueOnly} className={dueOnly ? "bg-rose-600 text-white hover:bg-rose-700" : ""}><CalendarClock className="h-4 w-4" />Due only</Button>
          </Card>
          {loading ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-44 rounded-xl alo-shimmer" />)}</div>
          ) : filteredLeads.length === 0 ? (
            <Card className="p-12 text-center"><Search className="mx-auto mb-3 h-9 w-9 text-muted-foreground/30" /><p className="font-medium">No matching enquiries</p><p className="mt-1 text-sm text-muted-foreground">Change the filters or add a new enquiry.</p></Card>
          ) : enquiryViewMode === "cards" ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filteredLeads.map((lead) => <LeadCard key={lead.id} lead={lead} onOpen={openLead} />)}</div>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/30 text-[10px] uppercase text-muted-foreground">
                    <th className="px-3.5 py-2.5">Applicant</th>
                    <th className="px-3.5 py-2.5">Destination & Course</th>
                    <th className="px-3.5 py-2.5">Intake</th>
                    <th className="px-3.5 py-2.5">Stage</th>
                    <th className="px-3.5 py-2.5">Consent</th>
                    <th className="px-3.5 py-2.5">Next Follow-Up</th>
                    <th className="px-3.5 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-muted/30">
                      <td className="px-3.5 py-2.5">
                        <p className="font-semibold">{lead.fullName}</p>
                        <p className="text-[11px] text-muted-foreground">{lead.email || lead.phone || "—"}</p>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <p className="font-medium">{lead.targetCountry || "—"}</p>
                        <p className="text-[11px] text-muted-foreground">{lead.courseInterest || "—"}</p>
                      </td>
                      <td className="px-3.5 py-2.5">{lead.intake || "—"}</td>
                      <td className="px-3.5 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stagePill(lead.stage)}`}>
                          {LEAD_STAGE_LABELS[lead.stage as keyof typeof LEAD_STAGE_LABELS] ?? lead.stage}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${consentPill(lead.consentStatus)}`}>
                          {lead.consentStatus}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5">{lead.nextFollowUp ? formatDate(lead.nextFollowUp) : "—"}</td>
                      <td className="px-3.5 py-2.5 text-right">
                        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => openLead(lead)}>
                          Open
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          <p className="text-[11px] text-muted-foreground">Export includes only the records currently visible after filtering. Keep downloaded CSV files secure and delete them when no longer needed.</p>
        </TabsContent>

        <TabsContent value="quotations" className="mt-4 space-y-4">
          <Card className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={quoteQuery} onChange={(event) => setQuoteQuery(event.target.value)} placeholder="Search quote number, title, or enquiry…" className="pl-9" /></div>
            <select aria-label="Filter quotations by status" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-48" value={quoteStatus} onChange={(event) => setQuoteStatus(event.target.value)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="sent">Sent</option><option value="accepted">Accepted</option><option value="declined">Declined</option><option value="expired">Expired</option></select>
          </Card>
          {loading ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl alo-shimmer" />)}</div> : filteredQuotes.length === 0 ? <Card className="p-12 text-center"><FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" /><p className="font-medium">No quotations yet</p><p className="mt-1 text-sm text-muted-foreground">Choose an enquiry to prepare a printable draft. Nothing is sent automatically.</p><Button className="mt-4 bg-emerald-600 text-white hover:bg-emerald-700" onClick={openQuotePicker} disabled={!leads.length}><CircleDollarSign className="h-4 w-4" />Prepare first quotation</Button></Card> : <div className="space-y-2">{filteredQuotes.map((quote) => <QuoteCard key={quote.id} quote={quote} onOpen={(value) => { setSelectedQuote(value); setQuotePreviewOpen(true); }} />)}</div>}
        </TabsContent>

        {/* 4. STUDYTRA 5-COUNTRY STUDY ABROAD EXECUTION PLANNER */}
        <TabsContent value="destinations" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {COUNTRY_GUIDES.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant={selectedCountryId === item.id ? "default" : "outline"}
                className={selectedCountryId === item.id ? "bg-amber-500 text-white hover:bg-amber-600" : ""}
                onClick={() => setSelectedCountryId(item.id)}
              >
                <span>{item.flag}</span>
                <span>{item.country}</span>
              </Button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="p-4 sm:p-5 lg:col-span-2 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Badge variant="outline" className="mb-1.5 font-mono text-[10px]">
                    {activeCountry.keyMilestoneDoc}
                  </Badge>
                  <h3 className="text-base font-semibold">
                    {activeCountry.flag} {activeCountry.country} — Execution & Compliance Checklist
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Official authority: {activeCountry.officialAuthority}
                  </p>
                </div>
                <a
                  href={activeCountry.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Verify Official Portal
                </a>
              </div>

              <div className="space-y-2">
                {activeCountry.checklist.map((step, index) => {
                  const key = `${activeCountry.id}-${index}`;
                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/60 p-3 text-xs hover:bg-muted/30"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(checkedItems[key])}
                        onChange={(e) => setCheckedItems((curr) => ({ ...curr, [key]: e.target.checked }))}
                        className="mt-0.5 h-4 w-4 accent-amber-600"
                      />
                      <span>{step}</span>
                    </label>
                  );
                })}
              </div>

              {leads.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                  <select
                    aria-label="Select enquiry to attach checklist"
                    value={attachLeadId}
                    onChange={(e) => setAttachLeadId(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2.5 text-xs"
                  >
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.fullName} ({l.targetCountry || "No country"})
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void attachCountryChecklistToLead()}
                    disabled={attachingChecklist}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    {attachingChecklist ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Log Checklist to Enquiry Timeline
                  </Button>
                </div>
              )}
            </Card>

            <Card className="p-4 sm:p-5 space-y-4">
              <h3 className="text-sm font-semibold">Annual Budget & Intake Reference</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between rounded-lg bg-muted/40 p-2.5">
                  <span className="text-muted-foreground">Typical Annual Tuition</span>
                  <span className="font-mono font-semibold">
                    {activeCountry.currency} {activeCountry.avgAnnualTuition.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between rounded-lg bg-muted/40 p-2.5">
                  <span className="text-muted-foreground">Official Living Benchmark</span>
                  <span className="font-mono font-semibold">
                    {activeCountry.currency} {activeCountry.avgAnnualLiving.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
                  <span className="font-medium">Estimated Total (BDT @ {activeCountry.defaultFxToBdt})</span>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
                    ৳ {((activeCountry.avgAnnualTuition + activeCountry.avgAnnualLiving) * activeCountry.defaultFxToBdt).toLocaleString()}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">Primary Intake Windows</p>
                <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                  {activeCountry.intakes.map((intake) => (
                    <li key={intake}>• {intake}</li>
                  ))}
                </ul>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Figures are planning benchmarks only. Verify exact programme tuition and maintenance funds on the official university and government portals before advising.
              </p>
            </Card>
          </div>
        </TabsContent>

        {/* Local CRM review summary; no external verification or scheduling */}
        <TabsContent value="enrichment" className="mt-4 space-y-4">
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">Local CRM Review Summary</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Summarizes stored CRM fields and may match a static country-guide list. It does not search for duplicates, verify contact or consent, fetch official portals, or schedule follow-ups. Review all details before advising.
                </p>
              </div>
              {leads.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Select enquiry for CRM review summary"
                    value={enrichLeadId}
                    onChange={(e) => setEnrichLeadId(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.fullName} — {l.targetCountry || "Unspecified"}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void buildLocalCrmReviewSummary()}
                    disabled={enriching}
                    className="bg-amber-500 text-white hover:bg-amber-600"
                  >
                    {enriching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ListFilter className="h-3.5 w-3.5" />}
                    Build review summary
                  </Button>
                </div>
              )}
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {LOCAL_REVIEW_STEPS.map((stage) => (
                <Card key={stage.step} className="p-3.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                    <span>CHECK 0{stage.step}</span>
                    <span>CRM DATA ONLY</span>
                  </div>
                  <p className="mt-1 font-semibold text-xs">{stage.name}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{stage.detail}</p>
                </Card>
              ))}
            </div>

            {enrichmentReport && (
              <Card className="border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold">
                      CRM review summary for {enrichmentReport.leadName} ({enrichmentReport.country} · {enrichmentReport.course})
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Stored consent status: {enrichmentReport.consentStatus} · Configured guide: {enrichmentReport.matchedGuide} · Source link: {enrichmentReport.officialUrl ?? "none"} · not fetched/verified
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">Local summary · not independently verified</Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {enrichmentReport.steps.map((s) => (
                    <div key={s.step} className="rounded-lg border border-border/60 bg-background p-2.5 text-xs">
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <span className="font-semibold">
                          #{s.step} {s.name}
                        </span>
                        <span className="text-amber-700 font-bold">{s.status}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{s.detail}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <LeadFormDialog open={newLeadOpen} onOpenChange={setNewLeadOpen} onCreated={handleLeadCreated} />
      <LeadDetailsDialog lead={selectedLead} open={leadDetailOpen} onOpenChange={setLeadDetailOpen} onUpdated={handleLeadUpdated} onDeleted={handleLeadDeleted} onCreateQuote={openQuoteBuilder} />
      <QuotationBuilderDialog lead={quoteLead} open={quoteBuilderOpen} onOpenChange={setQuoteBuilderOpen} onCreated={handleQuoteCreated} />
      <QuotationPreviewDialog quote={selectedQuote} open={quotePreviewOpen} onOpenChange={setQuotePreviewOpen} onUpdated={onQuoteUpdated} onDeleted={onQuoteDeleted} />

      <Dialog open={selectLeadOpen} onOpenChange={setSelectLeadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Choose an enquiry</DialogTitle><DialogDescription>A quotation will be attached to the selected CRM record.</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label htmlFor="quote-lead-select">Enquiry</Label><select id="quote-lead-select" className={selectClass} value={quoteLeadId} onChange={(event) => setQuoteLeadId(event.target.value)}>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.fullName}{lead.courseInterest ? ` — ${lead.courseInterest}` : ""}</option>)}</select></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setSelectLeadOpen(false)}>Cancel</Button><Button type="button" onClick={proceedWithSelectedLead} className="bg-emerald-600 text-white hover:bg-emerald-700">Continue</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
