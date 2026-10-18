# ALO Learning Journey — Project Overview (not production sign-off)

> **Production status: NOT VERIFIED / NOT READY.** This document describes
> repository source only. No live server, production database, credentials,
> domain, HTTPS, authentication provider, Docker runtime, or deployment was
> accessed in the current audit. Follow [`DEPLOYMENT.md`](./DEPLOYMENT.md) and
> [`MIGRATION-RECOVERY-PLAN.md`](./MIGRATION-RECOVERY-PLAN.md) before any
> production action.

## Local development

The project is a Next.js application using Node.js 22, npm, Prisma, and MySQL.
`package-lock.json` is the npm lockfile. Use only a disposable/local development
database; do not copy production credentials into this checkout.

```bash
npm ci
cp .env.example .env
# Set DATABASE_URL to a disposable development MySQL database.
npx prisma generate
npm run dev
```

The package scripts `db:push`, `db:migrate`, and `db:reset` route through
`scripts/prisma-dev-guard.mjs`. They refuse production mode and require a clearly
named dev/test database plus exact database-name confirmations. A remote dev
DB additionally requires an explicit remote allow-list. Never use these
commands against production. The production migration path uses the checked-in
migration chain only after the review and restore requirements in
`MIGRATION-RECOVERY-PLAN.md`.

## Source-level feature inventory (not runtime proof)

The repository includes UI/API source for content workflows, approvals,
analytics, RAG, admissions CRM, quotations, AI/media generation, family media,
backups, and operations. Source presence does not prove a provider is
configured or a workflow succeeds live.

- **AI and media:** local Ollama/ComfyUI/speech/FFmpeg paths and deterministic
  template/media fallbacks exist in source. Models, binaries, licenses,
  hardware performance, production concurrency, and output quality have not
  been verified on the production host. Local fallbacks are not provider output.
- **Social/OAuth:** social connection credentials and callback integration are
  not implemented; the UI/API reports external setup is required.
- **Telegram-named feature:** `/api/telegram` and its UI are an admin-only
  in-app command console. There is no Telegram webhook, outbound message
  delivery, or scheduled report integration.
- **Publishing/email:** drafts and local status records do not demonstrate
  external publishing or email delivery. Provider credentials and delivery
  status are not asserted as verified.
- **Agents/jobs:** agent definitions and on-demand run records exist. A
  production background scheduler/worker has not been verified.

## Database and data handling

Prisma is configured for MySQL. The current schema contains 32 models; the
checked-in migration chain declares those model tables plus one implicit
relation table across three migrations. Static table-name checks are not live
schema/history verification. Production schema, migration history/checksums,
and user-reported missing tables remain unverified.

The application backup API writes AES-256-GCM-encrypted record snapshots with
strict file permissions and requires a dedicated 32+ character
`BACKUP_ENCRYPTION_KEY` in production. These snapshots are marked partial when
models fail or are excluded, omit OTP challenges, and **cannot restore a
production database**. Their integrity `verify` action is not a database
restore. The deploy script's MySQL dump gzip/content probe also is not a restore
test. Maintain an independent, tested database backup and follow the migration
recovery runbook.

CRM leads and quotations can contain personal contact details. Minimize data,
restrict exports, follow an approved retention policy, and do not store
passports, immigration case files, health data, or payment-card details without
an approved security/compliance design.

## Authentication and production limitations

The source implements a single-administrator credentials/session flow with
production fail-closed middleware and an optional/required OTP flow depending
on environment configuration. This does not provide RBAC, multi-user/team
isolation, public-user identity management, or a general IP-based rate limit.
The SMS gateway's accepted/queued response does not prove carrier/handset
delivery. Production login, proxy cookie behavior, SMS, and route-level
authorization have not been end-to-end verified in this audit.

See [`SECURITY.md`](./SECURITY.md) for source-level controls and limitations.
Do not expose this app publicly until the blockers in `DEPLOYMENT.md` and the
post-repair audit are resolved.
