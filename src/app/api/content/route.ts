import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

// Prisma rejects unknown arguments, so request bodies are mapped onto the
// Content model explicitly instead of being spread straight into `data`.
// `engagement` is TEXT NOT NULL in the schema; older deployments were created
// without the column default, so it is always written explicitly.
function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function jsonText(value: unknown, fallback: string): string {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (e) { console.error("[content] 500:", e);
    return fallback;
  }
}

function optionalJsonText(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  return jsonText(value, '[]');
}

function optionalDate(value: unknown): Date | null {
  const text = optionalText(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { type, status } = Object.fromEntries(new URL(req.url).searchParams);
    const where: any = { companyId: payload.companyId };
    if (type && type !== 'all') where.type = type;
    if (status && status !== 'all') where.status = status;

    const content = await db.content.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ content });
  } catch (err) {
    console.error('[GET /api/content]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!payload.companyId) {
      return NextResponse.json({ error: 'No company associated' }, { status: 400 });
    }

    const input = await req.json().catch(() => null);
    if (!input || typeof input !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const title = optionalText(input.title);
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

    const content = await db.content.create({
      data: {
        title,
        type: optionalText(input.type) ?? 'post',
        status: optionalText(input.status) ?? 'draft',
        platform: optionalText(input.platform),
        body: optionalText(input.body) ?? optionalText(input.content),
        mediaUrl: optionalText(input.mediaUrl),
        mediaType: optionalText(input.mediaType),
        thumbnailUrl: optionalText(input.thumbnailUrl),
        hashtags: optionalJsonText(input.hashtags),
        // The dashboard form posts `scheduledDate`; the model column is `scheduledAt`.
        scheduledAt: optionalDate(input.scheduledAt) ?? optionalDate(input.scheduledDate),
        publishedAt: optionalDate(input.publishedAt),
        engagement: jsonText(input.engagement, '{}'),
        aiGenerated: Boolean(input.aiGenerated),
        campaignId: optionalText(input.campaignId),
        creatorId: payload.userId,
        companyId: payload.companyId,
      },
    });

    // Fire event: content created (or content.published if status=published)
    try { await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: content.status === 'published' ? 'content.published' : 'content.created',
      title: content.status === 'published' ? 'Content published' : 'New content created',
      description: `"${content.title}" (${content.type}${content.platform ? ', ' + content.platform : ''})`,
      resourceType: 'content',
      resourceId: content.id,
      link: '/content',
      metadata: { title: content.title, type: content.type, platform: content.platform, status: content.status },
    }); } catch (evErr) { console.error("[content] emitEvent failed:", evErr); }

    return NextResponse.json({ content });
  } catch (err) {
    console.error('[POST /api/content]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
