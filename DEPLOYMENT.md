# ALO Learning Journey — Deployment and Production Readiness

> **Current status: NOT PRODUCTION-READY / deployment intentionally blocked.**
> This repository-only repair has not accessed the VPS, production database,
> GitHub Actions settings, proxy, DNS, SSL, Docker, or PM2. Operator-provided
> configuration (not independently verified): MySQL `db_learn` at
> `127.0.0.1:3306`; app root `/home/aloedu/LEARNING-JOURNEY`; PM2 name
> `learn-aloeducation`; port `3017`; domain `learn.aloeducation.com`. The operator
> reports an empty PM2 process list. Scripts assert these exact values but do
> not prove the VPS currently matches them.

## Evidence and scope

- Current repository-only status: [`deploy/docs/PRODUCTION_READINESS.md`](./deploy/docs/PRODUCTION_READINESS.md) and [`deploy/docs/TEST_REPORT.md`](./deploy/docs/TEST_REPORT.md).
- Release evidence and known blockers: [`deploy/RELEASE_MANIFEST.txt`](./deploy/RELEASE_MANIFEST.txt).
- `COMPLETE-AUDIT-REPORT.md` and `POST-REPAIR-AUDIT-REPORT.md` are explicitly labeled historical snapshots; their counts and check results are not current.
- Migration recovery requirements: [`MIGRATION-RECOVERY-PLAN.md`](./MIGRATION-RECOVERY-PLAN.md).
- Reports under `audit/` and `worklog.md` are historical archives, not proof that the current VPS, database, or network is healthy.

No production migration, database write, PM2 command, proxy change, DNS/SSL
change, SSH operation, PR merge, or deployment has been performed. The main
branch integration is committed and pushed to existing PR #19 on the fixed
Arena branch. At last observation, candidate `2453def` had a clean merge state
and passing CI; the PR was open and unmerged. Production remains blocked by the
database, backup, dependency, and host-verification gates below. Check GitHub for
any later PR state.

## Deployment workflow and safety gates

`.github/workflows/deploy.yml` is a proposed deployment path, not evidence of a
successful deployment. Its deploy job is skipped unless the repository variable
`VPS_DEPLOY_ENABLED` is exactly `true`, then requires passing CI, a successful
Tailscale/SSH preflight, and approval in the protected `production` Environment.
The remote deploy script independently refuses to run unless the same exact
switch is forwarded; this is an accidental-invocation guard, not proof that
production is ready or authorization to bypass the workflow gates. Before the
remote deploy step it must also receive:

1. `VPS_APP_DIR` must equal `/home/aloedu/LEARNING-JOURNEY`; the workflow and
   remote script reject any other path. The deployment layout (`current`,
   `releases`, `shared/.env`) still requires read-only VPS verification.
2. `VPS_PM2_APP=learn-aloeducation`, `VPS_APP_PORT=3017`, and
   `VPS_DOMAIN=https://learn.aloeducation.com` must match exactly.
3. The deploy script requires an already-online PM2 process and a healthy,
   SHA-marked `current` release. It never starts a missing process. The
   operator-reported empty PM2 list therefore blocks this release path until a
   separate, reviewed first-install/recovery procedure establishes a known-good
   release.
4. `VPS_RESTORE_TEST_SHA` equal to the exact release commit and
   `VPS_RESTORE_TEST_REFERENCE` identifying a successful isolated production
   backup restore rehearsal. A gzip/content probe is not a restore test.
5. `VPS_SCHEMA_PREFLIGHT_SHA` and `VPS_SCHEMA_PREFLIGHT_REFERENCE` bind the
   exact release to a reviewed MySQL schema/history compatibility report.
6. If migrations are pending, `VPS_MIGRATION_PLAN_SHA` equal to the exact
   release commit after the schema/history inspection and isolated migration
   rehearsal in `MIGRATION-RECOVERY-PLAN.md`.

The workflow does not run on this branch by default. Do not set the readiness
switch or approval variables merely to make the job start. The repository has
not established that the real host is reachable, that these values are correct,
or that production is ready.

