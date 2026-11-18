import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { encode } from "next-auth/jwt";
import { proxy } from "../../src/proxy";
import { POST as imagePost } from "../../src/app/api/images/generate/route";
import { getLocalAiStatus } from "../../src/lib/local-models";

async function main() {
  Object.assign(process.env, { NODE_ENV: "production" });
  process.env.ADMIN_OTP_REQUIRED = "false";
  process.env.ADMIN_EMAIL = "admin@example.test";
  process.env.ADMIN_PASSWORD_HASH = `scrypt$${"a".repeat(22)}$${"b".repeat(86)}`;
  process.env.NEXTAUTH_SECRET = "admin-session-secret-for-tests";
  process.env.JWT_SECRET = "marketing-tenant-secret-for-tests";
  const token = await new SignJWT({ userId: "user1", companyId: "company1", role: "super_admin" })
    .setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
  const session = await encode({ secret: process.env.NEXTAUTH_SECRET, token: { sub: "dev-admin" } });
  const request = (path: string, headers: Record<string, string> = {}) =>
    new NextRequest(`https://example.test${path}`, { headers });
  for (const path of ["/api/ideas", "/api/ai/local-status", "/api/content/generate", "/api/images/generate", "/api/voice/generate", "/api/backups", "/dashboard"]) {
    assert.equal((await proxy(request(path, { authorization: `Bearer ${token}` }))).status, path === "/dashboard" ? 307 : 401, path);
  }
  assert.equal((await proxy(request("/api/ai/chat", { authorization: `Bearer ${token}` }))).headers.get("x-middleware-next"), "1");
  assert.equal((await proxy(request("/api/ai/chat", { authorization: "Bearer invalid" }))).status, 401);
  assert.equal((await proxy(request("/api/ideas", { cookie: `__Secure-next-auth.session-token=${session}` }))).headers.get("x-middleware-next"), "1");

  for (const body of [null, {}, { prompt: "" }, { prompt: "x".repeat(2001) },
    { prompt: "x", filename: "../../escape" }, { prompt: "x", filename: "foo\\bar" },
    { prompt: "x", filename: 1 }, { prompt: "x", filename: "." }, { prompt: "x", filename: "a".repeat(77) }]) {
    const res = await imagePost(new Request("https://example.test/api/images/generate", { method: "POST", body: JSON.stringify(body) }));
    assert.equal(res.status, 400, JSON.stringify(body));
  }

  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      if (String(url).includes("/api/tags")) return Response.json({ models: [{ name: "model:latest" }] });
      return new Response("unavailable", { status: 503 });
    };
    process.env.OLLAMA_MODEL = "model";
    const ready = await getLocalAiStatus();
    assert.equal(ready.text.available, true);
    assert.deepEqual(ready.text.installedModels, ["model:latest"]);
    assert.equal(ready.images.available, false);
    assert.equal(ready.images.placeholderAvailable, true);
    process.env.OLLAMA_MODEL = "other";
    const missing = await getLocalAiStatus();
    assert.equal(missing.text.available, false);
    assert.equal(missing.text.templateFallbackAvailable, true);
    assert.deepEqual(missing.text.installedModels, ["model:latest"]);
  } finally {
    globalThis.fetch = realFetch;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
