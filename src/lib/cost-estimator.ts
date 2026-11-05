/**
 * Cost estimator — converts token usage to USD based on per-provider rates.
 *
 * Rates are public list prices as of 2026-11. Adjust as providers change
 * their pricing. Free-tier providers (Groq, Gemini free, OpenRouter free,
 * Ollama local, Pollinations, Z.AI free) return 0.
 *
 * Ollama Cloud pricing is per-token metered — see https://ollama.com/cloud/pricing
 * Rates below are conservative estimates based on the public pricing page;
 * the admin UI shows "estimated" cost and warns it may differ from final bill.
 */
export interface CostEstimate {
  providerSlug: string;
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  /** True if this provider is free (rate is 0). */
  isFree: boolean;
  /** Source of the rate: 'public_pricing' | 'estimated' | 'free_tier' | 'self_hosted' */
  rateSource: 'public_pricing' | 'estimated' | 'free_tier' | 'self_hosted';
  /** Optional note for the admin UI */
  note?: string;
}

// Per-provider per-1M-token rates (USD). promptRate / completionRate.
// null = free / self-hosted.
const RATES: Record<string, { prompt: number | null; completion: number | null; source: CostEstimate['rateSource']; note?: string }> = {
  zai:            { prompt: 0,      completion: 0,      source: 'free_tier',     note: 'Z.AI free tier — no per-token charge' },
  groq:           { prompt: 0,      completion: 0,      source: 'free_tier',     note: 'Groq free tier — quota limited' },
  gemini:         { prompt: 0,      completion: 0,      source: 'free_tier',     note: 'Gemini 1.5 Flash free tier — 15 RPM, 1500 RPD' },
  openrouter:     { prompt: 0,      completion: 0,      source: 'free_tier',     note: 'OpenRouter :free models — no per-token charge' },
  ollama:         { prompt: null,   completion: null,  source: 'self_hosted',   note: 'Self-hosted — no per-token charge; bound by local hardware' },
  'ollama-cloud': { prompt: 0.30,   completion: 0.60,   source: 'estimated',     note: 'Estimated — verify at https://ollama.com/cloud/pricing' },
  opencode:       { prompt: null,   completion: null,  source: 'self_hosted',   note: 'Self-hosted local proxy — no per-token charge' },
  cloudflare:     { prompt: 0,      completion: 0,      source: 'free_tier',     note: 'Cloudflare Workers AI free tier — 10K neurons/day' },
  mistral:        { prompt: 0.20,   completion: 0.60,   source: 'public_pricing', note: 'Mistral Small latest — La Plateforme pricing' },
  huggingface:    { prompt: 0,      completion: 0,      source: 'free_tier',     note: 'HF Inference API free tier — 1000 req/day' },
  pollinations:   { prompt: null,   completion: null,  source: 'self_hosted',   note: 'Pollinations is a free public image API — no token usage' },
};

export function estimateCost(
  providerSlug: string,
  modelName: string,
  promptTokens: number,
  completionTokens: number
): CostEstimate {
  const rate = RATES[providerSlug];
  const total = (promptTokens || 0) + (completionTokens || 0);

  if (!rate) {
    return {
      providerSlug,
      modelName,
      promptTokens,
      completionTokens,
      totalTokens: total,
      estimatedCostUsd: 0,
      isFree: true,
      rateSource: 'estimated',
      note: 'Unknown provider — assumed free; verify pricing manually',
    };
  }

  // Free tier: rate is explicitly 0 (vs null = self-hosted/no token usage)
  if (rate.prompt === 0 && rate.completion === 0) {
    return {
      providerSlug,
      modelName,
      promptTokens,
      completionTokens,
      totalTokens: total,
      estimatedCostUsd: 0,
      isFree: true,
      rateSource: rate.source,
      note: rate.note,
    };
  }

  if (rate.prompt === null || rate.completion === null) {
    return {
      providerSlug,
      modelName,
      promptTokens,
      completionTokens,
      totalTokens: total,
      estimatedCostUsd: 0,
      isFree: true,
      rateSource: rate.source,
      note: rate.note,
    };
  }

  const cost = (promptTokens * rate.prompt + completionTokens * rate.completion) / 1_000_000;
  return {
    providerSlug,
    modelName,
    promptTokens,
    completionTokens,
    totalTokens: total,
    estimatedCostUsd: Math.round(cost * 1000) / 1000, // round to 0.001 USD
    isFree: false,
    rateSource: rate.source,
    note: rate.note,
  };
}

/**
 * Returns the full rate table for display in the admin UI.
 */
export function getRateTable() {
  return Object.entries(RATES).map(([slug, r]) => ({
    provider: slug,
    promptRatePer1M: r.prompt,
    completionRatePer1M: r.completion,
    source: r.source,
    note: r.note,
    isFree: r.prompt === null || r.prompt === 0,
  }));
}
