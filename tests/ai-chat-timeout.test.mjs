import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The dashboard assistant calls a local model that runs on CPU only on the
// production host. A short prompt was measured at ~38s there, so the whole
// request path must allow well over 30s. When the budget was 30s (and the local
// fetch was clamped to 12s), POST /api/ai/chat answered
// 503 ai_unavailable even though Ollama was healthy and replied correctly.
test("the assistant chat path allows a CPU-bound local model to finish", () => {
  const ai = readFileSync(new URL("../src/lib/ai.ts", import.meta.url), "utf8");
  const local = readFileSync(new URL("../src/lib/local-models.ts", import.meta.url), "utf8");

  const millis = (raw) => Number(raw.replace(/_/g, ""));

  const chatTimeout = /generateChatReply[\s\S]*?timeoutMs:\s*([\d_]+)/.exec(ai);
  assert.ok(chatTimeout, "generateChatReply must set an explicit timeoutMs");
  assert.ok(
    millis(chatTimeout[1]) >= 90_000,
    `generateChatReply timeout must be >= 90s, got ${chatTimeout[1]}ms`,
  );

  const cap = /Math\.min\(timeoutMs,\s*([\d_]+)\)/.exec(local);
  assert.ok(cap, "local-models must keep an upper bound on the fetch timeout");
  assert.ok(
    millis(cap[1]) >= 90_000,
    `the local fetch cap must not clamp the chat budget, got ${cap[1]}ms`,
  );
});
