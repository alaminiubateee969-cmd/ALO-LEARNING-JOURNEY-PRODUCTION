/**
 * POST /api/v1/supervisor/whisper/{callId}
 *
 * Supervisor whispers to the human agent only — the caller cannot hear the
 * supervisor. Used for live coaching ("ask for the order", "verify the
 * account number again").
 *
 * Body:
 *   { "reason": "verify account number before transferring" }   // optional
 *
 * Records a `SupervisorAction` row with `actionType='whisper'` for audit.
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

  if (!call.humanAgentId) {
    return badRequest('cannot whisper — no human agent on this call (AI-only?)');
  }
  if (call.status !== 'active' && call.status !== 'hold') {
    return badRequest(`cannot whisper on a call in status '${call.status}' (must be active or hold)`);
  }

  const body = await request.json().catch(() => ({})) || {};
  const reason = String(body.reason || 'supervisor whisper');

  const action = await db.supervisorAction.create({
    data: {
      companyId: ctx.companyId,
      actionType: 'whisper',
      callId,
      agentUserId: call.humanAgentId,
      supervisorUserId: ctx.userId,
      reason,
      outcome: 'success',
    },
  });

  await emitEvent({
    type: 'supervisor.whisper',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'supervisor_action',
    resourceId: action.id,
    title: 'Supervisor whisper',
    description: `Supervisor ${ctx.email} whispered to agent ${call.humanAgentId} on call ${callId}`,
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
    mode: 'whisper_to_agent_only',
    simulated,
    instructions: simulated
      ? 'Simulation mode — supervisor whisper is recorded but no real audio channel is opened.'
      : 'Telephony provider was instructed to open a one-way audio channel from supervisor to agent only.',
  });
}
