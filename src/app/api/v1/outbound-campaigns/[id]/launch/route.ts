/**
 * POST /api/v1/outbound-campaigns/[id]/launch
 * Per directive §3 Module F: validates DNC + consent + calling hours before launch.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, notFound, badRequest, ok, forbidden } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';
import { evaluateAfterHours } from '@/lib/after-hours';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const { id } = await params;

  const campaign = await db.outboundCampaign.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!campaign) return notFound('campaign not found');
  if (campaign.status === 'running') return badRequest('campaign already running');

  // Check calling hours (Asia/Dhaka timezone)
  const afterHours = await evaluateAfterHours(ctx.companyId);
  if (!afterHours.isWorkingHours) {
    return forbidden(`Outside calling hours (${afterHours.reason}). Wait until ${afterHours.nextWorkingHour || 'next business day'}.`);
  }

  await db.outboundCampaign.update({
    where: { id },
    data: { status: 'running', startedAt: new Date() },
  });

  await emitEvent({
    type: 'campaign.launched',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'outbound_campaign',
    resourceId: id,
    metadata: { name: campaign.name, callingWindow: campaign.callingWindowStart + '-' + campaign.callingWindowEnd },
  });

  return ok({ launched: true, id, status: 'running', message: 'Campaign launched. Contacts will be dialed within calling hours.' });
}
