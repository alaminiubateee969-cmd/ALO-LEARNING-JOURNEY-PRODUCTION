/**
 * GET    /api/v1/admin/ai-models/providers/{providerId}   — get one provider
 * PATCH  /api/v1/admin/ai-models/providers/{providerId}   — update provider fields / rotate key
 * DELETE /api/v1/admin/ai-models/providers/{providerId}   — delete provider (+ cascade models)
 *
 * PATCH body (any subset):
 *   { "label": "...", "baseUrl": "...", "isEnabled": true, "priority": 50,
 *     "api_key": "...", "notes": "..." }
 *
 * When api_key is supplied, it OVERWRITES the existing encrypted key.
 * The api_key is NEVER returned in the response.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, badRequest, ok, notFound } from '@/lib/v1-middleware';
import { encryptSecret, maskSecret } from '@/lib/vault';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ providerId: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const { providerId } = await params;
  const p = await db.aiModelProvider.findUnique({
    where: { id: providerId },
    include: { models: true },
  });
  if (!p) return notFound('provider not found');

  return ok({
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
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ providerId: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const { providerId } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return badRequest('body required');

  const existing = await db.aiModelProvider.findUnique({ where: { id: providerId } });
  if (!existing) return notFound('provider not found');

  const update: any = { updatedBy: ctx.userId };
  for (const k of ['label', 'baseUrl', 'category', 'openAiCompatible', 'apiKeyOptional', 'apiKeyEnvName', 'docsUrl', 'rateLimitNote', 'notes', 'priority', 'isEnabled']) {
    if (k in body) update[k] = body[k];
  }

  if (typeof body.api_key === 'string' && body.api_key.length > 0) {
    const enc = encryptSecret(body.api_key);
    update.secretCipher = enc.ciphertext;
    update.secretKeyVersion = enc.keyVersion;
    update.secretMasked = maskSecret(body.api_key);
  } else if (body.clear_api_key === true) {
    update.secretCipher = null;
    update.secretKeyVersion = null;
    update.secretMasked = null;
  }

  const updated = await db.aiModelProvider.update({ where: { id: providerId }, data: update });
  return ok({
    id: updated.id,
    slug: updated.slug,
    label: updated.label,
    isEnabled: updated.isEnabled,
    priority: updated.priority,
    api_key_masked: updated.secretMasked,
    api_key_configured: !!updated.secretCipher,
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ providerId: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const { providerId } = await params;
  const existing = await db.aiModelProvider.findUnique({ where: { id: providerId } });
  if (!existing) return notFound('provider not found');

  // Cascade delete models first (Prisma cascade should handle, but explicit)
  await db.aiModelEntry.deleteMany({ where: { providerId } });
  await db.aiModelProvider.delete({ where: { id: providerId } });

  return ok({ deleted: true, id: providerId, slug: existing.slug });
}
