#!/usr/bin/env bash
# Legacy entry point retained for compatibility. VPS bootstrap is read-only until
# the operator approves a separate first-install runbook.
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/../deploy/vps-bootstrap.sh" "$@"
