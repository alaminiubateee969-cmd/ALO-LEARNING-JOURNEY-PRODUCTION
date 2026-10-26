#!/usr/bin/env bash
# Exact-commit release deploy. Runs on the VPS over a reviewed SSH workflow.
# This script upgrades only an already healthy, known-good PM2 release. It does
# not bootstrap/restart an absent PM2 process and does not roll back database DDL.
set -Eeuo pipefail
cd /

log()  { printf '[deploy] %s\n' "$*"; }
fail() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

[[ "${VPS_DEPLOY_ENABLED:-}" == "true" ]] || fail "VPS_DEPLOY_ENABLED must be exactly true; production deployment is disabled"
APP_DIR="${APP_DIR:-/home/aloedu/LEARNING-JOURNEY}"
[ "$APP_DIR" = "/home/aloedu/LEARNING-JOURNEY" ] || fail "APP_DIR must equal the operator-verified /home/aloedu/LEARNING-JOURNEY path"
[ -d "$APP_DIR" ] || fail "verified APP_DIR does not exist; no deployment changes made"

PM2_APP_NAME="${PM2_APP_NAME:-learn-aloeducation}"
APP_PORT="${APP_PORT:-3017}"
EXPECTED_SHA="${EXPECTED_SHA:-}"
RESTORE_TEST_SHA="${RESTORE_TEST_SHA:-}"
RESTORE_TEST_REFERENCE="${RESTORE_TEST_REFERENCE:-}"
SCHEMA_PREFLIGHT_SHA="${SCHEMA_PREFLIGHT_SHA:-}"
SCHEMA_PREFLIGHT_REFERENCE="${SCHEMA_PREFLIGHT_REFERENCE:-}"
MIGRATION_PLAN_APPROVED_SHA="${MIGRATION_PLAN_APPROVED_SHA:-}"
REPO_URL="${REPO_URL:-https://github.com/alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION.git}"
RELEASES_DIR="$APP_DIR/releases"
SHARED_DIR="$APP_DIR/shared"
CURRENT_LINK="$APP_DIR/current"
REPO_DIR="$APP_DIR/repo"
BACKUP_DIR="$SHARED_DIR/.backups"

[[ "$PM2_APP_NAME" == "learn-aloeducation" ]] || fail "PM2_APP_NAME must equal the verified learn-aloeducation process name"
[[ "$APP_PORT" == "3017" ]] || fail "APP_PORT must equal the verified port 3017"
[[ "$EXPECTED_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "EXPECTED_SHA must be a full lowercase commit SHA"
[ "$RESTORE_TEST_SHA" = "$EXPECTED_SHA" ] || fail "RESTORE_TEST_SHA must match the exact release after an isolated production-backup restore rehearsal"
[[ "$RESTORE_TEST_REFERENCE" =~ ^[A-Za-z0-9._:-]{1,80}$ ]] || fail "RESTORE_TEST_REFERENCE must identify the reviewed restore evidence without spaces or secrets"
[ "$SCHEMA_PREFLIGHT_SHA" = "$EXPECTED_SHA" ] || fail "SCHEMA_PREFLIGHT_SHA must match the exact release after schema/history compatibility review"
[[ "$SCHEMA_PREFLIGHT_REFERENCE" =~ ^[A-Za-z0-9._:-]{1,80}$ ]] || fail "SCHEMA_PREFLIGHT_REFERENCE must identify the reviewed schema/history evidence without spaces or secrets"

for command_name in git node npm pm2 mysqldump mysql curl flock tar gzip zcat head grep ln mv readlink ls tail cat date chmod mktemp seq sleep cp cmp sha256sum find; do
  command -v "$command_name" >/dev/null || fail "$command_name is not installed"
done
[ "$(node -p 'process.versions.node.split(".")[0]')" = "22" ] || fail "expected Node.js 22; found $(node -v)"
[ -f "$SHARED_DIR/.env" ] || fail "shared environment file missing at $SHARED_DIR/.env; no change made"
[ -L "$CURRENT_LINK" ] || fail "current release symlink missing; this deploy path does not bootstrap or start a first PM2 process"
[ ! -e "$CURRENT_LINK.tmp" ] && [ ! -L "$CURRENT_LINK.tmp" ] || fail "stale current.tmp path exists; inspect manually before deployment"

exec 9>"/tmp/${PM2_APP_NAME}-deploy.lock"
flock -n 9 || fail "another deployment is running"

pm2_process_is_online() {
  pm2 jlist 2>/dev/null | node -e '
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  try {
    const list = JSON.parse(input);
    const matches = Array.isArray(list) ? list.filter((process) => process.name === process.argv[1]) : [];
    process.exit(matches.length === 1 && matches[0]?.pm2_env?.status === "online" ? 0 : 1);
  } catch { process.exit(1); }
});
' "$PM2_APP_NAME"
}
pm2_process_is_online || fail "PM2 process $PM2_APP_NAME is missing or not online; this script will not assume it can be started"

