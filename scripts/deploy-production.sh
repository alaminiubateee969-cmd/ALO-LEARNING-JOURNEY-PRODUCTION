#!/usr/bin/env bash
# learn-aloeducation — exact-commit production deploy (runs ON the VPS via SSH).
#
# APP_DIR is intentionally required. Confirm the existing production layout,
# proxy upstream, PM2 cwd, and shared storage path read-only before setting it.
# The requested path and historic documentation path conflict; this script
# must not choose either one implicitly.
#
# Layout beneath APP_DIR:
#   releases/<sha>/   isolated release, installed and built before DB changes
#   current -> releases/<sha>   atomically switched only after migrations
#   shared/.env, shared/storage/, shared/.backups/   preserved across releases
#   repo/             git mirror used only to fetch and materialise an exact SHA
#
# Migration safety: a verified gzip/content probe is not a restore test. Pending
# migrations are applied only when their exact reviewed SHA is supplied in
# MIGRATION_PLAN_APPROVED_SHA. This approval must be set only after a verified
# backup restore, schema/history inspection, and isolated migration rehearsal.
# This script never reverts the database automatically.
set -euo pipefail
if [[ "${VPS_DEPLOY_ENABLED:-}" != "true" ]]; then
  printf '[deploy] ERROR: VPS_DEPLOY_ENABLED must be exactly true; direct deployment is disabled.\n' >&2
  exit 1
fi
cd / # never inherit a deleted cwd (PM2 ENOENT: uv_cwd)

log()  { printf '[deploy] %s\n' "$*"; }
fail() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

