import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getVideoStorageDir } from "@/lib/storage-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };
const VIDEO_DIR = getVideoStorageDir();

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!/^(?:cine|pv)_(?:[0-9a-f-]{36}|\d{10,16})$/i.test(id)) {
    return NextResponse.json({ error: "subtitle_not_found" }, { status: 404 });
  }
  try {
    const subtitle = await readFile(path.join(VIDEO_DIR, `${id}.srt`));
    return new NextResponse(new Uint8Array(subtitle), {
      headers: {
        "Content-Type": "application/x-subrip; charset=utf-8",
        "Content-Disposition": `attachment; filename="${id}.srt"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "subtitle_not_found" }, { status: 404 });
  }
}