PREV_TARGET="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
[ -n "$PREV_TARGET" ] && [ -d "$PREV_TARGET" ] || fail "current release symlink is broken; no change made"
case "$PREV_TARGET" in
  "$RELEASES_DIR"/*) ;;
  *) fail "current release target is outside $RELEASES_DIR; inspect the live layout before deploying" ;;
esac
[ -f "$PREV_TARGET/RELEASE_SHA" ] || fail "current release has no RELEASE_SHA proof; no known-good rollback target"
PREV_SHA="$(cat "$PREV_TARGET/RELEASE_SHA")"
[[ "$PREV_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "current release SHA proof is malformed"
LOCAL_CODE="$(curl --connect-timeout 5 --max-time 10 -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${APP_PORT}/api/health" || true)"
[ "$LOCAL_CODE" = "200" ] || fail "known-good release health returned $LOCAL_CODE; no code or database change made"

LOCK_FILE="/tmp/${PM2_APP_NAME}-deploy.lock"
RELEASE_DIR="$RELEASES_DIR/$EXPECTED_SHA"
[ ! -e "$RELEASE_DIR" ] && [ ! -L "$RELEASE_DIR" ] || fail "release directory already exists; refusing to overwrite or delete it"
[ ! -L "$SHARED_DIR" ] || fail "shared directory is a symlink; inspect the storage boundary before deploying"
[ ! -L "$RELEASES_DIR" ] || fail "releases directory is a symlink; inspect the release boundary before deploying"
[ ! -L "$SHARED_DIR/storage" ] || fail "shared storage is a symlink; inspect the media boundary before deploying"
[ ! -L "$BACKUP_DIR" ] || fail "backup directory is a symlink; inspect its destination before deploying"
mkdir -p "$RELEASES_DIR" "$SHARED_DIR/storage" "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR" || fail "cannot set restrictive backup-directory permissions"

# Fetch/materialize the exact approved commit in an isolated mirror.
if [ ! -d "$REPO_DIR/.git" ]; then
  [ ! -e "$REPO_DIR" ] || fail "$REPO_DIR exists but is not a Git repository; inspect manually"
  git clone --quiet "$REPO_URL" "$REPO_DIR" || fail "repository clone failed"
fi
git -C "$REPO_DIR" fetch --quiet origin main || fail "git fetch failed"
REMOTE_SHA="$(git -C "$REPO_DIR" rev-parse origin/main)"
[ "$EXPECTED_SHA" = "$REMOTE_SHA" ] || fail "EXPECTED_SHA does not equal the currently fetched origin/main commit"
git -C "$REPO_DIR" cat-file -e "${EXPECTED_SHA}^{commit}" || fail "expected commit is unavailable in the mirror"

log "building exact SHA $EXPECTED_SHA; current known-good release is $PREV_SHA"
mkdir "$RELEASE_DIR"
git -C "$REPO_DIR" archive "$EXPECTED_SHA" | tar -x -C "$RELEASE_DIR" || fail "could not materialize the exact release"
printf '%s\n' "$EXPECTED_SHA" > "$RELEASE_DIR/RELEASE_SHA"
ln -s "$SHARED_DIR/.env" "$RELEASE_DIR/.env"

preserve_tree_no_clobber() {
  local source="$1" target="$2" purpose="$3"
  if ! node - "$source" "$target" "$purpose" <<'NODE'
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const [source, target, purpose] = process.argv.slice(2);
function preserve(src, dst) {
  const stat = fs.lstatSync(src);
  if (stat.isSymbolicLink()) throw new Error("symlink in source tree");
  if (stat.isDirectory()) {
    if (fs.existsSync(dst)) {
      if (!fs.lstatSync(dst).isDirectory()) throw new Error("directory/file collision");
    } else fs.mkdirSync(dst, { mode: stat.mode & 0o777 });
    for (const name of fs.readdirSync(src)) preserve(path.join(src, name), path.join(dst, name));
    fs.chmodSync(dst, stat.mode & 0o777);
    fs.utimesSync(dst, stat.atime, stat.mtime);
    return;
  }
  if (!stat.isFile()) throw new Error("unsupported file type");
  if (fs.existsSync(dst)) {
    const other = fs.lstatSync(dst);
    if (!other.isFile() || stat.size !== other.size || spawnSync("cmp", ["-s", src, dst]).status !== 0) {
      throw new Error("different file already exists at destination");
    }
    return;
  }
  fs.copyFileSync(src, dst, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(dst, stat.mode & 0o777);
  fs.utimesSync(dst, stat.atime, stat.mtime);
}
try { preserve(source, target); }
catch (error) { console.error(`[deploy] ${purpose} preservation failed: ${error.message}`); process.exit(1); }
NODE
  then
    fail "$purpose preservation failed; no migration or release switch attempted"
  fi
}

if [ -d "$RELEASE_DIR/storage" ] && [ ! -L "$RELEASE_DIR/storage" ]; then
  preserve_tree_no_clobber "$RELEASE_DIR/storage" "$SHARED_DIR/storage" "release storage"
  rm -rf "$RELEASE_DIR/storage" || fail "could not replace verified release storage copy with shared storage link"
elif [ -L "$RELEASE_DIR/storage" ]; then
  RELEASE_STORAGE_TARGET="$(readlink -f "$RELEASE_DIR/storage" 2>/dev/null || true)"
  SHARED_STORAGE_TARGET="$(readlink -f "$SHARED_DIR/storage" 2>/dev/null || true)"
  [ -n "$SHARED_STORAGE_TARGET" ] && [ "$RELEASE_STORAGE_TARGET" = "$SHARED_STORAGE_TARGET" ] \
    || fail "release storage symlink does not target the verified shared storage directory"
elif [ -e "$RELEASE_DIR/storage" ]; then
  fail "unexpected storage path in release"
fi
if [ ! -L "$RELEASE_DIR/storage" ]; then ln -s "$SHARED_DIR/storage" "$RELEASE_DIR/storage"; fi

# Preserve runtime-written public media in each immutable release. Never delete
# or overwrite a release asset: identical collisions are accepted; differing
# collisions, symlinks, or paths outside APP_DIR stop for manual review.
[ ! -L "$PREV_TARGET/public" ] || fail "current public directory is a symlink; review media storage before deploying"
[ -d "$RELEASE_DIR/public" ] || fail "release public directory is missing"
preserve_public_media() {
  local name="$1" source="$PREV_TARGET/public/$1" target="$RELEASE_DIR/public/$1" resolved
  [ -e "$source" ] || [ -L "$source" ] || return 0
  if [ -L "$source" ]; then
    resolved="$(readlink -f "$source" 2>/dev/null || true)"
    [ -n "$resolved" ] || fail "public media symlink cannot be resolved: $name"
    case "$resolved" in "$APP_DIR"/*) source="$resolved" ;; *) fail "public media symlink escapes APP_DIR: $name" ;; esac
  fi
  [ -d "$source" ] || fail "public media path is not a directory: $name"
  [ ! -L "$target" ] || fail "release public media target is a symlink: $name"
  preserve_tree_no_clobber "$source" "$target" "public media $name"
  log "preserved public media directory: $name"
}
for name in avatars avatar-videos avatar-audio avatar-scenes avatar-thumbs generated voice-studio asr-output; do
  preserve_public_media "$name"
done
cd "$RELEASE_DIR"
npm ci || fail "dependency install failed; known-good release remains current"
npx prisma generate || fail "Prisma client generation failed; known-good release remains current"
npm run build || fail "production build failed before backup/migration; known-good release remains current"
[ -f .next/standalone/server.js ] || fail "standalone production server was not built"

# Read DATABASE_URL from the private shared .env file without printing it.
TS="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/db-${TS}-${EXPECTED_SHA:0:7}.sql.gz"
MEDIA_BACKUP="$BACKUP_DIR/media-${TS}-${EXPECTED_SHA:0:7}.tar.gz"
[ ! -e "$BACKUP_FILE" ] && [ ! -e "$BACKUP_FILE.sha256" ] || fail "database backup destination already exists; refusing to overwrite it"
[ ! -e "$MEDIA_BACKUP" ] && [ ! -e "$MEDIA_BACKUP.sha256" ] || fail "media backup destination already exists; refusing to overwrite it"
BACKUP_ENV="$(mktemp)"
HISTORY_FILE=""
chmod 600 "$BACKUP_ENV"
cleanup() {
  rm -f "$BACKUP_ENV"
  [ -z "$HISTORY_FILE" ] || rm -f "$HISTORY_FILE"
}
trap cleanup EXIT
node - "$SHARED_DIR/.env" "$BACKUP_ENV" <<'NODE'
const fs = require("fs");
const [envFile, out] = process.argv.slice(2);
let databaseUrl = "";
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*DATABASE_URL\s*=\s*(.*)$/);
  if (match) { databaseUrl = match[1].trim().replace(/^["']|["']$/g, ""); break; }
}
if (!databaseUrl.startsWith("mysql://")) { console.error("[deploy] DATABASE_URL is missing or not MySQL"); process.exit(1); }
const url = new URL(databaseUrl);
const host = decodeURIComponent(url.hostname);
const port = url.port || "3306";
const database = decodeURIComponent(url.pathname.slice(1));
if (host !== "127.0.0.1" || port !== "3306" || database !== "db_learn") {
  console.error("[deploy] database target does not match verified 127.0.0.1:3306/db_learn; no database action attempted");
  process.exit(1);
}
const quote = (value) => "'" + String(value).replace(/'/g, "'\\''") + "'";
const values = [
  `MYSQL_HOST=${quote(host)}`,
  `MYSQL_PORT=${quote(port)}`,
  `MYSQL_USER=${quote(decodeURIComponent(url.username))}`,
  `MYSQL_PWD=${quote(decodeURIComponent(url.password))}`,
  `MYSQL_DB=${quote(database)}`,
];
fs.writeFileSync(out, values.join("\n") + "\n", { mode: 0o600 });
NODE
# shellcheck disable=SC1090
set -a
. "$BACKUP_ENV"
set +a
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -N -e "SELECT 1" "$MYSQL_DB" >/dev/null \
  || { unset MYSQL_PWD MYSQL_USER MYSQL_HOST MYSQL_PORT MYSQL_DB; fail "MySQL SELECT 1 failed; no migration attempted"; }
if ! mysqldump -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" --single-transaction --no-tablespaces --routines --events --triggers --hex-blob "$MYSQL_DB" | gzip > "$BACKUP_FILE"; then
  unset MYSQL_PWD MYSQL_USER MYSQL_HOST MYSQL_PORT MYSQL_DB
  rm -f "$BACKUP_FILE"
  fail "mysqldump/gzip failed; no migration attempted"
fi
unset MYSQL_PWD MYSQL_USER MYSQL_HOST MYSQL_PORT MYSQL_DB
chmod 600 "$BACKUP_FILE"
gzip -t "$BACKUP_FILE" && [ -s "$BACKUP_FILE" ] || fail "database backup failed gzip integrity check"
if ! (set +o pipefail; zcat "$BACKUP_FILE" | head -c 1048576 | grep -qiE "CREATE TABLE"); then
  fail "backup content probe failed; no migration attempted"
fi
sha256sum "$BACKUP_FILE" > "$BACKUP_FILE.sha256"
chmod 600 "$BACKUP_FILE.sha256"
log "database backup passed gzip/content checks and was checksummed at $BACKUP_FILE; this is not a restore test"

MEDIA_PATHS=()
if [ -d "$SHARED_DIR/storage" ] || [ -L "$SHARED_DIR/storage" ]; then
  [ ! -L "$SHARED_DIR/storage" ] || fail "shared storage is a symlink; media backup requires manual review"
  MEDIA_PATHS+=("shared/storage")
fi
for name in avatars avatar-videos avatar-audio avatar-scenes avatar-thumbs generated voice-studio asr-output; do
  MEDIA_SOURCE="$PREV_TARGET/public/$name"
  if [ -e "$MEDIA_SOURCE" ] || [ -L "$MEDIA_SOURCE" ]; then
    if [ -L "$MEDIA_SOURCE" ]; then
      MEDIA_SOURCE="$(readlink -f "$MEDIA_SOURCE" 2>/dev/null || true)"
      [ -n "$MEDIA_SOURCE" ] || fail "cannot resolve current media symlink: $name"
    fi
    [ -d "$MEDIA_SOURCE" ] || fail "current media path is not a directory: $name"
    case "$MEDIA_SOURCE" in "$APP_DIR"/*) ;; *) fail "media directory escapes APP_DIR: $name" ;; esac
    if find "$MEDIA_SOURCE" -type l -print -quit | grep -q .; then
      fail "nested symlink in media directory $name; stop for manual backup review"
    fi
    MEDIA_PATHS+=("${MEDIA_SOURCE#"$APP_DIR"/}")
  fi
done
if [ "${#MEDIA_PATHS[@]}" -gt 0 ]; then
  tar --exclude='.env' --exclude='*/.env' --exclude='.env.*' --exclude='*/.env.*' \
    --exclude='*.pem' --exclude='*.key' -czf "$MEDIA_BACKUP" -C "$APP_DIR" -- "${MEDIA_PATHS[@]}" \
    || fail "media backup creation failed; no migration or release switch attempted"
  tar -tzf "$MEDIA_BACKUP" >/dev/null || fail "media backup archive failed integrity validation"
  chmod 600 "$MEDIA_BACKUP"
  sha256sum "$MEDIA_BACKUP" > "$MEDIA_BACKUP.sha256"
  chmod 600 "$MEDIA_BACKUP.sha256"
  log "media backup passed tar integrity checks and was checksummed at $MEDIA_BACKUP"
