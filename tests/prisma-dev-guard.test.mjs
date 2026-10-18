import test from "node:test";
import assert from "node:assert/strict";
import {
  validateDevDatabase,
  validateMigrationTestDatabase,
} from "../scripts/prisma-dev-guard.mjs";

const common = {
  command: "reset",
  nodeEnv: "development",
  databaseUrl: "mysql://user:password@127.0.0.1:3306/alo_test",
  confirmations: {
    ALO_DEV_DB_CONFIRM: "alo_test",
    ALO_CONFIRM_DB_RESET: "alo_test",
  },
};

test("allows an explicitly confirmed local disposable database operation", () => {
  const result = validateDevDatabase(common);
  assert.equal(result.ok, true);
  assert.deepEqual(result.args, ["migrate", "reset"]);
});

test("blocks all schema commands in production regardless of confirmation", () => {
  const result = validateDevDatabase({ ...common, nodeEnv: "production" });
  assert.equal(result.ok, false);
  assert.match(result.reason, /NODE_ENV=production/);
});

test("blocks databases whose names are not clearly development/test-only", () => {
  const result = validateDevDatabase({
    ...common,
    databaseUrl: "mysql://user:password@127.0.0.1:3306/aloeducation",
    confirmations: {
      ALO_DEV_DB_CONFIRM: "aloeducation",
      ALO_CONFIRM_DB_RESET: "aloeducation",
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /clearly marked/);
});

test("blocks an unapproved remote dev database", () => {
  const result = validateDevDatabase({
    ...common,
    databaseUrl: "mysql://user:password@db.internal:3306/alo_test",
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /remote development databases/);
});

test("requires a separate exact database-name confirmation for reset", () => {
  const result = validateDevDatabase({
    ...common,
    confirmations: { ALO_DEV_DB_CONFIRM: "alo_test" },
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /ALO_CONFIRM_DB_RESET/);
});

test("requires an exact remote allow-list and command confirmation", () => {
  const result = validateDevDatabase({
    ...common,
    databaseUrl: "mysql://user:password@db.internal:3306/alo_test",
    confirmations: {
      ALO_DEV_DB_CONFIRM: "alo_test",
      ALO_CONFIRM_DB_PUSH: "alo_test",
      ALO_REMOTE_DEV_DB_NAME: "alo_test",
    },
    command: "push",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.args, ["db", "push"]);
});

const migrationTestTarget = {
  nodeEnv: "test",
  databaseUrl: "mysql://user:password@127.0.0.1:3306/alo_test",
  confirmations: { ALO_MIGRATION_TEST_DB_CONFIRM: "alo_test" },
};

test("allows a specifically confirmed local test database for read-only migration verification", () => {
  const result = validateMigrationTestDatabase(migrationTestTarget);
  assert.equal(result.ok, true);
  assert.equal(result.databaseName, "alo_test");
});

test("blocks migration integration checks in production regardless of database name", () => {
  const result = validateMigrationTestDatabase({
    ...migrationTestTarget,
    nodeEnv: "production",
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /NODE_ENV=production/);
});

test("blocks migration integration checks against remote hosts even when named test", () => {
  const result = validateMigrationTestDatabase({
    ...migrationTestTarget,
    databaseUrl: "mysql://user:password@db.internal:3306/alo_test",
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /only connect to a local database/);
});

test("requires exact confirmation before local migration integration checks", () => {
  const result = validateMigrationTestDatabase({
    ...migrationTestTarget,
    confirmations: {},
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /ALO_MIGRATION_TEST_DB_CONFIRM/);
});

test("permits the local ci database only inside a CI environment", () => {
  const result = validateMigrationTestDatabase({
    nodeEnv: "test",
    databaseUrl: "mysql://ci:ci@127.0.0.1:3306/ci",
    ci: true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.databaseName, "ci");

  const localResult = validateMigrationTestDatabase({
    nodeEnv: "test",
    databaseUrl: "mysql://ci:ci@127.0.0.1:3306/ci",
  });
  assert.equal(localResult.ok, false);
});
