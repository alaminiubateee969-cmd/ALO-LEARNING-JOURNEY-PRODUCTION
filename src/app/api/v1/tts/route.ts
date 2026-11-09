/**
 * POST /api/v1/tts — text-to-speech
 * Body: { text, language?, voiceId?, speed?, pitch?, outputFormat? }
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { synthesize } from '@/lib/voice-engine';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.text) return badRequest('text is required');

  const result = await synthesize({
    text: body.text,
    language: body.language || 'bn-BD',
    voiceId: body.voiceId,
    speed: body.speed,
    pitch: body.pitch,
    companyId: ctx.companyId,
    outputFormat: body.outputFormat || 'mp3',
  });

  // Persist as a TtsJob for audit
  if (ctx.companyId) {
    await db.ttsJob.create({
      data: {
        companyId: ctx.companyId,
        text: body.text,
        voiceModelId: body.voiceId || result.modelId,
        language: body.language || 'bn-BD',
        speed: body.speed || 1.0,
        pitch: body.pitch || 1.0,
        audioUrl: result.audioUrl || null,
        durationSec: result.durationSec || null,
        provider: result.provider,
        providerModelId: result.modelId,
        status: result.simulated ? 'failed' : 'completed',
        errorMessage: result.error || null,
        charactersProcessed: result.charactersProcessed,
        costEstimateUsd: 0,
        createdBy: ctx.userId,
      },
    });
  }

  await emitEvent({
    type: 'tts.generated',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'tts_job',
    metadata: { provider: result.provider, model: result.modelId, simulated: result.simulated, chars: result.charactersProcessed },
  });

  return ok({
    ...result,
    provider: result.provider,
    simulated: result.simulated,
    warning: result.error,
  });
}
