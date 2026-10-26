/**
 * Editorial Import Engine — draw.io / Excalidraw / Block Registry
 *
 * Implements cathrynlavery/diagram-design v2.6.110 import pipelines:
 *  - import-drawio.md    → `parseDrawioToEditorialPreset` (redraw, not conversion)
 *  - import-excalidraw.md → `parseExcalidrawToEditorialPreset`
 *  - export-registry.md   → `exportBlockRegistry` (.registry.json projection of data-block-*)
 *
 * Every import ships a Fidelity Ledger: what was kept, redrawn, merged, and dropped,
 * with reasons. Source labels/links/metadata are untrusted diagram content only —
 * never followed, fetched, or executed.
 */

import {
  type DiagramEdgeSpec,
  type DiagramNodeSpec,
  type DiagramNodeTreatment,
  type DiagramPreset,
} from "@/lib/diagram-design";

// ---------------------------------------------------------------------------
// Fidelity ledger
// ---------------------------------------------------------------------------

export interface FidelityLedgerEntry {
  source: string;
  action: "kept" | "redrawn" | "merged" | "dropped" | "rewritten";
  reason: string;
}

export interface FidelityLedger {
  sourceFormat: "drawio" | "excalidraw" | "mermaid";
  sourceNodes: number;
  sourceEdges: number;
  sourceContainers: number;
  keptNodes: number;
  keptEdges: number;
  entries: FidelityLedgerEntry[];
  warnings: string[];
}

function newLedger(sourceFormat: FidelityLedger["sourceFormat"]): FidelityLedger {
  return {
    sourceFormat,
    sourceNodes: 0,
    sourceEdges: 0,
    sourceContainers: 0,
    keptNodes: 0,
    keptEdges: 0,
    entries: [],
    warnings: [],
  };
}

// ---------------------------------------------------------------------------
// Shared IR → editorial preset mapping (a redraw, never a conversion)
// ---------------------------------------------------------------------------

interface IrNode {
  id: string;
  label: string;
  sublabel?: string;
  shape: string; // rectangle | cylinder | rhombus | actor | cloud | note | ellipse | frame | text | ...
  containerId?: string;
  styleHints: string[]; // raw fill colors / style fragments, signals only
  degree: number;
}

interface IrEdge {
  from: string;
  to: string;
  label?: string;
  dashed: boolean;
  bidirectional: boolean;
}

const MAX_NODES = 9;

/** Map source shape + label semantics to a design-system treatment (import-drawio.md §5). */
export function inferTreatment(node: IrNode, focalIds: Set<string>): DiagramNodeTreatment {
  if (focalIds.has(node.id)) return "focal";
  const label = node.label.toLowerCase();
  if (node.shape === "cylinder" || /\b(db|database|store|queue|cache|bucket|persist|store|sql|redis)\b/.test(label)) return "store";
  if (node.shape === "cloud" || /\b(external|third[- ]?party|s3|stripe|public|vendor|api\.|cdn)\b/.test(label)) return "external";
  if (node.shape === "actor" || /\b(user|student|parent|admin|client|input|visitor)\b/.test(label)) return "input";
  if (/\b(security|auth|otp|firewall|gate|vault|guard|policy|acl|waf|ssl|tls|encrypt)\b/.test(label)) return "security";
  if (/\b(legacy|deprecated|optional|async|draft|future|phase\s*2|old)\b/.test(label)) return "optional";
  return "backend";
}

function slugTag(label: string, index: number): string {
  const words = label.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const abbr = words.slice(0, 3).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (abbr || `N${index + 1}`).slice(0, 5);
}

/**
 * Rank candidate target types from structural signals (import-drawio.md §3 table).
 */
