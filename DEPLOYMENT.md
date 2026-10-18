# ALO Learning Journey — Deployment and Production Readiness

> **Current status: NOT PRODUCTION-READY / deployment intentionally blocked.**
> This repository-only audit has not accessed the VPS, production database, GitHub
> Actions settings, proxy, DNS, SSL, Docker, or PM2. Values and claims in older
> audit documents are historical operator reports, not current live evidence.
> The requested target `/home/aloedu/LEARNING-JOURNEY` conflicts with the older
> documented path `/home/aloedu/projects/learn-aloeducation`; no script or
> workflow now selects either path implicitly.

## Evidence and scope

- Pre-repair source baseline: [`COMPLETE-AUDIT-REPORT.md`](./COMPLETE-AUDIT-REPORT.md).
- Post-repair source/test audit: [`POST-REPAIR-AUDIT-REPORT.md`](./POST-REPAIR-AUDIT-REPORT.md) (completed 2026-10-18; check limitations are documented there).
- Migration recovery requirements: [`MIGRATION-RECOVERY-PLAN.md`](./MIGRATION-RECOVERY-PLAN.md).
- Historical reports under `audit/` describe earlier checkouts and must not be
  used as proof that the current VPS, its database, or its network is healthy.

No migration, database write, PM2 command, proxy change, DNS/SSL change, SSH
operation, merge, or deployment has been performed by this audit.

## Deployment workflow and safety gates

`.github/workflows/deploy.yml` is a proposed deployment path, not evidence of a
successful deployment. Its deploy job is skipped unless the repository variable
`VPS_DEPLOY_ENABLED` is exactly `true`, then requires passing CI, a successful
Tailscale/SSH preflight, and approval in the protected `production` Environment.
The remote deploy script independently refuses to run unless the same exact
switch is forwarded; this is an accidental-invocation guard, not proof that
production is ready or authorization to bypass the workflow gates. Before the
remote deploy step it must also receive:

1. `VPS_APP_DIR`, an absolute application path confirmed read-only against the
   running PM2 cwd, proxy upstream, and persistent storage. The workflow has no
   path fallback.
2. `VPS_DOMAIN`, a verified public `https://` URL. The public `/api/health`
   check is a hard gate; there is no non-strict fallback.
3. `VPS_RESTORE_TEST_SHA` equal to the exact release commit and
   `VPS_RESTORE_TEST_REFERENCE` identifying a successful isolated backup restore
   rehearsal against that release. A compressed dump integrity probe is not a
   restore test.
4. If migrations are pending, `VPS_MIGRATION_PLAN_SHA` equal to the exact
   release commit after the production schema/history inspection and isolated
   migration rehearsal in `MIGRATION-RECOVERY-PLAN.md`.

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
| `VPS_APP_DIR` | Required; confirmed live path, no default. Do not choose between the two conflicting documented paths without VPS evidence. |
| `VPS_PM2_APP` | PM2 app name; defaults to `learn-aloeducation` in the script. |
| `VPS_APP_PORT` | Must match the actual local app port; defaults to `3017`. |
| `VPS_DOMAIN` | Required verified HTTPS URL; public health is a hard post-deploy gate. |
| `VPS_RESTORE_TEST_SHA` | Exact release SHA whose backup restore was rehearsed in isolation. |
| `VPS_RESTORE_TEST_REFERENCE` | Non-secret audit/ticket/backup reference for that rehearsal. |
| `VPS_MIGRATION_PLAN_SHA` | Set only for an explicitly reviewed pending-migration plan, and only to its exact release SHA. |
| `VPS_DEPLOY_ENABLED` | Keep unset until every blocker below is cleared and required reviewers are configured. |

Set **Required reviewers** for the GitHub Environment `production`; retain
branch protection requiring PR review and green CI. Do not put secrets in
variables, workflow logs, reports, or chat.

## Required sequence before any production release

1. **Read-only host inventory:** establish the real app directory, PM2 process
   and cwd, port, proxy upstream, storage paths, Node/npm/PM2/MySQL versions,
   and service owner. Reconcile the path conflict. Do not move/rename the live
   directory, change the proxy, or restart PM2 during this inventory.
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

`scripts/deploy-production.sh` builds the isolated release **before** any
migration, checks DB connectivity, writes a compressed SQL dump, verifies gzip
integrity and a schema-content probe, then evaluates migration status. That
script does **not** restore-test the dump; the external exact-SHA rehearsal gate
is mandatory. It refuses an unknown/failed/unbaselined history or a pending set
that is not a known ordered suffix of the checked-in three-migration chain.
Pending migrations additionally require `MIGRATION_PLAN_APPROVED_SHA` to equal
the exact release SHA. After `prisma migrate deploy`, it requires clean status
before switching `current` and reloading PM2. PM2 reload or local-health
failure restores the previous **code** path only; database changes are not
auto-reverted. The later public-health job runs after the remote script returns;
a public-health failure is a failed workflow, not an automatic server rollback.

The release process preserves files from tracked `storage/` in persistent
`shared/storage/` using no-clobber copies before linking the release to shared
storage. The old app directory is not moved by the bootstrap script. Review the
scripts and backup capacity on the real host before any authorized execution.

## Bootstrap script

`scripts/bootstrap-vps.sh` is a one-time guarded operation, **not** run as part
of CI and not run during this audit. It requires an explicit absolute `APP_DIR`,
`APP_DIR_CONFIRM` equal to that exact path, and an exact-SHA restore-test
reference. It retains the existing app directory, performs a health check,
builds a separate release, requires clean read-only migration status, then
switches `current` with a rollback path. It does not migrate the database or
change the proxy/DNS. Even with these guards, do not run it until a production
operator has inspected the complete script and authorized the operation.

## Current blockers (must be resolved before production-ready claim)

- Production database connectivity, schema, migration history/checksums, and
  the user-reported missing CRM/OTP tables are **unverified**.
- No production backup restore or isolated migration rehearsal has been
  demonstrated. The deployment dump probe alone is insufficient.
- The real VPS path conflicts with prior docs and has not been confirmed.
- Live Ubuntu/PM2/MySQL/Docker/proxy/firewall/TLS/DNS and remote connectivity
  are not verified in this audit.
- External auth/SMS delivery, social OAuth, publishing delivery, background
  schedulers, off-site monitoring, and actual restore procedures require
  separate operational verification; see the post-repair audit.
- `npm audit` findings, Prisma engine download blocker, and the Next.js
  middleware deprecation warning are detailed in the post-repair report and
  still require follow-up.

**Until every blocker is resolved with evidence, leave `VPS_DEPLOY_ENABLED`
unset and do not execute production migration/bootstrap/deploy commands.**
