# Production Database / Migration Recovery Plan

**Status: PREPARATION ONLY — not executed.** Production database access, the live
schema, `_prisma_migrations` history/checksums, the reported missing tables, and
any backup are unverified. Do not run a migration, `migrate resolve`, schema
repair, or production write based only on this document.

Operator-provided (not independently verified) configuration: MySQL schema
`db_learn` at `127.0.0.1:3306`; app root `/home/aloedu/LEARNING-JOURNEY`;
PM2 process `learn-aloeducation`; port `3017`; public domain
`learn.aloeducation.com`. The operator reported 22 existing model tables, a
32-model legacy application expectation, an empty PM2 process list, and VPS
capacity of 6.5 GiB RAM / 370 GB disk. None of these facts has been checked on
the VPS from this workspace.

## Safety rules

- Preserve every production row, user, permission, and stored file.
- Never run `prisma migrate reset`, `prisma migrate dev`, `prisma db push`,
  `DROP`, `TRUNCATE`, or destructive SQL against production.
- Do not treat a successful `gzip -t`, a `migrate status` message, or this
  repository's static migration check as proof of a restorable backup or live
  schema parity.
- Do not invent or generate a replacement migration until the actual schema and
  migration history have been captured and compared.
- Perform the full test first against a disposable isolated MySQL instance
  restored from a verified backup. No production migration without written
  approval after that test.
- Never paste or log production `DATABASE_URL`, passwords, tokens, database
  rows, or full backup contents.

## Checked-in migration chain (repository evidence only)

The repair branch now contains five MySQL migration directories:

| Migration | Tables declared | Important property |
|---|---|---|
| `20261001000000_initial_baseline` | 27 core Prisma model tables plus `_FamilyProfileToFamilyProject` | Uses `CREATE TABLE IF NOT EXISTS`; this does not prove existing table columns or constraints match. Its historical header says “26 core”; do not edit the file until its recorded checksum is checked. |
| `20261007000000_human_avatar_ownership` | `HumanAvatar`, `AvatarVideo` | The upstream version used SQLite syntax. This repair replaces it with MySQL DDL; compare the original/recorded checksum and actual schema on the restored copy before resolving or applying it. `AvatarVideo` restricts avatar deletion to preserve linked video rows. |
| `20261010000000_admissions_crm_quotes` | `Lead`, `LeadActivity`, `Quotation`, `QuotationItem` | Plain `CREATE TABLE`; retains the legacy admissions relation and fails if a target table already exists and is not recorded as applied. |
| `20261010000001_admin_otp_challenges` | `AdminOtpChallenge` | Plain `CREATE TABLE`; stores keyed hashes and fails if the target table already exists and is not recorded as applied. |
| `20261018000000_v2_additive_mysql_tables` | `Client`, `Project`, `Invoice`, `MarketingCampaign`, `MarketingLead`, `OtpRequest`, `VoiceGeneration`, `AudioTranscription` | Additive MySQL tables. `MarketingLead` is separate from admissions `Lead`; `OtpRequest` schema stores keyed hashes and a masked recipient label. |

Static verification maps these migrations to 42 Prisma models plus one implicit
relation table. Static verification checks model/table names and selected
SQLite/destructive-SQL patterns; it does not prove live schema, data,
columns/types, defaults, indexes, foreign keys, or recorded Prisma checksums.
The SQLite-to-MySQL rewrite of the human-avatar migration changes its checksum;
if the original checksum is recorded or any avatar tables/data already exist,
stop for an explicit restored-copy reconciliation plan rather than running or
resolving it automatically. The reported 22 existing model tables, legacy
admissions/OTP tables, and pending migration count are user-reported and not
independently verified.

## Phase A — read-only production inventory

Have the production operator identify the exact database used by the running
app through the approved secret manager and the current process configuration.
Do not print the connection string. Confirm the target host/schema separately
from any staging or historical database. Record MySQL version, character set,
collation, and whether any migration process is currently running.

