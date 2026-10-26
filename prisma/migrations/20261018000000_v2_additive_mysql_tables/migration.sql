-- Additive MySQL-only v2 tables. MarketingLead is intentionally separate
-- from the legacy admissions Lead/LeadActivity/Quotation records.
-- OtpRequest stores only keyed hashes and a masked recipient label; never store
-- or return a raw verification code. Existing tables cause CREATE TABLE to
-- fail closed and require the restored-copy migration reconciliation procedure.

CREATE TABLE `MarketingLead` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `company` VARCHAR(191) NULL,
  `source` VARCHAR(191) NOT NULL DEFAULT 'website',
  `service` VARCHAR(191) NULL,
  `budget` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'new',
  `assignedTo` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `tagsJson` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `MarketingLead_status_idx` (`status`),
  INDEX `MarketingLead_source_idx` (`source`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Client` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NULL,
  `company` VARCHAR(191) NULL,
  `type` VARCHAR(191) NOT NULL DEFAULT 'individual',
  `status` VARCHAR(191) NOT NULL DEFAULT 'active',
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Client_email_key` (`email`),
  INDEX `Client_status_idx` (`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Project` (
  `id` VARCHAR(191) NOT NULL,
  `clientId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `service` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'inquiry',
  `budget` DOUBLE NULL,
  `deadline` DATETIME(3) NULL,
  `description` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `Project_clientId_idx` (`clientId`),
  INDEX `Project_status_idx` (`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Invoice` (
  `id` VARCHAR(191) NOT NULL,
  `clientId` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NULL,
  `amount` DOUBLE NOT NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'BDT',
  `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
  `dueDate` DATETIME(3) NULL,
  `paidAt` DATETIME(3) NULL,
  `itemsJson` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `Invoice_clientId_idx` (`clientId`),
  INDEX `Invoice_status_idx` (`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MarketingCampaign` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `channel` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
  `audienceJson` TEXT NULL,
  `content` TEXT NULL,
  `scheduledAt` DATETIME(3) NULL,
  `sentCount` INTEGER NOT NULL DEFAULT 0,
  `openCount` INTEGER NOT NULL DEFAULT 0,
  `clickCount` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `MarketingCampaign_status_idx` (`status`),
  INDEX `MarketingCampaign_channel_idx` (`channel`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OtpRequest` (
  `id` VARCHAR(191) NOT NULL,
  `channel` VARCHAR(191) NOT NULL,
  `recipientHash` VARCHAR(191) NOT NULL,
  `recipientLabel` VARCHAR(191) NOT NULL,
  `codeHash` VARCHAR(191) NOT NULL,
  `purpose` VARCHAR(191) NOT NULL DEFAULT 'verification',
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `maxAttempts` INTEGER NOT NULL DEFAULT 5,
  `expiresAt` DATETIME(3) NOT NULL,
  `verifiedAt` DATETIME(3) NULL,
  `metadataJson` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `OtpRequest_recipientHash_idx` (`recipientHash`),
  INDEX `OtpRequest_status_idx` (`status`),
  INDEX `OtpRequest_expiresAt_idx` (`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VoiceGeneration` (
  `id` VARCHAR(191) NOT NULL,
  `text` LONGTEXT NOT NULL,
  `voice` VARCHAR(191) NOT NULL,
  `speed` DOUBLE NOT NULL DEFAULT 1.0,
  `volume` DOUBLE NOT NULL DEFAULT 1.0,
  `format` VARCHAR(191) NOT NULL DEFAULT 'wav',
  `language` VARCHAR(191) NOT NULL DEFAULT 'bn',
  `filePath` VARCHAR(191) NULL,
  `durationSec` DOUBLE NULL,
  `charCount` INTEGER NOT NULL DEFAULT 0,
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `errorMessage` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `VoiceGeneration_status_idx` (`status`),
  INDEX `VoiceGeneration_voice_idx` (`voice`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AudioTranscription` (
  `id` VARCHAR(191) NOT NULL,
  `fileName` VARCHAR(191) NOT NULL,
  `fileSize` INTEGER NOT NULL,
  `format` VARCHAR(191) NOT NULL,
  `language` VARCHAR(191) NOT NULL DEFAULT 'auto',
  `transcription` LONGTEXT NULL,
  `wordCount` INTEGER NOT NULL DEFAULT 0,
  `durationSec` DOUBLE NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `errorMessage` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `AudioTranscription_status_idx` (`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
