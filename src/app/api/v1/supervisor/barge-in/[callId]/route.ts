/**
 * POST /api/v1/supervisor/barge-in/{callId}
 *
 * Supervisor joins the conversation as a full participant — both the caller
 * and the agent can now hear + speak with the supervisor. Used for de-escalation,
 * taking over a difficult call, or confirming a critical decision.
 *
 * Body:
 *   { "reason": "caller is irate — taking over" }   // optional but recommended
 *
 * Records a `SupervisorAction` row with `actionType='barge_in'` for audit.
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
    return badRequest(`cannot barge in on a call in status '${call.status}'`);
  }

  const body = await request.json().catch(() => ({})) || {};
  const reason = String(body.reason || 'supervisor barge-in');

  const action = await db.supervisorAction.create({
    data: {
      companyId: ctx.companyId,
      actionType: 'barge_in',
      callId,
      agentUserId: call.humanAgentId,
      supervisorUserId: ctx.userId,
      reason,
      outcome: 'success',
    },
  });

  await emitEvent({
    type: 'supervisor.barge_in',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'supervisor_action',
    resourceId: action.id,
    title: 'Supervisor barge-in',
    description: `Supervisor ${ctx.email} barged into call ${callId} as a full participant`,
    metadata: { callId, agentUserId: call.humanAgentId, reason },
  });

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
    mode: 'full_participant',
    simulated,
    instructions: simulated
      ? 'Simulation mode — supervisor barge-in is recorded but no real audio channel is opened.'
      : 'Telephony provider was instructed to bridge the supervisor into the call as a full (unmuted) participant.',
  });
}
