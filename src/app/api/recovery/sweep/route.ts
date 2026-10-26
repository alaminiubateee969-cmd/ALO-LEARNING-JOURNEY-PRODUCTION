import { timingSafeEqual } from 'node:crypto';
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

function hasValidCronSecret(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET ?? '';
  const supplied = request.headers.get('x-cron-secret') ?? '';
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function POST(req: NextRequest) {
  let actor = 'recovery_cron';
  if (!hasValidCronSecret(req)) {
    try {
      actor = (await requireOwner()).ownerId;
    } catch (error) {
      const statusCode = typeof error === 'object' && error && 'statusCode' in error
        ? Number((error as { statusCode: unknown }).statusCode)
        : 401;
      return NextResponse.json({ error: statusCode === 503 ? 'authentication_not_configured' : 'unauthorized' }, { status: statusCode === 503 ? 503 : 401 });
    }
  }
  const url = new URL(req.url);
  const rawTimeout = url.searchParams.get('timeoutMinutes') ?? '10';
  const timeoutMinutes = Number(rawTimeout);
  if (!Number.isInteger(timeoutMinutes) || timeoutMinutes < 1 || timeoutMinutes > 1440) {
    return NextResponse.json({ ok: false, error: 'timeoutMinutes must be an integer from 1 to 1440' }, { status: 400 });
  }
  try {
    const result = await recoverStuckVideos(timeoutMinutes);
    log('info', 'recovery-sweep-complete', { actor, ...result });
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ error: 'recovery_sweep_failed' }, { status: 503 });
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
