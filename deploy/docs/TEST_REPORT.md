# Test Report — Current Repair Worktree

**As of:** 2026-10-18
**Branch:** `arena/6d490018-alo-learning-journey-productio`
**Status:** Local checks only. The merge is not committed or pushed; GitHub CI and production tests have not run.

## Local checks

| Check | Result | Evidence / limitation |
|---|---|---|
| `npm test` | PASS | 51/51 tests passed. Includes auth/OTP, CRM/health, migration guards, release-script safeguards, bounded uploads, and tests that prevent unverified SEO/lip-sync claims. Node emitted a non-failing module-type performance warning for `src/lib/auth-config.ts`. |
| `npm run lint` | PASS | 0 errors, 0 warnings after replacing build-time Google font downloads with the repository's licensed self-hosted Hind Siliguri fonts and system fallbacks. |
| `npm run verify:migrations` | PASS, static only | 42 Prisma models, 480 scalar column types, indexes/unique constraints/PKs/FKs, and one implicit relation table map to five checked-in MySQL migrations. No selected destructive SQL pattern found. This is not a live database comparison. |
| `npm run typecheck` | FAIL / BLOCKED | One reported error: `src/lib/db.ts(1,10): @prisma/client has no exported member PrismaClient` because the schema-specific generated client is absent. |
| `npm run build` | FAIL / BLOCKED | Next.js compiled successfully; type-check then failed on the same missing generated Prisma Client. No complete production build artifact was produced. Middleware-to-proxy deprecation warning remains. |
| Prisma Client generation | BLOCKED | The prior `npx prisma generate --schema=prisma/schema.prisma --no-engine` attempt could not download Prisma's schema engine/checksum from `binaries.prisma.sh` because of sandbox TLS/network restrictions. Do not mask this with a fake client. |
| `npm audit` | FAIL / triage required | Registry report: 13 findings (9 high, 4 moderate, 0 critical). `npm audit --omit=dev`: 8 (4 high, 4 moderate). Proposed fixes include major-version changes; none were applied blindly. |
| `bash -n` | PASS | Seven deployment/preflight/backup/health scripts parsed successfully, including the read-only monitor. |
| Workflow/Compose YAML | PASS, syntax only | `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, and `docker-compose.yml` parsed with `js-yaml`; this is not a GitHub Actions run. |
| `git diff --check` and `git diff --cached --check` | PASS at last run | Both working-tree and staged diff whitespace checks passed after normalizing imported text artifacts. Re-run after final staging. |
| GitHub CI / PR checks | NOT RUN | Latest observed PR #19 state is `OPEN`, `DIRTY`, with no reported checks. |

## What the static migration check means

The verifier covers the checked-in Prisma model/migration mapping and selected SQL safety patterns. It does **not** prove production schema, existing data, indexes, foreign keys, checksums/history, or backup restoreability. No production DB connection or restored-copy migration rehearsal has occurred. Preserve admissions/OTP records and relationships, and keep admissions `Lead` separate from marketing `MarketingLead`.

## Product-behavior safeguards covered in source/tests

- Generic OTP delivery remains disabled; it does not generate, store, or return simulated codes. Administrator sign-in OTP is a separate flow.
- SEO briefs are drafts, remain `publishReady: false`, and are not independently scored or fact/safety/SEO certified. The unused self-correction helper that treated model-supplied `qualityScore` as validation was removed; no independent scoring engine replaces it.
- Avatar generation records `lipSyncUsed=false` / `lipSyncReason=not_integrated`. The compositor does not use adapter output. Historical `lipSyncUsed=true` metadata is shown as an unverified legacy flag, not proof of lip-sync.
- The monitoring script targets the operator-provided `/home/aloedu/LEARNING-JOURNEY`, `learn-aloeducation`, port `3017`; it is read-only, does not query SQLite/MySQL, and does not start/restart PM2.

## Explicitly not tested or verified

- Prisma Client generated-type checking and a complete production build.
- Applying migrations against a disposable MySQL instance restored from a verified production backup.
- Live CRM/OTP rows and relationship preservation.
- VPS, PM2 process/cwd, port `3017`, reverse proxy, DNS/TLS, or public HTTPS health.
- Production deployment, public-domain availability, real OTP/SMS delivery, external social publishing, comment delivery, or media quality/lip-sync.

## Next required checks

1. In a trusted network environment, generate the matching Prisma Client and verify its version; then rerun typecheck, lint, tests, migration checks, and production build.
2. Before any production release, triage the current npm audit findings; avoid unreviewed major upgrades.
3. Commit and push this repair to the existing Arena branch/PR #19, resolve the GitHub merge conflict, and obtain required CI checks and review before merging.
4. Complete the separately documented read-only production inventory, verified backup restore, and exact migration rehearsal before any deployment decision.
