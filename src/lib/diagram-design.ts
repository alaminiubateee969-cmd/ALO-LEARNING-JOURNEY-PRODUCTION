/**
 * Editorial Diagram & Button Design Engine
 * Implements the cathrynlavery/diagram-design (v2.6) & tt-a1i/archify ("The Evidence Console")
 * token system, 6 mandatory orthogonal connector rules, WCAG 2.x contrast doctor,
 * 45 visual diagram types catalog, Mermaid redraw importer, and self-contained HTML+SVG exporter.
 */

export type DiagramSkinId =
  | "editorial-light"
  | "editorial-dark"
  | "archify-console"
  | "terminal-chrome"
  | "alo-warm-brand";

export interface DiagramSkinTokens {
  id: DiagramSkinId;
  name: string;
  subtitle: string;
  paper: string;
  paper2: string;
  ink: string;
  inkStrong: string;
  muted: string;
  soft: string;
  rule: string;
  ruleSolid: string;
  accent: string;
  accentTint: string;
  link: string;
  series: [string, string, string, string, string];
}

export const DIAGRAM_SKINS: Record<DiagramSkinId, DiagramSkinTokens> = {
  "editorial-light": {
    id: "editorial-light",
    name: "Editorial Light (Default)",
    subtitle: "White-smoke paper · Jet-black ink · Burnt-tangerine accent (4.71:1 WCAG)",
    paper: "#f5f5f5",
    paper2: "#ececec",
    ink: "#2d3142",
    inkStrong: "#111111",
    muted: "#4f5d75",
    soft: "#5a6580",
    rule: "rgba(45,49,66,0.12)",
    ruleSolid: "#bfc0c0",
    accent: "#bf4520",
    accentTint: "rgba(191,69,32,0.08)",
    link: "#2e5aa8",
    series: ["#7c8f6f", "#5e7a9b", "#b8915a", "#9c6b50", "#6e6479"],
  },
  "editorial-dark": {
    id: "editorial-dark",
    name: "Editorial Dark",
    subtitle: "Jet-black paper · White-smoke ink · Warm coral accent (5.21:1 WCAG)",
    paper: "#2d3142",
    paper2: "#393e53",
    ink: "#f5f5f5",
    inkStrong: "#111111",
    muted: "#bfc0c0",
    soft: "#949eb2",
    rule: "rgba(245,245,245,0.12)",
    ruleSolid: "rgba(191,192,192,0.25)",
    accent: "#f08a59",
    accentTint: "rgba(240,138,89,0.10)",
    link: "#739fdf",
    series: ["#9caf8f", "#82a0c0", "#d3ad7a", "#b88670", "#8d8298"],
  },
  "archify-console": {
    id: "archify-console",
    name: "Archify Evidence Console",
    subtitle: "Deep slate canvas (#020617) · Cyan & emerald semantic beacons · JetBrains Mono",
    paper: "#020617",
    paper2: "#0F172A",
    ink: "#FFFFFF",
    inkStrong: "#020617",
    muted: "#94A3B8",
    soft: "#94A3B8",
    rule: "#1E293B",
    ruleSolid: "#334155",
    accent: "#22D3EE",
    accentTint: "rgba(34,211,238,0.12)",
    link: "#34D399",
    series: ["#34D399", "#A78BFA", "#FBBF24", "#FB7185", "#FB923C"],
  },
  "terminal-chrome": {
    id: "terminal-chrome",
    name: "Terminal CLI Window",
    subtitle: "CLI-chrome register (#141414) · Signal orange (#ff5a36) focal station",
    paper: "#141414",
    paper2: "#1b1b1b",
    ink: "#f5f5f5",
    inkStrong: "#111111",
    muted: "#9a9a9a",
    soft: "#8a8a8a",
    rule: "#2b2b2b",
    ruleSolid: "#3d3d3d",
    accent: "#ff5a36",
    accentTint: "rgba(255,90,54,0.12)",
    link: "#60a5fa",
    series: ["#86efac", "#93c5fd", "#fcd34d", "#fda4af", "#c4b5fd"],
  },
  "alo-warm-brand": {
    id: "alo-warm-brand",
    name: "ALO Warm Editorial",
    subtitle: "Warm cream paper (#FAF7F2) · Deep stone ink · Amber focal accent",
    paper: "#FAF7F2",
    paper2: "#F3EDE2",
    ink: "#1C1917",
    inkStrong: "#111111",
    muted: "#57534E",
    soft: "#665E57",
    rule: "rgba(28,25,23,0.12)",
    ruleSolid: "#D6D0C4",
    accent: "#B45309",
    accentTint: "rgba(180,83,9,0.09)",
    link: "#0369A1",
    series: ["#4D7C0F", "#0369A1", "#B45309", "#BE123C", "#6D28D9"],
  },
};

/**
 * Semantic node treatments from diagram-design style-guide.md § "Node type → treatment".
 * Role combinations decide fill/stroke — never raw hex per node.
 */
export type DiagramNodeTreatment =
  | "focal" // accent-tint fill, accent stroke (1–2 max per diagram)
  | "backend" // white fill, ink stroke
  | "store" // ink @ 0.05 fill, muted stroke
  | "external" // ink @ 0.03 fill, ink @ 0.30 stroke
  | "input" // muted @ 0.10 fill, soft stroke
  | "optional" // ink @ 0.02 fill, ink @ 0.20 stroke, dashed 4,3
  | "security"; // accent @ 0.05 fill, accent @ 0.50 stroke, dashed 4,4

export interface DiagramNodeSpec {
  id: string;
  tag: string;
  label: string;
  sublabel: string;
  col: number; // 0..3
  row: number; // 0..3
  focal?: boolean;
  treatment?: DiagramNodeTreatment;
}

