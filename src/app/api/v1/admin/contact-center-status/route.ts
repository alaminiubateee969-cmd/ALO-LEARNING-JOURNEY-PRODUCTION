/**
 * GET /api/v1/admin/contact-center-status
 *
 * Super-admin overview of the human contact center:
 *   - Agent statuses across all tenants
 *   - Active call queues + their backlog
 *   - Recent supervisor actions (last 24h)
 *   - Shared inbox message distribution
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, ok } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const since24h = new Date(Date.now() - 24 * 3600_000);

  const [
    agentStatuses,
    statusCountsRaw,
    queues,
    supervisorActions,
    inboxByStatus,
    activeCalls,
  ] = await Promise.all([
    db.agentStatus.findMany({
      orderBy: { statusChangedAt: 'desc' },
      take: 500,
      include: { user: { select: { id: true, email: true, name: true } } },
    }),
    db.agentStatus.groupBy({
      by: ['status'],
      _count: true,
    }),
    db.callQueue.findMany({
      where: { status: 'active' },
      take: 200,
    }),
    db.supervisorAction.findMany({
      where: { timestamp: { gte: since24h } },
      orderBy: { timestamp: 'desc' },
      take: 100,
      include: { supervisor: { select: { id: true, email: true, name: true } } },
    }),
    db.sharedInboxMessage.groupBy({
      by: ['status'],
      _count: true,
    }),
    db.call.count({
      where: { status: { in: ['active', 'hold', 'transfer'] } },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const s of statusCountsRaw) statusCounts[s.status] = s._count;

  const inboxCounts: Record<string, number> = {};
  for (const s of inboxByStatus) inboxCounts[s.status] = s._count;

  return ok({
    summary: {
      totalAgents: agentStatuses.length,
      statusCounts,
      activeCalls,
      activeQueues: queues.length,
    },
    agents: agentStatuses.map((a) => ({
      userId: a.userId,
      email: a.user?.email || null,
      name: a.user?.name || null,
      companyId: a.companyId,
      status: a.status,
      statusChangedAt: a.statusChangedAt.toISOString(),
      currentCallId: a.currentCallId,
      callsToday: a.callsToday,
      avgHandleTimeSec: a.avgHandleTimeSec,
    })),
    queues: queues.map((q) => ({
      id: q.id,
      companyId: q.companyId,
      name: q.name,
      maxSize: q.maxSize,
      maxWaitSec: q.maxWaitSec,
      activeCallCount: (q as any)._count?.calls ?? 0,
    })),
    supervisorActions24h: supervisorActions.map((a) => ({
      id: a.id,
      companyId: a.companyId,
      actionType: a.actionType,
      callId: a.callId,
      agentUserId: a.agentUserId,
      supervisor: {
        userId: a.supervisor.id,
        email: a.supervisor.email,
        name: a.supervisor.name,
      },
      reason: a.reason,
      outcome: a.outcome,
      timestamp: a.timestamp.toISOString(),
    })),
    sharedInbox: {
      statusCounts: inboxCounts,
      totalMessages: Object.values(inboxCounts).reduce((a, b) => a + b, 0),
    },
  });
}
