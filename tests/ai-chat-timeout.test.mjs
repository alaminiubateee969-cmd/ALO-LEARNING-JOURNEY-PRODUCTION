import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("assistant chat has an adjustable, bounded CPU inference budget", () => {
  const ai = readFileSync(new URL("../src/lib/ai.ts", import.meta.url), "utf8");
  const local = readFileSync(new URL("../src/lib/local-models.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../src/app/api/ai/chat/route.ts", import.meta.url), "utf8");
  assert.match(ai, /OLLAMA_CHAT_TIMEOUT_MS/);
  assert.match(ai, /Math\.min\(configured, 300_000\)/);
  assert.match(ai, /: 180_000/);
  assert.match(local, /Math\.min\(timeoutMs, 300_000\)/);
  assert.match(route, /maxDuration = 300/);
});
