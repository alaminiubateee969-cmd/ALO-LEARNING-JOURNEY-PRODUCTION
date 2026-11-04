import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import ZAI from 'z-ai-web-dev-sdk';
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid' }, { status: 401 });
    const body = await req.json();
    const text = String(body.text || '').trim();
    if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });
    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [{ role: 'system', content: 'Check grammar. Return JSON: {"errors":[],"correctedText":""}' }, { role: 'user', content: text }],
        thinking: { type: 'disabled' },
      });
      return NextResponse.json({ data: JSON.parse(completion.choices[0]?.message?.content || '{}') });
    } catch {
      return NextResponse.json({ data: { errors: [], correctedText: text, errorCount: 0, fallback: true } });
    }
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
