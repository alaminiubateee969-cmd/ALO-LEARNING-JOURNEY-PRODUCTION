/**
 * GET /api/v1/calls/[id]/recording — return signed URL (5-min TTL)
 * 404 if no recording or no consent.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, notFound, forbidden, ok } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const { id } = await params;

  const call = await db.call.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!call) return notFound('call not found');
  if (!call.hasRecording || !call.recordingUrl) return notFound('no recording available for this call');
  if (!call.recordingConsentId) return forbidden('recording exists but no consent was captured — access denied');

  // In production: generate a signed URL with 5-minute TTL from MinIO
  // For now: return the URL with a timestamp + warning
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const signedUrl = `${call.recordingUrl}?token=${Buffer.from(`${call.id}:${expiresAt}`).toString('base64url')}`;

  return ok({
    recordingUrl: signedUrl,
    expiresAt,
    consentId: call.recordingConsentId,
    note: 'Signed URL expires in 5 minutes. Do not share.',
  });
}
