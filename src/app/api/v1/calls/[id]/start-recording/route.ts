/**
 * POST /api/v1/calls/[id]/start-recording — start recording (requires consent)
 * Per directive §10: recording requires consent. 403 if no consentId provided.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, notFound, ok, forbidden } from '@/lib/v1-middleware';
import { startRecording } from '@/lib/telephony-adapter';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body?.consentId) {
    return forbidden('consentId is required — recording without consent is prohibited (directive §10)');
  }

  const existing = await db.call.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!existing) return notFound('call not found');

  const result = await startRecording(id, body.consentId);
  return ok(result);
}
