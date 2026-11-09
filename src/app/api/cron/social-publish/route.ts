/**
 * GET /api/cron/social-publish
 *
 * Cron job — runs every minute (configure external scheduler like systemd
 * timer or GitHub Actions cron to hit this endpoint).
 *
 * Picks up Content rows where:
 *   - status = 'scheduled'
 *   - scheduledAt <= now
 *   - platform is a real social platform (not blog/email)
 *   - engagement field does NOT contain postizPostId (not yet published)
 *
 * For each, calls publishPost() to actually deliver via Postiz. On success,
 * marks status='published' + stores postizPostId + platformPostIds in the
 * engagement JSON (audit evidence). On failure, leaves status='scheduled'
 * and increments a retry counter (in the engagement JSON) — after 3 retries
 * the row is marked 'failed' so it stops being picked up.
 *
 * Auth: protected by CRON_SECRET env var (sent as Bearer token). If unset,
 * the endpoint refuses to run.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { publishPost, isPostizConfigured } from '@/lib/postiz-adapter';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

const MAX_RETRIES = 3;
const PLATFORMS = ['facebook', 'instagram', 'linkedin', 'x', 'tiktok', 'youtube'];

export async function GET(request: NextRequest) {
  // Auth via CRON_SECRET
  const authHeader = request.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET env var not set — refusing to run' }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!isPostizConfigured()) {
    return NextResponse.json({
      ok: true,
      simulated: true,
      message: 'Postiz not configured — no posts to publish. Set POSTIZ_* env vars to enable.',
      processed: 0,
    });
  }

  const now = new Date();
  const due = await db.content.findMany({
    where: {
      status: 'scheduled',
      scheduledAt: { lte: now },
      platform: { in: PLATFORMS },
    },
    take: 20, // process at most 20 per minute to avoid rate limits
  });

  let published = 0;
  let failed = 0;
  let retried = 0;
  const errors: Array<{ contentId: string; error: string }> = [];

  for (const content of due) {
    // Parse retry count from engagement JSON
    let engagementData: any = {};
    try { engagementData = content.engagement ? JSON.parse(content.engagement) : {}; } catch { /* ignore */ }

    // Skip if already has a real postizPostId (already published)
    if (engagementData.postizPostId) continue;

    const retryCount = engagementData.retryCount || 0;
    if (retryCount >= MAX_RETRIES) {
      // Mark as failed so we stop retrying
      await db.content.update({
        where: { id: content.id },
        data: { status: 'failed' },
      });
      failed++;
      continue;
    }

    // Try to publish via Postiz
    const result = await publishPost({
      contentId: content.id,
      text: content.body || content.title,
      platforms: [content.platform] as any,
      mediaUrls: content.mediaUrl ? [content.mediaUrl] : [],
    });

    if (result.simulated || result.httpStatus !== 200) {
      // Increment retry count
      engagementData.retryCount = retryCount + 1;
      engagementData.lastError = result.error?.slice(0, 500);
      engagementData.lastRetryAt = new Date().toISOString();
      await db.content.update({
        where: { id: content.id },
        data: { engagement: JSON.stringify(engagementData) },
      });
      retried++;
      errors.push({ contentId: content.id, error: result.error || 'simulated' });
      continue;
    }

    // Success!
    engagementData.postizPostId = result.postizPostId;
    engagementData.platformPostIds = result.platformPostIds;
    engagementData.publishedAt = new Date().toISOString();
    engagementData.publishedVia = 'postiz';
    delete engagementData.retryCount;
    delete engagementData.lastError;

    await db.content.update({
      where: { id: content.id },
      data: {
        status: 'published',
        publishedAt: new Date(),
        engagement: JSON.stringify(engagementData),
      },
    });

    await emitEvent({
      type: 'social.post_published',
      companyId: content.companyId,
      resource: 'content',
      resourceId: content.id,
      metadata: {
        postizPostId: result.postizPostId,
        platformPostIds: result.platformPostIds,
        platform: content.platform,
        scheduledAt: content.scheduledAt?.toISOString(),
        publishedAt: new Date().toISOString(),
      },
    });

    published++;
  }

  return NextResponse.json({
    ok: true,
    processed: due.length,
    published,
    failed,
    retried,
    errors: errors.slice(0, 5), // cap error list in response
    timestamp: now.toISOString(),
  });
}
