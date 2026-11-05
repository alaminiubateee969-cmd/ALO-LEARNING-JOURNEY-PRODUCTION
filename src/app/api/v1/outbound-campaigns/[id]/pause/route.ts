/**
 * POST /api/v1/outbound-campaigns/{id}/pause — pause a running campaign.
 *
 * The background worker will skip CampaignCall rows for paused campaigns.
 * Resume by calling /launch again (which resets status='running').
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
  const campaign = await db.outboundCampaign.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!campaign) return notFound('campaign not found');

  if (campaign.status !== 'running') {
    return badRequest(`cannot pause a campaign in status '${campaign.status}' (must be 'running')`);
  }

  const updated = await db.outboundCampaign.update({
    where: { id },
    data: { status: 'paused' },
  });

  await emitEvent({
    type: 'outbound_campaign.paused',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'outbound_campaign',
    resourceId: id,
    title: 'Campaign paused',
    description: `Campaign "${campaign.name}" was paused`,
    metadata: { pausedAt: new Date().toISOString() },
  });

  return ok({
    campaign: { id: updated.id, status: updated.status },
  });
}
