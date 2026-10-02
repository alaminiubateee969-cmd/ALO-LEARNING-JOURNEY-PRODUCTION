import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { generateSpeech } from '@/lib/ai-extensions';

// POST /api/ai/voice — generate speech (text-to-speech) via z-ai-web-dev-sdk
// Body: { text: string, voice?: string }
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const text = String(body.text || '').trim();
    if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 });
    if (text.length > 5000) return NextResponse.json({ error: 'Text too long (max 5000 chars)' }, { status: 400 });

    const voice = String(body.voice || 'default');
    const result = await generateSpeech(text, voice);

    if (!result) {
      return NextResponse.json({
        error: 'Voice generation unavailable. The Z.ai TTS API may be rate-limited. Try again later.',
      }, { status: 503 });
    }

    return NextResponse.json({
      data: {
        audioUrl: result.audioUrl,
        duration: result.duration,
        text,
        voice,
      },
    });
  } catch (err) {
    console.error('[POST /api/ai/voice]', err);
    return NextResponse.json({ error: 'Failed to generate speech' }, { status: 500 });
  }
}
