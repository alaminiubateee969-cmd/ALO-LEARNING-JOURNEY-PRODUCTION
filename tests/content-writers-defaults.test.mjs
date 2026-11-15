import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

// `Content.engagement` and `MosCampaign.metrics` are TEXT NOT NULL. Databases
// created before the current schema have no column default, and Prisma omits a
// field the caller does not set, so the INSERT fails with P2011 ("Null
// constraint violation"). PR #9 hardened POST /api/content and
// POST /api/campaigns; the remaining writers (AI media routes, feed import, the
// workflow email step, agent tools) still omitted it and kept failing.
test("every Content / MosCampaign insert supplies its TEXT NOT NULL default", () => {
  const required = [
    { call: "db.content.create", field: "engagement" },
    { call: "db.mosCampaign.create", field: "metrics" },
  ];
  const missing = [];

  for (const file of sourceFiles(path.join(root, "src"))) {
    const source = readFileSync(file, "utf8");
    for (const { call, field } of required) {
      let index = source.indexOf(call);
      while (index !== -1) {
        const window = source.slice(index, index + 900);
        const end = window.indexOf("})");
        const args = end === -1 ? window : window.slice(0, end);
        if (!new RegExp(`\\b${field}\\s*:`).test(args)) {
          missing.push(`${path.relative(root, file)} — ${call} without ${field}`);
        }
        index = source.indexOf(call, index + call.length);
      }
    }
  }

  assert.deepEqual(missing, [], `writers still omitting a required TEXT column:\n${missing.join("\n")}`);
});