else
  log "no application media directories found; no media archive was created"
fi
log "independent restore reference $RESTORE_TEST_REFERENCE and schema/history reference $SCHEMA_PREFLIGHT_REFERENCE are attested for $EXPECTED_SHA"

# Read only Prisma migration metadata and compare every applied checksum to the
# exact release. Empty, failed, rolled-back, out-of-order, or modified history
# is a hard stop; the initial baseline must already be reconciled and recorded.
HISTORY_FILE="$(mktemp)"
chmod 600 "$HISTORY_FILE"
set -a
. "$BACKUP_ENV"
set +a
if ! mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -N -B \
  -e "SELECT migration_name, checksum, CASE WHEN finished_at IS NULL THEN 0 ELSE 1 END, CASE WHEN rolled_back_at IS NULL THEN 0 ELSE 1 END FROM _prisma_migrations ORDER BY started_at, migration_name" \
  "$MYSQL_DB" > "$HISTORY_FILE"; then
  unset MYSQL_PWD MYSQL_USER MYSQL_HOST MYSQL_PORT MYSQL_DB
  fail "cannot read _prisma_migrations; baseline/history reconciliation is required before deployment"
fi
unset MYSQL_PWD MYSQL_USER MYSQL_HOST MYSQL_PORT MYSQL_DB
HISTORY_RESULT="$(node "$RELEASE_DIR/scripts/verify-prisma-history.mjs" "$HISTORY_FILE" "$RELEASE_DIR/prisma/migrations")" \
  || fail "Prisma migration history/checksum verification failed; no migration attempted"
