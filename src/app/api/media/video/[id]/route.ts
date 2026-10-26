import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { getVideoStorageDir } from "@/lib/storage-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
const VIDEO_DIR = getVideoStorageDir();

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!/^(?:video|cine|pv)_(?:[0-9a-f-]{36}|\d{10,16})$/i.test(id)) {
    return NextResponse.json({ error: "video_not_found" }, { status: 404 });
  }
  const filePath = path.join(VIDEO_DIR, `${id}.mp4`);
  try {
    const file = await stat(filePath);
    if (!file.isFile()) return NextResponse.json({ error: "video_not_found" }, { status: 404 });
    const baseHeaders = {
      "Accept-Ranges": "bytes",
      "Content-Type": "video/mp4",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="${id}.mp4"`,
    };
    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { ...baseHeaders, "Content-Range": `bytes */${file.size}` } });
      let start = match[1] ? Number(match[1]) : Math.max(0, file.size - Number(match[2]));
      let end = match[2] && match[1] ? Number(match[2]) : file.size - 1;
      if (start < 0 || end < start || start >= file.size) return new Response(null, { status: 416, headers: { ...baseHeaders, "Content-Range": `bytes */${file.size}` } });
      end = Math.min(end, file.size - 1);
      const stream = createReadStream(filePath, { start, end });
      return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
        status: 206,
        headers: { ...baseHeaders, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${file.size}` },
      });
    }
    const stream = createReadStream(filePath);
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      headers: { ...baseHeaders, "Content-Length": String(file.size) },
    });
  } catch {
    return NextResponse.json({ error: "video_not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}
