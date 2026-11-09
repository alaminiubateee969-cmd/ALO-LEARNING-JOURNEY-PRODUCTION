/**
 * POST /api/v1/voice-clone-authorizations/{id}/synthesize
 *
 * Synthesize speech using a CLONED voice. Per directive §3 Module C + §10:
 *   - Authorization must exist + not revoked + not expired
 *   - Usage is logged for audit (VoiceCloneUsageLog)
 *
 * Body:
 *   { "text": "..." }
 *
 * Calls `synthesizeWithClonedVoice()` from `@/lib/voice-engine` which:
 *   1. Validates the authorization (not revoked, not expired)
 *   2. Calls Tortoise (Apache 2.0, batch only) — too slow for real-time but
 *      OK for IVR prompt generation by the voice owner
 *   3. Returns simulation if Tortoise is not configured
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok, notFound, forbidden } from '@/lib/v1-middleware';
import { synthesizeWithClonedVoice } from '@/lib/voice-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const { id } = await params;
  const auth = await db.voiceCloneAuthorization.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!auth) return notFound('voice clone authorization not found');
  if (auth.revokedAt) return forbidden('authorization revoked — synthesis not allowed');
  if (auth.expiresAt && auth.expiresAt.getTime() < Date.now()) {
    return forbidden('authorization expired — synthesis not allowed');
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.text) return badRequest('text is required');
  const text = String(body.text).slice(0, 5000);

  let result;
  try {
    result = await synthesizeWithClonedVoice({
      text,
      authorizationId: id,
      companyId: ctx.companyId,
      outputFormat: body.outputFormat || 'wav',
    });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: 'provider_failed', message: e?.message?.slice(0, 200) || 'cloned TTS failed' },
      { status: 502 },
    );
  }

  if (result.authorizationRevoked) {
    return forbidden('authorization revoked — synthesis aborted');
  }

  return ok({
    audio: {
      url: result.audioUrl || null,
      durationSec: result.durationSec ?? null,
      format: body.outputFormat || 'wav',
    },
    provider: {
      name: result.provider,
      simulated: result.simulated,
      error: result.error || undefined,
    },
    authorization: {
      id,
      ownerName: auth.ownerName,
      consentScope: auth.consentScope,
    },
  });
}
