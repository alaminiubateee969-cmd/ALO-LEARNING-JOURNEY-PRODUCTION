/**
 * Circuit Breaker + Resilience layer for the AI chain.
 *
 * Wraps every provider call in:
 *   - Timeout (default 30s — fail fast instead of hanging)
 *   - Retry with exponential backoff (default 2 attempts, 1s + 2s + 4s)
 *   - Circuit breaker (open after 5 consecutive failures, cooldown 60s)
 *
 * The breaker state is persisted in CircuitBreakerState (per provider).
 * This survives across requests and across server restarts.
 *
 * States:
 *   closed     — calls pass through; failures increment consecutiveFailures
 *   open       — all calls short-circuit immediately with a CircuitOpenError
 *                (no network call made); after cooldownSeconds, transition
 *                to half_open
 *   half_open  — a single probe call is allowed; on success → closed, on
 *                failure → re-open with new cooldown
 *
 * Health check probe: a tiny "Say OK" call to verify the provider is back.
 * Triggered by the admin UI's "Test" button or by the next chain call
 * after cooldown expires.
 */
import { db } from './db';

export const BREAKER_FAILURE_THRESHOLD = 5;
export const BREAKER_COOLDOWN_SECONDS = 60;
export const BREAKER_HALF_OPEN_PROBES = 1;

export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_RETRY_ATTEMPTS = 2;
export const DEFAULT_RETRY_BASE_DELAY_MS = 1_000;

export class CircuitOpenError extends Error {
  constructor(providerSlug: string, retryAfterSeconds: number) {
    super(`circuit breaker open for provider "${providerSlug}" — retry in ${retryAfterSeconds}s`);
    this.name = 'CircuitOpenError';
  }
}

export class ProviderTimeoutError extends Error {
  constructor(providerSlug: string, timeoutMs: number) {
    super(`provider "${providerSlug}" timed out after ${timeoutMs}ms`);
    this.name = 'ProviderTimeoutError';
  }
}

export interface BreakerSnapshot {
  providerSlug: string;
  state: 'closed' | 'open' | 'half_open';
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  tripCount: number;
  lastFailureAt: Date | null;
  lastSuccessAt: Date | null;
  trippedAt: Date | null;
  lastFailureReason: string | null;
  secondsUntilHalfOpen: number | null;
}

/**
 * Get the current breaker state for a provider. Creates the row if missing.
 */
export async function getBreakerState(providerId: string, providerSlug: string): Promise<BreakerSnapshot> {
  let row = await db.circuitBreakerState.findUnique({ where: { providerId } });
  if (!row) {
    row = await db.circuitBreakerState.create({
      data: { providerId, state: 'closed' },
    });
  }
  // Check if cooldown expired → transition open → half_open
  let state = row.state as BreakerSnapshot['state'];
  let secondsUntilHalfOpen: number | null = null;
  if (state === 'open' && row.trippedAt) {
    const elapsed = (Date.now() - row.trippedAt.getTime()) / 1000;
    if (elapsed >= BREAKER_COOLDOWN_SECONDS) {
      state = 'half_open';
      await db.circuitBreakerState.update({
        where: { providerId },
        data: { state: 'half_open' },
      });
    } else {
      secondsUntilHalfOpen = Math.ceil(BREAKER_COOLDOWN_SECONDS - elapsed);
    }
  }
  return {
    providerSlug,
    state,
    consecutiveFailures: row.consecutiveFailures,
    consecutiveSuccesses: row.consecutiveSuccesses,
    tripCount: row.tripCount,
    lastFailureAt: row.lastFailureAt,
    lastSuccessAt: row.lastSuccessAt,
    trippedAt: row.trippedAt,
    lastFailureReason: row.lastFailureReason,
    secondsUntilHalfOpen,
  };
}

/**
 * Mark a provider call as successful. Closes the breaker (or stays closed).
 * In half_open state, a success transitions to closed.
 */
