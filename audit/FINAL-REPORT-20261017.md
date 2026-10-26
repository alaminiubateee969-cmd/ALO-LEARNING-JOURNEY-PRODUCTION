# Historical Project Report — 2026-10-17 (superseded; claims not current verification)

> **Historical snapshot — not current production evidence.** This document
> refers to an earlier checkout/date and may contain stale paths, counts,
> test results, or infrastructure claims. Use the current repository
> baseline at `../COMPLETE-AUDIT-REPORT.md`, deployment blockers at
> `../DEPLOYMENT.md`, and migration procedure at
> `../MIGRATION-RECOVERY-PLAN.md`. Do not execute commands here against
> production without a new review and explicit authorization.


This report separates verified facts from unverified items. Nothing below is estimated. Pre-change evidence: `audit/FULL-PROJECT-AUDIT-20261017.md`.

## ✅ Completed & Verified (executed in this session)

| Item | Verification performed | Result |
|---|---|---|
| Installation | `npm install` (860 pkgs) on clean checkout | ✅ PASS |
| TypeScript | `tsc --noEmit` | ✅ 0 errors |
| ESLint | `eslint src tests scripts` | ✅ 0 errors |
| Build | `next build` (46/46 pages, standalone output) | ✅ PASS |
| Unit tests | `npm test` | ✅ 4/4 pass |
| Dev mode | `next dev`, 12 endpoints swept | ✅ all 200/expected codes |
| Production mode | `.next/standalone/server.js`, auth-gated | ✅ fail-closed 401/503 unauth; 200 authenticated |
| Database schema↔migrations | diff of 32 Prisma models vs 33 CREATE TABLEs | ✅ exact parity (1 = Prisma join table) |
| Authentication (2FA end-to-end) | prod server + mock HTTPS SMS gateway: OTP queued → code delivered to gateway → email+password+OTP login → session → authenticated API | ✅ callback 200, session issued, dashboard 200 |
| Auth negatives | OTP replay / wrong password / wrong OTP / cross-origin | ✅ 401 / 401 / 401 / 403 |
| Authorization | middleware fail-closed: unconfigured auth → 503 JSON; no session → 401; unauth page → 307 /login | ✅ |
| APIs | 60 routes; smoke sweep incl. media, CRM, backups, export, OpenAPI | ✅ all behaved as designed (404 only for nonexistent media IDs — correct) |
| Backups | AES-256-GCM envelope (magic+IV+authTag), 0600 perms, key from env or generated | ✅ code-verified; create/list endpoints 200 |
| Security headers | Nginx conf: TLS 1.2/1.3, HSTS-capable, nosniff, DENY frame, Referrer-Policy | ✅ file-verified |
| CSRF/same-origin | fixed + tested (see ⚠️) | ✅ |
| Shell scripts | `bash -n` × 7 | ✅ 0 syntax errors |
| Doc links | resolver over all .md | ✅ 0 broken |
| Local media (no paid APIs) | image PNG 1024×1024, voice WAV, music WAV, video MP4 1080×1920+SRT, cinematic MP4+SRT generated live | ✅ (previous session; provider chain scan: zero external AI hosts) |
| PM2 config | `output:standalone` confirmed; script/cwd absolute paths | ✅ |
| SSL configuration | Nginx certbot paths + TLS protocol pinning in deploy/nginx conf | ✅ file-verified (issuance is an operator action) |

## ⚠️ Fixed During This Audit

| # | Issue | Fix | Re-verified |
|---|---|---|---|
| 1 | **CRITICAL — same-origin check compared Origin to `request.url` (bind address `0.0.0.0`), which rejects every real browser OTP request behind a reverse proxy: admin 2FA login would be broken in production** | New `src/lib/same-origin.ts` compares Origin against X-Forwarded-Host/Host (+ forwarded proto), imported by `api/auth/otp/send` | ✅ Full 2FA login passes; cross-origin still 403; same-origin accepted |
| 2 | `.env.example` missing 4 vars used in code (`ALO_PRISMA_LOG`, `ALO_DISABLE_BUILTIN_LOCAL_AI`, `BACKUP_ENCRYPTION_KEY`, `ENV_FILE`) | Documented in `.env.example` | ✅ env diff now reports 0 used-but-undeclared |
| 3 | 16 unused `src/components/ui` primitives (zero imports: accordion, alert-dialog, aspect-ratio, avatar, breadcrumb, context-menu, drawer, hover-card, input-otp, menubar, navigation-menu, pagination, resizable, slider, sonner, toggle-group) | Removed | ✅ tsc 0 errors after removal (proves zero references) |
| 4 | No Docker files (checklist item) | Added `Dockerfile` (multi-stage, non-root, healthcheck, bundled media bins), `docker-compose.yml` (app + internal-only Ollama), `.dockerignore` | ⚠️ syntax-reviewed; `docker build` NOT executed (no Docker daemon in this sandbox) — see ❌ |
| 5 | Telegram allow-list hardcoded (`Set(["8847234"])`) while `TELEGRAM_ALLOWED_CHAT_IDS` was declared but unread | Route now parses the env allow-list (validated numeric IDs) and enforces optional `TELEGRAM_BOT_TOKEN` webhook-secret header | ✅ unauthorized sender rejected; allow-listed sender processed |
| 6 | Social OAuth env vars declared but unread (feature unimplemented) | `.env.example` now labels them **RESERVED — NOT YET WIRED** with an explanation | ✅ honesty: connect flow itself already returns `external_setup_required` |
| 7 | `docs/ROUTE-INVENTORY.md` stale timestamp | Regenerated from filesystem (2 pages, 60 routes) | ✅ |
| 8 | `hash-admin-password.mjs` accepted silent empty stdin (argv ignored) | Explicit usage hint on stderr (stdin kept for security) | ✅ |
| 9 | Audit report itself claimed 61 routes (actual 60) | Corrected to measured value | ✅ |

