import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SignJWT } from "jose";
import { readBearerToken, verifyMarketingOsBearer } from "../src/lib/bearer-auth.ts";

const SECRET = "test-only-jwt-secret-for-bearer-auth-unit-tests";

async function sign(claims, secret = SECRET, expiresIn = "1h") {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(secret));
}

function withSecret(secret, run) {
  const previous = process.env.JWT_SECRET;
  if (secret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = secret;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  }
}

test("only a well-formed Bearer header yields a credential", () => {
  assert.equal(readBearerToken("Bearer abc.def.ghi"), "abc.def.ghi");
  assert.equal(readBearerToken("bearer abc"), "abc");
  assert.equal(readBearerToken("Bearer   abc"), "abc");
  assert.equal(readBearerToken("Bearer "), null);
  assert.equal(readBearerToken("Basic dXNlcjpwYXNz"), null);
  assert.equal(readBearerToken(""), null);
  assert.equal(readBearerToken(null), null);
  assert.equal(readBearerToken(undefined), null);
});

test("a valid MarketingOS token is accepted", async () => {
  const token = await sign({ userId: "user_1", companyId: "company_1", role: "admin" });
  const subject = await withSecret(SECRET, () => verifyMarketingOsBearer(`Bearer ${token}`));
  assert.deepEqual(subject, { userId: "user_1", companyId: "company_1", role: "admin" });
});

test("forged, expired, unsigned, or unknown-secret tokens are rejected", async () => {
  const forged = await sign({ userId: "attacker" }, "some-other-secret");
  const expired = await sign({ userId: "user_1" }, SECRET, "-1h");
  const unsigned = "eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOiJhdHRhY2tlciJ9.";

  await withSecret(SECRET, async () => {
    assert.equal(await verifyMarketingOsBearer(`Bearer ${forged}`), null);
    assert.equal(await verifyMarketingOsBearer(`Bearer ${expired}`), null);
    assert.equal(await verifyMarketingOsBearer(`Bearer ${unsigned}`), null);
    assert.equal(await verifyMarketingOsBearer("Bearer not-a-jwt"), null);
    assert.equal(await verifyMarketingOsBearer("Bearer anything"), null);
    assert.equal(await verifyMarketingOsBearer(null), null);
  });
});

test("a token without a userId claim is not an authenticated subject", async () => {
  const token = await sign({ companyId: "company_1" });
  await withSecret(SECRET, async () => {
    assert.equal(await verifyMarketingOsBearer(`Bearer ${token}`), null);
  });
});

test("verification fails closed when JWT_SECRET is not configured", async () => {
  const token = await sign({ userId: "user_1" });
  await withSecret(undefined, async () => {
    assert.equal(await verifyMarketingOsBearer(`Bearer ${token}`), null);
  });
});

test("the request gateway verifies the bearer token instead of trusting the header", () => {
  const proxy = readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8");
  assert.match(proxy, /verifyMarketingOsBearer\(request\.headers\.get\("authorization"\)\)/);
  // The previous implementation let any `Authorization: Bearer <junk>` header
  // skip the session check for every /api/ route.
  assert.doesNotMatch(proxy, /authHeader\.startsWith\("Bearer "\)/);
  assert.doesNotMatch(proxy, /Authorization"\)\?\.startsWith\("Bearer/);
});
