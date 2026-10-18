# Rollback Guide

## A. Code rollback
```bash
git checkout <previous-commit>
bun install && bun run build:prod && bun run start:prod
```

## B. DB rollback (additive migration — safe to reverse)
```sql
-- SQLite ≥ 3.35
DROP INDEX IF EXISTS "HumanAvatar_ownerId_idx";
DROP INDEX IF EXISTS "AvatarVideo_ownerId_idx";
ALTER TABLE "HumanAvatar" DROP COLUMN "ownerId";
ALTER TABLE "AvatarVideo" DROP COLUMN "ownerId";
ALTER TABLE "AvatarVideo" DROP COLUMN "lipSyncReason";
```
Only do this if also reverting the code (auth-scoped queries require `ownerId`).

## C. Data-level rollback (single avatar/video)
```bash
# Delete a video + files
curl -X DELETE https://your-domain/api/avatar-video \
  -H "Content-Type: application/json" -d '{"id":"<video-id>"}'

# Delete an avatar + cascade
curl -X DELETE https://your-domain/api/human-avatars \
  -H "Content-Type: application/json" -d '{"id":"<avatar-id>"}'
```

## D. Recover from failed generation
```bash
# Mark all stuck jobs as failed (idempotent)
curl -X POST -H "x-cron-secret: $CRON_SECRET" \
  "https://your-domain/api/recovery/sweep?timeoutMinutes=1"
```

## Safety
- All migrations are additive (no destructive schema changes)
- File cleanup only deletes within approved storage roots
- Deleting avatar cascades to videos (records + files)
- Deleting video removes MP4 + thumbnail + per-scene audio/images
