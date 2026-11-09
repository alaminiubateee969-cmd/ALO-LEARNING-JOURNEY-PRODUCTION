/**
 * GET /api/v1/admin/voice-engine-status
 *
 * Super-admin overview of the AI Voice Engine layer:
 *   - TTS provider status (Piper / Z.AI / Kokoro / Tortoise)
 *   - ASR provider status (faster-whisper / WhisperX / whisper.cpp / Z.AI)
 *   - Voice model catalog summary
 *   - Voice clone authorizations across all tenants
 *   - 7-day usage aggregates for TTS + ASR
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, ok } from '@/lib/v1-middleware';
import { getTtsProviderStatus } from '@/lib/voice-engine';
import { getAsrProviderStatus } from '@/lib/asr-engine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const since7d = new Date(Date.now() - 7 * 86400_000);
  const sinceDay = since7d.toISOString().slice(0, 10);

  const [
    ttsProviders,
    asrProviders,
    voiceModels,
    cloneAuths,
    ttsUsage,
    asrUsage,
    cloneUsageCount,
  ] = await Promise.all([
    Promise.resolve(getTtsProviderStatus()),
    Promise.resolve(getAsrProviderStatus()),
    db.voiceModel.findMany({ take: 500 }),
    db.voiceCloneAuthorization.findMany({
      where: { revokedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    db.ttsUsageDaily.findMany({ where: { day: { gte: sinceDay } } }),
    db.asrUsageDaily.findMany({ where: { day: { gte: sinceDay } } }),
    db.voiceCloneUsageLog.count({ where: { createdAt: { gte: since7d } } }),
  ]);

  const agg = (rows: any[], sumField: string) =>
    rows.reduce((acc, r) => acc + (Number(r[sumField] || 0)), 0);

  const ttsByProvider: Record<string, { chars: number; seconds: number }> = {};
  for (const r of ttsUsage) {
    if (!ttsByProvider[r.provider]) ttsByProvider[r.provider] = { chars: 0, seconds: 0 };
    ttsByProvider[r.provider].chars += r.charactersSynthesized;
    ttsByProvider[r.provider].seconds += r.audioSecondsGenerated;
  }
  const asrByProvider: Record<string, { seconds: number; chars: number }> = {};
  for (const r of asrUsage) {
    if (!asrByProvider[r.provider]) asrByProvider[r.provider] = { seconds: 0, chars: 0 };
    asrByProvider[r.provider].seconds += r.audioSecondsProcessed;
    asrByProvider[r.provider].chars += r.charactersTranscribed;
  }

  return ok({
    tts: {
      providers: ttsProviders,
      anyConfigured: ttsProviders.some((p) => p.configured),
      deliveryStatus: ttsProviders.some((p) => p.configured) ? 'live' : 'simulation',
      usage7d: {
        totalCharacters: agg(ttsUsage, 'charactersSynthesized'),
        totalAudioSeconds: agg(ttsUsage, 'audioSecondsGenerated'),
        byProvider: ttsByProvider,
      },
    },
    asr: {
      providers: asrProviders,
      anyConfigured: asrProviders.some((p) => p.configured),
      deliveryStatus: asrProviders.some((p) => p.configured) ? 'live' : 'simulation',
      usage7d: {
        totalAudioSeconds: agg(asrUsage, 'audioSecondsProcessed'),
        totalCharacters: agg(asrUsage, 'charactersTranscribed'),
        byProvider: asrByProvider,
      },
    },
    voiceModels: {
      total: voiceModels.length,
      enabled: voiceModels.filter((m) => m.isEnabled).length,
      byLanguage: voiceModels.reduce((acc, m) => {
        acc[m.language] = (acc[m.language] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    },
    voiceClone: {
      activeAuthorizations: cloneAuths.length,
      usageLogs7d: cloneUsageCount,
      authorizations: cloneAuths.map((a) => ({
        id: a.id,
        companyId: a.companyId,
        ownerName: a.ownerName,
        consentScope: a.consentScope,
        grantedAt: a.grantedAt.toISOString(),
        expiresAt: a.expiresAt?.toISOString() || null,
      })),
    },
  });
}