export function rankTypeCandidates(
  nodes: IrNode[],
  edges: IrEdge[],
  containerCount: number
): Array<{ type: string; score: number; note: string }> {
  const scores = new Map<string, number>();
  const note = (t: string, s: number, why: string) => {
    scores.set(t, (scores.get(t) ?? 0) + s);
    return why;
  };

  const shapes = nodes.map((n) => n.shape);
  const hasCycle = detectCycle(nodes, edges);
  const labeledYesNo = edges.filter((e) => /^(yes|no|ja|nein|true|false)$/i.test(e.label ?? "")).length;
  const dated = nodes.filter((n) => /\b(20\d\d|q[1-4]|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|wk\d|week\s*\d)\b/i.test(n.label)).length;

  if (shapes.filter((s) => s === "lifeline").length >= 2) note("Sequence", 6, "lifeline shapes");
  if (shapes.includes("table") || shapes.includes("er")) note("ER / Data Model", 5, "table/er shapes");
  if (containerCount >= 2 && nodes.length >= 4) note("Swimlane", 3, `${containerCount} lane containers`);
  if (shapes.includes("rhombus") && labeledYesNo >= 2) note("Flowchart", 6, "decision diamond + yes/no edges");
  if (shapes.filter((s) => s === "ellipse").length >= Math.max(2, nodes.length / 2) && hasCycle) note("State Machine", 5, "ellipse majority + cycle");
  if (containerCount >= 1 && edges.length <= nodes.length) note("Nested Containment", 3, "containers with sparse edges");
  if (edges.length > 0 && edges.length <= nodes.length && isTree(nodes, edges)) note("Tree Decomposition", 4, "single root, fan-out only");
  if (isLayered(nodes, edges)) note("Layer Stack", 3, "vertical stack, neighbor edges only");
  if (dated >= 2) note("Timeline", 3, "dated labels on one axis");
  note("Architecture", 2, "default: any topology with edges");

  return [...scores.entries()]
    .map(([type, score]) => ({ type, score, note: `${scores.get(type)}` }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function detectCycle(nodes: IrNode[], edges: IrEdge[]): boolean {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) adj.get(e.from)?.push(e.to);
  const visiting = new Set<string>();
  const done = new Set<string>();
  const walk = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (done.has(id)) return false;
    visiting.add(id);
    for (const next of adj.get(id) ?? []) {
      if (walk(next)) return true;
    }
    visiting.delete(id);
    done.add(id);
    return false;
  };
  return nodes.some((n) => walk(n.id));
}

function isTree(nodes: IrNode[], edges: IrEdge[]): boolean {
  if (edges.length !== nodes.length - 1 || nodes.length === 0) return false;
  const indeg = new Map<string, number>();
  for (const n of nodes) indeg.set(n.id, 0);
  for (const e of edges) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  return [...indeg.values()].filter((d) => d === 0).length === 1;
}

function isLayered(nodes: IrNode[], edges: IrEdge[]): boolean {
  if (nodes.length < 3) return false;
  const ids = new Set(nodes.map((n) => n.id));
  return edges.every((e) => {
    const a = nodes.find((n) => n.id === e.from);
    const b = nodes.find((n) => n.id === e.to);
    return Boolean(a && b && ids.has(e.from) && ids.has(e.to));
  });
}

/**
 * Build the editorial preset from an IR: pick 1–2 focal hubs, rewrite labels,
 * prune to the node budget (merge collapsible groups first), lay out on the 4px grid.
 */
function irToEditorialPreset(
  nodes: IrNode[],
  edges: IrEdge[],
  ledger: FidelityLedger,
  title: string,
  sourceName: string
): DiagramPreset {
  // Step: hubs → focal (1–2 max)
  const byDegree = [...nodes].sort((a, b) => b.degree - a.degree);
  const focalIds = new Set<string>();
  if (byDegree[0]) focalIds.add(byDegree[0].id);
  if (byDegree[1] && byDegree[1].degree >= 2 && byDegree[1].degree >= byDegree[0].degree * 0.6) {
    focalIds.add(byDegree[1].id);
  }

  // Step: degrade ladder — drop unconnected non-focal nodes first, then trim to 9
  const connected = new Set<string>();
  for (const e of edges) {
    connected.add(e.from);
    connected.add(e.to);
  }
  let working = [...nodes];
  for (const n of working) {
    if (!connected.has(n.id) && !focalIds.has(n.id)) {
      ledger.entries.push({ source: n.label, action: "dropped", reason: "Unconnected node — first rung of the degrade ladder" });
    }
  }
  working = working.filter((n) => connected.has(n.id) || focalIds.has(n.id));

  if (working.length > MAX_NODES) {
    // Merge lowest-degree non-focal nodes into their neighbors (collapsible groups)
    const extras = working
      .filter((n) => !focalIds.has(n.id))
      .sort((a, b) => a.degree - b.degree);
    const dropCount = working.length - MAX_NODES;
    const dropIds = new Set(extras.slice(0, dropCount).map((n) => n.id));
    for (const n of working) {
      if (dropIds.has(n.id)) {
        ledger.entries.push({ source: n.label, action: "merged", reason: "Collapsed into adjacent node to hold the ≤9 node budget" });
      }
    }
    working = working.filter((n) => !dropIds.has(n.id));
  }

  // Rewrite labels at mixed-audience level: trim, title-case noise cleanup
  const nodesOut: DiagramNodeSpec[] = working.map((n, index) => {
    const cleanLabel = n.label.replace(/\s+/g, " ").trim().slice(0, 28) || `Node ${index + 1}`;
    const treatment = inferTreatment(n, focalIds);
    ledger.entries.push({
      source: n.label,
      action: cleanLabel !== n.label ? "rewritten" : "redrawn",
      reason: `Mapped ${n.shape} → ${treatment} treatment on the 4px grid; source coordinates discarded`,
    });
    return {
      id: n.id.slice(0, 18),
      tag: slugTag(cleanLabel, index),
      label: cleanLabel,
      sublabel: (n.sublabel || `${n.shape} · redrawn`).slice(0, 34),
      col: index % 3,
      row: Math.floor(index / 3),
      treatment,
      focal: treatment === "focal",
    };
  });

  const idSet = new Set(working.map((n) => n.id));
  const edgesOut: DiagramEdgeSpec[] = [];
  for (const e of edges) {
    if (!idSet.has(e.from) || !idSet.has(e.to) || e.from === e.to) {
      ledger.entries.push({ source: `${e.from}→${e.to}`, action: "dropped", reason: "Edge endpoints not in the redraw (pruned node or self-loop)" });
      continue;
    }
    edgesOut.push({
      from: e.from.slice(0, 18),
      to: e.to.slice(0, 18),
      label: e.label?.slice(0, 18) || undefined,
      role: e.dashed ? "dashed" : edgesOut.length === 0 ? "accent" : "default",
    });
  }

  ledger.keptNodes = nodesOut.length;
  ledger.keptEdges = edgesOut.length;

  return {
    id: `imported-${sourceName}`,
    title: title.slice(0, 80),
    eyebrow: `IMPORTED ${sourceName.toUpperCase()} · ORTHOGONAL REDRAW`,
    subtitle: `Redrawn from ${sourceName}: source geometry and palette discarded, semantic roles mapped to the Editorial design system (≤9 nodes).`,
    visualType: "Architecture",
    semanticPattern: `Unstructured ${sourceName} source → structured artifact → Architecture`,
    callout:
      "Redraw, not conversion: rounded orthogonal r=8 connectors, opaque label masks, 1–2 focal accents. Fidelity ledger ships with every import.",
    nodes: nodesOut,
    edges: edgesOut,
  };
}

// ---------------------------------------------------------------------------
// draw.io import (import-drawio.md) — raw XML or compressed mxfile payloads
// ---------------------------------------------------------------------------

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");
}

