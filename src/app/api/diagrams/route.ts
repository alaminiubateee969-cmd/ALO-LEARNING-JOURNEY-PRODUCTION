import { NextResponse } from "next/server";
import { svgToPngBuffer, ImageProcessingUnavailableError } from "@/lib/image-processing";
import {
  DIAGRAM_PRESETS,
  DIAGRAM_SKINS,
  DIAGRAM_SIZE_PRESETS,
  DIAGRAM_TYPES_45,
  parseMermaidToEditorialPreset,
  renderEditorialDiagramSvg,
  renderSelfContainedDiagramHtml,
  resolveSizePreset,
  verifyDiagramDoctor,
  type DiagramSkinId,
} from "@/lib/diagram-design";
import {
  exportBlockRegistry,
  parseDrawioToEditorialPreset,
  parseExcalidrawToEditorialPreset,
  type FidelityLedger,
} from "@/lib/diagram-import";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const presetId = searchParams.get("preset") ?? DIAGRAM_PRESETS[0].id;
  const skinId = (searchParams.get("skin") ?? "editorial-light") as DiagramSkinId;
  const dotted = searchParams.get("dotted") === "1";
  const sizeId = searchParams.get("size") ?? undefined;

  const preset = DIAGRAM_PRESETS.find((p) => p.id === presetId) ?? DIAGRAM_PRESETS[0];
  const validSkin: DiagramSkinId = skinId in DIAGRAM_SKINS ? skinId : "editorial-light";
  const svg = renderEditorialDiagramSvg(preset, validSkin, dotted, sizeId);
  const doctor = verifyDiagramDoctor(validSkin, preset);

  return NextResponse.json({
    preset,
    skin: DIAGRAM_SKINS[validSkin],
    svg,
    doctor,
    presets: DIAGRAM_PRESETS,
    skins: Object.values(DIAGRAM_SKINS),
    sizePresets: DIAGRAM_SIZE_PRESETS,
    activeSize: resolveSizePreset(sizeId),
    diagramTypesCount: DIAGRAM_TYPES_45.length,
    diagramTypes: DIAGRAM_TYPES_45,
  });
}

interface DiagramPostBody {
  action?: string;
  presetId?: string;
  skinId?: DiagramSkinId;
  dottedPaper?: boolean;
  mermaidSource?: string;
  drawioSource?: string;
  excalidrawSource?: string;
  registrySource?: string;
  registrySourceName?: string;
  title?: string;
  sizeId?: string;
  offlineFonts?: boolean;
  format?: "json" | "png" | "registry";
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as DiagramPostBody;

  const skinId: DiagramSkinId = body.skinId && body.skinId in DIAGRAM_SKINS ? body.skinId : "editorial-light";
  const dotted = Boolean(body.dottedPaper);
  const sizeId = body.sizeId;

  // Block registry export is independent of rendering (export-registry.md)
  if (body.action === "export_registry" && typeof body.registrySource === "string") {
    try {
      const registry = exportBlockRegistry(body.registrySource, body.registrySourceName ?? "diagram.html");
      return NextResponse.json(registry);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "registry export failed", code: "registry_error" },
        { status: 422 }
      );
    }
  }

  let preset = DIAGRAM_PRESETS.find((p) => p.id === body.presetId) ?? DIAGRAM_PRESETS[0];
  let ledger: FidelityLedger | undefined;

  try {
    if (body.action === "import_mermaid" && typeof body.mermaidSource === "string" && body.mermaidSource.trim()) {
      preset = parseMermaidToEditorialPreset(body.mermaidSource, body.title || "Redrawn Editorial Diagram");
    } else if (body.action === "import_drawio" && typeof body.drawioSource === "string" && body.drawioSource.trim()) {
      const result = await parseDrawioToEditorialPreset(body.drawioSource, body.title || "Redrawn Editorial Diagram");
      preset = result.preset;
      ledger = result.ledger;
    } else if (
      body.action === "import_excalidraw" &&
      typeof body.excalidrawSource === "string" &&
      body.excalidrawSource.trim()
    ) {
      const result = parseExcalidrawToEditorialPreset(body.excalidrawSource, body.title || "Redrawn Editorial Whiteboard");
      preset = result.preset;
      ledger = result.ledger;
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "import failed", code: "import_error" },
      { status: 422 }
    );
  }

  const svg = renderEditorialDiagramSvg(preset, skinId, dotted, sizeId);
  const html = renderSelfContainedDiagramHtml(preset, skinId, dotted, sizeId, Boolean(body.offlineFonts));
  const doctor = verifyDiagramDoctor(skinId, preset);

  if (body.format === "png") {
    let pngBuffer: Buffer;
    try {
      pngBuffer = await svgToPngBuffer(svg);
    } catch (error) {
      if (error instanceof ImageProcessingUnavailableError) {
        return NextResponse.json({ error: error.message, code: error.code, svg }, { status: 503 });
      }
      throw error;
    }
    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${preset.id}-${skinId}.png"`,
      },
    });
  }

  return NextResponse.json({
    preset,
    skin: DIAGRAM_SKINS[skinId],
    svg,
    html,
    doctor,
    ledger,
    sizePresets: DIAGRAM_SIZE_PRESETS,
    activeSize: resolveSizePreset(sizeId),
  });
}
