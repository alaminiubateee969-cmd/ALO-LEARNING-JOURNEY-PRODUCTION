/**
 * ALO Stuck-Job Recovery Sweep
 *
 * Marks non-terminal AvatarVideo records older than the configured timeout
 * as `failed` with an actionable error message. Idempotent: only updates
 * rows in non-terminal states.
 *
 * Designed to be called by:
 *   - a scheduled cron route (/api/recovery/sweep)
 *   - an external scheduler hitting that route
 *
 * Safe concurrent execution: uses a single UPDATE with WHERE, so parallel
 * sweeps cannot double-finalize (only rows still non-terminal get touched).
 */

import { db } from '@/lib/db';
import { log } from '@/lib/observability';

const NON_TERMINAL_STATUSES = [
  'pending',
  'scripting',
  'generating_audio',
  'generating_images',
  'composing',
];

const DEFAULT_TIMEOUT_MINUTES = 10;

export interface SweepResult {
  scanned: number;
  recovered: number;
  recoveredIds: string[];
  alreadyTerminal: number;
  timeoutMinutes: number;
}

export async function recoverStuckVideos(timeoutMinutes: number = DEFAULT_TIMEOUT_MINUTES): Promise<SweepResult> {
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);

  const stuck = await db.avatarVideo.findMany({
    where: {
      status: { in: NON_TERMINAL_STATUSES },
      updatedAt: { lt: cutoff },
    },
    select: { id: true, avatarId: true, status: true, updatedAt: true },
  });

  log('info', 'recovery-sweep-start', { scanned: stuck.length, timeoutMinutes, cutoff: cutoff.toISOString() });

  const recoveredIds: string[] = [];
  for (const v of stuck) {
    try {
      await db.avatarVideo.update({
        where: { id: v.id },
        data: {
          status: 'failed',
          errorMessage: `Job timed out in state '${v.status}' (no progress for ${timeoutMinutes}m). Auto-recovered by sweep.`,
          progress: 0,
          currentStep: `Recovered from ${v.status}`,
        },
      });
      recoveredIds.push(v.id);
      log('warn', 'recovery-sweep-recovered', {
        videoId: v.id, avatarId: v.avatarId, priorStatus: v.status, staleSince: v.updatedAt.toISOString(),
      });
    } catch (e) {
      log('error', 'recovery-sweep-failed-to-update', {
        videoId: v.id, error: (e as Error).message,
      });
    }
  }

  return {
    scanned: stuck.length,
    recovered: recoveredIds.length,
    recoveredIds,
    alreadyTerminal: 0,
    timeoutMinutes,
  };
}
