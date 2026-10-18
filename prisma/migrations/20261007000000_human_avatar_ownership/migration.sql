-- MySQL-only additive schema for HumanAvatar and AvatarVideo.
--
-- The SQLite version of this migration was never a valid production migration.
-- This file creates the final MySQL shape on a clean database. If either table
-- already exists, CREATE TABLE fails closed; stop and reconcile migration
-- history/schema against a restored production copy. Do not mark this migration
-- applied merely because the table names exist.
CREATE TABLE `HumanAvatar` (
  `id` VARCHAR(191) NOT NULL,
  `ownerId` VARCHAR(191) NOT NULL DEFAULT 'dev-admin',
  `name` VARCHAR(191) NOT NULL,
  `persona` VARCHAR(191) NOT NULL,
  `gender` VARCHAR(191) NOT NULL,
  `ageRange` VARCHAR(191) NOT NULL,
  `ethnicity` VARCHAR(191) NOT NULL DEFAULT 'south-asian',
  `faceDescription` TEXT NOT NULL,
  `voiceProfile` VARCHAR(191) NOT NULL,
  `voiceSpeed` DOUBLE NOT NULL DEFAULT 0.95,
  `backgroundStory` TEXT NULL,
  `consistencySeed` VARCHAR(191) NULL,
  `portraitUrl` VARCHAR(191) NULL,
  `portraitStatus` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `outfitStyle` VARCHAR(191) NULL,
  `sceneContext` VARCHAR(191) NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `videoCount` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `HumanAvatar_ownerId_idx` (`ownerId`),
  INDEX `HumanAvatar_persona_idx` (`persona`),
  INDEX `HumanAvatar_active_idx` (`active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AvatarVideo` (
  `id` VARCHAR(191) NOT NULL,
  `ownerId` VARCHAR(191) NOT NULL DEFAULT 'dev-admin',
  `avatarId` VARCHAR(191) NOT NULL,
  `prompt` TEXT NOT NULL,
  `script` LONGTEXT NULL,
  `scenesJson` LONGTEXT NULL,
  `targetDuration` INTEGER NOT NULL,
  `actualDuration` DOUBLE NULL,
  `videoUrl` VARCHAR(191) NULL,
  `thumbnailUrl` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `progress` INTEGER NOT NULL DEFAULT 0,
  `currentStep` VARCHAR(191) NULL,
  `errorMessage` VARCHAR(191) NULL,
  `lipSyncUsed` BOOLEAN NOT NULL DEFAULT false,
  `lipSyncReason` VARCHAR(191) NULL,
  `quality` VARCHAR(191) NOT NULL DEFAULT 'standard',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `AvatarVideo_ownerId_idx` (`ownerId`),
  INDEX `AvatarVideo_avatarId_idx` (`avatarId`),
  INDEX `AvatarVideo_status_idx` (`status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `AvatarVideo_avatarId_fkey` FOREIGN KEY (`avatarId`)
    REFERENCES `HumanAvatar` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
