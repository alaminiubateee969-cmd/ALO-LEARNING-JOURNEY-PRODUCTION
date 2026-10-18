#!/usr/bin/env bash
# One-time, guarded initialization of the atomic-release layout on a VPS.
# This script is intentionally NOT run by CI and is NOT safe to run until an
# operator has confirmed the live APP_DIR, PM2 cwd, proxy port, and storage.
# It never moves/replaces the existing application directory and runs no DB
# migrations. It does add releases/, repo/, shared/, and current under APP_DIR.
set -euo pipefail
cd /

log()  { printf '[bootstrap] %s\n' "$*"; }
fail() { printf '[bootstrap] ERROR: %s\n' "$*" >&2; exit 1; }

APP_DIR="${APP_DIR:-}"
APP_DIR_CONFIRM="${APP_DIR_CONFIRM:-}"
[ -n "$APP_DIR" ] || fail "APP_DIR is required; inspect the live PM2 cwd and confirm the application path first"
[ "$APP_DIR_CONFIRM" = "$APP_DIR" ] || fail "set APP_DIR_CONFIRM to exactly APP_DIR after independently verifying the live path"
case "$APP_DIR" in
  /home/aloedu/*) ;;
  *) fail "APP_DIR must be a specific absolute path beneath /home/aloedu" ;;
esac
case "$APP_DIR" in
  *"/../"*|*"/.."|*"/./"*|*"/."|*"//"*|*[!A-Za-z0-9_./-]*) fail "APP_DIR contains unsupported or traversal characters" ;;
esac
[ "$APP_DIR" != "/home/aloedu" ] || fail "APP_DIR must identify an application directory, not the user home"

PM2_APP_NAME="${PM2_APP_NAME:-learn-aloeducation}"
APP_PORT="${APP_PORT:-3017}"
REPO_URL="${REPO_URL:-https://github.com/alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION.git}"
EXPECTED_SHA="${EXPECTED_SHA:-}"
RESTORE_TEST_SHA="${RESTORE_TEST_SHA:-}"
RESTORE_TEST_REFERENCE="${RESTORE_TEST_REFERENCE:-}"
RELEASES_DIR="$APP_DIR/releases"
SHARED_DIR="$APP_DIR/shared"
CURRENT_LINK="$APP_DIR/current"
REPO_DIR="$APP_DIR/repo"

[[ "$PM2_APP_NAME" =~ ^[A-Za-z0-9_.-]+$ ]] || fail "PM2_APP_NAME contains unsupported characters"
[[ "$APP_PORT" =~ ^[0-9]{1,5}$ ]] && [ "$APP_PORT" -ge 1 ] && [ "$APP_PORT" -le 65535 ] || fail "APP_PORT must be 1-65535"
for c in git node npm pm2 curl tar cp install ln mv readlink chmod mkdir date seq sleep cat rm; do
  command -v "$c" >/dev/null || fail "$c not installed"
done
[ "$(node -p 'process.versions.node.split(".")[0]')" = "22" ] || fail "expected Node 22, found $(node -v)"
[ -d "$APP_DIR" ] || fail "$APP_DIR does not exist; no change made"
[ -f "$APP_DIR/.env" ] || fail "existing $APP_DIR/.env missing; no change made"
[ -f "$APP_DIR/ecosystem.config.js" ] || fail "existing PM2 config missing; no change made"
[ -f "$APP_DIR/.next/standalone/server.js" ] || fail "existing standalone server missing; no change made"
[ ! -e "$CURRENT_LINK" ] && [ ! -L "$CURRENT_LINK" ] || fail "$CURRENT_LINK already exists; use normal release deploy or inspect it manually"
[ ! -e "$CURRENT_LINK.tmp" ] && [ ! -L "$CURRENT_LINK.tmp" ] || fail "stale current.tmp path exists; inspect it manually"

# Read-only precondition: don't switch away from a legacy server that is already
# unhealthy. No file, proxy, process, or database is changed by this probe.
code="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${APP_PORT}/api/health" || true)"
[ "$code" = "200" ] || fail "existing local health check returned $code; no change made"

mkdir -p "$RELEASES_DIR" "$SHARED_DIR/storage"
if [ ! -f "$SHARED_DIR/.env" ]; then
  install -m 600 "$APP_DIR/.env" "$SHARED_DIR/.env"
else
  chmod 600 "$SHARED_DIR/.env"
  log "preserving existing shared/.env (not overwritten)"
fi
# No-clobber copy preserves production files if names already exist. The
# original storage directory is never removed or moved.
if [ -d "$APP_DIR/storage" ]; then
  cp -an "$APP_DIR/storage/." "$SHARED_DIR/storage/" || fail "could not copy legacy storage without overwriting"
fi

if [ ! -d "$REPO_DIR/.git" ]; then
  [ ! -e "$REPO_DIR" ] || fail "$REPO_DIR exists but is not a Git repository; inspect manually"
  git clone --quiet "$REPO_URL" "$REPO_DIR" || fail "clone failed; existing app remains untouched"
else
  ORIGIN_URL="$(git -C "$REPO_DIR" remote get-url origin)"
  [ "$ORIGIN_URL" = "$REPO_URL" ] || fail "repo origin differs from REPO_URL; inspect before changing it"
fi
git -C "$REPO_DIR" fetch --prune --quiet origin main || fail "git fetch failed; existing app remains untouched"
REMOTE_SHA="$(git -C "$REPO_DIR" rev-parse origin/main)"
[ -n "$EXPECTED_SHA" ] || EXPECTED_SHA="$REMOTE_SHA"
[[ "$EXPECTED_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "EXPECTED_SHA must be a full commit SHA"
[ "$EXPECTED_SHA" = "$REMOTE_SHA" ] || fail "EXPECTED_SHA must equal origin/main"
[ "$RESTORE_TEST_SHA" = "$EXPECTED_SHA" ] || fail "RESTORE_TEST_SHA must match the release SHA after isolated backup restoration testing"
[[ "$RESTORE_TEST_REFERENCE" =~ ^[A-Za-z0-9._:-]{1,80}$ ]] || fail "RESTORE_TEST_REFERENCE must identify the reviewed restore test without spaces or secrets"
git -C "$REPO_DIR" cat-file -e "${EXPECTED_SHA}^{commit}" || fail "SHA not found after fetch"
RELEASE_DIR="$RELEASES_DIR/$EXPECTED_SHA"
[ ! -e "$RELEASE_DIR" ] && [ ! -L "$RELEASE_DIR" ] || fail "$RELEASE_DIR already exists; refusing to overwrite a release"

mkdir -p "$RELEASE_DIR"
git -C "$REPO_DIR" archive "$EXPECTED_SHA" | tar -x -C "$RELEASE_DIR" || fail "could not materialize release"
[ -f "$RELEASE_DIR/package-lock.json" ] || fail "release has no npm lockfile"
printf '%s\n' "$EXPECTED_SHA" > "$RELEASE_DIR/RELEASE_SHA"

# Preserve the repository's tracked seed/media files before replacing the
# release-local directory with persistent shared storage.
if [ -d "$RELEASE_DIR/storage" ] && [ ! -L "$RELEASE_DIR/storage" ]; then
  cp -an "$RELEASE_DIR/storage/." "$SHARED_DIR/storage/" || fail "could not preserve tracked release storage"
  rm -rf "$RELEASE_DIR/storage" || fail "could not prepare storage link"
elif [ -e "$RELEASE_DIR/storage" ] && [ ! -L "$RELEASE_DIR/storage" ]; then
  fail "unexpected non-directory storage path in release"
fi
ln -s "$SHARED_DIR/.env" "$RELEASE_DIR/.env"
ln -s "$SHARED_DIR/storage" "$RELEASE_DIR/storage"

cd "$RELEASE_DIR"
npm ci || fail "npm ci failed; legacy app remains current"
npx prisma generate || fail "Prisma client generation failed; legacy app remains current"
npm run build || fail "release build failed; legacy app remains current"
[ -f .next/standalone/server.js ] || fail "standalone server output missing; legacy app remains current"

# This command is read-only. Bootstrap does not resolve or apply migrations.
# A pending/unbaselined database must follow MIGRATION-RECOVERY-PLAN.md first.
npx prisma migrate status || fail "database migration status is not clean; no code switch was made"

# Reconfirm the legacy server is healthy immediately before switching.
code="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${APP_PORT}/api/health" || true)"
[ "$code" = "200" ] || fail "legacy server health changed to $code; no code switch made"

switch_current() {
  local target="$1"
  ln -sfn "$target" "$CURRENT_LINK.tmp"
  mv -Tf "$CURRENT_LINK.tmp" "$CURRENT_LINK"
}
rollback() {
  log "restoring legacy release at $APP_DIR; database is not changed"
  switch_current "$APP_DIR"
  cd "$APP_DIR"
  pm2 startOrReload "$CURRENT_LINK/ecosystem.config.js" --only "$PM2_APP_NAME" --update-env || return 1
  pm2 save || return 1
}

# Point current at the existing app as a rollback target, then atomically switch
# to the built release. The original directory and its files remain in place.
switch_current "$APP_DIR"
switch_current "$RELEASE_DIR"
cd "$APP_DIR"
if ! pm2 startOrReload "$CURRENT_LINK/ecosystem.config.js" --only "$PM2_APP_NAME" --update-env; then
  rollback || fail "PM2 reload failed and automatic rollback also failed; stop for manual recovery"
  fail "PM2 reload failed; restored the legacy application"
fi
if ! pm2 save; then
  rollback || fail "PM2 state save failed and automatic rollback also failed; stop for manual recovery"
  fail "PM2 state save failed; restored the legacy application"
fi

healthy=""
for _ in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${APP_PORT}/api/health" || true)"
  [ "$code" = "200" ] && { healthy=1; break; }
  sleep 2
done
if [ -z "$healthy" ]; then
  rollback || fail "health failed and automatic rollback failed; stop for manual recovery"
  fail "new release health check failed; restored the legacy application"
fi
[ "$(cat "$CURRENT_LINK/RELEASE_SHA")" = "$EXPECTED_SHA" ] || {
  rollback || fail "release SHA mismatch and automatic rollback failed"
  fail "release SHA mismatch; restored the legacy application"
}

mkdir -p "$APP_DIR/.releases"
printf 'sha=%s prev=%s at=%s bootstrap=true\n' "$EXPECTED_SHA" "$APP_DIR" "$(date -u +%FT%TZ)" >> "$APP_DIR/.releases/history.log"
log "BOOTSTRAP SUCCEEDED: release $EXPECTED_SHA is current; previous app directory remains untouched at $APP_DIR"
log "restore rehearsal reference $RESTORE_TEST_REFERENCE was supplied for this exact release SHA"
log "No database migration, proxy/DNS change, directory move, or production-data deletion was performed."
