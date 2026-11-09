/**
 * GET  /api/v1/voice-agents — list voice agents for the current tenant
 * POST /api/v1/voice-agents — create a new voice agent config
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const agents = await db.voiceAgent.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { createdAt: 'desc' },
  });

  return ok({
    agents: agents.map((a) => ({
      ...a,
      allowlistedTools: JSON.parse(a.allowlistedTools),
      workingDays: JSON.parse(a.workingDays),
    })),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.name) return badRequest('name is required');

  const agent = await db.voiceAgent.create({
    data: {
      companyId: ctx.companyId,
      name: body.name,
      description: body.description || null,
      purpose: body.purpose || 'support',
      language: body.language || 'bn-BD',
      voiceId: body.voiceId || null,
      speakingStyle: body.speakingStyle || 'professional',
      personality: body.personality || null,
      systemPrompt: body.systemPrompt || '',
      greetingMessage: body.greetingMessage || null,
      fallbackResponse: body.fallbackResponse || null,
      maxCallDurationSec: body.maxCallDurationSec || 300,
      workingHoursStart: body.workingHoursStart || '09:00',
      workingHoursEnd: body.workingHoursEnd || '18:00',
      workingDays: JSON.stringify(body.workingDays || [1, 2, 3, 4, 5]),
      knowledgeBaseId: body.knowledgeBaseId || null,
      crmEnabled: body.crmEnabled ?? true,
      allowlistedTools: JSON.stringify(body.allowlistedTools || ['crm_lookup_lead', 'crm_create_lead']),
      approvalMode: body.approvalMode || 'suspend',
      status: 'draft',
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
  });

  await emitEvent({
    type: 'voice_agent.created',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'voice_agent',
    resourceId: agent.id,
    metadata: { name: agent.name, language: agent.language },
  });

  return ok(agent);
}
