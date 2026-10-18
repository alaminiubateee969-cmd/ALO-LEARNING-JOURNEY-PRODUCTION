// Lazy, CPU-safe image processing.
//
// Sharp's prebuilt Linux binaries require x86-64-v2 (SSE4.2/POPCNT). The
// production VPS (Intel Core 2 Duo E7500) has no SSE4.2, so an eager
// top-level `import sharp` crashes Next.js page-data collection at BUILD
// time (e.g. for /api/command via src/lib/ai.ts -> src/lib/local-models.ts)
// and crashes the process at runtime. Sharp is therefore ONLY loaded here,
// dynamically, on first actual use — never at module import time.
//
// If the native binary cannot load on the host CPU, callers get a typed,
// actionable ImageProcessingUnavailableError instead of a process crash.
// Other functionality (SVG/JSON responses, ComfyUI PNG passthrough) is
// unaffected. We never fake a PNG: unavailable rasterisation fails loudly.

export class ImageProcessingUnavailableError extends Error {
  readonly code = "IMAGE_PROCESSING_UNAVAILABLE";
  constructor(cause?: unknown) {
    super(
      "Image rasterisation (SVG→PNG) is unavailable on this host: the Sharp " +
        "native binary could not be loaded (prebuilt Sharp requires an " +
        "x86-64-v2 CPU with SSE4.2). Run on an x86-64-v2+ host, build Sharp " +
        "from source for this CPU, or use the SVG/JSON output instead. " +
        `Underlying error: ${cause instanceof Error ? cause.message : String(cause ?? "unknown")}`,
    );
    this.name = "ImageProcessingUnavailableError";
  }
}

type SharpFactory = (typeof import("sharp"))["default"];

let cached: SharpFactory | null = null;
let cachedError: ImageProcessingUnavailableError | null = null;

/** Load Sharp on first use only. Throws ImageProcessingUnavailableError. */
export async function loadSharp(): Promise<SharpFactory> {
  if (cached) return cached;
  if (cachedError) throw cachedError;
  try {
    const sharp = (await import("sharp")).default;
    // Probe actual usability — some binaries load but fail on first op.
    sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')).png();
    cached = sharp;
    return cached;
  } catch (error) {
    cachedError = new ImageProcessingUnavailableError(error);
    throw cachedError;
  }
}

/** Non-throwing availability probe (for health/status reporting). */
export async function isImageProcessingAvailable(): Promise<boolean> {
  try {
    await loadSharp();
    return true;
  } catch {
    return false;
  }
}

export async function svgToPngBuffer(svg: string | Buffer): Promise<Buffer> {
  const sharp = await loadSharp();
  return sharp(Buffer.isBuffer(svg) ? svg : Buffer.from(svg, "utf8")).png().toBuffer();
}

export async function svgToPngFile(svg: string | Buffer, outputPath: string): Promise<void> {
  const sharp = await loadSharp();
  const { mkdir } = await import("node:fs/promises");
  const path = await import("node:path");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(Buffer.isBuffer(svg) ? svg : Buffer.from(svg)).png().toFile(outputPath);
}
