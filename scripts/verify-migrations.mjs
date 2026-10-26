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

function sorted(values) {
  return [...values].sort();
}

function normalizeType(value) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function parseColumns(value) {
  return value.split(",").map((column) => column.trim().replace(/`/g, "").split(/\s+/)[0]);
}

function readMigration(directory) {
  const sql = readFileSync(path.join(migrationsRoot, directory, "migration.sql"), "utf8");
  const executableSql = sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*--.*$/gm, " ");
  const tableDefinitions = [...executableSql.matchAll(
    /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?`([^`]+)`\s*\(([\s\S]*?)\)\s+DEFAULT\s+CHARACTER/gi,
  )].map((match) => ({
    ifNotExists: Boolean(match[1]),
    name: match[2],
    body: match[3],
  }));
  return { sql, executableSql, tableDefinitions };
}

function parsePrismaModels(schema) {
  const blocks = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
  const modelNames = new Set(blocks.map((match) => match[1]));
  const scalarTypes = new Set(["String", "Int", "BigInt", "Float", "Decimal", "Boolean", "DateTime", "Json", "Bytes"]);
  const defaultSqlTypes = new Map([
    ["String", "VARCHAR(191)"],
    ["Int", "INTEGER"],
    ["BigInt", "BIGINT"],
    ["Float", "DOUBLE"],
    ["Decimal", "DECIMAL(65,30)"],
    ["Boolean", "BOOLEAN"],
    ["DateTime", "DATETIME(3)"],
    ["Json", "JSON"],
    ["Bytes", "LONGBLOB"],
  ]);
  const models = new Map();
  const modelToTable = new Map();

  for (const match of blocks) {
    const name = match[1];
    const body = match[2];
    const table = body.match(/^\s{2}@@map\("([^"]+)"\)/m)?.[1] ?? name;
    const model = { name, table, columns: new Map(), indexes: new Set(), relations: [] };
    modelToTable.set(name, table);

    for (const line of body.split(/\r?\n/)) {
      const relation = line.match(/^\s{2}\w+\s+(\w+)\??\s+@relation\(([^)]*)\)/);
      if (relation) {
        const fields = relation[2].match(/\bfields:\s*\[([^\]]+)\]/)?.[1];
        const references = relation[2].match(/\breferences:\s*\[([^\]]+)\]/)?.[1];
        if (fields && references) {
          model.relations.push({
            fields: parseColumns(fields),
            targetModel: relation[1],
            references: parseColumns(references),
            onDelete: relation[2].match(/\bonDelete:\s*(\w+)/)?.[1]?.toUpperCase() ?? "RESTRICT",
          });
        }
      }

      const field = line.match(/^\s{2}(\w+)\s+(\w+)(\[\])?(\?)?(.*)$/);
      if (field && !field[3] && scalarTypes.has(field[2])) {
        const [, fieldName, type, , , rawAttributes] = field;
        const attributes = rawAttributes.split("//", 1)[0];
        const native = attributes.match(/@db\.(\w+)(?:\(([^)]*)\))?/);
        const sqlType = native
          ? `${native[1].toUpperCase()}${native[2] ? `(${native[2].replace(/\s+/g, "")})` : ""}`
          : defaultSqlTypes.get(type);
        assert(sqlType, `No static MySQL type mapping for ${name}.${fieldName} (${type}).`);
        model.columns.set(fieldName, normalizeType(sqlType));
        if (/@id\b/.test(attributes)) model.indexes.add(`PRIMARY:${fieldName}`);
        if (/@unique\b/.test(attributes)) model.indexes.add(`UNIQUE:${fieldName}`);
      }

      const modelIndex = line.match(/^\s{2}@@(index|unique)\s*\(\s*\[([^\]]+)\]/);
      if (modelIndex) {
        const kind = modelIndex[1] === "unique" ? "UNIQUE" : "INDEX";
        model.indexes.add(`${kind}:${parseColumns(modelIndex[2]).join(",")}`);
      }
    }
    models.set(name, model);
  }

  return { models, modelToTable };
}

