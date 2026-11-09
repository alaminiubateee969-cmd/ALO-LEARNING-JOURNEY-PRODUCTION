/**
 * POST /api/v1/billing/subscribe
 * GET /api/v1/billing/credits
 * POST /api/v1/billing/credits/purchase
 * GET /api/v1/billing/invoices
 * POST /api/v1/billing/payments
 * POST /api/v1/billing/adjustments (super_admin only)
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, badRequest, ok, notFound } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.planId) return badRequest('planId is required');

  const plan = await db.subscriptionPlan.findUnique({ where: { id: body.planId } });
  if (!plan) return notFound('plan not found');

  const isTrial = plan.trialDays > 0;
  const startsAt = new Date();
  const endsAt = isTrial ? new Date(Date.now() + plan.trialDays * 86400_000) : null;
  const trialEndsAt = isTrial ? endsAt : null;

  // Upsert subscription (one per tenant)
  const subscription = await db.tenantSubscription.upsert({
    where: { companyId: ctx.companyId },
    update: {
      planId: body.planId,
      billingCycle: body.billingCycle || 'monthly',
      startsAt,
      endsAt,
      isTrial,
      trialEndsAt,
      status: 'active',
    },
    create: {
      companyId: ctx.companyId,
      planId: body.planId,
      billingCycle: body.billingCycle || 'monthly',
      startsAt,
      endsAt,
      isTrial,
      trialEndsAt,
      status: 'active',
    },
    include: { plan: true },
  });

  await emitEvent({
    type: 'subscription.created',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'subscription',
    resourceId: subscription.id,
    metadata: { plan: plan.displayName, isTrial, billingCycle: body.billingCycle || 'monthly' },
  });

  return ok({
    subscription: {
      ...subscription,
      plan: { name: subscription.plan.name, displayName: subscription.plan.displayName },
    },
  });
}