### GitHub configuration (only after the blockers are resolved)

**Secrets — Settings → Secrets and variables → Actions:**

| Secret | Purpose |
|---|---|
| `SERVER_HOST` (preferred) or legacy `VPS_HOST` | Operator-verified Tailscale destination |
| `VPS_USER` | Least-privilege SSH deployment account |
| `VPS_SSH_KEY` | Dedicated deploy private key; never commit or paste into chat |
| `VPS_SSH_HOST_KEY` | Independently fingerprint-verified host key, strict checking remains enabled |
| `VPS_PORT` | Optional SSH port; defaults to 22 |
| `TAILSCALE_OAUTH_CLIENT_ID`, `TAILSCALE_OAUTH_SECRET` | Scoped CI Tailscale client credentials |

**Variables:**

| Variable | Requirement |
|---|---|
| `VPS_APP_DIR` | Must equal `/home/aloedu/LEARNING-JOURNEY`. The on-disk release layout still needs read-only verification. |
| `VPS_PM2_APP` | Must equal `learn-aloeducation`. |
| `VPS_APP_PORT` | Must equal `3017`. |
| `VPS_DOMAIN` | Must equal `https://learn.aloeducation.com`; public health must report the exact release SHA. |
| `VPS_RESTORE_TEST_SHA` | Exact release SHA whose production backup restore was rehearsed in isolation. |
| `VPS_RESTORE_TEST_REFERENCE` | Non-secret audit/ticket reference for that restore rehearsal. |
| `VPS_SCHEMA_PREFLIGHT_SHA` | Exact release SHA reviewed against production migration history and MySQL schema. |
| `VPS_SCHEMA_PREFLIGHT_REFERENCE` | Non-secret audit/ticket reference for that schema/history review. |
| `VPS_MIGRATION_PLAN_SHA` | Set only for an explicitly reviewed pending-migration plan, and only to its exact release SHA. |
| `VPS_DEPLOY_ENABLED` | Keep unset until every blocker below is cleared and required reviewers are configured. |

Set **Required reviewers** for the GitHub Environment `production`; retain
branch protection requiring PR review and green CI. Do not put secrets in
variables, workflow logs, reports, or chat.

## Required sequence before any production release

1. **Read-only host inventory:** confirm the operator-provided app directory,
   release layout, PM2 process and cwd, port, proxy upstream, storage paths,
   Node/npm/PM2/MySQL versions, and service owner. The user reports PM2 is
   empty; verify it read-only and do not start/restart PM2 during inventory.
2. **Read-only database inspection:** verify which database the app uses, its
   tables/columns/indexes/FKs, `_prisma_migrations` rows and checksums, and
   relevant MySQL version. Do not treat the user-reported missing tables or
   pending migrations as verified until this evidence exists.
3. **Verified backup + isolated restore:** take a full backup, validate it, and
   restore it to a disposable isolated MySQL instance. Keep the production data
   untouched. Record the backup and restore evidence without exposing rows or
   credentials.
4. **Migration preparation:** compare the restored schema/history with the
   checked-in migrations. Rehearse the exact plan against the disposable restore
   and follow [`MIGRATION-RECOVERY-PLAN.md`](./MIGRATION-RECOVERY-PLAN.md).
   Never run `prisma migrate reset`, `prisma migrate dev`, `db push`, or
   destructive SQL against production.
5. **Repository checks and review:** fresh install, typecheck, lint, unit tests,
   static migration checks, production build, security/dependency review, PR/CI.
   Only merge after required checks and authorization.
6. **Authorized deployment:** set the exact verified path, restore-test SHA and
   evidence reference; if migrations are pending, set the separately reviewed
   migration-plan SHA. Require human production approval.
7. **Live verification:** require the deploy script's local health result and
   the workflow's strict public HTTPS health result, then independently verify
   the release SHA, auth, DB, backups, logs, and core user flows. PM2/local
   health failures trigger code rollback inside the deploy script. A later
   public HTTPS check failure fails the workflow but does not automatically
   roll back; investigate and make an explicitly authorized recovery decision.
   No code rollback automatically reverts database migrations.

