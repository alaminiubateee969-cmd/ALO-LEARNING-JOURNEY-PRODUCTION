/**
 * GET  /api/v1/call-queues   — list call queues
 * POST /api/v1/call-queues   — create a new call queue
 *
 * Body for POST:
 *   { "name": "Support Queue", "description": "...",
 *     "agentIds": ["userId1", "userId2"],
 *     "maxSize": 50, "priorityLevels": 3,
 *     "mohUrl": "https://...", "announcePosition": true, "announceEta": true,
 *     "maxWaitSec": 300, "overflowDestinationType": "voicemail"|"external"|"ai_agent",
 *     "overflowDestinationId": "...", "status": "active" }
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, badRequest, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const queues = await db.callQueue.findMany({
    where: { companyId: ctx.companyId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });

  return ok({
    callQueues: queues.map((q) => ({
      ...q,
      agentIds: JSON.parse(q.agentIds || '[]'),
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin && !['company_owner', 'admin', 'manager'].includes(ctx.role)) {
    return forbidden('manager role required');
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.name) return badRequest('name is required');

  const agentIds = Array.isArray(body.agentIds) ? body.agentIds : [];
  if (agentIds.length > 0) {
    const links = await db.companyUser.findMany({
      where: { companyId: ctx.companyId, userId: { in: agentIds } },
      select: { userId: true },
    });
    if (links.length !== agentIds.length) {
      return badRequest('some agentIds do not belong to this tenant');
    }
  }

  const created = await db.callQueue.create({
    data: {
      companyId: ctx.companyId,
      name: String(body.name),
      description: body.description || null,
      agentIds: JSON.stringify(agentIds),
      maxSize: body.maxSize ?? 50,
      priorityLevels: body.priorityLevels ?? 3,
      mohUrl: body.mohUrl || null,
      announcePosition: body.announcePosition ?? true,
      announceEta: body.announceEta ?? true,
      maxWaitSec: body.maxWaitSec ?? 300,
      overflowDestinationType: body.overflowDestinationType || null,
      overflowDestinationId: body.overflowDestinationId || null,
      status: body.status || 'active',
    },
  });

  await emitEvent({
    type: 'call_queue.created',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'call_queue',
    resourceId: created.id,
    title: 'Call queue created',
    description: `Call queue "${created.name}" created with ${agentIds.length} agents`,
    metadata: { maxSize: created.maxSize, maxWaitSec: created.maxWaitSec },
  });

  return ok({
    callQueue: {
      ...created,
      agentIds: JSON.parse(created.agentIds || '[]'),
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
  });
}
