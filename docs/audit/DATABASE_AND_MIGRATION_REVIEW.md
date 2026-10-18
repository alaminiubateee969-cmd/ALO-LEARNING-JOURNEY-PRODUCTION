# Database and migration review — 2026-10-18

## Findings

- Prisma datasource: MySQL (`prisma/schema.prisma`). No PostgreSQL configuration is declared in the checked-in schema.
- Schema includes 42 models, including `Company`, `AIAgentRun`, `AdminOtpChallenge`, content/approval/RAG/analytics records, `Department`, `AgentEmployee`, CRM records, media, voice, and avatar records.
- Five checked-in migration directories exist: initial baseline, avatar ownership, admissions quotes, OTP challenges, and `20261018000000_v2_additive_mysql_tables`.
- Tests include static migration chain/table coverage and deploy-safety checks (`tests/migration-verifier.test.mjs`, `tests/prisma-history.test.mjs`, `tests/deploy-script-safety.test.mjs`).
- `npm test` passed 59/59 tests in this checkout.
- No production `DATABASE_URL`, production database connection, `_prisma_migrations` history, live schema, backup artifact, or restore was accessed in this audit.

## Classification

| Area | Status | Evidence / limitation |
|---|---|---|
| Prisma schema in source | WORKING (static) | `prisma/schema.prisma` parses/build passes; 42 model declarations. |
| Migration files | PARTIAL | Five migrations are checked in; this does not prove they were applied to any live database. |
| Migration coverage | WORKING (static tests) | Static migration test passes; it compares repository artifacts, not the production database. |
| Production migration state | UNVERIFIED | No production DB access or migration history inspection. |
| Destructive change review | PARTIAL | Current v2 migration is designed as additive by prior static review; conduct a new SQL review and disposable restore test before applying. |
| Backup/restore | UNVERIFIED | Backup endpoint/scripts exist; no verified artifact or restoration evidence in the current audit. |
| New AgentOS persistence | MISSING | Current AgentOS catalogs are virtual/code-generated; no Task/TaskStep/Skill model or migration was added. |

## Required safe next steps

1. Obtain owner-authorized access to the exact production DB and identify its host/database without exposing credentials in logs.
2. Take and checksum a fresh backup; retain current release and rollback target.
3. Restore the backup to an isolated disposable database and record restore time, row counts, and migration history.
4. Compare live schema and `_prisma_migrations` checksums to this exact checkout/release SHA.
5. Review any proposed schema changes with a reviewed migration and integration tests on the restored copy.
6. Do not run `db push`, reset, or production migration commands from this sandbox. Existing `scripts/prisma-dev-guard.mjs` blocks unsafe local/production schema commands; respect it.

## Non-goals

The user-specified SQLite `agentos.db` is not being introduced alongside the existing MySQL/Prisma source of truth. That would duplicate identity, task, approval, memory and audit data. Any future DB extension should reuse the existing architecture and ship additive, verified migrations rather than create a disconnected second database.