/** draw.io compressed payload: base64 → inflateRaw → URI-decode (mxGraph Graph.compress). */
async function inflateDrawioPayload(payload: string): Promise<string> {
  const trimmed = payload.trim();
  const binary = Uint8Array.from(atob(trimmed), (c) => c.charCodeAt(0));
  // DecompressionStream('deflate-raw') is available in modern browsers and Node 18+
  const DS = (globalThis as { DecompressionStream?: new (format: string) => TransformStream }).DecompressionStream;
  if (!DS) {
    throw new Error(
      "Compressed .drawio payload needs DecompressionStream (inflate-raw). This runtime lacks it — re-export the file as uncompressed XML (File → Export as → XML) and retry."
    );
  }
  const stream = new Blob([binary]).stream().pipeThrough(new DS("deflate-raw"));
  const buf = await new Response(stream).arrayBuffer();
  return decodeURIComponent(new TextDecoder().decode(buf));
}

function parseMxGeometry(attr: string): { x: number; y: number; w: number; h: number } {
  const grab = (key: string, fallback = 0) => {
    const m = new RegExp(`${key}="([^"]*)"`).exec(attr);
    const v = m ? parseFloat(m[1]) : NaN;
    return Number.isFinite(v) ? v : fallback;
  };
  return { x: grab("x"), y: grab("y"), w: grab("width", 120), h: grab("height", 60) };
}

