import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, notFound, ok, badRequest } from '@/lib/v1-middleware';
import { transitionCall } from '@/lib/telephony-adapter';

export const dynamic = 'force-dynamic';

const TARGET_STATUS = 'hold';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const { id } = await params;

  const existing = await db.call.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!existing) return notFound('call not found');

  const result = await transitionCall(
    id,
    TARGET_STATUS as any,
    { type: 'human_agent', id: ctx.userId },
  );
  return ok(result);
}
