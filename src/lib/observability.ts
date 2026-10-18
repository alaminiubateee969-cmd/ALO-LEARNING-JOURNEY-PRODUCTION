/**
 * ALO Structured Observability
 * Correlation IDs + structured JSON logs for every generation stage.
 * Never logs secrets, tokens, passwords, or full user prompts (truncated).
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogContext {
  jobId?: string;
  ownerId?: string;
  avatarId?: string;
  stage?: string;
  [key: string]: unknown;
}

const REDACT_KEYS = new Set([
  'password', 'token', 'secret', 'apiKey', 'authorization', 'cookie',
  'NEXTAUTH_SECRET', 'ALO_ADMIN_PASSWORD_HASH', 'LIPSYNC_SERVICE_URL',
]);

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (REDACT_KEYS.has(k)) { out[k] = '[REDACTED]'; continue; }
    if (typeof v === 'string' && v.length > 200) out[k] = v.slice(0, 200) + '...[truncated]';
    else if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = redact(v as Record<string, unknown>);
    else out[k] = v;
  }
  return out;
}

export function log(level: LogLevel, message: string, ctx: LogContext = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...redact(ctx),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export function newJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function truncatePrompt(p: string, n = 80): string {
  return p.length > n ? p.slice(0, n) + '...' : p;
}
