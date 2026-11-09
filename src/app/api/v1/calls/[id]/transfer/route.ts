/**
 * POST /api/v1/calls/[id]/transfer — transfer call to another destination
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, notFound, ok } from '@/lib/v1-middleware';
import { transferCall } from '@/lib/telephony-adapter';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body?.destination || !body?.reason) return badRequest('destination and reason are required');

  const existing = await db.call.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!existing) return notFound('call not found');

  const result = await transferCall(
    id,
    body.destination,
    { type: 'human_agent', id: ctx.userId },
    body.reason
  );
  return ok(result);
}
