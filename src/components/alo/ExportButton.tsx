"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Download, FileJson, FileSpreadsheet, Loader2 } from "lucide-react";

const EXPORT_TYPES = [
  { id: "packages", label: "কনটেন্ট প্যাকেজ", desc: "সকল প্যাকেজ" },
  { id: "comments", label: "মন্তব্য", desc: "সকল মন্তব্য" },
  { id: "analytics", label: "অ্যানালিটিক্স", desc: "মেট্রিক্স স্ন্যাপশট" },
  { id: "posts", label: "প্রকাশিত পোস্ট", desc: "প্রকাশনা সারি" },
];

export default function ExportButton({ compact = false }: { compact?: boolean }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const exportData = async (type: string, format: "json" | "csv") => {
    setBusy(`${type}-${format}`);
    try {
      const res = await fetch(`/api/export?type=${type}&format=${format}`);
      if (format === "csv") {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${type}_export.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${type}_export.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast({ title: `এক্সপোর্ট সম্পন্ন ✅`, description: `${type} → ${format.toUpperCase()}` });
    } catch (e) {
      toast({ title: "এক্সপোর্ট ব্যর্থ", description: String(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={!!busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {!compact && <span>এক্সপোর্ট</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">ডেটা এক্সপোর্ট করুন</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {EXPORT_TYPES.map((t) => (
          <div key={t.id}>
            <DropdownMenuLabel className="text-[10px] text-muted-foreground font-normal">
              {t.label} <span className="opacity-60">— {t.desc}</span>
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => exportData(t.id, "json")} className="text-xs cursor-pointer">
              <FileJson className="h-3 w-3 mr-2 text-amber-600" /> JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportData(t.id, "csv")} className="text-xs cursor-pointer">
              <FileSpreadsheet className="h-3 w-3 mr-2 text-emerald-600" /> CSV
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
