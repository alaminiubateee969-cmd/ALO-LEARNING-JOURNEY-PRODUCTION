/**
 * GET  /api/v1/admin/ai-models/after-hours  — get the company's after-hours rule
 * PUT  /api/v1/admin/ai-models/after-hours  — upsert the after-hours rule
 *
 * Body for PUT:
 *   { "timezone": "Asia/Dhaka", "workingDays": [1,2,3,4,5],
 *     "workingStart": "09:00", "workingEnd": "18:00",
 *     "holidays": [{ "date": "2025-12-16", "name": "Victory Day" }],
 *     "afterHoursPolicy": "auto_reply_with_disclaimer",
 *     "afterHoursDisclaimer": "..." }
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, badRequest, ok } from '@/lib/v1-middleware';
import { evaluateAfterHours } from '@/lib/after-hours';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const rule = await db.afterHoursRule.findUnique({ where: { companyId: ctx.companyId } });
  if (!rule) {
    // Return defaults so the UI has something to display
    return ok({
      rule: null,
      defaults: {
        timezone: 'Asia/Dhaka',
        workingDays: [1, 2, 3, 4, 5],
        workingStart: '09:00',
        workingEnd: '18:00',
        holidays: [],
        afterHoursPolicy: 'auto_reply_with_disclaimer',
      },
      evaluation: await evaluateAfterHours(ctx.companyId),
    });
  }

  return ok({
    rule: {
      id: rule.id,
      timezone: rule.timezone,
      workingDays: JSON.parse(rule.workingDays),
      workingStart: rule.workingStart,
      workingEnd: rule.workingEnd,
      holidays: JSON.parse(rule.holidays),
      afterHoursPolicy: rule.afterHoursPolicy,
      afterHoursDisclaimer: rule.afterHoursDisclaimer,
    },
    evaluation: await evaluateAfterHours(ctx.companyId),
  });
}

export async function PUT(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const body = await request.json().catch(() => null);
  if (!body) return badRequest('body required');

  const validPolicies = ['queue', 'auto_reply_with_disclaimer', 'emergency_only'];
  if (body.afterHoursPolicy && !validPolicies.includes(body.afterHoursPolicy)) {
    return badRequest(`afterHoursPolicy must be one of: ${validPolicies.join(', ')}`);
  }

  const rule = await db.afterHoursRule.upsert({
    where: { companyId: ctx.companyId },
    update: {
      timezone: body.timezone || 'Asia/Dhaka',
      workingDays: JSON.stringify(body.workingDays || [1, 2, 3, 4, 5]),
      workingStart: body.workingStart || '09:00',
      workingEnd: body.workingEnd || '18:00',
      holidays: JSON.stringify(body.holidays || []),
      afterHoursPolicy: body.afterHoursPolicy || 'auto_reply_with_disclaimer',
      afterHoursDisclaimer: body.afterHoursDisclaimer || null,
    },
    create: {
      companyId: ctx.companyId,
      timezone: body.timezone || 'Asia/Dhaka',
      workingDays: JSON.stringify(body.workingDays || [1, 2, 3, 4, 5]),
      workingStart: body.workingStart || '09:00',
      workingEnd: body.workingEnd || '18:00',
      holidays: JSON.stringify(body.holidays || []),
      afterHoursPolicy: body.afterHoursPolicy || 'auto_reply_with_disclaimer',
      afterHoursDisclaimer: body.afterHoursDisclaimer || null,
    },
  });

  return ok({
    id: rule.id,
    timezone: rule.timezone,
    afterHoursPolicy: rule.afterHoursPolicy,
    evaluation: await evaluateAfterHours(ctx.companyId),
  });
}
