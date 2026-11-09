import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { generateImage } from '@/lib/ai-extensions';
import { emitEvent } from '@/lib/events';

// POST /api/ai/generate-image — generate an image via z-ai-web-dev-sdk
// Body: { prompt: string, size?: '1024x1024'|'768x1344'|'864x1152'|'1344x768'|'1152x864' }
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

    const sizes = ['1024x1024', '768x1344', '864x1152', '1344x768', '1152x864'];
    const size = sizes.includes(body.size) ? body.size : '1024x1024';

    const result = await generateImage(prompt, size as any);

    if (!result) {
      // Fallback: use a placeholder image service (free, no API key)
      const placeholderUrl = `https://placehold.co/${size}/f97316/ffffff?text=${encodeURIComponent(prompt.slice(0, 50))}`;
      return NextResponse.json({
        data: {
          url: placeholderUrl,
          prompt,
          size,
          fallback: true,
          message: 'AI image generation unavailable — using placeholder. Configure Z.ai API key for real generation.',
        },
      });
    }

    // Save to content as media
    if (body.saveToContent !== false) {
      await db.content.create({
        data: {
          title: `AI Image: ${prompt.slice(0, 80)}`,
          type: 'image',
          status: 'draft',
          mediaUrl: result.url,
          mediaType: 'image',
          aiGenerated: true,
          creatorId: payload.userId,
          companyId: payload.companyId,
        },
      });
    }

    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'ai.image_generated',
      title: 'AI image generated',
      description: `Prompt: "${prompt.slice(0, 80)}" → ${result.url.slice(0, 60)}...`,
      resourceType: 'content',
      link: '/content',
      metadata: { prompt, size, url: result.url },
    });

    return NextResponse.json({
      data: {
        url: result.url,
        prompt: result.prompt,
        size,
        fallback: false,
      },
    });
  } catch (err) {
    console.error('[POST /api/ai/generate-image]', err);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
