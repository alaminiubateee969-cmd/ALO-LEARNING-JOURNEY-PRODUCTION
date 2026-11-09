/**
 * GET/POST /api/v1/agent-status — list/update own agent status
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok, forbidden } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  // List all agent statuses for the tenant (supervisor view)
  const statuses = await db.agentStatus.findMany({
    where: { companyId: ctx.companyId },
    include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
  });
  return ok({ agentStatuses: statuses });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.status) return badRequest('status is required');
  const validStatuses = ['offline', 'available', 'busy', 'after_call', 'break', 'lunch', 'training'];
  if (!validStatuses.includes(body.status)) return badRequest(`status must be one of: ${validStatuses.join(', ')}`);

  const status = await db.agentStatus.upsert({
    where: { userId: ctx.userId },
    update: {
      status: body.status,
      statusChangedAt: new Date(),
      breakEndsAt: body.breakEndsAt ? new Date(body.breakEndsAt) : null,
    },
    create: {
      userId: ctx.userId,
      companyId: ctx.companyId,
      status: body.status,
      statusChangedAt: new Date(),
    },
  });

  await emitEvent({
    type: 'agent.status_changed',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'agent_status',
    resourceId: status.id,
    metadata: { status: body.status },
  });

  return ok(status);
}
