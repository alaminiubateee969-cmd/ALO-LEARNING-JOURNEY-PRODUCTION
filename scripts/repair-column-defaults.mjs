#!/usr/bin/env node
/**
 * Repair TEXT/LONGTEXT column defaults that are missing from a live database.
 *
 * `prisma/schema.prisma` declares JSON-holding TEXT columns as
 * `@default(dbgenerated("(_utf8mb4\\'{}|[]\\')"))` — a MariaDB expression
 * default. Databases that were created with an older schema (or with
 * `prisma db push` against the SQLite-flavoured schema from PR #27) ended up
 * with those columns as `TEXT NOT NULL` and **no** default. Prisma omits the
 * column when a caller does not supply it, so every such INSERT fails with
 * MySQL error 1364 ("Field 'x' doesn't have a default value") and the API
 * answers HTTP 500.
 *
 * This script compares the schema's declared defaults with
 * `information_schema.COLUMNS` and (with --apply) sets the missing defaults.
 * It never touches data, never drops a column, and is safe to re-run.
 *
 * Usage:
 *   node scripts/repair-column-defaults.mjs                 # report only
 *   node scripts/repair-column-defaults.mjs --apply         # set defaults
 *   node scripts/repair-column-defaults.mjs --env-file .env.config
 *
 * The database URL is resolved from --env-file, then .env.config, then .env,
 * then the process environment.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = path.join(root, 'prisma', 'schema.prisma');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const envFileFlag = args.indexOf('--env-file');
const envFileArg = envFileFlag >= 0 ? args[envFileFlag + 1] : null;

function loadEnvFile(candidate) {
  if (!candidate || !existsSync(candidate)) return false;
  const text = readFileSync(candidate, 'utf8');
  for (const line of text.split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Never override a value the operator already exported.
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
  return true;
}

const envCandidates = envFileArg
  ? [path.resolve(root, envFileArg)]
  : [path.join(root, '.env.config'), path.join(root, '.env')];
const loadedEnvFile = envCandidates.find((candidate) => loadEnvFile(candidate)) ?? null;

function redact(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    if (url.password) url.password = '***';
    return url.toString();
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

// ---------------------------------------------------------------------------
// 1. Expected defaults, parsed from prisma/schema.prisma
// ---------------------------------------------------------------------------

/** Matches `@default(dbgenerated("(_utf8mb4\'{}\')"))` (and `\'[]\'`, `\'\'`). */
const DBGENERATED_TEXT_DEFAULT =
  /@default\(dbgenerated\("\(_utf8mb4\\\\'(.*?)\\\\'\)"\)\)/;

function parseExpectedDefaults() {
  const lines = readFileSync(schemaPath, 'utf8').split('\n');
  const expected = [];
  let model = null;

  for (const line of lines) {
    const modelMatch = /^model\s+(\w+)\s*\{/.exec(line);
    if (modelMatch) {
      model = modelMatch[1];
      continue;
    }
    if (/^\}/.test(line)) {
      model = null;
      continue;
    }
    if (!model) continue;

    const fieldMatch = /^\s+(\w+)\s+String\??\s/.exec(line);
    const defaultMatch = DBGENERATED_TEXT_DEFAULT.exec(line);
    if (!fieldMatch || !defaultMatch) continue;

    expected.push({ table: model, column: fieldMatch[1], value: defaultMatch[1] });
  }

  return expected;
}

// ---------------------------------------------------------------------------
// 2. Live columns
// ---------------------------------------------------------------------------

const TEXT_TYPES = new Set(['tinytext', 'text', 'mediumtext', 'longtext']);

async function readColumns(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, COLUMN_TYPE AS columnType,
            IS_NULLABLE AS isNullable, COLUMN_DEFAULT AS columnDefault, DATA_TYPE AS dataType
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()`
  );
  const map = new Map();
  for (const row of rows) {
    map.set(`${row.tableName}.${row.columnName}`, {
      table: String(row.tableName),
      column: String(row.columnName),
      columnType: String(row.columnType),
      isNullable: String(row.isNullable).toUpperCase() === 'YES',
      columnDefault: row.columnDefault === null ? null : String(row.columnDefault),
      dataType: String(row.dataType).toLowerCase(),
    });
  }
  return map;
}

function quoteIdent(name) {
  return `\`${name.replace(/`/g, '``')}\``;
}

