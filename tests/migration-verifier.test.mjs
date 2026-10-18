import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("checked-in MySQL migration chain covers every Prisma model without destructive SQL", () => {
  const result = spawnSync(process.execPath, ["scripts/verify-migrations.mjs"], {
    cwd: root,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /42 Prisma models, 480 scalar column types/);
  assert.match(result.stdout, /indexes, unique constraints, primary keys, foreign keys, and one implicit relation table/);
  assert.match(result.stdout, /five additive MySQL migrations/);
  assert.match(result.stdout, /no destructive SQL found/);
});
