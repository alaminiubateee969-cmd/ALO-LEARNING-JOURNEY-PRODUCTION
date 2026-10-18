import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsRoot = path.join(root, "prisma", "migrations");
const schemaPath = path.join(root, "prisma", "schema.prisma");
const lockPath = path.join(migrationsRoot, "migration_lock.toml");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readMigration(directory) {
  const sql = readFileSync(path.join(migrationsRoot, directory, "migration.sql"), "utf8");
  const executableSql = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*--.*$/gm, " ");
  const creates = [...executableSql.matchAll(/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?`([^`]+)`/gi)];
  return { sql, executableSql, creates };
}

const schema = readFileSync(schemaPath, "utf8");
const models = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((match) => match[1]);
assert(models.length === 32, `Expected 32 Prisma models; found ${models.length}.`);
assert(new Set(models).size === models.length, "Duplicate Prisma model names found.");

const directories = readdirSync(migrationsRoot)
  .filter((name) => /^\d{14}_/.test(name))
  .sort();
assert(directories.length === 3, `Expected the three reviewed migrations; found ${directories.length}.`);
assert(readFileSync(lockPath, "utf8").includes('provider = "mysql"'), "Migration lock provider is not MySQL.");

const expectedByMigration = new Map([
  ["20261001000000_initial_baseline", { extra: ["_FamilyProfileToFamilyProject"], baseline: true }],
  ["20261010000000_admissions_crm_quotes", { models: ["Lead", "LeadActivity", "Quotation", "QuotationItem"] }],
  ["20261010000001_admin_otp_challenges", { models: ["AdminOtpChallenge"] }],
]);
const createdTables = new Set();

for (const directory of directories) {
  const parsed = readMigration(directory);
  const contract = expectedByMigration.get(directory);
  assert(contract, `Unexpected migration directory ${directory}; update this review before adding migrations.`);
  assert(parsed.creates.length > 0, `${directory} contains no CREATE TABLE statements.`);
  for (const match of parsed.creates) {
    const [, ifNotExists, table] = match;
    assert(!createdTables.has(table), `Table ${table} is created more than once in the migration chain.`);
    createdTables.add(table);
    if (contract.baseline) {
      assert(Boolean(ifNotExists), `Baseline table ${table} is not guarded by CREATE TABLE IF NOT EXISTS.`);
    }
  }
  assert(
    !/\bDROP\s+(?:TABLE|DATABASE|SCHEMA|INDEX)\b|\bTRUNCATE(?:\s+TABLE)?\b|\bDELETE\s+FROM\b|\bALTER\s+TABLE\b[\s\S]*?\bDROP\b/i.test(parsed.executableSql),
    `${directory} contains a destructive SQL operation.`,
  );

  if (contract.models) {
    const actual = parsed.creates.map((match) => match[2]).sort();
    assert(
      JSON.stringify(actual) === JSON.stringify([...contract.models].sort()),
      `${directory} table set differs from its reviewed additive table set.`,
    );
  }
  if (contract.extra) {
    const actualModels = parsed.creates.map((match) => match[2]).filter((name) => name !== "_FamilyProfileToFamilyProject");
    const expectedModels = models.filter((name) => !["Lead", "LeadActivity", "Quotation", "QuotationItem", "AdminOtpChallenge"].includes(name));
    assert(
      JSON.stringify([...actualModels].sort()) === JSON.stringify([...expectedModels].sort()),
      `${directory} model tables do not match the reviewed baseline model set.`,
    );
    assert(contract.extra.every((table) => createdTables.has(table)), `${directory} is missing the implicit family-project relation table.`);
  }
}

const expectedTables = [...models, "_FamilyProfileToFamilyProject"].sort();
assert(
  JSON.stringify([...createdTables].sort()) === JSON.stringify(expectedTables),
  "Migration chain does not create exactly the 32 schema model tables plus the implicit family-project relation table.",
);

console.log(`PASS: ${models.length} Prisma models and one implicit relation table are covered by three additive MySQL migrations; no destructive SQL found.`);
