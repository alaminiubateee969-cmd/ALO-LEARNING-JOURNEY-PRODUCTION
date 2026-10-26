# MySQL Database and Migration Guide

## Production data policy

Production remains MySQL. Preserve all existing users, records, permissions, stored media, and relationships. Do not switch production to SQLite, rewrite applied migration history, run destructive SQL, or apply a migration before the live schema/history have been reviewed against a verified backup restored to an isolated MySQL instance.

Never run `prisma migrate reset`, `prisma migrate dev`, `prisma db push`, `DROP`, or `TRUNCATE` against production. Do not use migration commands as a substitute for inspecting schema and migration history.

## Operator-provided database target (not verified)

- MySQL schema: `db_learn`
- Host/port: `127.0.0.1:3306`
- Production application: `/home/aloedu/LEARNING-JOURNEY`

Do not print or paste `DATABASE_URL`, credentials, SQL rows, or full dumps. Use the approved secret manager and least-privilege accounts.

## Checked-in migrations

1. `20261001000000_initial_baseline`
2. `20261007000000_human_avatar_ownership`
3. `20261010000000_admissions_crm_quotes`
4. `20261010000001_admin_otp_challenges`
5. `20261018000000_v2_additive_mysql_tables`

The checked-in schema currently has 42 Prisma models plus one implicit relation table. `npm run verify:migrations` is static verification only; it does not establish production compatibility or history.

Keep the admissions CRM (`Lead`, `LeadActivity`, `Quotation`, `QuotationItem`) separate from the marketing CRM (`MarketingLead`, `MarketingCampaign`). Preserve existing admin OTP challenge data and generic OTP request data separately. The generic OTP route is currently disabled; no simulated OTP should be generated or returned.

The human-avatar migration was changed from the incoming SQLite form to MySQL DDL, which changes its checksum. If production history records a different checksum or avatar tables/data already exist, stop and prepare a reviewed restored-copy reconciliation; do not edit applied migration history or mark the migration applied based only on table names.

## Required baseline reconciliation and rehearsal

Follow [`MIGRATION-RECOVERY-PLAN.md`](../../MIGRATION-RECOVERY-PLAN.md) before any production operation. At a minimum:

1. Capture a private, read-only inventory of all production tables, columns, defaults, indexes, foreign keys, views/triggers as relevant, engine/version, and `_prisma_migrations` entries/checksums.
2. Take a complete verified backup, store it outside Git with restrictive permissions, and restore it to a new isolated compatible MySQL instance.
3. Compare every existing table and relationship to the checked-in schema/migrations. Account for existing data and all CRM/OTP relationships.
4. On the disposable restored copy only, rehearse baseline reconciliation. Use `prisma migrate resolve --applied 20261001000000_initial_baseline` only after every baseline object is proven to match; if objects are missing, rehearse only the reviewed additive SQL on the disposable copy. `IF NOT EXISTS` does not repair a wrong table shape.
5. Inspect each later migration target independently. Apply only the exact checksum-verified ordered pending suffix on the restored copy, then verify schema, history, data preservation, auth, CRM, OTP, health, and key routes. Restore the backup again and repeat from a clean state.
6. Record exact release SHA, migration checksums, restore evidence, inventory comparison, and approvals outside the repository.

No such production-backup restore or migration rehearsal has been completed in this repair. Never treat the static verifier, compressed dump integrity, or a successful `migrate status` as substitute evidence.

## Deployment guardrails

The production deploy path requires an already reconciled baseline and refuses empty, failed, rolled-back, unknown, out-of-order, checksum-mismatched, or non-suffix history. It requires backup/restore and schema-preflight evidence tied to the exact release SHA. It runs migration deploy only for an approved, rehearsed pending suffix. Code rollback does not roll back database DDL.

See [`DEPLOYMENT.md`](../../DEPLOYMENT.md) for GitHub Environment and VPS gates. Leave `VPS_DEPLOY_ENABLED` unset until the restore and schema/history work is approved.
