// ALO Learning Journey — minimal direct external AI providers (server-only).
//
// The deliberate alternative to running a multi-provider gateway service:
// a small registry of OpenAI-compatible providers, each called directly —
// no router service, no dashboard, no credential store, no cookie/OAuth
// session reuse. Built-in free-tier providers (endpoints hardcoded):
//
//   groq       https://api.groq.com/openai/v1/chat/completions
//   llm7       https://api.llm7.io/v1/chat/completions        (free token)
//   opencode   https://opencode.ai/zen/v1/chat/completions    (Zen free models)
//   openrouter https://openrouter.ai/api/v1/chat/completions  (free models)
//
// Plus two OWNER-CONFIGURED gateway options ("add a provider like OmniRoute"):
//   omniroute  first-class: an OmniRoute server you run yourself
//              (default http://127.0.0.1:20128/v1, model "auto")
//   custom     any OpenAI-compatible gateway declared in
//              ALO_CUSTOM_AI_PROVIDERS_JSON (LiteLLM, 9router, a second
//              OmniRoute, LM Studio, vLLM, …) — see parseCustomAiProviders.
//
// Gateways are powerful and dangerous in equal measure: OmniRoute/custom
// gateways route onward to whatever their operator configured, so this code
// cannot verify they stay free or where data goes. They are therefore
// (a) env-only — dashboard/API users can never add providers, (b) behind the
// same two owner switches, and (c) held to the same src/lib/ai.ts allowlist
// of non-personal content drafts. Never send student, family, comment, OTP,
// admissions, or any other personal data through any external provider.
// Free tiers, model catalogs, limits, and terms change often; model IDs are
// env-overridable so the operator can follow the provider's live catalog.

import { assertExternalAiAllowed, isExternalAiAllowed } from "./agentos/payment-guard.ts";

export type ExternalChatResult = { content: string; model: string };

export type ProviderKind = "free-tier" | "owner-gateway";

type ProviderConfig = {
  id: string;
  displayName: string;
  kind: ProviderKind;
  /** Resolved chat-completions endpoint, or null when misconfigured. */
  endpoint: string | null;
  endpointInvalid: boolean;
  apiKeyEnv: string;
  modelEnv?: string;
  fixedModel?: string;
  defaultModel: string;
  /** Free-model guard for free-tier providers; gateways are owner-trusted. */
  isFreeModel: (model: string) => boolean;
};

// Model names: provider/model:variant, ~aliases, -free suffixes, "auto".
const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._\-/:~]{0,119}$/;
const CUSTOM_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;
const ENV_NAME_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;

const BUILTIN_IDS = ["groq", "llm7", "opencode", "openrouter", "omniroute"];

// Default chain: direct free providers first (generous quotas first,
// scarcest last), then the owner's gateway if one is configured.
const DEFAULT_ORDER = ["groq", "llm7", "opencode", "openrouter", "omniroute"];

// Prompt ceiling for external calls: bounds cost and accidental bulk data
// exfiltration. Local Ollama calls are not subject to this limit.
const MAX_EXTERNAL_INPUT_CHARS = 24_000;
const MAX_CUSTOM_PROVIDERS = 5;

// ---------------------------------------------------------------------------
// Gateway endpoint resolution (OmniRoute + custom providers)
// ---------------------------------------------------------------------------

const LOCAL_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".test"];

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "::1" || LOCAL_HOST_SUFFIXES.some((s) => host.endsWith(s))) return true;
  if (!host.includes(".") && !host.includes(":")) return true; // Docker/single-label hosts
  const octets = host.split(".").map(Number);
  if (octets.length === 4 && octets.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)) {
    const [a, b] = octets;
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
}

/**
 * Resolve an owner-configured gateway base URL to a chat-completions
 * endpoint. Rules: http(s) only; no credentials/query/fragment; plain http
 * only to loopback/private hosts (public gateways must use https); a base
 * already ending in /chat/completions is respected. Returns null if invalid.
 */
export function resolveGatewayEndpoint(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
  if (url.protocol === "http:" && !isPrivateHost(url.hostname)) return null;
  url.pathname = url.pathname.replace(/\/+$/, "");
  if (!url.pathname.endsWith("/chat/completions")) url.pathname = `${url.pathname}/chat/completions`;
  return url.toString();
}

// ---------------------------------------------------------------------------
// Provider registry (built-ins + OmniRoute + custom JSON providers)
// ---------------------------------------------------------------------------

