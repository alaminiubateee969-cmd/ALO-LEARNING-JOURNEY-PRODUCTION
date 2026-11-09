/**
 * POST /api/v1/auth/refresh
 * Accept refresh token, validate hash, rotate (old→new), return new access token.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { createToken } from '@/lib/auth';
import { createHash, randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.refreshToken) {
    return Response.json({ error: 'refreshToken required' }, { status: 400 });
  }

  const tokenHash = sha256(body.refreshToken);
  const stored = await db.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { companyUsers: true } } },
  });

  if (!stored) return Response.json({ error: 'invalid refresh token' }, { status: 401 });
  if (stored.revokedAt) return Response.json({ error: 'token revoked' }, { status: 401 });
  if (stored.rotatedTo) return Response.json({ error: 'token already used (rotated)' }, { status: 401 });
  if (stored.expiresAt.getTime() < Date.now()) return Response.json({ error: 'token expired' }, { status: 401 });

  // Generate new refresh token
  const newRefreshToken = randomBytes(32).toString('hex');
  const newHash = sha256(newRefreshToken);
  const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Rotate
  const newTokenRow = await db.refreshToken.create({
    data: {
      userId: stored.userId,
      tokenHash: newHash,
      companyId: stored.companyId,
      expiresAt: newExpiresAt,
      userAgent: stored.userAgent,
      ipAddress: stored.ipAddress,
    },
  });
  await db.refreshToken.update({
    where: { id: stored.id },
    data: { rotatedTo: newTokenRow.id },
  });

  // Issue new access token
  const companyUser = stored.user.companyUsers[0];
  const accessToken = await createToken({
    userId: stored.user.id,
    email: stored.user.email,
    role: companyUser?.role || 'team_member',
    companyId: companyUser?.companyId || '',
  });

  return Response.json({
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn: 7 * 24 * 60 * 60, // 7 days for access token
  });
}
