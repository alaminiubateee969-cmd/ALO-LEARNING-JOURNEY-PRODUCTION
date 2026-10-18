#!/usr/bin/env bash
# Supported manual entry point for the exact-SHA release deploy.
# The GitHub workflow streams scripts/deploy-production.sh over pinned SSH.
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-/home/aloedu/LEARNING-JOURNEY}"
PM2_APP_NAME="${PM2_APP_NAME:-learn-aloeducation}"
APP_PORT="${APP_PORT:-3017}"

[ "$APP_DIR" = "/home/aloedu/LEARNING-JOURNEY" ] || {
  printf '[deploy] ERROR: APP_DIR must be /home/aloedu/LEARNING-JOURNEY.\n' >&2
  exit 1
}
[ "$PM2_APP_NAME" = "learn-aloeducation" ] || {
  printf '[deploy] ERROR: PM2_APP_NAME must be learn-aloeducation.\n' >&2
  exit 1
}
[ "$APP_PORT" = "3017" ] || {
  printf '[deploy] ERROR: APP_PORT must be 3017.\n' >&2
  exit 1
}

export APP_DIR PM2_APP_NAME APP_PORT
exec bash "$SCRIPT_DIR/../scripts/deploy-production.sh" "$@"