function parseSqlTable(tableDefinition) {
  const columns = new Map();
  const indexes = new Set();
  const relations = [];

  for (const line of tableDefinition.body.split(/\r?\n/)) {
    const column = line.match(/^\s*`([^`]+)`\s+([A-Z]+(?:\s*\([^)]*\))?)(?=\s|$)/i);
    if (column) columns.set(column[1], normalizeType(column[2]));

    const primary = line.match(/^\s*PRIMARY\s+KEY\s*\(([^)]+)\)/i);
    if (primary) indexes.add(`PRIMARY:${parseColumns(primary[1]).join(",")}`);

    const secondary = line.match(/^\s*(UNIQUE\s+)?INDEX\s+`[^`]+`\s*\(([^)]+)\)/i);
    if (secondary) indexes.add(`${secondary[1] ? "UNIQUE" : "INDEX"}:${parseColumns(secondary[2]).join(",")}`);

  }

  for (const foreignKey of tableDefinition.body.matchAll(
    /FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+`([^`]+)`\s*\(([^)]+)\)\s+ON\s+DELETE\s+(\w+)/gi,
  )) {
    relations.push({
      fields: parseColumns(foreignKey[1]),
      targetTable: foreignKey[2],
      references: parseColumns(foreignKey[3]),
      onDelete: foreignKey[4].toUpperCase(),
    });
  }

  return { columns, indexes, relations };
}

const schema = readFileSync(schemaPath, "utf8");
assert(/datasource\s+db\s*\{[\s\S]*?provider\s*=\s*"mysql"/m.test(schema), "Prisma datasource must remain MySQL.");
const { models: modelSpecs, modelToTable } = parsePrismaModels(schema);
const models = [...modelSpecs.keys()];
assert(models.length === 42, `Expected 42 Prisma models; found ${models.length}.`);
assert(new Set(models).size === models.length, "Duplicate Prisma model names found.");
assert(models.includes("Lead") && models.includes("MarketingLead"), "Admissions Lead and MarketingLead must remain separate models.");

const admissionsLead = schema.match(/^model\s+Lead\s*\{([\s\S]*?)^\}/m)?.[1] ?? "";
const marketingLead = schema.match(/^model\s+MarketingLead\s*\{([\s\S]*?)^\}/m)?.[1] ?? "";
assert(/companyId\s+String/.test(admissionsLead) && /company\s+Company\s+@relation/.test(admissionsLead), "Admissions Lead must retain its company relation.");
assert(/name\s+String/.test(marketingLead) && !/companyId\s+String/.test(marketingLead), "MarketingLead must not reuse the admissions tenant relation.");
const otpRequest = schema.match(/^model\s+OtpRequest\s*\{([\s\S]*?)^\}/m)?.[1] ?? "";
assert(/recipientHash\s+String/.test(otpRequest) && /recipientLabel\s+String/.test(otpRequest) && /codeHash\s+String/.test(otpRequest), "OtpRequest must store only keyed hashes and masked recipient labels.");
assert(!/^\s*(?:recipient|code)\s+String\b/m.test(otpRequest), "OtpRequest must not persist raw recipients or OTP codes.");
const avatarVideo = schema.match(/^model\s+AvatarVideo\s*\{([\s\S]*?)^\}/m)?.[1] ?? "";
assert(/onDelete:\s*Restrict/.test(avatarVideo), "Deleting an avatar must not cascade-delete its videos.");

const directories = readdirSync(migrationsRoot).filter((name) => /^\d{14}_/.test(name)).sort();
const expectedDirectories = [
  "20261001000000_initial_baseline",
  "20261007000000_human_avatar_ownership",
  "20261010000000_admissions_crm_quotes",
  "20261010000001_admin_otp_challenges",
  "20261018000000_v2_additive_mysql_tables",
];
assert(JSON.stringify(directories) === JSON.stringify(expectedDirectories), "Migration directories differ from the reviewed five-migration MySQL chain.");
assert(readFileSync(lockPath, "utf8").trim() === 'provider = "mysql"', "Migration lock provider is not exactly MySQL.");

const addedModels = new Set([
  "Client", "Project", "Invoice", "MarketingCampaign", "MarketingLead",
  "OtpRequest", "VoiceGeneration", "AudioTranscription", "HumanAvatar", "AvatarVideo",
]);
const admissionsModels = new Set(["Lead", "LeadActivity", "Quotation", "QuotationItem"]);
const otpModels = new Set(["AdminOtpChallenge"]);
const expectedByMigration = new Map([
  ["20261001000000_initial_baseline", { expected: models.filter((name) => !addedModels.has(name) && !admissionsModels.has(name) && !otpModels.has(name)), extra: ["_FamilyProfileToFamilyProject"], baseline: true }],
  ["20261007000000_human_avatar_ownership", { models: ["HumanAvatar", "AvatarVideo"] }],
  ["20261010000000_admissions_crm_quotes", { models: [...admissionsModels] }],
  ["20261010000001_admin_otp_challenges", { models: [...otpModels] }],
  ["20261018000000_v2_additive_mysql_tables", { models: ["Client", "Project", "Invoice", "MarketingCampaign", "MarketingLead", "OtpRequest", "VoiceGeneration", "AudioTranscription"] }],
]);

const createdTables = new Set();
const sqlSchemas = new Map();
for (const directory of directories) {
  const parsed = readMigration(directory);
  const contract = expectedByMigration.get(directory);
  const expectedModels = contract.models ?? contract.expected;
  assert(parsed.tableDefinitions.length > 0, `${directory} contains no CREATE TABLE statements.`);
  const actualTables = parsed.tableDefinitions.map((table) => table.name);
  assert(new Set(actualTables).size === actualTables.length, `${directory} creates a table more than once.`);
  assert(JSON.stringify(sorted(actualTables.filter((table) => table !== "_FamilyProfileToFamilyProject"))) === JSON.stringify(sorted(expectedModels.map((name) => modelToTable.get(name)))), `${directory} model table set differs from its reviewed contract.`);

  for (const tableDefinition of parsed.tableDefinitions) {
    const { name, ifNotExists } = tableDefinition;
    assert(!createdTables.has(name), `Table ${name} is created more than once in the migration chain.`);
    createdTables.add(name);
    if (contract.baseline) assert(ifNotExists, `Baseline table ${name} is not guarded by CREATE TABLE IF NOT EXISTS.`);
    else assert(!ifNotExists, `${directory} must fail closed if a purportedly new table already exists.`);
    sqlSchemas.set(name, parseSqlTable(tableDefinition));
  }

  assert(
    !/\b(?:DROP\s+\w+|TRUNCATE(?:\s+TABLE)?|DELETE\s+FROM|RENAME\s+TABLE)\b|\bALTER\s+TABLE\b[\s\S]*?\bDROP\b/i.test(parsed.executableSql),
    `${directory} contains a destructive SQL operation.`,
  );
  assert(!/\bPRAGMA\b|\bAUTOINCREMENT\b|"(?:HumanAvatar|AvatarVideo|\w+)"/i.test(parsed.executableSql), `${directory} contains SQLite-specific syntax or double-quoted identifiers.`);
  if (contract.extra) {
    assert(contract.extra.every((table) => actualTables.includes(table)), `${directory} is missing the implicit family-project relation table.`);
  }
}

const expectedTables = [...modelSpecs.values()].map((model) => model.table).concat("_FamilyProfileToFamilyProject");
assert(JSON.stringify(sorted([...createdTables])) === JSON.stringify(sorted(expectedTables)), "Migration chain does not create exactly all model tables plus the implicit relation table.");

let checkedColumns = 0;
for (const model of modelSpecs.values()) {
  const actual = sqlSchemas.get(model.table);
  assert(actual, `Missing migration table for Prisma model ${model.name}.`);
  const expectedColumnNames = sorted([...model.columns.keys()]);
  const actualColumnNames = sorted([...actual.columns.keys()]);
  assert(JSON.stringify(actualColumnNames) === JSON.stringify(expectedColumnNames), `${model.name} column names differ between Prisma schema and MySQL migrations.`);
  for (const [column, expectedType] of model.columns) {
    const actualType = actual.columns.get(column);
    assert(actualType === expectedType, `${model.name}.${column} has SQL type ${actualType}; schema expects ${expectedType}.`);
    checkedColumns++;
  }
  assert(JSON.stringify(sorted([...actual.indexes])) === JSON.stringify(sorted([...model.indexes])), `${model.name} indexes/uniques/primary key differ between schema and migrations.`);
  const expectedRelations = model.relations.map((relation) => ({
    fields: relation.fields.join(","),
    targetTable: modelToTable.get(relation.targetModel),
    references: relation.references.join(","),
    onDelete: relation.onDelete,
  })).map((relation) => JSON.stringify(relation)).sort();
  const actualRelations = actual.relations.map((relation) => ({ ...relation, fields: relation.fields.join(","), references: relation.references.join(",") }))
    .map((relation) => JSON.stringify(relation)).sort();
  assert(JSON.stringify(actualRelations) === JSON.stringify(expectedRelations), `${model.name} foreign keys differ between Prisma schema and MySQL migrations.`);
}

const familyJoin = sqlSchemas.get("_FamilyProfileToFamilyProject");
assert(familyJoin, "Implicit FamilyProfile/FamilyProject relation table is missing.");
assert(JSON.stringify(sorted([...familyJoin.columns.keys()])) === JSON.stringify(["A", "B"]), "Implicit family relation table columns must be exactly A and B.");
assert(familyJoin.columns.get("A") === "VARCHAR(191)" && familyJoin.columns.get("B") === "VARCHAR(191)", "Implicit family relation columns must use VARCHAR(191).");
assert(JSON.stringify(sorted([...familyJoin.indexes])) === JSON.stringify(sorted(["UNIQUE:A,B", "INDEX:B"])), "Implicit family relation indexes do not match Prisma's implicit many-to-many contract.");
assert(familyJoin.relations.length === 2 && familyJoin.relations.every((relation) => relation.onDelete === "CASCADE"), "Implicit family relation foreign keys must preserve Prisma's cascade semantics.");

const avatarMigration = readMigration("20261007000000_human_avatar_ownership").executableSql;
assert(/REFERENCES\s+`HumanAvatar`\s*\(`id`\)\s+ON\s+DELETE\s+RESTRICT/i.test(avatarMigration), "AvatarVideo FK must restrict deletion to preserve associated video records.");

console.log(`PASS: ${models.length} Prisma models, ${checkedColumns} scalar column types, indexes, unique constraints, primary keys, foreign keys, and one implicit relation table match five additive MySQL migrations; no destructive SQL found.`);
