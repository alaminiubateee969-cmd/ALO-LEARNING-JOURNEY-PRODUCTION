import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseExpectedDefaults } from "../scripts/repair-column-defaults.mjs";

function source(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("content creation maps the dashboard payload onto real columns and supplies engagement", () => {
  const route = source("src/app/api/content/route.ts");
  // The dashboard form posts `scheduledDate`; the column is `scheduledAt`.
  assert.match(route, /optionalDate\(input\.scheduledDate\)/);
  // `engagement` is TEXT NOT NULL; never rely on the column default existing.
  assert.match(route, /engagement: jsonText\(input\.engagement, '\{\}'\)/);
  // An unknown key (e.g. `scheduledDate`) used to reach Prisma and force a 500.
  assert.doesNotMatch(route, /\.\.\.data, creatorId/);
  assert.doesNotMatch(route, /const createData: any = \{ \.\.\.data/);
  assert.match(route, /console\.error\('\[POST \/api\/content\]', err\)/);
});

test("campaign creation drops fields the model does not have and supplies metrics", () => {
  const route = source("src/app/api/campaigns/route.ts");
  // MosCampaign has no `description` column; Prisma rejected the previous spread.
  assert.doesNotMatch(route, /const createData: any = \{ \.\.\.data, companyId/);
  assert.match(route, /metrics: JSON\.stringify\(metrics\)/);
  assert.match(route, /optionalDate\(body\.startDate\)/);
  assert.match(route, /console\.error\('\[POST \/api\/campaigns\]', err\)/);
});

test("SEO challenge creation supplies the tasks column explicitly", () => {
  const route = source("src/app/api/seo/route.ts");
  assert.match(route, /tasks: JSON\.stringify\(\[\]\)/);
  assert.match(route, /console\.error\('\[POST \/api\/seo\]', err\)/);
});

test("the assistant chat endpoint degrades honestly instead of answering 500", () => {
  const route = source("src/app/api/ai/chat/route.ts");
  const service = source("src/lib/ai.ts");
  assert.doesNotMatch(route, /z-ai-web-dev-sdk/);
  assert.match(route, /generateChatReply/);
  assert.match(route, /ai_unavailable/);
  assert.match(route, /status: 503/);
  assert.match(service, /export async function generateChatReply/);
  assert.doesNotMatch(service, /z-ai-web-dev-sdk|ZAI\.create/);
});

test("the column-default repair script knows every declared TEXT default", () => {
  const expected = parseExpectedDefaults();
  const lookup = new Map(expected.map((entry) => [`${entry.table}.${entry.column}`, entry.value]));

  assert.ok(expected.length >= 100, `expected ~101 declared defaults, got ${expected.length}`);
  assert.equal(lookup.get("Content.engagement"), "{}");
  assert.equal(lookup.get("MosCampaign.metrics"), "{}");
  assert.equal(lookup.get("SeoChallenge.tasks"), "[]");
  assert.equal(lookup.get("SocialAccount.scopes"), "[]");
  assert.equal(lookup.get("CompanyUser.permissions"), "{}");
  assert.equal(lookup.get("AgentProfile.constitution"), "");

  for (const entry of expected) {
    assert.match(entry.table, /^[A-Za-z_][A-Za-z0-9_]*$/);
    assert.match(entry.column, /^[A-Za-z_][A-Za-z0-9_]*$/);
    assert.ok(!entry.value.includes("'"), `${entry.table}.${entry.column} default must not need escaping`);
  }
});
