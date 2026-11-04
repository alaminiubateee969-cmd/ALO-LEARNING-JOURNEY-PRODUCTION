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
    const description = String(body.description || '').trim();
    if (!description) return NextResponse.json({ error: 'description required' }, { status: 400 });
    const type = body.type || 'flowchart';
    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [{ role: 'system', content: `Generate Mermaid ${type} diagram. Return ONLY valid Mermaid code.` }, { role: 'user', content: description }],
        thinking: { type: 'disabled' },
      });
      return NextResponse.json({ data: { type, description, mermaid: completion.choices[0]?.message?.content || '' } });
    } catch {
      return NextResponse.json({ data: { type, description, mermaid: `graph TD\n    A[${description.slice(0, 50)}]` } });
    }
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
