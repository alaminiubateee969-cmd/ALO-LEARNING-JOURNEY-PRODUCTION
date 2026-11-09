/**
 * GET/POST /api/v1/voice-clone-authorizations
 * POST /api/v1/voice-clone-authorizations/[id]/revoke
 * POST /api/v1/voice-clone-authorizations/[id]/synthesize
 *
 * Per directive §3 Module C: voice cloning requires explicit verifiable consent.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, notFound, ok } from '@/lib/v1-middleware';
import { synthesizeWithClonedVoice, revokeVoiceCloneAuthorization } from '@/lib/voice-engine';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const auths = await db.voiceCloneAuthorization.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { usageLogs: true } } },
  });
  return ok({ authorizations: auths });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.ownerName) return badRequest('ownerName is required');
  if (!body?.consentFormUrl) return badRequest('consentFormUrl is required (signed PDF)');
  if (!body?.consentScope) return badRequest('consentScope is required');

  const auth = await db.voiceCloneAuthorization.create({
    data: {
      companyId: ctx.companyId,
      ownerName: body.ownerName,
      ownerEmail: body.ownerEmail || null,
      ownerPhone: body.ownerPhone || null,
      identityVerified: body.identityVerified || false,
      verificationMethod: body.verificationMethod || null,
      consentScope: body.consentScope,
      consentMethod: body.consentMethod || 'signed_form',
      consentFormUrl: body.consentFormUrl,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      capturedBy: ctx.userId,
    },
  });

  await emitEvent({
    type: 'voice_clone.authorized',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'voice_clone_authorization',
    resourceId: auth.id,
    metadata: { ownerName: body.ownerName, scope: body.consentScope },
  });

  return ok(auth);
}
