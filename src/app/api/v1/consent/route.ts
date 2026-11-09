/**
 * POST /api/v1/consent — capture customer consent
 *
 * Per directive §10: consent records must persist who, what, when, how.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind');
  const subjectId = url.searchParams.get('subjectId');

  const where: any = { companyId: ctx.companyId };
  if (kind) where.kind = kind;
  if (subjectId) where.subjectId = subjectId;

  const consents = await db.consent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return ok({ consents });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.subjectId || !body?.kind) {
    return badRequest('subjectId and kind are required (kind: call_recording | marketing_sms | marketing_email | data_processing | voice_clone)');
  }

  const consent = await db.consent.create({
    data: {
      companyId: ctx.companyId,
      subjectType: body.subjectType || 'caller',
      subjectId: body.subjectId,
      kind: body.kind,
      method: body.method || 'ivr_dtmf',
      methodDetail: body.methodDetail || null,
      scope: body.scope || 'this_call',
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      referenceType: body.referenceType || null,
      referenceId: body.referenceId || null,
      capturedBy: ctx.userId,
      ipAddress: request.headers.get('x-forwarded-for') || null,
      userAgent: request.headers.get('user-agent') || null,
    },
  });

  await emitEvent({
    type: 'consent.captured',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'consent',
    resourceId: consent.id,
    metadata: { kind: body.kind, subjectId: body.subjectId, method: body.method },
  });

  return ok(consent);
}
