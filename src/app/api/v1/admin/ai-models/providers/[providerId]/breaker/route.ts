/**
 * POST /api/v1/admin/ai-models/providers/{providerId}/breaker
 *
 * Manually reset a provider's circuit breaker (closes it regardless of
 * current state). Useful when admin has fixed the underlying issue
 * (rotated API key, fixed network, etc.) and wants to clear the breaker.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, ok, notFound } from '@/lib/v1-middleware';
import { resetBreaker, getBreakerState } from '@/lib/circuit-breaker';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ providerId: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const { providerId } = await params;
  const provider = await db.aiModelProvider.findUnique({ where: { id: providerId } });
  if (!provider) return notFound('provider not found');

  await resetBreaker(providerId);
  const state = await getBreakerState(providerId, provider.slug);
  return ok({ provider: provider.slug, breaker: state });
}
