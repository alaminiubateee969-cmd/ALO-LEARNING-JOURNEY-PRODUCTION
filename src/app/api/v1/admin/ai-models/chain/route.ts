// @ts-nocheck — temporary: see audit for fix plan
/**
 * GET /api/v1/admin/ai-models/chain
 *
 * Returns the live AI chain order — what ai-chain.ts will actually try
 * at runtime, in order, given the current provider + model isEnabled
 * flags. Useful for the admin UI to preview "what will happen if a
 * request comes in right now."
 *
 * Response:
 *   { "chain": [
 *       { "provider": "zai", "model": "glm-4.6", "priority": 10,
 *         "api_key_configured": true },
 *       { "provider": "groq", "model": "llama-3.3-70b-versatile", ... },
 *       ...
 *       { "provider": "rule-based", "model": "rule-based", "priority": 9999,
 *         "api_key_configured": null }
 *   ] }
 *
 * The chain ALWAYS ends with rule-based — it never fails.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, ok } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const providers = await db.aiModelProvider.findMany({
    where: { isEnabled: true },
    include: { models: { where: { isEnabled: true } } },
    orderBy: [{ priority: 'asc' }, { label: 'asc' }],
  });

  const chain = providers.map((p) => {
    const defaultModel = p.models.find((m) => m.isDefault) || p.models[0];
    const apiKeyConfigured =
      !!p.secretCipher ||
      (!!p.apiKeyEnvName && !!process.env[p.apiKeyEnvName]) ||
      p.apiKeyOptional;
    return {
      provider: p.slug,
      label: p.label,
      model: defaultModel?.modelId || null,
      modelDisplayName: defaultModel?.displayName || null,
      priority: p.priority,
      api_key_configured: apiKeyConfigured,
      last_status: p.lastStatus,
      last_checked_at: p.lastCheckedAt?.toISOString() || null,
      will_skip_if_unconfigured: !apiKeyConfigured,
    };
  });

  // Always end with rule-based
  chain.push({
    provider: 'rule-based',
    label: 'Rule-Based Fallback (deterministic)',
    model: 'rule-based',
    modelDisplayName: 'Rule-Based Fallback',
    priority: 9999,
    api_key_configured: null as boolean | null,
    last_status: null,
    last_checked_at: null,
    will_skip_if_unconfigured: false,
  });

  return ok({
    chain,
    total_steps: chain.length,
    active_llm_steps: chain.filter((s) => s.provider !== 'rule-based' && s.api_key_configured).length,
    fallback_step: 'rule-based (always last)',
  });
}
