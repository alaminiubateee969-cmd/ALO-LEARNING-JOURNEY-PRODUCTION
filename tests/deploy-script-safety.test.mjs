import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const deployScript = await readFile(path.join(root, "scripts/deploy-production.sh"), "utf8");
const workflow = await readFile(path.join(root, ".github/workflows/deploy.yml"), "utf8");

test("production deploy requires an explicitly verified application path", () => {
  assert.match(deployScript, /APP_DIR is required/);
  assert.match(workflow, /VPS_APP_DIR is required/);
  assert.doesNotMatch(workflow, /APP_DIR:-\/home\/aloedu/);
});

test("both the workflow and direct script invocation require the exact deploy readiness switch", () => {
  assert.ok(deployScript.includes('if [[ "${VPS_DEPLOY_ENABLED:-}" != "true" ]]'));
  assert.match(deployScript, /VPS_DEPLOY_ENABLED must be exactly true/);
  assert.match(workflow, /vars\.VPS_DEPLOY_ENABLED == 'true'/);
  assert.match(workflow, /VPS_DEPLOY_ENABLED: \$\{\{ vars\.VPS_DEPLOY_ENABLED \}\}/);
  assert.ok(workflow.includes("VPS_DEPLOY_ENABLED='$VPS_DEPLOY_ENABLED' EXPECTED_SHA="));
});

test("production deploy requires an exact-SHA isolated restore rehearsal reference", () => {
  assert.match(deployScript, /RESTORE_TEST_SHA" = "\$EXPECTED_SHA/);
  assert.match(deployScript, /RESTORE_TEST_REFERENCE/);
  assert.match(workflow, /VPS_RESTORE_TEST_SHA/);
  assert.match(workflow, /VPS_RESTORE_TEST_REFERENCE/);
});

test("release build and database dump checks precede migrations and code switch", () => {
  const build = deployScript.indexOf("npm run build");
  const dump = deployScript.indexOf("if ! mysqldump ");
  const status = deployScript.indexOf("npx prisma migrate status");
  const migrate = deployScript.indexOf("npx prisma migrate deploy");
  const switchCode = deployScript.indexOf('ln -sfn "$RELEASE_DIR" "$CURRENT_LINK.tmp"', migrate);
  assert.ok(build >= 0 && dump > build);
  assert.ok(status > dump && migrate > status && switchCode > migrate);
});

test("tracked release storage is no-clobber copied before its directory is replaced", () => {
  const copy = deployScript.indexOf('cp -an "$RELEASE_DIR/storage/." "$SHARED_DIR/storage/"');
  const remove = deployScript.indexOf('rm -rf "$RELEASE_DIR/storage"');
  const link = deployScript.indexOf('ln -sfn "$SHARED_DIR/storage" "$RELEASE_DIR/storage"');
  assert.ok(copy >= 0 && remove > copy && link > remove);
});

test("deployment rejects existing release directories before materializing a new release", () => {
  const guard = deployScript.indexOf('if [ -e "$RELEASE_DIR" ] || [ -L "$RELEASE_DIR" ]; then');
  const materialize = deployScript.indexOf('mkdir -p "$RELEASE_DIR"', guard);
  const install = deployScript.indexOf("npm ci", materialize);
  assert.ok(guard >= 0 && materialize > guard && install > materialize);
  assert.match(deployScript.slice(guard, materialize), /refusing to delete or rebuild it in place/);
});

test("pending migrations require the exact release SHA approval", () => {
  assert.match(deployScript, /MIGRATION_PLAN_APPROVED_SHA" = "\$EXPECTED_SHA/);
  assert.match(deployScript, /P3009\|P3018\|P3006\|failed migration\|drift\|diverged\|P3005/);
  assert.match(deployScript, /not yet \(been \)\?applied\|pending migrations\?/);
  assert.match(deployScript, /pending migration suffix approved/);
});

test("public HTTPS health verification is strict and has no fallback URL", () => {
  assert.match(workflow, /VPS_DOMAIN must be a verified public HTTPS URL/);
  assert.match(workflow, /Public health check failed/);
  assert.doesNotMatch(workflow, /strict=\"\"|SITE_URL:-learn\.aloeducation\.com/);
});

test("production deployment fails closed if human-review protection cannot be verified", () => {
  assert.match(workflow, /Cannot verify production environment protection rules/);
  assert.match(workflow, /refusing to deploy/);
});
