# ALO Learning Journey — Project Overview (Not Production Verified)

> **This file is not a production sign-off.** The application, server, database, domain, HTTPS, authentication, and external services have not been verified live. Do not expose this application publicly until the blockers in `SECURITY.md` and `DEPLOYMENT.md` are resolved.

## Local development only

The repository uses Bun (`bun.lock`) for dependency management and Prisma with MySQL. Configure a development MySQL database; do not copy production credentials into this checkout.

```bash
bun install --frozen-lockfile
cp .env.example .env
# Edit .env with a development-only MySQL URL.
bunx prisma generate
bun run db:push  # development only; never use as a production migration
bun run dev       # development server on port 3000
```

Production standalone startup is configured for Node.js 22 and the intended application port 3017, but the actual production server has not been inspected.

## Feature inventory — source presence is not live verification

The repository contains UI/API code for content generation, approvals, analytics, RAG, social integrations, Telegram, video, family media, backups, and operations. Some paths use local fallbacks or demo behavior. Their presence does not prove that an external provider is configured or that a production workflow succeeds.

The AI implementation currently imports `z-ai-web-dev-sdk`; there is no OpenAI adapter. Redis, n8n, and Resend integrations are not present in the application source. Do not describe those services as working until the corresponding application-level tests pass.

The backup route's XOR obfuscation is **not encryption** and is not a safe production backup. It copies a local SQLite file even though Prisma is configured for MySQL. Do not rely on it for production backup or rollback.

## Production status

- Authentication/RBAC: not implemented; all 39 API route files are unguarded.
- Database: MySQL Prisma schema exists, but no checked-in migration history exists.
- Upload storage: current code writes below the process working directory and does not honor the configured `UPLOAD_DIR`.
- Deployment: the current working branch has a fail-closed deployment gate; it will not deploy. The audited `main` workflow at `03361c5f6bf19727907452ed0edc5247948b9466` used unverified host/path/process assumptions and must not be run.
- Build, login/session, API, storage, integrations, DNS, HTTPS, and live health: not verified.

See `DEPLOYMENT.md`, `SECURITY.md`, and `audit/` for the evidence and required follow-up.
