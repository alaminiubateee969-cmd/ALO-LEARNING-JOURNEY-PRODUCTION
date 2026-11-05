/**
 * GET /api/v1/admin/ai-models/audit
 *
 * Returns recent AgentExecutionLog entries — model, latency, tokens, cost,
 * errors, discarded reasons. Default = last 100 entries.
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
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);
  const agentType = url.searchParams.get('agentType');
  const providerSlug = url.searchParams.get('provider');

  const where: any = { companyId: ctx.companyId };
  if (agentType) where.agentType = agentType;
  if (providerSlug) where.providerSlug = providerSlug;

  const logs = await db.agentExecutionLog.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  return ok({
    count: logs.length,
    logs: logs.map((l) => ({
      id: l.id,
      agentType: l.agentType,
      provider: l.providerSlug,
      model: l.modelName,
      promptTokens: l.promptTokens,
      completionTokens: l.completionTokens,
      totalTokens: l.totalTokens,
      estimatedCostUsd: l.estimatedCostUsd,
      latencyMs: l.latencyMs,
      success: l.success,
      error: l.errorMessage,
      discardedReason: l.discardedReason,
      usedFallback: l.usedFallback,
      piiRedactions: l.piiRedactionCount,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}
