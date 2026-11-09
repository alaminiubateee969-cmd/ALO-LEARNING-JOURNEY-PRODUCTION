/**
 * GET  /api/v1/webhooks   — list webhook endpoints for tenant
 * POST /api/v1/webhooks   — create a new webhook endpoint
 *
 * Webhooks fire on events that match the `events` filter (or all events if
 * empty). The HMAC-SHA256 signature in the `X-MarketingOS-Signature` header
 * lets the receiver verify authenticity.
 *
 * Body for POST:
 *   { "url": "https://example.com/webhooks/marketingos",
 *     "events": ["call.originated","call.ended","voicemail.created"] }   // [] = all
 *     "status": "active"|"disabled", "secret": "..." }                    // optional
 */
import { NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { maskSecret } from '@/lib/vault';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const hooks = await db.webhook.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { createdAt: 'desc' },
  });

  return ok({
    webhooks: hooks.map((h) => ({
      ...h,
      events: JSON.parse(h.events || '[]'),
      secretMasked: h.secret ? maskSecret(h.secret) : null, // never return plaintext
      createdAt: h.createdAt.toISOString(),
      updatedAt: h.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin && !['company_owner', 'admin', 'manager'].includes(ctx.role)) {
    return badRequest('manager role required');
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.url) return badRequest('url is required');

  let url: string;
  try {
    url = String(body.url);
    new URL(url); // throws if invalid
  } catch {
    return badRequest('url must be a valid HTTP(S) URL');
  }
  if (!url.startsWith('https://')) {
    return badRequest('webhook URL must use HTTPS');
  }

  // Generate a random signing secret if not provided
  const secret = body.secret || randomBytes(24).toString('hex');
  const events = Array.isArray(body.events) ? body.events : [];

  const created = await db.webhook.create({
    data: {
      url,
      events: JSON.stringify(events),
      status: body.status || 'active',
      secret,
      companyId: ctx.companyId,
    },
  });

  await emitEvent({
    type: 'webhook.created',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'webhook',
    resourceId: created.id,
    title: 'Webhook created',
    description: `Webhook endpoint registered: ${url}`,
    metadata: {
      url,
      events,
      status: created.status,
    },
  });

  return ok({
    webhook: {
      id: created.id,
      url: created.url,
      events: JSON.parse(created.events || '[]'),
      status: created.status,
      secretMasked: maskSecret(secret),
      // Return the secret ONLY at creation time so the client can copy it
      secretOneTime: secret,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
  });
}
