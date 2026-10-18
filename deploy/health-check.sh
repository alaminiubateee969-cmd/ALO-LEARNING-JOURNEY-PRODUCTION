#!/bin/bash
set -euo pipefail

PORT=3017
DOMAIN="https://learn.aloeducation.com"

echo "=== ALO Learning Journey — Health Check ==="

# Check process
if pm2 list 2>/dev/null | grep -q "alo-learning-journey"; then
    echo "✅ PM2 process running"
else
    echo "❌ PM2 process NOT running"
    exit 1
fi

# Check port
if ss -lntp | grep -q ":$PORT"; then
    echo "✅ Port $PORT listening"
else
    echo "❌ Port $PORT NOT listening"
    exit 1
fi

# Check localhost
if curl -sf "http://localhost:$PORT/" > /dev/null 2>&1; then
    echo "✅ Localhost HTTP 200"
else
    echo "❌ Localhost NOT responding"
    exit 1
fi

# Check API health
if curl -sf "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
    echo "✅ API health endpoint OK"
else
    echo "❌ API health endpoint FAILED"
    exit 1
fi

# Check domain (if accessible)
if curl -sf "$DOMAIN/" > /dev/null 2>&1; then
    echo "✅ Domain $DOMAIN reachable"
else
    echo "⚠️ Domain $DOMAIN not reachable from this host (may be DNS/SSL)"
fi

echo "=== All health checks passed ==="
