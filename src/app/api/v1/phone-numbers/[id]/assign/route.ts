/**
 * POST /api/v1/phone-numbers/{id}/assign
 *
 * Assign a phone number to this tenant (or, for super_admin, to a different
 * tenant). The number must currently be in `available` status.
 *
 * Body:
 *   { "companyId": "..." }   // optional — defaults to current tenant; super_admin can target another
 *
 * On success: status='assigned', assignedAt=now, companyId is set.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, badRequest, ok, notFound } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin && !['company_owner', 'admin', 'manager'].includes(ctx.role)) {
    return forbidden('manager role required');
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({})) || {};
  const targetCompanyId = ctx.isSuperAdmin && body.companyId
    ? String(body.companyId)
    : ctx.companyId;

  const number = await db.phoneNumber.findUnique({ where: { id } });
  if (!number) return notFound('phone number not found');

  if (number.status !== 'available') {
    return badRequest(`number is in status '${number.status}' (must be 'available')`);
  }

  if (!ctx.isSuperAdmin && number.companyId && number.companyId !== ctx.companyId) {
    return forbidden('number does not belong to this tenant');
  }

  const updated = await db.phoneNumber.update({
    where: { id },
    data: {
      companyId: targetCompanyId,
      status: 'assigned',
      assignedAt: new Date(),
    },
  });

  await emitEvent({
    type: 'phone_number.assigned',
    companyId: targetCompanyId,
    userId: ctx.userId,
    resource: 'phone_number',
    resourceId: id,
    title: 'Phone number assigned',
    description: `Number ${number.number} assigned to tenant ${targetCompanyId}`,
    metadata: { targetCompanyId, fromStatus: number.status },
  });

  return ok({
    number: {
      id: updated.id,
      number: updated.number,
      status: updated.status,
      companyId: updated.companyId,
      assignedAt: updated.assignedAt?.toISOString(),
    },
  });
}