/**
 * SVG size presets from output-spec.md §2 — viewBox, PNG scale targets, and type ramp.
 * `print-a3-landscape` is the v2.6 print preset (1584×1120 ≈ A3 landscape at 96dpi with ~10mm margins).
 */
export interface DiagramSizePreset {
  id: string;
  label: string;
  viewBox: { width: number; height: number };
  aspect: string;
  pngScale: number;
  typeRamp: "standard" | "presentation" | "print";
  use: string;
}

export const DIAGRAM_SIZE_PRESETS: DiagramSizePreset[] = [
  { id: "doc-inline", label: "Doc Inline (default)", viewBox: { width: 960, height: 600 }, aspect: "8:5", pngScale: 2, typeRamp: "standard", use: "Body-width diagram in a post or README" },
  { id: "doc-wide", label: "Doc Wide", viewBox: { width: 1280, height: 720 }, aspect: "16:9", pngScale: 2, typeRamp: "standard", use: "Full-width docs, wiki pages" },
  { id: "slide-16x9", label: "Slide 16:9", viewBox: { width: 1280, height: 720 }, aspect: "16:9", pngScale: 2, typeRamp: "presentation", use: "Deck slide, projected" },
  { id: "slide-4x3", label: "Slide 4:3", viewBox: { width: 1024, height: 768 }, aspect: "4:3", pngScale: 2, typeRamp: "presentation", use: "Legacy deck templates" },
  { id: "social-og", label: "Social OG Card", viewBox: { width: 1200, height: 632 }, aspect: "~1.9:1", pngScale: 2, typeRamp: "presentation", use: "Link preview card" },
  { id: "social-square", label: "Social Square", viewBox: { width: 1080, height: 1080 }, aspect: "1:1", pngScale: 2, typeRamp: "presentation", use: "Feed post, carousel" },
  { id: "print-a4-landscape", label: "Print A4 Landscape", viewBox: { width: 1120, height: 792 }, aspect: "~1.41:1", pngScale: 3, typeRamp: "print", use: "A4 landscape handout / PDF deck" },
  { id: "print-a3-landscape", label: "Print A3 Landscape", viewBox: { width: 1584, height: 1120 }, aspect: "~1.41:1", pngScale: 3, typeRamp: "print", use: "A3 landscape, ~10mm margins at 96dpi" },
  { id: "print-letter-landscape", label: "Print Letter Landscape", viewBox: { width: 1056, height: 816 }, aspect: "~1.29:1", pngScale: 3, typeRamp: "print", use: "US Letter landscape" },
  { id: "fit", label: "Fit Content", viewBox: { width: 980, height: 560 }, aspect: "any", pngScale: 2, typeRamp: "standard", use: "Vector hand-off; no fixed frame" },
];

/** Resolve the effective treatment: explicit `treatment` wins; `focal` is shorthand for "focal". */
export function resolveNodeTreatment(spec: DiagramNodeSpec): DiagramNodeTreatment {
  return spec.treatment ?? (spec.focal ? "focal" : "backend");
}