HISTORY_PENDING="$(printf '%s' "$HISTORY_RESULT" | node -e 'let s="";process.stdin.setEncoding("utf8");process.stdin.on("data",x=>s+=x).on("end",()=>{try{const r=JSON.parse(s);if(!Array.isArray(r.pending))process.exit(1);process.stdout.write(r.pending.join("\n"))}catch{process.exit(1)}})')" \
  || fail "could not parse verified Prisma history summary"

# Inspect migration status. `migrate deploy` is invoked only for the exact,
# checksummed pending suffix already rehearsed against a restored copy.
STATUS_OUTPUT=""
STATUS_CODE=0
STATUS_OUTPUT="$(npx prisma migrate status 2>&1)" || STATUS_CODE=$?
if [ "$STATUS_CODE" -ne 0 ]; then
  if printf '%s' "$STATUS_OUTPUT" | grep -qiE 'P3009|P3018|P3006|P3005|checksum|failed migration|drift|diverged'; then
    fail "Prisma reports failed/diverged/unbaselined/checksum-mismatched history; no migration attempted"
  fi
  if ! printf '%s' "$STATUS_OUTPUT" | grep -qiE 'not yet (been )?applied|pending migrations?'; then
    fail "migration status failed without an explicit pending-migration report; no migration attempted"
  fi
  PENDING="$(printf '%s' "$STATUS_OUTPUT" | grep -oE '[0-9]{14}_[A-Za-z0-9_]+' | sort -u || true)"
  EXPECTED_AFTER_BASELINE="$(printf '%s\n' 20261007000000_human_avatar_ownership 20261010000000_admissions_crm_quotes 20261010000001_admin_otp_challenges 20261018000000_v2_additive_mysql_tables)"
  EXPECTED_AFTER_AVATAR="$(printf '%s\n' 20261010000000_admissions_crm_quotes 20261010000001_admin_otp_challenges 20261018000000_v2_additive_mysql_tables)"
  EXPECTED_AFTER_ADMISSIONS="$(printf '%s\n' 20261010000001_admin_otp_challenges 20261018000000_v2_additive_mysql_tables)"
  EXPECTED_V2_ONLY="20261018000000_v2_additive_mysql_tables"
  [ "$PENDING" = "$HISTORY_PENDING" ] || fail "Prisma status differs from the checksum-verified history suffix; no migration attempted"
  if [ -z "$PENDING" ] || { [ "$PENDING" != "$EXPECTED_AFTER_BASELINE" ] && [ "$PENDING" != "$EXPECTED_AFTER_AVATAR" ] && [ "$PENDING" != "$EXPECTED_AFTER_ADMISSIONS" ] && [ "$PENDING" != "$EXPECTED_V2_ONLY" ]; }; then
    fail "pending migrations are not a known ordered suffix after the reconciled baseline; no migration attempted"
  fi
  [ "$MIGRATION_PLAN_APPROVED_SHA" = "$EXPECTED_SHA" ] || fail "pending migrations require MIGRATION_PLAN_APPROVED_SHA to equal this exact, restored-copy-rehearsed SHA"
  log "applying only the approved pending migration suffix for $EXPECTED_SHA"
  npx prisma migrate deploy || fail "migration failed; preserve the backup and stop for manual recovery: $BACKUP_FILE"
  npx prisma migrate status || fail "migration status is not clean; preserve the backup and stop before switching code"
