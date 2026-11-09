/**
 * GET /api/v1/admin/social-providers
 *
 * Returns the social publishing provider status — whether Postiz is configured,
 * which OAuth providers have client credentials set, and which social accounts
 * are connected in the DB.
 * Super admin only.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, ok } from '@/lib/v1-middleware';
import { isPostizConfigured } from '@/lib/postiz-adapter';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  // Postiz configuration status
  const postizConfigured = isPostizConfigured();

  // OAuth client credentials status per provider
  const oauthProviders = [
    { slug: 'google', clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID', configured: !!process.env.GOOGLE_OAUTH_CLIENT_ID },
    { slug: 'meta', clientIdEnv: 'META_APP_ID', configured: !!process.env.META_APP_ID },
    { slug: 'linkedin', clientIdEnv: 'LINKEDIN_CLIENT_ID', configured: !!process.env.LINKEDIN_CLIENT_ID },
    { slug: 'x', clientIdEnv: 'X_CLIENT_ID', configured: !!process.env.X_CLIENT_ID },
    { slug: 'tiktok', clientIdEnv: 'TIKTOK_CLIENT_KEY', configured: !!process.env.TIKTOK_CLIENT_KEY },
    { slug: 'pinterest', clientIdEnv: 'PINTEREST_APP_ID', configured: !!process.env.PINTEREST_APP_ID },
    { slug: 'youtube', clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID', configured: !!process.env.GOOGLE_OAUTH_CLIENT_ID },
  ];

  // Social accounts connected in DB (per tenant)
  const socialAccounts = await db.socialAccount.findMany({
    where: { companyId: ctx.companyId, status: 'active' },
    select: { id: true, platform: true, accountName: true, accountHandle: true, scopes: true, lastSyncedAt: true },
  });

  return ok({
    postiz: {
      configured: postizConfigured,
      baseUrl: process.env.POSTIZ_BASE_URL || null,
      workspaceId: process.env.POSTIZ_WORKSPACE_ID || null,
      apiKeyConfigured: !!process.env.POSTIZ_API_KEY,
    },
    oauthProviders,
    connectedAccounts: socialAccounts.map((a) => ({
      ...a,
      scopes: a.scopes ? JSON.parse(a.scopes) : [],
      lastSyncedAt: a.lastSyncedAt?.toISOString() || null,
    })),
    publishingStatus: postizConfigured ? 'live' : 'simulation',
    warning: postizConfigured
      ? null
      : 'Postiz not configured. POST /api/v1/social/publish will mark content as scheduled locally only — no real publish. Set POSTIZ_BASE_URL + POSTIZ_API_KEY + POSTIZ_WORKSPACE_ID in .env.',
    cronEndpoint: '/api/cron/social-publish (requires CRON_SECRET)',
  });
}
