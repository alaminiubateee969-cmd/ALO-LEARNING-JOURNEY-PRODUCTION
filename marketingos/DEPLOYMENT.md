# MarketingOS — Production Deployment Guide

Enterprise AI Workforce Platform
Next.js 16 + React 19 + TypeScript + Prisma + SQLite

---

## Architecture

```
Internet
   ↓
HTTPS :443
   ↓
Reverse Proxy (Caddy 2 / Nginx)
   ↓
Next.js Production Server (port 3100)
   ↓
Prisma ORM
   ↓
SQLite Database (file-based)
```

**Real-time service** (optional): Socket.io on port 3004 with push API on port 3005.

---

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| OS | Ubuntu 22.04 LTS / Debian 12 | Ubuntu 24.04 LTS |
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Disk | 5 GB SSD | 20 GB SSD |
| Node.js | 22.x | 24.x |
| Bun | 1.1.x | 1.2.x |

---

## Step 1: Install Prerequisites

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Verify
bun --version
node --version  # should be 22+ or 24+
```

---

## Step 2: Upload and Extract Source

```bash
# Upload the release archive to /opt/marketingos/
scp marketingos-release.tar.gz your-server:/opt/marketingos/

# Extract
ssh your-server
cd /opt/marketingos
tar xzf marketingos-release.tar.gz --strip-components=1
```

---

## Step 3: Configure Environment

```bash
cd /opt/marketingos

# Create .env from template
cp .env.example .env

# Generate secrets
JWT_SECRET=$(openssl rand -hex 32)
PUSH_SECRET=$(openssl rand -hex 32)

# Set values
sed -i "s/^DATABASE_URL=$/DATABASE_URL=file:/opt/marketingos/data/marketingos.db/" .env
sed -i "s/^JWT_SECRET=$/JWT_SECRET=$JWT_SECRET/" .env
sed -i "s/^PUSH_SECRET=$/PUSH_SECRET=$PUSH_SECRET/" .env
sed -i "s/^NODE_ENV=$/NODE_ENV=production/" .env

# Secure the file
chmod 600 .env

# Create data directory
mkdir -p /opt/marketingos/data

# Verify no placeholder values remain
grep -E '^(DATABASE_URL|JWT_SECRET|NODE_ENV)=$' .env && echo 'FAIL: empty values' || echo 'OK'
```

---

## Step 4: Install Dependencies and Generate Prisma Client

```bash
cd /opt/marketingos
bun install --frozen-lockfile
bun run db:generate
```

---

## Step 5: Database Setup

```bash
cd /opt/marketingos

# Push schema to create/verify database
bun run db:push

# Seed initial data (users, tools, employees, departments)
bun run db:seed
```

> **Note:** `db:push` is safe for SQLite — it creates tables without data loss.
> The seed script is idempotent (uses upsert). Running it again is safe.

---

## Step 6: Production Build

```bash
cd /opt/marketingos
bun run build
```

Expected output: `✓ Compiled successfully` with 55+ routes.

The build produces a standalone server at `.next/standalone/server.js`.

---

## Step 7: Start the Application

### Option A: Direct (testing)

```bash
cd /opt/marketingos
NODE_ENV=production bun .next/standalone/server.js
```

### Option B: systemd (recommended for production)

Create `/etc/systemd/system/marketingos.service`:

```ini
[Unit]
Description=MarketingOS
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/marketingos
EnvironmentFile=/opt/marketingos/.env
ExecStart=/root/.bun/bin/bun .next/standalone/server.js
Restart=always
RestartSec=5
TimeoutStartSec=30
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable marketingos
sudo systemctl start marketingos

