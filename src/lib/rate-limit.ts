/**
 * ALO Rate Limiting — in-memory per-owner rate + concurrency control.
 *
 * Production-grade rate limiting would use Redis; for this single-instance
 * deployment an in-memory Map suffices. Two protections:
 *   1. Per-owner request window (max N video-gen requests per 10 min)
 *   2. Per-owner concurrent generation cap (max 1 in-flight at a time)
 *
 * Prevents accidental abuse and duplicate submissions.
 */

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 3; // max 3 video gens per 10 min per owner
const MAX_CONCURRENT_PER_OWNER = 1; // max 1 concurrent gen per owner

interface Bucket {
  timestamps: number[];
}
const buckets = new Map<string, Bucket>();
const inFlight = new Map<string, number>();

export interface RateLimitResult {
  allowed: boolean;
  reason?: 'rate_limited' | 'concurrent_limit';
  retryAfterMs?: number;
  remainingInWindow: number;
  currentInFlight: number;
}

export function checkRateLimit(ownerId: string): RateLimitResult {
  const now = Date.now();
  // purge old timestamps
  const b = buckets.get(ownerId) || { timestamps: [] };
  b.timestamps = b.timestamps.filter((t) => now - t < WINDOW_MS);

  if (b.timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = b.timestamps[0];
    const retryAfterMs = WINDOW_MS - (now - oldest);
    return {
      allowed: false,
      reason: 'rate_limited',
      retryAfterMs,
      remainingInWindow: 0,
      currentInFlight: inFlight.get(ownerId) || 0,
    };
  }

  if ((inFlight.get(ownerId) || 0) >= MAX_CONCURRENT_PER_OWNER) {
    return {
      allowed: false,
      reason: 'concurrent_limit',
      remainingInWindow: MAX_REQUESTS_PER_WINDOW - b.timestamps.length,
      currentInFlight: inFlight.get(ownerId) || 0,
    };
  }

  return {
    allowed: true,
    remainingInWindow: MAX_REQUESTS_PER_WINDOW - b.timestamps.length - 1,
    currentInFlight: inFlight.get(ownerId) || 0,
  };
}

export function markGenerationStart(ownerId: string) {
  const b = buckets.get(ownerId) || { timestamps: [] };
  b.timestamps.push(Date.now());
  buckets.set(ownerId, b);
  inFlight.set(ownerId, (inFlight.get(ownerId) || 0) + 1);
}

export function markGenerationEnd(ownerId: string) {
  const cur = inFlight.get(ownerId) || 0;
  inFlight.set(ownerId, Math.max(0, cur - 1));
}

export function _resetRateLimitState() {
  buckets.clear();
  inFlight.clear();
}
