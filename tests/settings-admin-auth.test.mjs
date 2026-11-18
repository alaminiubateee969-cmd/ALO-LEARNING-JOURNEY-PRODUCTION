import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

// `/api/settings` is the ALO administrator console's brand/system settings route.
// The request gateway (`src/proxy.ts`) authenticates *either* an admin session or
// a MarketingOS bearer token, so the route must not rely on the gateway alone:
// a valid MarketingOS token would otherwise rebrand the single-tenant site.
// MarketingOS tenants use the company-scoped `/api/settings/*` siblings instead.
test("brand settings require the ALO administrator session, not a MarketingOS bearer", () => {
  const route = source("src/app/api/settings/route.ts");

  assert.match(route, /import \{ requireOwner \} from "@\/lib\/auth"/);
  assert.match(route, /await requireOwner\(\)/);

  // Both handlers gate before touching the database.
  const guardCalls = route.match(/const denied = await requireAdminSession\(\);/g) ?? [];
  assert.equal(guardCalls.length, 2, "GET and POST must both require the admin session");
  assert.match(route, /if \(denied\) return denied;\s*await ensureSeeded\(\)/);
});
