/**
 * AI Model Registry — default free providers + models seeded on first run.
 *
 * Run with: npx tsx prisma/seed-ai-models.ts
 *
 * Idempotent: providers are upserted by slug; models by (providerId, modelId).
 * API keys are NEVER seeded here — super admins add their own keys via the
 * Super Admin UI. The chain works for providers that don't require a key
 * (local Ollama) even before keys are added.
 *
 * All providers in this seed are FREE tier or self-hosted (no paid APIs).
 * Per the master directive: "ONLY open-source/free technologies — NO paid APIs."
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ProviderSeed {
  slug: string;
  label: string;
  category: 'free' | 'self-hosted' | 'hybrid';
  baseUrl?: string;
  openAiCompatible: boolean;
  apiKeyOptional: boolean;
  apiKeyEnvName?: string;
  docsUrl: string;
  rateLimitNote?: string;
  priority: number;
  notes?: string;
  models: Array<{
    modelId: string;
    displayName: string;
    contextWindow: number;
    capabilities: string[];
    isDefault?: boolean;
    maxOutputTokens?: number;
    freeTierNote?: string;
  }>;
}

const PROVIDERS: ProviderSeed[] = [
  {
    slug: 'zai',
    label: 'Z.AI (GLM-4.6)',
    category: 'free',
    baseUrl: 'https://api.z.ai/api/v1',
    openAiCompatible: true,
    apiKeyOptional: false,
    apiKeyEnvName: 'ZAI_API_KEY',
    docsUrl: 'https://docs.z.ai',
    rateLimitNote: 'Free tier — generous quota for development',
    priority: 10,
    notes: 'Primary provider. Reads API key from /etc/.z-ai-config JSON file (not env var). The ZAI_API_KEY env var is for documentation only — the SDK does not read it.',
    models: [
      { modelId: 'glm-4.6', displayName: 'GLM-4.6', contextWindow: 128000, capabilities: ['chat', 'tools', 'json_mode', 'vision'], isDefault: true, maxOutputTokens: 8192 },
      { modelId: 'glm-4-plus', displayName: 'GLM-4 Plus', contextWindow: 128000, capabilities: ['chat', 'tools', 'json_mode'], maxOutputTokens: 4096 },
      { modelId: 'glm-4-flash', displayName: 'GLM-4 Flash (fast)', contextWindow: 128000, capabilities: ['chat'], maxOutputTokens: 4096, freeTierNote: 'Fastest free tier' },
    ],
  },
  {
    slug: 'groq',
    label: 'Groq (Llama 3.3)',
    category: 'free',
    baseUrl: 'https://api.groq.com/openai/v1',
    openAiCompatible: true,
    apiKeyOptional: false,
    apiKeyEnvName: 'GROQ_API_KEY',
    docsUrl: 'https://console.groq.com/docs',
    rateLimitNote: 'Free tier: 30 req/min, 14,400 req/day',
    priority: 20,
    models: [
      { modelId: 'llama-3.3-70b-versatile', displayName: 'Llama 3.3 70B Versatile', contextWindow: 128000, capabilities: ['chat', 'tools', 'json_mode'], isDefault: true, maxOutputTokens: 32768 },
      { modelId: 'llama-3.1-8b-instant', displayName: 'Llama 3.1 8B Instant', contextWindow: 128000, capabilities: ['chat'], maxOutputTokens: 8192, freeTierNote: 'Fastest Groq model' },
      { modelId: 'mixtral-8x7b-32768', displayName: 'Mixtral 8x7B', contextWindow: 32768, capabilities: ['chat'], maxOutputTokens: 32768 },
    ],
  },
  {
    slug: 'gemini',
    label: 'Google Gemini (AI Studio)',
    category: 'free',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    openAiCompatible: false,
    apiKeyOptional: false,
    apiKeyEnvName: 'GEMINI_API_KEY',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
    rateLimitNote: 'Free tier: 15 req/min, 1500 req/day',
    priority: 30,
    models: [
      { modelId: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash', contextWindow: 1000000, capabilities: ['chat', 'vision', 'tools'], isDefault: true, maxOutputTokens: 8192, freeTierNote: '1M context window' },
      { modelId: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', contextWindow: 2000000, capabilities: ['chat', 'vision', 'tools'], maxOutputTokens: 8192 },
      { modelId: 'gemini-2.0-flash-exp', displayName: 'Gemini 2.0 Flash (experimental)', contextWindow: 1000000, capabilities: ['chat', 'vision'], maxOutputTokens: 8192 },
    ],
  },
  {
    slug: 'openrouter',
    label: 'OpenRouter (Free Models)',
    category: 'free',
    baseUrl: 'https://openrouter.ai/api/v1',
    openAiCompatible: true,
    apiKeyOptional: false,
    apiKeyEnvName: 'OPENROUTER_API_KEY',
    docsUrl: 'https://openrouter.ai/docs',
    rateLimitNote: 'Free models: 20 req/min, 200 req/day on free tier',
    priority: 40,
    notes: 'Only :free suffixed models are used by the chain — paid models are never auto-selected.',
    models: [
      { modelId: 'meta-llama/llama-3.3-70b-instruct:free', displayName: 'Llama 3.3 70B (free)', contextWindow: 128000, capabilities: ['chat'], isDefault: true, maxOutputTokens: 8192 },
      { modelId: 'google/gemini-2.0-flash-exp:free', displayName: 'Gemini 2.0 Flash (free)', contextWindow: 1000000, capabilities: ['chat', 'vision'], maxOutputTokens: 8192 },
      { modelId: 'mistralai/mistral-7b-instruct:free', displayName: 'Mistral 7B (free)', contextWindow: 32768, capabilities: ['chat'], maxOutputTokens: 8192 },
      { modelId: 'qwen/qwen-2.5-72b-instruct:free', displayName: 'Qwen 2.5 72B (free)', contextWindow: 32768, capabilities: ['chat'], maxOutputTokens: 8192 },
    ],
  },
  {
    slug: 'ollama',
    label: 'Ollama (Self-Hosted Local)',
    category: 'self-hosted',
    baseUrl: 'http://localhost:11434',
    openAiCompatible: false,
    apiKeyOptional: true,
    apiKeyEnvName: 'OLLAMA_API_KEY',
    docsUrl: 'https://ollama.com',
    rateLimitNote: 'No rate limit — bound by local hardware',
    priority: 50,
    notes: 'Self-hosted local Ollama. No API key required unless fronted by an authenticated proxy. Models must be pulled first: `ollama pull llama3.2`. Distinct from Ollama Cloud (which is a separate metered cloud service at https://ollama.com/api).',
    models: [
      { modelId: 'llama3.2', displayName: 'Llama 3.2 (3B)', contextWindow: 128000, capabilities: ['chat'], isDefault: true, maxOutputTokens: 4096, freeTierNote: 'Lightest — runs on CPU' },
      { modelId: 'llama3.3', displayName: 'Llama 3.3 (70B)', contextWindow: 128000, capabilities: ['chat', 'tools'], maxOutputTokens: 8192, freeTierNote: 'Requires 32GB+ RAM' },
      { modelId: 'qwen2.5', displayName: 'Qwen 2.5 (7B)', contextWindow: 32768, capabilities: ['chat'], maxOutputTokens: 8192 },
      { modelId: 'deepseek-r1', displayName: 'DeepSeek R1 (reasoning)', contextWindow: 64000, capabilities: ['chat'], maxOutputTokens: 8192, freeTierNote: 'Reasoning model' },
      { modelId: 'bge-m3', displayName: 'BGE-M3 (embeddings)', contextWindow: 8000, capabilities: ['embedding'], maxOutputTokens: 0, freeTierNote: 'For RAG embeddings' },
    ],
  },
  {
    slug: 'ollama-cloud',
    label: 'Ollama Cloud (Metered Cloud)',
    category: 'hybrid',
    baseUrl: 'https://ollama.com/api',
    openAiCompatible: false,
    apiKeyOptional: false,
    apiKeyEnvName: 'OLLAMA_CLOUD_API_KEY',
    docsUrl: 'https://ollama.com/cloud',
    rateLimitNote: 'Metered cloud — paid per-token usage. Check plan limits and pricing at https://ollama.com/cloud/pricing before enabling.',
    priority: 55,
    notes: 'Ollama Cloud is a SEPARATE provider from local Ollama (slug "ollama"). Cloud is metered (paid per token); local is free on your hardware. Set OLLAMA_CLOUD_API_KEY in .env to enable. Models are DISCOVERED at runtime via /api/v1/admin/ai-models/providers/{id}/discover-models — do NOT assume any model is available without discovering it first. Local Ollama and Ollama Cloud can both be enabled simultaneously; the chain will try them in priority order.',
    models: [],  // discovered at runtime — see /discover-models endpoint
  },
  {
    slug: 'opencode',
    label: 'OpenCode (Local LLM Proxy)',
    category: 'self-hosted',
    baseUrl: 'http://localhost:4096/v1',
    openAiCompatible: true,
    apiKeyOptional: true,
    apiKeyEnvName: 'OPENCODE_API_KEY',
    docsUrl: 'https://github.com/sst/opencode',
    rateLimitNote: 'No rate limit — local proxy',
    priority: 60,
    notes: 'Self-hosted local proxy that routes to local Ollama/llama.cpp models with adaptive routing. Set baseUrl to your OpenCode instance. No API key required unless fronted by an authenticated proxy.',
    models: [
      { modelId: 'local', displayName: 'OpenCode Default Route', contextWindow: 128000, capabilities: ['chat', 'tools'], isDefault: true, maxOutputTokens: 8192, freeTierNote: 'Routes to local model with adaptive policy' },
    ],
  },
  {
    slug: 'cloudflare',
    label: 'Cloudflare Workers AI',
    category: 'free',
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai',
    openAiCompatible: false,
    apiKeyOptional: false,
    apiKeyEnvName: 'CLOUDFLARE_API_TOKEN',
    docsUrl: 'https://developers.cloudflare.com/workers-ai/',
    rateLimitNote: 'Free tier: 10,000 neurons/day',
    priority: 70,
    notes: 'Requires CLOUDFLARE_ACCOUNT_ID env var as well. Set baseUrl with {account_id} placeholder OR configure account id in provider notes.',
    models: [
      { modelId: '@cf/meta/llama-3.1-8b-instruct', displayName: 'Llama 3.1 8B Instruct', contextWindow: 8000, capabilities: ['chat'], isDefault: true, maxOutputTokens: 4096 },
      { modelId: '@cf/mistral/mistral-7b-instruct-v0.1', displayName: 'Mistral 7B Instruct', contextWindow: 8000, capabilities: ['chat'], maxOutputTokens: 4096 },
      { modelId: '@cf/baai/bge-base-en-v1.5', displayName: 'BGE Base (embeddings)', contextWindow: 8000, capabilities: ['embedding'], maxOutputTokens: 0 },
    ],
  },
  {
    slug: 'mistral',
    label: 'Mistral AI (La Plateforme)',
    category: 'free',
    baseUrl: 'https://api.mistral.ai/v1',
    openAiCompatible: true,
    apiKeyOptional: false,
    apiKeyEnvName: 'MISTRAL_API_KEY',
    docsUrl: 'https://docs.mistral.ai',
    rateLimitNote: 'Free tier: 1 req/sec, 500,000 tokens/month',
    priority: 80,
    models: [
      { modelId: 'mistral-small-latest', displayName: 'Mistral Small (latest)', contextWindow: 32000, capabilities: ['chat', 'tools', 'json_mode'], isDefault: true, maxOutputTokens: 8192 },
      { modelId: 'open-mistral-7b', displayName: 'Open Mistral 7B', contextWindow: 32000, capabilities: ['chat'], maxOutputTokens: 8192, freeTierNote: 'Open weights' },
      { modelId: 'open-mixtral-8x7b', displayName: 'Open Mixtral 8x7B', contextWindow: 32000, capabilities: ['chat'], maxOutputTokens: 8192 },
    ],
  },
  {
    slug: 'huggingface',
    label: 'Hugging Face Inference API',
    category: 'free',
    baseUrl: 'https://api-inference.huggingface.co/models',
    openAiCompatible: false,
    apiKeyOptional: false,
    apiKeyEnvName: 'HF_API_TOKEN',
    docsUrl: 'https://huggingface.co/docs/api-inference',
    rateLimitNote: 'Free tier: 1000 req/day with rate limiting',
    priority: 90,
    models: [
      { modelId: 'meta-llama/Llama-3.3-70B-Instruct', displayName: 'Llama 3.3 70B Instruct', contextWindow: 128000, capabilities: ['chat'], isDefault: true, maxOutputTokens: 4096 },
      { modelId: 'mistralai/Mistral-7B-Instruct-v0.3', displayName: 'Mistral 7B Instruct v0.3', contextWindow: 32000, capabilities: ['chat'], maxOutputTokens: 4096 },
    ],
  },
  {
    slug: 'pollinations',
    label: 'Pollinations (Free Image API)',
    category: 'free',
    baseUrl: 'https://image.pollinations.ai',
    openAiCompatible: false,
    apiKeyOptional: true,
    docsUrl: 'https://pollinations.ai',
    rateLimitNote: 'No rate limit, no key — public free endpoint',
    priority: 100,
    notes: 'Free image generation endpoint. No API key required. Used by /api/ai/generate-image when no other image provider is configured.',
    models: [
      { modelId: 'flux', displayName: 'Flux (text-to-image)', contextWindow: 0, capabilities: ['image_generation'], isDefault: true, maxOutputTokens: 0 },
      { modelId: 'turbo', displayName: 'Turbo (fast image)', contextWindow: 0, capabilities: ['image_generation'], maxOutputTokens: 0 },
    ],
  },
];

async function main() {
  console.log('Seeding AI model registry...');
  for (const p of PROVIDERS) {
    const provider = await prisma.aiModelProvider.upsert({
      where: { slug: p.slug },
      update: {
        label: p.label,
        category: p.category,
        baseUrl: p.baseUrl,
        openAiCompatible: p.openAiCompatible,
        apiKeyOptional: p.apiKeyOptional,
        apiKeyEnvName: p.apiKeyEnvName,
        docsUrl: p.docsUrl,
        rateLimitNote: p.rateLimitNote,
        notes: p.notes,
        priority: p.priority,
      },
      create: {
        slug: p.slug,
        label: p.label,
        category: p.category,
        baseUrl: p.baseUrl,
        openAiCompatible: p.openAiCompatible,
        apiKeyOptional: p.apiKeyOptional,
        apiKeyEnvName: p.apiKeyEnvName,
        docsUrl: p.docsUrl,
        rateLimitNote: p.rateLimitNote,
        notes: p.notes,
        priority: p.priority,
        isEnabled: true,
      },
    });
    for (const m of p.models) {
      await prisma.aiModelEntry.upsert({
        where: { providerId_modelId: { providerId: provider.id, modelId: m.modelId } },
        update: {
          displayName: m.displayName,
          contextWindow: m.contextWindow,
          capabilities: JSON.stringify(m.capabilities),
          isDefault: m.isDefault ?? false,
          maxOutputTokens: m.maxOutputTokens ?? 4096,
          freeTierNote: m.freeTierNote,
        },
        create: {
          providerId: provider.id,
          modelId: m.modelId,
          displayName: m.displayName,
          contextWindow: m.contextWindow,
          capabilities: JSON.stringify(m.capabilities),
          isDefault: m.isDefault ?? false,
          maxOutputTokens: m.maxOutputTokens ?? 4096,
          freeTierNote: m.freeTierNote,
          isEnabled: true,
        },
      });
    }
    console.log(`  ✓ ${p.slug} (${p.models.length} models)`);
  }
  console.log(`\nSeeded ${PROVIDERS.length} providers + ${PROVIDERS.reduce((n, p) => n + p.models.length, 0)} models.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
