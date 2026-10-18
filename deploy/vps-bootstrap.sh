#!/usr/bin/env bash
# ALO Learning Journey — Ubuntu VPS Bootstrap Script
# Usage: bash deploy/deploy-vps.sh
# Idempotent — safe to re-run.

set -euo pipefail

# ---- Config ----
APP_DIR="/home/aloedu/learn-app"
APP_USER="aloedu"
APP_PORT="${PORT:-3017}"
DOMAIN="${DOMAIN:-learn.aloeducation.com}"
NODE_VERSION="20"
BUN_VERSION="1.3.14"

echo "=========================================="
echo "ALO Learning Journey — Ubuntu VPS Deploy"
echo "Domain: $DOMAIN"
echo "App dir: $APP_DIR"
echo "Port:   $APP_PORT"
echo "=========================================="

# ---- 1. System packages ----
echo "[1/9] Installing system packages..."
sudo apt-get update -y
sudo apt-get install -y \
  curl git build-essential \
  ffmpeg fonts-dejavu-core \
  ca-certificates gnupg \
  sqlite3 \
  ufw fail2ban
sudo mkdir -p /etc/apt/keyrings

# ---- 2. Node.js ----
echo "[2/9] Installing Node.js $NODE_VERSION..."
if ! command -v node &>/dev/null || [[ "$(node -v)" != v$NODE_VERSION* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "  node: $(node -v)"

# ---- 3. Bun ----
echo "[3/9] Installing Bun..."
if ! command -v bun &>/dev/null; then
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  # persist for non-interactive shells
  grep -q 'BUN_INSTALL' ~/.bashrc || echo "export BUN_INSTALL=\"\$HOME/.bun\"" >> ~/.bashrc
  grep -q 'BUN_INSTALL/bin' ~/.bashrc || echo "export PATH=\"\$BUN_INSTALL/bin:\$PATH\"" >> ~/.bashrc
fi
echo "  bun: $(bun --version 2>/dev/null || echo 'pending shell restart')"

# ---- 4. PM2 ----
echo "[4/9] Installing PM2..."
sudo npm install -g pm2@latest
echo "  pm2: $(pm2 --version)"

# ---- 5. Caddy (reverse proxy + auto-HTTPS) ----
echo "[5/9] Installing Caddy..."
if ! command -v caddy &>/dev/null; then
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update -y
  sudo apt-get install -y caddy
fi
echo "  caddy: $(caddy version 2>/dev/null | head -c 60)"

# ---- 6. App user + directory ----
echo "[6/9] Setting up app user + directory..."
if ! id "$APP_USER" &>/dev/null; then
  sudo useradd -m -s /bin/bash "$APP_USER"
fi
sudo mkdir -p "$APP_DIR"
sudo chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ---- 7. Firewall ----
echo "[7/9] Configuring firewall (ufw)..."
sudo ufw allow OpenSSH || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
sudo ufw --force enable || true

# ---- 8. Caddy config ----
echo "[8/9] Writing Caddyfile..."
sudo mkdir -p /etc/caddy
sudo tee /etc/caddy/Caddyfile > /dev/null <<CADDYEOF
$DOMAIN {
    reverse_proxy localhost:$APP_PORT
    encode gzip
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        X-XSS-Protection "1; mode=block"
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        Referrer-Policy no-referrer
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
    }
}
CADDYEOF
sudo systemctl reload caddy || sudo systemctl restart caddy
sudo systemctl enable caddy

# ---- 9. PM2 startup hook ----
echo "[9/9] Configuring PM2 startup..."
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" || true
sudo env PATH=$PATH:/usr/bin pm2 save || true

# ---- Backup cron ----
echo "[backup] Installing daily backup cron..."
sudo mkdir -p /home/aloedu/backups
CRON_LINE="0 3 * * * cd $APP_DIR && sqlite3 db/custom.db '.backup /home/aloedu/backups/db-\$(date +\%Y\%m\%d).db' && find /home/aloedu/backups -name 'db-*.db' -mtime +14 -delete"
( crontab -u "$APP_USER" -l 2>/dev/null; echo "$CRON_LINE" ) | sort -u | crontab -u "$APP_USER" -

# ---- Recovery sweep cron (every 5 min) ----
echo "[sweep] Installing recovery sweep cron (every 5 min)..."
SWEEP_LINE="*/5 * * * * curl -sf -X POST -H 'x-cron-secret: \${CRON_SECRET}' http://localhost:$APP_PORT/api/recovery/sweep?timeoutMinutes=10 >> /home/aloedu/sweep.log 2>&1"
( crontab -u "$APP_USER" -l 2>/dev/null; echo "$SWEEP_LINE" ) | sort -u | crontab -u "$APP_USER" -

echo ""
echo "=========================================="
echo "✅ VPS bootstrap complete"
echo ""
echo "Next steps (run as $APP_USER):"
echo "  cd $APP_DIR"
echo "  git clone <repo> ."
echo "  bun install"
echo "  cp .env.example .env  # fill in secrets"
echo "  bun run db:migrate:deploy"
echo "  bun run db:generate"
echo "  bun run build:prod"
echo "  pm2 start ecosystem.config.js"
echo "  pm2 save"
echo ""
echo "Domain: https://$DOMAIN"
echo "Health: https://$DOMAIN/api/health"
echo "=========================================="
