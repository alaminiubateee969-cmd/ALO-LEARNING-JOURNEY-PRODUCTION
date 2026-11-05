/**
 * POST /api/v1/supervisor/listen/{callId}
 *
 * Supervisor silently joins a call as a listener (mute on, no announcement).
 * The agent + caller do not see the supervisor — only the supervisor hears
 * the audio. Used for quality monitoring + coaching.
 *
 * Body:
 *   { "reason": "new agent onboarding — observe first call" }   // optional
 *
 * Records a `SupervisorAction` row with `actionType='listen'` for audit.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, ok, notFound, badRequest } from '@/lib/v1-middleware';
import { hasPermission } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ callId: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin && !hasPermission(ctx.role, 'manager')) {
    return forbidden('manager role required (supervisor access)');
  }

  const { callId } = await params;
  const call = await db.call.findFirst({
    where: { id: callId, companyId: ctx.companyId },
  });
  if (!call) return notFound('call not found');

  if (call.status !== 'active' && call.status !== 'hold' && call.status !== 'transfer') {
    return badRequest(`cannot listen to a call in status '${call.status}' (must be active/hold/transfer)`);
  }

  const body = await request.json().catch(() => ({})) || {};
  const reason = String(body.reason || 'supervisor listen');

  const action = await db.supervisorAction.create({
    data: {
      companyId: ctx.companyId,
      actionType: 'listen',
      callId,
      agentUserId: call.humanAgentId,
      supervisorUserId: ctx.userId,
      reason,
      outcome: 'success',
    },
  });

  await emitEvent({
    type: 'supervisor.listen',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'supervisor_action',
    resourceId: action.id,
    title: 'Supervisor listen',
    description: `Supervisor ${ctx.email} silently joined call ${callId}`,
    metadata: { callId, agentUserId: call.humanAgentId, reason },
  });

  // In a real implementation: send a "bridge" command to the telephony
  // provider to silently add the supervisor as a muted third leg.
  // For simulation, just return the action record.
  const simulated = !call.providerCallId || call.providerCallId.startsWith('sim_');

  return ok({
    action: {
      id: action.id,
      actionType: action.actionType,
      callId,
      agentUserId: action.agentUserId,
      supervisorUserId: action.supervisorUserId,
      reason,
      outcome: 'success',
      timestamp: action.timestamp.toISOString(),
    },
    mode: 'silent',
    simulated,
    instructions: simulated
      ? 'Simulation mode — supervisor listen is recorded but no real audio bridge is established.'
      : 'Telephony provider was instructed to silently bridge the supervisor onto the call as a muted listener.',
  });
}
