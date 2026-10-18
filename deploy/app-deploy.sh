#!/bin/bash
set -euo pipefail

APP_DIR="/home/aloedu/learn-app"
APP_PORT=3017
APP_NAME="alo-learning-journey"

echo "=== ALO Learning Journey — VPS Deployment ==="

# Step 1: Backup
echo "[1/10] Backing up current release..."
cp -r "$APP_DIR/.env" "/tmp/alo-env-backup-$(date +%s)" 2>/dev/null || true
cp -r "$APP_DIR/.next" "/tmp/alo-next-backup-$(date +%s)" 2>/dev/null || true

# Step 2: Pull latest
echo "[2/10] Pulling latest code..."
cd "$APP_DIR"
git fetch origin main
git checkout main
git pull origin main

# Step 3: Install dependencies
echo "[3/10] Installing dependencies..."
npm ci

# Step 4: Generate Prisma client
echo "[4/10] Generating Prisma client..."
npx prisma generate

# Step 5: Run safe migrations
echo "[5/10] Running database migrations..."
npx prisma migrate deploy

# Step 6: Build
echo "[6/10] Building production application..."
npm run build

# Step 7: Restart
echo "[7/10] Restarting application..."
pm2 restart "$APP_NAME" || pm2 start "npm run start:prod" --name "$APP_NAME"

# Step 8: Wait for startup
echo "[8/10] Waiting for application to start..."
sleep 5

# Step 9: Health check
echo "[9/10] Running health check..."
if curl -sf "http://localhost:$APP_PORT/api/health" > /dev/null 2>&1; then
    echo "✅ Health check PASSED"
else
    echo "❌ Health check FAILED — rolling back..."
    pm2 stop "$APP_NAME"
    rm -rf "$APP_DIR/.next"
    cp -r /tmp/alo-next-backup-* "$APP_DIR/.next" 2>/dev/null || true
    pm2 restart "$APP_NAME"
    echo "❌ Deployment failed — rolled back to previous release"
    exit 1
fi

# Step 10: Done
echo "[10/10] Deployment complete!"
echo "App: https://learn.aloeducation.com"
echo "Port: $APP_PORT"
echo "Process: $APP_NAME"
