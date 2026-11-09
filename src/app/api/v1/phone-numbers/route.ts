/**
 * GET/POST /api/v1/phone-numbers
 * PATCH/DELETE /api/v1/phone-numbers/[id]
 *
 * Per directive §3 Module A: phone number lifecycle (available → assigned → active → released).
 * Real PSTN numbers require authorized telephony connectivity — the route
 * marks new numbers as 'manual' by default unless a provider is configured.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, badRequest, notFound, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const status = url.searchParams.get('status');

  const where: any = {};
  if (status) where.status = status;

  // Super admin sees all; company user sees only their tenant's numbers
  if (!ctx.isSuperAdmin) where.companyId = ctx.companyId;

  const numbers = await db.phoneNumber.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return ok({ phoneNumbers: numbers });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.number) return badRequest('number is required (E.164 format)');

  const number = await db.phoneNumber.create({
    data: {
      number: body.number,
      companyId: body.assignToTenant ? ctx.companyId : null,
      provider: body.provider || 'manual',
      providerNumberId: body.providerNumberId || null,
      country: body.country || 'BD',
      numberType: body.numberType || 'local',
      capabilities: JSON.stringify(body.capabilities || ['voice', 'sms']),
      status: body.assignToTenant ? 'assigned' : 'available',
      assignedAt: body.assignToTenant ? new Date() : null,
      callerIdName: body.callerIdName || null,
      createdBy: ctx.userId,
    },
  });

  await emitEvent({
    type: 'phone_number.provisioned',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'phone_number',
    resourceId: number.id,
    metadata: { number: body.number, provider: body.provider || 'manual' },
  });

  return ok(number);
}