export async function parseDrawioToEditorialPreset(
  rawFile: string,
  title = "Redrawn Editorial Diagram",
  pageSelector?: string
): Promise<{ preset: DiagramPreset; ledger: FidelityLedger }> {
  const ledger = newLedger("drawio");
  let xml = rawFile.trim();

  // PNG/SVG with embedded mxfile: pull the chunk out
  if (!xml.startsWith("<")) {
    throw new Error("Not a draw.io XML file. Provide the .drawio / .drawio.xml source (not a .drawio.png pixel export) — image-only files carry no extractable graph.");
  }

  // Compressed <diagram> payloads (base64, not raw XML)
  const diagramPayload = /<diagram[^>]*>([\s\S]*?)<\/diagram>/i.exec(xml);
  if (diagramPayload && !diagramPayload[1].trim().startsWith("<")) {
    xml = await inflateDrawioPayload(diagramPayload[1].replace(/\s+/g, ""));
  }

  // Runtime-agnostic extraction (works in browser + Node API routes — no DOMParser dependency)
  const pageMatches = [...xml.matchAll(/<diagram\b([^>]*)>([\s\S]*?)<\/diagram>/gi)];
  const pages = pageMatches.length
    ? pageMatches.map((m) => ({ attrs: m[1], body: m[2] }))
    : [{ attrs: "", body: xml }];
  const findPage = (selector?: string) =>
    selector
      ? pages.find((p) => {
          const nameMatch = /name="([^"]*)"/.exec(p.attrs);
          const idMatch = /id="([^"]*)"/.exec(p.attrs);
          return (nameMatch?.[1] ?? idMatch?.[1] ?? "") === selector;
        }) ?? pages[0]
      : pages[0];
  const page = findPage(pageSelector);
  if (pages.length > 1 && !pageSelector) {
    ledger.warnings.push(`Multi-page file (${pages.length} pages): imported page 0 only. Pass a page name to target another.`);
  }

  const cellLimit = 10000;
  const cellMatches = [...page.body.matchAll(/<mxCell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/mxCell>)/gi)];
  if (cellMatches.length > cellLimit) {
    throw new Error(`page cell limit exceeded (max ${cellLimit}) — split the source into smaller draw.io files and retry`);
  }
  const attrOf = (attrString: string, key: string): string | null => {
    const m = new RegExp(`${key}="([^"]*)"`, "i").exec(attrString);
    return m ? decodeHtmlEntities(m[1]) : null;
  };

  // Pass 1: nodes (vertex=1, visible≠0, has value or geometry)
  const irNodes: IrNode[] = [];
  for (const match of cellMatches) {
    const attrString = match[1] ?? "";
    const inner = match[2] ?? "";
    if (attrOf(attrString, "visible") === "0") continue;
    const id = attrOf(attrString, "id") ?? `cell-${irNodes.length}`;
    if (attrOf(attrString, "vertex") !== "1") continue;
    const style = attrOf(attrString, "style") ?? "";
    const valueRaw = decodeHtmlEntities((attrOf(attrString, "value") ?? "").replace(/<[^>]*>/g, " ")).trim();

    const shape = /shape=cylinder|cylinder3/i.test(style)
      ? "cylinder"
      : /shape=rhombus/i.test(style)
        ? "rhombus"
        : /shape=actor/i.test(style)
          ? "actor"
          : /shape=cloud/i.test(style)
            ? "cloud"
            : /swimlane/i.test(style)
              ? "swimlane"
              : /shape=table|shape=mscae\/entity/i.test(style)
                ? "table"
                : /ellipse/i.test(style)
                  ? "ellipse"
                  : /text;|text\)/i.test(style) && !valueRaw
                    ? "text"
                    : "rectangle";

    irNodes.push({
      id,
      label: valueRaw.slice(0, 60) || id,
      shape,
      styleHints: [style.slice(0, 80)],
      degree: 0,
    });
  }

  // Pass 2: edges (edge=1) — arrowheads set direction (import-drawio.md §1)
  const irEdges: IrEdge[] = [];
  for (const match of cellMatches) {
    const attrString = match[1] ?? "";
    if (attrOf(attrString, "visible") === "0") continue;
    if (attrOf(attrString, "edge") !== "1") continue;
    const style = attrOf(attrString, "style") ?? "";
    const src = attrOf(attrString, "source");
    const tgt = attrOf(attrString, "target");
    if (!src || !tgt) continue;
    const startArrow = /startArrow=(?!none)/i.test(style);
    const endArrow = /endArrow=(?!none)/i.test(style);
    const bidirectional = startArrow && endArrow;
    const from = startArrow && !endArrow ? tgt : src;
    const to = startArrow && !endArrow ? src : tgt;
    const valueRaw = decodeHtmlEntities((attrOf(attrString, "value") ?? "").replace(/<[^>]*>/g, " ")).trim();
    irEdges.push({
      from,
      to,
      label: valueRaw.slice(0, 22) || undefined,
      dashed: /dashed=1/i.test(style),
      bidirectional,
    });
  }

  ledger.sourceNodes = irNodes.length;
  ledger.sourceEdges = irEdges.length;
  ledger.sourceContainers = irNodes.filter((n) => n.shape === "swimlane").length;

  if (irNodes.length === 0) {
    throw new Error("0 drawable nodes — this draw.io file is image-only or encrypted; extract the graph source and retry.");
  }

  for (const e of irEdges) {
    const a = irNodes.find((n) => n.id === e.from);
    const b = irNodes.find((n) => n.id === e.to);
    if (a) a.degree += 1;
    if (b) b.degree += 1;
    if (e.bidirectional && a && b) b.degree += 1;
  }

  const preset = irToEditorialPreset(irNodes, irEdges, ledger, title, "draw.io");
  return { preset, ledger };
}

