/**
 * POST /api/v1/voicemails/{id}/transcribe
 *
 * Kick off transcription for a voicemail. Calls `transcribe()` from
 * `@/lib/asr-engine` which:
 *   1. Tries faster-whisper (preferred)
 *   2. Falls back to Z.AI cloud ASR (free)
 *   3. Falls back to simulation if neither configured
 *
 * Updates the Voicemail row with the transcript + transcriptionStatus.
 *
 * Body:
 *   { "language": "bn-BD", "enableDiarization": false }   // both optional
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, ok, notFound, badRequest } from '@/lib/v1-middleware';
import { transcribe } from '@/lib/asr-engine';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const { id } = await params;
  const voicemail = await db.voicemail.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!voicemail) return notFound('voicemail not found');

  if (voicemail.transcriptionStatus === 'processing') {
    return badRequest('transcription already in progress');
  }

  if (!voicemail.audioUrl) {
    return badRequest('voicemail has no audioUrl');
  }

  // Mark as processing
  await db.voicemail.update({
    where: { id },
    data: { transcriptionStatus: 'processing' },
  });

  const body = await request.json().catch(() => ({})) || {};

  let result;
  try {
    result = await transcribe({
      audioUrl: voicemail.audioUrl,
      language: body.language || 'bn-BD',
      enableDiarization: body.enableDiarization === true,
      companyId: ctx.companyId,
    });
  } catch (e: any) {
    await db.voicemail.update({
      where: { id },
      data: {
        transcriptionStatus: 'failed',
      },
    });
    return Response.json(
      { ok: false, error: 'provider_failed', message: e?.message?.slice(0, 200) || 'transcription failed' },
      { status: 502 },
    );
  }

  const updated = await db.voicemail.update({
    where: { id },
    data: {
      transcript: result.text || null,
      transcriptionStatus: result.simulated ? 'failed' : 'completed',
    },
  });

  await emitEvent({
    type: 'voicemail.transcribed',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'voicemail',
    resourceId: id,
    title: 'Voicemail transcribed',
    description: `Voicemail from ${voicemail.fromNumber} transcribed via ${result.provider}`,
    metadata: {
      provider: result.provider,
      simulated: result.simulated,
      durationSec: result.durationSec,
      textLength: result.text?.length ?? 0,
    },
  });

  return ok({
    voicemail: {
      id: updated.id,
      transcriptionStatus: updated.transcriptionStatus,
      transcript: updated.transcript,
    },
    provider: {
      name: result.provider,
      modelId: result.modelId,
      simulated: result.simulated,
      language: result.language,
      durationSec: result.durationSec,
      error: result.error || undefined,
    },
  });
}
