/**
 * POST /api/v1/social/publish
 *
 * Publishes (or schedules) a content post via the Postiz adapter.
 * Body:
 *   { "contentId": "...", "platforms": ["facebook", "instagram"],
 *     "scheduledAt": "2026-11-06T10:00:00Z",  // optional
 *     "mediaUrls": [...] }
 *
 * Returns:
 *   - When Postiz is configured: real post IDs + simulated=false
 *   - When Postiz is NOT configured: simulated=true, post marked 'scheduled'
 *     locally only (NOT marked 'published' — that would falsely claim delivery)
 *
 * Per master directive: a successful post requires actual provider response +
 * external post ID + publication timestamp + stored evidence. This route
 * enforces that contract.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, notFound, ok } from '@/lib/v1-middleware';
import { publishPost } from '@/lib/postiz-adapter';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body || !body.contentId) return badRequest('contentId is required');
  if (!Array.isArray(body.platforms) || body.platforms.length === 0) {
    return badRequest('platforms array is required (e.g. ["facebook", "instagram"])');
  }

  const content = await db.content.findFirst({
    where: { id: body.contentId, companyId: ctx.companyId },
  });
  if (!content) return notFound('content not found');

  // Call Postiz (or simulation when unconfigured)
  const result = await publishPost({
    contentId: content.id,
    text: content.body || content.title,
    platforms: body.platforms,
    scheduledAt: body.scheduledAt,
    mediaUrls: body.mediaUrls || [],
  });

  // Update Content row based on outcome
  if (result.simulated) {
    // Mark as 'scheduled' locally — Postiz not configured, no real publish yet
    await db.content.update({
      where: { id: content.id },
      data: {
        status: 'scheduled',
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : new Date(),
      },
    });
    return ok({
      contentId: content.id,
      status: 'scheduled',
      simulated: true,
      warning: result.error,
    });
  }

  if (result.httpStatus !== 200) {
    // Publish failed — keep status='draft' so user can retry
    return Response.json(
      { ok: false, error: 'publish_failed', message: result.error, httpStatus: result.httpStatus },
      { status: 502 }
    );
  }

  // Real publish succeeded — mark as 'published' (or 'scheduled' if scheduledAt is in the future)
  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  const isImmediate = !scheduledAt || scheduledAt.getTime() <= Date.now() + 60_000;

  await db.content.update({
    where: { id: content.id },
    data: {
      status: isImmediate ? 'published' : 'scheduled',
      scheduledAt,
      publishedAt: isImmediate ? new Date() : null,
      // Reuse the engagement JSON field to store platform post IDs (audit evidence)
      engagement: JSON.stringify({
        postizPostId: result.postizPostId,
        platformPostIds: result.platformPostIds,
        publishedVia: 'postiz',
        publishedAt: new Date().toISOString(),
      }),
    },
  });

  await emitEvent({
    type: 'social.post_published',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'content',
    resourceId: content.id,
    metadata: {
      platforms: body.platforms,
      postizPostId: result.postizPostId,
      platformPostIds: result.platformPostIds,
      simulated: false,
    },
  });

  return ok({
    contentId: content.id,
    status: isImmediate ? 'published' : 'scheduled',
    simulated: false,
    postizPostId: result.postizPostId,
    platformPostIds: result.platformPostIds,
    publishedAt: isImmediate ? new Date().toISOString() : null,
    scheduledAt: scheduledAt?.toISOString() || null,
  });
}