# Verify
sudo systemctl status marketingos
journalctl -u marketingos -n 20 --no-pager
```

### Option C: PM2 (alternative)

```bash
cd /opt/marketingos
pm2 start .next/standalone/server.js --name marketingos --env production
pm2 save
pm2 startup
```

---

## Step 8: Reverse Proxy

### Caddy 2 (recommended — automatic HTTPS)

`/etc/caddy/Caddyfile`:

```
marketingos.yourdomain.com {
    reverse_proxy localhost:3100

    # Security headers
    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### Nginx (alternative)

`/etc/nginx/sites-available/marketingos`:

```nginx
server {
    listen 80;
    server_name marketingos.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name marketingos.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/marketingos.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/marketingos.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Block internal paths
    location ~ /\. { deny all; }
}
```

---

## Step 9: DNS Configuration

1. Create an A record: `marketingos.yourdomain.com` → your server IP
2. Wait for DNS propagation (up to 48 hours, usually minutes)
3. Verify: `dig marketingos.yourdomain.com`

---

## Step 10: Health Check

```bash
# Internal
curl -s http://localhost:3100/api/health
# Expected: {"status":"ok","timestamp":"..."}

# External (via reverse proxy)
curl -s https://marketingos.yourdomain.com/api/health

# Verify SEO
curl -sI https://marketingos.yourdomain.com/robots.txt
# Expected: HTTP 200, Content-Type: text/plain

curl -sI https://marketingos.yourdomain.com/sitemap.xml
# Expected: HTTP 200, Content-Type: application/xml
```

---

## Default Login Credentials

After seeding, the default admin account is:

- **Email:** `admin@marketingos.com`
- **Password:** `admin123`

> **IMPORTANT:** Change this password immediately after first login.

---

## Data Counts (after seeding)

| Entity | Count |
|--------|-------|
| Users | 7 |
| Companies | 2 |
| AI Employees | 2,000 |
| Departments | 54 |
| Tool Integrations | 120 |
| Tool Categories | 27 |

---

## Updating

```bash
cd /opt/marketingos

# 1. Backup
cp -a data/marketingos.db data/marketingos.db.backup.$(date +%Y%m%d%H%M%S)

# 2. Upload new source and extract
# 3. Install
bun install --frozen-lockfile

# 4. Database migration
bun run db:push

# 5. Build
bun run build

# 6. Restart
sudo systemctl restart marketingos

# 7. Verify
curl -s http://localhost:3100/api/health
```

## Rollback

```bash
sudo systemctl stop marketingos
cp -a data/marketingos.db.backup.TIMESTAMP data/marketingos.db
sudo systemctl start marketingos
```

---

## Backup Procedure

### Database

```bash
# Manual
cp /opt/marketingos/data/marketingos.db /opt/backups/marketingos-$(date +%Y%m%d).db

# Automated (cron — run as root)
echo '0 3 * * * cp /opt/marketingos/data/marketingos.db /var/backups/marketingos/marketingos-$(date +\%Y\%m\%d).db' | sudo tee /etc/cron.d/marketingos-backup
sudo mkdir -p /var/backups/marketingos
```

---

## Log Locations

| Source | Command |
|--------|---------|
| Application (systemd) | `journalctl -u marketingos -f` |
| Application (PM2) | `pm2 logs marketingos` |
| Reverse proxy (Caddy) | `journalctl -u caddy -f` |
| Reverse proxy (Nginx) | `tail -f /var/log/nginx/access.log` |

---

## Security Checklist

- [ ] `JWT_SECRET` set to a random 64-char hex value
- [ ] `PUSH_SECRET` set to a random 64-char hex value
- [ ] `.env` file has `chmod 600` permissions
- [ ] Default admin password changed
- [ ] HTTPS enabled via reverse proxy
- [ ] Firewall allows only ports 22, 80, 443
- [ ] Database file not accessible via web
- [ ] `NODE_ENV=production` set

---

## Port Reference

| Port | Service | Exposure |
|------|---------|----------|
| 3100 | Next.js production | localhost only |
| 3004 | Socket.io real-time | localhost only |
| 3005 | Push API | localhost only |
| 80/443 | Reverse proxy | public |
