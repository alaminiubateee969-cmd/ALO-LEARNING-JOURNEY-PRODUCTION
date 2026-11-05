/**
 * GET /api/v1/calls — list calls (filter by direction, status, agentId, date range)
 * POST /api/v1/calls — alias for originate (compat)
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, ok } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const url = new URL(request.url);
  const direction = url.searchParams.get('direction');
  const status = url.searchParams.get('status');
  const agentId = url.searchParams.get('agentId');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

  const where: any = { companyId: ctx.companyId };
  if (direction) where.direction = direction;
  if (status) where.status = status;
  if (agentId) where.agentId = agentId;

  const calls = await db.call.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      _count: { select: { events: true } },
    },
  });

  return ok({
    calls: calls.map((c) => ({
      ...c,
      eventCount: c._count.events,
      _count: undefined,
    })),
  });
}
