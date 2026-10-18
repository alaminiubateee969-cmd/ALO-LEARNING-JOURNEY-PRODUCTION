import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { EXPECTED_MIGRATIONS, verifyPrismaHistory } from "../scripts/verify-prisma-history.mjs";

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "alo-prisma-history-"));
  const migrations = path.join(root, "migrations");
  mkdirSync(migrations);
  const checksums = new Map();
  for (const name of EXPECTED_MIGRATIONS) {
    const dir = path.join(migrations, name);
    mkdirSync(dir);
    const sql = `-- isolated test fixture: ${name}\nCREATE TABLE \`${name}\` (\`id\` VARCHAR(191) NOT NULL);\n`;
    writeFileSync(path.join(dir, "migration.sql"), sql);
    checksums.set(name, createHash("sha256").update(sql).digest("hex"));
  }
  return { root, migrations, checksums };
}

function history(names, checksums) {
  return names.map((name) => `${name}\t${checksums.get(name)}\t1\t0`).join("\n");
}

test("accepts only an applied, checksum-matched migration prefix after the baseline", () => {
  const f = fixture();
  try {
    const result = verifyPrismaHistory(history(EXPECTED_MIGRATIONS.slice(0, 3), f.checksums), f.migrations);
    assert.deepEqual(result.applied, EXPECTED_MIGRATIONS.slice(0, 3));
    assert.deepEqual(result.pending, EXPECTED_MIGRATIONS.slice(3));
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("blocks absent baseline/history before deployment", () => {
  const f = fixture();
  try {
    assert.throws(() => verifyPrismaHistory("", f.migrations), /_prisma_migrations is empty/);
    const laterOnly = history([EXPECTED_MIGRATIONS[1]], f.checksums);
    assert.throws(() => verifyPrismaHistory(laterOnly, f.migrations), /ordered prefix/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("blocks failed, rolled-back, duplicate, or unknown history entries", () => {
  const f = fixture();
  try {
    const name = EXPECTED_MIGRATIONS[0];
    const checksum = f.checksums.get(name);
    assert.throws(() => verifyPrismaHistory(`${name}\t${checksum}\t0\t0`, f.migrations), /unfinished or rolled-back/);
    assert.throws(() => verifyPrismaHistory(`${name}\t${checksum}\t1\t1`, f.migrations), /unfinished or rolled-back/);
    assert.throws(() => verifyPrismaHistory(`${name}\t${checksum}\t1\t0\n${name}\t${checksum}\t1\t0`, f.migrations), /duplicate/);
    assert.throws(() => verifyPrismaHistory(`20250101000000_unknown\t${checksum}\t1\t0`, f.migrations), /unrecognized/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("blocks a checksum mismatch for a previously applied migration", () => {
  const f = fixture();
  try {
    const name = EXPECTED_MIGRATIONS[0];
    const bad = new Map(f.checksums);
    bad.set(name, "0".repeat(64));
    assert.throws(() => verifyPrismaHistory(history([name], bad), f.migrations), /checksum does not match/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
