/**
 * GET  /api/v1/admin/ai-models/providers        — list all providers (super_admin only)
 * POST /api/v1/admin/ai-models/providers        — create new provider
 *
 * Body for POST:
 *   { "slug": "...", "label": "...", "baseUrl": "...", "category": "free|self-hosted",
 *     "openAiCompatible": true, "apiKeyOptional": false, "apiKeyEnvName": "...",
 *     "docsUrl": "...", "rateLimitNote": "...", "notes": "...", "priority": 50,
 *     "api_key": "secret-key" }  // api_key is OPTIONAL; if provided, it's encrypted via vault
 *
 * The api_key is NEVER returned in any response. Only the masked value is returned.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, badRequest, ok, notFound } from '@/lib/v1-middleware';
import { encryptSecret, maskSecret } from '@/lib/vault';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const providers = await db.aiModelProvider.findMany({
    include: { models: true, _count: { select: { models: true } } },
    orderBy: [{ priority: 'asc' }, { label: 'asc' }],
  });

  return ok({
    providers: providers.map((p) => ({
      id: p.id,
      slug: p.slug,
      label: p.label,
      category: p.category,
      baseUrl: p.baseUrl,
      openAiCompatible: p.openAiCompatible,
      apiKeyOptional: p.apiKeyOptional,
      apiKeyEnvName: p.apiKeyEnvName,
      apiKeyConfigured: !!p.secretCipher || (!!p.apiKeyEnvName && !!process.env[p.apiKeyEnvName]),
      apiKeyMasked: p.secretMasked || (p.apiKeyEnvName && process.env[p.apiKeyEnvName] ? maskSecret(process.env[p.apiKeyEnvName]!) : null),
      isEnabled: p.isEnabled,
      priority: p.priority,
      lastCheckedAt: p.lastCheckedAt?.toISOString() || null,
      lastStatus: p.lastStatus,
      lastError: p.lastError,
      docsUrl: p.docsUrl,
      rateLimitNote: p.rateLimitNote,
      notes: p.notes,
      modelCount: p._count.models,
      models: p.models.map((m) => ({
        id: m.id,
        modelId: m.modelId,
        displayName: m.displayName,
        contextWindow: m.contextWindow,
        capabilities: JSON.parse(m.capabilities || '[]'),
        isDefault: m.isDefault,
        isEnabled: m.isEnabled,
        maxOutputTokens: m.maxOutputTokens,
        freeTierNote: m.freeTierNote,
      })),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const body = await request.json().catch(() => null);
  if (!body || !body.slug || !body.label) {
    return badRequest('slug and label are required');
  }

  // Reject duplicate slug
  const existing = await db.aiModelProvider.findUnique({ where: { slug: body.slug } });
  if (existing) return badRequest(`provider slug "${body.slug}" already exists`);

  // Encrypt API key if provided
  let secretCipher: string | undefined;
  let secretKeyVersion: number | undefined;
  let secretMasked: string | undefined;
  if (body.api_key && typeof body.api_key === 'string') {
    const enc = encryptSecret(body.api_key);
    secretCipher = enc.ciphertext;
    secretKeyVersion = enc.keyVersion;
    secretMasked = maskSecret(body.api_key);
  }

  const provider = await db.aiModelProvider.create({
    data: {
      slug: body.slug,
      label: body.label,
      category: body.category || 'free',
      baseUrl: body.baseUrl || null,
      openAiCompatible: body.openAiCompatible ?? true,
      apiKeyOptional: body.apiKeyOptional ?? false,
      apiKeyEnvName: body.apiKeyEnvName || null,
      docsUrl: body.docsUrl || null,
      rateLimitNote: body.rateLimitNote || null,
      notes: body.notes || null,
      priority: body.priority ?? 100,
      isEnabled: body.isEnabled ?? true,
      secretCipher,
      secretKeyVersion,
      secretMasked,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    include: { models: true },
  });

  return ok({
    id: provider.id,
    slug: provider.slug,
    label: provider.label,
    api_key_masked: provider.secretMasked || null,
    api_key_configured: !!provider.secretCipher,
  });
}
