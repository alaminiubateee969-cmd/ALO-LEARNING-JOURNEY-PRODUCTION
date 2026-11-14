# Restore Guide

Covers SOP Phase 21.10 (Restore drill) and 21.11–21.17 (Disaster recovery
procedures), plus Phase 22.18 (Restore guide handover).

## Prerequisites

- SSH access to the VPS as `aloedu` (or equivalent deploy user)
- The latest backup set in `/home/aloedu/LEARNING-JOURNEY/shared/.backups/`
- MySQL credentials from `.env` (the `DATABASE_URL` connection string)

## Step 1: Stop the application (SOP 21.12)

```bash
pm2 stop learn-aloeducation
```

This prevents writes during restore and avoids partial-data requests.

## Step 2: Restore the database (SOP 21.12)

```bash
cd /home/aloedu/LEARNING-JOURNEY/shared/.backups
# Pick the backup to restore (latest by default):
DUMP=$(ls -t db_learn_*.sql.gz | head -1)
echo "Restoring: $DUMP"

# Verify integrity first:
sha256sum -c manifest_$(echo $DUMP | grep -oP '\d{8}_\d{6}').txt

# Decompress and restore:
DB_URL=$(grep '^DATABASE_URL=' /home/aloedu/LEARNING-JOURNEY/current/.env | cut -d'"' -f2)
gunzip -c "$DUMP" | mysql "$DB_URL"
```

## Step 3: Restore uploaded media (SOP 21.11)

```bash
cd /home/aloedu/LEARNING-JOURNEY/shared/.backups
MEDIA=$(ls -t media_*.tar.gz | head -1)
echo "Restoring media: $MEDIA"

# Restore to the app's public directory:
tar -xzf "$MEDIA" -C /home/aloedu/LEARNING-JOURNEY/current/public/
```

## Step 4: Restore the application (SOP 21.13)

If the application code is also lost, restore from the last known-good release:

```bash
cd /home/aloedu/LEARNING-JOURNEY/current
git fetch origin
git checkout <last-known-good-SHA>   # see RELEASE_SHA file
npm ci && npm run build:prod
pm2 restart learn-aloeducation --update-env
```

## Step 5: Verify (SOP 21.10)

```bash
# Health check:
bash deploy/health-check.sh

# Manual smoke test:
curl -s https://learn.alolabs.net/api/health | head -5
curl -sI https://learn.alolabs.net/ | head -3
```

## Recovery time objective (RTO) — SOP 21.15

| Scenario | Target RTO |
|----------|-----------|
| Database-only restore (corrupt row) | 15 min |
| Full media restore | 30 min |
| Full server rebuild | 2–4 hours |
| DNS failover to standby | 1 hour (operator action) |

## Recovery point objective (RPO) — SOP 21.16

With daily 02:00 backups: **RPO = 24 hours** (worst case).
For lower RPO, increase cron frequency to hourly for the DB dump only.

## Rollback to previous release (SOP 21.14)

The deploy uses exact-SHA releases. To roll back:

```bash
cd /home/aloedu/LEARNING-JOURNEY
# The current release is a symlink; point it at the previous SHA:
PREV_SHA=$(cat shared/.releases/previous.txt)
bash deploy/app-deploy.sh --sha "$PREV_SHA"
```

## Disaster recovery procedure (SOP 21.11)

Full server loss (the worst case):

1. Provision a new VPS (Ubuntu 24.04+, 2 vCPU / 4 GB RAM minimum)
2. Run `deploy/vps-bootstrap.sh` (read-only preflight) to verify prerequisites
3. Install Node.js 22, PM2, MySQL 8, Nginx, ffmpeg
4. Clone the repo, checkout the last known-good SHA
5. Restore `.env` from secrets vault (NEVER from a backup file)
6. Restore the database from the latest off-server backup
7. Restore media from the latest off-server backup
8. Re-issue TLS certificates: `certbot --nginx -d learn.alolabs.net`
9. Start PM2: `pm2 start ecosystem.config.js --env production`
10. Run `deploy/health-check.sh` to verify

## Restore drill (SOP 21.10 — recommended quarterly)

Test the restore on a **staging** server (never production):

```bash
# On a throwaway VM:
scp aloedu@prod:/home/aloedu/LEARNING-JOURNEY/shared/.backups/latest/db_learn_*.sql.gz .
mysql -e "CREATE DATABASE db_learn_restore;"
gunzip -c db_learn_*.sql.gz | mysql db_learn_restore
# Verify row counts match:
mysql -e "SELECT COUNT(*) FROM db_learn_restore.Company;"
mysql -e "SELECT COUNT(*) FROM db_learn_restore.Lead;"
```
