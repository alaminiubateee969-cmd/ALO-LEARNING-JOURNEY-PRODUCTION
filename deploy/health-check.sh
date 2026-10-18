#!/usr/bin/env bash
# Read-only local + public health verification. Never starts/restarts PM2.
set -Eeuo pipefail
cd /

fail() { printf '[health] ERROR: %s\n' "$*" >&2; exit 1; }
APP_DIR="${APP_DIR:-/home/aloedu/LEARNING-JOURNEY}"
APP_NAME="${PM2_APP_NAME:-learn-aloeducation}"
PORT="${APP_PORT:-3017}"
DOMAIN="${PUBLIC_BASE_URL:-https://learn.aloeducation.com}"
[ "$APP_DIR" = "/home/aloedu/LEARNING-JOURNEY" ] || fail "APP_DIR must be /home/aloedu/LEARNING-JOURNEY"
[ "$APP_NAME" = "learn-aloeducation" ] || fail "PM2 app must be learn-aloeducation"
[ "$PORT" = "3017" ] || fail "application port must be 3017"
[ "$DOMAIN" = "https://learn.aloeducation.com" ] || fail "public URL must be https://learn.aloeducation.com"
for cmd in pm2 node curl ss; do command -v "$cmd" >/dev/null || fail "$cmd is not installed"; done

if ! pm2 jlist 2>/dev/null | node -e '
let input=""; process.stdin.setEncoding("utf8"); process.stdin.on("data",x=>input+=x).on("end",()=>{
  try { const rows=JSON.parse(input).filter(p=>p.name===process.argv[1]); process.exit(rows.length===1 && rows[0]?.pm2_env?.status==="online" ? 0 : 1); }
  catch { process.exit(1); }
});' "$APP_NAME"; then
  fail "PM2 process $APP_NAME is missing or not online; this check will not start it"
fi
printf '[health] PM2 %s is online\n' "$APP_NAME"

ss -lntH | awk '$4 ~ /:3017$/ { found=1 } END { exit !found }' || fail "port 3017 is not listening"
printf '[health] port 3017 is listening\n'

EXPECTED_SHA="${EXPECTED_SHA:-}"
if [ -z "$EXPECTED_SHA" ] && [ -f "$APP_DIR/current/RELEASE_SHA" ]; then
  EXPECTED_SHA="$(cat "$APP_DIR/current/RELEASE_SHA")"
fi
[[ "$EXPECTED_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "EXPECTED_SHA must be provided or proven by current/RELEASE_SHA"

check_endpoint() {
  local url="$1" label="$2" expected_sha="$3" body status release
  body="$(curl --connect-timeout 8 --max-time 15 --fail --silent --show-error "$url" 2>/dev/null)" || fail "$label health request failed"
  status="$(printf '%s' "$body" | node -e 'let s="";process.stdin.on("data",x=>s+=x).on("end",()=>{try{process.stdout.write(JSON.parse(s).status||"")}catch{}})')"
  release="$(printf '%s' "$body" | node -e 'let s="";process.stdin.on("data",x=>s+=x).on("end",()=>{try{process.stdout.write(JSON.parse(s).releaseSha||"")}catch{}})')"
  [ "$status" = "ok" ] || fail "$label reports status=${status:-unknown}"
  [ "$release" = "$expected_sha" ] || fail "$label serves release ${release:-unknown}; expected $expected_sha"
  printf '[health] %s reports status=ok and exact release %s\n' "$label" "$release"
}

check_endpoint "http://127.0.0.1:${PORT}/api/health" "local" "$EXPECTED_SHA"
check_endpoint "${DOMAIN}/api/health" "public ${DOMAIN}" "$EXPECTED_SHA"
root_code="$(curl --connect-timeout 8 --max-time 15 --silent --show-error -o /dev/null -w '%{http_code}' "$DOMAIN/" || true)"
case "$root_code" in 200|301|302|307|308) ;; *) fail "public site root returned HTTP $root_code" ;; esac
printf '[health] public root returned HTTP %s\n' "$root_code"
printf '[health] VERIFIED: public domain serves release %s\n' "$EXPECTED_SHA"