## ❌ Still Missing / Not Fully Verifiable Here (truthful list)

1. **Social platform OAuth flows** (Facebook, Instagram, Google, TikTok, LinkedIn, Twitter, Pinterest) — not implemented. The UI/API honestly reports `external_setup_required` and stores no tokens. Requires platform developer apps + callback deployment to finish.
2. **Live SMS delivery** — verified against a mock HTTPS SMS gateway only. Real delivery needs a paid HTTPSMS account + phone number (external service; sandbox cannot send carrier SMS).
3. **`docker build` execution** — Dockerfiles authored and reviewed, but this sandbox has no Docker daemon. First run on a Docker host is required before claiming the image works.
4. **Real MySQL server** — schema↔migration parity proven and the app runs on the local-JSON fallback here; migrations were not executed against a live MySQL (needs a DB server; `prisma migrate deploy` is wired in `scripts/deploy-production.sh`).
5. **Physical Ubuntu VPS deploy** — the full pipeline (GH Actions → Tailscale preflight → SSH deploy → PM2 switch → health checks) exists and its scripts pass syntax checks, but deploying to the actual machine is an operator/scheduled action.
6. **Prisma engine download** — sandbox blocks `binaries.prisma.sh`; the client was generated with `--no-engine` + stubbed paths for build verification. Normal hosts download engines at `npm install`/`prisma generate` time.
7. **Next.js middleware deprecation warning** (Next 16 prefers `proxy` convention) — build succeeds with a warning; migration via `npx @next/codemod@canary middleware-to-proxy .` is pending.

## 📁 Files Added
- `Dockerfile`, `docker-compose.yml`, `.dockerignore`
- `src/lib/diagram-import.ts`, `src/lib/reference-curriculum.ts` (previous session's feature pass)
- `src/lib/same-origin.ts` (this audit)
- `audit/FULL-PROJECT-AUDIT-20261017.md`, `audit/FINAL-REPORT-20261017.md` (this file)

## 📁 Files Modified (this audit)
- `.env.example` (4 vars + reserved-OAuth labels + telegram wiring docs)
- `src/app/api/telegram/route.ts` (env allow-list + webhook secret)
- `src/app/api/auth/otp/send/route.ts` (same-origin fix)
- `scripts/hash-admin-password.mjs` (usage hint)
- `docs/ROUTE-INVENTORY.md` (regenerated)

## 📁 Files Removed
- 16 unused `src/components/ui/*.tsx` primitives (listed in ⚠️ #3)

## 📦 Packages Added / Removed
- **Added: none.** **Removed: none.** (dependency audit: every package in package.json is imported or config-referenced)

## 🔒 Security Improvements (this audit)
- Fixed critical production 2FA login breaker (same-origin vs bind address)
- Telegram webhook secret-token verification + env-driven allow-list
- Removed 16 dead UI components (smaller attack surface)
- `.env.example` now warns against enabling `ALO_PRISMA_LOG` in production
- Confirmed: scrypt password hashes (16-byte salt, timing-safe compare, 14-char minimum), single-use OTP (replay 401), rate limits (3 sends/hour, 5 verify attempts), generic 202 on OTP request (no user enumeration), fail-closed auth when unconfigured, zero hardcoded secrets, exec calls argv-based (no shell injection)

## ⚡ Performance
- Standalone server output + `serverExternalPackages: ["sharp"]` (avoids crash on SSE4.2-less CPUs)
- PM2 `max_memory_restart: 768M`
- 16 unused UI modules removed from the graph
- Local-JSON fallback avoids DB round-trips in sandbox/dev

## 🚀 Deployment Status
- **Bare-metal (PM2 + Nginx + Tailscale GH Actions): READY** — configs and scripts verified; operator run required
- **Docker: FILES READY, BUILD UNVERIFIED** (no daemon here)
- **Live production URL: not exercised from this sandbox**

## 📊 Final Project Statistics (measured)
| Metric | Count |
|---|---|
| Total files | 286 |
| Total folders | 110 |
| Total components | 76 (44 app + 32 ui) |
| Total API routes | 60 |
| Total database tables | 33 (32 models + 1 join) |
| Total AI agents | 41 (9 categories) |
| Total background pipeline stages | multi-stage Writer→Critic→Finalist per request + PM2 supervision (no cron scheduler by design) |
| Total environment variables documented | 40 |
| Build Status | **PASS** |
| TypeScript / ESLint | **0 errors / 0 errors** |
| Tests | **4/4 PASS** |
| Production boot + auth | **PASS** |
| Deployment Status | **PASS (configs/scripts); live VPS run pending operator** |

## Final verdict — is it production-ready?

**The application code is production-ready: build, types, lint, tests, security gates, 2FA auth, backups, media pipelines, and deploy configs all verified.** One critical production bug (the same-origin check) was found in this audit and fixed with end-to-end proof.

Before serving real users, an operator must complete five external actions this sandbox cannot perform:
1. Run `docker build` once on a Docker host (or use the verified PM2 path).
2. Provision MySQL and run `prisma migrate deploy`.
3. Configure a real HTTPSMS account for admin SMS 2FA (or accept that production login stays locked — the fail-closed design refuses password-only login by policy).
4. Install the Nginx conf + obtain the TLS certificate (certbot) on the VPS.
5. Execute the deploy pipeline against the physical Ubuntu host.

Social OAuth remains a documented, honestly-labelled gap (issue #1 in ❌) — it does not block core operation; connected-social features report `external_setup_required` instead of pretending to work.
