import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { validateMigrationTestDatabase } from "./prisma-dev-guard.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schema = await readFile(path.join(root, "prisma", "schema.prisma"), "utf8");

function parseSchemaTables(schemaText) {
  const enumNames = new Set(
    [...schemaText.matchAll(/^enum\s+(\w+)\s*\{/gm)].map((match) => match[1]),
  );
  const modelBlocks = [...schemaText.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
  const modelNames = new Set(modelBlocks.map((match) => match[1]));

  return modelBlocks.map(([, modelName, body]) => {
    const mappedTable = body.match(/^\s*@@map\("([^"]+)"\)/m)?.[1] ?? modelName;
    const columns = [];

    for (const line of body.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("@@")) continue;
      const [fieldName, fieldType] = trimmed.split(/\s+/, 3);
      if (!fieldName || !fieldType || fieldName.startsWith("@")) continue;

      const baseType = fieldType.replace(/[?\[\]]/g, "");
      if (modelNames.has(baseType) || enumNames.has(baseType)) continue;
      const mappedColumn = trimmed.match(/@map\("([^"]+)"\)/)?.[1] ?? fieldName;
      columns.push(mappedColumn);
    }

    return { modelName, tableName: mappedTable, columns };
  });
}

async function main() {
  const target = validateMigrationTestDatabase({
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    ci: process.env.CI === "true",
    confirmations: process.env,
  });
  if (!target.ok) throw new Error(`Blocked: ${target.reason}`);

  const modelTables = parseSchemaTables(schema);
  const prisma = new PrismaClient();
  try {
    if (modelTables.length !== 42) {
      throw new Error(`Expected 42 Prisma models; found ${modelTables.length}.`);
    }

    await prisma.$connect();
    const rows = await prisma.$queryRawUnsafe(
      "SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE()",
    );
    const columnsByTable = new Map();
    for (const row of rows) {
      const current = columnsByTable.get(row.tableName) ?? new Set();
      current.add(row.columnName);
      columnsByTable.set(row.tableName, current);
    }

    const expectedTables = new Set([
      ...modelTables.map((model) => model.tableName),
      "_FamilyProfileToFamilyProject",
      "_prisma_migrations",
    ]);
    const actualTables = new Set(columnsByTable.keys());
    const missingTables = [...expectedTables].filter((table) => !actualTables.has(table));
    const unexpectedTables = [...actualTables].filter((table) => !expectedTables.has(table));
    if (missingTables.length || unexpectedTables.length) {
      throw new Error(
        `Migration table parity failed. Missing: ${missingTables.join(", ") || "none"}; unexpected: ${unexpectedTables.join(", ") || "none"}.`,
      );
    }

    const missingColumns = [];
    for (const model of modelTables) {
      const actualColumns = columnsByTable.get(model.tableName);
      for (const column of model.columns) {
        if (!actualColumns.has(column)) missingColumns.push(`${model.tableName}.${column}`);
      }
    }
    for (const column of ["A", "B"]) {
      if (!columnsByTable.get("_FamilyProfileToFamilyProject")?.has(column)) {
        missingColumns.push(`_FamilyProfileToFamilyProject.${column}`);
      }
    }
    if (missingColumns.length) {
      throw new Error(`Migration column parity failed. Missing: ${missingColumns.join(", ")}.`);
    }

    const migrationRows = await prisma.$queryRawUnsafe(
      "SELECT migration_name AS migrationName, finished_at AS finishedAt, rolled_back_at AS rolledBackAt FROM _prisma_migrations ORDER BY migration_name",
    );
    const applied = migrationRows.filter((row) => row.finishedAt && !row.rolledBackAt);
    const failed = migrationRows.filter((row) => !row.finishedAt && !row.rolledBackAt);
    if (applied.length !== 5 || failed.length) {
      throw new Error(
        `Expected 5 successfully applied migrations and no failed rows; applied=${applied.length}, failed=${failed.length}.`,
      );
    }

    console.log(
      `PASS: isolated MySQL contains ${modelTables.length} model tables, one relation table, all schema columns, and ${applied.length} successful migration records.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

try {
  await main();
} catch (error) {
  console.error(`[migration-test] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
