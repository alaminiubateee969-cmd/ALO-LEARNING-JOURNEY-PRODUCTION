# Production Readiness — Current Repository Evidence

**As of:** 2026-10-18
**Status: PR #19 CI GREEN / PRODUCTION BLOCKED — DO NOT DEPLOY**

This is a repository-only assessment. The VPS, production MySQL database, backup, PM2 process, proxy, DNS/TLS, and public domain have not been accessed or independently verified. The target values are operator-provided: `/home/aloedu/LEARNING-JOURNEY`, PM2 `learn-aloeducation`, port `3017`, `learn.aloeducation.com`, and MySQL `db_learn` at `127.0.0.1:3306`.

## Current check results

| Gate | Result | Evidence / limitation |
|---|---|---|
| Automated tests | PASS | `npm test`: 52/52 tests passed on the current worktree; see [`TEST_REPORT.md`](TEST_REPORT.md). |
| ESLint | PASS | `npm run lint`: 0 errors, 0 warnings. |
| Static migration verification | PASS, static only | Five MySQL migrations map to 42 Prisma models, 480 scalar column types, keys/indexes/relations, and one implicit relation table. This does not check production schema/history. |
| TypeScript | PASS in CI / local sandbox blocked | GitHub CI generated the schema-specific client and typecheck passed on candidate `2453def`. Local `npm run typecheck` still fails because this sandbox cannot fetch the Prisma engine/client. |
| Prisma generation | PASS in CI / local sandbox blocked | CI completed `prisma validate` and `prisma generate`; local `prisma generate --no-engine` could not fetch the schema-engine checksum from `binaries.prisma.sh` due sandbox TLS/network restrictions. |
| Production build | PASS in CI / local sandbox blocked | GitHub CI completed the production build after generating Prisma Client. Local build compiled, then type-check stopped on the missing generated client. Middleware-to-proxy deprecation warning remains. |
| Dependency audit | FAIL / triage required | `npm audit`: 13 findings (9 high, 4 moderate); `npm audit --omit=dev`: 8 (4 high, 4 moderate). Proposed fixes include major-version changes; none were applied blindly. |
| Workflow/Compose YAML | PASS, syntax only | CI, deploy, Datadog, and Compose YAML parse; this does not prove workflow execution. |
| Shell syntax | PASS | Seven deployment/preflight/backup/health scripts pass `bash -n`. |
| GitHub PR checks | PASS / OPTIONAL CHECK SKIPPED | On candidate `2453def298cb4fe45dd70cfe8897d5aefd59f457`, `CI / validate` passed all steps; optional Datadog Synthetics `build` was skipped because it is disabled by default. GitHub reports a clean merge state. |
| MySQL/restored-copy rehearsal | NOT DONE | No verified production backup or disposable restored MySQL copy is available. |
| VPS / PM2 / public health | NOT VERIFIED | No SSH/VPS operation or public-domain verification has occurred. |

The static migration verifier is not evidence that a migration matches production schema/history. See [`MIGRATION-RECOVERY-PLAN.md`](../../MIGRATION-RECOVERY-PLAN.md) for the required safe procedure.

## Merge status

PR #19 is the existing PR and has been updated rather than duplicated. At last observation it was `OPEN`, `CLEAN`, head `2453def298cb4fe45dd70cfe8897d5aefd59f457`. `CI / validate` passed, including Prisma generation, two deployments of the checked-in migrations to a fresh CI MySQL service, lint, tests, typecheck, and production build. The optional Datadog `build` job was skipped by its explicit opt-in guard. The PR was unmerged at that snapshot; check GitHub for any later state. No branch-protection API details or required-review requirements were available to this repository integration.

## Production safety gates still open

1. CI generated the matching Prisma Client and passed typecheck/build on candidate `2453def`; rerun required checks for any later commit. Local sandbox engine download remains blocked.
2. Before production release, triage the current dependency audit findings without unreviewed major upgrades.
3. Read-only inventory of live MySQL schema, data relationships, and `_prisma_migrations` checksums/history.
4. Verify a complete database/media backup by restoring it to an isolated compatible MySQL instance; rehearse the exact migration plan there. Preserve legacy admissions/OTP data and relationships; keep admissions `Lead` separate from marketing `MarketingLead`.
5. Independently verify live app path, PM2 process/cwd, port, storage, proxy, auth, and health. The reported PM2 list is empty; deployment scripts intentionally do not start an absent process.
6. After all approvals, deploy one exact commit and verify local health plus the public HTTPS endpoint report that exact SHA.

## Repository asset and secret review

A limited review scanned 230 incoming text-like files and 11 generated images; it found no obvious credential filenames or apparent personal data. This is not a comprehensive secrets/DLP or image-content audit. Provenance and consent for uploaded/user media remain unverified. No user assets were deleted or blindly rewritten, and no production data was accessed; obtain owner confirmation before reusing uploaded media publicly.

## Product behavior caveats

- Content and SEO generation produce drafts. There is no independent fact/safety/legal review or verified quality score; SEO briefs remain not publish-ready and require human verification. The unused self-correction helper that trusted model-provided scores was removed; no independent scoring engine replaces it.
- Approval actions create an internal queue item; they do not publish to a social platform.
- Comment replies can be saved as drafts only. `send` returns `503 external_reply_delivery_not_configured` and does not change reply status.
- RAG search is lexical keyword/overlap matching, not vector search. Content generation passes up to three stored documents as context; it does not query-rank them.
- Avatar videos use still-image scenes, generated/local speech, FFmpeg motion, and output stream/resolution validation. These checks do not establish visual quality, identity consistency, or lip-sync. Adapter output is not integrated into the final compositor; new records report `lipSyncUsed=false` and `lipSyncReason=not_integrated`. Legacy `lipSyncUsed=true` metadata is unverified, not proof of lip-sync.
- General OTP delivery is disabled; no simulated code is generated, stored, or returned. Admin sign-in OTP is a separate flow.

## Decision

**Keep production untouched.** Do not set `VPS_DEPLOY_ENABLED`, run `prisma migrate deploy`, bootstrap/restart PM2, or claim the release is live until the code/CI, database, backup, migration, host, and approval evidence above is complete. No public-domain health check has been performed.
