/**
 * GET /api/v1/supervisor/agents
 *
 * List all agent statuses in the tenant. Supervisor (manager role+) only.
 *
 * Returns each agent's:
 *   - userId, email, name, role
 *   - status, statusChangedAt, currentCallId
 *   - callsToday, avgHandleTimeSec
 *
 * Plus aggregate queue stats (how many agents are in each status).
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, ok } from '@/lib/v1-middleware';
import { hasPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  // supervisor = manager role and above
  if (!ctx.isSuperAdmin && !hasPermission(ctx.role, 'manager')) {
    return forbidden('manager role required (supervisor access)');
  }

  const statuses = await db.agentStatus.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { statusChangedAt: 'desc' },
  });

  // Enrich with user info
  const userIds = statuses.map((s) => s.userId);
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, name: true, avatar: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const companyUsers = await db.companyUser.findMany({
    where: { companyId: ctx.companyId, userId: { in: userIds } },
    select: { userId: true, role: true },
  });
  const roleMap = new Map(companyUsers.map((cu) => [cu.userId, cu.role]));

  // Aggregate stats
  const statusCounts: Record<string, number> = {};
  for (const s of statuses) {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  }

  // Active queues for this tenant
  const queues = await db.callQueue.findMany({
    where: { companyId: ctx.companyId, status: 'active' },
    select: { id: true, name: true, maxSize: true, _count: { select: { agentIds: true } } },
  });

  // Active calls count
  const activeCalls = await db.call.count({
    where: { companyId: ctx.companyId, status: { in: ['active', 'hold', 'transfer'] } },
  });

  return ok({
    agents: statuses.map((s) => {
      const u = userMap.get(s.userId);
      return {
        userId: s.userId,
        email: u?.email || null,
        name: u?.name || null,
        avatar: u?.avatar || null,
        role: roleMap.get(s.userId) || null,
        status: s.status,
        statusChangedAt: s.statusChangedAt.toISOString(),
        currentCallId: s.currentCallId,
        callsToday: s.callsToday,
        avgHandleTimeSec: s.avgHandleTimeSec,
        breakEndsAt: s.breakEndsAt?.toISOString() || null,
      };
    }),
    summary: {
      total: statuses.length,
      available: statusCounts['available'] || 0,
      busy: statusCounts['busy'] || 0,
      onBreak: (statusCounts['break'] || 0) + (statusCounts['lunch'] || 0) + (statusCounts['training'] || 0),
      offline: statusCounts['offline'] || 0,
      activeCalls,
    },
    queues: queues.map((q) => ({
      id: q.id,
      name: q.name,
      maxSize: q.maxSize,
    })),
  });
}
