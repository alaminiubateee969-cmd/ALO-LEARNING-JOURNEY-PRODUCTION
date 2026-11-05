/**
 * GET /api/v1/admin/voice-foundation
 * GET /api/v1/admin/telephony-status
 * GET /api/v1/admin/voice-engine-status
 * GET /api/v1/admin/contact-center-status
 *
 * Super admin only — returns aggregate status across all tenants.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, ok } from '@/lib/v1-middleware';
import { getTelephonyProviderStatus } from '@/lib/telephony-adapter';
import { getTtsProviderStatus } from '@/lib/voice-engine';
import { getAsrProviderStatus } from '@/lib/asr-engine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const [voiceAgents, calls, phoneNumbers, customers, campaigns, knowledgeBases, subscriptions] = await Promise.all([
    db.voiceAgent.count(),
    db.call.count(),
    db.phoneNumber.count(),
    db.customer.count(),
    db.outboundCampaign.count(),
    db.knowledgeBase.count(),
    db.tenantSubscription.count(),
  ]);

  // Recent calls + agent statuses
  const [recentCalls, agentStatuses] = await Promise.all([
    db.call.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { company: { select: { name: true } } } }),
    db.agentStatus.findMany({ where: { status: { not: 'offline' } }, take: 50, include: { user: { select: { name: true, email: true } }, company: { select: { name: true } } } }),
  ]);

  return ok({
    summary: {
      voiceAgents,
      calls,
      phoneNumbers,
      customers,
      campaigns,
      knowledgeBases,
      subscriptions,
      activeAgents: agentStatuses.length,
    },
    telephony: getTelephonyProviderStatus(),
    voiceEngine: getTtsProviderStatus(),
    asr: getAsrProviderStatus(),
    recentCalls: recentCalls.map((c) => ({
      id: c.id,
      direction: c.direction,
      from: c.fromNumber,
      to: c.toNumber,
      status: c.status,
      duration: c.durationSec,
      tenant: c.company.name,
      startedAt: c.startedAt.toISOString(),
    })),
    activeAgents: agentStatuses.map((a) => ({
      userId: a.userId,
      userName: a.user?.name,
      userEmail: a.user?.email,
      status: a.status,
      tenant: a.company?.name,
      callsToday: a.callsToday,
      avgHandleTimeSec: a.avgHandleTimeSec,
    })),
  });
}
