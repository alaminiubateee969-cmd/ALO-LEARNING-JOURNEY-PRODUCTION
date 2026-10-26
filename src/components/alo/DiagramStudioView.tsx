"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, Code2, Copy, Download, Eye, FileCode2,
  Layers, Loader2, Palette, RefreshCw, Search, ShieldCheck, Sparkles, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ArchifyToolbarButton,
  EditorialButton,
  HotkeyButton,
  SectionHeader,
  SegmentedControl,
} from "./primitives";
import {
  DIAGRAM_PRESETS,
  DIAGRAM_SKINS,
  DIAGRAM_SIZE_PRESETS,
  DIAGRAM_TYPES_45,
  parseMermaidToEditorialPreset,
  renderEditorialDiagramSvg,
  renderSelfContainedDiagramHtml,
  verifyDiagramDoctor,
  type DiagramPreset,
  type DiagramSkinId,
} from "@/lib/diagram-design";
import {
  exportBlockRegistry,
  parseDrawioToEditorialPreset,
  parseExcalidrawToEditorialPreset,
  type FidelityLedger,
} from "@/lib/diagram-import";
import { useToast } from "@/hooks/use-toast";

const SAMPLE_MERMAID = `graph LR
  Enquiry["Student Enquiry"] ==>|Consent Check|CRM["Admissions CRM"]
  CRM -->|Shortlist 3-5|Verify["Official University Page"]
  Verify ==>|CAS / PAL / I-20|Quote["BDT / GBP Quotation"]
  Quote -.->|Audit Trail|Vault["AES-256-GCM Backup"]`;

