/**
 * POST /api/v1/asr — speech-to-text
 * Body: { audioUrl?, audioBase64?, language?, enableDiarization? }
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { transcribe } from '@/lib/asr-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.audioUrl && !body?.audioBase64) return badRequest('audioUrl or audioBase64 is required');

  const result = await transcribe({
    audioUrl: body.audioUrl,
    audioBase64: body.audioBase64,
    language: body.language || 'bn-BD',
    enableDiarization: body.enableDiarization || false,
    companyId: ctx.companyId,
    prompt: body.prompt,
  });

  return ok({
    ...result,
    provider: result.provider,
    simulated: result.simulated,
    warning: result.error,
  });
}
