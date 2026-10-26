// Pure helpers for the Settings "Add AI Provider" helper (client-safe:
// no env reads, no fs, no secrets). It only builds the server .env snippet
// an owner pastes on the server — mirroring the server-side rules in
// src/lib/external-ai.ts. Keys are never saved by the UI; this module is
// string validation/formatting only.

export type ProviderFormKind = "omniroute" | "custom" | "groq" | "llm7" | "opencode" | "openrouter";

export interface ProviderFormInput {
  kind: ProviderFormKind;
  /** custom providers only */
  id?: string;
  name?: string;
  /** omniroute / custom only */
  baseUrl?: string;
  model?: string;
  /** custom only; derived from id when blank */
  apiKeyEnv?: string;
  /** optional; a placeholder is emitted when blank */
  apiKeyValue?: string;
  putFirst?: boolean;
}

export const BUILTIN_PROVIDER_DEFAULTS: Record<
  Exclude<ProviderFormKind, "custom">,
  { label: string; apiKeyEnv: string; modelEnv: string; defaultModel: string; keyUrl: string }
> = {
  groq: { label: "Groq", apiKeyEnv: "GROQ_API_KEY", modelEnv: "GROQ_MODEL", defaultModel: "llama-3.3-70b-versatile", keyUrl: "https://console.groq.com" },
  llm7: { label: "LLM7", apiKeyEnv: "LLM7_API_KEY", modelEnv: "LLM7_MODEL", defaultModel: "default", keyUrl: "https://token.llm7.io" },
  opencode: { label: "OpenCode Zen", apiKeyEnv: "OPENCODE_API_KEY", modelEnv: "OPENCODE_MODEL", defaultModel: "big-pickle", keyUrl: "https://opencode.ai/auth" },
  openrouter: { label: "OpenRouter", apiKeyEnv: "OPENROUTER_API_KEY", modelEnv: "OPENROUTER_MODEL", defaultModel: "openrouter/free", keyUrl: "https://openrouter.ai/settings/keys" },
  omniroute: { label: "OmniRoute (self-hosted)", apiKeyEnv: "OMNIROUTE_API_KEY", modelEnv: "OMNIROUTE_MODEL", defaultModel: "auto", keyUrl: "https://github.com/diegosouzapw/OmniRoute" },
};

const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._\-/:~]{0,119}$/;
const CUSTOM_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;
const ENV_NAME_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const RESERVED_IDS = ["groq", "llm7", "opencode", "openrouter", "omniroute"];
const DEFAULT_ORDER = ["groq", "llm7", "opencode", "openrouter", "omniroute"];
const LOCAL_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".test"];

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "::1" || LOCAL_HOST_SUFFIXES.some((s) => host.endsWith(s))) return true;
  if (!host.includes(".") && !host.includes(":")) return true;
  const octets = host.split(".").map(Number);
  if (octets.length === 4 && octets.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)) {
    const [a, b] = octets;
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
}

/** Mirrors resolveGatewayEndpoint() in external-ai.ts (base URL portion). */
export function validateGatewayBaseUrl(raw: string): { ok: true; baseUrl: string } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, error: "Base URL is not a valid URL." };
  }
  if (!["http:", "https:"].includes(url.protocol)) return { ok: false, error: "Base URL must start with http:// or https://." };
  if (url.username || url.password || url.search || url.hash) return { ok: false, error: "Base URL must not contain credentials, a query string, or a fragment." };
  if (url.protocol === "http:" && !isPrivateHost(url.hostname)) return { ok: false, error: "Public gateways must use https:// (plain http is only allowed for localhost/private hosts)." };
  url.pathname = url.pathname.replace(/\/+$/, "");
  return { ok: true, baseUrl: url.toString().replace(/\/$/, "") };
}

export function deriveApiKeyEnv(id: string): string {
  return `${id.trim().toUpperCase().replace(/-/g, "_")}_API_KEY`;
}

export type EnvSnippetResult =
  | { ok: true; snippet: string; providerId: string }
  | { ok: false; errors: string[] };

