import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import ZAI from 'z-ai-web-dev-sdk';
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid' }, { status: 401 });
    const taskId = new URL(req.url).searchParams.get('taskId');
    if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 });
    try {
      const zai = await ZAI.create();
      const result = await zai.async.result.query(taskId);
      const videoUrl = result.video_result?.[0]?.url || result.video_url || result.url || null;
      return NextResponse.json({ data: { taskId, status: result.task_status, videoUrl, isReady: result.task_status === 'SUCCESS' && !!videoUrl } });
    } catch {
      return NextResponse.json({ data: { taskId, status: 'UNKNOWN', videoUrl: null, isReady: false } });
    }
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