APP_DIR="${APP_DIR:-}"
[ -n "$APP_DIR" ] || fail "APP_DIR is required; reconcile the actual VPS path before deploying"
case "$APP_DIR" in
  /*) ;;
  *) fail "APP_DIR must be an absolute path" ;;
esac
case "$APP_DIR" in
  *"/../"*|*"/.."|*"/./"*|*"/."|*"//"*) fail "APP_DIR must not contain traversal or repeated separators" ;;
esac
[ "$APP_DIR" != "/" ] && [ "$APP_DIR" != "/home" ] && [ "$APP_DIR" != "/home/aloedu" ] || fail "APP_DIR is too broad; use the confirmed application directory"
case "$APP_DIR" in
  *[!A-Za-z0-9_./-]*) fail "APP_DIR contains unsupported characters" ;;
esac

PM2_APP_NAME="${PM2_APP_NAME:-learn-aloeducation}"
APP_PORT="${APP_PORT:-3017}"
EXPECTED_SHA="${EXPECTED_SHA:-}"
RESTORE_TEST_SHA="${RESTORE_TEST_SHA:-}"
RESTORE_TEST_REFERENCE="${RESTORE_TEST_REFERENCE:-}"
MIGRATION_PLAN_APPROVED_SHA="${MIGRATION_PLAN_APPROVED_SHA:-}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
REPO_URL="${REPO_URL:-https://github.com/alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION.git}"
RELEASES_DIR="$APP_DIR/releases"; SHARED_DIR="$APP_DIR/shared"
CURRENT_LINK="$APP_DIR/current"; REPO_DIR="$APP_DIR/repo"
LOCK_FILE="/tmp/${PM2_APP_NAME}-deploy.lock"
[[ "$PM2_APP_NAME" =~ ^[A-Za-z0-9_.-]+$ ]] || fail "PM2_APP_NAME contains unsupported characters"
[[ "$APP_PORT" =~ ^[0-9]{1,5}$ ]] && [ "$APP_PORT" -ge 1 ] && [ "$APP_PORT" -le 65535 ] || fail "APP_PORT must be 1-65535"
[[ "$KEEP_RELEASES" =~ ^[1-9][0-9]*$ ]] || fail "KEEP_RELEASES must be a positive integer"

exec 9>"$LOCK_FILE"; flock -n 9 || fail "another deploy is running"
for c in git node npm pm2 mysqldump mysql curl flock tar gzip zcat head grep du ln mv readlink ls tail cat date rm chmod mktemp seq sleep cp; do
  command -v "$c" >/dev/null || fail "$c not installed"
done
[ "$(node -p 'process.versions.node.split(".")[0]')" = "22" ] || fail "expected Node 22, found $(node -v)"
[ -f "$SHARED_DIR/.env" ] || fail "shared .env missing at $SHARED_DIR/.env (chmod 600)"
mkdir -p "$RELEASES_DIR" "$SHARED_DIR/storage" "$SHARED_DIR/.backups"
chmod 700 "$SHARED_DIR/.backups" || fail "cannot secure backup directory"

# Fetch exact SHA into the mirror (the live directory is never modified).
if [ ! -d "$REPO_DIR/.git" ]; then
  git clone --quiet "$REPO_URL" "$REPO_DIR" || fail "clone failed"
fi
git -C "$REPO_DIR" fetch --prune --quiet origin main || fail "git fetch failed"
REMOTE_SHA="$(git -C "$REPO_DIR" rev-parse origin/main)"
[ -n "$EXPECTED_SHA" ] || { EXPECTED_SHA="$REMOTE_SHA"; log "manual run: deploying origin/main $EXPECTED_SHA"; }
[ "$EXPECTED_SHA" = "$REMOTE_SHA" ] || fail "EXPECTED_SHA != origin/main — only merged main commits deploy"
git -C "$REPO_DIR" cat-file -e "${EXPECTED_SHA}^{commit}" || fail "SHA not found after fetch"
[ "$RESTORE_TEST_SHA" = "$EXPECTED_SHA" ] || fail "RESTORE_TEST_SHA must equal this exact release SHA after an isolated backup restore rehearsal"
[[ "$RESTORE_TEST_REFERENCE" =~ ^[A-Za-z0-9._:-]{1,80}$ ]] || fail "RESTORE_TEST_REFERENCE must identify the reviewed restore test without spaces or secrets"
RELEASE_DIR="$RELEASES_DIR/$EXPECTED_SHA"
if [ -e "$CURRENT_LINK" ] && [ ! -L "$CURRENT_LINK" ]; then
  fail "current path exists but is not a release symlink; reconcile it manually before deploying"
fi
PREV_TARGET="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
if [ -L "$CURRENT_LINK" ] && { [ -z "$PREV_TARGET" ] || [ ! -d "$PREV_TARGET" ]; }; then
  fail "current release symlink is broken; reconcile it manually before deploying"
fi
if [ -e "$RELEASE_DIR" ] || [ -L "$RELEASE_DIR" ]; then
  fail "release directory already exists; refusing to delete or rebuild it in place"
fi
log "deploying $EXPECTED_SHA to the explicitly selected application directory (previous release: ${PREV_TARGET:-none})"

rollback() {
  [ -n "$PREV_TARGET" ] && [ -d "$PREV_TARGET" ] || fail "deploy failed and no previous release exists to roll back to"
  log "ROLLBACK: current -> previous release (database is NOT auto-reverted)"
  ln -sfn "$PREV_TARGET" "$CURRENT_LINK.tmp" && mv -T "$CURRENT_LINK.tmp" "$CURRENT_LINK"
  cd "$APP_DIR"
  if ! pm2 startOrReload "$CURRENT_LINK/ecosystem.config.js" --only "$PM2_APP_NAME" --update-env; then
    printf '[deploy] ERROR: could not restore previous PM2 release %s\n' "$PREV_TARGET" >&2
    return 1
  fi
  if ! pm2 save; then
    printf '[deploy] ERROR: could not persist restored PM2 release %s\n' "$PREV_TARGET" >&2
    return 1
  fi
}

# Materialise, install, generate, and finish the release build before DB changes.
# Existing releases are never rebuilt or removed in place. A failed new build
# leaves its incomplete directory for manual inspection and explicit cleanup.
mkdir -p "$RELEASE_DIR"
git -C "$REPO_DIR" archive "$EXPECTED_SHA" | tar -x -C "$RELEASE_DIR" || fail "git archive failed"
printf '%s\n' "$EXPECTED_SHA" > "$RELEASE_DIR/RELEASE_SHA"
ln -sfn "$SHARED_DIR/.env" "$RELEASE_DIR/.env"
# Preserve tracked seed/media files from the source release while keeping all
# writable/runtime storage persistent across releases. Never overwrite an
# existing shared file with a repository copy.
if [ -d "$RELEASE_DIR/storage" ] && [ ! -L "$RELEASE_DIR/storage" ]; then
  cp -an "$RELEASE_DIR/storage/." "$SHARED_DIR/storage/" || fail "could not preserve release storage in shared storage"
  rm -rf "$RELEASE_DIR/storage" || fail "could not prepare release storage link"
elif [ -L "$RELEASE_DIR/storage" ]; then
  rm -f "$RELEASE_DIR/storage"
elif [ -e "$RELEASE_DIR/storage" ]; then
  fail "unexpected non-directory storage path in release"
fi
ln -sfn "$SHARED_DIR/storage" "$RELEASE_DIR/storage"
cd "$RELEASE_DIR"
npm ci || { rm -rf "$RELEASE_DIR"; fail "npm ci failed (live release untouched)"; }
npx prisma generate || fail "prisma generate failed (live release untouched)"
npm run build || fail "build failed before database migration (live release untouched)"
[ -f .next/standalone/server.js ] || fail "no .next/standalone/server.js produced"

# ── Database connectivity + backup gate ─────────────────────────────────────
TS="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_FILE="$SHARED_DIR/.backups/db-${TS}-${EXPECTED_SHA:0:7}.sql.gz"
BACKUP_ENV="$(mktemp)"; chmod 600 "$BACKUP_ENV"
trap 'rm -f "$BACKUP_ENV"' EXIT
node - "$BACKUP_ENV" <<'NODE'
const fs = require("fs"); const out = process.argv[2]; let url = "";
for (const line of fs.readFileSync(process.env.ENV_FILE || ".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*DATABASE_URL\s*=\s*(.*)$/);
  if (m) { url = m[1].trim().replace(/^["']|["']$/g, ""); break; }
}
if (!url.startsWith("mysql://")) { console.error("[deploy] DATABASE_URL missing/not mysql://"); process.exit(1); }
const u = new URL(url); const q = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
fs.writeFileSync(out, [`MYSQL_HOST=${q(decodeURIComponent(u.hostname))}`, `MYSQL_PORT=${q(u.port || "3306")}`,
  `MYSQL_USER=${q(decodeURIComponent(u.username))}`, `MYSQL_PWD=${q(decodeURIComponent(u.password))}`,
  `MYSQL_DB=${q(decodeURIComponent(u.pathname.slice(1)))}`, ""].join("\n"));
NODE
# shellcheck disable=SC1090
set -a; . "$BACKUP_ENV"; set +a
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -N -e "SELECT 1" "$MYSQL_DB" >/dev/null \
  || { unset MYSQL_PWD; fail "MySQL SELECT 1 failed; no migration attempted"; }
if ! mysqldump -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" --single-transaction --no-tablespaces --routines --events --triggers --hex-blob "$MYSQL_DB" | gzip > "$BACKUP_FILE"; then
  unset MYSQL_PWD MYSQL_USER MYSQL_HOST MYSQL_PORT MYSQL_DB
  rm -f "$BACKUP_FILE"
  fail "mysqldump or gzip failed; no migration attempted"
fi
unset MYSQL_PWD MYSQL_USER MYSQL_HOST MYSQL_PORT MYSQL_DB
chmod 600 "$BACKUP_FILE"
gzip -t "$BACKUP_FILE" && [ -s "$BACKUP_FILE" ] || fail "database dump failed gzip integrity check"
if ! (set +o pipefail; zcat "$BACKUP_FILE" | head -c 1048576 | grep -qiE "CREATE TABLE"); then
  fail "database dump content probe failed"
fi
log "database dump passed gzip/content checks. Restore testing is NOT performed by this script: $BACKUP_FILE"
log "independent restore rehearsal reference $RESTORE_TEST_REFERENCE was supplied for release SHA $RESTORE_TEST_SHA"

# `migrate status` returns non-zero when migrations are pending as well as on
# other errors. Permit only the exact reviewed pending set and only when an
# operator has bound approval to this exact release SHA after the recovery
# checklist in MIGRATION-RECOVERY-PLAN.md has been completed.
STATUS_OUTPUT=""; STATUS_CODE=0
STATUS_OUTPUT="$(npx prisma migrate status 2>&1)" || STATUS_CODE=$?
if [ "$STATUS_CODE" -ne 0 ]; then
  if printf '%s' "$STATUS_OUTPUT" | grep -qiE 'P3009|P3018|P3006|failed migration|drift|diverged|P3005'; then
    fail "Prisma reports failed/diverged/unbaselined migration history; database is unchanged by this script"
  fi
  if ! printf '%s' "$STATUS_OUTPUT" | grep -qiE 'not yet (been )?applied|pending migrations?'; then
    fail "migrate status returned non-zero without an explicit pending-migration report; no migration attempted"
  fi
  PENDING_MIGRATIONS="$(printf '%s' "$STATUS_OUTPUT" | grep -oE '[0-9]{14}_[A-Za-z0-9_]+' | sort -u || true)"
  EXPECTED_ALL="$(printf '%s\n' 20261001000000_initial_baseline 20261010000000_admissions_crm_quotes 20261010000001_admin_otp_challenges)"
  EXPECTED_AFTER_BASELINE="$(printf '%s\n' 20261010000000_admissions_crm_quotes 20261010000001_admin_otp_challenges)"
  EXPECTED_OTP_ONLY="20261010000001_admin_otp_challenges"
  [ -n "$PENDING_MIGRATIONS" ] || fail "migrate status failed for an unrecognised reason; no migration attempted"
  if [ "$PENDING_MIGRATIONS" != "$EXPECTED_ALL" ] \
    && [ "$PENDING_MIGRATIONS" != "$EXPECTED_AFTER_BASELINE" ] \
    && [ "$PENDING_MIGRATIONS" != "$EXPECTED_OTP_ONLY" ]; then
    fail "pending migrations are not a known ordered suffix of the reviewed recovery plan; no migration attempted"
  fi
  [ "$MIGRATION_PLAN_APPROVED_SHA" = "$EXPECTED_SHA" ] || fail "pending migrations require MIGRATION_PLAN_APPROVED_SHA to equal this exact release SHA after independent review"
  log "known pending migration suffix approved for this SHA; applying reviewed additive migrations"
else
  log "Prisma migration history is up to date before this release"
fi

npx prisma migrate deploy || fail "migration failed; the database may be partially changed. Preserve the dump and stop for manual recovery: $BACKUP_FILE"
npx prisma migrate status || fail "migration status is not clean after deploy; preserve the dump and stop before code switch: $BACKUP_FILE"

# ── Atomic switch + health gate ─────────────────────────────────────────────
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK.tmp" && mv -T "$CURRENT_LINK.tmp" "$CURRENT_LINK"
cd "$APP_DIR"
pm2 startOrReload "$CURRENT_LINK/ecosystem.config.js" --only "$PM2_APP_NAME" --update-env || { rollback; fail "PM2 reload failed — previous code restored"; }
pm2 save || { rollback; fail "PM2 state could not be saved — previous code restored"; }
healthy=""
for _ in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${APP_PORT}/api/health" || true)"
  [ "$code" = "200" ] && { healthy=1; break; }
  sleep 2
done
[ -n "$healthy" ] || { pm2 logs "$PM2_APP_NAME" --lines 50 --nostream || true; rollback; fail "local health check failed — previous code restored; database was not auto-reverted"; }
[ "$(cat "$CURRENT_LINK/RELEASE_SHA")" = "$EXPECTED_SHA" ] || { rollback; fail "running release SHA mismatch"; }
log "local health OK :$APP_PORT /api/health -> 200 · release $EXPECTED_SHA"
mkdir -p "$APP_DIR/.releases"
printf 'sha=%s prev=%s at=%s backup=%s\n' "$EXPECTED_SHA" "${PREV_TARGET:-none}" "$(date -u +%FT%TZ)" "$BACKUP_FILE" >> "$APP_DIR/.releases/history.log"

# Retain newest releases; never remove the current or immediately previous one.
ls -1dt "$RELEASES_DIR"/*/ 2>/dev/null | tail -n "+$((KEEP_RELEASES + 1))" | while read -r old; do
  case "$(readlink -f "$old")" in "$RELEASE_DIR"|"$PREV_TARGET") : ;; *) rm -rf "$old" ;; esac
done
log "DEPLOY SUCCEEDED: $EXPECTED_SHA"