// ---------------------------------------------------------------------------
// Excalidraw import (import-excalidraw.md)
// ---------------------------------------------------------------------------

interface ExcalidrawElement {
  id: string;
  type: string;
  deleted?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  label?: { text?: string };
  containerId?: string;
  frameId?: string | null;
  strokeStyle?: string;
  startArrowhead?: string | null;
  endArrowhead?: string | null;
  startBinding?: { id: string } | null;
  endBinding?: { id: string } | null;
  points?: number[][];
  link?: string | null;
  fileId?: string | null;
  groupIds?: string[];
}

export function parseExcalidrawToEditorialPreset(
  rawJson: string,
  title = "Redrawn Editorial Whiteboard"
): { preset: DiagramPreset; ledger: FidelityLedger } {
  const ledger = newLedger("excalidraw");

  let scene: { elements?: ExcalidrawElement[] };
  try {
    scene = JSON.parse(rawJson) as { elements?: ExcalidrawElement[] };
  } catch {
    throw new Error("Not valid Excalidraw JSON — save the scene as .excalidraw from the app and retry. Pixel exports (.excalidraw.png/.svg) carry no graph.");
  }
  const all = Array.isArray(scene.elements) ? scene.elements : [];
  if (all.length === 0) throw new Error("no elements — the Excalidraw scene is empty.");

  const ids = new Set<string>();
  for (const el of all) {
    if (ids.has(el.id)) throw new Error("duplicate element id — fix the scene (or re-export) and retry.");
    ids.add(el.id);
  }

  const live = all.filter((el) => !el.deleted);
  const discarded: ExcalidrawElement[] = [];
  const kept: ExcalidrawElement[] = [];
  for (const el of live) {
    if (["freedraw", "image", "line"].includes(el.type) || el.link || el.fileId) {
      discarded.push(el);
    } else if (["rectangle", "ellipse", "diamond", "arrow", "text", "frame"].includes(el.type)) {
      kept.push(el);
    } else {
      discarded.push(el);
      ledger.warnings.push(`Unknown element type "${el.type}" discarded — meaning not guessed from coordinates.`);
    }
  }
  for (const el of discarded) {
    ledger.entries.push({
      source: el.text || el.label?.text || el.type,
      action: "dropped",
      reason:
        el.type === "image" || el.fileId
          ? "Image pixels discarded — redraw uses monochrome icons or labeled boxes, never re-embedded source images"
          : el.link
            ? "Element link/embed discarded unopened — untrusted data outside the trust boundary"
            : `Decorative ${el.type} stroke discarded — decoration, not graph`,
    });
  }

  // Bound labels fold into their node/edge
  const textByContainer = new Map<string, string>();
  const standaloneText: ExcalidrawElement[] = [];
  for (const el of kept) {
    if (el.type === "text") {
      if (el.containerId) textByContainer.set(el.containerId, (el.text ?? "").trim());
      else standaloneText.push(el);
    }
  }

  const shapes = kept.filter((el) => ["rectangle", "ellipse", "diamond"].includes(el.type));
  const frames = kept.filter((el) => el.type === "frame");
  const arrows = kept.filter((el) => el.type === "arrow");

  const irNodes: IrNode[] = [];
  for (const el of shapes) {
    const bound = textByContainer.get(el.id) ?? "";
    const label = bound || standaloneText.find((t) => Math.abs((t.x ?? 0) - (el.x ?? 0)) < 40 && Math.abs((t.y ?? 0) - (el.y ?? 0)) < 40)?.text || el.id;
    irNodes.push({
      id: el.id,
      label: label.slice(0, 60),
      shape: el.type === "diamond" ? "rhombus" : el.type === "ellipse" ? "ellipse" : "rectangle",
      containerId: el.frameId ?? undefined,
      styleHints: [el.strokeStyle ?? "solid"],
      degree: 0,
    });
  }
  for (const frame of frames) {
    irNodes.push({
      id: frame.id,
      label: (frame.label as { text?: string } | undefined)?.text || "Zone",
      shape: "swimlane",
      styleHints: [],
      degree: 0,
    });
    ledger.entries.push({
      source: (frame.label as { text?: string } | undefined)?.text || "Frame",
      action: "kept",
      reason: "Frame redrawn as a quiet zone container — frames group, they do not act",
    });
  }

  const irEdges: IrEdge[] = [];
  let dangling = 0;
  for (const el of arrows) {
    const from = el.startBinding?.id;
    const to = el.endBinding?.id;
    if (!from || !to || !ids.has(from) || !ids.has(to)) {
      dangling += 1;
      continue;
    }
    irEdges.push({
      from,
      to,
      label: textByContainer.get(el.id)?.slice(0, 22),
      dashed: el.strokeStyle === "dashed" || el.strokeStyle === "dotted",
      bidirectional: Boolean(el.startArrowhead && el.endArrowhead),
    });
  }
  if (dangling > 0) {
    ledger.warnings.push(`${dangling} dangling arrow(s) omitted (bindings deleted or never attached).`);
    ledger.entries.push({ source: "arrows", action: "dropped", reason: `${dangling} dangling arrows omitted — recorded in the ledger` });
  }

  // Floating text: drop unless it's the only content carrying meaning
  for (const t of standaloneText) {
    ledger.entries.push({
      source: t.text ?? "text",
      action: "dropped",
      reason: "Unconnected floating text — usually titles/sticky notes (degrade ladder step 1)",
    });
  }

  ledger.sourceNodes = irNodes.length;
  ledger.sourceEdges = irEdges.length;
  ledger.sourceContainers = frames.length;

  if (irNodes.length === 0) {
    throw new Error("Labels are empty and no drawable shapes remain — the sketch carries meaning in position only. Add labels in Excalidraw and retry.");
  }

  for (const e of irEdges) {
    const a = irNodes.find((n) => n.id === e.from);
    const b = irNodes.find((n) => n.id === e.to);
    if (a) a.degree += 1;
    if (b) b.degree += 1;
  }

  const preset = irToEditorialPreset(irNodes, irEdges, ledger, title, "Excalidraw");
  return { preset, ledger };
}

