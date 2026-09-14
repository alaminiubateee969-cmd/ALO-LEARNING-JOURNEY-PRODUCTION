"use client";

import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, ChevronDown, Check, Plus, Loader2, Ban, Power } from "lucide-react";

interface Company {
  id: string;
  name: string;
  domain: string | null;
  plan: string;
  active: boolean;
}

const planStyle: Record<string, string> = {
  starter: "bg-slate-100 text-slate-700",
  growth: "bg-amber-100 text-amber-700",
  enterprise: "bg-violet-100 text-violet-700",
};

export default function CompanySwitcher() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((d) => {
        setCompanies(d.companies);
        // Persist selected company in localStorage
        const stored = typeof window !== "undefined" ? localStorage.getItem("alo-active-company") : null;
        if (stored && d.companies.some((c: Company) => c.id === stored)) {
          setActiveId(stored);
        } else {
          setActiveId(d.companies[0]?.id ?? "");
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const switchTo = (id: string) => {
    setActiveId(id);
    if (typeof window !== "undefined") localStorage.setItem("alo-active-company", id);
    setOpen(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    const action = current ? "suspend" : "activate";
    await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id }),
    });
    load();
  };

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: newName, domain: "", plan: "growth" }),
      });
      const data = await res.json();
      if (data.company) switchTo(data.company.id);
      setNewName("");
      setShowCreate(false);
      load();
    } finally {
      setCreating(false);
    }
  };

  const active = companies.find((c) => c.id === activeId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 max-w-[180px]">
          <Building2 className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span className="truncate text-xs font-medium">{active?.name ?? "—"}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="px-3 py-2.5 border-b border-border/60">
          <p className="text-xs font-semibold flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-amber-600" /> কোম্পানি নির্বাচন
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Multi-tenant — প্রতিটি কোম্পানির ডেটা আলাদা</p>
        </div>
        <div className="max-h-64 overflow-y-auto alo-scrollbar py-1">
          {loading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg alo-shimmer" />
              ))}
            </div>
          ) : (
            companies.map((c) => (
              <div
                key={c.id}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                  c.id === activeId ? "bg-amber-100/60" : "hover:bg-muted/60"
                } ${!c.active ? "opacity-50" : ""}`}
                onClick={() => c.active && switchTo(c.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{c.name}</span>
                    {c.id === activeId && <Check className="h-3 w-3 text-amber-600 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${planStyle[c.plan] ?? planStyle.starter}`}>{c.plan}</span>
                    {c.domain && <span className="text-[10px] text-muted-foreground truncate">{c.domain}</span>}
                    {!c.active && <span className="text-[9px] text-rose-600 font-medium">suspended</span>}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={(e) => { e.stopPropagation(); toggleActive(c.id, c.active); }}
                  title={c.active ? "Suspend" : "Activate"}
                >
                  {c.active ? <Ban className="h-3 w-3 text-rose-500" /> : <Power className="h-3 w-3 text-emerald-500" />}
                </Button>
              </div>
            ))
          )}
        </div>
        {showCreate ? (
          <div className="border-t border-border/60 p-2.5">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="নতুন কোম্পানির নাম..."
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            <div className="flex gap-1.5 mt-2">
              <Button size="sm" className="h-7 text-xs flex-1 bg-amber-500 hover:bg-amber-600" onClick={create} disabled={creating}>
                {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : "তৈরি করুন"}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setShowCreate(false); setNewName(""); }}>
                বাতিল
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-t border-border/60 p-2">
            <Button
              size="sm"
              variant="ghost"
              className="w-full h-7 text-xs justify-start text-amber-700 hover:bg-amber-50"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-3 w-3 mr-1" /> নতুন কোম্পানি
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
