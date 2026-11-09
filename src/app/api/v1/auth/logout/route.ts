/**
 * POST /api/v1/auth/logout
 *
 * Revoke a refresh token (and optionally the access session). The refresh
 * token's `revokedAt` is set so it can no longer be used to mint new access
 * tokens.
 *
 * Per directive §10: logout must invalidate the server-side credential, not
 * just clear the client cookie — otherwise a stolen refresh token remains
 * usable.
 *
 * Body (one of):
 *   { "refreshToken": "rt_live_..." }   // preferred: invalidate this refresh
 *   { "all": true }                     // invalidate ALL refresh tokens for this user
 *
 * Response:
 *   { "revoked": true, "count": 1 }
 */
import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => ({})) || {};

  if (body.all === true) {
    // Revoke every non-expired, non-revoked token for this user
    const result = await db.refreshToken.updateMany({
      where: {
        userId: ctx.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: 'logout_all',
      },
    });
    await emitEvent({
      type: 'auth.logout_all',
      companyId: ctx.companyId,
      userId: ctx.userId,
      resource: 'refresh_token',
      title: 'Logged out everywhere',
      description: `All sessions revoked for ${ctx.email}`,
      metadata: { count: result.count },
    });
    return ok({ revoked: true, count: result.count, scope: 'all' });
  }

  if (!body.refreshToken) return badRequest('refreshToken required (or set all:true)');
  const tokenHash = sha256(body.refreshToken);
  const existing = await db.refreshToken.findUnique({ where: { tokenHash } });
  if (!existing) return ok({ revoked: true, count: 0 }); // idempotent
  if (existing.userId !== ctx.userId) return unauthorized(); // token belongs to someone else

  await db.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date(), revokedReason: 'logout' },
  });

  await emitEvent({
    type: 'auth.logout',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'refresh_token',
    resourceId: existing.id,
    title: 'Logged out',
    description: `Session revoked for ${ctx.email}`,
    metadata: { tokenId: existing.id },
  });

  return ok({ revoked: true, count: 1 });
}
