import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { assertExternalAiAllowed } from "@/lib/agentos/payment-guard";

/**
 * ALO ASR (Speech-to-Text) Studio
 * Transcribes uploaded audio files (wav/mp3/m4a/flac/ogg) to text.
 * Uses z-ai-web-dev-sdk ASR with base64 audio input.
 */

const SUPPORTED_FORMATS = ['wav', 'mp3', 'm4a', 'flac', 'ogg'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

// GET — list recent transcriptions
export async function GET() {
  try {
    const recent = await db.audioTranscription.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const stats = {
      total: recent.length,
      completed: recent.filter((r) => r.status === 'completed').length,
      failed: recent.filter((r) => r.status === 'failed').length,
      pending: recent.filter((r) => r.status === 'pending').length,
      totalWords: recent.reduce((s, r) => s + r.wordCount, 0),
      totalDuration: recent.reduce((s, r) => s + (r.durationSec || 0), 0),
      totalSize: recent.reduce((s, r) => s + r.fileSize, 0),
    };
    return NextResponse.json({
      recent,
      stats,
      supportedFormats: SUPPORTED_FORMATS,
      maxFileSize: MAX_FILE_SIZE,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST — transcribe audio
// Body: { audioBase64: string, fileName: string, fileSize: number, format: string, language?: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      audioBase64,
      fileName = 'upload.wav',
      fileSize = 0,
      format = 'wav',
      language = 'auto',
    } = body as {
      audioBase64: string;
      fileName?: string;
      fileSize?: number;
      format?: string;
      language?: string;
    };

    if (!audioBase64) {
      return NextResponse.json(
        { ok: false, error: 'audioBase64 is required' },
        { status: 400 }
      );
    }
    const lowerFormat = (format || '').toLowerCase();
    if (!SUPPORTED_FORMATS.includes(lowerFormat)) {
      return NextResponse.json(
        { ok: false, error: `Unsupported format. Supported: ${SUPPORTED_FORMATS.join(', ')}` },
        { status: 400 }
      );
    }
    // base64 string length ~ 1.37x actual file size
    const approxSize = Math.floor((audioBase64.length * 3) / 4);
    if (approxSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { ok: false, error: `File too large. Max ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)} MB` },
        { status: 413 }
      );
    }

    // create pending record
    const record = await db.audioTranscription.create({
      data: {
        fileName,
        fileSize: fileSize || approxSize,
        format: lowerFormat,
        language,
        status: 'pending',
      },
    });

    try {
      assertExternalAiAllowed("z-ai-web-dev-sdk");
      const ZAI = (await import("z-ai-web-dev-sdk")).default;
      const zai = await ZAI.create();

      // ASR expects base64 audio (without data: prefix)
      const cleanBase64 = audioBase64.replace(/^data:audio\/\w+;base64,/, '');

      const response = await zai.audio.asr.create({
        file_base64: cleanBase64,
      });

      const transcription = (response as { text?: string }).text || '';
      const wordCount = transcription.trim() ? transcription.trim().split(/\s+/).length : 0;

      // estimate duration from base64 size — wav: 24000 Hz * 2 bytes
      const estDurationSec = lowerFormat === 'wav'
        ? Math.round((approxSize / (24000 * 2)) * 10) / 10
        : null;

      // persist transcription to a text file for download
      const outputDir = path.join(process.cwd(), 'public', 'asr-output');
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      const textPath = path.join(outputDir, `transcript_${record.id}.txt`);
      fs.writeFileSync(textPath, transcription, 'utf8');

      const updated = await db.audioTranscription.update({
        where: { id: record.id },
        data: {
          status: 'completed',
          transcription,
          wordCount,
          durationSec: estDurationSec,
        },
      });

      return NextResponse.json({
        ok: true,
        id: updated.id,
        fileName,
        format: lowerFormat,
        language,
        transcription,
        wordCount,
        durationSec: estDurationSec,
        transcriptUrl: `/asr-output/transcript_${record.id}.txt`,
      });
    } catch (asrErr) {
      await db.audioTranscription.update({
        where: { id: record.id },
        data: {
          status: 'failed',
          errorMessage: (asrErr as Error).message,
        },
      });
      return NextResponse.json(
        { ok: false, error: (asrErr as Error).message, id: record.id },
        { status: 500 }
      );
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
