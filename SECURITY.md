# Security posture and operational limits

> **Source-level guidance, not a security certification.** Production host,
> production database, GitHub secrets/environment rules, live TLS/proxy behavior,
> and network controls were not accessed in this audit. See
> [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the current release blockers.

## Authentication and authorization

- Source uses a single-administrator credentials/session flow. Middleware
  protects application pages and API routes in production unless a path is
  explicitly public. Authentication configuration is intended to fail closed
  if required production settings are absent.
- Optional OTP behavior depends on production environment configuration and an
  HTTPSMS-compatible gateway. An HTTP accepted/queued response is not proof of
  SMS delivery. No live carrier delivery or production login was verified.
- Development mode bypasses auth unless `ALO_REQUIRE_AUTH=true`. Never connect
  development/preview mode to real production data.
- This is not RBAC, multi-user/team isolation, or identity-bound tenant
  authorization. The company/workspace selector must not be treated as a
  security boundary.
- There is no verified general IP-based login/API rate limiting or abuse
  protection. Put suitable rate limits and request-size limits at a trusted
  edge before public exposure.

## Secrets and environment

- Never commit `.env`, production database URLs, API keys, SSH keys, backups, or
  database dumps. `.env.example` contains placeholders and operator notes only.
- Store secrets in the approved runtime/GitHub secret manager. Rotate any
  credential suspected of exposure; do not paste it in chat, reports, URLs, or
  process arguments.
- The application requires a real MySQL `DATABASE_URL` in production; the
  local JSON fallback is development-only. Production must fail closed rather
  than silently persisting demo data.
- Development schema scripts (`db:push`, `db:migrate`, `db:reset`) are guarded
  by `scripts/prisma-dev-guard.mjs`. They require non-production mode, a
  clearly named dev/test database, and exact database-name confirmations. A
  remote dev database requires an additional explicit allow-list. This is a
  guardrail, not a proof that an operator has selected the correct database.

## Backups and restoration

- The application backup endpoint encrypts its per-model record snapshots with
  AES-256-GCM, writes files with restrictive permissions, and requires a
  dedicated 32+ character `BACKUP_ENCRYPTION_KEY` in production.
- Those snapshots are **partial and non-restorable**: OTP challenges are
  excluded, per-model reads can fail, and the API does not restore the database.
  The `verify`/legacy `restore` action only checks encrypted payload integrity
  and reports `restorePerformed: false`.
- The deployment script separately creates a MySQL dump and checks compressed
  integrity and schema content. This is not an isolated restore test.
- Do not rely on either mechanism as the only production recovery point. Follow
  [`MIGRATION-RECOVERY-PLAN.md`](./MIGRATION-RECOVERY-PLAN.md) for an independent
  backup, isolated restore, and migration rehearsal. No production restore was
  demonstrated in this audit.

## API validation and data minimization

- Routes require a route-by-route review of authentication, authorization,
  origin/CSRF rules, validation, rate limits, upload limits, and error handling.
  Typecheck/lint/static tests do not prove those runtime properties.
- CRM records may include names, phone numbers, email, consent status, and
  notes. Minimize collection, restrict CSV/export access, define retention and
  deletion procedures, and do not store passports, immigration files, health
  information, or payment-card data without an approved security design.
- Never treat `consentStatus` as proof of lawful basis or permission to send.

## Integrations and external status

- Social OAuth is not implemented; provider credentials are reserved and the
  connect flow reports external setup is required.
- The Telegram-named API/UI is an in-app admin command console, not a Telegram
  bot integration. No Telegram webhook, message sending, or report scheduler is
  configured.
- Local AI/media adapters and template fallbacks do not prove a local model is
  installed or a provider is available. No external delivery is verified by a
  local status record alone.
- Draft generation, saved analytics, and publishing-status records must not be
  described as external delivery or live provider verification without runtime
  evidence.

## Dependency and infrastructure verification

Run the final dependency audit and checks recorded in
[`POST-REPAIR-AUDIT-REPORT.md`](./POST-REPAIR-AUDIT-REPORT.md). Prior reports
under `audit/` are historical snapshots and may contain obsolete model counts,
backup descriptions, routes, provider claims, or server paths. They are not
current production evidence.

Production security headers, HTTPS certificate state, reverse proxy, firewall,
PM2 configuration, Docker, monitoring/alerts, system logs, DB grants, and
storage permissions all require a read-only live infrastructure inspection
and authorized runtime verification. None is certified by this file.
