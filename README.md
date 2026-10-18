# ALO Learning Journey

This repository contains the existing ALO Learning Journey application and its release/deployment tooling. It is not a replacement application.

## Release status

**Production release and PR #19 are not approved to merge/deploy yet.** This repair has not accessed the VPS, production MySQL, or public domain. The merge of `main` is committed and pushed on the fixed Arena branch as an update to existing PR #19; the PR remains open pending clean merge state, passing checks, and review. See the current readiness report for the latest CI result.

The repository currently declares package version `0.2.1`. No `v2.0.0` tag or GitHub release has been verified. The current [`deploy/RELEASE_MANIFEST.txt`](./deploy/RELEASE_MANIFEST.txt) is a repository-only status record, not evidence that a release shipped; see it and the readiness report for current repository-only evidence.

Operator-provided (not independently verified) production settings:

- App directory: `/home/aloedu/LEARNING-JOURNEY`
- PM2 process: `learn-aloeducation`
- Port: `3017`
- Domain: `https://learn.aloeducation.com`
- MySQL: `db_learn` at `127.0.0.1:3306`

Preserve the existing MySQL database, legacy admissions/OTP data, user assets, and relationships. Do not run an unverified migration or `prisma migrate deploy` against production. The required baseline reconciliation and restored-copy rehearsal are documented in [`MIGRATION-RECOVERY-PLAN.md`](./MIGRATION-RECOVERY-PLAN.md).

## Local development

Requirements: Node.js 22.x and npm. Use a disposable development database; never point development commands at production.

```bash
npm ci
# Configure a local/test-only DATABASE_URL and local auth settings.
npm run db:generate
npm run dev
```

Available repository checks:

```bash
npm test
npm run lint
npm run typecheck
npm run verify:migrations
npm run build
```

`npm run verify:migrations` statically compares Prisma models with checked-in MySQL migrations. It does not prove compatibility with the production schema, data, migration history, or checksums. `npm run db:migrate` and related schema commands are guarded and must only target disposable development databases.

## Deployment and migration safety

Read [`DEPLOYMENT.md`](./DEPLOYMENT.md) and [`MIGRATION-RECOVERY-PLAN.md`](./MIGRATION-RECOVERY-PLAN.md) before any operational action. Deployment requires passing CI, verified backup and isolated restore evidence, exact-SHA schema/history preflight, an already healthy PM2 process, protected GitHub Environment approval, and post-deploy health checks. The deploy script deliberately refuses to start a missing PM2 process.

The generic OTP delivery endpoint is disabled until a real provider is implemented and verified. Administrator sign-in OTP is a separate flow. The content, SEO, comment, and media tools produce drafts or local outputs that still require human review; they do not constitute independent fact, safety, legal, or quality certification.
