/**
 * POST /api/v1/billing/payments
 *
 * Record a payment against an invoice (or as an unallocated credit).
 *
 * Body:
 *   { "invoiceId": "...",                  // optional — if omitted, payment is unallocated
 *     "amount": 100, "currency": "USD",
 *     "provider": "stripe"|"sslcommerz"|"manual"|"bank_transfer",
 *     "providerPaymentId": "...", "method": "card"|"bank"|"wallet"|"manual",
 *     "status": "pending"|"succeeded"|"failed" }
 *
 * On success (status='succeeded'):
 *   - If invoiceId is set, mark the invoice as paid (status='paid', paidAt=now)
 *   - Emit `billing.payment_recorded` event
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok, notFound } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body || body.amount == null || !body.provider || !body.method) {
    return badRequest('amount, provider, method are required');
  }

  let invoiceId: string | null = null;
  if (body.invoiceId) {
    const inv = await db.mosInvoice.findFirst({
      where: { id: body.invoiceId, companyId: ctx.companyId },
    });
    if (!inv) return notFound('invoice not found');
    invoiceId = inv.id;
  }

  const created = await db.payment.create({
    data: {
      companyId: ctx.companyId,
      invoiceId,
      amount: Number(body.amount),
      currency: body.currency || 'USD',
      provider: String(body.provider),
      providerPaymentId: body.providerPaymentId || null,
      method: String(body.method),
      status: body.status || 'pending',
      processedAt: body.status === 'succeeded' ? new Date() : null,
      failureReason: body.failureReason || null,
      createdBy: ctx.userId,
    },
  });

  // If succeeded and linked to invoice, mark invoice as paid
  if (created.status === 'succeeded' && invoiceId) {
    await db.mosInvoice.update({
      where: { id: invoiceId },
      data: { status: 'paid', paidAt: new Date() },
    });
  }

  await emitEvent({
    type: 'billing.payment_recorded',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'payment',
    resourceId: created.id,
    title: 'Payment recorded',
    description: `Payment of ${created.amount} ${created.currency} via ${created.provider} (${created.status})`,
    metadata: {
      amount: created.amount,
      currency: created.currency,
      provider: created.provider,
      method: created.method,
      invoiceId: created.invoiceId,
      status: created.status,
    },
  });

  return ok({
    payment: {
      ...created,
      processedAt: created.processedAt?.toISOString() || null,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
  });
}
