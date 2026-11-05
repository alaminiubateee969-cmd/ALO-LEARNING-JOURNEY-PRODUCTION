/**
 * POST /api/v1/voice-clone-authorizations/[id]/revoke
 * POST /api/v1/voice-clone-authorizations/[id]/synthesize
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, notFound, ok } from '@/lib/v1-middleware';
import { synthesizeWithClonedVoice, revokeVoiceCloneAuthorization } from '@/lib/voice-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  const { id } = await params;

  const existing = await db.voiceCloneAuthorization.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!existing) return notFound('authorization not found');

  const body = await request.json().catch(() => ({}));

  // If "action" field is "revoke", revoke; otherwise synthesize
  if (body.action === 'revoke' || body.reason) {
    await revokeVoiceCloneAuthorization(id, body.reason || 'revoked by admin');
    return ok({ revoked: true, id });
  }

  // Synthesize with the cloned voice
  if (!body.text) return badRequest('text is required for synthesis (or set action=revoke)');
  const result = await synthesizeWithClonedVoice({
    text: body.text,
    authorizationId: id,
    companyId: ctx.companyId,
    outputFormat: body.outputFormat,
  });
  return ok(result);
}