## Migration behavior in the deploy script

`deploy/app-deploy.sh` is the manual entry point; the workflow streams
`scripts/deploy-production.sh` over pinned SSH. The deploy script requires the
exact verified path/name/port, an existing healthy SHA-marked `current` release,
and an already-online PM2 process. It **does not** bootstrap or start an absent
process. It builds the exact commit before database changes, checks the MySQL
target is `127.0.0.1:3306/db_learn`, creates a compressed dump, and checks gzip
and schema-content integrity. Those checks do **not** prove restoreability; the
external exact-SHA restore and schema/history review references are mandatory.

Before reading migration status, the script queries `_prisma_migrations` read-only
and compares every applied checksum against the exact release's migration files
using `scripts/verify-prisma-history.mjs`. Empty, unknown, duplicate, unfinished,
rolled-back, out-of-order, or checksum-mismatched history fails closed. The
initial baseline must already be reconciled and recorded as applied; the deploy
script will not apply or resolve the baseline. If history is clean, the script
skips `prisma migrate deploy`. If migrations are pending, it allows only an
ordered suffix after the baseline and requires `MIGRATION_PLAN_APPROVED_SHA`
equal to the exact release SHA. The Prisma-reported pending list must match the
checksum-verified history suffix. The external restore and schema/history
references remain operator attestations, not automatic proof. After an approved
migration it requires clean migration status before switching `current`.

It reloads only the already registered PM2 process; it never uses a `start`
fallback. Local health must report `status=ok` and the exact `releaseSha`. The
previous release is retained for code rollback; database changes are never
auto-reverted. The later public health job requires the public domain to report
the same exact SHA. A public health failure fails the workflow but does not
automatically roll back.

The release process preserves tracked `storage/` files in persistent
`shared/storage/` and copies runtime-written public media to the new release.
Files are never overwritten; conflicting content, symlinks, or paths outside
the reviewed application boundary stop deployment. Database and media backups
are checksummed before migration. Releases and backup files are never pruned.
Review disk usage and the actual app layout on the VPS before any authorized
execution.

## Bootstrap/preflight scripts

`deploy/vps-bootstrap.sh` and the legacy `scripts/bootstrap-vps.sh` entry point
are now read-only preflight tools. They report missing Node/PM2/MySQL tools,
release markers, process state, RAM, and disk but perform no package installs,
firewall/proxy changes, directory moves, file ownership changes, cron edits,
database writes, or service starts. The operator-reported empty PM2 list is an
explicit first-deployment blocker. A separate first-install procedure must be
reviewed and authorized before this release/rollback deploy path can run.

## Current blockers (must be resolved before production-ready claim)

- Production database connectivity, schema, migration history/checksums, and
  the user-reported missing CRM/OTP tables are **unverified**.
- No production backup restore or isolated migration rehearsal has been
  demonstrated. The deployment dump probe alone is insufficient.
- The app path/domain/port/PM2 name are operator-provided but not independently verified on the VPS; the release layout and empty PM2 state require a read-only check and a reviewed first-install plan.
- Live Ubuntu/PM2/MySQL/Docker/proxy/firewall/TLS/DNS and remote connectivity
  are not verified in this audit.
- External auth/SMS delivery, social OAuth, publishing delivery, background
  schedulers, off-site monitoring, and actual restore procedures require
  separate operational verification; see the post-repair audit.
- The current Prisma Client generation/typecheck/build limitation and any
  remaining dependency-audit findings are recorded in
  `deploy/docs/PRODUCTION_READINESS.md` and `deploy/docs/TEST_REPORT.md`; do not
  rely on the historical audit snapshot for current counts.

**Until every blocker is resolved with evidence, leave `VPS_DEPLOY_ENABLED`
unset and do not execute production migration/bootstrap/deploy commands.**