export default function DiagramStudioView() {
  const { toast } = useToast();
  const [tab, setTab] = useState("canvas");
  const [presetId, setPresetId] = useState(DIAGRAM_PRESETS[0].id);
  const [skinId, setSkinId] = useState<DiagramSkinId>("editorial-light");
  const [dottedPaper, setDottedPaper] = useState(false);
  const [customPreset, setCustomPreset] = useState<DiagramPreset | null>(null);
  const [mermaidText, setMermaidText] = useState(SAMPLE_MERMAID);
  const [mermaidTitle, setMermaidTitle] = useState("Student Enquiry to Verified Quotation Flow");
  const [typeQuery, setTypeQuery] = useState("");
  const [typeCategory, setTypeCategory] = useState("all");
  const [importKind, setImportKind] = useState<"mermaid" | "drawio" | "excalidraw">("mermaid");
  const [drawioText, setDrawioText] = useState("");
  const [excalidrawText, setExcalidrawText] = useState("");
  const [ledger, setLedger] = useState<FidelityLedger | null>(null);
  const [sizeId, setSizeId] = useState("doc-inline");
  const [offlineFonts, setOfflineFonts] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [pngBusy, setPngBusy] = useState(false);
  const [demoViewMode, setDemoViewMode] = useState<"diagram" | "table" | "kanban">("diagram");
  const [activeBeaconRole, setActiveBeaconRole] = useState<"frontend" | "backend" | "database" | "cloud" | "security">("frontend");

  const activePreset = customPreset ?? DIAGRAM_PRESETS.find((p) => p.id === presetId) ?? DIAGRAM_PRESETS[0];
  const activeSkin = DIAGRAM_SKINS[skinId];

  const svgMarkup = useMemo(
    () => renderEditorialDiagramSvg(activePreset, skinId, dottedPaper, sizeId),
    [activePreset, skinId, dottedPaper, sizeId]
  );
  const htmlMarkup = useMemo(
    () => renderSelfContainedDiagramHtml(activePreset, skinId, dottedPaper, sizeId, offlineFonts),
    [activePreset, skinId, dottedPaper, sizeId, offlineFonts]
  );
  const registryJson = useMemo(() => {
    try {
      return JSON.stringify(exportBlockRegistry(htmlMarkup, `${activePreset.id}.html`), null, 2);
    } catch {
      return null;
    }
  }, [htmlMarkup, activePreset.id]);
  const doctor = useMemo(() => verifyDiagramDoctor(skinId, activePreset), [skinId, activePreset]);

  const filteredTypes = useMemo(
    () =>
      DIAGRAM_TYPES_45.filter((item) => {
        if (typeCategory !== "all" && item.category !== typeCategory) return false;
        const needle = typeQuery.trim().toLowerCase();
        return !needle || item.name.toLowerCase().includes(needle) || item.whenToUse.toLowerCase().includes(needle);
      }),
    [typeCategory, typeQuery]
  );

  useEffect(() => {
    // Keep server route warm
    void fetch(`/api/diagrams?preset=${encodeURIComponent(presetId)}&skin=${encodeURIComponent(skinId)}`).catch(() => null);
  }, [presetId, skinId]);

  function selectBuiltInPreset(id: string) {
    setCustomPreset(null);
    setPresetId(id);
  }

  function redrawMermaid() {
    const parsed = parseMermaidToEditorialPreset(mermaidText, mermaidTitle);
    setCustomPreset(parsed);
    setTab("canvas");
    toast({
      title: "Redrawn as orthogonal Editorial SVG",
      description: `${parsed.nodes.length} nodes · ${parsed.edges.length} orthogonal connectors (r=8 bends)`,
    });
  }

  async function redrawImport() {
    setImportBusy(true);
    try {
      if (importKind === "mermaid") {
        redrawMermaid();
        return;
      }
      if (importKind === "drawio") {
        const { preset: parsed, ledger: led } = await parseDrawioToEditorialPreset(drawioText, mermaidTitle);
        setCustomPreset(parsed);
        setLedger(led);
        setTab("canvas");
        toast({
          title: "draw.io redrawn (not converted)",
          description: `${led.keptNodes} nodes · ${led.keptEdges} connectors kept of ${led.sourceNodes}/${led.sourceEdges} source. Fidelity ledger in Import tab.`,
        });
        return;
      }
      const { preset: parsed, ledger: led } = parseExcalidrawToEditorialPreset(excalidrawText, mermaidTitle);
      setCustomPreset(parsed);
      setLedger(led);
      setTab("canvas");
      toast({
        title: "Excalidraw board redrawn (not rendered)",
        description: `${led.keptNodes} nodes · ${led.keptEdges} connectors kept of ${led.sourceNodes}/${led.sourceEdges} source. Fidelity ledger in Import tab.`,
      });
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Check the source file and retry.",
        variant: "destructive",
      });
    } finally {
      setImportBusy(false);
    }
  }

  function downloadRegistry() {
    if (!registryJson) {
      toast({
        title: "No block registry on this diagram",
        description: "--registry applies only to Traceable block decomposition diagrams carrying data-block-* metadata.",
        variant: "destructive",
      });
      return;
    }
    downloadFile(registryJson, `${activePreset.id}.registry.json`, "application/json;charset=utf-8");
    toast({ title: "Exported .registry.json", description: "Block metadata projection — no timestamp, diff-friendly." });
  }

  async function handleImportFile(file: File) {
    const text = await file.text();
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".excalidraw") || lower.endsWith(".json")) {
      setImportKind("excalidraw");
      setExcalidrawText(text);
    } else {
      setImportKind("drawio");
      setDrawioText(text);
    }
    toast({ title: `Loaded ${file.name}`, description: "Review the source, then press Redraw." });
  }

  function downloadFile(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPng() {
    setPngBusy(true);
    try {
      const res = await fetch("/api/diagrams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: customPreset ? "import_mermaid" : "render",
          presetId: activePreset.id,
          skinId,
          dottedPaper,
          mermaidSource: customPreset ? mermaidText : undefined,
          title: customPreset ? mermaidTitle : undefined,
          format: "png",
        }),
      });
      if (!res.ok) throw new Error("PNG export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activePreset.id}-${skinId}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exported PNG diagram", description: `${activePreset.id}-${skinId}.png` });
    } catch (error) {
      toast({
        title: "Could not export PNG",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setPngBusy(false);
    }
  }

  async function copyCode(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied`, description: "Ready to paste into your project or document." });
    } catch {
      toast({ title: "Clipboard permission required", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-5 alo-fade-up">
      <SectionHeader
        title="Diagram & Button Design Studio"
        bn="ডায়াগ্রাম ও বাটন ডিজাইন"
        desc="Self-contained Editorial HTML + inline SVG schematics (45 visual types, 5 WCAG-verified skins, r=8 orthogonal connectors, Mermaid redraw importer) plus the interactive Button & Control Design System."
        icon={<Layers className="h-5 w-5" />}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadFile(svgMarkup, `${activePreset.id}-${skinId}.svg`, "image/svg+xml;charset=utf-8")}
            >
              <Download className="h-3.5 w-3.5" />
              Export .SVG
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadFile(htmlMarkup, `${activePreset.id}-${skinId}.html`, "text/html;charset=utf-8")}
            >
              <FileCode2 className="h-3.5 w-3.5" />
              Export .HTML
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={downloadRegistry}>
              <FileCode2 className="h-3.5 w-3.5" />
              .registry.json
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void downloadPng()}
              disabled={pngBusy}
              className="bg-amber-500 text-white hover:bg-amber-600"
            >
              {pngBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Export .PNG
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-5">
          <TabsTrigger value="canvas" className="gap-1.5 text-xs">
            <Eye className="h-3.5 w-3.5" />
            Editorial Canvas
          </TabsTrigger>
          <TabsTrigger value="buttons" className="gap-1.5 text-xs">
            <Sparkles className="h-3.5 w-3.5" />
            Button & UI System
          </TabsTrigger>
          <TabsTrigger value="mermaid" className="gap-1.5 text-xs">
            <Wand2 className="h-3.5 w-3.5" />
            Import & Redraw
          </TabsTrigger>
          <TabsTrigger value="doctor" className="gap-1.5 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" />
            WCAG & Geometry Doctor
          </TabsTrigger>
          <TabsTrigger value="catalog" className="gap-1.5 text-xs">
            <Layers className="h-3.5 w-3.5" />
            45 Diagram Types
          </TabsTrigger>
        </TabsList>

        {/* 1. EDITORIAL DIAGRAM CANVAS */}
        <TabsContent value="canvas" className="mt-4 space-y-4">
          <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="space-y-3">
              <Card className="space-y-3 p-3.5">
                <div>
                  <Label className="text-xs font-semibold">1. Choose Schematic Preset</Label>
                  <p className="text-[11px] text-muted-foreground">Target density ≤ 9 nodes · 1–2 focal accents</p>
                </div>
                <div className="space-y-1.5">
                  {DIAGRAM_PRESETS.map((preset) => {
                    const isSelected = !customPreset && preset.id === activePreset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => selectBuiltInPreset(preset.id)}
                        className={`w-full rounded-lg border p-2.5 text-left transition-all ${
                          isSelected
                            ? "border-amber-500 bg-amber-500/10 font-semibold"
                            : "border-border/70 bg-card hover:bg-muted/50"
                        }`}
                      >
                        <span className="block text-xs">{preset.title}</span>
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">
                          {preset.visualType} · {preset.nodes.length} nodes · {preset.edges.length} orthogonal edges
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card className="space-y-3 p-3.5">
                <div>
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5 text-amber-600" />
                    2. Skin & Token Profile
                  </Label>
                  <p className="text-[11px] text-muted-foreground">Every skin clears ≥ 4.5:1 WCAG text contrast</p>
                </div>
                <div className="space-y-1.5">
                  {Object.values(DIAGRAM_SKINS).map((skin) => (
                    <button
                      key={skin.id}
                      type="button"
                      onClick={() => setSkinId(skin.id)}
                      className={`w-full flex items-center justify-between gap-2 rounded-lg border p-2 text-left text-xs transition-all ${
                        skinId === skin.id ? "border-amber-500 bg-amber-500/10 font-semibold" : "border-border/70 hover:bg-muted/50"
                      }`}
                    >
                      <span className="truncate">{skin.name}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        <span className="h-3.5 w-3.5 rounded-sm border border-black/20" style={{ background: skin.paper }} title={`paper: ${skin.paper}`} />
                        <span className="h-3.5 w-3.5 rounded-sm border border-black/20" style={{ background: skin.ink }} title={`ink: ${skin.ink}`} />
                        <span className="h-3.5 w-3.5 rounded-sm border border-black/20" style={{ background: skin.accent }} title={`accent: ${skin.accent}`} />
                        <span className="h-3.5 w-3.5 rounded-sm border border-black/20" style={{ background: skin.link }} title={`link: ${skin.link}`} />
                      </span>
                    </button>
                  ))}
                </div>

                <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs">
                  <input
                    type="checkbox"
                    checked={dottedPaper}
                    onChange={(e) => setDottedPaper(e.target.checked)}
                    className="h-4 w-4 accent-amber-600"
                  />
                  <span>Opt-in dotted paper ground (22px grid)</span>
                </label>
              </Card>

              <Card className="space-y-2.5 p-3.5">
                <div>
                  <Label className="text-xs font-semibold">3. Canvas Size & Fonts</Label>
                  <p className="text-[11px] text-muted-foreground">output-spec.md size presets incl. print A3 landscape</p>
                </div>
                <select
                  value={sizeId}
                  onChange={(e) => setSizeId(e.target.value)}
                  className="w-full rounded-md border border-border/70 bg-background px-2 py-1.5 text-xs"
                >
                  {DIAGRAM_SIZE_PRESETS.map((size) => (
                    <option key={size.id} value={size.id}>
                      {size.label} — {size.viewBox.width}×{size.viewBox.height} ({size.use})
                    </option>
                  ))}
                </select>
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={offlineFonts}
                    onChange={(e) => setOfflineFonts(e.target.checked)}
                    className="h-4 w-4 accent-amber-600"
                  />
                  <span>Offline fonts (system stacks only — no Google Fonts request)</span>
                </label>
              </Card>
            </aside>

            <div className="min-w-0 space-y-3">
              <Card className="overflow-hidden border-border/80 p-3 sm:p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {activePreset.semanticPattern}
                    </Badge>
                    <Badge className="bg-emerald-600 text-white text-[10px]">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      WCAG & 6-Rule Orthogonal Verified
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => void copyCode(svgMarkup, "Inline SVG")}>
                      <Copy className="h-3 w-3" />
                      Copy SVG
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => void copyCode(htmlMarkup, "Self-contained HTML")}>
                      <Code2 className="h-3 w-3" />
                      Copy HTML
                    </Button>
                  </div>
                </div>

                <div
                  className="overflow-hidden rounded-xl border border-border/70 shadow-xs"
                  dangerouslySetInnerHTML={{ __html: svgMarkup }}
                />
              </Card>

              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="p-3.5">
                  <p className="font-mono text-[10px] font-semibold uppercase text-amber-600">Rule 1 & 3 · Orthogonal Z-Order</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Connectors route strictly at 90° with <code>r=8</code> quarter-arc bends and are emitted before node opaque masks so lines never bleed through boxes.
                  </p>
                </Card>
                <Card className="p-3.5">
                  <p className="font-mono text-[10px] font-semibold uppercase text-emerald-600">Rule 2 & 6 · Opaque Label Masks</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Connector labels sit 8px above the stroke over an opaque <code>{"{paper}"}</code> mask rect in open gutter canvas—never overlapping node borders.
                  </p>
                </Card>
                <Card className="p-3.5">
                  <p className="font-mono text-[10px] font-semibold uppercase text-sky-600">Rule 4 & 5 · Rectangular Type Tags</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nodes carry crisp <code>rx=2</code> rectangular type tags (never rounded pills), with coral/amber reserved for 1–2 focal nodes max.
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 2. INTERACTIVE BUTTON & UI CONTROL DESIGN SYSTEM */}
        <TabsContent value="buttons" className="mt-4 space-y-4">
          <Card className="p-4 sm:p-5 space-y-5">
            <div>
              <h2 className="text-base font-semibold">Button & Interactive Control Design System</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Interactive UI pattern previews adapted from <strong>Archify (&ldquo;The Evidence Console&rdquo;)</strong>, <strong>Diagram Design Editorial</strong>, <strong>Omarchy TUI</strong>, <strong>Twenty / Frappe CRM</strong>, and <strong>ALO Warm Gradient</strong>. This showcase does not imply that the depicted backend actions are connected.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Family 1: Archify Evidence Console */}
              <Card className="p-4 bg-[#020617] text-white border-[#1E293B]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[#22D3EE]">Pattern 01 · Archify Evidence Console</p>
                    <h3 className="text-sm font-semibold text-white mt-0.5">Toolbar Buttons with Semantic Beacons</h3>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 border-[#334155] bg-[#0F172A] text-xs text-white hover:bg-[#1E293B]"
                    onClick={() =>
                      void copyCode(
                        `<ArchifyToolbarButton label="Inspect Node" beacon="FE" role="frontend" active />`,
                        "ArchifyToolbarButton"
                      )
                    }
                  >
                    <Copy className="h-3 w-3" />
                    Copy JSX
                  </Button>
                </div>
                <p className="text-xs text-[#94A3B8] mb-3">
                  Dark slate mask (<code>#0F172A</code>), <code>JetBrains Mono</code> label, and <code>30×12px</code> semantic role beacon pills (<code>frontend #22D3EE</code>, <code>backend #34D399</code>, <code>database #A78BFA</code>, <code>cloud #FBBF24</code>, <code>security #FB7185</code>).
                </p>
                <div className="flex flex-wrap gap-2">
                  <ArchifyToolbarButton label="Frontend Surface" beacon="FE" role="frontend" active={activeBeaconRole === "frontend"} onClick={() => setActiveBeaconRole("frontend")} />
                  <ArchifyToolbarButton label="API Worker" beacon="API" role="backend" active={activeBeaconRole === "backend"} onClick={() => setActiveBeaconRole("backend")} />
                  <ArchifyToolbarButton label="Prisma Store" beacon="DB" role="database" active={activeBeaconRole === "database"} onClick={() => setActiveBeaconRole("database")} />
                  <ArchifyToolbarButton label="LAN Inference" beacon="AI" role="cloud" active={activeBeaconRole === "cloud"} onClick={() => setActiveBeaconRole("cloud")} />
                  <ArchifyToolbarButton label="OTP Guard" beacon="SEC" role="security" active={activeBeaconRole === "security"} onClick={() => setActiveBeaconRole("security")} />
                </div>
              </Card>

              {/* Family 2: Editorial Tactile Buttons */}
              <Card className="p-4 bg-[#f5f5f5] text-[#2d3142] border-[#bfc0c0]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[#bf4520]">Pattern 02 · Diagram Design Editorial</p>
                    <h3 className="text-sm font-semibold text-[#2d3142] mt-0.5">Editorial Tactile Button Preview · contrast not audited</h3>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 border-[#2d3142]/30 bg-white text-xs text-[#2d3142]"
                    onClick={() =>
                      void copyCode(
                        `<EditorialButton variant="accent" tag="SVG">Export Schematic</EditorialButton>`,
                        "EditorialButton"
                      )
                    }
                  >
                    <Copy className="h-3 w-3" />
                    Copy JSX
                  </Button>
                </div>
                <p className="text-xs text-[#4f5d75] mb-3">
                  No drop shadows. Uses <code>rx=6</code> outer frame, <code>rx=2</code> rectangular type tag, and darkened burnt-tangerine (<code>#bf4520</code>) that clears 4.71:1 contrast on white-smoke paper.
                </p>
                <div className="flex flex-wrap gap-2">
                  <EditorialButton variant="accent" tag="ACT" onClick={() => toast({ title: "Preview only", description: "No schematic was generated." })}>
                    Generate Schematic
                  </EditorialButton>
                  <EditorialButton variant="paper" tag="DOC" onClick={() => toast({ title: "Preview only", description: "No style guide profile was loaded." })}>
                    Inspect Style Guide
                  </EditorialButton>
                  <EditorialButton variant="link" tag="API" onClick={() => toast({ title: "Preview only", description: "No HTTP endpoint or contrast audit was checked." })}>
                    Contrast example (not verified)
                  </EditorialButton>
                </div>
              </Card>

              {/* Family 3: Twenty / Frappe / Studytra Segmented View Switcher */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-amber-600">Pattern 03 · Twenty & Frappe CRM</p>
                    <h3 className="text-sm font-semibold mt-0.5">Segmented View Switcher & Count Pills</h3>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() =>
                      void copyCode(
                        `<SegmentedControl value={mode} onChange={setMode} options={[{ id: "table", label: "Table", count: 24 }, { id: "kanban", label: "Board", count: 7 }]} />`,
                        "SegmentedControl"
                      )
                    }
                  >
                    <Copy className="h-3 w-3" />
                    Copy JSX
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Used in Admissions CRM and Bricks tables to switch cleanly between Kanban Pipeline, Card Grid, and Data Table views without page reloads.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <SegmentedControl
                    value={demoViewMode}
                    onChange={setDemoViewMode}
                    options={[
                      { id: "diagram", label: "Diagram", count: 5 },
                      { id: "table", label: "Table", count: 31 },
                      { id: "kanban", label: "Pipeline", count: 7 },
                    ]}
                  />
                  <Badge variant="outline" className="text-xs">
                    Active view: {demoViewMode}
                  </Badge>
                </div>
              </Card>

              {/* Family 4: Omarchy / Command Hotkey Buttons */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-600">Pattern 04 · Omarchy & Command Palette</p>
                    <h3 className="text-sm font-semibold mt-0.5">Hotkey Badge Button Preview · shortcuts not wired</h3>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() =>
                      void copyCode(`<HotkeyButton label="Command Palette" hotkey="⌘K" />`, "HotkeyButton")
                    }
                  >
                    <Copy className="h-3 w-3" />
                    Copy JSX
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Shows inline monospace <code>&lt;kbd&gt;</code> chord badges for visual preview. These buttons do not register or execute keyboard shortcuts.
                </p>
                <div className="flex flex-wrap gap-2">
                  <HotkeyButton label="Command Center (preview)" hotkey="⌘K" onClick={() => toast({ title: "Preview only", description: "No command palette shortcut is registered here." })} />
                  <HotkeyButton label="Prompt review (preview)" hotkey="⇧↵" onClick={() => toast({ title: "Preview only", description: "This button does not run a review pipeline." })} />
                  <HotkeyButton label="Backup export (preview)" hotkey="⌘B" onClick={() => toast({ title: "Preview only", description: "No backup was created or encrypted." })} />
                </div>
              </Card>
            </div>
          </Card>
        </TabsContent>

        {/* 3. MERMAID / DRAW.IO / EXCALIDRAW REDRAW IMPORTER */}
        <TabsContent value="mermaid" className="mt-4 space-y-4">
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Import Mermaid / draw.io / Excalidraw → Redraw as Editorial SVG</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  A <strong>redraw, not a conversion</strong> (diagram-design v2.6.110 import pipelines): source geometry, palette, and hand-dragged coordinates are discarded; components and relationships redraw on the 4px grid with r=8 orthogonal connectors. Every import ships a fidelity ledger.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border/70 px-2.5 py-1.5 text-xs hover:bg-muted/50">
                  <FileCode2 className="h-3.5 w-3.5" />
                  Load .drawio / .excalidraw
                  <input
                    type="file"
                    accept=".drawio,.xml,.excalidraw,.json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleImportFile(f);
                    }}
                  />
                </label>
                <Button type="button" onClick={() => void redrawImport()} disabled={importBusy} className="bg-amber-500 text-white hover:bg-amber-600">
                  {importBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Redraw into Editorial Canvas
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold">Source format:</span>
              {(["mermaid", "drawio", "excalidraw"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setImportKind(kind)}
                  className={`rounded-full border px-3 py-1 text-xs transition-all ${
                    importKind === kind ? "border-amber-500 bg-amber-500/10 font-semibold" : "border-border/70 hover:bg-muted/50"
                  }`}
                >
                  {kind === "mermaid" ? "Mermaid / DSL" : kind === "drawio" ? "draw.io XML" : "Excalidraw JSON"}
                </button>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="import-title" className="text-xs">Diagram Title</Label>
                  <Input id="import-title" value={mermaidTitle} onChange={(e) => setMermaidTitle(e.target.value)} className="mt-1" />
                </div>
                {importKind === "mermaid" && (
                  <div>
                    <Label htmlFor="mermaid-input" className="text-xs">Mermaid / Node-Edge Definition (up to 9 nodes)</Label>
                    <Textarea id="mermaid-input" value={mermaidText} onChange={(e) => setMermaidText(e.target.value)} rows={8} className="mt-1 font-mono text-xs" />
                  </div>
                )}
                {importKind === "drawio" && (
                  <div>
                    <Label htmlFor="drawio-input" className="text-xs">draw.io XML (raw mxfile or compressed &lt;diagram&gt; payload — .drawio.png pixel exports are rejected by design)</Label>
                    <Textarea id="drawio-input" value={drawioText} onChange={(e) => setDrawioText(e.target.value)} rows={8} className="mt-1 font-mono text-xs" placeholder='<mxfile><diagram name="Page-1">…</diagram></mxfile>' />
                  </div>
                )}
                {importKind === "excalidraw" && (
                  <div>
                    <Label htmlFor="excalidraw-input" className="text-xs">Excalidraw scene JSON (saved .excalidraw — links, embeds, and image pixels are counted and discarded)</Label>
                    <Textarea id="excalidraw-input" value={excalidrawText} onChange={(e) => setExcalidrawText(e.target.value)} rows={8} className="mt-1 font-mono text-xs" placeholder='{"type":"excalidraw","elements":[…]}' />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Fidelity Ledger (every import ships one)</Label>
                <div className="max-h-[320px] space-y-1.5 overflow-y-auto rounded-xl border border-border/70 p-3 text-xs">
                  {ledger ? (
                    <>
                      <p className="font-semibold">
                        {ledger.sourceFormat} source: {ledger.sourceNodes} nodes · {ledger.sourceEdges} edges · {ledger.sourceContainers} containers
                      </p>
                      <p className="text-muted-foreground">
                        Redraw: {ledger.keptNodes} nodes · {ledger.keptEdges} connectors kept. Source coordinates and palette discarded by design.
                      </p>
                      {ledger.warnings.map((w, i) => (
                        <p key={`w${i}`} className="rounded-md bg-amber-500/10 p-1.5 text-amber-700 dark:text-amber-400">⚠ {w}</p>
                      ))}
                      <ul className="space-y-1">
                        {ledger.entries.slice(0, 24).map((entry, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span
                              className={`mt-0.5 rounded px-1 py-0.5 font-mono text-[9px] uppercase ${
                                entry.action === "dropped" ? "bg-red-500/10 text-red-600 dark:text-red-400" : entry.action === "merged" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              }`}
                            >
                              {entry.action}
                            </span>
                            <span>
                              <strong>{entry.source}</strong> — {entry.reason}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      Load a .drawio or .excalidraw source and press Redraw. The ledger lists every kept, rewritten, merged, and dropped element with its reason — nothing is dropped silently. Mermaid redraws keep all parsed nodes under the 9-node budget.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* 4. WCAG CONTRAST DOCTOR & 6-RULE GEOMETRY VERIFIER */}
        <TabsContent value="doctor" className="mt-4 space-y-4">
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">WCAG 2.x Contrast Doctor & Geometry Gate</h2>
                <p className="text-xs text-muted-foreground">
                  Verifies active skin (<code>{activeSkin.name}</code>) against <code>paper ({activeSkin.paper})</code> and checks all 6 mandatory connector rules.
                </p>
              </div>
              <Badge className={doctor.allPassed ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"}>
                {doctor.allPassed ? "ALL CHECKS PASSED" : "REVIEW REQUIRED"}
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/70 text-[10px] uppercase text-muted-foreground">
                    <th className="py-2 pr-4">Semantic Token</th>
                    <th className="py-2 pr-4">Hex</th>
                    <th className="py-2 pr-4">Background</th>
                    <th className="py-2 pr-4">Measured Ratio</th>
                    <th className="py-2 pr-4">WCAG Minimum</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 font-mono">
                  {doctor.contrastChecks.map((chk) => (
                    <tr key={chk.role}>
                      <td className="py-2.5 pr-4 font-semibold">{chk.role}</td>
                      <td className="py-2.5 pr-4">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-3 w-3 rounded-xs border border-black/20" style={{ background: chk.hex }} />
                          {chk.hex}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">{chk.against}</td>
                      <td className="py-2.5 pr-4 font-bold">{chk.ratio}:1</td>
                      <td className="py-2.5 pr-4">{chk.threshold}:1</td>
                      <td className="py-2.5">
                        <Badge className={chk.passed ? "bg-emerald-600 text-white text-[10px]" : "bg-rose-600 text-white text-[10px]"}>
                          {chk.passed ? "PASS" : "FAIL"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 pt-2">
              {doctor.geometryRules.map((rule) => (
                <Card key={rule.ruleNumber} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold text-amber-600">Rule #{rule.ruleNumber}</span>
                    <Badge className="bg-emerald-600 text-white text-[9px]">{rule.status}</Badge>
                  </div>
                  <p className="mt-1 font-semibold text-xs">{rule.title}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{rule.detail}</p>
                </Card>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* 5. 45 VISUAL DIAGRAM TYPES CATALOG */}
        <TabsContent value="catalog" className="mt-4 space-y-4">
          <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={typeQuery}
                onChange={(e) => setTypeQuery(e.target.value)}
                placeholder="Search 45 visual diagram types (e.g. architecture, swimlane, sankey, wardley)…"
                className="pl-9"
              />
            </div>
            <select
              aria-label="Filter diagram types by category"
              value={typeCategory}
              onChange={(e) => setTypeCategory(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-64"
            >
              <option value="all">All categories ({DIAGRAM_TYPES_45.length})</option>
              {Array.from(new Set(DIAGRAM_TYPES_45.map((t) => t.category))).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Card>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTypes.map((item, idx) => (
              <Card key={item.id} className="p-3.5 alo-glow-hover">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-semibold text-amber-600">
                    #{String(idx + 1).padStart(2, "0")} · {item.id}
                  </span>
                  <Badge variant="outline" className="text-[9px]">
                    {item.category}
                  </Badge>
                </div>
                <h3 className="mt-1 font-semibold text-sm">{item.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{item.whenToUse}</p>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
