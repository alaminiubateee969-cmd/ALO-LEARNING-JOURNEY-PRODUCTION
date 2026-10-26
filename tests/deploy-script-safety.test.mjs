import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const deployScript = await readFile(path.join(root, "scripts/deploy-production.sh"), "utf8");
const workflow = await readFile(path.join(root, ".github/workflows/deploy.yml"), "utf8");
const datadogWorkflow = await readFile(path.join(root, ".github/workflows/datadog-synthetics.yml"), "utf8");

test("production deploy is pinned to the operator-provided path, PM2 name, and port", () => {
  assert.match(deployScript, /APP_DIR="\$\{APP_DIR:-\/home\/aloedu\/LEARNING-JOURNEY\}"/);
  assert.match(deployScript, /APP_DIR" = "\/home\/aloedu\/LEARNING-JOURNEY"/);
  assert.match(deployScript, /PM2_APP_NAME" == "learn-aloeducation"/);
  assert.match(deployScript, /APP_PORT" == "3017"/);
  assert.match(workflow, /VPS_APP_DIR must be \/home\/aloedu\/LEARNING-JOURNEY/);
  assert.match(workflow, /VPS_PM2_APP must be learn-aloeducation/);
  assert.match(workflow, /VPS_APP_PORT must be 3017/);
});

test("both the workflow and direct script require the exact readiness switch", () => {
  assert.match(deployScript, /\[\[ "\$\{VPS_DEPLOY_ENABLED:-\}" == "true" \]\] \|\| fail/);
  assert.match(deployScript, /VPS_DEPLOY_ENABLED must be exactly true/);
  assert.match(workflow, /vars\.VPS_DEPLOY_ENABLED == 'true'/);
  assert.match(workflow, /VPS_DEPLOY_ENABLED: \$\{\{ vars\.VPS_DEPLOY_ENABLED \}\}/);
  assert.ok(workflow.includes("VPS_DEPLOY_ENABLED='$VPS_DEPLOY_ENABLED' EXPECTED_SHA="));
});

test("deployment requires restore and schema evidence tied to the exact release", () => {
  assert.match(deployScript, /RESTORE_TEST_SHA" = "\$EXPECTED_SHA/);
  assert.match(deployScript, /SCHEMA_PREFLIGHT_SHA" = "\$EXPECTED_SHA/);
  assert.match(deployScript, /RESTORE_TEST_REFERENCE/);
  assert.match(deployScript, /SCHEMA_PREFLIGHT_REFERENCE/);
  assert.match(workflow, /VPS_RESTORE_TEST_SHA/);
  assert.match(workflow, /VPS_SCHEMA_PREFLIGHT_SHA/);
});

test("build, database/media backup, migration checks, and atomic switch are ordered", () => {
  const build = deployScript.indexOf("npm run build");
  const dump = deployScript.indexOf("if ! mysqldump ");
  const mediaBackup = deployScript.indexOf("MEDIA_PATHS=()");
  const status = deployScript.indexOf("npx prisma migrate status");
  const migrate = deployScript.indexOf("npx prisma migrate deploy");
  const pointerSwitch = deployScript.indexOf('ln -s "$RELEASE_DIR" "$CURRENT_TMP"');
  assert.ok(build >= 0 && dump > build && mediaBackup > dump);
  assert.ok(status > mediaBackup && migrate > status && pointerSwitch > migrate);
  assert.match(deployScript, /sha256sum "\$BACKUP_FILE"/);
  assert.match(deployScript, /sha256sum "\$MEDIA_BACKUP"/);
});

test("runtime-written public media is copied without overwriting and backed up before migration", () => {
  assert.match(deployScript, /preserve_public_media\(\)/);
  assert.match(deployScript, /different file already exists at destination/);
  assert.match(deployScript, /MEDIA_PATHS/);
  assert.match(deployScript, /media backup creation failed/);
  assert.match(deployScript, /preserve_tree_no_clobber "\$source" "\$target" "public media \$name"/);
  assert.match(deployScript, /\$purpose preservation failed/);
});

test("existing release directories are never overwritten or deleted", () => {
  const guard = deployScript.indexOf('[ ! -e "$RELEASE_DIR" ] && [ ! -L "$RELEASE_DIR" ]');
  const materialize = deployScript.indexOf('mkdir "$RELEASE_DIR"');
  assert.ok(guard >= 0 && materialize > guard);
  assert.match(deployScript.slice(guard, materialize), /refusing to overwrite or delete it/);
});

test("deployment never starts an absent PM2 process and retains a known-good rollback target", () => {
  assert.match(deployScript, /pm2_process_is_online \|\| fail "PM2 process .*will not assume it can be started"/);
  assert.doesNotMatch(deployScript, /pm2\s+(?:start|startOrReload)\b/);
  assert.match(deployScript, /PREV_TARGET/);
  assert.match(deployScript, /restoring current -> previously healthy release/);
  assert.match(deployScript, /database is not reverted/);
});

test("pending migration suffix is allowlisted and exact-SHA approved", () => {
  assert.match(deployScript, /MIGRATION_PLAN_APPROVED_SHA" = "\$EXPECTED_SHA/);
  assert.match(deployScript, /P3009\|P3018\|P3006\|P3005/);
  assert.match(deployScript, /pending migrations are not a known ordered suffix/);
  assert.match(deployScript, /migrate deploy is skipped/);
});

test("deployment verifies exact migration checksums and requires the baseline already reconciled", () => {
  const historyRead = deployScript.indexOf("SELECT migration_name, checksum");
  const historyVerify = deployScript.indexOf("verify-prisma-history.mjs", historyRead);
  const migrationStatus = deployScript.indexOf("npx prisma migrate status", historyVerify);
  assert.ok(historyRead >= 0 && historyVerify > historyRead && migrationStatus > historyVerify);
  assert.match(deployScript, /initial baseline must already be reconciled and recorded/);
  assert.match(deployScript, /after the reconciled baseline/);
  assert.doesNotMatch(deployScript, /EXPECTED_ALL=/);
});

test("public HTTPS health verification requires the exact released SHA", () => {
  assert.match(workflow, /VPS_DOMAIN must be a verified public HTTPS URL/);
  assert.match(workflow, /served_sha.*\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /Public health\/release verification failed/);
  assert.match(workflow, /LIVE VERIFIED: \$base reports release \$served_sha/);
  assert.doesNotMatch(workflow, /SITE_URL:-learn\.aloeducation\.com/);
});

test("production deployment fails closed if human-review protection cannot be verified", () => {
  assert.match(workflow, /Cannot verify production environment protection rules/);
  assert.match(workflow, /refusing to deploy/);
});

test("third-party Datadog tests are disabled by default and require an explicit opt-in", () => {
  assert.match(datadogWorkflow, /vars\.DATADOG_SYNTHETICS_ENABLED == 'true'/);
  assert.match(datadogWorkflow, /secrets\.DD_API_KEY/);
  assert.match(datadogWorkflow, /secrets\.DD_APP_KEY/);
  assert.match(datadogWorkflow, /required repository secrets are missing/);
});
