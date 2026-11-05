/**
 * GET /api/v1/admin/telephony-status
 *
 * Super-admin overview of the telephony layer:
 *   - Active provider (FreeSWITCH / Twilio / Telnyx / simulation)
 *   - Per-provider configuration status (configured? masked credential?)
 *   - All phone numbers across all tenants (with status counts)
 *   - Recent calls (last 24h) + status distribution
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, ok } from '@/lib/v1-middleware';
import { getTelephonyProviderStatus, getActiveProvider, isTelephonyConfigured } from '@/lib/telephony-adapter';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const since24h = new Date(Date.now() - 24 * 3600_000);

  const [
    providers,
    phoneNumbers,
    totalNumbers,
    statusCountsRaw,
    recentCalls,
  ] = await Promise.all([
    Promise.resolve(getTelephonyProviderStatus()),
    db.phoneNumber.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { _count: { select: { calls: true } } },
    }),
    db.phoneNumber.count(),
    db.phoneNumber.groupBy({
      by: ['status'],
      _count: true,
    }),
    db.call.findMany({
      where: { createdAt: { gte: since24h } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        companyId: true,
        direction: true,
        status: true,
        fromNumber: true,
        toNumber: true,
        durationSec: true,
        createdAt: true,
      },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const s of statusCountsRaw) {
    statusCounts[s.status] = s._count;
  }

  return ok({
    activeProvider: getActiveProvider(),
    isConfigured: isTelephonyConfigured(),
    deliveryStatus: isTelephonyConfigured() ? 'live' : 'simulation',
    providers,
    phoneNumbers: {
      total: totalNumbers,
      statusCounts,
      sample: phoneNumbers.map((p) => ({
        id: p.id,
        number: p.number,
        provider: p.provider,
        companyId: p.companyId,
        country: p.country,
        status: p.status,
        destinationType: p.destinationType,
        destinationId: p.destinationId,
        callCount: (p as any)._count?.calls ?? 0,
        createdAt: p.createdAt.toISOString(),
      })),
    },
    recentCalls: recentCalls.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}
