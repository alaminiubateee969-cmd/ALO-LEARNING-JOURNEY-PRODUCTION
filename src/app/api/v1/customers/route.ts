/**
 * GET/POST /api/v1/customers
 * GET/PATCH/DELETE /api/v1/customers/[id]
 * GET /api/v1/customers/[id]/timeline
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, notFound, ok } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('q');

  const where: any = { companyId: ctx.companyId };
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
    ];
  }

  const customers = await db.customer.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return ok({ customers });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.name) return badRequest('name is required');

  const customer = await db.customer.create({
    data: {
      companyId: ctx.companyId,
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      alternatePhone: body.alternatePhone || null,
      customerCompany: body.customerCompany || null,
      jobTitle: body.jobTitle || null,
      country: body.country || null,
      city: body.city || null,
      status: body.status || 'lead',
      tags: JSON.stringify(body.tags || []),
      assignedAgentId: body.assignedAgentId || null,
      consentMarketingSms: body.consentMarketingSms || false,
      consentMarketingEmail: body.consentMarketingEmail || false,
      consentCallRecording: body.consentCallRecording || false,
      createdBy: ctx.userId,
    },
  });

  return ok(customer);
}
