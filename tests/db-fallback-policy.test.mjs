import test from "node:test";
import assert from "node:assert/strict";
import {
  mayFallbackAfterPrismaError,
  shouldStartInFallback,
} from "../src/lib/db-fallback-policy.mjs";

test("production never starts in local JSON fallback", () => {
  assert.equal(shouldStartInFallback({ nodeEnv: "production" }), false);
  assert.equal(
    shouldStartInFallback({
      nodeEnv: "production",
      databaseUrl: "mysql://user:pass@127.0.0.1:3306/db",
      configuredFallback: true,
    }),
    false,
  );
});

test("non-production defaults to local fallback only for missing or known placeholder URLs", () => {
  assert.equal(shouldStartInFallback({ nodeEnv: "development" }), true);
  assert.equal(
    shouldStartInFallback({ nodeEnv: "development", databaseUrl: "mysql://user:REPLACE_WITH_NEW@localhost/db" }),
    true,
  );
  assert.equal(
    shouldStartInFallback({ nodeEnv: "development", databaseUrl: "mysql://ci:ci@127.0.0.1:3306/ci" }),
    false,
  );
});

test("non-production honors an explicitly configured fallback state", () => {
  assert.equal(
    shouldStartInFallback({ nodeEnv: "test", databaseUrl: "mysql://ci:ci@localhost/ci", configuredFallback: true }),
    true,
  );
  assert.equal(
    shouldStartInFallback({ nodeEnv: "development", configuredFallback: false }),
    false,
  );
});

test("Prisma connection errors may enable fallback only outside production", () => {
  assert.equal(mayFallbackAfterPrismaError("development"), true);
  assert.equal(mayFallbackAfterPrismaError("test"), true);
  assert.equal(mayFallbackAfterPrismaError("production"), false);
  assert.equal(mayFallbackAfterPrismaError(undefined), true);
});
