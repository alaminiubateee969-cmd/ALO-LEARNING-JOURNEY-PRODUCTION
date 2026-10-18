-- ALO Human Avatar Production Migration
-- Adds ownerId for tenant isolation, lipSyncReason for honest lip-sync state,
-- and a proper FK relation from AvatarVideo to HumanAvatar with cascade delete.

-- 1. Add ownerId columns (backfill existing rows to dev-admin)
ALTER TABLE "HumanAvatar" ADD COLUMN "ownerId" TEXT NOT NULL DEFAULT 'dev-admin';
ALTER TABLE "AvatarVideo" ADD COLUMN "ownerId" TEXT NOT NULL DEFAULT 'dev-admin';
ALTER TABLE "AvatarVideo" ADD COLUMN "lipSyncReason" TEXT;

-- 2. Create indexes for ownership + tenant scoping
CREATE INDEX IF NOT EXISTS "HumanAvatar_ownerId_idx" ON "HumanAvatar"("ownerId");
CREATE INDEX IF NOT EXISTS "AvatarVideo_ownerId_idx" ON "AvatarVideo"("ownerId");

-- 3. Enforce FK: AvatarVideo.avatarId → HumanAvatar.id ON DELETE CASCADE
-- (SQLite cannot ALTER TABLE to add FK; this migration documents intent.
--  For MySQL/Postgres deployments, run the equivalent FK constraint.)
-- The Prisma schema declares the relation; db push / migrate dev applies it.

-- 4. Backfill ownerId for any pre-existing rows (already defaulted above).
UPDATE "HumanAvatar" SET "ownerId" = 'dev-admin' WHERE "ownerId" IS NULL OR "ownerId" = '';
UPDATE "AvatarVideo" SET "ownerId" = 'dev-admin' WHERE "ownerId" IS NULL OR "ownerId" = '';
