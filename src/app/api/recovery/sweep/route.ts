import { NextRequest, NextResponse } from 'next/server';
import { recoverStuckVideos } from '@/lib/recovery-sweep';
import { requireOwner } from '@/lib/auth';
import { log } from '@/lib/observability';

/**
 * POST /api/recovery/sweep — recover non-terminal AvatarVideo jobs.
 * Admin-only. Idempotent. Safe to call concurrently.
 *
 * Designed to be called by an external scheduler (cron) every 5 minutes,
 * OR manually by an admin. The sweep marks jobs stuck in non-terminal states
 * for longer than the configured timeout as `failed`.
 */

export async function POST(req: NextRequest) {
  try {
    const owner = await requireOwner();
    const url = new URL(req.url);
    const timeoutMinutes = parseInt(url.searchParams.get('timeoutMinutes') || '10', 10);
    if (timeoutMinutes < 1 || timeoutMinutes > 1440) {
      return NextResponse.json({ ok: false, error: 'timeoutMinutes must be 1-1440' }, { status: 400 });
    }
    const result = await recoverStuckVideos(timeoutMinutes);
    log('info', 'recovery-sweep-complete', { ownerId: owner.ownerId, ...result });
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function GET() {
  try {
    await requireOwner();
    // Dry-run preview: list stuck jobs without marking them
    const { db } = await import('@/lib/db');
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    const stuck = await db.avatarVideo.findMany({
      where: {
        status: { in: ['pending', 'scripting', 'generating_audio', 'generating_images', 'composing'] },
        updatedAt: { lt: cutoff },
      },
      select: { id: true, avatarId: true, status: true, updatedAt: true, currentStep: true },
    });
    return NextResponse.json({ ok: true, stuckCount: stuck.length, stuck });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
