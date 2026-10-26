import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const COMMANDS = Object.freeze({
  push: ["db", "push"],
  migrate: ["migrate", "dev"],
  reset: ["migrate", "reset"],
});

const CONFIRMATION_KEYS = Object.freeze({
  push: "ALO_CONFIRM_DB_PUSH",
  migrate: "ALO_CONFIRM_MIGRATE_DEV",
  reset: "ALO_CONFIRM_DB_RESET",
});

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const DEV_DATABASE_NAME = /(?:^|[_-])(dev|development|test|testing|scratch|disposable)(?:$|[_-])/i;
const TEST_DATABASE_NAME = /(?:^|[_-])(test|testing|scratch|disposable)(?:$|[_-])/i;

export function validateMigrationTestDatabase({
  nodeEnv,
  databaseUrl,
  ci = false,
  confirmations = {},
}) {
  if (nodeEnv === "production") {
    return { ok: false, reason: "migration integration checks are blocked when NODE_ENV=production" };
  }
  if (typeof databaseUrl !== "string" || !databaseUrl.startsWith("mysql://")) {
    return { ok: false, reason: "DATABASE_URL must point to a disposable MySQL test database" };
  }

  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    return { ok: false, reason: "DATABASE_URL is invalid" };
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, "").split("/")[0] ?? "");
  if (!databaseName) return { ok: false, reason: "DATABASE_URL has no database name" };
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!LOCAL_HOSTS.has(host)) {
    return { ok: false, reason: "migration integration checks may only connect to a local database" };
  }

  // GitHub Actions creates this disposable database as a local MySQL service.
  if (ci === true && databaseName === "ci") {
    return { ok: true, databaseName };
  }
  if (!TEST_DATABASE_NAME.test(databaseName)) {
    return { ok: false, reason: "database name must be clearly marked test, scratch, or disposable" };
  }
  if (confirmations.ALO_MIGRATION_TEST_DB_CONFIRM !== databaseName) {
    return {
      ok: false,
      reason: "set ALO_MIGRATION_TEST_DB_CONFIRM to exactly the local test database name",
    };
  }
  return { ok: true, databaseName };
}

export function validateDevDatabase({ command, nodeEnv, databaseUrl, confirmations = {} }) {
  if (!Object.hasOwn(COMMANDS, command)) {
    return { ok: false, reason: "unknown Prisma development command" };
  }
  if (nodeEnv === "production") {
    return { ok: false, reason: "development schema commands are blocked when NODE_ENV=production" };
  }
  if (typeof databaseUrl !== "string" || !databaseUrl.startsWith("mysql://")) {
    return { ok: false, reason: "DATABASE_URL must point to a MySQL development database" };
  }

  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    return { ok: false, reason: "DATABASE_URL is invalid" };
  }
  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, "").split("/")[0] ?? "");
  if (!databaseName) return { ok: false, reason: "DATABASE_URL has no database name" };
  if (!DEV_DATABASE_NAME.test(databaseName)) {
    return { ok: false, reason: "database name must be clearly marked dev, test, scratch, or disposable" };
  }

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!LOCAL_HOSTS.has(host) && confirmations.ALO_REMOTE_DEV_DB_NAME !== databaseName) {
    return {
      ok: false,
      reason: "remote development databases require ALO_REMOTE_DEV_DB_NAME to exactly match the database name",
    };
  }
  if (confirmations.ALO_DEV_DB_CONFIRM !== databaseName) {
    return {
      ok: false,
      reason: "set ALO_DEV_DB_CONFIRM to exactly the development database name",
    };
  }
  const confirmationKey = CONFIRMATION_KEYS[command];
  if (confirmations[confirmationKey] !== databaseName) {
    return {
      ok: false,
      reason: `set ${confirmationKey} to exactly the development database name`,
    };
  }

  return { ok: true, databaseName, args: COMMANDS[command] };
}

function main() {
  const command = process.argv[2];
  const result = validateDevDatabase({
    command,
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    confirmations: process.env,
  });
  if (!result.ok) {
    console.error(`[prisma-dev] BLOCKED: ${result.reason}`);
    process.exitCode = 2;
    return;
  }

  console.error(`[prisma-dev] confirmed non-production database name: ${result.databaseName}`);
  const execution = spawnSync("prisma", result.args, { stdio: "inherit" });
  if (execution.error) {
    console.error(`[prisma-dev] could not start Prisma: ${execution.error.message}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = execution.status ?? 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
