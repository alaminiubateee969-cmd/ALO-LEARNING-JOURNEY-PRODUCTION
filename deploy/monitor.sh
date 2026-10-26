#!/usr/bin/env bash
# Read-only monitoring snapshot for the operator-provided production target.
# This script does not start/restart PM2, query MySQL, mutate data, or print logs.
# Verify the host and release layout before running it.
# Usage: bash deploy/monitor.sh

set -uo pipefail
APP_DIR="${APP_DIR:-/home/aloedu/LEARNING-JOURNEY}"
APP_PORT="${APP_PORT:-3017}"
APP_NAME="${PM2_APP_NAME:-learn-aloeducation}"

fail() { printf '[monitor] ERROR: %s\n' "$*" >&2; exit 1; }
[ "$APP_DIR" = "/home/aloedu/LEARNING-JOURNEY" ] || fail "APP_DIR must be /home/aloedu/LEARNING-JOURNEY"
[ "$APP_PORT" = "3017" ] || fail "APP_PORT must be 3017"
[ "$APP_NAME" = "learn-aloeducation" ] || fail "PM2 app must be learn-aloeducation"
[ -d "$APP_DIR" ] || fail "APP_DIR does not exist; no action taken"

printf '==========================================\n'
printf '[%s] ALO read-only monitoring snapshot\n' "$(date -Iseconds)"
printf '==========================================\n'

printf '\n[1/5] Local health (minimal public endpoint):\n'
if curl --connect-timeout 3 --max-time 8 -fsS "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1; then
  printf '  health endpoint responded successfully\n'
else
  printf '  health endpoint failed or is not listening; no restart attempted\n'
fi

printf '\n[2/5] PM2 process:\n'
if ! command -v pm2 >/dev/null 2>&1; then
  printf '  PM2 is not installed or not on PATH\n'
elif pm2 jlist 2>/dev/null | node -e '
  let s=""; process.stdin.setEncoding("utf8"); process.stdin.on("data",x=>s+=x).on("end",()=>{
    try {
      const rows=JSON.parse(s).filter(p=>p.name===process.argv[1]);
      if (rows.length===1) console.log(`  ${rows[0].name}: ${rows[0].pm2_env?.status ?? "unknown"}`);
      else console.log(`  expected exactly one ${process.argv[1]} process; found ${rows.length}`);
    } catch { console.log("  PM2 process list unavailable"); }
  });
' "$APP_NAME"; then
  :
else
  printf '  PM2 process list unavailable\n'
fi

printf '\n[3/5] Disk usage:\n'
df -h "$APP_DIR" 2>/dev/null | tail -1 | awk '{print "  total:",$2,"used:",$3,"available:",$4,"usage:",$5}' || printf '  filesystem usage unavailable\n'
for media_dir in "$APP_DIR/shared/storage" "$APP_DIR/current/public/avatar-videos" "$APP_DIR/current/public/avatar-audio" "$APP_DIR/current/public/avatar-scenes" "$APP_DIR/current/public/avatar-thumbs"; do
  if [ -d "$media_dir" ]; then du -sh -- "$media_dir" 2>/dev/null | sed 's/^/  /'; fi
done

printf '\n[4/5] Memory:\n'
if command -v free >/dev/null 2>&1; then free -h | awk 'NR==2 {print "  total:",$2,"used:",$3,"available:",$7}'; else printf '  free command unavailable\n'; fi

printf '\n[5/5] MySQL / migration history:\n'
printf '  Not queried by this read-only script. Use the approved least-privilege inventory procedure in MIGRATION-RECOVERY-PLAN.md.\n'
printf '  No SQLite file/database is expected or inspected.\n'

printf '\n[%s] monitoring snapshot complete; no services or data were changed\n' "$(date -Iseconds)"
