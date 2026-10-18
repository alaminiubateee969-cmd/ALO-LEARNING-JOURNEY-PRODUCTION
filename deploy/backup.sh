#!/usr/bin/env bash
# ALO Learning Journey — Daily Backup Script
# Backs up: SQLite DB + generated media (avatars, videos, audio, scenes).
# Keeps 14 days of history. Safe to run via cron.
# Usage: bash deploy/backup.sh
# Cron: 0 3 * * * cd /home/aloedu/learn-app && bash deploy/backup.sh >> /home/aloedu/backups/backup.log 2>&1

set -euo pipefail
APP_DIR="${APP_DIR:-/home/aloedu/learn-app}"
BACKUP_DIR="${BACKUP_DIR:-/home/aloedu/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TS="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] starting backup..."

# 1. SQLite DB (online backup via sqlite3 CLI)
DB_PATH="$APP_DIR/db/custom.db"
if [ -f "$DB_PATH" ]; then
  sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/db-$TS.db'"
  echo "  ✓ db backed up → db-$TS.db"
else
  echo "  ⚠ db not found at $DB_PATH — skipping"
fi

# 2. Generated media (avatars, videos, audio, scenes, thumbs)
MEDIA_TAR="$BACKUP_DIR/media-$TS.tar.gz"
cd "$APP_DIR/public"
tar czf "$MEDIA_TAR" \
  avatars avatar-videos avatar-audio avatar-scenes avatar-thumbs \
  generated voice-studio asr-output 2>/dev/null || true
echo "  ✓ media backed up → media-$TS.tar.gz"
cd - > /dev/null

# 3. .env config (small, critical)
if [ -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env" "$BACKUP_DIR/env-$TS"
  echo "  ✓ .env backed up → env-$TS"
fi

# 4. Retention: prune backups older than RETENTION_DAYS
find "$BACKUP_DIR" -name "db-*.db" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "media-*.tar.gz" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "env-*" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
echo "  ✓ pruned backups older than $RETENTION_DAYS days"

echo "[$(date -Iseconds)] backup complete"
echo "  total backups: $(ls -1 "$BACKUP_DIR" | wc -l) files"
echo "  total size:   $(du -sh "$BACKUP_DIR" | cut -f1)"
