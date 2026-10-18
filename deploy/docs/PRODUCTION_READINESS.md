# Production Readiness — Current Repository Evidence

**As of:** 2026-10-18
**Status: BLOCKED — DO NOT MERGE OR DEPLOY UNTIL REQUIRED GATES PASS**

This is a repository-only assessment. The VPS, production MySQL database, backup, PM2 process, proxy, DNS/TLS, and public domain have not been accessed or independently verified. The target values are operator-provided: `/home/aloedu/LEARNING-JOURNEY`, PM2 `learn-aloeducation`, port `3017`, `learn.aloeducation.com`, and MySQL `db_learn` at `127.0.0.1:3306`.

## Current check results

| Gate | Result | Evidence / limitation |
|---|---|---|
| Automated tests | PASS | `npm test`: 51/51 tests passed on the current worktree; see [`TEST_REPORT.md`](TEST_REPORT.md). |
| ESLint | PASS | `npm run lint`: 0 errors, 0 warnings. |
| Static migration verification | PASS, static only | Five MySQL migrations map to 42 Prisma models, 480 scalar column types, keys/indexes/relations, and one implicit relation table. This does not check production schema/history. |
| TypeScript | FAIL / BLOCKED | Only reported error: `src/lib/db.ts(1,10)` cannot import `PrismaClient` because the schema-specific generated `@prisma/client` is absent. |
| Prisma generation | BLOCKED | `prisma generate --no-engine` could not fetch the schema-engine checksum from `binaries.prisma.sh` due sandbox TLS/network restrictions. |
| Production build | FAIL / BLOCKED | Next.js compiled successfully, then type-check failed on the missing generated Prisma Client. No complete build artifact was produced. Middleware-to-proxy deprecation warning remains. |
| Dependency audit | FAIL / triage required | `npm audit`: 13 findings (9 high, 4 moderate); `npm audit --omit=dev`: 8 (4 high, 4 moderate). Proposed fixes include major-version changes; none were applied blindly. |
| Workflow/Compose YAML | PASS, syntax only | CI, deploy, and Compose YAML parse; GitHub Actions execution has not occurred. |
| Shell syntax | PASS | Seven deployment/preflight/backup/health scripts pass `bash -n`. |
| GitHub PR checks | NOT RUN | PR #19 reports no check runs. |
| MySQL/restored-copy rehearsal | NOT DONE | No verified production backup or disposable restored MySQL copy is available. |
| VPS / PM2 / public health | NOT VERIFIED | No SSH/VPS operation or public-domain verification has occurred. |

The static migration verifier is not evidence that a migration matches production schema/history. See [`MIGRATION-RECOVERY-PLAN.md`](../../MIGRATION-RECOVERY-PLAN.md) for the required safe procedure.

## Merge status

PR #19 is the existing PR and must be updated rather than duplicated. Latest observed GitHub state: `OPEN`, `DIRTY`, head `05796a796511aa96bc23b220e6ef5c96a7ec2b44`, no reported checks. The local branch is merging `2fb44c087c214b0ebb093e1c8b3bb9324d9b532b`; changes are not yet committed or pushed. **Do not merge until the local merge is completed, the branch is pushed, GitHub reports a clean merge state, required checks pass, and review is complete.**

## Production safety gates still open

1. Generate and verify the repository-matched Prisma Client in a trusted network environment; then resolve the typecheck/build blocker and pass CI.
2. Triage the current dependency audit findings without unreviewed major upgrades.
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
