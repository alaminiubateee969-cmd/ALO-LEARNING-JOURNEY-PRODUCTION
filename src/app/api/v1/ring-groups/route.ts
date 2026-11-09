/**
 * GET  /api/v1/ring-groups   — list ring groups
 * POST /api/v1/ring-groups   — create a new ring group
 *
 * Body for POST:
 *   { "name": "Sales Team", "description": "...",
 *     "memberIds": ["userId1", "userId2"],
 *     "strategy": "ring_all"|"hunt"|"longest_idle"|"round_robin",
 *     "ringTimeoutSec": 20, "ringOrder": ["userId1","userId2"],
 *     "fallbackDestinationType": "voicemail"|"queue"|"external",
 *     "fallbackDestinationId": "...", "status": "active" }
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, badRequest, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const groups = await db.ringGroup.findMany({
    where: { companyId: ctx.companyId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });

  return ok({
    ringGroups: groups.map((g) => ({
      ...g,
      memberIds: JSON.parse(g.memberIds || '[]'),
      ringOrder: g.ringOrder ? JSON.parse(g.ringOrder) : null,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
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

  const memberIds = Array.isArray(body.memberIds) ? body.memberIds : [];

  // Validate that all memberIds belong to this tenant
  if (memberIds.length > 0) {
    const links = await db.companyUser.findMany({
      where: { companyId: ctx.companyId, userId: { in: memberIds } },
      select: { userId: true },
    });
    if (links.length !== memberIds.length) {
      return badRequest('some memberIds do not belong to this tenant');
    }
  }

  const created = await db.ringGroup.create({
    data: {
      companyId: ctx.companyId,
      name: String(body.name),
      description: body.description || null,
      memberIds: JSON.stringify(memberIds),
      strategy: body.strategy || 'ring_all',
      ringTimeoutSec: body.ringTimeoutSec ?? 20,
      ringOrder: body.ringOrder ? JSON.stringify(body.ringOrder) : null,
      fallbackDestinationType: body.fallbackDestinationType || null,
      fallbackDestinationId: body.fallbackDestinationId || null,
      status: body.status || 'active',
    },
  });

  await emitEvent({
    type: 'ring_group.created',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'ring_group',
    resourceId: created.id,
    title: 'Ring group created',
    description: `Ring group "${created.name}" created with ${memberIds.length} members`,
    metadata: { strategy: created.strategy, memberCount: memberIds.length },
  });

  return ok({
    ringGroup: {
      ...created,
      memberIds: JSON.parse(created.memberIds || '[]'),
      ringOrder: created.ringOrder ? JSON.parse(created.ringOrder) : null,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
  });
}
