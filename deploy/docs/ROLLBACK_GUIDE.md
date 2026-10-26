# Rollback and Recovery Guide

**Do not use this guide to alter production until the live release layout, backup, database history, and PM2 process are independently verified.** The user-reported PM2 list is empty; no deploy or rollback script may assume it can start a missing process.

## Automatic code rollback

`scripts/deploy-production.sh` keeps the previous healthy release and rolls the `current` pointer back if PM2 reload/save or the local exact-SHA health check fails. The rollback reloads only an already registered, online PM2 process named `learn-aloeducation`. If the process is missing, the script stops and requires manual, separately approved recovery.

The later public-domain HTTPS check is performed by the workflow. If that check fails, the workflow fails but does not automatically roll back. Investigate and authorize any recovery explicitly.

## Database is not rolled back automatically

A code rollback does **not** undo MySQL migrations. Never run old SQLite snippets, `DROP COLUMN`, `DROP INDEX`, `TRUNCATE`, `prisma migrate reset`, or ad-hoc reverse SQL. Preserve the database and evidence; consult the migration recovery plan and obtain a separate reviewed data-preserving correction plan.

Before an authorized migration/deployment, the required backup must have been restored successfully to an isolated MySQL instance and the exact migration suffix rehearsed. The deploy archive integrity check is not a restore test.

## First-install / missing PM2 process

The existing deploy path does not bootstrap or start the app. If PM2 is missing, empty, or unhealthy, stop. Perform a read-only inventory and prepare a separately reviewed first-install plan. Do not run `pm2 start`, `pm2 resurrect`, or bootstrap scripts as a workaround.

## Recovery evidence

For any incident, preserve the exact release SHA, logs, health responses, backup identifier/checksum, `_prisma_migrations` inventory, and media inventory in the approved private operational record. Never copy secrets, database rows, or a production dump into Git or chat. Do not delete media or database records during recovery without an explicit retention/restore decision.

See [`DEPLOYMENT.md`](../../DEPLOYMENT.md) and [`MIGRATION-RECOVERY-PLAN.md`](../../MIGRATION-RECOVERY-PLAN.md) for the required gates.
