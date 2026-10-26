import { NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { getVideoStorageDir } from "@/lib/storage-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
const VIDEO_DIR = getVideoStorageDir();

/**
 * Thumbnail for a local render (photo → video, cinematic).
 * Only `pv_<uuid>` / `cine_<uuid|timestamp>` ids are served — arbitrary paths
 * are rejected before any filesystem access.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!/^(?:pv|cine)_(?:[0-9a-f-]{36}|\d{10,16})$/i.test(id)) {
    return NextResponse.json({ error: "thumbnail_not_found" }, { status: 404 });
  }

  for (const extension of ["jpg", "png"]) {
    const filePath = path.join(VIDEO_DIR, `${id}.${extension}`);
    try {
      const file = await stat(filePath);
      if (!file.isFile()) continue;
      const image = await readFile(filePath);
      return new Response(new Uint8Array(image), {
        headers: {
          "Content-Type": extension === "png" ? "image/png" : "image/jpeg",
          "Content-Length": String(image.byteLength),
          "Cache-Control": "private, max-age=300",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json({ error: "thumbnail_not_found" }, { status: 404 });
}
