/**
 * GET    /api/v1/outbound-campaigns/{id}    — fetch a single campaign
 * PATCH  /api/v1/outbound-campaigns/{id}    — update fields
 * DELETE /api/v1/outbound-campaigns/{id}    — soft-delete (status=cancelled)
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, badRequest, ok, notFound } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

const WRITABLE = [
  'name', 'description', 'script', 'agentId', 'contactListId',
  'startAt', 'endAt', 'callingWindowStart', 'callingWindowEnd',
  'callingDays', 'timezone', 'dncSuppression', 'consentRequired',
  'maxAttemptsPerContact', 'retryDelayHours', 'status',
] as const;

function serialize(c: any) {
  return {
    ...c,
    callingDays: JSON.parse(c.callingDays || '[]'),
    startAt: c.startAt?.toISOString() || null,
    endAt: c.endAt?.toISOString() || null,
    startedAt: c.startedAt?.toISOString() || null,
    completedAt: c.completedAt?.toISOString() || null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const { id } = await params;
  const c = await db.outboundCampaign.findFirst({
    where: { id, companyId: ctx.companyId },
    include: { _count: { select: { calls: true } } },
  });
  if (!c) return notFound('campaign not found');
  return ok({ campaign: { ...serialize(c), campaignCallCount: (c as any)._count?.calls ?? 0 } });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin && !['company_owner', 'admin', 'manager'].includes(ctx.role)) {
    return forbidden('manager role required');
  }

  const { id } = await params;
  const existing = await db.outboundCampaign.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!existing) return notFound('campaign not found');

  const body = await request.json().catch(() => null);
  if (!body) return badRequest('body required');

  const update: any = {};
  for (const k of WRITABLE) {
    if (!(k in body)) continue;
    if (k === 'callingDays') {
      update[k] = Array.isArray(body[k]) ? JSON.stringify(body[k]) : body[k];
    } else if (k === 'startAt' || k === 'endAt') {
      update[k] = body[k] ? new Date(body[k]) : null;
    } else {
      update[k] = body[k];
    }
  }

  const updated = await db.outboundCampaign.update({ where: { id }, data: update });

  await emitEvent({
    type: 'outbound_campaign.updated',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'outbound_campaign',
    resourceId: id,
    title: 'Campaign updated',
    description: `Campaign "${updated.name}" was updated`,
    metadata: { fields: Object.keys(update) },
  });

  return ok({ campaign: serialize(updated) });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin && !['company_owner', 'admin', 'manager'].includes(ctx.role)) {
    return forbidden('manager role required');
  }

  const { id } = await params;
  const existing = await db.outboundCampaign.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!existing) return notFound('campaign not found');

  await db.outboundCampaign.update({
    where: { id },
    data: { status: 'cancelled', completedAt: new Date() },
  });

  await emitEvent({
    type: 'outbound_campaign.cancelled',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'outbound_campaign',
    resourceId: id,
    title: 'Campaign cancelled',
    description: `Campaign "${existing.name}" was cancelled`,
    metadata: {},
  });

  return ok({ cancelled: true, id });
}
