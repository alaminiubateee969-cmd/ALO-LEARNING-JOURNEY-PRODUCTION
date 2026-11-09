import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';
import ZAI from 'z-ai-web-dev-sdk';
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });
    const body = await req.json();
    const topic = String(body.topic || '').trim();
    if (!topic) return NextResponse.json({ error: 'topic required' }, { status: 400 });
    let script = '', storyboard: any[] = [];
    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [{ role: 'system', content: `Create a ${body.duration || 30}s cinematic video script about: ${topic}. Return JSON: {"title":"","script":"","storyboard":[]}` }, { role: 'user', content: topic }],
        thinking: { type: 'disabled' },
      });
      const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
      script = parsed.script || ''; storyboard = parsed.storyboard || [];
    } catch {
      script = `Welcome to this cinematic video about ${topic}.`; storyboard = [{ scene: 1, visual: 'Opening', narration: script, mood: 'professional' }];
    }
    const content = await db.content.create({ data: { title: `Cinematic Video: ${topic.slice(0, 80)}`, type: 'video', status: 'draft', body: `Script: ${script}\nStoryboard: ${JSON.stringify(storyboard)}`, aiGenerated: true, creatorId: payload.userId, companyId: payload.companyId } });
    await emitEvent({ companyId: payload.companyId, userId: payload.userId, type: 'ai.cinematic_video_created', title: 'Cinematic video created', description: topic.slice(0, 60), resourceType: 'content', resourceId: content.id });
    return NextResponse.json({ data: { contentId: content.id, title: topic, script, storyboard } }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
