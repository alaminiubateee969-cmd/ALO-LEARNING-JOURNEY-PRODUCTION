/**
 * POST /api/v1/voice-clone-authorizations/{id}/revoke
 *
 * Revoke a voice clone authorization. The cloned voice model is deleted from
 * the provider within 24 hours (per directive §10 — revocation mechanism).
 * After revocation, `synthesize` against this authorization will return an
 * error.
 *
 * Body:
 *   { "reason": "owner withdrew consent" }   // required
 *
 * Calls `revokeVoiceCloneAuthorization()` from `@/lib/voice-engine` which
 * sets `revokedAt` + `revocationReason` and emits the revocation event.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok, notFound } from '@/lib/v1-middleware';
import { revokeVoiceCloneAuthorization } from '@/lib/voice-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const { id } = await params;
  const auth = await db.voiceCloneAuthorization.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!auth) return notFound('voice clone authorization not found');
  if (auth.revokedAt) return badRequest('authorization already revoked');

  const body = await request.json().catch(() => ({})) || {};
  const reason = String(body.reason || 'revoked by user');
  if (!body.reason) {
    return badRequest('reason is required');
  }

  await revokeVoiceCloneAuthorization(id, reason);

  return ok({
    authorization: {
      id,
      revokedAt: new Date().toISOString(),
      revocationReason: reason,
    },
  });
}
