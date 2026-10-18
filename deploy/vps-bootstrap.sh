#!/usr/bin/env bash
# Read-only VPS deployment preflight. This intentionally performs no bootstrap
# installs, service restarts, firewall/proxy edits, chmod/chown, cron changes,
# directory migrations, database writes, or DNS changes.
set -Eeuo pipefail
cd /

APP_DIR="${APP_DIR:-/home/aloedu/LEARNING-JOURNEY}"
APP_NAME="${PM2_APP_NAME:-learn-aloeducation}"
PORT="${APP_PORT:-3017}"
DOMAIN="${PUBLIC_BASE_URL:-https://learn.aloeducation.com}"
[ "$APP_DIR" = "/home/aloedu/LEARNING-JOURNEY" ] || { echo '[preflight] ERROR: APP_DIR must be /home/aloedu/LEARNING-JOURNEY' >&2; exit 1; }
[ "$APP_NAME" = "learn-aloeducation" ] || { echo '[preflight] ERROR: PM2 process name must be learn-aloeducation' >&2; exit 1; }
[ "$PORT" = "3017" ] || { echo '[preflight] ERROR: APP_PORT must be 3017' >&2; exit 1; }
[ "$DOMAIN" = "https://learn.aloeducation.com" ] || { echo '[preflight] ERROR: public URL must be https://learn.aloeducation.com' >&2; exit 1; }

printf '%s\n' 'Read-only deployment preflight — no server configuration or data will be changed.'
printf '[preflight] expected app path: %s\n' "$APP_DIR"
printf '[preflight] expected PM2 name: %s\n' "$APP_NAME"
printf '[preflight] expected app port: %s\n' "$PORT"
printf '[preflight] expected public domain: %s\n' "$DOMAIN"
printf '[preflight] current user: %s\n' "$(id -un)"

failed=0
for cmd in git node npm pm2 mysql mysqldump curl ss; do
  if command -v "$cmd" >/dev/null; then printf '[preflight] found %s\n' "$cmd"; else printf '[preflight] MISSING %s\n' "$cmd"; failed=1; fi
done
if command -v node >/dev/null; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$NODE_MAJOR" = "22" ]; then printf '[preflight] Node.js %s (expected 22)\n' "$(node -v)"; else printf '[preflight] MISMATCH Node.js %s (deployment expects major 22)\n' "$(node -v)"; failed=1; fi
fi
if [ -d "$APP_DIR" ]; then printf '[preflight] app directory exists\n'; else printf '[preflight] MISSING app directory\n'; failed=1; fi
if [ -f "$APP_DIR/shared/.env" ]; then
  printf '[preflight] shared environment file exists (contents not displayed)\n'
elif [ -f "$APP_DIR/.env" ]; then
  printf '[preflight] app environment file exists (contents not displayed)\n'
else
  printf '[preflight] MISSING environment file\n'
  failed=1
fi
if [ -L "$APP_DIR/current" ] && [ -f "$APP_DIR/current/RELEASE_SHA" ]; then printf '[preflight] current release pointer and SHA marker exist\n'; else printf '[preflight] no atomic current-release marker; first deployment/repair needs a separately reviewed runbook\n'; failed=1; fi

if ! command -v pm2 >/dev/null; then
  printf '[preflight] PM2 is unavailable\n'
  failed=1
elif ! pm2 jlist 2>/dev/null | node -e '
let input=""; process.stdin.setEncoding("utf8"); process.stdin.on("data",x=>input+=x).on("end",()=>{
  try { const rows=JSON.parse(input).filter(p=>p.name===process.argv[1]); process.exit(rows.length===1 && rows[0]?.pm2_env?.status==="online" ? 0 : 1); }
  catch { process.exit(1); }
});' "$APP_NAME"; then
  printf '[preflight] PM2 process %s is missing or not online; no start/restart attempted\n' "$APP_NAME"
  failed=1
else
  printf '[preflight] PM2 process %s is online\n' "$APP_NAME"
fi

if command -v ss >/dev/null && ss -lntH | awk '$4 ~ /:3017$/ { found=1 } END { exit !found }'; then
  printf '[preflight] port 3017 is listening\n'
else
  printf '[preflight] port 3017 is not listening\n'
  failed=1
fi

if command -v df >/dev/null && [ -d "$APP_DIR" ]; then df -h "$APP_DIR"; fi
if command -v free >/dev/null; then free -h; fi
if [ "$failed" -ne 0 ]; then
  printf '[preflight] BLOCKED: resolve missing/mismatched prerequisites manually; no changes were made.\n' >&2
  exit 1
fi
printf '[preflight] prerequisites look present; this report does not prove DB schema compatibility, backup restoreability, or public-domain health. No changes were made.\n'
