#!/usr/bin/env bash
# ALO Learning Journey — Monitoring Script
# Reports: app health, PM2 process, disk usage, memory, DB size, video counts.
# Usage: bash deploy/monitor.sh
# Cron: */10 * * * * cd /home/aloedu/learn-app && bash deploy/monitor.sh >> /home/aloedu/monitor.log 2>&1

set -euo pipefail
APP_PORT="${PORT:-3017}"
APP_NAME="alo-learning-journey"
APP_DIR="${APP_DIR:-/home/aloedu/learn-app}"
DB_PATH="$APP_DIR/db/custom.db"

echo "=========================================="
echo "[$(date -Iseconds)] ALO Monitoring Report"
echo "=========================================="

# 1. HTTP health
echo "[1/6] HTTP health:"
if curl -sf "http://localhost:$APP_PORT/api/health" 2>/dev/null | head -c 200; then
  echo ""
  echo "  ✓ health endpoint OK"
else
  echo "  ✗ health endpoint FAILED — app may be down"
fi

# 2. PM2 status
echo ""
echo "[2/6] PM2 process:"
if command -v pm2 &>/dev/null; then
  pm2 describe "$APP_NAME" 2>/dev/null | grep -E "status|uptime|memory|restarts" | head -5
else
  echo "  pm2 not installed"
fi

# 3. Disk usage
echo ""
echo "[3/6] Disk usage:"
df -h "$APP_DIR" 2>/dev/null | tail -1 | awk '{print "  total:",$2,"used:",$3,"avail:",$4,"usage:",$5}'
du -sh "$APP_DIR/public/avatars" "$APP_DIR/public/avatar-videos" "$APP_DIR/public/avatar-audio" "$APP_DIR/public/avatar-scenes" "$APP_DIR/db" 2>/dev/null | sed 's/^/  /'

# 4. Memory
echo ""
echo "[4/6] Memory:"
free -h | head -2 | tail -1 | awk '{print "  total:",$2,"used:",$3,"free:",$4}'

# 5. Database stats
echo ""
echo "[5/6] Database stats:"
if [ -f "$DB_PATH" ] && command -v sqlite3 &>/dev/null; then
  echo "  db size: $(du -h "$DB_PATH" | cut -f1)"
  echo "  HumanAvatar:  $(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM HumanAvatar;' 2>/dev/null || echo '?')"
  echo "  AvatarVideo:  $(sqlite3 "$DB_PATH" 'SELECT COUNT(*) FROM AvatarVideo;' 2>/dev/null || echo '?')"
  echo "  Completed:    $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM AvatarVideo WHERE status='completed';" 2>/dev/null || echo '?')"
  echo "  Failed:        $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM AvatarVideo WHERE status='failed';" 2>/dev/null || echo '?')"
  echo "  Stuck (>10m):  $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM AvatarVideo WHERE status NOT IN ('completed','failed') AND updatedAt < datetime('now','-10 minutes');" 2>/dev/null || echo '?')"
else
  echo "  sqlite3 or DB not found"
fi

# 6. Recent errors (dev.log / server.log)
echo ""
echo "[6/6] Recent errors (last 20):"
tail -200 "$APP_DIR/dev.log" "$APP_DIR/server.log" 2>/dev/null | grep -iE "error|fail|exception" | grep -viE "prisma:query|telemetry|Cross origin|middleware|proxy.ts" | tail -10 || echo "  none"

echo ""
echo "[$(date -Iseconds)] monitoring complete"
