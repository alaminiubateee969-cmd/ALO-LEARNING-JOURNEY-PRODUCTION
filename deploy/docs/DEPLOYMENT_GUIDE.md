# Production Deployment Guide — Not Yet Authorized

This document describes the intended guarded workflow; it is not evidence that the VPS or release is ready. Current blockers and operator-provided settings are in [`DEPLOYMENT.md`](../../DEPLOYMENT.md). Do not run these steps until the production backup restore, schema/history reconciliation, CI, and human approvals are complete.

## Exact target (operator-provided; verify read-only on host)

- App root: `/home/aloedu/LEARNING-JOURNEY`
- PM2 process: `learn-aloeducation`
- Port: `3017`
- Domain: `https://learn.aloeducation.com`
- Database: MySQL `db_learn` at `127.0.0.1:3306`
- Runtime: Node.js 22.x; npm; no Bun/SQLite production path

The deployment script refuses a different path, PM2 process name, or port. It also requires an already healthy `current` release and an already-online PM2 process. If PM2 is absent or empty, deployment stops; this script does not start an unknown process.

## Required GitHub configuration (after go/no-go approval)

Use GitHub Actions **Secrets** for SSH private key, verified SSH host key, deploy user/host, and scoped Tailscale credentials. Use **Variables** only for non-secret release evidence and target values. Never commit secrets, `.env`, database dumps, or private keys.

The deploy workflow requires green CI, an approved protected `production` Environment, the exact release SHA, exact target values, and non-secret references to the completed restore test and schema/history preflight. Pending migrations additionally require an exact-SHA-approved migration plan. Leave `VPS_DEPLOY_ENABLED` unset until those conditions are met.

## Deployment order implemented by the script

1. Verify exact release SHA, target path/name/port, and existing PM2/current release.
2. Build the exact commit before any migration or restart.
3. Preserve runtime-written media and create/checksum database and media backups.
4. Verify baseline and `_prisma_migrations` names/checksums; stop on unknown or inconsistent history.
5. Run migrations only for a checksum-verified, restored-copy-rehearsed, ordered pending suffix with explicit approval.
6. Atomically switch the release pointer, reload only the existing PM2 process, and require local health with the exact SHA.
7. Keep the prior known-good release. The workflow then verifies public HTTPS health reports the same SHA.

A code rollback does not reverse database DDL. The public health step does not automatically roll back. See [`ROLLBACK_GUIDE.md`](./ROLLBACK_GUIDE.md).

## Safe preflight

`deploy/vps-bootstrap.sh` is now read-only. It reports missing tools, the process state, port, release markers, memory, and disk. It does not install packages, change firewall/proxy/ownership, create services, migrate databases, or start PM2. Use it only after the target host has been independently verified.

Do not copy historical commands using Bun, SQLite, `pm2 --name alo`, or direct `prisma migrate deploy`; those instructions are obsolete for this MySQL/Node 22 deployment.