export function buildProviderEnvSnippet(input: ProviderFormInput): EnvSnippetResult {
  const errors: string[] = [];
  const apiKeyValue = (input.apiKeyValue ?? "").trim();
  if (/\s/.test(apiKeyValue)) errors.push("API key must not contain whitespace or newlines.");
  const keyOrPlaceholder = apiKeyValue || "REPLACE_WITH_YOUR_KEY";

  let label = "";
  let providerId = "";
  const lines: string[] = [];

  if (input.kind === "custom" || input.kind === "omniroute") {
    const isCustom = input.kind === "custom";
    if (isCustom) {
      providerId = (input.id ?? "").trim().toLowerCase();
      if (!CUSTOM_ID_PATTERN.test(providerId)) errors.push("Provider ID must be lowercase letters, digits, and dashes (max 32 chars).");
      if (RESERVED_IDS.includes(providerId)) errors.push(`"${providerId}" is a built-in provider id — pick a different custom ID.`);
      label = (input.name ?? "").trim() || providerId;
    } else {
      providerId = "omniroute";
      label = "OmniRoute (self-hosted)";
    }

    const model = (input.model ?? "").trim() || (isCustom ? "" : "auto");
    if (!model) errors.push("Model is required for a custom gateway (use the gateway's model id, e.g. its auto/default model).");
    if (model && !MODEL_PATTERN.test(model)) errors.push("Model contains invalid characters.");

    const apiKeyEnv = isCustom
      ? (input.apiKeyEnv ?? "").trim() || (providerId ? deriveApiKeyEnv(providerId) : "")
      : "OMNIROUTE_API_KEY";
    if (isCustom && apiKeyEnv && !ENV_NAME_PATTERN.test(apiKeyEnv)) errors.push("API key env name must be UPPERCASE_WITH_UNDERSCORES.");

    const rawBase = (input.baseUrl ?? "").trim() || (isCustom ? "" : "http://127.0.0.1:20128/v1");
    const base = rawBase ? validateGatewayBaseUrl(rawBase) : { ok: false as const, error: "Base URL is required for a gateway provider." };
    if (!base.ok) errors.push(base.error);

    if (!errors.length && base.ok) {
      if (isCustom) {
        const entry: Record<string, string> = { id: providerId, baseUrl: base.baseUrl, apiKeyEnv, model };
        if ((input.name ?? "").trim()) entry.name = (input.name as string).trim();
        // Keep a stable, readable key order in the emitted JSON.
        const ordered = { id: entry.id, ...(entry.name ? { name: entry.name } : {}), baseUrl: entry.baseUrl, apiKeyEnv: entry.apiKeyEnv, model: entry.model };
        lines.push(`ALO_CUSTOM_AI_PROVIDERS_JSON=[${JSON.stringify(ordered)}]`);
        lines.push(`${apiKeyEnv}=${keyOrPlaceholder}`);
      } else {
        lines.push(`OMNIROUTE_BASE_URL=${base.baseUrl}`);
        lines.push(`OMNIROUTE_MODEL=${model}`);
        lines.push(`OMNIROUTE_API_KEY=${keyOrPlaceholder}`);
      }
    }
  } else {
    const defaults = BUILTIN_PROVIDER_DEFAULTS[input.kind];
    providerId = input.kind;
    label = defaults.label;
    const model = (input.model ?? "").trim() || defaults.defaultModel;
    if (!MODEL_PATTERN.test(model)) errors.push("Model contains invalid characters.");
    if (!errors.length) {
      lines.push(`${defaults.apiKeyEnv}=${keyOrPlaceholder}`);
      lines.push(`${defaults.modelEnv}=${model}`);
    }
  }

  if (errors.length) return { ok: false, errors };

  const order = input.putFirst
    ? [providerId, ...DEFAULT_ORDER.filter((id) => id !== providerId)]
    : null;

  const snippet = [
    `# ── ALO external AI provider: ${label} ─────────────────────────────`,
    `# Paste into the SERVER .env (never commit a real key), then restart the app.`,
    `ALO_PAID_AI_API_ALLOWED=true`,
    `ALO_OWNER_APPROVED_PAID_AI_API=true`,
    ...lines,
    ...(order ? [`ALO_EXTERNAL_AI_PROVIDERS=${order.join(",")}`] : [`# Optional try-order: ALO_EXTERNAL_AI_PROVIDERS=${[providerId, ...DEFAULT_ORDER.filter((id) => id !== providerId)].join(",")}`]),
    `# Verify afterwards: GET /api/ai/local-status  (Settings → AI Providers)`,
  ].join("\n");

  return { ok: true, snippet, providerId };
}