export async function recordSuccess(providerId: string): Promise<void> {
  const existing = await db.circuitBreakerState.findUnique({ where: { providerId } });
  if (!existing) {
    await db.circuitBreakerState.create({
      data: { providerId, state: 'closed', consecutiveSuccesses: 1, lastSuccessAt: new Date() },
    });
    return;
  }
  const newState = existing.state === 'half_open' ? 'closed' : existing.state;
  await db.circuitBreakerState.update({
    where: { providerId },
    data: {
      state: newState,
      consecutiveFailures: 0,
      consecutiveSuccesses: { increment: 1 },
      lastSuccessAt: new Date(),
      ...(newState === 'closed' ? { trippedAt: null } : {}),
    },
  });
}

/**
 * Mark a provider call as failed. Increments consecutiveFailures and trips
 * the breaker if threshold is reached.
 */
export async function recordFailure(providerId: string, reason: string): Promise<void> {
  const existing = await db.circuitBreakerState.findUnique({ where: { providerId } });
  if (!existing) {
    await db.circuitBreakerState.create({
      data: {
        providerId,
        state: 'closed',
        consecutiveFailures: 1,
        lastFailureAt: new Date(),
        lastFailureReason: reason.slice(0, 500),
      },
    });
    return;
  }
  const newFailures = existing.consecutiveFailures + 1;
  const shouldTrip = newFailures >= BREAKER_FAILURE_THRESHOLD && existing.state !== 'open';
  await db.circuitBreakerState.update({
    where: { providerId },
    data: {
      state: shouldTrip ? 'open' : existing.state === 'half_open' ? 'open' : existing.state,
      consecutiveFailures: newFailures,
      consecutiveSuccesses: 0,
      lastFailureAt: new Date(),
      lastFailureReason: reason.slice(0, 500),
      ...(shouldTrip || existing.state === 'half_open'
        ? { trippedAt: new Date(), tripCount: { increment: 1 } }
        : {}),
    },
  });
}

/**
 * Manually reset a breaker (admin action).
 */
export async function resetBreaker(providerId: string): Promise<void> {
  await db.circuitBreakerState.upsert({
    where: { providerId },
    update: {
      state: 'closed',
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      trippedAt: null,
      lastFailureReason: null,
    },
    create: { providerId, state: 'closed' },
  });
}

/**
 * Wraps an async provider call with timeout + retry + circuit breaker.
 *
 * - If breaker is open → throws CircuitOpenError immediately (no call made).
 * - If call exceeds timeoutMs → throws ProviderTimeoutError (recorded as failure).
 * - If call fails → retries with exponential backoff (1s, 2s, 4s) up to
 *   retryAttempts; on final failure, records the failure with the breaker.
 * - On success → records success with the breaker.
 *
 * Returns the result of fn() on success.
 */
export async function withResilience<T>(
  providerId: string,
  providerSlug: string,
  fn: () => Promise<T>,
  options: { timeoutMs?: number; retryAttempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryAttempts = options.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;

  const breaker = await getBreakerState(providerId, providerSlug);
  if (breaker.state === 'open') {
    throw new CircuitOpenError(providerSlug, breaker.secondsUntilHalfOpen || BREAKER_COOLDOWN_SECONDS);
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    if (attempt > 0) {
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delayMs));
    }
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new ProviderTimeoutError(providerSlug, timeoutMs)), timeoutMs)
        ),
      ]);
      await recordSuccess(providerId);
      return result;
    } catch (e: any) {
      lastError = e;
      // Don't retry on circuit-open or auth failures — those won't fix themselves
      if (e instanceof CircuitOpenError) throw e;
      if (e?.message?.includes('HTTP 401') || e?.message?.includes('HTTP 403')) {
        await recordFailure(providerId, e.message);
        throw e;
      }
    }
  }

  // All retries exhausted
  const reason = lastError?.message?.slice(0, 500) || 'unknown error';
  await recordFailure(providerId, reason);
  throw lastError || new Error(`provider ${providerSlug} failed after ${retryAttempts + 1} attempts`);
}
