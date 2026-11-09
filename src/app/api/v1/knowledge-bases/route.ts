/**
 * GET/POST /api/v1/knowledge-bases
 * POST /api/v1/knowledge-bases/[id]/documents
 * POST /api/v1/knowledge-bases/[id]/search
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, notFound, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const kbs = await db.knowledgeBase.findMany({
    where: { companyId: ctx.companyId },
    include: { _count: { select: { documents: true } } },
  });
  return ok({ knowledgeBases: kbs });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.name) return badRequest('name is required');

  const kb = await db.knowledgeBase.create({
    data: {
      companyId: ctx.companyId,
      name: body.name,
      description: body.description || null,
      embedProvider: body.embedProvider || 'local',
      embedModel: body.embedModel || 'bge-m3',
    },
  });

  await emitEvent({
    type: 'knowledge_base.created',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'knowledge_base',
    resourceId: kb.id,
  });

  return ok(kb);
}
