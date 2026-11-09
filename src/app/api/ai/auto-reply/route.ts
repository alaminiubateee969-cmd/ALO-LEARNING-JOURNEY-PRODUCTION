import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });
    const body = await req.json();
    const message = String(body.message || '').trim();
    if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 });
    let reply = '';
    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [{ role: 'system', content: 'You are an AI auto-reply assistant. Respond concisely (under 160 chars for SMS). Be helpful and professional.' }, { role: 'user', content: message }],
        thinking: { type: 'disabled' },
      });
      reply = completion.choices[0]?.message?.content || '';
    } catch {
      const lower = message.toLowerCase();
      if (lower.includes('price') || lower.includes('cost')) reply = 'Hi! Our pricing depends on your needs. I\'ll have our team send you a quote. What\'s the best time to reach you?';
      else if (lower.includes('hello') || lower.includes('hi')) reply = 'Hello! Thanks for reaching out. How can I help you today?';
      else reply = 'Thanks for your message! I\'ll have our team get back to you within 24 hours.';
    }
    return NextResponse.json({ data: { reply, incomingMessage: message } });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
