/**
 * GET /api/v1/calls/[id] — call detail with events
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, notFound, ok } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const { id } = await params;

  const call = await db.call.findFirst({
    where: { id, companyId: ctx.companyId },
    include: { events: { orderBy: { timestamp: 'asc' } } },
  });
  if (!call) return notFound('call not found');

  return ok(call);
}
