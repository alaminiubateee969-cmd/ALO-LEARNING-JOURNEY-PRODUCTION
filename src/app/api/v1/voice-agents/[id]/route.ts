/**
 * GET/PATCH/DELETE /api/v1/voice-agents/[id]
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, notFound, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const { id } = await params;
  const agent = await db.voiceAgent.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!agent) return notFound('voice agent not found');
  return ok({ ...agent, allowlistedTools: JSON.parse(agent.allowlistedTools), workingDays: JSON.parse(agent.workingDays) });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const { id } = await params;
  const existing = await db.voiceAgent.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!existing) return notFound('voice agent not found');

  const body = await request.json().catch(() => null);
  if (!body) return badRequest('body required');

  const update: any = { updatedBy: ctx.userId };
  for (const k of ['name', 'description', 'purpose', 'language', 'voiceId', 'speakingStyle', 'personality', 'systemPrompt', 'greetingMessage', 'fallbackResponse', 'maxCallDurationSec', 'workingHoursStart', 'workingHoursEnd', 'knowledgeBaseId', 'crmEnabled', 'approvalMode', 'status']) {
    if (k in body) update[k] = body[k];
  }
  if (Array.isArray(body.allowlistedTools)) update.allowlistedTools = JSON.stringify(body.allowlistedTools);
  if (Array.isArray(body.workingDays)) update.workingDays = JSON.stringify(body.workingDays);

  const updated = await db.voiceAgent.update({ where: { id }, data: update });
  await emitEvent({ type: 'voice_agent.updated', companyId: ctx.companyId, userId: ctx.userId, resource: 'voice_agent', resourceId: id, metadata: update });
  return ok(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const { id } = await params;
  const existing = await db.voiceAgent.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!existing) return notFound('voice agent not found');
  await db.voiceAgent.delete({ where: { id } });
  await emitEvent({ type: 'voice_agent.deleted', companyId: ctx.companyId, userId: ctx.userId, resource: 'voice_agent', resourceId: id });
  return ok({ deleted: true, id });
}
