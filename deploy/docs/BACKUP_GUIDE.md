# Backup Guide

Covers SOP Phase 21 (Backup, Disaster Recovery and Rollback) items 21.01–21.08
and Phase 22.17 (Backup guide handover).

## What is backed up

| Asset | Mechanism | Script |
|-------|-----------|--------|
| MySQL database (`db_learn`) | `mysqldump` → gzip | `deploy/backup.sh` |
| Uploaded media (avatars, videos, audio, scenes) | `tar` archive | `deploy/backup.sh` |
| Application `.env` | **excluded** — never copied (contains secrets) | — |
| Release artifacts (git SHAs) | Git history + `RELEASE_SHA` file | `deploy/app-deploy.sh` |
| Nginx config | `/etc/nginx/sites-available/learn-aloeducation` | manual (`sudo cp`) |

## Backup script

```bash
# Run from the VPS as the deploy user (sudo NOT required for app backups).
# The script is read-only on .env and never prunes old backups.
APP_DIR=/home/aloedu/LEARNING-JOURNEY bash deploy/backup.sh
```

Output: `$APP_DIR/shared/.backups/` with:
- `db_learn_YYYYMMDD_HHMMSS.sql.gz` — compressed database dump
- `media_YYYYMMDD_HHMMSS.tar.gz` — uploaded media archive
- `manifest_YYYYMMDD_HHMMSS.txt` — SHA-256 checksums of every archive

## Schedule (SOP 21.01)

Install via cron on the VPS (operator action — not committed to the repo):

```bash
# Daily 02:00 local — database + media
0 2 * * * APP_DIR=/home/aloedu/LEARNING-JOURNEY /home/aloedu/LEARNING-JOURNEY/current/deploy/backup.sh >> /home/aloedu/LEARNING-JOURNEY/shared/logs/backup.log 2>&1
```

## Backup integrity (SOP 21.09)

`deploy/backup.sh` writes a SHA-256 manifest for every archive. Verify:

```bash
cd /home/aloedu/LEARNING-JOURNEY/shared/.backups
sha256sum -c manifest_*.txt
```

## Off-server backup (SOP 21.06)

The on-server backup is NOT off-server. To protect against server loss:

```bash
# Pull the latest backup to a separate machine (operator action):
scp aloedu@<vps>:/home/aloedu/LEARNING-JOURNEY/shared/.backups/latest/ ./alo-backups/
# Or push to S3-compatible storage:
aws s3 sync /home/aloedu/LEARNING-JOURNEY/shared/.backups/ s3://alo-backups/$(date +%Y%m%d)/
```

## Backup encryption (SOP 21.07)

The `.sql.gz` and `.tar.gz` archives are NOT encrypted at rest on the server.
The server disk should be encrypted (LUKS) at the OS level. For off-server
copies, encrypt before transfer:

```bash
gpg --symmetric --cipher-algo AES256 db_learn_*.sql.gz
```

## Retention (SOP 21.08)

The backup script does **not** prune. Retention is operator-controlled:

```bash
# Keep 7 daily + 4 weekly + 12 monthly (operator-installed cron):
find /home/aloedu/LEARNING-JOURNEY/shared/.backups -name "db_learn_*.sql.gz" -mtime +90 -delete
```

## What is NOT backed up (operator action required)

- `.env` file — regenerate from `.env.example` + secrets vault
- TLS certificates — re-issue with `certbot --nginx`
- PM2 process list — `pm2 save` + `pm2 resurrect`
- Nginx config — keep a copy outside the repo
- MySQL root credentials — store in a password manager
