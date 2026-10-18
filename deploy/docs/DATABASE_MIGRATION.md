# Database Migration Guide

## Provider
SQLite (dev, default) — `DATABASE_URL="file:./db/custom.db"`
MySQL/Postgres (prod) — set `DATABASE_URL` accordingly.

## Schema (Human Avatar system)

### HumanAvatar
- `id` (cuid PK), `ownerId` (tenant isolation), `name`, `persona`, `gender`, `ageRange`
- `faceDescription`, `voiceProfile`, `voiceSpeed`, `consistencySeed`
- `portraitUrl`, `portraitStatus` (pending|generated|failed)
- `outfitStyle`, `sceneContext`, `active`, `videoCount`
- Indexes: `ownerId`, `persona`, `active`

### AvatarVideo
- `id`, `ownerId`, `avatarId` (FK → HumanAvatar ON DELETE CASCADE)
- `prompt`, `script`, `scenesJson`, `targetDuration`, `actualDuration`
- `videoUrl`, `thumbnailUrl` (signed-token URLs)
- `status` (pending|scripting|generating_audio|generating_images|composing|completed|failed)
- `progress` (0-100), `currentStep`, `errorMessage`
- `lipSyncUsed` (true ONLY on verified success), `lipSyncReason` (success|not_configured|http_error|invalid_output|timeout|provider_error)
- `quality` (standard|hd|cinematic)
- Indexes: `ownerId`, `avatarId`, `status`

## Migration File
```
prisma/migrations/20261007000000_human_avatar_ownership/migration.sql
```
Additive: adds `ownerId` + `lipSyncReason` columns + indexes. Backfills existing rows to `ownerId='dev-admin'`. No destructive changes.

## Apply

### Development (fast)
```bash
bun run db:push
```

### Production (reproducible)
```bash
bun run db:migrate:deploy
```

## Backfill / Reassign Ownership
```sql
UPDATE HumanAvatar SET ownerId = '<real-user-id>' WHERE name = 'Megha';
UPDATE AvatarVideo SET ownerId = '<real-user-id>'
WHERE avatarId IN (SELECT id FROM HumanAvatar WHERE ownerId = '<real-user-id>');
```

## Foreign Key Cascade
`AvatarVideo.avatarId` → `HumanAvatar.id` with `ON DELETE CASCADE`. Use the `DELETE /api/human-avatars` endpoint to also clean up files on disk.
