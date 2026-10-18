# Historical Full Project Audit — 2026-10-17 (superseded baseline)

> **Historical snapshot — not current production evidence.** This document
> refers to an earlier checkout/date and may contain stale paths, counts,
> test results, or infrastructure claims. Use the current repository
> baseline at `../COMPLETE-AUDIT-REPORT.md`, deployment blockers at
> `../DEPLOYMENT.md`, and migration procedure at
> `../MIGRATION-RECOVERY-PLAN.md`. Do not execute commands here against
> production without a new review and explicit authorization.


Method: exhaustive filesystem walk, source scans, dependency-usage analysis, schema↔migration diff, env-var diff, shell syntax checks, secrets scan, import resolution across all TS files, build/typecheck/lint runs, runtime smoke of every route class, doc-link resolution. **No item below is estimated; each was executed.**

## 1. Inventory (measured)

| Metric | Count |
|---|---|
| Total files (excl. .git, node_modules) | 293 |
| Total folders | 107 |
| src files | 197 |
| Components (`src/components/alo` / `ui`) | 44 / 48 |
| API route files | 60 |
| Frontend pages | 2 (`/`, `/login` — SPA tab architecture) |
| Prisma models | 32 (+1 implicit join table) |
| Migrations | 3 |
| Shell scripts | 7 (5 scripts/, 2 audit/) |
| Workflow files | 2 (CI + Deploy) |
| Env vars declared in `.env.example` | 34 |

## 2. Verified healthy (checked, not assumed)

| Area | Result | Evidence |
|---|---|---|
| TypeScript | ✅ 0 errors | `tsc --noEmit` exit 0 |
| ESLint | ✅ 0 errors | `eslint src tests scripts` exit 0 |
| Build | ✅ PASS | `next build` compiles + generates standalone output |
| Broken imports | ✅ 0 | tsc resolves every `@/` and relative import |
| Broken exports | ✅ 0 | tsc export/import graph consistent |
| Empty files | ✅ 0 | `find -type f -empty` empty |
| TODO/FIXME/XXX/HACK | ✅ 0 | grep across src/prisma/scripts/deploy/tests |
| Hardcoded secrets | ✅ 0 | credential-regex scan clean |
| Shell injection | ✅ safe | all `execFileSync/spawnSync/execFile` use argv arrays (no shell) |
| DB schema ↔ migrations | ✅ 32/32 parity | models minus tables = ∅; only the Prisma join table extra |
| Shell script syntax | ✅ 7/7 pass | `bash -n` on every .sh |
| Doc relative links | ✅ 0 broken | resolver across all .md |
| Unused packages | ✅ 0 | every dep+devDep imported or config-referenced |
| PM2 config | ✅ correct | `output: "standalone"` confirmed in next.config.ts; `.next/standalone/server.js` target valid |
| Nginx | ✅ complete | TLS1.2/1.3, ACME webroot, security headers, 25m body, WS upgrade, timeouts |
| Auth middleware | ✅ fail-closed | production requires auth; unconfigured → 503/redirect; JWT via next-auth |
| OTP | ✅ enforced in prod | `ADMIN_OTP_REQUIRED` defaults true in production |
| Backups | ✅ AES-256-GCM | MAGIC+IV+authTag envelope, 0600 perms, key file or env |
| Runtime smoke | ✅ | `/`, `/login`, `/api/health`, `/api/dashboard`, `/api/diagrams`, `/api/ai/local-status` → 200; POST-only routes correctly 405 on GET |
| Interval cleanup | ✅ | `clearInterval` present in all polling effects |

## 3. Issues found (to be fixed after this report)

| # | Severity | Issue | Category |
|---|---|---|---|
| A1 | Medium | `.env.example` missing vars used in code: `ALO_PRISMA_LOG`, `ALO_DISABLE_BUILTIN_LOCAL_AI`, `BACKUP_ENCRYPTION_KEY`, `ENV_FILE` | Missing environment variables |
| A2 | Low | 15 shadcn `src/components/ui` primitives with **zero references** (accordion, alert-dialog, aspect-ratio, avatar, breadcrumb, context-menu, drawer, hover-card, menubar, navigation-menu, pagination, resizable, slider, sonner, toggle-group) | Unused files / dead code |
| A3 | Medium | **No Docker files at all** (no Dockerfile, no docker-compose, no .dockerignore) — requested checklist items | Missing deployment files |
| A4 | Low | `docs/ROUTE-INVENTORY.md` header dated 2026-10-13 (stale timestamp; re-generated from filesystem: 2 pages, 60 routes) | Missing/stale documentation |

## 4. Not issues (checked and explained)

- `Caddyfile` is intentionally kept as a **deprecated reference** (its own header says the live proxy is Nginx) — documented, not missing.
- `bun.lock` coexists with `package-lock.json`; CI/production use npm (documented in ci.yml header). bun.lock is inert.
- `dev.log` created by `npm run dev` tee — gitignored (verified in .gitignore).
- POST-only APIs returning 405 on GET (`/api/seed`, `/api/marketing/humanize`) — correct HTTP semantics, not errors.

## 5. Audit verdict before fixes

The application core (build, types, lint, DB, auth, backups, deploy pipeline, media) is sound. **Four concrete gaps** are listed in §3 and are fixed in the change pass that follows this report. Nothing else was found broken.
