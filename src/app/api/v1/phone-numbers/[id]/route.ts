/**
 * GET    /api/v1/phone-numbers/{id}    — get a single number
 * PATCH  /api/v1/phone-numbers/{id}    — update fields
 * DELETE /api/v1/phone-numbers/{id}    — soft-delete (status=released)
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, badRequest, ok, notFound } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

const WRITABLE = [
  'country', 'numberType', 'capabilities', 'callerIdName',
  'businessHoursStart', 'businessHoursEnd', 'workingDays',
  'destinationType', 'destinationId', 'status',
] as const;

function serialize(n: any) {
  return {
    ...n,
    capabilities: JSON.parse(n.capabilities || '[]'),
    workingDays: n.workingDays ? JSON.parse(n.workingDays) : null,
    assignedAt: n.assignedAt?.toISOString() || null,
    activatedAt: n.activatedAt?.toISOString() || null,
    releasedAt: n.releasedAt?.toISOString() || null,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

async function loadScoped(ctx: any, id: string) {
  if (ctx.isSuperAdmin) {
    return await db.phoneNumber.findUnique({ where: { id } });
  }
  return await db.phoneNumber.findFirst({ where: { id, companyId: ctx.companyId } });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const { id } = await params;
  const n = await loadScoped(ctx, id);
  if (!n) return notFound('phone number not found');
  return ok({ number: serialize(n) });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin && !['company_owner', 'admin', 'manager'].includes(ctx.role)) {
    return forbidden('manager role required');
  }

  const { id } = await params;
  const existing = await loadScoped(ctx, id);
  if (!existing) return notFound('phone number not found');

  const body = await request.json().catch(() => null);
  if (!body) return badRequest('body required');

  const update: any = {};
  for (const k of WRITABLE) {
    if (!(k in body)) continue;
    if (k === 'capabilities' || k === 'workingDays') {
      update[k] = Array.isArray(body[k]) ? JSON.stringify(body[k]) : body[k];
    } else {
      update[k] = body[k];
    }
  }

  const updated = await db.phoneNumber.update({ where: { id }, data: update });
  await emitEvent({
    type: 'phone_number.updated',
    companyId: updated.companyId || ctx.companyId,
    userId: ctx.userId,
    resource: 'phone_number',
    resourceId: id,
    title: 'Phone number updated',
    description: `Number ${updated.number} was updated`,
    metadata: { fields: Object.keys(update) },
  });

  return ok({ number: serialize(updated) });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin && !['company_owner', 'admin', 'manager'].includes(ctx.role)) {
    return forbidden('manager role required');
  }

  const { id } = await params;
  const existing = await loadScoped(ctx, id);
  if (!existing) return notFound('phone number not found');

  // Soft-release: keep the row for audit, mark as released
  const released = await db.phoneNumber.update({
    where: { id },
    data: {
      status: 'released',
      releasedAt: new Date(),
      companyId: ctx.isSuperAdmin ? existing.companyId : null, // unassign if super_admin
    },
  });

  await emitEvent({
    type: 'phone_number.released',
    companyId: existing.companyId || ctx.companyId,
    userId: ctx.userId,
    resource: 'phone_number',
    resourceId: id,
    title: 'Phone number released',
    description: `Number ${existing.number} was released`,
    metadata: {},
  });

  return ok({ released: true, id, number: serialize(released) });
}
