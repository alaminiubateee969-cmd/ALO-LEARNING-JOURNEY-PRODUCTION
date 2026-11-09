/**
 * POST /api/v1/phone-numbers/{id}/release
 *
 * Release a phone number from its tenant. Number stays in the catalog but is
 * marked `status='available'` and unassigned. Future inbound calls to this
 * number would not be routed to any tenant.
 *
 * Body: { }   (no parameters)
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
  const number = await db.phoneNumber.findFirst({
    where: ctx.isSuperAdmin ? { id } : { id, companyId: ctx.companyId },
  });
  if (!number) return notFound('phone number not found');

  if (number.status === 'released') {
    return badRequest('number already released');
  }

  const updated = await db.phoneNumber.update({
    where: { id },
    data: {
      status: 'available',
      releasedAt: new Date(),
      companyId: null,
      destinationType: null,
      destinationId: null,
      assignedAt: null,
      activatedAt: null,
    },
  });

  await emitEvent({
    type: 'phone_number.released',
    companyId: number.companyId || ctx.companyId,
    userId: ctx.userId,
    resource: 'phone_number',
    resourceId: id,
    title: 'Phone number released',
    description: `Number ${number.number} released back to pool`,
    metadata: { fromStatus: number.status },
  });

  return ok({
    number: {
      id: updated.id,
      number: updated.number,
      status: updated.status,
      releasedAt: updated.releasedAt?.toISOString(),
    },
  });
}
