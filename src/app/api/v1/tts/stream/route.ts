/**
 * POST /api/v1/tts/stream — streaming TTS (server-sent audio chunks).
 *
 * Body: same as /api/v1/tts. Returns a `text/event-stream` (or chunked binary
 * response, depending on the provider). Used for low-latency UI playback —
 * the first chunk plays before the rest is synthesized.
 *
 * Currently delegates to `synthesize()` (non-streaming) and emits the audio
 * in a single chunk — true streaming requires Piper's `/stream` endpoint or
 * faster-whisper's WebSocket mode. The route signature is stable so we can
 * swap in a streaming backend later.
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, badRequest } from '@/lib/v1-middleware';
import { synthesize } from '@/lib/voice-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body || !body.text) return badRequest('text is required');

  const text = String(body.text).slice(0, 5000);
  if (!text.trim()) return badRequest('text cannot be empty');

  const speed = typeof body.speed === 'number' ? Math.min(Math.max(body.speed, 0.5), 2.0) : 1.0;
  const pitch = typeof body.pitch === 'number' ? Math.min(Math.max(body.pitch, 0.5), 2.0) : 1.0;

  let result;
  try {
    result = await synthesize({
      text,
      language: body.language || 'bn-BD',
      voiceId: body.voiceId,
      speed,
      pitch,
      companyId: ctx.companyId,
      outputFormat: body.outputFormat || 'mp3',
    });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: 'provider_failed', message: e?.message?.slice(0, 200) || 'tts failed' },
      { status: 502 },
    );
  }

  // Stream back the audio bytes if we have base64, else redirect to the URL.
  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (result.audioBase64) {
          // Decode base64 → binary chunks
          const bytes = Uint8Array.from(Buffer.from(result.audioBase64, 'base64'));
          // Send in 4KB chunks to enable progressive playback
          const chunkSize = 4096;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            controller.enqueue(bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
          }
        } else if (result.audioUrl) {
          // Fetch from the provider URL and pipe through
          const r = await fetch(result.audioUrl);
          if (r.body) {
            const reader = r.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) controller.enqueue(value);
            }
          }
        }
      } catch (e: any) {
        controller.error(e);
        return;
      }
      controller.close();
    },
  });

  const mimeType =
    body.outputFormat === 'wav' ? 'audio/wav'
    : body.outputFormat === 'ogg' ? 'audio/ogg'
    : 'audio/mpeg';

  return new Response(stream, {
    headers: {
      'Content-Type': mimeType,
      'Cache-Control': 'no-store',
      'X-TTS-Provider': result.provider,
      'X-TTS-Simulated': String(result.simulated),
      'X-TTS-Duration-Sec': String(result.durationSec ?? 0),
    },
  });
}
