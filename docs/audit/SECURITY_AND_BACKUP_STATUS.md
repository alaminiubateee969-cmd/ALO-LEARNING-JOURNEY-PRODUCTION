# Security and backup status — 2026-10-18

## Repository-observed controls

| Control | Status | Evidence / limitation |
|---|---|---|
| Authentication middleware | PARTIAL | `src/middleware.ts` gates API/pages in production, supports local-preview bypass outside production, fails closed when auth is unconfigured. Live production settings/session testing was not performed. |
| Admin OTP | PARTIAL | OTP configuration/send routes and tests exist; real SMS gateway delivery is not established by this audit. |
| Same-origin check | WORKING (unit/runtime evidence in prior test suite) | `src/lib/same-origin.ts` and related tests protect OTP send; reverse-proxy headers remain deployment-dependent. |
| Payment/no-surprise external AI gate | PARTIAL | `src/lib/agentos/payment-guard.ts` blocks legacy Z-AI SDK calls by default unless both server environment switches are true. Shared `src/lib/ai.ts` uses local adapters/fallbacks. No free-provider router is implemented. |
| Secrets | UNVERIFIED / code review pending | `.env.example` contains no actual secrets by design. This turn did not complete a comprehensive secrets scan across full Git history or external server. Never paste tokens in chat. |
| Skills safety | PARTIAL | New validator blocks selected patterns and requires private status; it is not a complete prompt-injection detector, static analyzer or sandbox. Generated skills are not executable. |
| Tool/shell security | PARTIAL | New AgentOS command planner executes no tools; existing deploy scripts have safety tests. No generic agent tool execution engine exists. |
| Data protection/isolation | PARTIAL | Auth and ownership checks exist in some routes; tenant-by-tenant authorization and data-retention audit across the entire app remain incomplete. |
| Dependency security | ACTION REQUIRED | `npm audit --json` reported 13 advisories: 9 high and 4 moderate, 0 critical. Several suggested remediations require major upgrades (Next ESLint config, Prisma, MDX editor, syntax highlighter); do not run `npm audit fix --force` without compatibility review. |
| Deployment secret management | PARTIAL | GitHub workflows reference deployment secrets/Tailscale. Current secret values are not inspected. Live protection/rotation is UNVERIFIED. |
| Encryption at rest | PARTIAL | Backup implementation documents AES-256-GCM; production backup encryption key management and stored artifact verification were not tested. |
| Backup cadence/retention | UNVERIFIED | `deploy/backup.sh` and deployment materials exist, but no live schedule or retention evidence was accessed. |
| Restore proof | UNVERIFIED | No isolated restore test evidence was available. |
| Security monitoring | PARTIAL | Health/monitor scripts and Datadog workflow exist; latest synthetics workflow was skipped in observed Actions. Live logs/alerts not inspected. |

## Backup safety requirements

- Before production changes, identify the exact DB and media volumes, create a time-stamped backup, verify checksums, and test a restore on an isolated target.
- Keep keys outside the backup itself. Record who can decrypt and how key recovery works; do not include secrets in evidence logs.
- Back up before migrations or release switches, preserve a known-good release, and verify rollback.
- Do not claim “backed up” based only on the existence of a backup script or API endpoint.

## Deployment evidence

The latest observed `Deploy to VPS` GitHub Actions run (run id `39129438031`, commit `482fb9b`) concluded `failure`. `gh run view --log-failed` could not retrieve the log (EOF from Actions results endpoint). Cause, live host state and rollback status remain unknown; do not retry/deploy without operator review.