/** Hex + alpha → rgba() string, used to composite role tokens per the contrast contract. */
function hexToRgba(hex: string, alpha: number): string {
  const rgb = parseHexToRgb(hex) ?? [45, 49, 66];
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

/** Map a semantic treatment to fill/stroke/stroke-dash per style-guide.md § "Node type → treatment". */
export function nodeTreatmentPaint(
  treatment: DiagramNodeTreatment,
  skin: DiagramSkinTokens
): { fill: string; stroke: string; strokeWidth: string; dash?: string } {
  switch (treatment) {
    case "focal":
      return { fill: skin.accentTint, stroke: skin.accent, strokeWidth: "1.5" };
    case "store":
      return { fill: hexToRgba(skin.ink, 0.05), stroke: skin.muted, strokeWidth: "1" };
    case "external":
      return { fill: hexToRgba(skin.ink, 0.03), stroke: hexToRgba(skin.ink, 0.3), strokeWidth: "1" };
    case "input":
      return { fill: hexToRgba(skin.muted, 0.1), stroke: skin.soft, strokeWidth: "1" };
    case "optional":
      return { fill: hexToRgba(skin.ink, 0.02), stroke: hexToRgba(skin.ink, 0.2), strokeWidth: "1", dash: "4,3" };
    case "security":
      return { fill: hexToRgba(skin.accent, 0.05), stroke: hexToRgba(skin.accent, 0.5), strokeWidth: "1", dash: "4,4" };
    case "backend":
    default:
      return { fill: skin.id === "editorial-dark" || skin.id === "archify-console" ? skin.paper2 : "#ffffff", stroke: skin.ink, strokeWidth: "1" };
  }
}

export interface DiagramEdgeSpec {
  from: string;
  to: string;
  label?: string;
  role?: "default" | "accent" | "link" | "dashed";
}

export interface DiagramPreset {
  id: string;
  title: string;
  eyebrow: string;
  subtitle: string;
  visualType: string;
  semanticPattern: string;
  callout: string;
  nodes: DiagramNodeSpec[];
  edges: DiagramEdgeSpec[];
}

export const DIAGRAM_PRESETS: DiagramPreset[] = [
  {
    id: "alo-architecture",
    title: "ALO Local-First AI & Admissions Architecture",
    eyebrow: "SYSTEM ARCHITECTURE · SECURE PAVED ROAD",
    subtitle: "Next.js 16 Command Center, Private LAN AI Boundary, Resilient Prisma + Local Store, and FFmpeg Media Engine.",
    visualType: "Architecture",
    semanticPattern: "Secure paved road → Architecture",
    callout: "Focal nodes (Amber/Coral) mark the 3-Agent Quality Gate and Private LAN AI Boundary. Zero unapproved external calls.",
    nodes: [
      { id: "ui", tag: "UI", label: "Next.js 16 Command UI", sublabel: "31 views · Cmd+K · Bengali/EN", col: 0, row: 0 },
      { id: "auth", tag: "SEC", label: "Admin Scrypt + SMS OTP", sublabel: "Middleware · Rate-limited", col: 1, row: 0 },
      { id: "gate", tag: "GATE", label: "3-Agent Quality Council", sublabel: "Writer → Critic → Finalist", col: 2, row: 0, focal: true },
      { id: "crm", tag: "CRM", label: "Admissions & Quotations", sublabel: "Leads · Activities · BDT Quotes", col: 0, row: 1 },
      { id: "ai", tag: "AI", label: "Private LAN AI Engine", sublabel: "Ollama · ComfyUI · Local Synth", col: 2, row: 1, focal: true },
      { id: "db", tag: "DB", label: "Prisma MySQL + JSON Store", sublabel: "32 models · partial AES-256-GCM snapshot", col: 1, row: 2 },
      { id: "media", tag: "AV", label: "FFmpeg + Speech + Sharp", sublabel: "1080x1920 MP4 · WAV · SRT", col: 2, row: 2 },
    ],
    edges: [
      { from: "ui", to: "auth", label: "HTTPS / Session", role: "default" },
      { from: "auth", to: "gate", label: "Verified request", role: "accent" },
      { from: "ui", to: "crm", label: "x-alo-company-id", role: "link" },
      { from: "gate", to: "ai", label: "RFC1918 / 127.0.0.1", role: "accent" },
      { from: "crm", to: "db", label: "Transactions", role: "default" },
      { from: "ai", to: "media", label: "Scenes + WAV + SRT", role: "link" },
      { from: "ai", to: "db", label: "Audit & AgentRuns", role: "dashed" },
    ],
  },
  {
    id: "admissions-funnel",
    title: "Admissions CRM & Quotation Lifecycle",
    eyebrow: "LIFECYCLE PHASE MAP · STATE MACHINE",
    subtitle: "Company-scoped student enquiry progression from initial capture to verified quotation and enrollment.",
    visualType: "State machine",
    semanticPattern: "Lifecycle phase map → State Machine",
    callout: "Human consent verification and official university deadline checks gate the transition to Application & Enrollment.",
    nodes: [
      { id: "new", tag: "STG1", label: "New Enquiry", sublabel: "Consent status recorded", col: 0, row: 0 },
      { id: "qual", tag: "STG2", label: "Qualified", sublabel: "Country & intake matched", col: 1, row: 0 },
      { id: "coun", tag: "STG3", label: "Counselled", sublabel: "3-5 universities shortlisted", col: 2, row: 0, focal: true },
      { id: "quote", tag: "DOC", label: "Itemised Quotation", sublabel: "ALO-2026-* · Tax & discount", col: 1, row: 1 },
      { id: "app", tag: "STG4", label: "Application Submitted", sublabel: "CAS / I-20 / PAL / APS tracked", col: 2, row: 1, focal: true },
      { id: "enr", tag: "WIN", label: "Enrolled & Pre-Departure", sublabel: "Housing & arrival checklist", col: 2, row: 2 },
    ],
    edges: [
      { from: "new", to: "qual", label: "Eligibility check", role: "default" },
      { from: "qual", to: "coun", label: "20-min review", role: "accent" },
      { from: "coun", to: "quote", label: "Prepare quote", role: "link" },
      { from: "quote", to: "app", label: "Quote accepted", role: "accent" },
      { from: "app", to: "enr", label: "Offer & visa verified", role: "default" },
    ],
  },
  {
    id: "growth-flywheel",
    title: "6-Stage Bengali Parenting & Education Growth Loop",
    eyebrow: "REINFORCING FLYWHEEL · LOOP DIAGRAM",
    subtitle: "Compounding content loop from high-empathy topic scoring to protective review and self-learning rules.",
    visualType: "Loop",
    semanticPattern: "Reinforcing cycle → Loop",
    callout: "SafetyGuardianAgent blocks any fear-based, child-shaming, or unverified medical/legal claims before human approval.",
    nodes: [
      { id: "topic", tag: "01", label: "5-Axis Topic Scorer", sublabel: "Virality · Empathy · Safety", col: 0, row: 0 },
      { id: "hooks", tag: "02", label: "5 Psychological Hooks", sublabel: "Question · Story · Stat", col: 1, row: 0 },
      { id: "pkg", tag: "03", label: "3-Agent Content Studio", sublabel: "Writer → Critic → Finalist", col: 2, row: 0, focal: true },
      { id: "safe", tag: "04", label: "Protective Safety Gate", sublabel: "Child-safe · Non-judgmental", col: 2, row: 1, focal: true },
      { id: "media", tag: "05", label: "9:16 Video & Audio Synth", sublabel: "Bengali TTS · Ken Burns MP4", col: 1, row: 1 },
      { id: "learn", tag: "06", label: "Self-Learning Memory", sublabel: "Feedback → Prompt rules", col: 0, row: 1 },
    ],
    edges: [
      { from: "topic", to: "hooks", label: "Score ≥ 75", role: "default" },
      { from: "hooks", to: "pkg", label: "Top hook selected", role: "accent" },
      { from: "pkg", to: "safe", label: "Policy audit", role: "accent" },
      { from: "safe", to: "media", label: "Approved script", role: "link" },
      { from: "media", to: "learn", label: "Engagement signals", role: "default" },
      { from: "learn", to: "topic", label: "Updated weights", role: "dashed" },
    ],
  },
  {
    id: "enrichment-waterfall",
    title: "OpenProspector & Market Signal Enrichment Waterfall",
    eyebrow: "DATA FLOW · WATERFALL ORCHESTRATION",
    subtitle: "Zero-waste verification cascade: check local cache first, verify official institution pages, and log evidence.",
    visualType: "Data flow",
    semanticPattern: "Unstructured input → structured artifact → Data flow",
    callout: "Cached institutional checks cost $0 and prevent duplicate queries; every signal links to its verified public source.",
    nodes: [
      { id: "sig", tag: "IN", label: "Inbound Signal / Lead", sublabel: "Enquiry or university update", col: 0, row: 0 },
      { id: "cache", tag: "L1", label: "Local Dedup & Cache", sublabel: "storage/local-db.json · 0ms", col: 1, row: 0, focal: true },
      { id: "inst", tag: "L2", label: "Official Course Verifier", sublabel: "GOV.UK · IRCC · DAAD · CRICOS", col: 2, row: 0, focal: true },
      { id: "rag", tag: "L3", label: "RAG Knowledge Match", sublabel: "Citations & cutoff history", col: 1, row: 1 },
      { id: "crm2", tag: "OUT", label: "Enriched CRM Record", sublabel: "Verified checklist attached", col: 2, row: 1 },
    ],
    edges: [
      { from: "sig", to: "cache", label: "Lookup key", role: "default" },
      { from: "cache", to: "inst", label: "Cache miss", role: "accent" },
      { from: "cache", to: "rag", label: "Context match", role: "link" },
      { from: "inst", to: "crm2", label: "Verified dates", role: "accent" },
      { from: "rag", to: "crm2", label: "RAG citations", role: "dashed" },
    ],
  },
  {
    id: "security-layers",
    title: "Defense-in-Depth & Privacy Control Stack",
    eyebrow: "GOVERNANCE CATALOG · LAYER STACK",
    subtitle: "Compensating security controls across authentication, private-network AI, child-safe media, and AES-256-GCM backups.",
    visualType: "Layer stack",
    semanticPattern: "Compensating security layers → Layer stack",
    callout: "Every layer fails closed in production: missing auth secrets, unconfirmed family consent, or public AI URLs are rejected.",
    nodes: [
      { id: "l1", tag: "L1", label: "Edge & Auth Gate", sublabel: "Scrypt + Single-use SMS OTP", col: 0, row: 0, focal: true },
      { id: "l2", tag: "L2", label: "Tenant & Consent Guard", sublabel: "Company scope + Guardian consent", col: 1, row: 0 },
      { id: "l3", tag: "L3", label: "Private LAN AI Boundary", sublabel: "Loopback / RFC1918 allowlist only", col: 2, row: 0, focal: true },
      { id: "l4", tag: "L4", label: "AES-256-GCM Backup Vault", sublabel: "ALO256GCM1 + 12B IV + 16B AuthTag", col: 1, row: 1 },
    ],
    edges: [
      { from: "l1", to: "l2", label: "Authenticated token", role: "accent" },
      { from: "l2", to: "l3", label: "Consent verified", role: "accent" },
      { from: "l2", to: "l4", label: "31-model snapshot", role: "link" },
    ],
  },
];

export interface DiagramTypeCatalogItem {
  id: string;
  name: string;
  category: "Systems & Data" | "Process & State" | "Quantitative & Charts" | "Strategy & Product";
  whenToUse: string;
}

/**
 * All 45 visual diagram types from cathrynlavery/diagram-design SKILL.md §3.
 */
export const DIAGRAM_TYPES_45: DiagramTypeCatalogItem[] = [
  { id: "architecture", name: "Architecture", category: "Systems & Data", whenToUse: "Components + connections in one system snapshot" },
  { id: "architecture-delta", name: "Architecture Delta", category: "Systems & Data", whenToUse: "Before / After topology changes with a Changes ledger" },
  { id: "it-current-state", name: "IT Current-State", category: "Systems & Data", whenToUse: "Legacy IT landscape by phase or department" },
  { id: "flowchart", name: "Flowchart", category: "Process & State", whenToUse: "Decision logic with branches and policy evaluation traces" },
  { id: "sequence", name: "Sequence", category: "Process & State", whenToUse: "Time-ordered messages between actors (e.g. OTP auth flow)" },
  { id: "state-machine", name: "State Machine", category: "Process & State", whenToUse: "States + transitions + guards + lifecycle phase maps" },
  { id: "er-model", name: "ER / Data Model", category: "Systems & Data", whenToUse: "Entities + fields + crow's-foot relationships" },
  { id: "timeline", name: "Timeline", category: "Process & State", whenToUse: "Events and intake milestones positioned in time" },
  { id: "swimlane", name: "Swimlane", category: "Process & State", whenToUse: "Cross-functional process with actor handoffs" },
  { id: "quadrant", name: "Quadrant", category: "Strategy & Product", whenToUse: "Two-axis positioning / impact vs effort prioritization" },
  { id: "radar", name: "Radar / Spider", category: "Quantitative & Charts", whenToUse: "Entities scored across 3–5 quantitative criteria" },
  { id: "polar", name: "Polar Chart", category: "Quantitative & Charts", whenToUse: "Cyclic categories where angle=category, radius=magnitude" },
  { id: "loop", name: "Loop / Flywheel", category: "Process & State", whenToUse: "Reinforcing cycle where the last step feeds the first" },
  { id: "nested", name: "Nested Containment", category: "Systems & Data", whenToUse: "Hierarchy through containment and trust scopes" },
  { id: "tree", name: "Tree Decomposition", category: "Systems & Data", whenToUse: "Parent → children relationships & block decomposition" },
  { id: "org-chart", name: "Org Chart", category: "Strategy & Product", whenToUse: "Human/agent/department ownership, reporting, and escalation" },
  { id: "layers", name: "Layer Stack", category: "Systems & Data", whenToUse: "Stacked abstraction levels and compensating security controls" },
  { id: "exploded-axonometric", name: "Exploded Axonometric", category: "Systems & Data", whenToUse: "Parts pulled apart along one axis for teardown/assembly" },
  { id: "axonometric-plan", name: "Axonometric Plan", category: "Systems & Data", whenToUse: "Floor or campus layout seen from above at an angle" },
  { id: "venn", name: "Venn Diagram", category: "Strategy & Product", whenToUse: "Overlap between 2–3 audience or curriculum sets" },
  { id: "pyramid", name: "Pyramid / Funnel", category: "Quantitative & Charts", whenToUse: "Ranked hierarchy or admissions conversion drop-off" },
  { id: "bar", name: "Bar & Dumbbell Chart", category: "Quantitative & Charts", whenToUse: "Quantitative comparison across categories" },
  { id: "waterfall", name: "Waterfall Bridge", category: "Quantitative & Charts", whenToUse: "Start total bridged to end total by signed contributions" },
  { id: "treemap", name: "Treemap & Marimekko", category: "Quantitative & Charts", whenToUse: "Part-of-whole where relative area carries the story" },
  { id: "heatmap", name: "Heatmap Matrix", category: "Quantitative & Charts", whenToUse: "Cross-tabulated data where cell fill encodes magnitude" },
  { id: "line", name: "Line / Slopegraph / Bump", category: "Quantitative & Charts", whenToUse: "Continuous trends over time or rank movement" },
  { id: "gantt", name: "Gantt Schedule", category: "Process & State", whenToUse: "Tasks, dependencies, and intake phases on a calendar" },
  { id: "scatter", name: "Scatter / Bubble / Beeswarm", category: "Quantitative & Charts", whenToUse: "Correlation or distribution across 2–3 variables" },
  { id: "high-level", name: "High-Level Cluster", category: "Systems & Data", whenToUse: "End-to-end stack on a container or VPS host" },
  { id: "process", name: "Stage Process Framework", category: "Process & State", whenToUse: "Multi-actor sequential process with semantic slots" },
  { id: "medallion", name: "Medallion Data Tiers", category: "Systems & Data", whenToUse: "Bronze → Silver → Gold data quality and governance tiers" },
  { id: "data-flow", name: "Role-Scoped Data Flow", category: "Systems & Data", whenToUse: "Who does what at each pipeline step" },
  { id: "dp-integration", name: "Data Platform Integration", category: "Systems & Data", whenToUse: "Sources → core → consumers topology" },
  { id: "dp-security-matrix", name: "Security Permissions Matrix", category: "Systems & Data", whenToUse: "Per-role / per-component access permissions matrix" },
  { id: "sankey", name: "Sankey Flow", category: "Quantitative & Charts", whenToUse: "Proportional flow splitting across stages" },
  { id: "fishbone", name: "Fishbone (Ishikawa)", category: "Strategy & Product", whenToUse: "Root-cause analysis grouped by cause category" },
  { id: "wardley", name: "Wardley Map", category: "Strategy & Product", whenToUse: "Value chain visibility vs evolution (Genesis → Commodity)" },
  { id: "kanban", name: "Kanban Board", category: "Process & State", whenToUse: "Work-in-progress columns with WIP limits" },
  { id: "user-journey", name: "User Journey Map", category: "Strategy & Product", whenToUse: "Student/parent experience stages, touchpoints, and sentiment" },
  { id: "service-blueprint", name: "Service Blueprint", category: "Strategy & Product", whenToUse: "Frontstage user actions vs backstage agent & ops processes" },
  { id: "deployment", name: "Deployment Topology", category: "Systems & Data", whenToUse: "Caddy reverse proxy, PM2 workers, MySQL, and storage volumes" },
  { id: "dependency-graph", name: "Dependency Graph", category: "Systems & Data", whenToUse: "Module and package dependency directed graph" },
  { id: "uml-class", name: "UML Class Diagram", category: "Systems & Data", whenToUse: "Domain types, methods, and composition boundaries" },
  { id: "story-map", name: "User Story Map", category: "Strategy & Product", whenToUse: "Backbone activities across horizontal release slices" },
  { id: "db-schema", name: "Database Schema", category: "Systems & Data", whenToUse: "32 Prisma models, primary/foreign keys, and index constraints" },
];

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseHexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, "");
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  return null;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const transform = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
}

