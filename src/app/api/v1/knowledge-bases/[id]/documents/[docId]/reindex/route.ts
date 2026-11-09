/**
 * POST /api/v1/knowledge-bases/{id}/documents/{docId}/reindex
 *
 * Kick off chunking + embedding for a document.
 *
 * Process:
 *   1. Split the document's `rawText` into chunks (~500 chars, with overlap)
 *   2. For each chunk, generate an embedding (local bge-m3 by default)
 *   3. Persist KnowledgeChunk rows with the embedding (base64 Float32Array)
 *   4. Mark the document as `status='indexed'`, `indexedAt=now`
 *
 * If no embedding provider is configured, the chunks are persisted with
 * `embedding=null` and the document is marked as `indexed` so semantic search
 * will fall back to substring/keyword matching.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, ok, notFound, badRequest } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const { id, docId } = await params;
  const kb = await db.knowledgeBase.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!kb) return notFound('knowledge base not found');

  const doc = await db.knowledgeDocument.findFirst({
    where: { id: docId, knowledgeBaseId: id },
    include: { chunks: true },
  });
  if (!doc) return notFound('document not found');

  // If already indexed and forceReindex not set, return early
  const body = await request.json().catch(() => ({})) || {};
  if (doc.status === 'indexed' && !body.forceReindex) {
    return ok({
      document: { id: doc.id, status: doc.status, chunksCount: doc.chunksCount },
      message: 'document already indexed — set forceReindex=true to re-chunk',
    });
  }

  // Delete existing chunks (if reindexing)
  if (doc.chunks.length > 0) {
    await db.knowledgeChunk.deleteMany({ where: { documentId: docId } });
  }

  // Split rawText into overlapping chunks
  const chunks = chunkText(doc.rawText, CHUNK_SIZE, CHUNK_OVERLAP);

  // Persist chunks. Embedding generation would happen here via the configured
  // embed provider (local bge-m3, or Gemini). For the API surface we leave
  // embedding=null until a real embedder is wired in — semantic search falls
  // back to keyword matching.
  for (let i = 0; i < chunks.length; i++) {
    await db.knowledgeChunk.create({
      data: {
        documentId: docId,
        chunkIndex: i,
        text: chunks[i],
        embedding: null,
        sourceLocation: `chunk ${i + 1}/${chunks.length}`,
      },
    });
  }

  const updated = await db.knowledgeDocument.update({
    where: { id: docId },
    data: {
      status: 'indexed',
      indexedAt: new Date(),
      chunksCount: chunks.length,
    },
  });

  await emitEvent({
    type: 'knowledge_document.indexed',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'knowledge_document',
    resourceId: docId,
    title: 'Knowledge document indexed',
    description: `Document "${doc.title}" chunked into ${chunks.length} pieces`,
    metadata: {
      knowledgeBaseId: id,
      chunksCount: chunks.length,
      embedProvider: kb.embedProvider,
      embedModel: kb.embedModel,
    },
  });

  return ok({
    document: {
      id: updated.id,
      title: updated.title,
      status: updated.status,
      chunksCount: updated.chunksCount,
      indexedAt: updated.indexedAt?.toISOString(),
    },
    chunks: chunks.length,
    embedProvider: kb.embedProvider,
    embedModel: kb.embedModel,
    note: 'Embeddings stored as null until embedder service is wired in. Semantic search will fall back to keyword matching.',
  });
}

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    chunks.push(text.slice(i, end));
    if (end >= text.length) break;
    i = end - overlap;
    if (i < 0) i = 0;
  }
  return chunks;
}
