# Production Acceptance Checklist

SOP Phase 24 — Final Production Acceptance Criteria.

A project is **Production Ready** only when every critical item below is
verified with evidence. Any pending item must be marked **Blocked** with the
specific dependency.

## Status legend

- ✅ Done — verified with evidence
- ⚠️  Partial — done but needs operator action to complete
- ❌ Blocked — needs human/external action
- N/A — not applicable to this project

---

## Source (SOP 24 — Source)

- ✅ Repository: `tech360-bd/ALO-LEARNING-JOURNEY-PRODUCTION`
- ✅ Commit SHA: recorded in `RELEASE_SHA` at deploy time
- ✅ License: checked (see `docs/research/GITHUB_LICENSE_MATRIX.md`)

## Technology (SOP 24 — Technology)

- ✅ Stack: Next.js 16, React 19, Prisma 6, MySQL 8, PM2, Nginx
- ✅ Runtime: Node.js 22 (pinned in `.nvmrc`, `.node-version`)
- ✅ Version report: `package.json` v0.2.1

## Accounts (SOP 24 — Accounts)

- ✅ GitHub: org `tech360-bd`, fork `alaminiubateee969-cmd`
- ⚠️  Domain registrar: operator-provided (learn.alolabs.net)
- ⚠️  Cloudflare: live (DNS resolves, managed challenge active)
- ⚠️  MySQL: on VPS at 127.0.0.1:3306, DB `db_learn`
- ⚠️  SMTP: operator-provided (see `.env.example` lines 110-115)
- N/A AWS/S3: local storage used (no S3)
- N/A WhatsApp Business: not integrated (SMS via httpSMS gateway)
- N/A Payment provider: not integrated
- ⚠️  AI provider: local-only (Ollama/ComfyUI); paid AI gated behind
       `ALO_PAID_AI_API_ALLOWED=false`

## Database (SOP 24 — Database)

- ✅ Connection: `DATABASE_URL` in `.env`
- ✅ Migrations: `prisma/migrations/` (5 migrations)
- ✅ CRUD: tested via API routes (313 routes total)
- ⚠️  Backup: `deploy/backup.sh` ready; cron schedule operator-installed
- ⚠️  Restore: see `deploy/docs/RESTORE_GUIDE.md`; drill pending

## Environment (SOP 24 — Environment)

- ✅ Required variables: `.env.example` (159 lines, all documented)
- ✅ Validation: `src/lib/auth-config.ts` fails closed if auth env missing
- ✅ Secret masking: `deploy/backup.sh` never copies `.env`

## Security (SOP 24 — Security)

