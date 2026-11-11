import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("checked-in MySQL migration chain covers every Prisma model without destructive SQL", () => {
  const result = spawnSync(process.execPath, ["scripts/verify-migrations.mjs"], {
    cwd: root,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /141 Prisma models, 1823 scalar column types/);
  assert.match(result.stdout, /indexes, unique constraints, primary keys, foreign keys, and one implicit relation table/);
  assert.match(result.stdout, /six additive MySQL migrations/);
  assert.match(result.stdout, /no destructive SQL found/);
});

test("verifier rejects ON DELETE SET NULL on a NOT NULL column (MySQL error 1830)", () => {
  // Reintroduce the bug MySQL caught in CI: an optional relation (`MosCompany?`,
  // whose default action is SetNull) on the required KnowledgeNode.companyId.
  const dir = mkdtempSync(path.join(tmpdir(), "verify-migrations-"));
  try {
    cpSync(path.join(root, "prisma"), path.join(dir, "prisma"), { recursive: true });
    mkdirSync(path.join(dir, "scripts"));
    cpSync(path.join(root, "scripts", "verify-migrations.mjs"), path.join(dir, "scripts", "verify-migrations.mjs"));

    const schemaFile = path.join(dir, "prisma", "schema.prisma");
    const fixedRelation = "MosCompany   @relation(fields: [companyId], references: [id], onDelete: Cascade)";
    const schema = readFileSync(schemaFile, "utf8");
    const block = schema.match(/^model KnowledgeNode \{[\s\S]*?^\}/m)?.[0];
    assert.ok(block?.includes(fixedRelation), "fixture relation not found in model KnowledgeNode");
    writeFileSync(schemaFile, schema.replace(block, block.replace(fixedRelation, "MosCompany?  @relation(fields: [companyId], references: [id])")));

    const sqlFile = path.join(dir, "prisma", "migrations", "20261111000000_marketingos_workforce_tables", "migration.sql");
    const fixedFk = "`KnowledgeNode_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE";
    const sql = readFileSync(sqlFile, "utf8");
    assert.ok(sql.includes(fixedFk), "fixture foreign key not found in the migration");
    writeFileSync(sqlFile, sql.replace(fixedFk, fixedFk.replace("ON DELETE CASCADE", "ON DELETE SET NULL")));

    const result = spawnSync(process.execPath, [path.join("scripts", "verify-migrations.mjs")], { cwd: dir, encoding: "utf8" });
    assert.notEqual(result.status, 0, "verifier accepted SET NULL on a NOT NULL column");
    assert.match(result.stderr, /KnowledgeNode\.companyId is NOT NULL but its foreign key uses ON DELETE SET NULL/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
