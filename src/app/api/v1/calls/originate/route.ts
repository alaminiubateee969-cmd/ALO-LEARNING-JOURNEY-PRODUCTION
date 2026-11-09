/**
 * POST /api/v1/calls/originate
 * GET  /api/v1/calls/[id]
 * POST /api/v1/calls/[id]/{answer,hold,resume,transfer,hangup,start-recording}
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, notFound, ok } from '@/lib/v1-middleware';
import { originateCall, transitionCall, transferCall, startRecording } from '@/lib/telephony-adapter';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.to || !body?.from) return badRequest('to and from are required');

  const result = await originateCall({
    companyId: ctx.companyId,
    direction: body.direction || 'outbound',
    from: body.from,
    to: body.to,
    fromName: body.fromName,
    toName: body.toName,
    agentId: body.agentId,
    humanAgentId: body.humanAgentId,
    phoneNumberId: body.phoneNumberId,
    queueId: body.queueId,
    ringGroupId: body.ringGroupId,
    recordingConsentId: body.recordingConsentId,
    metadata: { userId: ctx.userId, ...body.metadata },
  });

  return ok(result);
}
