/**
 * POST /api/v1/billing/adjustments
 *
 * Create a manual billing adjustment (credit / charge / refund / waiver).
 * Super_admin only — requires `approvedBy` (the user ID of the approver,
 * which is the acting super_admin unless explicitly different).
 *
 * Per directive §5: manual adjustments must be audited with the approver
 * recorded. We always persist `approvedBy` (defaults to the acting user).
 *
 * Body:
 *   { "type": "credit"|"charge"|"refund"|"waiver",
 *     "amount": 25, "currency": "USD",
 *     "reason": "Goodwill credit for outage on 2026-01-15",
 *     "invoiceId": "...",   // optional
 *     "approvedBy": "..." } // optional — defaults to current user
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, badRequest, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

const VALID_TYPES = ['credit', 'charge', 'refund', 'waiver'];

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const body = await request.json().catch(() => null);
  if (!body || !body.type || body.amount == null || !body.reason) {
    return badRequest('type, amount, reason are required');
  }
  if (!VALID_TYPES.includes(body.type)) {
    return badRequest(`type must be one of: ${VALID_TYPES.join(', ')}`);
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return badRequest('amount must be a positive number');
  }

  // If invoiceId provided, validate it belongs to the tenant (or skip if super_admin)
  let invoiceId: string | null = null;
  if (body.invoiceId) {
    const inv = await db.mosInvoice.findUnique({ where: { id: body.invoiceId } });
    if (!inv) return badRequest('invoiceId not found');
    invoiceId = inv.id;
  }

  const approverId = body.approvedBy || ctx.userId;

  const adjustment = await db.billingAdjustment.create({
    data: {
      companyId: ctx.companyId,
      type: String(body.type),
      amount,
      currency: body.currency || 'USD',
      reason: String(body.reason),
      invoiceId,
      createdBy: ctx.userId,
      approvedBy: approverId,
    },
  });

  await emitEvent({
    type: 'billing.adjustment_created',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'billing_adjustment',
    resourceId: adjustment.id,
    title: 'Billing adjustment created',
    description: `${adjustment.type} of ${adjustment.amount} ${adjustment.currency} — ${adjustment.reason}`,
    metadata: {
      type: adjustment.type,
      amount: adjustment.amount,
      currency: adjustment.currency,
      reason: adjustment.reason,
      approvedBy: approverId,
      invoiceId: adjustment.invoiceId,
    },
  });

  return ok({
    adjustment: {
      ...adjustment,
      createdAt: adjustment.createdAt.toISOString(),
    },
  });
}