function builtinProviders(): ProviderConfig[] {
  const omnirouteBase = process.env.OMNIROUTE_BASE_URL?.trim() || "http://127.0.0.1:20128/v1";
  const omnirouteEndpoint = resolveGatewayEndpoint(omnirouteBase);
  return [
    {
      id: "groq", displayName: "Groq", kind: "free-tier",
      endpoint: "https://api.groq.com/openai/v1/chat/completions", endpointInvalid: false,
      apiKeyEnv: "GROQ_API_KEY", modelEnv: "GROQ_MODEL", defaultModel: "llama-3.3-70b-versatile",
      isFreeModel: () => true, // no free/paid suffix; a no-billing key spends free quota only
    },
    {
      id: "llm7", displayName: "LLM7", kind: "free-tier",
      endpoint: "https://api.llm7.io/v1/chat/completions", endpointInvalid: false,
      apiKeyEnv: "LLM7_API_KEY", modelEnv: "LLM7_MODEL", defaultModel: "default",
      isFreeModel: (m) => m !== "pro", // "pro" is LLM7's paid selector
    },
    {
      id: "opencode", displayName: "OpenCode Zen", kind: "free-tier",
      endpoint: "https://opencode.ai/zen/v1/chat/completions", endpointInvalid: false,
      apiKeyEnv: "OPENCODE_API_KEY", modelEnv: "OPENCODE_MODEL", defaultModel: "big-pickle",
      isFreeModel: (m) => m === "big-pickle" || m.endsWith("-free"),
    },
    {
      id: "openrouter", displayName: "OpenRouter", kind: "free-tier",
      endpoint: "https://openrouter.ai/api/v1/chat/completions", endpointInvalid: false,
      apiKeyEnv: "OPENROUTER_API_KEY", modelEnv: "OPENROUTER_MODEL", defaultModel: "openrouter/free",
      isFreeModel: (m) => m === "openrouter/free" || m.endsWith(":free"),
    },
    {
      id: "omniroute", displayName: "OmniRoute (self-hosted)", kind: "owner-gateway",
      endpoint: omnirouteEndpoint, endpointInvalid: omnirouteEndpoint === null,
      apiKeyEnv: "OMNIROUTE_API_KEY", modelEnv: "OMNIROUTE_MODEL", defaultModel: "auto",
      isFreeModel: () => true, // owner-trusted: OmniRoute routes per its own config
    },
  ];
}

/**
 * Parse ALO_CUSTOM_AI_PROVIDERS_JSON — a JSON array (max 5) of:
 *   { "id": "my-gateway", "baseUrl": "https://llm.example.com/v1",
 *     "apiKeyEnv": "MY_GATEWAY_API_KEY", "model": "some-model",
 *     "name": "My Gateway" (optional) }
 *
 * Fail-closed parsing: malformed JSON, bad/duplicate/built-in ids, literal
 * "apiKey" fields (keys are referenced by env NAME only, never embedded),
 * invalid key-env names, invalid models, and unsafe base URLs are all
 * skipped silently. This function never throws and never returns a secret.
 */
