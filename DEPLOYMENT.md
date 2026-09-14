# ALO Learning Journey — Production Deployment Guide

## Prerequisites
- Node.js 22+ / Bun 1.3+
- SQLite (or MySQL for production)
- Caddy or Nginx (reverse proxy)
- PM2 (process manager)
- FFmpeg + espeak (for video/TTS features)

## Local Development
```bash
bun install
cp .env.example .env  # Edit with your values
bunx prisma generate
bunx prisma db push
bun run dev  # Starts on port 3000
```

## Production Build
```bash
bun install --frozen-lockfile
bunx prisma generate
bunx prisma db push
bun run build
```

## Production Start
```bash
PORT=3017 NODE_ENV=production bun .next/standalone/server.js
# Or with PM2:
pm2 start ecosystem.config.js
```

## VPS Deployment via GitHub Actions
1. Set GitHub Secrets:
   - VPS_HOST: your server IP
   - VPS_USER: SSH username
   - VPS_SSH_KEY: SSH private key
   - VPS_APP_PATH: /home/aloedu/learn-app
2. Push to main branch
3. GitHub Actions auto-deploys

## Health Check
```bash
curl -f http://localhost:3017/api/health
```

The endpoint performs **real** probes and its HTTP status is meaningful:

| HTTP | `status` | Meaning |
|---|---|---|
| 200 | `ok` | every critical check passed |
| 200 | `degraded` | critical checks passed; an optional capability (FFmpeg, espeak) is missing |
| 503 | `unhealthy` | a **critical** check failed — database, `DATABASE_URL`, or storage is not usable |

Critical checks: `DATABASE_URL` set, a real `SELECT 1` round-trip, a real
`Company.count()` (proves the schema was actually pushed), and write access to
`storage/videos` + `storage/backups`. Optional: `ffmpeg`, `espeak`.

Use `curl -f` so a 503 fails the command. The response also includes
`summary.failedCritical` (names only) and `checkedAt`.

> Historical note: this endpoint used to return a **hardcoded** array — `Database:
> ok: true` was never a query and four capabilities were hardcoded `false`, so it
> always answered HTTP 200 with `"status":"PARTIAL"`, healthy or not. Older docs
> listing `PARTIAL` as "Expected" described that bug, not correct behaviour. A
> `legacyStatus` field is still emitted for anything reading the old shape.
> See `audit/02-VERIFIED-FINDINGS.md` F1.

## Build-time network requirements

`bun run build` needs outbound HTTPS to **two** hosts, or it fails:

- `binaries.prisma.sh` — Prisma engine binaries, downloaded by `prisma generate`.
  Without it the build dies at *"Collecting page data"* with
  `@prisma/client did not initialize yet`.
- `fonts.googleapis.com` — `next/font/google` (Geist, Geist Mono) fetches font
  files **at build time**. Without it the build dies with
  `next/font: error: Failed to fetch Geist from Google Fonts`.

Verify on the VPS before deploying:
```bash
curl -sS -o /dev/null -w 'prisma  %{http_code}\n' --max-time 10 https://binaries.prisma.sh/
curl -sS -o /dev/null -w 'gfonts  %{http_code}\n' --max-time 10 https://fonts.googleapis.com/
```
If either is blocked, self-host the fonts via `next/font/local` and pre-cache the
Prisma engines. `src/app/layout.tsx` also hotlinks Hind Siliguri (the Bengali UI
font) from Google at **runtime**, which is worth self-hosting too.

## Rollback

> ⚠ `git checkout PREVIOUS_COMMIT_SHA` only works once the repository **has**
> more than one commit. At the time of the audit `main` contained exactly **one**
> commit (`e95b39b`), so there was no previous commit to check out and this
> procedure could not work. See `audit/02-VERIFIED-FINDINGS.md` F10.

`deploy.yml` now records the pre-deploy SHA and rolls back automatically if the
build produces no artifact or the health check fails:

```bash
cd /home/aloedu/learn-app
cat .releases/last-known-good          # the SHA to return to
git checkout "$(cat .releases/last-known-good)"
bun install --frozen-lockfile
bunx prisma generate
bun run build
test -f .next/standalone/server.js || echo "STILL BROKEN — restore from .backups/"
pm2 restart alo-learning-journey --update-env
```

If `prisma db push` changed the schema, reverting the code is **not enough** —
the database is shared across releases. Restore it from the backup the deploy
took before touching anything:

```bash
ls -1t .backups/ | head -1                                  # newest backup dir
sqlite3 ".backups/<TS>/db.sqlite" "PRAGMA integrity_check;" # must print ok
pm2 stop alo-learning-journey
cp db/custom.db db/custom.db.bad-$(date -u +%s)             # keep the suspect file
cp ".backups/<TS>/db.sqlite" db/custom.db
sqlite3 db/custom.db "PRAGMA integrity_check;"              # must print ok
pm2 restart alo-learning-journey --update-env
```

For a proper staged release with atomic symlink swap — the pattern that makes
rollback a single `ln -sfn` and needs no rebuild — see
`audit/03-DEPLOY-ROLLBACK-RUNBOOK.md`.

## Environment Variables
See `.env.example` for all required variables.
Never commit `.env` files to Git.
