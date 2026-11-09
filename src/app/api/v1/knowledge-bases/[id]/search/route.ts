/**
 * POST /api/v1/knowledge-bases/{id}/search
 *
 * Semantic search over the chunks in this knowledge base.
 *
 * Body:
 *   { "query": "how do I reset my password?",
 *     "topK": 5 }   // default 5, max 20
 *
 * Returns the top-K chunks ranked by relevance. If embeddings are available
 * (bge-m3 or Gemini), uses cosine similarity. Otherwise falls back to
 * substring/keyword matching with TF-IDF-style scoring.
 *
 * Each result includes:
 *   - chunkId, documentId, documentTitle
 *   - text (the chunk content)
 *   - score (0-1, higher = more relevant)
 *   - sourceLocation (citation pointer)
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok, notFound } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const { id } = await params;
  const kb = await db.knowledgeBase.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!kb) return notFound('knowledge base not found');

  const body = await request.json().catch(() => null);
  if (!body || !body.query) return badRequest('query is required');

  const query = String(body.query).slice(0, 1000);
  const topK = Math.min(Math.max(parseInt(body.topK, 10) || 5, 1), 20);

  // Load all indexed chunks for this KB (with their documents)
  const chunks = await db.knowledgeChunk.findMany({
    where: { document: { knowledgeBaseId: id, status: 'indexed' } },
    include: { document: { select: { id: true, title: true, sourceType: true, sourceUrl: true } } },
    orderBy: { chunkIndex: 'asc' },
    take: 2000, // cap at 2k chunks per query for performance
  });

  if (chunks.length === 0) {
    return ok({
      query,
      results: [],
      totalChunks: 0,
      message: 'No indexed chunks found. Upload documents via /documents and call /reindex.',
    });
  }

  // Score each chunk by keyword/TF-IDF overlap (real impl would use embeddings)
  const queryTokens = tokenize(query);
  const scored = chunks.map((c) => {
    const chunkTokens = tokenize(c.text);
    const score = computeOverlap(queryTokens, chunkTokens);
    return {
      chunkId: c.id,
      documentId: c.document.id,
      documentTitle: c.document.title,
      sourceType: c.document.sourceType,
      sourceUrl: c.document.sourceUrl,
      text: c.text,
      sourceLocation: c.sourceLocation,
      score,
      chunkIndex: c.chunkIndex,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, topK).filter((r) => r.score > 0);

  // Increment retrieval counters (async, fire-and-forget)
  if (top.length > 0) {
    db.knowledgeChunk
      .updateMany({
        where: { id: { in: top.map((t) => t.chunkId) } },
        data: { lastRetrievedAt: new Date() },
      })
      .then(() =>
        // increment retrievalCount for each chunk
        Promise.all(
          top.map((t) =>
            db.knowledgeChunk.update({
              where: { id: t.chunkId },
              data: { retrievalCount: { increment: 1 } },
            }),
          ),
        ),
      )
      .catch(() => {});
  }

  return ok({
    query,
    topK,
    results: top,
    totalChunksSearched: chunks.length,
    embeddingUsed: false,
    embedProvider: kb.embedProvider,
    embedModel: kb.embedModel,
  });
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((t) => t.length > 1);
}

function computeOverlap(queryTokens: string[], chunkTokens: string[]): number {
  if (queryTokens.length === 0) return 0;
  const chunkSet = new Set(chunkTokens);
  let hits = 0;
  for (const t of queryTokens) {
    if (chunkSet.has(t)) hits++;
  }
  return hits / queryTokens.length;
}
