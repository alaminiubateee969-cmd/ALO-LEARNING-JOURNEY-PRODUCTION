#!/usr/bin/env bash
# MySQL + application-media backup. This script never copies .env/secrets and
# never prunes old backups. It checks archive integrity, not restoreability.
set -Eeuo pipefail
cd /

log()  { printf '[backup] %s\n' "$*"; }
fail() { printf '[backup] ERROR: %s\n' "$*" >&2; exit 1; }

APP_DIR="${APP_DIR:-/home/aloedu/LEARNING-JOURNEY}"
[ "$APP_DIR" = "/home/aloedu/LEARNING-JOURNEY" ] || fail "APP_DIR must be /home/aloedu/LEARNING-JOURNEY"
[ -d "$APP_DIR" ] || fail "verified application directory is missing"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/shared/.backups}"
case "$BACKUP_DIR" in "$APP_DIR"/*) ;; *) fail "BACKUP_DIR must be beneath APP_DIR" ;; esac

if [ -f "$APP_DIR/shared/.env" ]; then
  ENV_FILE="$APP_DIR/shared/.env"
elif [ -f "$APP_DIR/current/.env" ]; then
  ENV_FILE="$APP_DIR/current/.env"
elif [ -f "$APP_DIR/.env" ]; then
  ENV_FILE="$APP_DIR/.env"
else
  fail "no environment file found in the verified app layout"
fi

for command_name in node mysql mysqldump gzip zcat sha256sum tar chmod mktemp date; do
  command -v "$command_name" >/dev/null || fail "$command_name is not installed"
done
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR" || fail "cannot secure backup directory"
TS="$(date -u +%Y%m%d-%H%M%S)"
DB_BACKUP="$BACKUP_DIR/db-${TS}.sql.gz"
MEDIA_BACKUP="$BACKUP_DIR/media-${TS}.tar.gz"
MYSQL_ENV="$(mktemp)"
chmod 600 "$MYSQL_ENV"
trap 'rm -f "$MYSQL_ENV"' EXIT

# Parse the MySQL URL into a mode-0600 temporary env file; never print it.
node - "$ENV_FILE" "$MYSQL_ENV" <<'NODE'
const fs = require("fs");
const [envFile, out] = process.argv.slice(2);
let value = "";
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*DATABASE_URL\s*=\s*(.*)$/);
  if (match) { value = match[1].trim().replace(/^["']|["']$/g, ""); break; }
}
if (!value.startsWith("mysql://")) { console.error("[backup] DATABASE_URL is missing or not MySQL"); process.exit(1); }
const url = new URL(value);
const host = decodeURIComponent(url.hostname);
const port = url.port || "3306";
const database = decodeURIComponent(url.pathname.slice(1));
if (host !== "127.0.0.1" || port !== "3306" || database !== "db_learn") {
  console.error("[backup] database target does not match verified 127.0.0.1:3306/db_learn");
  process.exit(1);
}
const quote = (text) => "'" + String(text).replace(/'/g, "'\\''") + "'";
const rows = [
  `MYSQL_HOST=${quote(host)}`,
  `MYSQL_PORT=${quote(port)}`,
  `MYSQL_USER=${quote(decodeURIComponent(url.username))}`,
  `MYSQL_PWD=${quote(decodeURIComponent(url.password))}`,
  `MYSQL_DB=${quote(database)}`,
];
fs.writeFileSync(out, rows.join("\n") + "\n", { mode: 0o600 });
NODE
# shellcheck disable=SC1090
set -a
. "$MYSQL_ENV"
set +a
mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -N -e "SELECT 1" "$MYSQL_DB" >/dev/null \
  || { unset MYSQL_PWD MYSQL_USER MYSQL_HOST MYSQL_PORT MYSQL_DB; fail "MySQL connectivity check failed"; }
if ! mysqldump -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" \
  --single-transaction --quick --no-tablespaces --routines --events --triggers \
  --hex-blob --set-gtid-purged=OFF --databases "$MYSQL_DB" | gzip > "$DB_BACKUP"; then
  unset MYSQL_PWD MYSQL_USER MYSQL_HOST MYSQL_PORT MYSQL_DB
  rm -f "$DB_BACKUP"
  fail "mysqldump or gzip failed"
fi
unset MYSQL_PWD MYSQL_USER MYSQL_HOST MYSQL_PORT MYSQL_DB
chmod 600 "$DB_BACKUP"
gzip -t "$DB_BACKUP" && [ -s "$DB_BACKUP" ] || fail "database archive failed gzip integrity validation"
if ! (set +o pipefail; zcat "$DB_BACKUP" | grep -m1 -qiE 'CREATE TABLE|CREATE DATABASE'); then
  fail "database archive content probe failed"
fi
sha256sum "$DB_BACKUP" > "$DB_BACKUP.sha256"
chmod 600 "$DB_BACKUP.sha256"
log "database backup created and checksummed: $(basename "$DB_BACKUP")"

# Include only known application-media directories; never archive secrets or
# prune/delete existing files. No media archive is written if none are present.
MEDIA_PATHS=()
if [ -d "$APP_DIR/shared/storage" ] && [ ! -L "$APP_DIR/shared/storage" ]; then
  MEDIA_PATHS+=("$APP_DIR/shared/storage")
fi
PUBLIC_DIR="$APP_DIR/current/public"
if [ ! -d "$PUBLIC_DIR" ]; then PUBLIC_DIR="$APP_DIR/public"; fi
if [ -d "$PUBLIC_DIR" ]; then
  for name in avatars avatar-videos avatar-audio avatar-scenes avatar-thumbs generated voice-studio asr-output; do
    if [ -d "$PUBLIC_DIR/$name" ] && [ ! -L "$PUBLIC_DIR/$name" ]; then
      MEDIA_PATHS+=("$PUBLIC_DIR/$name")
    fi
  done
fi
if [ "${#MEDIA_PATHS[@]}" -gt 0 ]; then
  tar --exclude='.env' --exclude='*/.env' --exclude='.env.*' --exclude='*/.env.*' \
    --exclude='*.pem' --exclude='*.key' -czf "$MEDIA_BACKUP" -- "${MEDIA_PATHS[@]}" \
    || fail "media tar creation failed"
  tar -tzf "$MEDIA_BACKUP" >/dev/null || fail "media archive validation failed"
  chmod 600 "$MEDIA_BACKUP"
  sha256sum "$MEDIA_BACKUP" > "$MEDIA_BACKUP.sha256"
  chmod 600 "$MEDIA_BACKUP.sha256"
  log "media archive created and checksummed: $(basename "$MEDIA_BACKUP")"
else
  log "no configured media directories found; no media archive created"
fi

log "backup complete; archive checks do not replace an isolated restore rehearsal; no files were pruned"