Using a least-privilege read-only connection, capture privately:

1. All table names and table types from `INFORMATION_SCHEMA.TABLES` for the
   target schema.
2. For every table, all columns in ordinal order with type, nullability,
   default, charset/collation, generated status, and extra attributes from
   `INFORMATION_SCHEMA.COLUMNS`.
3. Primary/unique/ordinary indexes and their column order from
   `INFORMATION_SCHEMA.STATISTICS`.
4. Foreign keys and referenced columns from
   `INFORMATION_SCHEMA.KEY_COLUMN_USAGE` and `REFERENTIAL_CONSTRAINTS`.
5. Views, triggers, routines, events, and table engines where applicable.
6. `_prisma_migrations`, if it exists: every migration name, checksum,
   `started_at`, `finished_at`, `rolled_back_at`, and `logs`. Keep this output
   private; redact any values that could disclose data or credentials.
7. Compare each recorded checksum to the corresponding checked-in
   `prisma/migrations/<name>/migration.sql` file's SHA-256. Do not edit a
   migration file already recorded as applied.

Do not infer a migration is pending merely because a table is missing; inspect
history and the schema together. Do not assume the production database is empty
or that only the reported CRM/OTP tables are absent. Treat the admissions
`Lead`/`LeadActivity`/`Quotation` records and their `Company` relationship as
legacy data; `MarketingLead` is a separate new table and must never be used as a
replacement or rename target. Check the existing hashed `AdminOtpChallenge`
records separately from the newer generic `OtpRequest` table; do not export raw
OTP values or mark either migration applied based only on table names.

## Phase B — backup and isolated restore test

1. Take a complete database backup using the approved secret handling and a
   consistent snapshot method appropriate to the actual MySQL engine. Include
   schema and data, triggers, routines, events, and binary columns as required.
2. Store it outside the repository with restrictive permissions. Record the
   backup identifier, UTC creation time, database engine/version, byte size,
   and SHA-256. Never attach or commit the dump.
3. Check the compressed archive (`gzip -t`) and confirm it contains schema
   statements. These checks are necessary, not sufficient.
4. Restore it to a newly provisioned, disposable, isolated MySQL instance with
   the compatible engine/version. Do not restore over production or an existing
   staging database. Validate that the restore completed and that representative
   table counts and constraints agree with the captured inventory.
5. Record the restore result and backup identifier in the approved operational
   record. The deploy workflow requires `VPS_RESTORE_TEST_SHA` equal to the
   exact release commit and a non-secret `VPS_RESTORE_TEST_REFERENCE`; that
   reference is an operator attestation, not an automatic proof.

## Phase C — rehearse migration state on the restored copy

On the disposable restore only:

1. Run `npx prisma migrate status` and preserve its output with the rehearsal
   record. Inspect any failure code/message. Do not automatically interpret a
   non-zero result as a list of safely applicable migrations.
2. Compare the live/restored schema table-by-table to the checked-in schema and
   migration SQL. Include data-preserving checks for existing CRM/OTP-like
   tables even if Prisma history does not mention them.
3. If `_prisma_migrations` is absent or incomplete, stop and determine whether
   this database was historically managed with `db push`, a different migration
   lineage, or a manual schema. A non-empty database can require baselining; do
   not let `migrate deploy` decide this for production.
4. If every baseline table and constraint already matches, rehearse marking the
   baseline as applied on the disposable restore with
   `npx prisma migrate resolve --applied 20261001000000_initial_baseline`.
   `migrate resolve` changes migration metadata only; it does not create or
   repair tables. Never use it while any baseline table is absent or mismatched.
5. If a baseline table is absent, first prove all existing baseline tables
   match exactly. On the disposable restore only, rehearse executing the
   checked-in `prisma/migrations/20261001000000_initial_baseline/migration.sql`
   (its statements use `CREATE TABLE IF NOT EXISTS`) to add the missing tables,
   then verify the full baseline and mark it applied with `migrate resolve`.
   `IF NOT EXISTS` does not repair an existing table with the wrong shape. If a
   mismatch is found, stop and prepare a separately reviewed additive correction.
   After a successful isolated rehearsal, the same ordered operation on
   production would require a separate explicit authorization; it is not
   performed by this audit or deploy script.
