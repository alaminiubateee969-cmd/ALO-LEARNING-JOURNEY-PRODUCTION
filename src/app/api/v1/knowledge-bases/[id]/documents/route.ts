/**
 * POST /api/v1/knowledge-bases/{id}/documents
 *
 * Upload a new document to the knowledge base. The body is multipart/form-data:
 *   - title        (string, required)
 *   - sourceType   (string, required: "pdf" | "docx" | "txt" | "csv" | "url" | "faq")
 *   - sourceUrl    (string, optional — original URL or storage path)
 *   - rawText      (string, required: extracted plain text)
 *   - visibleToAgents (JSON array of agentIds — empty = all)
 *
 * Creates a KnowledgeDocument row in `status='processing'`. Chunking +
 * embedding is a separate step (call /reindex to kick it off).
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok, notFound } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

const VALID_SOURCE_TYPES = ['pdf', 'docx', 'txt', 'csv', 'url', 'faq'];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const { id } = await params;
  const kb = await db.knowledgeBase.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!kb) return notFound('knowledge base not found');

  // Try multipart first, fall back to JSON
  let title = '';
  let sourceType = '';
  let sourceUrl: string | null = null;
  let rawText = '';
  let visibleToAgents: string[] = [];

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    title = String(formData.get('title') || '');
    sourceType = String(formData.get('sourceType') || '');
    sourceUrl = formData.get('sourceUrl') ? String(formData.get('sourceUrl')) : null;
    rawText = String(formData.get('rawText') || '');
    const vtaRaw = formData.get('visibleToAgents');
    if (vtaRaw) {
      try {
        visibleToAgents = typeof vtaRaw === 'string' ? JSON.parse(vtaRaw) : [];
      } catch {
        visibleToAgents = [];
      }
    }
  } else {
    const body = await request.json().catch(() => null);
    if (!body) return badRequest('multipart/form-data or JSON body required');
    title = String(body.title || '');
    sourceType = String(body.sourceType || '');
    sourceUrl = body.sourceUrl || null;
    rawText = String(body.rawText || '');
    visibleToAgents = Array.isArray(body.visibleToAgents) ? body.visibleToAgents : [];
  }

  if (!title) return badRequest('title is required');
  if (!sourceType || !VALID_SOURCE_TYPES.includes(sourceType)) {
    return badRequest(`sourceType must be one of: ${VALID_SOURCE_TYPES.join(', ')}`);
  }
  if (!rawText) return badRequest('rawText is required');

  const created = await db.knowledgeDocument.create({
    data: {
      knowledgeBaseId: id,
      title,
      sourceType,
      sourceUrl,
      rawText,
      visibleToAgents: JSON.stringify(visibleToAgents),
      status: 'processing',
      uploadedBy: ctx.userId,
    },
  });

  await emitEvent({
    type: 'knowledge_document.uploaded',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'knowledge_document',
    resourceId: created.id,
    title: 'Knowledge document uploaded',
    description: `Document "${created.title}" uploaded to KB "${kb.name}"`,
    metadata: {
      knowledgeBaseId: id,
      sourceType,
      characters: rawText.length,
    },
  });

  return ok({
    document: {
      ...created,
      visibleToAgents: JSON.parse(created.visibleToAgents || '[]'),
      indexedAt: created.indexedAt?.toISOString() || null,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
    nextStep: `POST /api/v1/knowledge-bases/${id}/documents/${created.id}/reindex to chunk + embed`,
  });
}
