import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workforceMigration = path.join("prisma", "migrations", "20261111000000_marketingos_workforce_tables", "migration.sql");

function replaceOnce(text, search, replacement, what) {
  assert.equal(text.split(search).length - 1, 1, `fixture: expected exactly one ${what}`);
  return text.replace(search, replacement);
}

// Runs the verifier against a scratch copy of prisma/ after applying edits to it.
function verifyWith({ schema = (text) => text, migration = (text) => text }) {
  const dir = mkdtempSync(path.join(tmpdir(), "verify-migrations-"));
  try {
    cpSync(path.join(root, "prisma"), path.join(dir, "prisma"), { recursive: true });
    mkdirSync(path.join(dir, "scripts"));
    cpSync(path.join(root, "scripts", "verify-migrations.mjs"), path.join(dir, "scripts", "verify-migrations.mjs"));
    for (const [file, edit] of [[path.join("prisma", "schema.prisma"), schema], [workforceMigration, migration]]) {
      const target = path.join(dir, file);
      writeFileSync(target, edit(readFileSync(target, "utf8")));
    }
    return spawnSync(process.execPath, [path.join("scripts", "verify-migrations.mjs")], { cwd: dir, encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Edits one line inside `model <name> { ... }`.
function inModel(name, search, replacement) {
  return (schema) => {
    const block = schema.match(new RegExp(`^model ${name} \\{[\\s\\S]*?^\\}`, "m"))?.[0];
    assert.ok(block, `fixture: model ${name} not found`);
    return schema.replace(block, replaceOnce(block, search, replacement, `match in model ${name}`));
  };
}

const knowledgeNodeFk = "`KnowledgeNode_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE";
const knowledgeNodeRelation = "MosCompany   @relation(fields: [companyId], references: [id], onDelete: Cascade)";

test("checked-in MySQL migration chain covers every Prisma model without destructive SQL", () => {
  const result = spawnSync(process.execPath, ["scripts/verify-migrations.mjs"], {
    cwd: root,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /141 Prisma models, 1823 scalar column types/);
  assert.match(result.stdout, /indexes, unique constraints, primary keys, foreign keys, and one implicit relation table/);
  assert.match(result.stdout, /six additive MySQL migrations/);
  assert.match(result.stdout, /101 TEXT expression defaults use the form MySQL 8 reports to Prisma/);
  assert.match(result.stdout, /no destructive SQL found/);
});

test("verifier rejects ON DELETE SET NULL on a NOT NULL column (MySQL error 1830)", () => {
  // The bug MySQL caught in CI: an optional relation over the required
  // KnowledgeNode.companyId, migrated as ON DELETE SET NULL.
  const result = verifyWith({
    schema: inModel("KnowledgeNode", knowledgeNodeRelation, "MosCompany?  @relation(fields: [companyId], references: [id])"),
    migration: (sql) => replaceOnce(sql, knowledgeNodeFk, knowledgeNodeFk.replace("ON DELETE CASCADE", "ON DELETE SET NULL"), "KnowledgeNode FK"),
  });
  assert.notEqual(result.status, 0, "verifier accepted SET NULL on a NOT NULL column");
  assert.match(result.stderr, /KnowledgeNode\.companyId is NOT NULL but its foreign key uses ON DELETE SET NULL/);
});

test("verifier applies Prisma's default onDelete for an optional relation over a required scalar (RESTRICT)", () => {
  // Prisma derives the default from the scalar fields: any required one makes it
  // RESTRICT even though the relation field itself is optional.
  const result = verifyWith({
    schema: inModel("KnowledgeNode", knowledgeNodeRelation, "MosCompany?  @relation(fields: [companyId], references: [id])"),
    migration: (sql) => replaceOnce(sql, knowledgeNodeFk, knowledgeNodeFk.replace("ON DELETE CASCADE", "ON DELETE RESTRICT"), "KnowledgeNode FK"),
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("verifier rejects TEXT dbgenerated() defaults that MySQL 8 reports in another form (schema drift)", () => {
  // `('[]')` is valid, but MySQL 8 reports DEFAULT ('[]') as (_utf8mb4\'[]\'),
  // so prisma migrate diff reported every such column as drift in CI.
  const result = verifyWith({
    schema: (schema) => {
      const line = schema.match(/^\s+skillsJson\s+String @default\(dbgenerated\("[^\n]*$/m)?.[0];
      assert.ok(line?.includes(String.raw`dbgenerated("(_utf8mb4\\'[]\\')")`), `fixture: canonical skillsJson default not found (${line})`);
      return replaceOnce(schema, line, line.replace(String.raw`(_utf8mb4\\'[]\\')`, "('[]')"), "skillsJson line");
    },
  });
  assert.notEqual(result.status, 0, "verifier accepted a dbgenerated() default that drifts on MySQL 8");
  assert.match(result.stderr, /AgentProfile\.skillsJson must be @default\(dbgenerated\("\(_utf8mb4\\\\'\[\]\\\\'\)"\)\)/);
});

test("verifier rejects migrations that contain Prisma-rendered _utf8mb4\\' defaults", () => {
  const result = verifyWith({
    migration: (sql) => replaceOnce(sql, "`skillsJson` TEXT NOT NULL DEFAULT ('[]')", "`skillsJson` TEXT NOT NULL DEFAULT (_utf8mb4\\'[]\\')", "skillsJson column"),
  });
  assert.notEqual(result.status, 0, "verifier accepted SQL MySQL cannot parse");
  assert.match(result.stderr, /contains a Prisma-rendered default/);
});