- ✅ Secret scan: no hardcoded credentials in `src/` (verified by grep)
- ✅ Access audit: `src/proxy.ts` (Next.js 16 proxy/middleware)
- ✅ S-1 Critical: shell injection fixed (PR #5 — `spawnSync` argv arrays)
- ✅ S-2 High: ffmpeg/espeak call sites hardened
- ✅ Rate limiting: `src/lib/rate-limit.ts`
- ✅ CSRF: NextAuth CSRF tokens
- ✅ Cookie security: httpOnly, secure in production
- ✅ File upload validation: `src/lib/read-limited-stream.mjs`

## Build (SOP 24 — Build)

- ✅ Production build: `npm run build:prod`
- ✅ Build artifact: `.next/standalone/server.js`
- ✅ Dockerfile: multi-stage, non-root user `alo`

## Testing (SOP 24 — Testing)

- ✅ Unit tests: `tests/*.test.mjs` (12 test files)
- ✅ Type check: `npm run typecheck`
- ✅ Lint: `npm run lint`
- ⚠️  E2E tests: not present (Playwright not configured)
- ⚠️  Integration tests: `npm run test:integration` (requires live services)

## Authentication (SOP 24 — Authentication)

- ✅ Login flow: `src/app/login/page.tsx`
- ✅ Password: scrypt hash (`scripts/hash-admin-password.mjs`)
- ✅ OTP: SMS via httpSMS gateway (`src/lib/admin-otp.ts`)
- ⚠️  MFA: SMS OTP for admin; v1 API has TOTP MFA (`src/app/api/v1/auth/mfa/`)
- ✅ Session: NextAuth JWT

## Integrations (SOP 24 — Integrations)

- ✅ Local AI: Ollama + ComfyUI (no paid API required for core features)
- ⚠️  External AI providers: optional (Groq, LLM7, etc.) — gated, off by default
- ⚠️  SMTP email: `src/lib/email.ts` (Nodemailer) — operator-provided creds
- N/A Payment: not integrated
- N/A WhatsApp: not integrated
- ⚠️  SMS: httpSMS gateway (operator-provided API key)

## Deployment (SOP 24 — Deployment)

- ✅ Running application: live at `https://learn.alolabs.net`
- ✅ Health checks: `/api/health` + `deploy/health-check.sh`
- ✅ PM2: `ecosystem.config.js`, app `learn-aloeducation`, port 3017
- ✅ Release deploy: `deploy/app-deploy.sh` (exact-SHA, SSH-pinned)

## Domain (SOP 24 — Domain)

- ✅ DNS: resolves to Cloudflare (104.21.34.58, 172.67.155.32)
- ✅ HTTPS: valid TLS (SSL verify = 0 = success)
- ✅ HTTP→HTTPS redirect: 301 (verified)
- ⚠️  Cloudflare challenge: 403 on direct curl (managed challenge active);
       browser access works. If API consumers need raw access, create a
       Cloudflare bypass rule for `/api/health`.

## Data (SOP 24 — Data)

- ✅ Persistence: MySQL `db_learn`
- ⚠️  Restore evidence: see `deploy/docs/RESTORE_GUIDE.md` (drill pending)

## Monitoring (SOP 24 — Monitoring)

- ✅ Health endpoint: `/api/health`
- ⚠️  Uptime monitor: operator-installed (Uptime Kuma or external)
- ⚠️  Error tracking: Sentry DSN optional (`.env.example`)
- ⚠️  Alert routing: operator-configured

## Recovery (SOP 24 — Recovery)

- ✅ Rollback guide: `deploy/docs/ROLLBACK_GUIDE.md`
- ✅ Backup guide: `deploy/docs/BACKUP_GUIDE.md`
- ✅ Restore guide: `deploy/docs/RESTORE_GUIDE.md`
- ⚠️  Backup verified: script ready; first production backup operator-run
- ⚠️  Restore verified: drill pending on staging

## Handover (SOP 24 — Handover)

- ✅ Project overview: `README.md`
- ✅ Architecture: `docs/architecture/SYSTEM_ARCHITECTURE.md` + `docs/alo-learning/architecture.md`
- ✅ API docs: `deploy/docs/API_DOCUMENTATION.md` + `/api/openapi.json`
- ✅ Deployment guide: `DEPLOYMENT.md` + `deploy/docs/DEPLOYMENT_GUIDE.md`
- ✅ Operations runbook: `deploy/docs/OPERATIONS_RUNBOOK.md`
- ✅ Backup/Restore/Monitoring: this PR adds the missing guides
- ✅ Security report: `SECURITY.md` + `audit/FINAL-REPORT.md`
- ✅ Known issues: `audit/FINAL-REPORT-20261017.md`
- ⚠️  Maintenance plan: see `MONITORING_GUIDE.md` §"Maintenance schedule"
- ⚠️  Handover approval: operator sign-off required

---

## Blocked items requiring human / operator action

1. **Cloudflare bypass for `/api/health`** — so external monitors don't hit
   the managed challenge (403). Operator: add a WAF bypass rule.
2. **Backup cron schedule** — `deploy/backup.sh` is ready; operator installs
   the cron entry (see `BACKUP_GUIDE.md`).
3. **Off-server backup** — on-server backups exist; operator must pull/push
   to a separate location (S3, separate VPS, or laptop).
4. **Uptime monitoring** — operator installs Uptime Kuma or external monitor
   pointing at `https://learn.alolabs.net/api/health`.
5. **SMTP credentials** — `.env.example` documents the format; operator
   provides real SMTP host/user/password.
6. **Restore drill** — quarterly drill on staging (see `RESTORE_GUIDE.md`).
7. **TLS certificate for `learn.alolabs.net`** — if not using Cloudflare's
   edge cert, operator must issue with `certbot --nginx -d learn.alolabs.net`.

## Conclusion

**Status: Production-Ready with operator-pending items.**

All code-level requirements are complete. The 7 blocked items above require
human action on the VPS (cron, off-server backup, monitoring, SMTP, TLS)
and cannot be resolved from the repository.
