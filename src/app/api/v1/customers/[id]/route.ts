/**
 * GET    /api/v1/customers/{id}    — fetch one customer
 * PATCH  /api/v1/customers/{id}    — update fields
 * DELETE /api/v1/customers/{id}    — soft-delete (status=churned)
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok, notFound } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

const WRITABLE = [
  'name', 'email', 'phone', 'alternatePhone', 'customerCompany',
  'jobTitle', 'country', 'city', 'status', 'tags', 'assignedAgentId',
  'consentMarketingSms', 'consentMarketingEmail', 'consentCallRecording',
] as const;

function serialize(c: any) {
  return {
    ...c,
    tags: JSON.parse(c.tags || '[]'),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const { id } = await params;
  const c = await db.customer.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!c) return notFound('customer not found');
  return ok({ customer: serialize(c) });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const { id } = await params;
  const existing = await db.customer.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!existing) return notFound('customer not found');

  const body = await request.json().catch(() => null);
  if (!body) return badRequest('body required');

  const update: any = {};
  for (const k of WRITABLE) {
    if (!(k in body)) continue;
    if (k === 'tags') {
      update[k] = Array.isArray(body[k]) ? JSON.stringify(body[k]) : body[k];
    } else {
      update[k] = body[k];
    }
  }

  const updated = await db.customer.update({ where: { id }, data: update });

  await emitEvent({
    type: 'customer.updated',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'customer',
    resourceId: id,
    title: 'Customer updated',
    description: `Customer "${updated.name}" was updated`,
    metadata: { fields: Object.keys(update) },
  });

  return ok({ customer: serialize(updated) });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const { id } = await params;
  const existing = await db.customer.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!existing) return notFound('customer not found');

  // Soft-delete: mark as churned
  const archived = await db.customer.update({
    where: { id },
    data: { status: 'churned' },
  });

  await emitEvent({
    type: 'customer.archived',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'customer',
    resourceId: id,
    title: 'Customer archived',
    description: `Customer "${existing.name}" was archived (status=churned)`,
    metadata: {},
  });

  return ok({ archived: true, id, customer: serialize(archived) });
}