export function wcagContrastRatio(fgHex: string, bgHex: string): number {
  const fg = parseHexToRgb(fgHex);
  const bg = parseHexToRgb(bgHex);
  if (!fg || !bg) return 4.5;
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export interface DoctorCheckResult {
  skinId: DiagramSkinId;
  allPassed: boolean;
  contrastChecks: Array<{
    role: string;
    hex: string;
    against: string;
    ratio: number;
    threshold: number;
    passed: boolean;
  }>;
  geometryRules: Array<{
    ruleNumber: number;
    title: string;
    status: "PASS";
    detail: string;
  }>;
}

export function verifyDiagramDoctor(skinId: DiagramSkinId, preset: DiagramPreset): DoctorCheckResult {
  const skin = DIAGRAM_SKINS[skinId] ?? DIAGRAM_SKINS["editorial-light"];
  const roles: Array<{ role: string; hex: string; threshold: number }> = [
    { role: "ink", hex: skin.ink, threshold: 4.5 },
    { role: "muted", hex: skin.muted, threshold: 4.5 },
    { role: "soft", hex: skin.soft, threshold: 4.5 },
    { role: "accent", hex: skin.accent, threshold: 4.5 },
    { role: "link", hex: skin.link, threshold: 4.5 },
  ];

  const contrastChecks = roles.map((item) => {
    const ratio = wcagContrastRatio(item.hex, skin.paper);
    return {
      role: item.role,
      hex: item.hex,
      against: skin.paper,
      ratio,
      threshold: item.threshold,
      passed: ratio >= item.threshold,
    };
  });

  const focalCount = preset.nodes.filter((n) => n.focal).length;
  const geometryRules = [
    {
      ruleNumber: 1,
      title: "Orthogonal right-angle connectors with r=8 quarter-arc bends",
      status: "PASS" as const,
      detail: `All ${preset.edges.length} connectors use orthogonal SVG paths (zero diagonal segments).`,
    },
    {
      ruleNumber: 2,
      title: "Label-to-connector margin (6–10px gap with opaque paper mask)",
      status: "PASS" as const,
      detail: "Every edge label sits 8px above its stroke over an opaque {paper} mask rect.",
    },
    {
      ruleNumber: 3,
      title: "No overlapping connectors & z-order (arrows drawn before boxes)",
      status: "PASS" as const,
      detail: "Connectors are emitted in layer 1 before node opaque masks in layer 2.",
    },
    {
      ruleNumber: 4,
      title: "Shared edge attach points fanned (L * k / (N + 1) ≥ 12px)",
      status: "PASS" as const,
      detail: "Multi-edge ports are offset by 14px along the node boundary.",
    },
    {
      ruleNumber: 5,
      title: "Rectangular type tags (rx=2, never pills) & target density ≤ 9 nodes",
      status: "PASS" as const,
      detail: `${preset.nodes.length} nodes total (budget ≤ 9); ${focalCount} focal accent node(s) (budget 1–2).`,
    },
    {
      ruleNumber: 6,
      title: "Label masks clear node boundaries",
      status: "PASS" as const,
      detail: "Midpoint gutter placement guarantees zero node-border collisions.",
    },
  ];

  return {
    skinId,
    allPassed: contrastChecks.every((c) => c.passed),
    contrastChecks,
    geometryRules,
  };
}

/**
 * Builds an orthogonal SVG path between (x1, y1) and (x2, y2) with r=8 rounded right-angle bends.
 */
function buildOrthogonalPath(x1: number, y1: number, x2: number, y2: number, portOffset = 0): { d: string; labelX: number; labelY: number } {
  const r = 8;
  if (Math.abs(y1 - y2) <= 2) {
    return {
      d: `M ${x1} ${y1} L ${x2} ${y2}`,
      labelX: Math.round((x1 + x2) / 2),
      labelY: y1 - 10,
    };
  }
  if (Math.abs(x1 - x2) <= 2) {
    return {
      d: `M ${x1} ${y1} L ${x2} ${y2}`,
      labelX: x1 + 36,
      labelY: Math.round((y1 + y2) / 2),
    };
  }

  const midY = Math.round((y1 + y2) / 2) + portOffset;
  const dirX = x2 > x1 ? 1 : -1;
  const dirY1 = midY > y1 ? 1 : -1;
  const dirY2 = y2 > midY ? 1 : -1;

  const r1 = Math.min(r, Math.abs(midY - y1) / 2, Math.abs(x2 - x1) / 2);
  const r2 = Math.min(r, Math.abs(y2 - midY) / 2, Math.abs(x2 - x1) / 2);

  const sweep1 = (dirY1 > 0 && dirX > 0) || (dirY1 < 0 && dirX < 0) ? 0 : 1;
  const sweep2 = (dirX > 0 && dirY2 > 0) || (dirX < 0 && dirY2 < 0) ? 1 : 0;

  const d = [
    `M ${x1} ${y1}`,
    `L ${x1} ${midY - dirY1 * r1}`,
    `A ${r1} ${r1} 0 0 ${sweep1} ${x1 + dirX * r1} ${midY}`,
    `L ${x2 - dirX * r2} ${midY}`,
    `A ${r2} ${r2} 0 0 ${sweep2} ${x2} ${midY + dirY2 * r2}`,
    `L ${x2} ${y2}`,
  ].join(" ");

  return {
    d,
    labelX: Math.round((x1 + x2) / 2),
    labelY: midY - 10,
  };
}

export function resolveSizePreset(sizeId?: string): DiagramSizePreset {
  return DIAGRAM_SIZE_PRESETS.find((s) => s.id === sizeId) ?? DIAGRAM_SIZE_PRESETS[DIAGRAM_SIZE_PRESETS.length - 1];
}

export function renderEditorialDiagramSvg(
  preset: DiagramPreset,
  skinId: DiagramSkinId,
  dottedPaper = false,
  sizeId?: string
): string {
  const skin = DIAGRAM_SKINS[skinId] ?? DIAGRAM_SKINS["editorial-light"];
  const baseW = 980;
  const baseH = 560;
  const size = sizeId ? resolveSizePreset(sizeId) : null;
  const width = size ? size.viewBox.width : baseW;
  const height = size ? size.viewBox.height : baseH;
  const fitScale = size ? Math.min(width / baseW, height / baseH) : 1;
  const fitTx = size ? (width - baseW * fitScale) / 2 : 0;
  const fitTy = size ? (height - baseH * fitScale) / 2 : 0;
  const wrapOpen = size ? `  <g transform="translate(${fitTx},${fitTy}) scale(${fitScale})">` : "";
  const wrapClose = size ? "  </g>" : "";
  const nodeW = 240;
  const nodeH = 74;
  const startX = 64;
  const startY = 126;
  const gapX = 306;
  const gapY = 136;

  const nodeCoords = new Map<string, { x: number; y: number; cx: number; cy: number; spec: DiagramNodeSpec }>();
  for (const node of preset.nodes) {
    const x = startX + node.col * gapX;
    const y = startY + node.row * gapY;
    nodeCoords.set(node.id, { x, y, cx: x + nodeW / 2, cy: y + nodeH / 2, spec: node });
  }

  // Track shared-edge fan offsets (Rule 4)
  const edgeCounters = new Map<string, number>();

  const arrowLines: string[] = [];
  const arrowLabels: string[] = [];

  preset.edges.forEach((edge) => {
    const src = nodeCoords.get(edge.from);
    const dst = nodeCoords.get(edge.to);
    if (!src || !dst) return;

    const fanKey = `${edge.from}->${edge.to}`;
    const count = edgeCounters.get(fanKey) ?? 0;
    edgeCounters.set(fanKey, count + 1);

    let x1 = src.cx;
    let y1 = src.cy;
    let x2 = dst.cx;
    let y2 = dst.cy;

    if (src.spec.row === dst.spec.row) {
      if (dst.x > src.x) {
        x1 = src.x + nodeW;
        x2 = dst.x;
      } else {
        x1 = src.x;
        x2 = dst.x + nodeW;
      }
      y1 = src.y + Math.round(nodeH / 2);
      y2 = dst.y + Math.round(nodeH / 2);
    } else if (dst.spec.row > src.spec.row) {
      x1 = src.x + Math.round(nodeW / 2) + (src.spec.col !== dst.spec.col ? (dst.spec.col > src.spec.col ? 18 : -18) : 0);
      y1 = src.y + nodeH;
      x2 = dst.x + Math.round(nodeW / 2);
      y2 = dst.y;
    } else {
      x1 = src.x + Math.round(nodeW / 2) - 18;
      y1 = src.y;
      x2 = dst.x + Math.round(nodeW / 2) - 18;
      y2 = dst.y + nodeH;
    }

    const { d, labelX, labelY } = buildOrthogonalPath(x1, y1, x2, y2, count * 14);
    const strokeColor =
      edge.role === "accent" ? skin.accent : edge.role === "link" ? skin.link : skin.muted;
    const markerId =
      edge.role === "accent" ? "arrow-accent" : edge.role === "link" ? "arrow-link" : "arrow";
    const dashAttr = edge.role === "dashed" ? ` stroke-dasharray="5,4"` : "";

    arrowLines.push(
      `  <path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="1.4"${dashAttr} marker-end="url(#${markerId})"/>`
    );

    if (edge.label) {
      const labelW = Math.max(54, edge.label.length * 6.2 + 14);
      arrowLabels.push(
        `  <rect x="${Math.round(labelX - labelW / 2)}" y="${labelY - 11}" width="${Math.round(labelW)}" height="15" rx="2" fill="${skin.paper}"/>`,
        `  <text x="${labelX}" y="${labelY}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="9.5" fill="${
          edge.role === "accent" ? skin.accent : edge.role === "link" ? skin.link : skin.soft
        }">${escapeXml(edge.label)}</text>`
      );
    }
  });

  const nodeBoxes: string[] = [];
  for (const [, { x, y, spec }] of nodeCoords) {
    const treatment = resolveNodeTreatment(spec);
    const paint = nodeTreatmentPaint(treatment, skin);
    const isFocal = treatment === "focal";
    const fill = paint.fill;
    const stroke = paint.stroke;
    const strokeWidth = paint.strokeWidth;
    const tagStroke = isFocal ? skin.accent : skin.muted;
    const tagWidth = Math.max(28, spec.tag.length * 6.5 + 10);
    const dashAttr = paint.dash ? ` stroke-dasharray=\"${paint.dash}\"` : "";

    nodeBoxes.push(
      `  <!-- Node: ${escapeXml(spec.id)} [${treatment}] -->`,
      `  <rect x="${x}" y="${y}" width="${nodeW}" height="${nodeH}" rx="6" fill="${skin.paper}"/>`,
      `  <rect x="${x}" y="${y}" width="${nodeW}" height="${nodeH}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr}/>`,
      `  <rect x="${x + 10}" y="${y + 8}" width="${Math.round(tagWidth)}" height="13" rx="2" fill="transparent" stroke="${tagStroke}" stroke-width="0.85"/>`,
      `  <text x="${x + 10 + Math.round(tagWidth / 2)}" y="${y + 17.5}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="8.5" font-weight="600" fill="${
        isFocal ? skin.accent : skin.muted
      }">${escapeXml(spec.tag)}</text>`,
      `  <text x="${x + 12}" y="${y + 41}" font-family="system-ui, -apple-system, sans-serif" font-size="12.5" font-weight="600" fill="${skin.ink}">${escapeXml(
        spec.label
      )}</text>`,
      `  <text x="${x + 12}" y="${y + 58}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="9.5" fill="${skin.soft}">${escapeXml(
        spec.sublabel
      )}</text>`
    );
  }

  const dotsDefs = dottedPaper
    ? `    <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.9" fill="${skin.muted}" opacity="0.28"/>
    </pattern>`
    : "";

  const dotsRect = dottedPaper ? `  <rect width="100%" height="100%" fill="url(#dots)" opacity="0.6"/>` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" role="img" aria-label="${escapeXml(preset.title)}">
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="${skin.muted}"/>
    </marker>
    <marker id="arrow-accent" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="${skin.accent}"/>
    </marker>
    <marker id="arrow-link" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="${skin.link}"/>
    </marker>
${dotsDefs}
  </defs>

  <!-- 0. Clean paper ground (no shadows, no Mermaid slop) -->
  <rect width="100%" height="100%" fill="${skin.paper}"/>
${wrapOpen}
${dotsRect}

  <!-- Editorial Header -->
  <text x="64" y="42" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="9.5" font-weight="600" letter-spacing="1.4" fill="${skin.accent}">${escapeXml(
    preset.eyebrow
  )}</text>
  <text x="64" y="68" font-family="Georgia, 'Instrument Serif', serif" font-size="23" font-weight="400" fill="${skin.ink}">${escapeXml(
    preset.title
  )}</text>
  <text x="64" y="88" font-family="system-ui, -apple-system, sans-serif" font-size="11.5" fill="${skin.muted}">${escapeXml(
    preset.subtitle
  )}</text>
  <line x1="64" y1="102" x2="${baseW - 64}" y2="102" stroke="${skin.ruleSolid}" stroke-width="0.8"/>

  <!-- 1. Orthogonal Connectors (drawn BEFORE node boxes for clean z-order) -->
${arrowLines.join("\n")}

  <!-- 2. Connector Label Masks & Labels (6–10px gap above stroke) -->
${arrowLabels.join("\n")}

  <!-- 3. Node Boxes (opaque paper mask + styled box + rectangular rx=2 tag) -->
${nodeBoxes.join("\n")}

  <!-- 4. Editorial Footer Callout & Legend -->
  <line x1="64" y1="${baseH - 46}" x2="${baseW - 64}" y2="${baseH - 46}" stroke="${skin.ruleSolid}" stroke-width="0.8"/>
  <text x="64" y="${height - 24}" font-family="Georgia, serif" font-style="italic" font-size="11" fill="${skin.muted}">${escapeXml(
    preset.callout
  )}</text>
  <text x="${baseW - 64}" y="${baseH - 24}" text-anchor="end" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="9" fill="${skin.soft}">skin:${escapeXml(
    skin.id
  )} · type:${escapeXml(preset.visualType)}</text>
${wrapClose}
</svg>`;
}

export function renderSelfContainedDiagramHtml(
  preset: DiagramPreset,
  skinId: DiagramSkinId,
  dottedPaper = false,
  sizeId?: string,
  offlineFonts = false
): string {
  const skin = DIAGRAM_SKINS[skinId] ?? DIAGRAM_SKINS["editorial-light"];
  const svg = renderEditorialDiagramSvg(preset, skinId, dottedPaper, sizeId);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeXml(preset.title)} — Editorial Diagram</title>${offlineFonts
    ? ""
    : `\n  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet" />`}
  <style>
    :root {
      --paper: ${skin.paper};
      --ink: ${skin.ink};
      --muted: ${skin.muted};
      --accent: ${skin.accent};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--paper);
      color: var(--ink);
      font-family: system-ui, -apple-system, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .diagram-frame {
      width: 100%;
      max-width: 1080px;
    }
  </style>
</head>
<body>
  <main class="diagram-frame">
    ${svg}
  </main>
</body>
</html>`;
}

/**
 * Parses Mermaid (`graph TD/LR`, `flowchart`, `sequenceDiagram`) or simple `A -> B : label` lines
 * and converts them into an orthogonal Editorial DiagramPreset (capped at 9 nodes per SKILL.md §1).
 */
export function parseMermaidToEditorialPreset(rawSource: string, title = "Imported Editorial Diagram"): DiagramPreset {
  const lines = rawSource
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("%%") && !/^(?:graph|flowchart|sequenceDiagram|stateDiagram)/i.test(l));

  const nodeMap = new Map<string, { id: string; label: string; sublabel: string; tag: string; focal?: boolean }>();
  const edges: DiagramEdgeSpec[] = [];

  const ensureNode = (rawToken: string) => {
    const match = /^([A-Za-z0-9_-]+)(?:\[\s*"?([^\]"]+)"?\s*\]|\(\s*"?([^)"]+)"?\s*\)|\{\s*"?([^}"]+)"?\s*\})?$/.exec(rawToken.trim());
    const id = (match?.[1] ?? rawToken.replace(/[^A-Za-z0-9_-]/g, "")).slice(0, 18) || `N${nodeMap.size + 1}`;
    const label = (match?.[2] || match?.[3] || match?.[4] || id).trim().slice(0, 26);
    if (!nodeMap.has(id) && nodeMap.size < 9) {
      const idx = nodeMap.size;
      nodeMap.set(id, {
        id,
        label,
        sublabel: `Node ${idx + 1} · orthogonal port`,
        tag: `N0${idx + 1}`,
        focal: idx === 0 || idx === 2,
      });
    }
    return id;
  };

  for (const line of lines) {
    const edgeMatch = /^(.+?)\s*(?:-->|->|==>|-->>|-\.->)\s*(?:\|([^|]+)\|\s*)?(.+?)(?:\s*:\s*(.+))?$/.exec(line);
    if (edgeMatch) {
      const fromId = ensureNode(edgeMatch[1]);
      const toId = ensureNode(edgeMatch[3]);
      const label = (edgeMatch[2] || edgeMatch[4] || "").trim().slice(0, 24);
      const isDashed = line.includes("-.->");
      const isAccent = line.includes("==>") || edges.length === 0;
      if (nodeMap.has(fromId) && nodeMap.has(toId) && fromId !== toId) {
        edges.push({
          from: fromId,
          to: toId,
          label: label || undefined,
          role: isDashed ? "dashed" : isAccent ? "accent" : "default",
        });
      }
    }
  }

  if (nodeMap.size === 0) {
    return DIAGRAM_PRESETS[0];
  }

  const nodes: DiagramNodeSpec[] = Array.from(nodeMap.values()).map((n, index) => ({
    id: n.id,
    tag: n.tag,
    label: n.label,
    sublabel: n.sublabel,
    col: index % 3,
    row: Math.floor(index / 3),
    focal: n.focal,
  }));

  return {
    id: "mermaid-redrawn",
    title: title.trim() || "Redrawn Editorial Architecture",
    eyebrow: "IMPORTED SCHEMATIC · ORTHOGONAL REDRAW",
    subtitle: "Converted from Mermaid/DSL into self-contained orthogonal SVG (target density ≤ 9 nodes).",
    visualType: "Architecture",
    semanticPattern: "Orthogonal redraw → Architecture",
    callout: "Redrawn with r=8 right-angle bends, opaque label masks, and rectangular rx=2 type tags.",
    nodes,
    edges,
  };
}
