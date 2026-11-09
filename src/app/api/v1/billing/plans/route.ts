/**
 * GET/POST /api/v1/billing/plans
 * GET /api/v1/billing/usage
 * POST /api/v1/billing/subscribe
 * GET/POST /api/v1/billing/credits/purchase
 * GET /api/v1/billing/invoices
 * POST /api/v1/billing/payments
 * POST /api/v1/billing/adjustments (super_admin only)
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, badRequest, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const plans = await db.subscriptionPlan.findMany({
    where: { isPublic: true, isActive: true },
    orderBy: { priceMonthly: 'asc' },
  });

  return ok({
    plans: plans.map((p) => ({
      ...p,
      features: JSON.parse(p.features),
    })),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required to create plans');

  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.displayName) return badRequest('name and displayName are required');

  const plan = await db.subscriptionPlan.create({
    data: {
      name: body.name,
      displayName: body.displayName,
      description: body.description || null,
      priceMonthly: body.priceMonthly || 0,
      priceYearly: body.priceYearly || 0,
      maxPhoneNumbers: body.maxPhoneNumbers || 1,
      maxUsers: body.maxUsers || 3,
      maxAiMinutes: body.maxAiMinutes || 100,
      maxTtsCharacters: body.maxTtsCharacters || 10000,
      maxAsrSeconds: body.maxAsrSeconds || 3600,
      maxRecordingStorageMb: body.maxRecordingStorageMb || 500,
      maxOutboundCallsPerDay: body.maxOutboundCallsPerDay || 50,
      features: JSON.stringify(body.features || []),
      trialDays: body.trialDays || 0,
    },
  });

  return ok(plan);
}
