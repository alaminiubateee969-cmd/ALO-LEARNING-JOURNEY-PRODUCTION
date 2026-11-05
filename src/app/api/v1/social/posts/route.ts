/**
 * GET /api/v1/social/posts
 *
 * Lists scheduled + published posts for this company. Optionally filtered
 * by status (draft | scheduled | published | failed).
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, ok } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const platform = url.searchParams.get('platform');

  const where: any = { companyId: ctx.companyId, type: { in: ['social_post', 'blog'] } };
  if (status) where.status = status;
  if (platform) where.platform = platform;

  const posts = await db.content.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      platform: true,
      body: true,
      mediaUrl: true,
      scheduledAt: true,
      publishedAt: true,
      aiGenerated: true,
      engagement: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return ok({
    posts: posts.map((p) => {
      let platformPostIds: any = null;
      try { platformPostIds = p.engagement ? JSON.parse(p.engagement) : null; } catch { /* ignore */ }
      return {
        ...p,
        scheduledAt: p.scheduledAt?.toISOString() || null,
        publishedAt: p.publishedAt?.toISOString() || null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        platformPostIds,
      };
    }),
  });
}
