import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

// Hybrid-ish search: keyword match on chunks + doc-level content match,
// then a naive relevance score. Company-private (single-tenant demo).
export async function POST(req: Request) {
  await ensureSeeded();
  const { query } = await req.json().catch(() => ({ query: "" }));
  const q = (query || "").trim().toLowerCase();
  if (!q) return NextResponse.json({ results: [] });

  const qTerms = q.split(/\s+/).filter((t) => t.length > 2);
  const results: any[] = [];

  // 1) Chunk-level search (keyword + term overlap)
  const chunks = await db.ragChunk.findMany();
  const docs = await db.ragDocument.findMany();
  const docMap = new Map<string, (typeof docs)[number]>(docs.map((d) => [d.id, d]));
  for (const c of chunks) {
    const text = c.text.toLowerCase();
    const keywords: string[] = c.keywordsJson ? JSON.parse(c.keywordsJson) : [];
    let score = 0;
    for (const kw of keywords) {
      if (q.includes(kw.toLowerCase())) score += 0.4;
      if (kw.toLowerCase().includes(q)) score += 0.3;
    }
    for (const t of qTerms) {
      if (text.includes(t)) score += 0.15;
    }
    if (score > 0) {
      const doc = docMap.get(c.documentId);
      results.push({
        source_id: c.documentId,
        source_title: doc?.title ?? "Untitled",
        source_type: doc?.sourceType ?? "unknown",
        retrieved_text: c.text,
        relevance_score: Math.min(1, score),
        citation: `${doc?.title ?? "Untitled"} — chunk`,
        updated_at: c.createdAt,
      });
    }
  }

  // 2) Document-level fallback (also catches docs whose chunks weren't created yet)
  for (const d of docs) {
    const text = d.content.toLowerCase();
    let score = 0;
    for (const t of qTerms) {
      if (text.includes(t)) score += 0.2;
    }
    if (q.length > 3 && text.includes(q)) score += 0.4;
    // also match by title
    if (d.title.toLowerCase().includes(q)) score += 0.3;
    if (score > 0) {
      // avoid duplicate if already matched via chunk
      if (results.some((r) => r.source_id === d.id && r.retrieved_text === d.content)) continue;
      results.push({
        source_id: d.id,
        source_title: d.title,
        source_type: d.sourceType,
        retrieved_text: d.content.slice(0, 280),
        relevance_score: Math.min(1, score),
        citation: `${d.title} — document`,
        updated_at: d.createdAt,
      });
    }
  }

  results.sort((a, b) => b.relevance_score - a.relevance_score);
  return NextResponse.json({ results: results.slice(0, 8), query: q });
}
