/**
 * GET /api/v1/billing/usage — usage summary for the current tenant
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, ok } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const days = 30;
  const since = new Date(Date.now() - days * 86400_000);
  const sinceDay = since.toISOString().slice(0, 10);

  const [callUsage, ttsUsage, asrUsage, subscription, credits] = await Promise.all([
    db.callUsageDaily.findMany({ where: { companyId: ctx.companyId, day: { gte: sinceDay } }, orderBy: { day: 'desc' } }),
    db.ttsUsageDaily.findMany({ where: { companyId: ctx.companyId, day: { gte: sinceDay } }, orderBy: { day: 'desc' } }),
    db.asrUsageDaily.findMany({ where: { companyId: ctx.companyId, day: { gte: sinceDay } }, orderBy: { day: 'desc' } }),
    db.tenantSubscription.findUnique({ where: { companyId: ctx.companyId }, include: { plan: true } }),
    db.usageCredit.findMany({ where: { companyId: ctx.companyId } }),
  ]);

  // Aggregate totals
  const callTotals = callUsage.reduce((acc, u) => ({
    calls: acc.calls + u.totalCalls,
    aiHandled: acc.aiHandled + u.aiHandledCalls,
    humanHandled: acc.humanHandled + u.humanHandledCalls,
    duration: acc.duration + u.totalDurationSec,
    recordingMb: acc.recordingMb + u.recordingStorageMb,
  }), { calls: 0, aiHandled: 0, humanHandled: 0, duration: 0, recordingMb: 0 });

  const ttsTotals = ttsUsage.reduce((acc, u) => ({
    chars: acc.chars + u.charactersSynthesized,
    audioSec: acc.audioSec + u.audioSecondsGenerated,
    cost: acc.cost + u.costEstimateUsd,
  }), { chars: 0, audioSec: 0, cost: 0 });

  const asrTotals = asrUsage.reduce((acc, u) => ({
    audioSec: acc.audioSec + u.audioSecondsProcessed,
    chars: acc.chars + u.charactersTranscribed,
    cost: acc.cost + u.costEstimateUsd,
  }), { audioSec: 0, chars: 0, cost: 0 });

  return ok({
    period: { days, since: since.toISOString() },
    subscription: subscription ? {
      plan: subscription.plan.displayName,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      endsAt: subscription.endsAt?.toISOString() || null,
      isTrial: subscription.isTrial,
      trialEndsAt: subscription.trialEndsAt?.toISOString() || null,
    } : null,
    credits: credits.map((c) => ({ type: c.creditType, balance: c.balance, autoRechargeThreshold: c.autoRechargeThreshold, autoRechargeAmount: c.autoRechargeAmount })),
    totals: {
      calls: callTotals,
      tts: ttsTotals,
      asr: asrTotals,
      estimatedTotalCostUsd: ttsTotals.cost + asrTotals.cost, // free providers contribute 0
    },
    perDay: {
      calls: callUsage,
      tts: ttsUsage,
      asr: asrUsage,
    },
  });
}
