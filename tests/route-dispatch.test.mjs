import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isMarketingOsRequest, methodNotAllowed } from "../src/lib/route-dispatch.ts";

const SHARED_ROUTES = [
  "analytics",
  "dashboard",
  "notifications",
  "crm/leads",
  "crm/leads/[id]",
];

function request(headers = {}) {
  return new Request("http://localhost/api/dashboard", { headers });
}

test("only a non-empty Bearer credential selects the MarketingOS handler", () => {
  assert.equal(isMarketingOsRequest(request({ authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.e30.sig" })), true);
  assert.equal(isMarketingOsRequest(request({ authorization: "bearer token" })), true);
  assert.equal(isMarketingOsRequest(request()), false);
  assert.equal(isMarketingOsRequest(request({ cookie: "next-auth.session-token=abc; mos_token=xyz" })), false);
  assert.equal(isMarketingOsRequest(request({ authorization: "Bearer " })), false);
  assert.equal(isMarketingOsRequest(request({ authorization: "Basic dXNlcjpwYXNz" })), false);
});

test("methods implemented by only one application answer 405 with an Allow header", async () => {
  const response = methodNotAllowed(["GET"]);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET");
  assert.deepEqual(await response.json(), { error: "method_not_allowed" });
});

test("every shared path keeps both implementations and dispatches without granting access", () => {
  for (const route of SHARED_ROUTES) {
    const base = new URL(`../src/app/api/${route}/`, import.meta.url);
    const source = readFileSync(new URL("route.ts", base), "utf8");
    assert.match(source, /isMarketingOsRequest\(request\)/, `${route} must dispatch on the Bearer scheme`);
    assert.match(source, /from "\.\/alo-handlers"/, `${route} must keep the ALO handler`);
    assert.match(source, /from "\.\/marketingos-handlers"/, `${route} must keep the MarketingOS handler`);
    // The MarketingOS handlers authenticate the bearer token themselves.
    const marketingos = readFileSync(new URL("marketingos-handlers.ts", base), "utf8");
    assert.match(marketingos, /verifyToken\(token\)/, `${route} MarketingOS handler must verify its JWT`);
  }
});
