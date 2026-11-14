# Monitoring Guide

Covers SOP Phase 20 (Monitoring and Operations) items 20.01–20.20, plus
Phase 22.20 (Monitoring guide handover).

## Built-in monitoring endpoints

| Endpoint | Purpose | SOP ref |
|----------|---------|---------|
| `GET /api/health` | App + DB + binary checks | 20.02, 20.03 |
| `GET /api/health?details=1` | Detailed health (auth-gated) | 20.02 |
| `GET /api/openapi.json` | API surface inventory | 22.23 |
| `pm2 status` | Process health | 20.01 |
| `pm2 logs learn-aloeducation` | Application logs | 20.09 |

## Health check script

```bash
# Read-only — never starts/restarts PM2:
bash deploy/health-check.sh
```

Checks:
1. PM2 process `learn-aloeducation` is online (SOP 20.01)
2. Port 3017 is listening (SOP 20.08)
3. `/api/health` returns 200 (SOP 20.02)
4. RELEASE_SHA matches expected (SOP 20.19)
5. Public HTTPS endpoint responds (SOP 20.08)

## External uptime monitoring (SOP 20.01 — operator action)

Set up Uptime Kuma (self-hosted) or an external monitor against:
- `https://learn.alolabs.net/api/health` (200 expected)
- `https://learn.alolabs.net/` (200 or 301 expected)

Alert routing (SOP 20.17):
- Email: `ops@alolabs.net`
- Slack/Discord webhook (if configured)

## What to monitor

| SOP | Metric | How |
|-----|--------|-----|
| 20.03 | Database connectivity | `/api/health` (Database check) |
| 20.04 | Redis | N/A — Redis not used in this app |
| 20.05 | CPU | `node_exporter` + Prometheus, or `htop` |
| 20.06 | RAM | PM2 `max_memory_restart: 768M` — check `pm2 monit` |
| 20.07 | Disk | `df -h /home/aloedu` — alert at 80% |
| 20.09 | Error rate | Application logs + Sentry DSN (if configured) |
| 20.10 | API response time | `/api/health` timing; add APM for detail |
| 20.13 | SSL expiry | `certbot renew --dry-run` + alert at 14 days |
| 20.14 | Backup success | Cron log + manifest check |
| 20.16 | Admin activity | `audit_log` table in MySQL |

## Log rotation (SOP 20.19)

PM2 logs rotate via `pm2-logrotate` (operator-installed on the VPS):

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
```

## Incident escalation (SOP 20.18)

1. Alert fires (Uptime Kuma / Sentry)
2. On-call engineer acknowledges within 15 min
3. Diagnose via `deploy/health-check.sh` + `pm2 logs`
4. If DB-related: check `mysql -e "SHOW PROCESSLIST;"` + slow query log
5. If app crash: `pm2 restart learn-aloeducation --update-env`
6. If deploy-related: follow `deploy/docs/ROLLBACK_GUIDE.md`
7. Document incident in `audit/` after resolution

## Maintenance schedule (SOP 20.20)

| Frequency | Task |
|-----------|------|
| Daily | Backup success check (cron 02:00) |
| Weekly | `df -h`, `pm2 monit`, log size review |
| Monthly | Dependency security scan (`npm audit`) |
| Monthly | Restore drill on staging (see RESTORE_GUIDE.md) |
| Quarterly | Full DR drill (RESTORE_GUIDE.md §"Disaster recovery") |
| Annually | TLS rotation, credential rotation, dependency upgrades |
