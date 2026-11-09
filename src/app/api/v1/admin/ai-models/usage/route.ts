/**
 * GET /api/v1/admin/ai-models/usage
 *
 * Returns per-agent-per-day usage + cost for the last N days (default 30).
 * Used by the admin UI's usage dashboard.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, ok } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const url = new URL(request.url);
  const days = Math.min(parseInt(url.searchParams.get('days') || '30', 10), 90);
  const since = new Date(Date.now() - days * 86400_000);
  const sinceDay = since.toISOString().slice(0, 10);

  const [usage, executionLogs, breakerStates] = await Promise.all([
    db.agentUsageDaily.findMany({
      where: { companyId: ctx.companyId, day: { gte: sinceDay } },
      orderBy: { day: 'desc' },
    }),
    db.agentExecutionLog.count({
      where: { companyId: ctx.companyId, createdAt: { gte: since } },
    }),
    db.circuitBreakerState.findMany({ include: { provider: true } }),
  ]);

  // Aggregate per-agent totals
  const perAgent: Record<string, { requests: number; tokens: number; cost: number; failures: number; fallbacks: number }> = {};
  for (const u of usage) {
    if (!perAgent[u.agentType]) perAgent[u.agentType] = { requests: 0, tokens: 0, cost: 0, failures: 0, fallbacks: 0 };
    perAgent[u.agentType].requests += u.requestCount;
    perAgent[u.agentType].tokens += u.totalTokens;
    perAgent[u.agentType].cost += u.estimatedCostUsd;
    perAgent[u.agentType].failures += u.failureCount;
    perAgent[u.agentType].fallbacks += u.fallbackCount;
  }

  return ok({
    since: since.toISOString(),
    days,
    totalLogCount: executionLogs,
    perAgent,
    perDay: usage.map((u) => ({
      day: u.day,
      agentType: u.agentType,
      requests: u.requestCount,
      tokens: u.totalTokens,
      costUsd: u.estimatedCostUsd,
      failures: u.failureCount,
      fallbacks: u.fallbackCount,
    })),
    circuitBreakers: breakerStates.map((b) => ({
      provider: b.provider.slug,
      state: b.state,
      consecutiveFailures: b.consecutiveFailures,
      tripCount: b.tripCount,
      lastFailureAt: b.lastFailureAt?.toISOString() || null,
      lastSuccessAt: b.lastSuccessAt?.toISOString() || null,
      lastFailureReason: b.lastFailureReason,
    })),
  });
}
