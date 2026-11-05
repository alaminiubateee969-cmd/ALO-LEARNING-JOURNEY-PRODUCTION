/**
 * POST /api/v1/admin/ai-models/providers/{providerId}/discover-models
 *
 * Live model discovery — calls the provider's "list models" endpoint and
 * returns the available models. NEVER assumes a model is available.
 *
 * For Ollama Cloud (https://ollama.com/api), this calls GET /api/models
 * (or the OpenAI-compatible /v1/models endpoint depending on the slug).
 *
 * Optionally auto-imports discovered models into the AiModelEntry table
 * when ?import=true is passed.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, ok, notFound, badRequest } from '@/lib/v1-middleware';
import { decryptSecret } from '@/lib/vault';
import { withResilience } from '@/lib/circuit-breaker';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ providerId: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const { providerId } = await params;
  const provider = await db.aiModelProvider.findUnique({ where: { id: providerId } });
  if (!provider) return notFound('provider not found');

  const url = new URL(request.url);
  const doImport = url.searchParams.get('import') === 'true';

  // Resolve API key
  let apiKey: string | null = null;
  if (provider.secretCipher) {
    try { apiKey = decryptSecret(provider.secretCipher); } catch { /* ignore */ }
  } else if (provider.apiKeyEnvName) {
    apiKey = process.env[provider.apiKeyEnvName] || null;
  }
  if (!apiKey && !provider.apiKeyOptional) {
    return badRequest(`no API key configured for ${provider.slug} — set one first`);
  }

  let discovered: Array<{ modelId: string; displayName: string; contextWindow?: number; capabilities?: string[] }>;
  try {
    discovered = await withResilience(
      provider.id,
      provider.slug,
      () => discoverModels(provider.slug, provider.baseUrl || '', apiKey),
      { timeoutMs: 15_000, retryAttempts: 1 }
    );
  } catch (e: any) {
    return Response.json(
      { ok: false, error: 'discovery_failed', message: e?.message || String(e) },
      { status: 502 }
    );
  }

  if (doImport) {
    let imported = 0;
    let skipped = 0;
    for (const m of discovered) {
      const existing = await db.aiModelEntry.findUnique({
        where: { providerId_modelId: { providerId, modelId: m.modelId } },
      });
      if (existing) {
        skipped++;
        continue;
      }
      await db.aiModelEntry.create({
        data: {
          providerId,
          modelId: m.modelId,
          displayName: m.displayName,
          contextWindow: m.contextWindow || 8192,
          capabilities: JSON.stringify(m.capabilities || ['chat']),
          isEnabled: true,
        },
      });
      imported++;
    }
    return ok({
      provider: provider.slug,
      discovered: discovered.length,
      imported,
      skipped,
      models: discovered,
    });
  }

  return ok({
    provider: provider.slug,
    discovered: discovered.length,
    models: discovered,
    import_hint: `POST /api/v1/admin/ai-models/providers/${providerId}/discover-models?import=true to add all to the registry`,
  });
}

async function discoverModels(slug: string, baseUrl: string, apiKey: string | null): Promise<Array<{ modelId: string; displayName: string; contextWindow?: number; capabilities?: string[] }>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  // Ollama (both local and cloud) — uses /api/tags (legacy) or /v1/models (OpenAI-compatible)
  if (slug === 'ollama' || slug === 'ollama-cloud') {
    // Try OpenAI-compatible endpoint first, fall back to legacy /api/tags
    let res = await fetch(`${baseUrl}/v1/models`, { headers, cache: 'no-store' }).catch(() => null);
    if (res && res.ok) {
      const data: any = await res.json();
      return (data.data || []).map((m: any) => ({
        modelId: m.id,
        displayName: m.id,
        contextWindow: m.context_length || 8192,
        capabilities: ['chat'],
      }));
    }
    // Legacy /api/tags
    res = await fetch(`${baseUrl}/api/tags`, { headers, cache: 'no-store' }).catch(() => null);
    if (res && res.ok) {
      const data: any = await res.json();
      return (data.models || []).map((m: any) => ({
        modelId: m.name,
        displayName: m.name,
        contextWindow: m.details?.parameter_size ? 8192 : 8192,
        capabilities: ['chat'],
      }));
    }
    throw new Error(`could not list models from ${baseUrl}/v1/models or ${baseUrl}/api/tags — HTTP ${res?.status || 'unreachable'}`);
  }

  // OpenAI-compatible providers (groq, openrouter, mistral, opencode) — /v1/models
  if (slug === 'groq' || slug === 'openrouter' || slug === 'mistral' || slug === 'opencode') {
    const res = await fetch(`${baseUrl}/models`, { headers, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: any = await res.json();
    return (data.data || []).map((m: any) => ({
      modelId: m.id,
      displayName: m.id,
      contextWindow: m.context_length || m.context_window || 8192,
      capabilities: m.capabilities || ['chat'],
    }));
  }

  // Gemini — /v1beta/models
  if (slug === 'gemini') {
    const res = await fetch(`${baseUrl}/models?key=${apiKey}`, { headers, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: any = await res.json();
    return (data.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => ({
        modelId: m.name.replace('models/', ''),
        displayName: m.displayName || m.name,
        contextWindow: m.inputTokenLimit || 8192,
        capabilities: ['chat'],
      }));
  }

  // Cloudflare — /accounts/{id}/ai/models/search
  if (slug === 'cloudflare') {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search`;
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: any = await res.json();
    return (data.result || []).map((m: any) => ({
      modelId: m.id,
      displayName: m.name || m.id,
      contextWindow: 8192,
      capabilities: ['chat'],
    }));
  }

  // Hugging Face — cannot list (no /models endpoint), return seeded defaults
  if (slug === 'huggingface') {
    return [
      { modelId: 'meta-llama/Llama-3.3-70B-Instruct', displayName: 'Llama 3.3 70B Instruct' },
      { modelId: 'mistralai/Mistral-7B-Instruct-v0.3', displayName: 'Mistral 7B Instruct v0.3' },
    ];
  }

  // Z.AI — uses SDK, but also exposes /api/v1/models
  if (slug === 'zai') {
    const res = await fetch(`${baseUrl}/models`, { headers, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: any = await res.json();
    return (data.data || []).map((m: any) => ({
      modelId: m.id,
      displayName: m.id,
      contextWindow: 128000,
      capabilities: ['chat'],
    }));
  }

  // Generic fallback: try OpenAI-compatible /v1/models
  try {
    const res = await fetch(`${baseUrl}/models`, { headers, cache: 'no-store' });
    if (res.ok) {
      const data: any = await res.json();
      return (data.data || []).map((m: any) => ({
        modelId: m.id,
        displayName: m.id,
        contextWindow: m.context_length || 8192,
        capabilities: ['chat'],
      }));
    }
  } catch { /* fall through */ }

  throw new Error(`no discovery method implemented for provider "${slug}"`);
}
