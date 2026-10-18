import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const EXPECTED_MIGRATIONS = [
  "20261001000000_initial_baseline",
  "20261007000000_human_avatar_ownership",
  "20261010000000_admissions_crm_quotes",
  "20261010000001_admin_otp_challenges",
  "20261018000000_v2_additive_mysql_tables",
];

export function verifyPrismaHistory(tsv, migrationsDirectory) {
  const rows = tsv.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split("\t"));
  if (!rows.length) throw new Error("_prisma_migrations is empty or unavailable; baseline reconciliation is required");

  const seen = new Set();
  const applied = [];
  for (const row of rows) {
    if (row.length !== 4) throw new Error("migration history query returned an unexpected row shape");
    const [name, checksum, finished, rolledBack] = row;
    if (!EXPECTED_MIGRATIONS.includes(name)) throw new Error("unrecognized migration history entry; manual reconciliation is required");
    if (seen.has(name)) throw new Error("duplicate migration history entry; manual reconciliation is required");
    seen.add(name);
    if (finished !== "1" || rolledBack !== "0") throw new Error("unfinished or rolled-back migration history entry; manual reconciliation is required");
    if (!/^[0-9a-f]{64}$/i.test(checksum)) throw new Error("migration history checksum is malformed; manual reconciliation is required");

    const migrationFile = path.join(migrationsDirectory, name, "migration.sql");
    let migrationSql;
    try { migrationSql = readFileSync(migrationFile); }
    catch { throw new Error("applied migration file is missing from the exact release"); }
    const expectedChecksum = createHash("sha256").update(migrationSql).digest("hex");
    if (checksum.toLowerCase() !== expectedChecksum) throw new Error("applied migration checksum does not match the exact release");
    applied.push(name);
  }

  const expectedPrefix = EXPECTED_MIGRATIONS.slice(0, applied.length);
  if (JSON.stringify(applied) !== JSON.stringify(expectedPrefix)) {
    throw new Error("applied migrations are not an ordered prefix; manual reconciliation is required");
  }
  if (applied[0] !== EXPECTED_MIGRATIONS[0]) {
    throw new Error("initial baseline is not recorded as applied; reconcile it on a restored copy before deployment");
  }

  return { applied, pending: EXPECTED_MIGRATIONS.slice(applied.length) };
}

function main() {
  const [historyFile, migrationsDirectory] = process.argv.slice(2);
  if (!historyFile || !migrationsDirectory) {
    throw new Error("usage: node scripts/verify-prisma-history.mjs <private-history.tsv> <exact-release-migrations-dir>");
  }
  const tsv = readFileSync(historyFile, "utf8");
  const { applied, pending } = verifyPrismaHistory(tsv, migrationsDirectory);
  process.stdout.write(`${JSON.stringify({ appliedCount: applied.length, pending })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(); }
  catch (error) {
    console.error(`[history] ERROR: ${error instanceof Error ? error.message : "verification failed"}`);
    process.exitCode = 1;
  }
}
