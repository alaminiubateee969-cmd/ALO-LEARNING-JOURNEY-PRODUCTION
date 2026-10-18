import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildProviderEnvSnippet,
  deriveApiKeyEnv,
  validateGatewayBaseUrl,
} from "../src/lib/ai-provider-config.ts";

test("OmniRoute snippet defaults to the local server with model auto", () => {
  const result = buildProviderEnvSnippet({ kind: "omniroute" });
  assert.equal(result.ok, true);
  assert.equal(result.providerId, "omniroute");
  assert.match(result.snippet, /ALO_PAID_AI_API_ALLOWED=true/);
  assert.match(result.snippet, /ALO_OWNER_APPROVED_PAID_AI_API=true/);
  assert.match(result.snippet, /OMNIROUTE_BASE_URL=http:\/\/127\.0\.0\.1:20128\/v1/);
  assert.match(result.snippet, /OMNIROUTE_MODEL=auto/);
  assert.match(result.snippet, /OMNIROUTE_API_KEY=REPLACE_WITH_YOUR_KEY/);
});

test("custom gateway snippet emits env-name key reference plus the real key line", () => {
  const result = buildProviderEnvSnippet({
    kind: "custom", id: "my-gateway", name: "My Gateway",
    baseUrl: "https://llm.example.com/v1/", model: "best-free", apiKeyValue: "sekret",
  });
  assert.equal(result.ok, true);
  assert.match(result.snippet, /ALO_CUSTOM_AI_PROVIDERS_JSON=\[\{"id":"my-gateway","name":"My Gateway","baseUrl":"https:\/\/llm\.example\.com\/v1","apiKeyEnv":"MY_GATEWAY_API_KEY","model":"best-free"\}\]/);
  assert.match(result.snippet, /MY_GATEWAY_API_KEY=sekret/);
  // The embedded JSON must be parseable back into the server parser's shape.
  const jsonLine = result.snippet.split("\n").find((l) => l.startsWith("ALO_CUSTOM_AI_PROVIDERS_JSON="));
  const parsed = JSON.parse(jsonLine.slice("ALO_CUSTOM_AI_PROVIDERS_JSON=".length));
  assert.equal(parsed[0].apiKeyEnv, "MY_GATEWAY_API_KEY");
  assert.equal("apiKey" in parsed[0], false);
});

test("built-in free provider snippet uses its fixed env names and defaults", () => {
  const result = buildProviderEnvSnippet({ kind: "openrouter", apiKeyValue: "or-key" });
  assert.equal(result.ok, true);
  assert.match(result.snippet, /OPENROUTER_API_KEY=or-key/);
  assert.match(result.snippet, /OPENROUTER_MODEL=openrouter\/free/);
});

test("putFirst emits an explicit try-order with the new provider first", () => {
  const result = buildProviderEnvSnippet({ kind: "llm7", putFirst: true });
  assert.equal(result.ok, true);
  assert.match(result.snippet, /^ALO_EXTERNAL_AI_PROVIDERS=llm7,groq,opencode,openrouter,omniroute$/m);
});

test("validation rejects unsafe or malformed provider definitions", () => {
  // reserved id
  assert.equal(buildProviderEnvSnippet({ kind: "custom", id: "groq", baseUrl: "https://x.example.com/v1", model: "m" }).ok, false);
  // bad id
  assert.equal(buildProviderEnvSnippet({ kind: "custom", id: "Bad Id!", baseUrl: "https://x.example.com/v1", model: "m" }).ok, false);
  // missing model for custom
  assert.equal(buildProviderEnvSnippet({ kind: "custom", id: "gw", baseUrl: "https://x.example.com/v1" }).ok, false);
  // public http gateway
  const pub = buildProviderEnvSnippet({ kind: "custom", id: "gw", baseUrl: "http://x.example.com/v1", model: "m" });
  assert.equal(pub.ok, false);
  assert.match(pub.errors.join(" "), /https/);
  // newline/whitespace injection via key or model
  assert.equal(buildProviderEnvSnippet({ kind: "groq", apiKeyValue: "a\nALO_X=1" }).ok, false);
  assert.equal(buildProviderEnvSnippet({ kind: "groq", model: "bad model" }).ok, false);
});

test("gateway base URL validation mirrors the server rules", () => {
  assert.deepEqual(validateGatewayBaseUrl("http://127.0.0.1:20128/v1/"), { ok: true, baseUrl: "http://127.0.0.1:20128/v1" });
  assert.equal(validateGatewayBaseUrl("https://user:pass@example.com/v1").ok, false);
  assert.equal(validateGatewayBaseUrl("ftp://127.0.0.1/v1").ok, false);
  assert.equal(deriveApiKeyEnv("my-gateway"), "MY_GATEWAY_API_KEY");
});

test("generated custom JSON is accepted by the real server parser", async () => {
  const { parseCustomAiProviders } = await import("../src/lib/external-ai.ts");
  const result = buildProviderEnvSnippet({
    kind: "custom", id: "roundtrip-gw", baseUrl: "http://127.0.0.1:4000/v1", model: "m1",
  });
  assert.equal(result.ok, true);
  const jsonLine = result.snippet.split("\n").find((l) => l.startsWith("ALO_CUSTOM_AI_PROVIDERS_JSON="));
  const parsed = parseCustomAiProviders(jsonLine.slice("ALO_CUSTOM_AI_PROVIDERS_JSON=".length));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].id, "roundtrip-gw");
  assert.equal(parsed[0].endpoint, "http://127.0.0.1:4000/v1/chat/completions");
});

test("Settings UI mounts the provider helper and never persists keys in the browser", async () => {
  const [view, component] = await Promise.all([
    readFile(new URL("../src/components/alo/SettingsView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/alo/AiProvidersSettings.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(view, /AiProvidersSettings/);
  assert.match(component, /fetch\("\/api\/ai\/local-status"/);
  assert.match(component, /buildProviderEnvSnippet/);
  assert.doesNotMatch(component, /localStorage|sessionStorage|indexedDB|document\.cookie/);
});