else
  [ -z "$HISTORY_PENDING" ] || fail "Prisma status reports no pending migrations but the verified history is incomplete"
  log "Prisma reports no pending migrations and all exact-release checksums match; migrate deploy is skipped"
fi

# Atomic symlink switch; no PM2 start fallback is permitted.
CURRENT_TMP="$APP_DIR/current.${EXPECTED_SHA}.tmp"
[ ! -e "$CURRENT_TMP" ] && [ ! -L "$CURRENT_TMP" ] || fail "temporary current link exists; inspect manually"
ln -s "$RELEASE_DIR" "$CURRENT_TMP"
mv -Tf "$CURRENT_TMP" "$CURRENT_LINK"

rollback() {
  log "restoring current -> previously healthy release $PREV_SHA; database is not reverted"
  local tmp="$APP_DIR/current.rollback.tmp"
  [ ! -e "$tmp" ] && [ ! -L "$tmp" ] || { printf '[deploy] ERROR: rollback temp link exists; manual recovery required\n' >&2; return 1; }
  ln -s "$PREV_TARGET" "$tmp" && mv -Tf "$tmp" "$CURRENT_LINK" || return 1
  pm2_process_is_online || { printf '[deploy] ERROR: PM2 process disappeared; automatic restart is disabled\n' >&2; return 1; }
  RELEASE_SHA="$PREV_SHA" pm2 reload "$PM2_APP_NAME" --update-env || return 1
  pm2 save || return 1
}

