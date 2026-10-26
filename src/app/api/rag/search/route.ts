import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

type RagDocumentRecord = {
  id: string;
  title: string;
  sourceType: string;
  content: string;
  createdAt: Date;
};

type RagChunkRecord = {
  documentId: string;
  text: string;
  keywordsJson: string | null;
  createdAt: Date;
};

type RagSearchResult = {
  source_id: string;
  source_title: string;
  source_type: string;
  retrieved_text: string;
  relevance_score: number;
  citation: string;
  updated_at: Date;
};

function parseKeywords(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

// Lexical keyword/overlap search only. This is not vector search and does not
// establish factual relevance or verify generated content.
export async function POST(req: Request) {
  await ensureSeeded();
  const body = await req.json().catch(() => null) as { query?: unknown } | null;
  if (!body || typeof body.query !== "string") {
    return NextResponse.json({ error: "query_must_be_a_string" }, { status: 400 });
  }
  const q = body.query.trim().toLowerCase();
  if (!q) return NextResponse.json({ results: [], query: q });
  if (q.length > 500) return NextResponse.json({ error: "query_too_long" }, { status: 400 });

  const qTerms = q.split(/\s+/).filter((term) => term.length > 2).slice(0, 20);
  const results: RagSearchResult[] = [];

  const chunks = await db.ragChunk.findMany({ take: 5_000 }) as RagChunkRecord[];
  const docs = await db.ragDocument.findMany({ take: 1_000 }) as RagDocumentRecord[];
  const docMap = new Map<string, RagDocumentRecord>(docs.map((doc) => [doc.id, doc]));

  for (const chunk of chunks) {
    const text = chunk.text.toLowerCase();
    const keywords = parseKeywords(chunk.keywordsJson);
    let score = 0;
    for (const keyword of keywords) {
      const normalizedKeyword = keyword.toLowerCase();
      if (q.includes(normalizedKeyword)) score += 0.4;
      if (normalizedKeyword.includes(q)) score += 0.3;
    }
    for (const term of qTerms) {
      if (text.includes(term)) score += 0.15;
    }
    if (score > 0) {
      const doc = docMap.get(chunk.documentId);
      results.push({
        source_id: chunk.documentId,
        source_title: doc?.title ?? "Untitled",
        source_type: doc?.sourceType ?? "unknown",
        retrieved_text: chunk.text,
        relevance_score: Math.min(1, score),
        citation: `${doc?.title ?? "Untitled"} — chunk`,
        updated_at: chunk.createdAt,
      });
    }
  }

  // Document-level fallback catches records without stored chunks.
  for (const doc of docs) {
    const text = doc.content.toLowerCase();
    let score = 0;
    for (const term of qTerms) {
      if (text.includes(term)) score += 0.2;
    }
    if (q.length > 3 && text.includes(q)) score += 0.4;
    if (doc.title.toLowerCase().includes(q)) score += 0.3;
    if (score > 0) {
      const alreadyListedAsDocument = results.some(
        (result) => result.source_id === doc.id && result.retrieved_text === doc.content
      );
      if (!alreadyListedAsDocument) {
        results.push({
          source_id: doc.id,
          source_title: doc.title,
          source_type: doc.sourceType,
          retrieved_text: doc.content.slice(0, 280),
          relevance_score: Math.min(1, score),
          citation: `${doc.title} — document`,
          updated_at: doc.createdAt,
        });
      }
    }
  }

  results.sort((a, b) => b.relevance_score - a.relevance_score);
  return NextResponse.json({ results: results.slice(0, 8), query: q, searchType: "lexical_keyword_overlap" });
}
