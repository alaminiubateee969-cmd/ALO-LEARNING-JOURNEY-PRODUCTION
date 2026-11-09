/**
 * GET  /api/v1/voice-models   — list voice models in the catalog
 * POST /api/v1/voice-models   — register a new voice model
 *
 * The VoiceModel table is a global catalog (not tenant-scoped) — same as a
 * "model registry" — so super_admin manages the master list and tenants pick
 * from it. POST is therefore super_admin only.
 *
 * Body for POST:
 *   { "provider": "piper"|"kokoro"|"cosyvoice"|"tortoise"|"zai",
 *     "modelId": "bn_BD-google-medium",
 *     "displayName": "Bangla Google (Medium)",
 *     "language": "bn-BD", "gender": "male"|"female"|"neutral",
 *     "style": "formal"|"friendly"|"casual"|"narrator",
 *     "quality": "x_low"|"low"|"medium"|"high",
 *     "sampleRateHz": 22050, "license": "MIT",
 *     "commercialUseOk": true, "isEnabled": true }
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, badRequest, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const url = new URL(request.url);
  const language = url.searchParams.get('language');
  const provider = url.searchParams.get('provider');
  const enabled = url.searchParams.get('enabled');

  const where: any = {};
  if (language) where.language = language;
  if (provider) where.provider = provider;
  if (enabled === 'true') where.isEnabled = true;
  if (enabled === 'false') where.isEnabled = false;

  const models = await db.voiceModel.findMany({
    where,
    orderBy: [{ language: 'asc' }, { provider: 'asc' }, { displayName: 'asc' }],
  });

  return ok({
    voiceModels: models.map((m) => ({
      ...m,
      evaluatedAt: m.evaluatedAt?.toISOString() || null,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const body = await request.json().catch(() => null);
  if (!body || !body.provider || !body.modelId || !body.displayName) {
    return badRequest('provider, modelId, displayName are required');
  }

  const existing = await db.voiceModel.findUnique({
    where: { provider_modelId: { provider: body.provider, modelId: body.modelId } },
  });
  if (existing) return badRequest(`model ${body.provider}/${body.modelId} already exists`);

  const created = await db.voiceModel.create({
    data: {
      provider: body.provider,
      modelId: body.modelId,
      displayName: body.displayName,
      language: body.language || 'bn-BD',
      gender: body.gender || null,
      style: body.style || null,
      quality: body.quality || 'medium',
      sampleRateHz: body.sampleRateHz ?? 22050,
      license: body.license || null,
      commercialUseOk: body.commercialUseOk ?? true,
      cloneAuthorizationId: body.cloneAuthorizationId || null,
      isEnabled: body.isEnabled ?? true,
    },
  });

  await emitEvent({
    type: 'voice_model.registered',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'voice_model',
    resourceId: created.id,
    title: 'Voice model registered',
    description: `Voice model "${created.displayName}" (${created.provider}/${created.modelId}) registered`,
    metadata: { language: created.language, quality: created.quality },
  });

  return ok({
    voiceModel: {
      ...created,
      evaluatedAt: created.evaluatedAt?.toISOString() || null,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
  });
}