if ! pm2_process_is_online; then
  rollback || fail "PM2 process is missing; old release pointer restored where possible. Manual PM2 recovery is required"
  fail "PM2 process disappeared before reload; known-good release restored"
fi
if ! RELEASE_SHA="$EXPECTED_SHA" pm2 reload "$PM2_APP_NAME" --update-env || ! pm2 save; then
  rollback || fail "PM2 reload/save failed and automatic rollback could not be verified; manual recovery required"
  fail "PM2 reload/save failed; restored the known-good release"
fi

healthy=""
for _ in $(seq 1 30); do
  health_json="$(curl --connect-timeout 5 --max-time 10 -fsS "http://127.0.0.1:${APP_PORT}/api/health" 2>/dev/null || true)"
  health_status="$(printf '%s' "$health_json" | node -e 'let s="";process.stdin.on("data",x=>s+=x).on("end",()=>{try{process.stdout.write(JSON.parse(s).status||"")}catch{}})')"
  health_sha="$(printf '%s' "$health_json" | node -e 'let s="";process.stdin.on("data",x=>s+=x).on("end",()=>{try{process.stdout.write(JSON.parse(s).releaseSha||"")}catch{}})')"
  if [ "$health_status" = "ok" ] && [ "$health_sha" = "$EXPECTED_SHA" ] && pm2_process_is_online; then healthy=1; break; fi
  sleep 2
done
if [ -z "$healthy" ]; then
  pm2 logs "$PM2_APP_NAME" --lines 50 --nostream || true
  rollback || fail "health check failed and automatic rollback could not be verified; manual recovery required"
  fail "new release health check failed; known-good code restored. Database is not reverted"
fi
[ "$(cat "$CURRENT_LINK/RELEASE_SHA")" = "$EXPECTED_SHA" ] || {
  rollback || fail "release SHA mismatch and automatic rollback failed"
  fail "release SHA mismatch; known-good code restored"
}

mkdir -p "$APP_DIR/.releases"
printf 'sha=%s prev=%s at=%s backup=%s\n' "$EXPECTED_SHA" "$PREV_SHA" "$(date -u +%FT%TZ)" "$BACKUP_FILE" >> "$APP_DIR/.releases/history.log"
log "DEPLOY SUCCEEDED: $EXPECTED_SHA; local /api/health returned 200; previous release $PREV_SHA retained"
log "No public-domain health check was performed by this script; CI performs that separately"
