/**
 * GET  /api/v1/billing/invoices   — list invoices for tenant
 * POST /api/v1/billing/invoices   — create an invoice (super_admin or system)
 *
 * POST body:
 *   { "invoiceNumber": "INV-2026-001",
 *     "periodStart": "2026-01-01T00:00:00Z", "periodEnd": "2026-01-31T...",
 *     "subtotal": 100, "tax": 10, "total": 110, "currency": "USD",
 *     "lineItems": [{ "description": "Starter plan", "quantity": 1, "unitPrice": 100, "total": 100 }],
 *     "status": "draft"|"sent", "dueAt": "2026-02-15" }
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, badRequest, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 500);

  const where: any = { companyId: ctx.companyId };
  if (status) where.status = status;

  const invoices = await db.mosInvoice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { _count: { select: { payments: true } } },
  });

  return ok({
    invoices: invoices.map((inv) => ({
      ...inv,
      lineItems: JSON.parse(inv.lineItems || '[]'),
      periodStart: inv.periodStart.toISOString(),
      periodEnd: inv.periodEnd.toISOString(),
      sentAt: inv.sentAt?.toISOString() || null,
      paidAt: inv.paidAt?.toISOString() || null,
      dueAt: inv.dueAt?.toISOString() || null,
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString(),
      paymentCount: (inv as any)._count?.payments ?? 0,
    })),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  // super_admin or company_owner (for manual invoicing)
  if (!ctx.isSuperAdmin && ctx.role !== 'company_owner') {
    return forbidden('company_owner role required');
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.invoiceNumber || !body.periodStart || !body.periodEnd || body.subtotal == null || body.total == null) {
    return badRequest('invoiceNumber, periodStart, periodEnd, subtotal, total are required');
  }

  const existing = await db.mosInvoice.findUnique({ where: { invoiceNumber: body.invoiceNumber } });
  if (existing) return badRequest(`invoice number "${body.invoiceNumber}" already exists`);

  const lineItems = Array.isArray(body.lineItems) ? body.lineItems : [];

  const created = await db.mosInvoice.create({
    data: {
      companyId: ctx.companyId,
      invoiceNumber: String(body.invoiceNumber),
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
      subtotal: Number(body.subtotal),
      tax: Number(body.tax || 0),
      total: Number(body.total),
      currency: body.currency || 'USD',
      lineItems: JSON.stringify(lineItems),
      status: body.status || 'draft',
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
      paymentMethodRef: body.paymentMethodRef || null,
    },
  });

  await emitEvent({
    type: 'billing.invoice_created',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'invoice',
    resourceId: created.id,
    title: 'Invoice created',
    description: `Invoice ${created.invoiceNumber} created for ${created.total} ${created.currency}`,
    metadata: {
      invoiceNumber: created.invoiceNumber,
      total: created.total,
      currency: created.currency,
      status: created.status,
    },
  });

  return ok({
    invoice: {
      ...created,
      lineItems: JSON.parse(created.lineItems || '[]'),
      periodStart: created.periodStart.toISOString(),
      periodEnd: created.periodEnd.toISOString(),
      dueAt: created.dueAt?.toISOString() || null,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
  });
}