export function parseCustomAiProviders(raw: string | undefined): ProviderConfig[] {
  if (!raw?.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const providers: ProviderConfig[] = [];
  const seen = new Set<string>(BUILTIN_IDS);
  for (const entry of parsed.slice(0, MAX_CUSTOM_PROVIDERS * 2)) {
    if (providers.length >= MAX_CUSTOM_PROVIDERS) break;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const e = entry as Record<string, unknown>;
    if ("apiKey" in e || "api_key" in e || "token" in e) continue; // env-name references only
    const id = typeof e.id === "string" ? e.id.trim().toLowerCase() : "";
    const baseUrl = typeof e.baseUrl === "string" ? e.baseUrl : "";
    const apiKeyEnv = typeof e.apiKeyEnv === "string" ? e.apiKeyEnv.trim() : "";
    const model = typeof e.model === "string" ? e.model.trim() : "";
    if (!CUSTOM_ID_PATTERN.test(id) || seen.has(id)) continue;
    if (!ENV_NAME_PATTERN.test(apiKeyEnv) || !MODEL_PATTERN.test(model)) continue;
    const endpoint = resolveGatewayEndpoint(baseUrl);
    if (!endpoint) continue;
    seen.add(id);
    providers.push({
      id,
      displayName: typeof e.name === "string" && e.name.trim() ? e.name.trim().slice(0, 60) : id,
      kind: "owner-gateway",
      endpoint,
      endpointInvalid: false,
      apiKeyEnv,
      fixedModel: model,
      defaultModel: model,
      isFreeModel: () => true, // owner-trusted gateway
    });
  }
  return providers;
}

function allProviders(): ProviderConfig[] {
  return [...builtinProviders(), ...parseCustomAiProviders(process.env.ALO_CUSTOM_AI_PROVIDERS_JSON)];
}

/**
 * Providers in try-order: ALO_EXTERNAL_AI_PROVIDERS="llm7,omniroute,my-gw"
 * (built-in, OmniRoute, or custom ids; unknown names ignored, deduped).
 * Default: direct free providers, then OmniRoute, then custom gateways.
 */
export function orderedProviders(): ProviderConfig[] {
  const all = allProviders();
  const byId = new Map(all.map((p) => [p.id, p]));
  const raw = process.env.ALO_EXTERNAL_AI_PROVIDERS?.trim();
  if (raw) {
    const ordered: ProviderConfig[] = [];
    const seen = new Set<string>();
    for (const id of raw.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean)) {
      const cfg = byId.get(id);
      if (cfg && !seen.has(id)) {
        seen.add(id);
        ordered.push(cfg);
      }
    }
    if (ordered.length) return ordered;
  }
  const defaults = DEFAULT_ORDER.map((id) => byId.get(id)).filter((p): p is ProviderConfig => Boolean(p));
  const customs = all.filter((p) => !DEFAULT_ORDER.includes(p.id));
  return [...defaults, ...customs];
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export type ExternalProviderStatus = {
  provider: string;
  kind: ProviderKind;
  /** API key present, model valid/free (free-tier), and endpoint valid. */
  configured: boolean;
  model: string;
  reason: "ready" | "disabled" | "missing_api_key" | "invalid_model" | "non_free_model" | "invalid_endpoint";
};

export type ExternalAiStatus = {
  /** Both owner switches (ALO_PAID_AI_API_ALLOWED + ALO_OWNER_APPROVED_PAID_AI_API) are true. */
  enabled: boolean;
  /** At least one provider is fully configured. */
  configured: boolean;
  /** Provider ids in the order they will be tried. */
  order: string[];
  providers: ExternalProviderStatus[];
  dataPolicy: "non-personal-content-drafts-only";
};

function configuredModel(cfg: ProviderConfig): string {
  if (cfg.fixedModel) return cfg.fixedModel;
  return (cfg.modelEnv ? process.env[cfg.modelEnv]?.trim() : "") || cfg.defaultModel;
}

function providerStatus(cfg: ProviderConfig, enabled: boolean): ExternalProviderStatus {
  const model = configuredModel(cfg);
  const hasKey = Boolean(process.env[cfg.apiKeyEnv]?.trim());
  const reason: ExternalProviderStatus["reason"] = !enabled
    ? "disabled"
    : cfg.endpointInvalid
      ? "invalid_endpoint"
      : !hasKey
        ? "missing_api_key"
        : !MODEL_PATTERN.test(model)
          ? "invalid_model"
          : cfg.kind === "free-tier" && !cfg.isFreeModel(model)
            ? "non_free_model"
            : "ready";
  return { provider: cfg.id, kind: cfg.kind, configured: reason === "ready", model, reason };
}

export function getExternalAiStatus(): ExternalAiStatus {
  const enabled = isExternalAiAllowed();
  const providers = orderedProviders().map((cfg) => providerStatus(cfg, enabled));
  return {
    enabled,
    configured: providers.some((p) => p.configured),
    order: providers.map((p) => p.provider),
    providers,
    dataPolicy: "non-personal-content-drafts-only",
  };
}

// ---------------------------------------------------------------------------
// Chat completion chain
// ---------------------------------------------------------------------------

async function callProvider(
  cfg: ProviderConfig,
  apiKey: string,
  model: string,
  system: string,
  user: string,
  timeoutMs: number
): Promise<ExternalChatResult> {
  const response = await fetch(cfg.endpoint as string, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(Math.max(1_000, Math.min(timeoutMs, 30_000))),
    body: JSON.stringify({
      model,
      stream: false,
      temperature: 0.7,
      // JSON mode; every allowlisted system prompt already says
      // "Return ONLY JSON", which this mode requires where supported.
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  // Status only — never forward the provider body or headers to callers/logs.
  if (!response.ok) throw new Error(`${cfg.displayName} returned HTTP ${response.status}`);

  const payload = (await response.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content?.trim()) throw new Error(`${cfg.displayName} returned an empty response`);
  return { content, model: `${cfg.id}:${payload.model || model}` };
}

/**
 * One JSON-mode chat completion via the configured provider chain: the
 * first fully-configured provider (in ALO_EXTERNAL_AI_PROVIDERS order)
 * that succeeds wins; gateways are tried after direct providers by default.
 *
 * Fail-closed: both owner switches must be true
 * (`external_ai_blocked_by_payment_guard:external-ai`), at least one provider
 * must be configured (`external_ai_not_configured:external-ai`), prompts are
 * size-capped, and non-free model IDs on free-tier providers are skipped.
 * If every configured provider fails, throws
 * `external_ai_all_providers_failed:<ids tried>`. Callers decide their
 * fallback; this never silently falls back to anything.
 */
export async function generateExternalChatJson(
  system: string,
  user: string,
  timeoutMs: number
): Promise<ExternalChatResult> {
  assertExternalAiAllowed("external-ai");

  if (system.length + user.length > MAX_EXTERNAL_INPUT_CHARS) {
    throw new Error("external_ai_input_too_large:external-ai");
  }

  const enabled = isExternalAiAllowed();
  const candidates = orderedProviders()
    .map((cfg) => ({ cfg, status: providerStatus(cfg, enabled) }))
    .filter(({ status }) => status.configured);
  if (!candidates.length) throw new Error("external_ai_not_configured:external-ai");

  const tried: string[] = [];
  for (const { cfg, status } of candidates) {
    tried.push(cfg.id);
    try {
      const apiKey = process.env[cfg.apiKeyEnv]?.trim() as string;
      return await callProvider(cfg, apiKey, status.model, system, user, timeoutMs);
    } catch {
      // Try the next configured provider; error bodies/keys never leak.
    }
  }
  throw new Error(`external_ai_all_providers_failed:${tried.join(",")}`);
}
