import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { generateVideo } from '@/lib/ai-extensions';
import { emitEvent } from '@/lib/events';

// POST /api/ai/generate-video — generate a video via z-ai-web-dev-sdk
// Body: { prompt: string, duration?: number }
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const prompt = String(body.prompt || '').trim();
    if (!prompt) return NextResponse.json({ error: 'prompt is required' }, { status: 400 });

    const result = await generateVideo(prompt);

    if (!result) {
      return NextResponse.json({
        error: 'Video generation unavailable. The Z.ai video API may be rate-limited or not configured. Try again later or configure your own Z.ai API key.',
      }, { status: 503 });
    }

    // Save the video task to content
    if (body.saveToContent !== false) {
      await db.content.create({
        data: {
          title: `AI Video: ${prompt.slice(0, 80)}`,
          type: 'video',
          status: 'draft',
          body: `Prompt: ${prompt}\nTask ID: ${result.taskId}\nStatus: ${result.status}`,
          mediaUrl: result.videoUrl || null,
          mediaType: 'video',
          aiGenerated: true,
          creatorId: payload.userId,
          companyId: payload.companyId,
        },
      });
    }

    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'ai.video_generated',
      title: 'AI video generation started',
      description: `Prompt: "${prompt.slice(0, 80)}" → task: ${result.taskId}`,
      resourceType: 'content',
      link: '/content',
      metadata: { prompt, taskId: result.taskId, status: result.status },
    });

    return NextResponse.json({
      data: {
        taskId: result.taskId,
        videoUrl: result.videoUrl,
        status: result.status,
        prompt,
      },
    });
  } catch (err) {
    console.error('[POST /api/ai/generate-video]', err);
    return NextResponse.json({ error: 'Failed to generate video' }, { status: 500 });
  }
}
