import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export async function GET() {
  await ensureSeeded();
  const docs = await db.ragDocument.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ docs });
}

export async function POST(req: Request) {
  await ensureSeeded();
  const { title, sourceType, content, tags } = await req.json().catch(() => ({
    title: "Untitled",
    sourceType: "manual",
    content: "",
    tags: [],
  }));
  // naive chunking: split by sentences into ~300 char chunks
  const sentences = content.split(/(?<=[।.!?])\s+/).filter(Boolean);
  const chunks: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + s).length > 300) {
      if (buf) chunks.push(buf.trim());
      buf = s;
    } else buf += " " + s;
  }
  if (buf.trim()) chunks.push(buf.trim());

  const doc = await db.ragDocument.create({
    data: {
      title,
      sourceType,
      content,
      tagsJson: JSON.stringify(tags ?? []),
      chunkCount: chunks.length,
    },
  });
  for (const c of chunks) {
    const keywords = c
      .split(/[\s,।.!?]+/)
      .filter((w) => w.length > 3)
      .slice(0, 8);
    await db.ragChunk.create({
      data: { documentId: doc.id, text: c, keywordsJson: JSON.stringify(keywords) },
    });
  }
  await db.auditLog.create({
    data: {
      actor: "admin",
      action: "rag.ingest",
      detail: `Ingested "${title}" (${chunks.length} chunks)`,
      severity: "info",
    },
  });
  return NextResponse.json({ doc, chunkCount: chunks.length });
}
