/**
 * POST /api/v1/billing/credits/purchase
 *
 * Add credits to the tenant's balance. Used for "top up" purchases outside
 * the regular subscription billing cycle.
 *
 * Body:
 *   { "creditType": "ai_minutes"|"tts_chars"|"asr_seconds"|"recording_mb"|"outbound_calls",
 *     "amount": 1000 }
 *
 * Per directive §5: every credit change is audited via the BillingAdjustment
 * table (type='credit') with the approver set to the acting user.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, badRequest, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

const VALID_CREDIT_TYPES = ['ai_minutes', 'tts_chars', 'asr_seconds', 'recording_mb', 'outbound_calls'];

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin && ctx.role !== 'company_owner') {
    return forbidden('company_owner role required');
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.creditType || body.amount == null) {
    return badRequest('creditType and amount are required');
  }
  if (!VALID_CREDIT_TYPES.includes(body.creditType)) {
    return badRequest(`creditType must be one of: ${VALID_CREDIT_TYPES.join(', ')}`);
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return badRequest('amount must be a positive number');
  }

  const credit = await db.usageCredit.upsert({
    where: { companyId_creditType: { companyId: ctx.companyId, creditType: body.creditType } },
    update: { balance: { increment: amount } },
    create: { companyId: ctx.companyId, creditType: body.creditType, balance: amount },
  });

  // Audit log via BillingAdjustment (type=credit)
  await db.billingAdjustment.create({
    data: {
      companyId: ctx.companyId,
      type: 'credit',
      amount,
      currency: 'USD',
      reason: `Purchased ${amount} ${body.creditType} credits`,
      createdBy: ctx.userId,
      approvedBy: ctx.userId,
    },
  });

  await emitEvent({
    type: 'billing.credits_purchased',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'usage_credit',
    resourceId: credit.id,
    title: 'Credits purchased',
    description: `Added ${amount} ${body.creditType} (new balance: ${credit.balance})`,
    metadata: {
      creditType: body.creditType,
      amountAdded: amount,
      newBalance: credit.balance,
    },
  });

  return ok({
    credit: {
      id: credit.id,
      creditType: credit.creditType,
      balance: credit.balance,
      updatedAt: credit.updatedAt.toISOString(),
    },
  });
}
