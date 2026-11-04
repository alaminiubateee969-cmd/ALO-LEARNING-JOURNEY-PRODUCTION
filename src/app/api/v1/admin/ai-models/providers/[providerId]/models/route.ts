/**
 * POST /api/v1/admin/ai-models/providers/{providerId}/models
 *
 * Add a new model entry to an existing provider.
 *
 * Body:
 *   { "modelId": "llama-3.3-70b-versatile", "displayName": "Llama 3.3 70B",
 *     "contextWindow": 128000, "capabilities": ["chat", "tools"],
 *     "isDefault": false, "maxOutputTokens": 8192, "freeTierNote": "..." }
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, badRequest, ok, notFound } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ providerId: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const { providerId } = await params;
  const provider = await db.aiModelProvider.findUnique({ where: { id: providerId } });
  if (!provider) return notFound('provider not found');

  const body = await request.json().catch(() => null);
  if (!body || !body.modelId || !body.displayName) {
    return badRequest('modelId and displayName are required');
  }

  // Check uniqueness
  const existing = await db.aiModelEntry.findUnique({
    where: { providerId_modelId: { providerId, modelId: body.modelId } },
  });
  if (existing) return badRequest(`model "${body.modelId}" already exists for this provider`);

  // If isDefault=true, unset previous default
  if (body.isDefault === true) {
    await db.aiModelEntry.updateMany({ where: { providerId, isDefault: true }, data: { isDefault: false } });
  }

  const model = await db.aiModelEntry.create({
    data: {
      providerId,
      modelId: body.modelId,
      displayName: body.displayName,
      contextWindow: body.contextWindow ?? 8192,
      capabilities: JSON.stringify(body.capabilities ?? ['chat']),
      isDefault: body.isDefault ?? false,
      maxOutputTokens: body.maxOutputTokens ?? 4096,
      freeTierNote: body.freeTierNote ?? null,
      isEnabled: body.isEnabled ?? true,
      createdBy: ctx.userId,
    },
  });

  return ok({
    id: model.id,
    providerId,
    modelId: model.modelId,
    displayName: model.displayName,
  });
}
