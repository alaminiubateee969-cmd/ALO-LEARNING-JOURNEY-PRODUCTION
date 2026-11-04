/**
 * PATCH  /api/v1/admin/ai-models/providers/{providerId}/models/{modelId}  — update model
 * DELETE /api/v1/admin/ai-models/providers/{providerId}/models/{modelId}  — delete model
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, badRequest, ok, notFound } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ providerId: string; modelId: string }> }
) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const { providerId, modelId } = await params;
  const existing = await db.aiModelEntry.findUnique({
    where: { providerId_modelId: { providerId, modelId } },
  });
  if (!existing) return notFound('model not found');

  const body = await request.json().catch(() => null);
  if (!body) return badRequest('body required');

  const update: any = {};
  for (const k of ['displayName', 'contextWindow', 'isDefault', 'maxOutputTokens', 'freeTierNote', 'isEnabled']) {
    if (k in body) update[k] = body[k];
  }
  if (Array.isArray(body.capabilities)) {
    update.capabilities = JSON.stringify(body.capabilities);
  }

  // If setting isDefault=true, unset previous default
  if (body.isDefault === true) {
    await db.aiModelEntry.updateMany({ where: { providerId, isDefault: true }, data: { isDefault: false } });
  }

  const updated = await db.aiModelEntry.update({
    where: { providerId_modelId: { providerId, modelId } },
    data: update,
  });

  return ok({
    id: updated.id,
    modelId: updated.modelId,
    displayName: updated.displayName,
    isEnabled: updated.isEnabled,
    isDefault: updated.isDefault,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ providerId: string; modelId: string }> }
) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const { providerId, modelId } = await params;
  const existing = await db.aiModelEntry.findUnique({
    where: { providerId_modelId: { providerId, modelId } },
  });
  if (!existing) return notFound('model not found');

  await db.aiModelEntry.delete({ where: { providerId_modelId: { providerId, modelId } } });
  return ok({ deleted: true, modelId });
}