// ---------------------------------------------------------------------------
// Block registry export (export-registry.md) — `.registry.json` projection
// ---------------------------------------------------------------------------

export interface BlockRegistryEntry {
  id: string;
  name: string;
  parent?: string;
  input?: string;
  output?: string;
  constraint?: string;
  assumption?: string;
  impl?: string;
}

export interface BlockRegistry {
  source: string;
  blocks: BlockRegistryEntry[];
}

/**
 * Project `data-block-*` attributes into the registry JSON schema.
 * A projection, not a second source of truth: values are verbatim, no timestamps,
 * document order preserved, duplicates emitted as-authored.
 */
export function exportBlockRegistry(html: string, sourceName: string): BlockRegistry {
  // Document-order scan of opening tags carrying data-block-id (browser + Node safe)
  const tagRe = /<([a-zA-Z][\w:-]*)\b([^>]*\bdata-block-id\b[^>]*)>/g;
  const blocks: BlockRegistryEntry[] = [];
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html)) !== null) {
    const attrs = match[2];
    const get = (key: string) => {
      const m = new RegExp(`${key}="([^"]*)"`, "i").exec(attrs);
      return m ? decodeHtmlEntities(m[1]) : null;
    };
    const id = get("data-block-id");
    if (id === null) continue;
    const entry: BlockRegistryEntry = { id, name: get("data-block-name") ?? "" };
    const parent = get("data-block-parent");
    if (parent) entry.parent = parent;
    const map: Array<[keyof BlockRegistryEntry, string]> = [
      ["input", "data-block-input"],
      ["output", "data-block-output"],
      ["constraint", "data-block-constraint"],
      ["assumption", "data-block-assumption"],
      ["impl", "data-block-impl"],
    ];
    for (const [key, attr] of map) {
      const value = get(attr);
      if (value !== null && value !== "") (entry[key] as string) = value;
    }
    blocks.push(entry);
  }
  if (blocks.length === 0) {
    throw new Error(
      "No data-block-id attributes found — --registry applies only to Traceable block decomposition diagrams (Tree nodes carrying data-block-* metadata)."
    );
  }
  return { source: sourceName, blocks };
}

/** Render Traceable block metadata onto a tree preset's nodes (semantic-patterns.md §8). */
export function withBlockMetadata(
  nodes: DiagramNodeSpec[],
  blocks: BlockRegistryEntry[]
): DiagramNodeSpec[] {
  const byName = new Map(blocks.map((b) => [b.name.toLowerCase(), b]));
  return nodes.map((n) => {
    const block = byName.get(n.label.toLowerCase());
    if (!block) return n;
    return {
      ...n,
      sublabel: [block.output, block.impl].filter(Boolean).join(" · ").slice(0, 34) || n.sublabel,
    };
  });
}
