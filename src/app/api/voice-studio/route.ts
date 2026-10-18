import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

/**
 * ALO Voice Studio
 * High-quality TTS using z-ai-web-dev-sdk with 7 voice profiles.
 * Supports: speed (0.5-2.0), volume (0-10), formats (wav/mp3/pcm),
 * multi-voice presets, long-text auto-chunking.
 *
 * Voices: tongtong, chuichui, xiaochen, jam, kazi, douji, luodo
 */

const VOICE_PROFILES = {
  tongtong: { label: 'Tongtong', style: '温暖亲切 (Warm & Friendly)', bestFor: 'Narration, welcome messages' },
  chuichui: { label: 'Chuichui', style: '活泼可爱 (Lively & Cute)', bestFor: 'Kids content, playful tone' },
  xiaochen: { label: 'Xiaochen', style: '沉稳专业 (Calm & Professional)', bestFor: 'Corporate, news, announcements' },
  jam: { label: 'Jam', style: '英音绅士 (British Gentleman)', bestFor: 'English narration, documentary' },
  kazi: { label: 'Kazi', style: '清晰标准 (Clear & Standard)', bestFor: 'Tutorials, instructional' },
  douji: { label: 'Douji', style: '自然流畅 (Natural & Fluent)', bestFor: 'Conversational, storytelling' },
  luodo: { label: 'Luodo', style: '富有感染力 (Expressive)', bestFor: 'Emotional content, ads' },
} as const;

const MAX_INPUT_LENGTH = 1024; // API constraint

function splitTextIntoChunks(text: string, maxLength = 1000): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return [trimmed];
  const chunks: string[] = [];
  // split by sentence boundaries
  const sentences = trimmed.match(/[^.!?।]+[.!?।]+/g) || [trimmed];
  let current = '';
  for (const s of sentences) {
    if ((current + s).length <= maxLength) {
      current += s;
    } else {
      if (current) chunks.push(current.trim());
      // if single sentence > maxLength, hard-split
      if (s.length > maxLength) {
        for (let i = 0; i < s.length; i += maxLength) {
          chunks.push(s.slice(i, i + maxLength));
        }
        current = '';
      } else {
        current = s;
      }
    }
  }
  if (current) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

// GET — list voice profiles + recent generations
export async function GET() {
  try {
    const recent = await db.voiceGeneration.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const stats = {
      total: recent.length,
      completed: recent.filter((r) => r.status === 'completed').length,
      failed: recent.filter((r) => r.status === 'failed').length,
      totalChars: recent.reduce((s, r) => s + r.charCount, 0),
      totalDuration: recent.reduce((s, r) => s + (r.durationSec || 0), 0),
    };
    const voiceUsage = recent.reduce<Record<string, number>>((acc, r) => {
      acc[r.voice] = (acc[r.voice] || 0) + 1;
      return acc;
    }, {});
    return NextResponse.json({
      voices: VOICE_PROFILES,
      recent,
      stats,
      voiceUsage,
      supportedFormats: ['wav', 'mp3', 'pcm'],
      speedRange: { min: 0.5, max: 2.0, default: 1.0 },
      volumeRange: { min: 0.01, max: 10, default: 1.0 },
      maxInputLength: MAX_INPUT_LENGTH,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST — generate audio from text
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      text,
      voice = 'tongtong',
      speed = 1.0,
      volume = 1.0,
      format = 'wav',
      language = 'bn',
    } = body as {
      text: string;
      voice?: string;
      speed?: number;
      volume?: number;
      format?: string;
      language?: string;
    };

    if (!text || !text.trim()) {
      return NextResponse.json({ ok: false, error: 'text is required' }, { status: 400 });
    }
    if (!VOICE_PROFILES[voice as keyof typeof VOICE_PROFILES]) {
      return NextResponse.json(
        { ok: false, error: `Invalid voice. Available: ${Object.keys(VOICE_PROFILES).join(', ')}` },
        { status: 400 }
      );
    }
    if (speed < 0.5 || speed > 2.0) {
      return NextResponse.json(
        { ok: false, error: 'speed must be between 0.5 and 2.0' },
        { status: 400 }
      );
    }
    if (volume <= 0 || volume > 10) {
      return NextResponse.json(
        { ok: false, error: 'volume must be > 0 and <= 10' },
        { status: 400 }
      );
    }
    const validFormats = ['wav', 'mp3', 'pcm'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { ok: false, error: `format must be one of ${validFormats.join(', ')}` },
        { status: 400 }
      );
    }

    const charCount = text.trim().length;
    const chunks = splitTextIntoChunks(text.trim(), MAX_INPUT_LENGTH);

    // create a pending record
    const record = await db.voiceGeneration.create({
      data: {
        text: text.trim(),
        voice,
        speed,
        volume,
        format,
        language,
        charCount,
        status: 'pending',
      },
    });

    try {
      // dynamic import to keep z-ai in server-only path
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();

      const outputDir = path.join(process.cwd(), 'public', 'voice-studio');
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

      const chunkFiles: string[] = [];
      let totalDuration = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i];
        const response = await zai.audio.tts.create({
          input: chunkText,
          voice,
          speed,
          response_format: format as 'wav' | 'mp3' | 'pcm',
          stream: false,
          ...(volume !== 1.0 ? { volume } as any : {}),
        });
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(new Uint8Array(arrayBuffer));
        const fileName = `voice_${record.id}_${i}.${format}`;
        const filePath = path.join(outputDir, fileName);
        fs.writeFileSync(filePath, buffer);
        chunkFiles.push(`/voice-studio/${fileName}`);
        // rough duration estimate: bytes / (24000 Hz * 2 bytes/sample)
        totalDuration += buffer.length / (24000 * 2);
      }

      const finalPath = chunkFiles.length === 1 ? chunkFiles[0] : chunkFiles[0];

      const updated = await db.voiceGeneration.update({
        where: { id: record.id },
        data: {
          status: 'completed',
          filePath: finalPath,
          durationSec: Math.round(totalDuration * 10) / 10,
        },
      });

      return NextResponse.json({
        ok: true,
        id: updated.id,
        voice,
        voiceLabel: VOICE_PROFILES[voice as keyof typeof VOICE_PROFILES].label,
        voiceStyle: VOICE_PROFILES[voice as keyof typeof VOICE_PROFILES].style,
        speed,
        volume,
        format,
        language,
        charCount,
        chunksGenerated: chunks.length,
        audioUrl: finalPath,
        durationSec: updated.durationSec,
        allChunks: chunkFiles,
      });
    } catch (genErr) {
      await db.voiceGeneration.update({
        where: { id: record.id },
        data: {
          status: 'failed',
          errorMessage: (genErr as Error).message,
        },
      });
      return NextResponse.json(
        { ok: false, error: (genErr as Error).message, id: record.id },
        { status: 500 }
      );
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
