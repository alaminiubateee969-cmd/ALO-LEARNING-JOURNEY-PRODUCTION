# ALO Learning Journey — Deployment and Verification

> **Current status: BLOCKED — NOT PRODUCTION VERIFIED.** This is a repository-side review, not a claim about the Ubuntu host. No SSH connection, production database, reverse proxy, DNS, certificate, or live application was verified. Do not run the existing automatic deployment workflow until the blockers below are addressed.

## Repository facts

- Framework: Next.js 16.1.1 with standalone output.
- Package manager: Bun (`bun.lock` is the only lockfile). The requested runtime target is Node 22; `package.json` now declares Node 22 and starts the standalone server with `node`. The actual server runtime remains unverified.
- ORM/database: Prisma 6.11.1, MySQL provider. The schema has 27 models; **`prisma/migrations/` does not exist**.
- Intended application endpoint: `127.0.0.1:3017` (repository config only; live listener is unverified).
- `Caddyfile` is a repository config example for `learn.aloeducation.com` → `127.0.0.1:3017`; it does not prove Caddy is installed or configured on the production host. No live Nginx/Caddy configuration was inspected.
- No production `.env` is present in this checkout. `.env.example` is not a production configuration and contains no real credentials.

## Production blockers

1. **Authentication and authorization are not implemented.** The `next-auth` package is installed but there is no auth handler, session validation, middleware, user model, login, or RBAC. All 39 API route files are unguarded. Do not expose the application publicly.
2. **Database change strategy is not production-safe yet.** The schema is MySQL, but there are no migrations. Do not run `prisma db push` or `prisma migrate reset` against production. First inspect and back up the real MySQL database, establish a reviewed baseline/migration plan, then verify it against the live schema.
3. **The workflow on the audited `main` commit is not safe to run.** At SHA `03361c5f6bf19727907452ed0edc5247948b9466`, `.github/workflows/deploy.yml` auto-triggered on `main`, assumed Bun and PM2, defaulted to the unverified path `/root/alo-github-verify`, had no verified SSH host-key pin, only implemented a SQLite backup path (not a MySQL backup), ran `prisma db push`, did not reliably pass the workflow commit SHA to the remote shell, and contained `|| true` failure suppression. This working branch replaces that workflow with a manual fail-closed gate; **it does not deploy**. Merge only after reviewing the gate and completing the actual host, authentication, migration, and rollback audit.
4. **Host details and server state are unknown.** The actual host/IP, SSH port/user, application user/path, Ubuntu version, Node/MySQL/Redis versions, process manager, listeners, firewall, and deployed SHA have not been inspected. Values in old repository docs/config are not verified and must not be reused.
5. **Production integrations are not wired/verified.** The source uses `z-ai-web-dev-sdk` with local fallbacks; it does not contain an OpenAI, Redis, n8n, or Resend adapter. Redis/N8N/Resend must not be reported healthy based on environment-variable names alone.
6. **Upload storage is not configurable as documented.** `src/app/api/family-studio/route.ts` writes under `process.cwd()/storage/uploads/family`; it does not use `UPLOAD_DIR`. Upload validation, access control, and the production storage path need review before accepting real uploads.
7. **Repository history contains public business data.** The GitHub repository is public. Commit `e95b39b` contains `storage/backups/backup_1786236820070.alo.bak`, a 266,240-byte XOR-obfuscated SQLite snapshot. It decodes to 15 tables and 383 rows. The file was removed from the current tree but remains reachable in Git history. No high-confidence credential pattern was found in the targeted scan; that does not undo the business-data exposure. See `SECURITY.md` and `audit/05-EXPOSURE-REMEDIATION.md`.
8. **Build and application tests are not verified in this environment.** This checkout has Bun lockfile but Bun is not installed, there is no `node_modules`, and there is no npm lockfile. The latest GitHub `Deploy to VPS` run (2026-09-30, SHA `03361c5f6bf19727907452ed0edc5247948b9466`) failed; its log could not be retrieved, so the precise failure is unknown. No successful CI validation or deployed SHA was established.

## Safe repository checks

Use the project's lockfile/package manager; do not substitute `npm ci` (there is no `package-lock.json`). On a machine with Bun 1.3+ and Node 22 installed:

```bash
bun install --frozen-lockfile
bun run lint
bun run typecheck
DATABASE_URL='mysql://user:placeholder@127.0.0.1:3306/db_learn' bunx prisma validate
DATABASE_URL='mysql://user:placeholder@127.0.0.1:3306/db_learn' bunx prisma generate
bun run build
```

There is currently no test script/test suite configured. A green build alone does not verify database migrations, authentication, external services, or production operation.

For development only, `bun run db:push` is a schema-sync convenience, not a production migration strategy. Never run `bun run db:push`, `bun run db:reset`, or `prisma db push` on production without a reviewed plan, a verified backup, and explicit approval.

## Host verification required before any deployment

Run these on the actual server using its verified access path; do not infer results from this repository:

```bash
cat /etc/os-release
uname -a
node -v && npm -v
mysql --version
redis-server --version
nginx -v 2>&1
sudo systemctl status mysql redis-server nginx --no-pager
sudo ss -lntp
sudo ufw status verbose
systemctl list-units --type=service --state=running
```

Identify the actual application service/process manager, application user/path, and reverse proxy before changing them. Do not expose SSH private keys, database passwords, or API keys in chat or Git. Store deployment credentials only in protected GitHub Actions secrets and verify the server ED25519 host fingerprint out-of-band.

## Required post-deployment checks

Only after authentication, migrations, backup/rollback, and deployment workflow are made safe, verify from the real host and an independent client:

```bash
curl -i http://127.0.0.1:3017/
curl -i http://127.0.0.1:3017/api/health
curl -i https://learn.aloeducation.com/
curl -i https://learn.aloeducation.com/api/health
curl -I http://learn.aloeducation.com/
echo | openssl s_client -connect learn.aloeducation.com:443 \
  -servername learn.aloeducation.com 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
```

Record the workflow SHA and server `git rev-parse HEAD`; they must match. Test real login/session/protected API behavior, database read/write, and every integration that the production application actually depends on. Mark anything not exercised as **NOT VERIFIED**.
