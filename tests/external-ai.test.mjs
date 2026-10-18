import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  generateExternalChatJson,
  getExternalAiStatus,
  parseCustomAiProviders,
  resolveGatewayEndpoint,
} from "../src/lib/external-ai.ts";

const ENV_NAMES = [
  "ALO_PAID_AI_API_ALLOWED",
  "ALO_OWNER_APPROVED_PAID_AI_API",
  "ALO_EXTERNAL_AI_PROVIDERS",
  "GROQ_API_KEY", "GROQ_MODEL",
  "OPENROUTER_API_KEY", "OPENROUTER_MODEL",
  "LLM7_API_KEY", "LLM7_MODEL",
  "OPENCODE_API_KEY", "OPENCODE_MODEL",
  "OMNIROUTE_API_KEY", "OMNIROUTE_MODEL", "OMNIROUTE_BASE_URL",
  "ALO_CUSTOM_AI_PROVIDERS_JSON",
];

async function withEnv(values, run) {
  const previous = new Map(ENV_NAMES.map((name) => [name, process.env[name]]));
  for (const name of ENV_NAMES) delete process.env[name];
  Object.assign(process.env, values);
  try {
    return await run();
  } finally {
    for (const name of ENV_NAMES) {
      const value = previous.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

const ENABLED = {
  ALO_PAID_AI_API_ALLOWED: "true",
  ALO_OWNER_APPROVED_PAID_AI_API: "true",
};

function stubFetch(handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return handler(url, init);
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

const okJson = (body) => ({ ok: true, status: 200, json: async () => body });
const okChat = (model) => okJson({ model, choices: [{ message: { content: '{"topic":"x"}' } }] });
const providerOf = (status, id) => status.providers.find((p) => p.provider === id);

test("external AI is disabled by default and never calls fetch", async () => {
  await withEnv({}, async () => {
    const status = getExternalAiStatus();
    assert.equal(status.enabled, false);
    assert.equal(status.configured, false);
    assert.deepEqual(status.order, ["groq", "llm7", "opencode", "openrouter", "omniroute"]);
    assert.ok(status.providers.every((p) => p.reason === "disabled"));
    assert.equal(status.dataPolicy, "non-personal-content-drafts-only");

    const stub = stubFetch(() => { throw new Error("fetch must not be called"); });
    try {
      await assert.rejects(
        () => generateExternalChatJson("Return ONLY JSON {}", "topic", 5000),
        /external_ai_blocked_by_payment_guard:external-ai/
      );
      assert.equal(stub.calls.length, 0);
    } finally { stub.restore(); }
  });
});

test("a single owner switch is not enough", async () => {
  for (const values of [
    { ALO_PAID_AI_API_ALLOWED: "true", GROQ_API_KEY: "test-key" },
    { ALO_OWNER_APPROVED_PAID_AI_API: "true", GROQ_API_KEY: "test-key" },
  ]) {
    await withEnv(values, async () => {
      assert.equal(getExternalAiStatus().configured, false);
      await assert.rejects(
        () => generateExternalChatJson("Return ONLY JSON {}", "topic", 5000),
        /external_ai_blocked_by_payment_guard:external-ai/
      );
    });
  }
});

test("enabled without any API key reports missing_api_key and does not call fetch", async () => {
  await withEnv({ ...ENABLED }, async () => {
    const status = getExternalAiStatus();
    assert.equal(status.configured, false);
    assert.ok(status.providers.every((p) => p.reason === "missing_api_key"));
    const stub = stubFetch(() => { throw new Error("fetch must not be called"); });
    try {
      await assert.rejects(
        () => generateExternalChatJson("Return ONLY JSON {}", "topic", 5000),
        /external_ai_not_configured:external-ai/
      );
      assert.equal(stub.calls.length, 0);
    } finally { stub.restore(); }
  });
});

test("invalid model names are rejected before any network call", async () => {
  await withEnv({ ...ENABLED, GROQ_API_KEY: "test-key", GROQ_MODEL: "bad model; rm" }, async () => {
    assert.equal(providerOf(getExternalAiStatus(), "groq").reason, "invalid_model");
    const stub = stubFetch(() => { throw new Error("fetch must not be called"); });
    try {
      await assert.rejects(
        () => generateExternalChatJson("Return ONLY JSON {}", "topic", 5000),
        /external_ai_not_configured:external-ai/
      );
      assert.equal(stub.calls.length, 0);
    } finally { stub.restore(); }
  });
});

test("non-free models are blocked per provider (OpenRouter paid, Zen paid, LLM7 pro)", async () => {
  await withEnv({
    ...ENABLED,
    OPENROUTER_API_KEY: "k1", OPENROUTER_MODEL: "openai/gpt-5.2",
    OPENCODE_API_KEY: "k2", OPENCODE_MODEL: "gpt-5.5",
    LLM7_API_KEY: "k3", LLM7_MODEL: "pro",
  }, async () => {
    const status = getExternalAiStatus();
    assert.equal(providerOf(status, "openrouter").reason, "non_free_model");
    assert.equal(providerOf(status, "opencode").reason, "non_free_model");
    assert.equal(providerOf(status, "llm7").reason, "non_free_model");
    assert.equal(status.configured, false);
    const stub = stubFetch(() => { throw new Error("fetch must not be called"); });
    try {
      await assert.rejects(
        () => generateExternalChatJson("Return ONLY JSON {}", "topic", 5000),
        /external_ai_not_configured:external-ai/
      );
      assert.equal(stub.calls.length, 0);
    } finally { stub.restore(); }
  });
});

test("oversized prompts are rejected before any network call", async () => {
  await withEnv({ ...ENABLED, GROQ_API_KEY: "test-key" }, async () => {
    const stub = stubFetch(() => { throw new Error("fetch must not be called"); });
    try {
      await assert.rejects(
        () => generateExternalChatJson("Return ONLY JSON {}", "x".repeat(24_001), 5000),
        /external_ai_input_too_large:external-ai/
      );
      assert.equal(stub.calls.length, 0);
    } finally { stub.restore(); }
  });
});

test("successful Groq call hits only the hardcoded endpoint with JSON mode", async () => {
  await withEnv({ ...ENABLED, GROQ_API_KEY: "test-key" }, async () => {
    assert.equal(providerOf(getExternalAiStatus(), "groq").reason, "ready");
    const stub = stubFetch(async () => okChat("llama-3.3-70b-versatile"));
    try {
      const result = await generateExternalChatJson("Return ONLY JSON {topic}", "শিশুর খেলা", 5000);
      assert.equal(result.content, '{"topic":"x"}');
      assert.equal(result.model, "groq:llama-3.3-70b-versatile");
      assert.equal(stub.calls.length, 1);
      const { url, init } = stub.calls[0];
      assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
      assert.equal(init.headers.authorization, "Bearer test-key");
      const body = JSON.parse(init.body);
      assert.equal(body.model, "llama-3.3-70b-versatile");
      assert.deepEqual(body.response_format, { type: "json_object" });
      assert.equal(body.messages[1].content, "শিশুর খেলা");
    } finally { stub.restore(); }
  });
});

test("each provider uses its own hardcoded endpoint, key env, and default free model", async () => {
  const cases = [
    { env: { LLM7_API_KEY: "llm7-key" }, url: "https://api.llm7.io/v1/chat/completions", key: "llm7-key", model: "default", label: "llm7:default" },
    { env: { OPENCODE_API_KEY: "zen-key" }, url: "https://opencode.ai/zen/v1/chat/completions", key: "zen-key", model: "big-pickle", label: "opencode:big-pickle" },
    { env: { OPENROUTER_API_KEY: "or-key" }, url: "https://openrouter.ai/api/v1/chat/completions", key: "or-key", model: "openrouter/free", label: "openrouter:openrouter/free" },
  ];
  for (const c of cases) {
    await withEnv({ ...ENABLED, ...c.env }, async () => {
      const stub = stubFetch(async () => okChat(c.model));
      try {
        const result = await generateExternalChatJson("Return ONLY JSON {}", "topic", 5000);
        assert.equal(result.model, c.label);
        assert.equal(stub.calls.length, 1);
        assert.equal(stub.calls[0].url, c.url);
        assert.equal(stub.calls[0].init.headers.authorization, `Bearer ${c.key}`);
        assert.equal(JSON.parse(stub.calls[0].init.body).model, c.model);
      } finally { stub.restore(); }
    });
  }
});

test("chain falls through a failed provider to the next configured one", async () => {
  await withEnv({ ...ENABLED, GROQ_API_KEY: "g-key", LLM7_API_KEY: "l-key" }, async () => {
    const stub = stubFetch(async (url) =>
      String(url).includes("groq.com")
        ? { ok: false, status: 429, json: async () => ({ error: "slow down g-key" }) }
        : okChat("default"));
    try {
      const result = await generateExternalChatJson("Return ONLY JSON {}", "topic", 5000);
      assert.equal(result.model, "llm7:default");
      assert.deepEqual(stub.calls.map((c) => new URL(c.url).hostname), ["api.groq.com", "api.llm7.io"]);
    } finally { stub.restore(); }
  });
});

test("ALO_EXTERNAL_AI_PROVIDERS reorders and subsets the chain", async () => {
  await withEnv({
    ...ENABLED, GROQ_API_KEY: "g-key", OPENROUTER_API_KEY: "o-key",
    ALO_EXTERNAL_AI_PROVIDERS: "openrouter,groq,openrouter,unknown",
  }, async () => {
    assert.deepEqual(getExternalAiStatus().order, ["openrouter", "groq"]);
    const stub = stubFetch(async () => okChat("openrouter/free"));
    try {
      const result = await generateExternalChatJson("Return ONLY JSON {}", "topic", 5000);
      assert.equal(result.model, "openrouter:openrouter/free");
      assert.equal(stub.calls.length, 1);
      assert.match(stub.calls[0].url, /openrouter\.ai/);
    } finally { stub.restore(); }
  });
});

test("when every configured provider fails, error names only provider ids", async () => {
  await withEnv({ ...ENABLED, GROQ_API_KEY: "g-key", OPENROUTER_API_KEY: "o-key" }, async () => {
    const stub = stubFetch(async () => ({ ok: false, status: 503, json: async () => ({ error: "down g-key o-key" }) }));
    try {
      await assert.rejects(
        () => generateExternalChatJson("Return ONLY JSON {}", "topic", 5000),
        (error) => {
          assert.equal(error.message, "external_ai_all_providers_failed:groq,openrouter");
          assert.doesNotMatch(error.message, /g-key|o-key|down/);
          return true;
        }
      );
      assert.equal(stub.calls.length, 2);
    } finally { stub.restore(); }
  });
});

test("provider HTTP errors never leak the response body or key", async () => {
  await withEnv({ ...ENABLED, GROQ_API_KEY: "test-key" }, async () => {
    const stub = stubFetch(async () => ({
      ok: false, status: 429, json: async () => ({ error: "rate limited for test-key" }),
    }));
    try {
      await assert.rejects(
        () => generateExternalChatJson("Return ONLY JSON {}", "topic", 5000),
        (error) => {
          assert.equal(error.message, "external_ai_all_providers_failed:groq");
          assert.doesNotMatch(error.message, /test-key|rate limited|429/);
          return true;
        }
      );
    } finally { stub.restore(); }
  });
});

test("status lists every provider and never exposes any API key", async () => {
  await withEnv({
    ...ENABLED,
    GROQ_API_KEY: "groq-secret", LLM7_API_KEY: "llm7-secret",
    OPENCODE_API_KEY: "zen-secret", OPENROUTER_API_KEY: "or-secret",
    OMNIROUTE_API_KEY: "omni-secret",
  }, async () => {
    const status = getExternalAiStatus();
    assert.equal(status.configured, true);
    assert.deepEqual(status.providers.map((p) => p.provider), status.order);
    assert.ok(status.providers.every((p) => p.reason === "ready"));
    assert.doesNotMatch(JSON.stringify(status), /groq-secret|llm7-secret|zen-secret|or-secret|omni-secret/);
  });
});

test("specific free model ids are accepted (OpenRouter :free, Zen *-free)", async () => {
  await withEnv({
    ...ENABLED,
    OPENROUTER_API_KEY: "k1", OPENROUTER_MODEL: "meta-llama/llama-3.3-70b-instruct:free",
    OPENCODE_API_KEY: "k2", OPENCODE_MODEL: "deepseek-v4-flash-free",
  }, async () => {
    const status = getExternalAiStatus();
    assert.equal(providerOf(status, "openrouter").reason, "ready");
    assert.equal(providerOf(status, "opencode").reason, "ready");
  });
});

test("ai.ts allowlists external fallback to topic-only draft generators only", async () => {
  const aiSource = await readFile(new URL("../src/lib/ai.ts", import.meta.url), "utf8");
  // Exactly the five allowlisted call sites request external fallback.
  const sites = [...aiSource.matchAll(/chatJSON[^\n]*allowExternal: true/g)].length;
  assert.equal(sites, 5, "expected 5 allowlisted chatJSON call sites");
  for (const fn of ["generateIdeas", "generateContentPackage", "scoreContentOpportunity", "generateHookVariants", "generateContentBrief"]) {
    assert.match(aiSource, new RegExp(`export async function ${fn}\\b`));
  }
  // Sensitive / personal-data flows must stay local-only.
  for (const fn of ["classifyComment", "draftReply", "runProtectiveMode", "parseNaturalCommand"]) {
    const start = aiSource.indexOf(`export async function ${fn}`);
    assert.notEqual(start, -1, `${fn} not found`);
    const section = aiSource.slice(start, start + 1600);
    assert.doesNotMatch(section, /allowExternal/, `${fn} must not allow external AI`);
  }
  // The writer/critic/finalist pipeline (narration, song, email) stays local.
  const pipeline = aiSource.slice(aiSource.indexOf("async function runLocalPromptReview"), aiSource.indexOf("export interface NarrationScriptDraft"));
  assert.doesNotMatch(pipeline, /generateExternalChatJson|allowExternal/);
});

test("local-status route reports external status without reading any provider key", async () => {
  const route = await readFile(new URL("../src/app/api/ai/local-status/route.ts", import.meta.url), "utf8");
  assert.match(route, /getExternalAiStatus/);
  assert.doesNotMatch(route, /apiKey|Bearer|process\.env\.(GROQ|OPENROUTER|LLM7|OPENCODE)/);
});

test("gateway endpoint resolution enforces https for public hosts, http ok for private", () => {
  assert.equal(resolveGatewayEndpoint("http://127.0.0.1:20128/v1"), "http://127.0.0.1:20128/v1/chat/completions");
  assert.equal(resolveGatewayEndpoint("http://ollama-gw:8080/v1/"), "http://ollama-gw:8080/v1/chat/completions");
  assert.equal(resolveGatewayEndpoint("https://llm.example.com/v1/chat/completions"), "https://llm.example.com/v1/chat/completions");
  assert.equal(resolveGatewayEndpoint("http://llm.example.com/v1"), null); // public http rejected
  assert.equal(resolveGatewayEndpoint("https://user:pass@example.com/v1"), null);
  assert.equal(resolveGatewayEndpoint("https://example.com/v1?x=1"), null);
  assert.equal(resolveGatewayEndpoint("ftp://127.0.0.1/v1"), null);
  assert.equal(resolveGatewayEndpoint("not a url"), null);
});

test("OmniRoute is a first-class provider, loopback by default, key-gated", async () => {
  await withEnv({ ...ENABLED, OMNIROUTE_API_KEY: "oroute-key" }, async () => {
    const status = getExternalAiStatus();
    const omni = providerOf(status, "omniroute");
    assert.equal(omni.kind, "owner-gateway");
    assert.equal(omni.reason, "ready");
    assert.equal(omni.model, "auto");
    const stub = stubFetch(async () => okChat("auto"));
    try {
      const result = await generateExternalChatJson("Return ONLY JSON {}", "topic", 5000);
      assert.equal(result.model, "omniroute:auto");
      assert.equal(stub.calls[0].url, "http://127.0.0.1:20128/v1/chat/completions");
      assert.equal(stub.calls[0].init.headers.authorization, "Bearer oroute-key");
      assert.equal(JSON.parse(stub.calls[0].init.body).model, "auto");
    } finally { stub.restore(); }
  });
});

test("OmniRoute base URL can point at a remote https self-host, invalid base is reported", async () => {
  await withEnv({ ...ENABLED, OMNIROUTE_API_KEY: "k", OMNIROUTE_BASE_URL: "https://gw.example.com/omni/v1/" }, async () => {
    const stub = stubFetch(async () => okChat("auto"));
    try {
      await generateExternalChatJson("Return ONLY JSON {}", "topic", 5000);
      assert.equal(stub.calls[0].url, "https://gw.example.com/omni/v1/chat/completions");
    } finally { stub.restore(); }
  });
  await withEnv({ ...ENABLED, OMNIROUTE_API_KEY: "k", OMNIROUTE_BASE_URL: "http://public.example.com/v1" }, async () => {
    assert.equal(providerOf(getExternalAiStatus(), "omniroute").reason, "invalid_endpoint");
  });
});

test("custom providers: owner JSON adds a gateway that joins the chain in order", async () => {
  const custom = JSON.stringify([
    { id: "my-litellm", name: "My LiteLLM", baseUrl: "https://llm.example.com/v1", apiKeyEnv: "MY_LITELLM_KEY", model: "best-free" },
  ]);
  await withEnv({ ...ENABLED, ALO_CUSTOM_AI_PROVIDERS_JSON: custom, MY_LITELLM_KEY: "litellm-secret" }, async () => {
    const status = getExternalAiStatus();
    assert.deepEqual(status.order, ["groq", "llm7", "opencode", "openrouter", "omniroute", "my-litellm"]);
    const mine = providerOf(status, "my-litellm");
    assert.equal(mine.kind, "owner-gateway");
    assert.equal(mine.reason, "ready");
    assert.doesNotMatch(JSON.stringify(status), /litellm-secret/);
    const stub = stubFetch(async () => okChat("best-free"));
    try {
      const result = await generateExternalChatJson("Return ONLY JSON {}", "topic", 5000);
      assert.equal(result.model, "my-litellm:best-free");
      assert.equal(stub.calls[0].url, "https://llm.example.com/v1/chat/completions");
      assert.equal(stub.calls[0].init.headers.authorization, "Bearer litellm-secret");
    } finally { stub.restore(); }
  });
});

test("custom providers can be ordered first via ALO_EXTERNAL_AI_PROVIDERS", async () => {
  const custom = JSON.stringify([
    { id: "gw", baseUrl: "http://127.0.0.1:4000/v1", apiKeyEnv: "GW_KEY", model: "m1" },
  ]);
  await withEnv({
    ...ENABLED, ALO_CUSTOM_AI_PROVIDERS_JSON: custom, GW_KEY: "gw-key", GROQ_API_KEY: "g-key",
    ALO_EXTERNAL_AI_PROVIDERS: "gw,groq",
  }, async () => {
    assert.deepEqual(getExternalAiStatus().order, ["gw", "groq"]);
    const stub = stubFetch(async () => okChat("m1"));
    try {
      const result = await generateExternalChatJson("Return ONLY JSON {}", "topic", 5000);
      assert.equal(result.model, "gw:m1");
      assert.equal(stub.calls.length, 1);
      assert.match(stub.calls[0].url, /127\.0\.0\.1:4000/);
    } finally { stub.restore(); }
  });
});

test("custom provider parsing is fail-closed and never embeds literal keys", () => {
  assert.deepEqual(parseCustomAiProviders(undefined), []);
  assert.deepEqual(parseCustomAiProviders("not json"), []);
  assert.deepEqual(parseCustomAiProviders('{"id":"x"}'), []);
  const parsed = parseCustomAiProviders(JSON.stringify([
    { id: "groq", baseUrl: "https://x.example.com/v1", apiKeyEnv: "X_KEY", model: "m" }, // built-in id collision
    { id: "Bad Id!", baseUrl: "https://x.example.com/v1", apiKeyEnv: "X_KEY", model: "m" },
    { id: "embed", baseUrl: "https://x.example.com/v1", apiKey: "literal-secret", apiKeyEnv: "X_KEY", model: "m" },
    { id: "pubhttp", baseUrl: "http://x.example.com/v1", apiKeyEnv: "X_KEY", model: "m" }, // public http
    { id: "badenv", baseUrl: "https://x.example.com/v1", apiKeyEnv: "lowercase", model: "m" },
    { id: "good", baseUrl: "https://x.example.com/v1", apiKeyEnv: "X_KEY", model: "m" },
    { id: "good", baseUrl: "https://y.example.com/v1", apiKeyEnv: "Y_KEY", model: "m2" }, // duplicate
  ]));
  assert.deepEqual(parsed.map((p) => p.id), ["good"]);
  assert.equal(parsed[0].endpoint, "https://x.example.com/v1/chat/completions");
  assert.doesNotMatch(JSON.stringify(parsed), /literal-secret/);
});
