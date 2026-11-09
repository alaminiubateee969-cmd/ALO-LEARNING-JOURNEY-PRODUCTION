import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { humanizeText } from '@/lib/ai-extensions';

// POST /api/ai/humanize — humanize AI-generated text
// Body: { text: string, tone?: 'casual'|'professional'|'friendly'|'persuasive' }
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
    if (text.length > 10000) return NextResponse.json({ error: 'Text too long (max 10000 chars)' }, { status: 400 });

    const tone = ['casual', 'professional', 'friendly', 'persuasive'].includes(body.tone)
      ? body.tone
      : 'casual';

    const humanized = await humanizeText(text, tone as any);

    return NextResponse.json({
      data: {
        original: text,
        humanized,
        tone,
        changesCount: text !== humanized ? 1 : 0,
      },
    });
  } catch (err) {
    console.error('[POST /api/ai/humanize]', err);
    return NextResponse.json({ error: 'Failed to humanize text' }, { status: 500 });
  }
}
