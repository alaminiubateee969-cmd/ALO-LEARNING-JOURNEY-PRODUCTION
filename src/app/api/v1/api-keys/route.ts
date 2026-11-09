/**
 * GET /api/v1/api-keys
 *
 * List API keys for the current tenant. Returns masked values only — the full
 * key is shown ONCE at creation time (POST /api/settings/api-keys, which is
 * the canonical key-creation endpoint).
 *
 * Per directive §5: API keys include `scopes` (JSON array of permission
 * scopes like ["calls:read","billing:read"]) and `rateLimitPerMin`
 * (nullable; null = use the company's default rate limit).
 *
 * To create/rotate keys, see `/api/settings/api-keys` (existing route).
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, ok } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin && !['company_owner', 'admin'].includes(ctx.role)) {
    return forbidden('admin role required');
  }

  const keys = await db.apiKey.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { createdAt: 'desc' },
  });

  return ok({
    apiKeys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      keyMasked: `${k.keyPrefix}********************************`,
      scopes: JSON.parse(k.scopes || '[]'),
      rateLimitPerMin: k.rateLimitPerMin,
      expiresAt: k.expiresAt?.toISOString() || null,
      lastUsedAt: k.lastUsedAt?.toISOString() || null,
      createdAt: k.createdAt.toISOString(),
    })),
    defaultRateLimitPerMin: 60,
  });
}
