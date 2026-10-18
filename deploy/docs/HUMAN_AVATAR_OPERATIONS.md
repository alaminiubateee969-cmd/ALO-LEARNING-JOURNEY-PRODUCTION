# Human Avatar Operations — Current Limitations and Safe Checks

This runbook is repository-level guidance only. The production host and media directories have not been verified. Confirm the live app root and release layout read-only before inspecting or touching files. The operator-provided target is `/home/aloedu/LEARNING-JOURNEY`, PM2 `learn-aloeducation`, port `3017`; do not assume it is live.

## What the video pipeline currently does

When all configured local/provider dependencies are available, the route drafts a script, creates scene audio and still images, and uses FFmpeg to assemble motion clips. The route validates that the final file has video and audio streams and expects a 1080x1920 output. These checks do not certify content accuracy, face consistency, visual quality, consent, or child safety.

The lip-sync adapter exists in the repository, but its output is not integrated into the final compositor. The generation route does not call it and records `lipSyncUsed=false` with `lipSyncReason=not_integrated`. Do not claim that generated videos are lip-synced. Older rows with `lipSyncUsed=true` contain unverified legacy metadata, not proof that the final video contains lip-sync. TTS and image generation depend on configured services/tools; do not assume they are installed or available.

## Read-only checks

After verifying host identity and authorization, inspect PM2 without changing it:

```bash
pm2 jlist
pm2 describe learn-aloeducation
pm2 logs learn-aloeducation --lines 50 --nostream
ss -lnt
```

The expected app port is `3017`. If the process is absent or not online, stop; the release deployment script will not start it. Do not restart, resurrect, or replace PM2 services without an approved first-install/recovery plan.

Use the guarded health script only after confirming the correct host and process. `/api/health` has a public minimal response; detailed checks require the authenticated admin session. A health response is not proof of user-flow, database-history, backup, or public-domain correctness.

## Data and media handling

Avatar/video delete APIs remove database records and files. Treat deletion as destructive. Do not use them for cleanup until the owner/retention decision and verified backup are explicit. Never delete files by wildcard, move/overwrite existing assets, or copy a production asset set into Git. Preserve unknown assets until provenance and use are reviewed.

For incident response, record release SHA, job ID, relevant redacted logs, and a private media/database backup reference. Do not log prompts containing personal data, session tokens, `.env` values, or database rows. Do not add new third-party or paid services without approval.

## Related documents

- [`DEPLOYMENT.md`](../../DEPLOYMENT.md)
- [`MIGRATION-RECOVERY-PLAN.md`](../../MIGRATION-RECOVERY-PLAN.md)
- [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md)
