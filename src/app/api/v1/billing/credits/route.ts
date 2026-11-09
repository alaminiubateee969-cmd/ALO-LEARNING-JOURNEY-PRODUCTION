/**
 * GET /api/v1/billing/credits
 * POST /api/v1/billing/credits/purchase (alias POST to /api/v1/billing/credits)
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const credits = await db.usageCredit.findMany({ where: { companyId: ctx.companyId } });
  return ok({ credits });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.creditType || typeof body.amount !== 'number') return badRequest('creditType and amount are required');

  const credit = await db.usageCredit.upsert({
    where: { companyId_creditType: { companyId: ctx.companyId, creditType: body.creditType } },
    update: { balance: { increment: body.amount } },
    create: {
      companyId: ctx.companyId,
      creditType: body.creditType,
      balance: body.amount,
      autoRechargeThreshold: body.autoRechargeThreshold || 0,
      autoRechargeAmount: body.autoRechargeAmount || 0,
    },
  });

  await emitEvent({
    type: 'credit.purchased',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'usage_credit',
    resourceId: credit.id,
    metadata: { creditType: body.creditType, amount: body.amount },
  });

  return ok(credit);
}