function sqlLiteral(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

function setDefaultStatement({ table, column }, value) {
  // `ALTER COLUMN … SET DEFAULT` keeps the column otherwise untouched and is
  // supported by MariaDB 10.2+ and MySQL 8.0.13+.
  return `ALTER TABLE ${quoteIdent(table)} ALTER COLUMN ${quoteIdent(column)} SET DEFAULT (${sqlLiteral(value)})`;
}

function modifyStatement({ table, column, columnType }, value) {
  return `ALTER TABLE ${quoteIdent(table)} MODIFY ${quoteIdent(column)} ${columnType.toUpperCase()} NOT NULL DEFAULT (${sqlLiteral(value)})`;
}

// ---------------------------------------------------------------------------
// 3. Main
// ---------------------------------------------------------------------------

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Pass --env-file or export it first.');
    process.exit(1);
  }

  console.log('ALO Learning Journey — TEXT column default repair');
  console.log(`  schema:   ${path.relative(root, schemaPath)}`);
  console.log(`  env file: ${loadedEnvFile ? path.relative(root, loadedEnvFile) : '(process environment)'}`);
  console.log(`  database: ${redact(databaseUrl)}`);
  console.log(`  mode:     ${apply ? 'APPLY' : 'dry run (pass --apply to change the database)'}`);
  console.log('');

  const expected = parseExpectedDefaults();
  console.log(`Schema defaults declared for ${expected.length} TEXT columns.`);

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const columns = await readColumns(prisma);
    console.log(`Live database exposes ${columns.size} columns.`);

    const missing = [];
    const absent = [];
    const notText = [];
    let alreadyOk = 0;

    for (const expectation of expected) {
      const live = columns.get(`${expectation.table}.${expectation.column}`);
      if (!live) {
        absent.push(expectation);
        continue;
      }
      if (!TEXT_TYPES.has(live.dataType)) {
        notText.push({ ...expectation, dataType: live.dataType });
        continue;
      }
      if (live.isNullable) {
        // Nullable columns accept inserts without a value; nothing to repair.
        alreadyOk += 1;
        continue;
      }
      if (live.columnDefault !== null) {
        alreadyOk += 1;
        continue;
      }
      missing.push({ ...live, value: expectation.value });
    }

    console.log(`  already correct: ${alreadyOk}`);
    console.log(`  missing default: ${missing.length}`);
    if (absent.length) {
      console.log(`  column not in database: ${absent.length} (${absent.map((c) => `${c.table}.${c.column}`).join(', ')})`);
    }
    if (notText.length) {
      console.log(`  unexpected type (skipped): ${notText.map((c) => `${c.table}.${c.column} (${c.dataType})`).join(', ')}`);
    }
    console.log('');

    if (missing.length === 0) {
      console.log('Nothing to repair. Every declared TEXT default exists in the database.');
      return;
    }

    for (const column of missing) {
      console.log(`  ${column.table}.${column.column}  ${column.columnType.toUpperCase()} NOT NULL  -> DEFAULT (${sqlLiteral(column.value)})`);
    }
    console.log('');

    if (!apply) {
      console.log('Dry run only. Re-run with --apply to execute the statements below:');
      for (const column of missing) console.log(`  ${setDefaultStatement(column, column.value)};`);
      return;
    }

    let applied = 0;
    const failures = [];
    for (const column of missing) {
      const statement = setDefaultStatement(column, column.value);
      try {
        await prisma.$executeRawUnsafe(statement);
        applied += 1;
        console.log(`  ok      ${column.table}.${column.column}`);
        continue;
      } catch (error) {
        // Older MySQL builds reject expression defaults on TEXT via ALTER
        // COLUMN; retry with a full MODIFY before giving up.
        try {
          await prisma.$executeRawUnsafe(modifyStatement(column, column.value));
          applied += 1;
          console.log(`  ok      ${column.table}.${column.column} (via MODIFY)`);
        } catch (retryError) {
          const message = retryError instanceof Error ? retryError.message : String(retryError);
          failures.push({ column: `${column.table}.${column.column}`, message });
          console.error(`  FAILED  ${column.table}.${column.column}: ${message}`);
        }
      }
    }

    console.log('');
    console.log(`Applied ${applied}/${missing.length} defaults.`);
    if (failures.length) {
      console.error('Some columns still have no default. Inserts that omit them will keep failing:');
      for (const failure of failures) console.error(`  - ${failure.column}: ${failure.message}`);
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

export { parseExpectedDefaults };