6. For the CRM and OTP migrations, inspect each target table independently. If
   absent, let the migration create it on the disposable copy. If present,
   compare it fully: only after it is proven identical and its data is accounted
   for may that migration be marked applied on the disposable copy. If partially
   present or structurally different, stop. Never mark a migration applied just
   to make status green.
7. Apply the exact pending migration suffix on the disposable copy with
   `npx prisma migrate deploy` only after the avatar migration checksum and
   existing avatar/OTP/admissions schemas have been reconciled. Run
   `node scripts/verify-prisma-history.mjs <private-history.tsv> prisma/migrations`
   against the captured `_prisma_migrations` rows before proceeding. Verify all
   42 model tables plus the implicit relation, every column/type/default/index/FK,
   no failed migration row, and preservation of pre-existing data. Run the
   application's relevant auth, admissions CRM, marketing CRM, OTP, health,
   and API checks against the disposable copy.
8. Restore the same original backup again and repeat the rehearsal from a clean
   restore. Record exact repository commit, migration file checksums, database
   version, commands, before/after schema inventories, and outcomes.

The CI workflow applied the five migrations twice to a fresh disposable MySQL 8 service, checked migration status, and compared model tables/columns on candidate commit `2453def298cb4fe45dd70cfe8897d5aefd59f457`; the `CI / validate` job passed. This is useful fresh-database coverage, but it is not a substitute for the required restored production-schema rehearsal. No production backup was restored and no production migration was attempted.

## Phase D — production go/no-go (manual, after all evidence)

Proceed only when all of the following are true:

- A complete verified backup exists and an isolated restore succeeded.
- The production database/schema and `_prisma_migrations` rows/checksums are
  captured and reviewed.
- The exact plan was rehearsed successfully on the disposable restored copy.
- Every existing table's data and schema are reconciled; no destructive action
  or unreviewed migration is needed.
- The candidate commit's CI passes, the production path is confirmed read-only,
  and a human reviewer authorizes the release.

The initial baseline must first be reconciled on a restored copy and recorded
as applied with its exact checked-in checksum. The deployment script refuses an
empty history or pending baseline; it does not apply or resolve that migration.
If later migrations remain pending, set GitHub variable `VPS_MIGRATION_PLAN_SHA`
to the exact approved commit SHA **only for the authorized run**. The deployment
script may accept only a checksum-verified ordered suffix after the baseline
that was rehearsed on the restored copy. The human-avatar migration's changed
checksum and existing admissions/OTP tables must be explicitly accounted for;
no suffix is safe merely because it appears in `migrate status` output.

The deployment script reads `_prisma_migrations`, verifies checksums of all
finished, non-rolled-back entries against the exact release, and compares the
reported pending list to the remaining suffix. Any unknown, failed, diverged,
unbaselined, checksum-mismatched, duplicate, out-of-order, or non-suffix state
fails closed. This verification still does not prove production schema parity;
the independent read-only schema review and restore rehearsal are mandatory. If
the actual status does not match the rehearsed plan, do not force the deploy—stop
and revise the plan.

## Required evidence to close this blocker

Attach the following to the authorized internal release record (not the Git
repository):

- backup identifier + SHA-256 + UTC time + engine version;
- isolated restore evidence and disposable database identifier;
- before/after schema inventory and data-preservation results;
- exact migration names/checksums and `_prisma_migrations` status;
- candidate commit SHA, CI result, migration rehearsal log, reviewer approval;
- confirmed live app path/PM2 cwd/proxy upstream/storage location;
- post-release local and public health, authentication, database, and core-flow
  verification.

Until these records exist, production migration and deployment remain blocked.
