/**
 * GET/POST /api/v1/outbound-campaigns
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const where: any = { companyId: ctx.companyId };
  if (status) where.status = status;

  const campaigns = await db.outboundCampaign.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { calls: true } } },
  });
  return ok({ campaigns });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.name) return badRequest('name is required');

  const campaign = await db.outboundCampaign.create({
    data: {
      companyId: ctx.companyId,
      name: body.name,
      description: body.description || null,
      script: body.script || '',
      agentId: body.agentId || null,
      contactListId: body.contactListId || null,
      startAt: body.startAt ? new Date(body.startAt) : null,
      endAt: body.endAt ? new Date(body.endAt) : null,
      timezone: body.timezone || 'Asia/Dhaka',
      dncSuppression: body.dncSuppression ?? true,
      consentRequired: body.consentRequired ?? true,
      maxAttemptsPerContact: body.maxAttemptsPerContact || 3,
      retryDelayHours: body.retryDelayHours || 24,
      status: 'draft',
      createdBy: ctx.userId,
    },
  });

  await emitEvent({
    type: 'campaign.created',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'outbound_campaign',
    resourceId: campaign.id,
    metadata: { name: body.name },
  });

  return ok(campaign);
}
