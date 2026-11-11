-- Additive MySQL tables for the MarketingOS / AI-workforce models integrated in
-- PR #27 (0ab0c7d). That merge replaced the MySQL schema with a SQLite one; the
-- 42 ALO models are restored unchanged and these 99 models are added beside
-- them. Eight MarketingOS models collided with ALO tables that already exist in
-- production and are therefore created as Mos* tables (MosCompany, MosLead,
-- MosLeadActivity, MosCampaign, MosNotification, MosAuditLog, MosDepartment,
-- MosInvoice). No existing table is altered or dropped.
--
-- Plain CREATE TABLE (no IF NOT EXISTS): if any of these tables already exists
-- the migration fails closed and requires the restored-copy reconciliation
-- procedure in MIGRATION-RECOVERY-PLAN.md.
--
-- TEXT/LONGTEXT columns with defaults use expression defaults ("DEFAULT ('[]')"),
-- which require MySQL >= 8.0.13 or MariaDB >= 10.2.1.

-- CreateTable
CREATE TABLE `MosCompany` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `logo` TEXT NULL,
    `website` TEXT NULL,
    `industry` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `brandColors` TEXT NULL,
    `targetAudience` TEXT NULL,
    `marketingGoals` TEXT NULL,
    `plan` VARCHAR(191) NOT NULL DEFAULT 'free',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MosCompany_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `avatar` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompanyUser` (
    `id` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'team_member',
    `permissions` TEXT NOT NULL DEFAULT ('{}'),
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `CompanyUser_userId_companyId_key`(`userId`, `companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SocialAccount` (
    `id` VARCHAR(191) NOT NULL,
    `platform` VARCHAR(191) NOT NULL,
    `accountName` VARCHAR(191) NOT NULL,
    `accountHandle` TEXT NULL,
    `accountId` VARCHAR(191) NULL,
    `avatarUrl` TEXT NULL,
    `accessToken` TEXT NOT NULL,
    `refreshToken` TEXT NULL,
    `tokenExpiresAt` DATETIME(3) NULL,
    `scopes` TEXT NOT NULL DEFAULT ('[]'),
    `webhookUrl` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `lastSyncedAt` DATETIME(3) NULL,
    `connectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Content` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `platform` VARCHAR(191) NULL,
    `body` LONGTEXT NULL,
    `mediaUrl` TEXT NULL,
    `mediaType` VARCHAR(191) NULL,
    `thumbnailUrl` TEXT NULL,
    `hashtags` TEXT NULL,
    `scheduledAt` DATETIME(3) NULL,
    `publishedAt` DATETIME(3) NULL,
    `engagement` TEXT NOT NULL DEFAULT ('{}'),
    `aiGenerated` BOOLEAN NOT NULL DEFAULT false,
    `creatorId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MosCampaign` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `budget` DOUBLE NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `metrics` TEXT NOT NULL DEFAULT ('{}'),
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MosLead` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `companyName` VARCHAR(191) NULL,
    `source` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'new',
    `score` INTEGER NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `assignedToId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `dealId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contact` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `companyName` VARCHAR(191) NULL,
    `position` TEXT NULL,
    `source` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Deal` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `value` DOUBLE NOT NULL DEFAULT 0,
    `stage` VARCHAR(191) NOT NULL DEFAULT 'prospect',
    `probability` INTEGER NOT NULL DEFAULT 0,
    `closeDate` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ticket` (
    `id` VARCHAR(191) NOT NULL,
    `subject` TEXT NOT NULL,
    `description` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'open',
    `priority` VARCHAR(191) NOT NULL DEFAULT 'medium',
    `assignedToId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketMessage` (
    `id` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `senderId` VARCHAR(191) NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MosLeadActivity` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadTag` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeoChallenge` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `websiteUrl` TEXT NOT NULL,
    `targetKeywords` TEXT NULL,
    `duration` INTEGER NOT NULL DEFAULT 60,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `currentDay` INTEGER NOT NULL DEFAULT 0,
    `score` INTEGER NOT NULL DEFAULT 0,
    `tasks` TEXT NOT NULL DEFAULT ('[]'),
    `results` LONGTEXT NOT NULL DEFAULT ('{}'),
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeoDailyTask` (
    `id` VARCHAR(191) NOT NULL,
    `day` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `completedAt` DATETIME(3) NULL,
    `challengeId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiAgent` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `config` TEXT NOT NULL DEFAULT ('{}'),
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiChatMessage` (
    `id` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` VARCHAR(191) NOT NULL,
    `plan` VARCHAR(191) NOT NULL,
    `billingCycle` VARCHAR(191) NOT NULL DEFAULT 'monthly',
    `amount` DOUBLE NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `startsAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endsAt` DATETIME(3) NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invitation` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'team_member',
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `acceptedAt` DATETIME(3) NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Invitation_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MosAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `resource` VARCHAR(191) NOT NULL,
    `resourceId` VARCHAR(191) NULL,
    `details` TEXT NULL,
    `userId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MosNotification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `link` TEXT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `readAt` DATETIME(3) NULL,
    `metadata` LONGTEXT NOT NULL DEFAULT ('{}'),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MosNotification_userId_isRead_idx`(`userId`, `isRead`),
    INDEX `MosNotification_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `recipientId` VARCHAR(191) NOT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Message_senderId_recipientId_idx`(`senderId`, `recipientId`),
    INDEX `Message_recipientId_isRead_idx`(`recipientId`, `isRead`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Announcement` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'normal',
    `targetRoles` TEXT NOT NULL DEFAULT ('all'),
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `expiresAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Activity` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `resourceType` VARCHAR(191) NULL,
    `resourceId` VARCHAR(191) NULL,
    `metadata` LONGTEXT NOT NULL DEFAULT ('{}'),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Activity_companyId_createdAt_idx`(`companyId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MosDepartment` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `parentId` VARCHAR(191) NULL,
    `level` INTEGER NOT NULL DEFAULT 0,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `icon` VARCHAR(191) NULL,
    `color` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MosDepartment_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Employee` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `level` VARCHAR(191) NOT NULL DEFAULT 'specialist',
    `status` VARCHAR(191) NOT NULL DEFAULT 'idle',
    `avatar` TEXT NULL,
    `mission` TEXT NOT NULL,
    `constitution` LONGTEXT NULL,
    `authority` TEXT NOT NULL DEFAULT ('{}'),
    `permissions` TEXT NOT NULL DEFAULT ('{}'),
    `departmentId` VARCHAR(191) NOT NULL,
    `reportsToId` VARCHAR(191) NULL,
    `skills` TEXT NOT NULL DEFAULT ('[]'),
    `capabilities` TEXT NOT NULL DEFAULT ('[]'),
    `tools` TEXT NOT NULL DEFAULT ('[]'),
    `preferredModel` VARCHAR(191) NULL,
    `modelTier` VARCHAR(191) NOT NULL DEFAULT 'balanced',
    `modelConfig` TEXT NOT NULL DEFAULT ('{}'),
    `kpis` TEXT NOT NULL DEFAULT ('[]'),
    `currentKpis` TEXT NOT NULL DEFAULT ('{}'),
    `totalTasks` INTEGER NOT NULL DEFAULT 0,
    `completedTasks` INTEGER NOT NULL DEFAULT 0,
    `failedTasks` INTEGER NOT NULL DEFAULT 0,
    `successRate` DOUBLE NOT NULL DEFAULT 0,
    `avgLatencyMs` INTEGER NOT NULL DEFAULT 0,
    `lastActiveAt` DATETIME(3) NULL,
    `canDelegate` BOOLEAN NOT NULL DEFAULT false,
    `canConsult` BOOLEAN NOT NULL DEFAULT true,
    `canReview` BOOLEAN NOT NULL DEFAULT false,
    `canEscalate` BOOLEAN NOT NULL DEFAULT true,
    `collaborationRules` TEXT NOT NULL DEFAULT ('{}'),
    `escalationRules` TEXT NOT NULL DEFAULT ('[]'),
    `escalationPath` TEXT NOT NULL DEFAULT ('[]'),
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `isAvailable` BOOLEAN NOT NULL DEFAULT true,
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Employee_employeeId_key`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskExecution` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `taskType` VARCHAR(191) NOT NULL,
    `complexity` VARCHAR(191) NOT NULL DEFAULT 'standard',
    `executionPath` VARCHAR(191) NOT NULL DEFAULT 'fast',
    `priority` VARCHAR(191) NOT NULL DEFAULT 'medium',
    `assignedEmployeeId` VARCHAR(191) NULL,
    `delegatedById` VARCHAR(191) NULL,
    `reviewedById` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `input` TEXT NOT NULL DEFAULT ('{}'),
    `output` LONGTEXT NULL,
    `modelUsed` TEXT NULL,
    `modelTier` VARCHAR(191) NULL,
    `promptTokens` INTEGER NOT NULL DEFAULT 0,
    `completionTokens` INTEGER NOT NULL DEFAULT 0,
    `latencyMs` INTEGER NOT NULL DEFAULT 0,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `skillsUsed` TEXT NOT NULL DEFAULT ('[]'),
    `sopsUsed` TEXT NOT NULL DEFAULT ('[]'),
    `knowledgeUsed` TEXT NOT NULL DEFAULT ('[]'),
    `memoryUsed` TEXT NOT NULL DEFAULT ('[]'),
    `ragUsed` BOOLEAN NOT NULL DEFAULT false,
    `validationStatus` VARCHAR(191) NULL,
    `validationScore` DOUBLE NULL,
    `validatorId` VARCHAR(191) NULL,
    `qualityNotes` TEXT NULL,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `maxRetries` INTEGER NOT NULL DEFAULT 3,
    `fallbackModel` VARCHAR(191) NULL,
    `fallbackReason` TEXT NULL,
    `collaborationType` VARCHAR(191) NULL,
    `parentTaskId` VARCHAR(191) NULL,
    `childTaskIds` TEXT NOT NULL DEFAULT ('[]'),
    `consultedEmployees` TEXT NOT NULL DEFAULT ('[]'),
    `lessonLearned` TEXT NULL,
    `improvementTags` TEXT NOT NULL DEFAULT ('[]'),
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TaskExecution_taskId_key`(`taskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeMemory` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `memoryType` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `metadata` LONGTEXT NOT NULL DEFAULT ('{}'),
    `relevance` DOUBLE NOT NULL DEFAULT 1,
    `accessCount` INTEGER NOT NULL DEFAULT 0,
    `lastAccessedAt` DATETIME(3) NULL,
    `sourceType` VARCHAR(191) NULL,
    `sourceId` VARCHAR(191) NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT false,
    `approvedById` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KnowledgeNode` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `summary` LONGTEXT NULL,
    `nodeType` VARCHAR(191) NOT NULL DEFAULT 'document',
    `tags` TEXT NOT NULL DEFAULT ('[]'),
    `category` VARCHAR(191) NULL,
    `embedding` LONGTEXT NULL,
    `departmentId` VARCHAR(191) NULL,
    `accessLevel` VARCHAR(191) NOT NULL DEFAULT 'company',
    `accessRoles` TEXT NOT NULL DEFAULT ('[]'),
    `accessCount` INTEGER NOT NULL DEFAULT 0,
    `rating` DOUBLE NOT NULL DEFAULT 0,
    `sourceUrl` TEXT NULL,
    `sourceType` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sop` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `category` VARCHAR(191) NOT NULL,
    `triggerConditions` TEXT NOT NULL DEFAULT ('[]'),
    `steps` LONGTEXT NOT NULL DEFAULT ('[]'),
    `preconditions` TEXT NOT NULL DEFAULT ('[]'),
    `departmentId` VARCHAR(191) NULL,
    `applicableRoles` TEXT NOT NULL DEFAULT ('[]'),
    `applicableTasks` TEXT NOT NULL DEFAULT ('[]'),
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `usageCount` INTEGER NOT NULL DEFAULT 0,
    `successRate` DOUBLE NOT NULL DEFAULT 0,
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkforceConversation` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `messages` LONGTEXT NOT NULL DEFAULT ('[]'),
    `messageCount` INTEGER NOT NULL DEFAULT 0,
    `skillsLoaded` TEXT NOT NULL DEFAULT ('[]'),
    `knowledgeLoaded` TEXT NOT NULL DEFAULT ('[]'),
    `memoryAccessed` TEXT NOT NULL DEFAULT ('[]'),
    `sopsLoaded` TEXT NOT NULL DEFAULT ('[]'),
    `taskContext` LONGTEXT NULL,
    `totalTokens` INTEGER NOT NULL DEFAULT 0,
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ModelConfig` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `tier` VARCHAR(191) NOT NULL,
    `capabilities` TEXT NOT NULL DEFAULT ('[]'),
    `maxTokens` INTEGER NOT NULL DEFAULT 4096,
    `costPer1kInput` DOUBLE NOT NULL DEFAULT 0,
    `costPer1kOutput` DOUBLE NOT NULL DEFAULT 0,
    `avgLatencyMs` INTEGER NOT NULL DEFAULT 0,
    `qualityScore` DOUBLE NOT NULL DEFAULT 0,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `isFallback` BOOLEAN NOT NULL DEFAULT false,
    `fallbackFor` TEXT NULL,
    `config` TEXT NOT NULL DEFAULT ('{}'),
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ToolDefinition` (
    `id` VARCHAR(191) NOT NULL,
    `toolNumber` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `authType` VARCHAR(191) NOT NULL,
    `requiredCredentials` TEXT NOT NULL DEFAULT ('[]'),
    `connectionType` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `subcategory` VARCHAR(191) NULL,
    `capabilities` TEXT NOT NULL,
    `automationLevel` VARCHAR(191) NOT NULL DEFAULT 'MANUAL',
    `description` TEXT NULL,
    `icon` VARCHAR(191) NULL,
    `color` VARCHAR(191) NULL,
    `documentationUrl` TEXT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ToolDefinition_toolNumber_key`(`toolNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ToolConnection` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `toolId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'disconnected',
    `connectedAt` DATETIME(3) NULL,
    `lastSyncedAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `credentials` TEXT NOT NULL DEFAULT ('{}'),
    `config` TEXT NOT NULL DEFAULT ('{}'),
    `webhooks` TEXT NOT NULL DEFAULT ('[]'),
    `scopes` TEXT NOT NULL DEFAULT ('[]'),
    `totalCalls` INTEGER NOT NULL DEFAULT 0,
    `lastCalledAt` DATETIME(3) NULL,
    `errorCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ToolConnection_companyId_toolId_key`(`companyId`, `toolId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ToolUsageLog` (
    `id` VARCHAR(191) NOT NULL,
    `connectionId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `executionId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `endpoint` TEXT NULL,
    `method` VARCHAR(191) NULL,
    `requestSummary` LONGTEXT NULL,
    `responseStatus` INTEGER NULL,
    `durationMs` INTEGER NULL,
    `isSuccess` BOOLEAN NOT NULL DEFAULT false,
    `errorMessage` TEXT NULL,
    `responseData` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Webhook` (
    `id` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `events` TEXT NOT NULL DEFAULT ('[]'),
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `secret` TEXT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApiKey` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `keyPrefix` VARCHAR(191) NOT NULL,
    `hashedKey` TEXT NOT NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `scopes` TEXT NOT NULL DEFAULT ('[]'),
    `rateLimitPerMin` INTEGER NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `deviceInfo` TEXT NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `location` TEXT NULL,
    `lastActiveAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeedSource` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'general',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastFetchedAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FeedSource_url_key`(`url`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeedItem` (
    `id` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `link` TEXT NOT NULL,
    `description` TEXT NULL,
    `author` TEXT NULL,
    `publishedAt` DATETIME(3) NOT NULL,
    `guid` TEXT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `isStarred` BOOLEAN NOT NULL DEFAULT false,
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SmsMessage` (
    `id` VARCHAR(191) NOT NULL,
    `to` TEXT NOT NULL,
    `from` TEXT NULL,
    `body` LONGTEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `providerMessageId` VARCHAR(191) NULL,
    `error` TEXT NULL,
    `leadId` VARCHAR(191) NULL,
    `contactId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `sentBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Competitor` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `website` TEXT NULL,
    `description` TEXT NULL,
    `strengths` TEXT NOT NULL DEFAULT ('[]'),
    `weaknesses` TEXT NOT NULL DEFAULT ('[]'),
    `pricing` TEXT NULL,
    `marketShare` TEXT NULL,
    `threatLevel` VARCHAR(191) NOT NULL DEFAULT 'medium',
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KeywordTracker` (
    `id` VARCHAR(191) NOT NULL,
    `keyword` TEXT NOT NULL,
    `searchVolume` INTEGER NOT NULL DEFAULT 0,
    `difficulty` INTEGER NOT NULL DEFAULT 0,
    `trend` VARCHAR(191) NOT NULL DEFAULT 'stable',
    `lastPosition` INTEGER NULL,
    `competitorPositions` TEXT NOT NULL DEFAULT ('{}'),
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EnrichmentCache` (
    `id` VARCHAR(191) NOT NULL,
    `domain` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NULL,
    `industry` VARCHAR(191) NULL,
    `website` TEXT NULL,
    `description` TEXT NULL,
    `logo` TEXT NULL,
    `employees` TEXT NULL,
    `foundedYear` INTEGER NULL,
    `linkedinUrl` TEXT NULL,
    `twitterHandle` TEXT NULL,
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EnrichmentCache_domain_key`(`domain`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Workflow` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `trigger` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `triggerConfig` TEXT NOT NULL DEFAULT ('{}'),
    `steps` LONGTEXT NOT NULL DEFAULT ('[]'),
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `lastRunAt` DATETIME(3) NULL,
    `runCount` INTEGER NOT NULL DEFAULT 0,
    `companyId` VARCHAR(191) NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowRun` (
    `id` VARCHAR(191) NOT NULL,
    `workflowId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `trigger` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `input` TEXT NOT NULL DEFAULT ('{}'),
    `output` LONGTEXT NULL,
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Integration` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `authMethod` VARCHAR(191) NOT NULL DEFAULT 'oauth',
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `grantedScopes` TEXT NOT NULL DEFAULT ('[]'),
    `selectedResources` TEXT NOT NULL DEFAULT ('[]'),
    `currentStateId` VARCHAR(191) NULL,
    `tokenExpiresAt` DATETIME(3) NULL,
    `refreshSupported` BOOLEAN NOT NULL DEFAULT false,
    `lastValidatedAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Integration_companyId_provider_idx`(`companyId`, `provider`),
    UNIQUE INDEX `Integration_companyId_provider_key`(`companyId`, `provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IntegrationSecret` (
    `id` VARCHAR(191) NOT NULL,
    `integrationId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `ciphertext` LONGTEXT NOT NULL,
    `keyVersion` INTEGER NOT NULL DEFAULT 1,
    `maskedValue` TEXT NULL,
    `rotatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `IntegrationSecret_integrationId_idx`(`integrationId`),
    UNIQUE INDEX `IntegrationSecret_integrationId_kind_key`(`integrationId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IntegrationResource` (
    `id` VARCHAR(191) NOT NULL,
    `integrationId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `resourceId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `permission` TEXT NULL,
    `selected` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(191) NOT NULL DEFAULT 'valid',
    `metadata` LONGTEXT NOT NULL DEFAULT ('{}'),
    `discoveredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `IntegrationResource_integrationId_type_idx`(`integrationId`, `type`),
    UNIQUE INDEX `IntegrationResource_integrationId_type_resourceId_key`(`integrationId`, `type`, `resourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IntegrationLog` (
    `id` VARCHAR(191) NOT NULL,
    `integrationId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `outcome` VARCHAR(191) NOT NULL DEFAULT 'success',
    `message` TEXT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'api',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `IntegrationLog_integrationId_createdAt_idx`(`integrationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OAuthState` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `codeVerifier` TEXT NOT NULL,
    `redirectUri` TEXT NOT NULL,
    `scopes` TEXT NOT NULL DEFAULT ('[]'),
    `expiresAt` DATETIME(3) NOT NULL,
    `consumed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `OAuthState_state_key`(`state`),
    INDEX `OAuthState_userId_provider_idx`(`userId`, `provider`),
    INDEX `OAuthState_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IntegrationManifest` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `workspaceId` VARCHAR(191) NULL,
    `manifest` TEXT NOT NULL DEFAULT ('{}'),
    `confirmedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `confirmedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `IntegrationManifest_companyId_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiModelProvider` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'free',
    `baseUrl` TEXT NULL,
    `openAiCompatible` BOOLEAN NOT NULL DEFAULT true,
    `apiKeyOptional` BOOLEAN NOT NULL DEFAULT false,
    `apiKeyEnvName` VARCHAR(191) NULL,
    `secretCipher` TEXT NULL,
    `secretKeyVersion` INTEGER NOT NULL DEFAULT 1,
    `secretMasked` TEXT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `priority` INTEGER NOT NULL DEFAULT 100,
    `lastCheckedAt` DATETIME(3) NULL,
    `lastStatus` VARCHAR(191) NULL,
    `lastError` TEXT NULL,
    `docsUrl` TEXT NULL,
    `rateLimitNote` TEXT NULL,
    `notes` TEXT NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AiModelProvider_slug_key`(`slug`),
    INDEX `AiModelProvider_isEnabled_priority_idx`(`isEnabled`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiModelEntry` (
    `id` VARCHAR(191) NOT NULL,
    `providerId` VARCHAR(191) NOT NULL,
    `modelId` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `contextWindow` INTEGER NOT NULL DEFAULT 8192,
    `capabilities` TEXT NOT NULL DEFAULT ('["chat"]'),
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `maxOutputTokens` INTEGER NOT NULL DEFAULT 4096,
    `freeTierNote` TEXT NULL,
    `createdBy` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AiModelEntry_providerId_isEnabled_idx`(`providerId`, `isEnabled`),
    UNIQUE INDEX `AiModelEntry_providerId_modelId_key`(`providerId`, `modelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentModelAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `agentType` VARCHAR(191) NOT NULL,
    `providerId` VARCHAR(191) NOT NULL,
    `modelId` VARCHAR(191) NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `dailyTokenBudget` INTEGER NOT NULL DEFAULT 100000,
    `dailyRequestBudget` INTEGER NOT NULL DEFAULT 100,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AgentModelAssignment_companyId_isEnabled_idx`(`companyId`, `isEnabled`),
    UNIQUE INDEX `AgentModelAssignment_companyId_agentType_key`(`companyId`, `agentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CircuitBreakerState` (
    `id` VARCHAR(191) NOT NULL,
    `providerId` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL DEFAULT 'closed',
    `consecutiveFailures` INTEGER NOT NULL DEFAULT 0,
    `consecutiveSuccesses` INTEGER NOT NULL DEFAULT 0,
    `lastFailureAt` DATETIME(3) NULL,
    `lastFailureReason` TEXT NULL,
    `lastSuccessAt` DATETIME(3) NULL,
    `trippedAt` DATETIME(3) NULL,
    `tripCount` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CircuitBreakerState_providerId_key`(`providerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentUsageDaily` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `agentType` VARCHAR(191) NOT NULL,
    `day` VARCHAR(191) NOT NULL,
    `requestCount` INTEGER NOT NULL DEFAULT 0,
    `promptTokens` INTEGER NOT NULL DEFAULT 0,
    `completionTokens` INTEGER NOT NULL DEFAULT 0,
    `totalTokens` INTEGER NOT NULL DEFAULT 0,
    `estimatedCostUsd` DOUBLE NOT NULL DEFAULT 0,
    `failureCount` INTEGER NOT NULL DEFAULT 0,
    `fallbackCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AgentUsageDaily_companyId_day_idx`(`companyId`, `day`),
    UNIQUE INDEX `AgentUsageDaily_companyId_agentType_day_key`(`companyId`, `agentType`, `day`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentExecutionLog` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `agentType` VARCHAR(191) NOT NULL,
    `providerSlug` VARCHAR(191) NOT NULL,
    `modelName` VARCHAR(191) NOT NULL,
    `promptCharCount` INTEGER NOT NULL DEFAULT 0,
    `responseCharCount` INTEGER NOT NULL DEFAULT 0,
    `promptTokens` INTEGER NULL,
    `completionTokens` INTEGER NULL,
    `totalTokens` INTEGER NULL,
    `estimatedCostUsd` DOUBLE NULL,
    `latencyMs` INTEGER NOT NULL,
    `success` BOOLEAN NOT NULL,
    `errorMessage` TEXT NULL,
    `discardedReason` TEXT NULL,
    `usedFallback` BOOLEAN NOT NULL DEFAULT false,
    `actorUserId` VARCHAR(191) NULL,
    `piiRedactionCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AgentExecutionLog_companyId_agentType_createdAt_idx`(`companyId`, `agentType`, `createdAt`),
    INDEX `AgentExecutionLog_providerSlug_createdAt_idx`(`providerSlug`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AfterHoursRule` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Dhaka',
    `workingDays` TEXT NOT NULL DEFAULT ('[1,2,3,4,5]'),
    `workingStart` VARCHAR(191) NOT NULL DEFAULT '09:00',
    `workingEnd` VARCHAR(191) NOT NULL DEFAULT '18:00',
    `holidays` TEXT NOT NULL DEFAULT ('[]'),
    `afterHoursPolicy` VARCHAR(191) NOT NULL DEFAULT 'auto_reply_with_disclaimer',
    `afterHoursDisclaimer` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AfterHoursRule_companyId_key`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MfaSecret` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `secretCipher` TEXT NOT NULL,
    `secretKeyVersion` INTEGER NOT NULL DEFAULT 1,
    `backupCodesHash` TEXT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT false,
    `enabledAt` DATETIME(3) NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MfaSecret_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefreshToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `rotatedTo` TEXT NULL,
    `revokedAt` DATETIME(3) NULL,
    `revokedReason` TEXT NULL,
    `userAgent` TEXT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RefreshToken_tokenHash_key`(`tokenHash`),
    INDEX `RefreshToken_userId_expiresAt_idx`(`userId`, `expiresAt`),
    INDEX `RefreshToken_tokenHash_idx`(`tokenHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VoiceAgent` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `purpose` TEXT NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'bn-BD',
    `voiceId` VARCHAR(191) NULL,
    `speakingStyle` TEXT NULL,
    `personality` TEXT NULL,
    `systemPrompt` LONGTEXT NOT NULL DEFAULT (''),
    `greetingMessage` TEXT NULL,
    `fallbackResponse` LONGTEXT NULL,
    `maxCallDurationSec` INTEGER NOT NULL DEFAULT 300,
    `workingHoursStart` TEXT NULL,
    `workingHoursEnd` TEXT NULL,
    `workingDays` TEXT NOT NULL DEFAULT ('[1,2,3,4,5]'),
    `knowledgeBaseId` VARCHAR(191) NULL,
    `crmEnabled` BOOLEAN NOT NULL DEFAULT true,
    `allowlistedTools` TEXT NOT NULL DEFAULT ('["crm_lookup_lead","crm_create_lead","content_save_artifact"]'),
    `approvalMode` VARCHAR(191) NOT NULL DEFAULT 'suspend',
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `phoneNumberId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VoiceAgent_companyId_status_idx`(`companyId`, `status`),
    INDEX `VoiceAgent_companyId_language_idx`(`companyId`, `language`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Consent` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `subjectType` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `methodDetail` TEXT NULL,
    `scope` VARCHAR(191) NOT NULL DEFAULT 'this_call',
    `expiresAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `revocationReason` TEXT NULL,
    `referenceType` VARCHAR(191) NULL,
    `referenceId` VARCHAR(191) NULL,
    `capturedBy` TEXT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Consent_companyId_subjectId_kind_idx`(`companyId`, `subjectId`, `kind`),
    INDEX `Consent_referenceType_referenceId_idx`(`referenceType`, `referenceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CallUsageDaily` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `day` VARCHAR(191) NOT NULL,
    `direction` VARCHAR(191) NOT NULL,
    `totalCalls` INTEGER NOT NULL DEFAULT 0,
    `aiHandledCalls` INTEGER NOT NULL DEFAULT 0,
    `humanHandledCalls` INTEGER NOT NULL DEFAULT 0,
    `failedCalls` INTEGER NOT NULL DEFAULT 0,
    `totalDurationSec` INTEGER NOT NULL DEFAULT 0,
    `aiDurationSec` INTEGER NOT NULL DEFAULT 0,
    `humanDurationSec` INTEGER NOT NULL DEFAULT 0,
    `recordingStorageMb` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CallUsageDaily_companyId_day_idx`(`companyId`, `day`),
    UNIQUE INDEX `CallUsageDaily_companyId_day_direction_key`(`companyId`, `day`, `direction`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TtsUsageDaily` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `day` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'bn-BD',
    `charactersSynthesized` INTEGER NOT NULL DEFAULT 0,
    `audioSecondsGenerated` DOUBLE NOT NULL DEFAULT 0,
    `costEstimateUsd` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TtsUsageDaily_companyId_day_idx`(`companyId`, `day`),
    UNIQUE INDEX `TtsUsageDaily_companyId_day_provider_language_key`(`companyId`, `day`, `provider`, `language`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AsrUsageDaily` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `day` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'bn-BD',
    `audioSecondsProcessed` DOUBLE NOT NULL DEFAULT 0,
    `charactersTranscribed` INTEGER NOT NULL DEFAULT 0,
    `costEstimateUsd` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AsrUsageDaily_companyId_day_idx`(`companyId`, `day`),
    UNIQUE INDEX `AsrUsageDaily_companyId_day_provider_language_key`(`companyId`, `day`, `provider`, `language`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PhoneNumber` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `number` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerNumberId` VARCHAR(191) NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'BD',
    `numberType` VARCHAR(191) NOT NULL DEFAULT 'local',
    `capabilities` TEXT NOT NULL DEFAULT ('["voice","sms"]'),
    `status` VARCHAR(191) NOT NULL DEFAULT 'available',
    `assignedAt` DATETIME(3) NULL,
    `activatedAt` DATETIME(3) NULL,
    `releasedAt` DATETIME(3) NULL,
    `destinationType` VARCHAR(191) NULL,
    `destinationId` VARCHAR(191) NULL,
    `businessHoursStart` TEXT NULL,
    `businessHoursEnd` TEXT NULL,
    `workingDays` TEXT NULL,
    `callerIdName` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PhoneNumber_number_key`(`number`),
    INDEX `PhoneNumber_companyId_status_idx`(`companyId`, `status`),
    INDEX `PhoneNumber_provider_status_idx`(`provider`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Call` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `providerCallId` VARCHAR(191) NULL,
    `direction` VARCHAR(191) NOT NULL,
    `fromNumber` VARCHAR(191) NOT NULL,
    `toNumber` VARCHAR(191) NOT NULL,
    `fromName` VARCHAR(191) NULL,
    `toName` VARCHAR(191) NULL,
    `phoneNumberId` VARCHAR(191) NULL,
    `agentId` VARCHAR(191) NULL,
    `humanAgentId` VARCHAR(191) NULL,
    `queueId` VARCHAR(191) NULL,
    `ringGroupId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ringing',
    `previousStatus` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `answeredAt` DATETIME(3) NULL,
    `endedAt` DATETIME(3) NULL,
    `durationSec` INTEGER NOT NULL DEFAULT 0,
    `recordingUrl` TEXT NULL,
    `recordingConsentId` VARCHAR(191) NULL,
    `hasRecording` BOOLEAN NOT NULL DEFAULT false,
    `transcript` LONGTEXT NULL,
    `summary` LONGTEXT NULL,
    `intent` VARCHAR(191) NULL,
    `sentiment` VARCHAR(191) NULL,
    `actionItems` TEXT NULL,
    `qualityScore` DOUBLE NULL,
    `outcome` VARCHAR(191) NULL,
    `failureReason` TEXT NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Call_providerCallId_key`(`providerCallId`),
    INDEX `Call_companyId_status_idx`(`companyId`, `status`),
    INDEX `Call_companyId_direction_createdAt_idx`(`companyId`, `direction`, `createdAt`),
    INDEX `Call_agentId_idx`(`agentId`),
    INDEX `Call_humanAgentId_idx`(`humanAgentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CallEvent` (
    `id` VARCHAR(191) NOT NULL,
    `callId` VARCHAR(191) NOT NULL,
    `fromStatus` VARCHAR(191) NULL,
    `toStatus` VARCHAR(191) NOT NULL,
    `actorType` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `metadata` LONGTEXT NOT NULL DEFAULT ('{}'),
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CallEvent_callId_timestamp_idx`(`callId`, `timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IvrMenu` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `tree` TEXT NOT NULL DEFAULT ('[]'),
    `language` VARCHAR(191) NOT NULL DEFAULT 'bn-BD',
    `voiceId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `IvrMenu_companyId_status_idx`(`companyId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RingGroup` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `memberIds` TEXT NOT NULL DEFAULT ('[]'),
    `strategy` VARCHAR(191) NOT NULL DEFAULT 'ring_all',
    `ringTimeoutSec` INTEGER NOT NULL DEFAULT 20,
    `ringOrder` TEXT NULL,
    `fallbackDestinationType` VARCHAR(191) NULL,
    `fallbackDestinationId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RingGroup_companyId_status_idx`(`companyId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CallQueue` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `agentIds` TEXT NOT NULL DEFAULT ('[]'),
    `maxSize` INTEGER NOT NULL DEFAULT 50,
    `priorityLevels` INTEGER NOT NULL DEFAULT 3,
    `mohUrl` TEXT NULL,
    `announcePosition` BOOLEAN NOT NULL DEFAULT true,
    `announceEta` BOOLEAN NOT NULL DEFAULT true,
    `maxWaitSec` INTEGER NOT NULL DEFAULT 300,
    `overflowDestinationType` VARCHAR(191) NULL,
    `overflowDestinationId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CallQueue_companyId_status_idx`(`companyId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Voicemail` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `callId` VARCHAR(191) NULL,
    `fromNumber` VARCHAR(191) NOT NULL,
    `fromName` VARCHAR(191) NULL,
    `audioUrl` TEXT NOT NULL,
    `durationSec` INTEGER NOT NULL,
    `transcript` LONGTEXT NULL,
    `transcriptionStatus` VARCHAR(191) NULL DEFAULT 'pending',
    `assignedTo` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'unread',
    `listenedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Voicemail_companyId_status_createdAt_idx`(`companyId`, `status`, `createdAt`),
    INDEX `Voicemail_assignedTo_status_idx`(`assignedTo`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VoiceModel` (
    `id` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `modelId` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'bn-BD',
    `gender` VARCHAR(191) NULL,
    `style` TEXT NULL,
    `quality` VARCHAR(191) NOT NULL DEFAULT 'medium',
    `sampleRateHz` INTEGER NOT NULL DEFAULT 22050,
    `license` TEXT NULL,
    `commercialUseOk` BOOLEAN NOT NULL DEFAULT true,
    `cloneAuthorizationId` VARCHAR(191) NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `evaluatedAt` DATETIME(3) NULL,
    `evaluationScore` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VoiceModel_language_isEnabled_idx`(`language`, `isEnabled`),
    INDEX `VoiceModel_provider_isEnabled_idx`(`provider`, `isEnabled`),
    UNIQUE INDEX `VoiceModel_provider_modelId_key`(`provider`, `modelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VoiceCloneAuthorization` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `ownerName` VARCHAR(191) NOT NULL,
    `ownerEmail` VARCHAR(191) NULL,
    `ownerPhone` VARCHAR(191) NULL,
    `identityVerified` BOOLEAN NOT NULL DEFAULT false,
    `verificationMethod` VARCHAR(191) NULL,
    `verificationDocHash` VARCHAR(191) NULL,
    `consentScope` VARCHAR(191) NOT NULL DEFAULT 'commercial_ivr',
    `consentMethod` VARCHAR(191) NOT NULL DEFAULT 'signed_form',
    `consentFormUrl` TEXT NULL,
    `grantedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `revocationReason` TEXT NULL,
    `resultingVoiceModelId` VARCHAR(191) NULL,
    `capturedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VoiceCloneAuthorization_companyId_ownerEmail_idx`(`companyId`, `ownerEmail`),
    INDEX `VoiceCloneAuthorization_companyId_revokedAt_idx`(`companyId`, `revokedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VoiceCloneUsageLog` (
    `id` VARCHAR(191) NOT NULL,
    `authorizationId` VARCHAR(191) NOT NULL,
    `usageContext` LONGTEXT NOT NULL,
    `referenceType` VARCHAR(191) NULL,
    `referenceId` VARCHAR(191) NULL,
    `audioUrl` TEXT NULL,
    `durationSec` INTEGER NULL,
    `actorUserId` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VoiceCloneUsageLog_authorizationId_createdAt_idx`(`authorizationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PronunciationDictionary` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'bn-BD',
    `entries` TEXT NOT NULL DEFAULT ('[]'),
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PronunciationDictionary_companyId_language_idx`(`companyId`, `language`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TtsJob` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `text` LONGTEXT NOT NULL,
    `voiceModelId` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'bn-BD',
    `speed` DOUBLE NOT NULL DEFAULT 1,
    `pitch` DOUBLE NOT NULL DEFAULT 1,
    `audioUrl` TEXT NULL,
    `durationSec` INTEGER NULL,
    `provider` VARCHAR(191) NULL,
    `providerModelId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `errorMessage` TEXT NULL,
    `charactersProcessed` INTEGER NOT NULL DEFAULT 0,
    `costEstimateUsd` DOUBLE NOT NULL DEFAULT 0,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TtsJob_companyId_status_createdAt_idx`(`companyId`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OutboundCampaign` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `script` LONGTEXT NOT NULL DEFAULT (''),
    `agentId` VARCHAR(191) NULL,
    `contactListId` VARCHAR(191) NULL,
    `startAt` DATETIME(3) NULL,
    `endAt` DATETIME(3) NULL,
    `callingWindowStart` VARCHAR(191) NOT NULL DEFAULT '09:00',
    `callingWindowEnd` VARCHAR(191) NOT NULL DEFAULT '18:00',
    `callingDays` TEXT NOT NULL DEFAULT ('[1,2,3,4,5]'),
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Dhaka',
    `dncSuppression` BOOLEAN NOT NULL DEFAULT true,
    `consentRequired` BOOLEAN NOT NULL DEFAULT true,
    `maxAttemptsPerContact` INTEGER NOT NULL DEFAULT 3,
    `retryDelayHours` INTEGER NOT NULL DEFAULT 24,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `totalContacts` INTEGER NOT NULL DEFAULT 0,
    `callsAttempted` INTEGER NOT NULL DEFAULT 0,
    `callsConnected` INTEGER NOT NULL DEFAULT 0,
    `callsAnswered` INTEGER NOT NULL DEFAULT 0,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OutboundCampaign_companyId_status_idx`(`companyId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampaignCall` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NULL,
    `contactId` VARCHAR(191) NULL,
    `toNumber` VARCHAR(191) NOT NULL,
    `callId` VARCHAR(191) NULL,
    `attemptNumber` INTEGER NOT NULL DEFAULT 1,
    `scheduledAt` DATETIME(3) NULL,
    `attemptedAt` DATETIME(3) NULL,
    `connectedAt` DATETIME(3) NULL,
    `outcome` VARCHAR(191) NULL,
    `durationSec` INTEGER NOT NULL DEFAULT 0,
    `dynamicVariables` TEXT NOT NULL DEFAULT ('{}'),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CampaignCall_campaignId_outcome_idx`(`campaignId`, `outcome`),
    INDEX `CampaignCall_toNumber_idx`(`toNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CallSummary` (
    `id` VARCHAR(191) NOT NULL,
    `callId` VARCHAR(191) NOT NULL,
    `intent` VARCHAR(191) NULL,
    `summary` LONGTEXT NOT NULL,
    `actionItems` TEXT NOT NULL DEFAULT ('[]'),
    `followUpDate` DATETIME(3) NULL,
    `followUpType` VARCHAR(191) NULL,
    `sentimentScore` DOUBLE NULL,
    `satisfactionScore` DOUBLE NULL,
    `objections` TEXT NULL,
    `keywords` TEXT NULL,
    `complianceFlags` TEXT NULL,
    `generatedBy` VARCHAR(191) NOT NULL DEFAULT 'ai',
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedAt` DATETIME(3) NULL,
    `reviewedBy` TEXT NULL,

    UNIQUE INDEX `CallSummary_callId_key`(`callId`),
    INDEX `CallSummary_callId_idx`(`callId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KnowledgeBase` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `embedProvider` VARCHAR(191) NOT NULL DEFAULT 'local',
    `embedModel` VARCHAR(191) NOT NULL DEFAULT 'bge-m3',
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KnowledgeBase_companyId_status_idx`(`companyId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KnowledgeDocument` (
    `id` VARCHAR(191) NOT NULL,
    `knowledgeBaseId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `sourceUrl` TEXT NULL,
    `rawText` LONGTEXT NOT NULL DEFAULT (''),
    `chunksCount` INTEGER NOT NULL DEFAULT 0,
    `visibleToAgents` TEXT NOT NULL DEFAULT ('[]'),
    `status` VARCHAR(191) NOT NULL DEFAULT 'processing',
    `indexedAt` DATETIME(3) NULL,
    `uploadedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KnowledgeDocument_knowledgeBaseId_status_idx`(`knowledgeBaseId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KnowledgeChunk` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `chunkIndex` INTEGER NOT NULL,
    `text` LONGTEXT NOT NULL,
    `embedding` LONGTEXT NULL,
    `sourceLocation` TEXT NULL,
    `retrievalCount` INTEGER NOT NULL DEFAULT 0,
    `lastRetrievedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `KnowledgeChunk_documentId_chunkIndex_idx`(`documentId`, `chunkIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentStatus` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'offline',
    `statusChangedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `currentCallId` VARCHAR(191) NULL,
    `callsToday` INTEGER NOT NULL DEFAULT 0,
    `avgHandleTimeSec` INTEGER NOT NULL DEFAULT 0,
    `breakEndsAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AgentStatus_userId_key`(`userId`),
    INDEX `AgentStatus_companyId_status_idx`(`companyId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupervisorAction` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `actionType` VARCHAR(191) NOT NULL,
    `callId` VARCHAR(191) NULL,
    `agentUserId` VARCHAR(191) NULL,
    `supervisorUserId` VARCHAR(191) NOT NULL,
    `reason` TEXT NULL,
    `metadata` LONGTEXT NOT NULL DEFAULT ('{}'),
    `outcome` VARCHAR(191) NULL,
    `errorMessage` TEXT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SupervisorAction_companyId_timestamp_idx`(`companyId`, `timestamp`),
    INDEX `SupervisorAction_agentUserId_idx`(`agentUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `alternatePhone` VARCHAR(191) NULL,
    `customerCompany` TEXT NULL,
    `jobTitle` TEXT NULL,
    `country` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'lead',
    `tags` TEXT NOT NULL DEFAULT ('[]'),
    `assignedAgentId` VARCHAR(191) NULL,
    `consentMarketingSms` BOOLEAN NOT NULL DEFAULT false,
    `consentMarketingEmail` BOOLEAN NOT NULL DEFAULT false,
    `consentCallRecording` BOOLEAN NOT NULL DEFAULT false,
    `leadId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Customer_companyId_status_idx`(`companyId`, `status`),
    INDEX `Customer_companyId_phone_idx`(`companyId`, `phone`),
    INDEX `Customer_companyId_email_idx`(`companyId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SharedInboxMessage` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `direction` VARCHAR(191) NOT NULL,
    `fromAddress` TEXT NOT NULL,
    `toAddress` TEXT NOT NULL,
    `fromName` VARCHAR(191) NULL,
    `toName` VARCHAR(191) NULL,
    `subject` TEXT NULL,
    `body` LONGTEXT NOT NULL,
    `mediaUrls` TEXT NOT NULL DEFAULT ('[]'),
    `threadId` VARCHAR(191) NULL,
    `assignedToId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'unread',
    `isAiGenerated` BOOLEAN NOT NULL DEFAULT false,
    `isProviderConfirmed` BOOLEAN NOT NULL DEFAULT false,
    `tags` TEXT NOT NULL DEFAULT ('[]'),
    `internalNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SharedInboxMessage_companyId_channel_status_idx`(`companyId`, `channel`, `status`),
    INDEX `SharedInboxMessage_companyId_assignedToId_idx`(`companyId`, `assignedToId`),
    INDEX `SharedInboxMessage_threadId_idx`(`threadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CallAnalytics` (
    `id` VARCHAR(191) NOT NULL,
    `callId` VARCHAR(191) NOT NULL,
    `overallSentiment` TEXT NULL,
    `sentimentScore` DOUBLE NULL,
    `sentimentTimeline` TEXT NULL,
    `topics` TEXT NULL,
    `talkToListenRatio` DOUBLE NULL,
    `silencePct` DOUBLE NULL,
    `interruptionCount` INTEGER NULL,
    `agentScorecard` TEXT NULL,
    `complianceFlags` TEXT NULL,
    `generatedBy` VARCHAR(191) NOT NULL DEFAULT 'ai',
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedAt` DATETIME(3) NULL,
    `reviewedBy` TEXT NULL,

    UNIQUE INDEX `CallAnalytics_callId_key`(`callId`),
    INDEX `CallAnalytics_callId_idx`(`callId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SubscriptionPlan` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `priceMonthly` DOUBLE NOT NULL DEFAULT 0,
    `priceYearly` DOUBLE NOT NULL DEFAULT 0,
    `maxPhoneNumbers` INTEGER NOT NULL DEFAULT 1,
    `maxUsers` INTEGER NOT NULL DEFAULT 3,
    `maxAiMinutes` INTEGER NOT NULL DEFAULT 100,
    `maxTtsCharacters` INTEGER NOT NULL DEFAULT 10000,
    `maxAsrSeconds` INTEGER NOT NULL DEFAULT 3600,
    `maxRecordingStorageMb` INTEGER NOT NULL DEFAULT 500,
    `maxOutboundCallsPerDay` INTEGER NOT NULL DEFAULT 50,
    `features` TEXT NOT NULL DEFAULT ('[]'),
    `trialDays` INTEGER NOT NULL DEFAULT 0,
    `isPublic` BOOLEAN NOT NULL DEFAULT true,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SubscriptionPlan_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TenantSubscription` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `billingCycle` VARCHAR(191) NOT NULL DEFAULT 'monthly',
    `startsAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endsAt` DATETIME(3) NULL,
    `isTrial` BOOLEAN NOT NULL DEFAULT false,
    `trialEndsAt` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `cancelledAt` DATETIME(3) NULL,
    `paymentMethodRef` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TenantSubscription_companyId_key`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UsageCredit` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `creditType` VARCHAR(191) NOT NULL,
    `balance` DOUBLE NOT NULL DEFAULT 0,
    `autoRechargeThreshold` DOUBLE NOT NULL DEFAULT 0,
    `autoRechargeAmount` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UsageCredit_companyId_creditType_key`(`companyId`, `creditType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MosInvoice` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `subtotal` DOUBLE NOT NULL,
    `tax` DOUBLE NOT NULL DEFAULT 0,
    `total` DOUBLE NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `lineItems` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `sentAt` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `dueAt` DATETIME(3) NULL,
    `paymentMethodRef` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MosInvoice_invoiceNumber_key`(`invoiceNumber`),
    INDEX `MosInvoice_companyId_status_idx`(`companyId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NULL,
    `amount` DOUBLE NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `provider` VARCHAR(191) NOT NULL,
    `providerPaymentId` VARCHAR(191) NULL,
    `method` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `processedAt` DATETIME(3) NULL,
    `failureReason` TEXT NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Payment_companyId_status_idx`(`companyId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BillingAdjustment` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `reason` TEXT NOT NULL,
    `invoiceId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `approvedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BillingAdjustment_companyId_createdAt_idx`(`companyId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Expense` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `amount` DOUBLE NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'BDT',
    `category` VARCHAR(191) NOT NULL DEFAULT 'general',
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Expense_companyId_date_idx`(`companyId`, `date`),
    INDEX `Expense_companyId_status_idx`(`companyId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Skill` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `subcategory` VARCHAR(191) NULL,
    `description` TEXT NOT NULL,
    `proficiencyLevels` TEXT NOT NULL DEFAULT ('["beginner","intermediate","advanced","expert"]'),
    `prerequisites` TEXT NOT NULL DEFAULT ('[]'),
    `tools` TEXT NOT NULL DEFAULT ('[]'),
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `companyId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Skill_name_key`(`name`),
    INDEX `Skill_category_isActive_idx`(`category`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Prompt` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `subcategory` VARCHAR(191) NULL,
    `content` LONGTEXT NOT NULL,
    `variables` TEXT NOT NULL DEFAULT ('[]'),
    `language` VARCHAR(191) NOT NULL DEFAULT 'en',
    `tags` TEXT NOT NULL DEFAULT ('[]'),
    `companyId` VARCHAR(191) NULL,
    `departmentId` VARCHAR(191) NULL,
    `applicableRoles` TEXT NOT NULL DEFAULT ('[]'),
    `version` INTEGER NOT NULL DEFAULT 1,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `useCount` INTEGER NOT NULL DEFAULT 0,
    `rating` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Prompt_category_isActive_idx`(`category`, `isActive`),
    INDEX `Prompt_departmentId_idx`(`departmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentProfile` (
    `id` VARCHAR(191) NOT NULL,
    `agentId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `level` VARCHAR(191) NOT NULL,
    `skillsJson` TEXT NOT NULL DEFAULT ('[]'),
    `toolsJson` TEXT NOT NULL DEFAULT ('[]'),
    `promptsJson` TEXT NOT NULL DEFAULT ('[]'),
    `sopsJson` TEXT NOT NULL DEFAULT ('[]'),
    `modelTier` VARCHAR(191) NOT NULL DEFAULT 'balanced',
    `preferredModel` VARCHAR(191) NULL,
    `knowledgeBaseIds` TEXT NOT NULL DEFAULT ('[]'),
    `memoryType` VARCHAR(191) NOT NULL DEFAULT 'episodic',
    `constitution` LONGTEXT NOT NULL DEFAULT (''),
    `authority` TEXT NOT NULL DEFAULT ('{}'),
    `kpisJson` TEXT NOT NULL DEFAULT ('[]'),
    `collaborationRules` TEXT NOT NULL DEFAULT ('[]'),
    `escalationRules` TEXT NOT NULL DEFAULT ('[]'),
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `totalExecutions` INTEGER NOT NULL DEFAULT 0,
    `successRate` DOUBLE NOT NULL DEFAULT 100,
    `avgLatencyMs` INTEGER NOT NULL DEFAULT 0,
    `companyId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AgentProfile_agentId_key`(`agentId`),
    INDEX `AgentProfile_companyId_isActive_idx`(`companyId`, `isActive`),
    INDEX `AgentProfile_companyId_department_idx`(`companyId`, `department`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CompanyUser` ADD CONSTRAINT `CompanyUser_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyUser` ADD CONSTRAINT `CompanyUser_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SocialAccount` ADD CONSTRAINT `SocialAccount_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Content` ADD CONSTRAINT `Content_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Content` ADD CONSTRAINT `Content_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Content` ADD CONSTRAINT `Content_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `MosCampaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MosCampaign` ADD CONSTRAINT `MosCampaign_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MosLead` ADD CONSTRAINT `MosLead_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `CompanyUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MosLead` ADD CONSTRAINT `MosLead_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MosLead` ADD CONSTRAINT `MosLead_dealId_fkey` FOREIGN KEY (`dealId`) REFERENCES `Deal`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contact` ADD CONSTRAINT `Contact_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Deal` ADD CONSTRAINT `Deal_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `CompanyUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketMessage` ADD CONSTRAINT `TicketMessage_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `CompanyUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketMessage` ADD CONSTRAINT `TicketMessage_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Ticket`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MosLeadActivity` ADD CONSTRAINT `MosLeadActivity_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `MosLead`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadTag` ADD CONSTRAINT `LeadTag_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `MosLead`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeoChallenge` ADD CONSTRAINT `SeoChallenge_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeoDailyTask` ADD CONSTRAINT `SeoDailyTask_challengeId_fkey` FOREIGN KEY (`challengeId`) REFERENCES `SeoChallenge`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiAgent` ADD CONSTRAINT `AiAgent_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiChatMessage` ADD CONSTRAINT `AiChatMessage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MosAuditLog` ADD CONSTRAINT `MosAuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MosAuditLog` ADD CONSTRAINT `MosAuditLog_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MosNotification` ADD CONSTRAINT `MosNotification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_recipientId_fkey` FOREIGN KEY (`recipientId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Announcement` ADD CONSTRAINT `Announcement_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Announcement` ADD CONSTRAINT `Announcement_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MosDepartment` ADD CONSTRAINT `MosDepartment_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `MosDepartment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MosDepartment` ADD CONSTRAINT `MosDepartment_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `MosDepartment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_reportsToId_fkey` FOREIGN KEY (`reportsToId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskExecution` ADD CONSTRAINT `TaskExecution_assignedEmployeeId_fkey` FOREIGN KEY (`assignedEmployeeId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeMemory` ADD CONSTRAINT `EmployeeMemory_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KnowledgeNode` ADD CONSTRAINT `KnowledgeNode_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `MosDepartment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KnowledgeNode` ADD CONSTRAINT `KnowledgeNode_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sop` ADD CONSTRAINT `Sop_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `MosDepartment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkforceConversation` ADD CONSTRAINT `WorkforceConversation_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ToolConnection` ADD CONSTRAINT `ToolConnection_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ToolConnection` ADD CONSTRAINT `ToolConnection_toolId_fkey` FOREIGN KEY (`toolId`) REFERENCES `ToolDefinition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ToolUsageLog` ADD CONSTRAINT `ToolUsageLog_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `ToolConnection`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Webhook` ADD CONSTRAINT `Webhook_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApiKey` ADD CONSTRAINT `ApiKey_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserSession` ADD CONSTRAINT `UserSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeedSource` ADD CONSTRAINT `FeedSource_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeedItem` ADD CONSTRAINT `FeedItem_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `FeedSource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeedItem` ADD CONSTRAINT `FeedItem_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SmsMessage` ADD CONSTRAINT `SmsMessage_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SmsMessage` ADD CONSTRAINT `SmsMessage_sentBy_fkey` FOREIGN KEY (`sentBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Competitor` ADD CONSTRAINT `Competitor_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KeywordTracker` ADD CONSTRAINT `KeywordTracker_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Workflow` ADD CONSTRAINT `Workflow_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Workflow` ADD CONSTRAINT `Workflow_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowRun` ADD CONSTRAINT `WorkflowRun_workflowId_fkey` FOREIGN KEY (`workflowId`) REFERENCES `Workflow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowRun` ADD CONSTRAINT `WorkflowRun_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Integration` ADD CONSTRAINT `Integration_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Integration` ADD CONSTRAINT `Integration_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Integration` ADD CONSTRAINT `Integration_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IntegrationSecret` ADD CONSTRAINT `IntegrationSecret_integrationId_fkey` FOREIGN KEY (`integrationId`) REFERENCES `Integration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IntegrationResource` ADD CONSTRAINT `IntegrationResource_integrationId_fkey` FOREIGN KEY (`integrationId`) REFERENCES `Integration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IntegrationLog` ADD CONSTRAINT `IntegrationLog_integrationId_fkey` FOREIGN KEY (`integrationId`) REFERENCES `Integration`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OAuthState` ADD CONSTRAINT `OAuthState_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OAuthState` ADD CONSTRAINT `OAuthState_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IntegrationManifest` ADD CONSTRAINT `IntegrationManifest_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IntegrationManifest` ADD CONSTRAINT `IntegrationManifest_confirmedBy_fkey` FOREIGN KEY (`confirmedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiModelProvider` ADD CONSTRAINT `AiModelProvider_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiModelProvider` ADD CONSTRAINT `AiModelProvider_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiModelEntry` ADD CONSTRAINT `AiModelEntry_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `AiModelProvider`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentModelAssignment` ADD CONSTRAINT `AgentModelAssignment_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentModelAssignment` ADD CONSTRAINT `AgentModelAssignment_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `AiModelProvider`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentModelAssignment` ADD CONSTRAINT `AgentModelAssignment_modelId_fkey` FOREIGN KEY (`modelId`) REFERENCES `AiModelEntry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentModelAssignment` ADD CONSTRAINT `AgentModelAssignment_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentModelAssignment` ADD CONSTRAINT `AgentModelAssignment_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CircuitBreakerState` ADD CONSTRAINT `CircuitBreakerState_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `AiModelProvider`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentUsageDaily` ADD CONSTRAINT `AgentUsageDaily_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentExecutionLog` ADD CONSTRAINT `AgentExecutionLog_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentExecutionLog` ADD CONSTRAINT `AgentExecutionLog_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AfterHoursRule` ADD CONSTRAINT `AfterHoursRule_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MfaSecret` ADD CONSTRAINT `MfaSecret_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoiceAgent` ADD CONSTRAINT `VoiceAgent_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoiceAgent` ADD CONSTRAINT `VoiceAgent_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoiceAgent` ADD CONSTRAINT `VoiceAgent_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Consent` ADD CONSTRAINT `Consent_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CallUsageDaily` ADD CONSTRAINT `CallUsageDaily_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TtsUsageDaily` ADD CONSTRAINT `TtsUsageDaily_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AsrUsageDaily` ADD CONSTRAINT `AsrUsageDaily_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PhoneNumber` ADD CONSTRAINT `PhoneNumber_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PhoneNumber` ADD CONSTRAINT `PhoneNumber_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Call` ADD CONSTRAINT `Call_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Call` ADD CONSTRAINT `Call_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CallEvent` ADD CONSTRAINT `CallEvent_callId_fkey` FOREIGN KEY (`callId`) REFERENCES `Call`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IvrMenu` ADD CONSTRAINT `IvrMenu_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IvrMenu` ADD CONSTRAINT `IvrMenu_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RingGroup` ADD CONSTRAINT `RingGroup_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CallQueue` ADD CONSTRAINT `CallQueue_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Voicemail` ADD CONSTRAINT `Voicemail_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Voicemail` ADD CONSTRAINT `Voicemail_callId_fkey` FOREIGN KEY (`callId`) REFERENCES `Call`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoiceCloneAuthorization` ADD CONSTRAINT `VoiceCloneAuthorization_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoiceCloneAuthorization` ADD CONSTRAINT `VoiceCloneAuthorization_capturedBy_fkey` FOREIGN KEY (`capturedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoiceCloneUsageLog` ADD CONSTRAINT `VoiceCloneUsageLog_authorizationId_fkey` FOREIGN KEY (`authorizationId`) REFERENCES `VoiceCloneAuthorization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PronunciationDictionary` ADD CONSTRAINT `PronunciationDictionary_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TtsJob` ADD CONSTRAINT `TtsJob_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TtsJob` ADD CONSTRAINT `TtsJob_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OutboundCampaign` ADD CONSTRAINT `OutboundCampaign_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OutboundCampaign` ADD CONSTRAINT `OutboundCampaign_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampaignCall` ADD CONSTRAINT `CampaignCall_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `OutboundCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CallSummary` ADD CONSTRAINT `CallSummary_callId_fkey` FOREIGN KEY (`callId`) REFERENCES `Call`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KnowledgeBase` ADD CONSTRAINT `KnowledgeBase_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KnowledgeDocument` ADD CONSTRAINT `KnowledgeDocument_knowledgeBaseId_fkey` FOREIGN KEY (`knowledgeBaseId`) REFERENCES `KnowledgeBase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KnowledgeDocument` ADD CONSTRAINT `KnowledgeDocument_uploadedBy_fkey` FOREIGN KEY (`uploadedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KnowledgeChunk` ADD CONSTRAINT `KnowledgeChunk_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `KnowledgeDocument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentStatus` ADD CONSTRAINT `AgentStatus_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentStatus` ADD CONSTRAINT `AgentStatus_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupervisorAction` ADD CONSTRAINT `SupervisorAction_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupervisorAction` ADD CONSTRAINT `SupervisorAction_supervisorUserId_fkey` FOREIGN KEY (`supervisorUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Customer` ADD CONSTRAINT `Customer_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Customer` ADD CONSTRAINT `Customer_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SharedInboxMessage` ADD CONSTRAINT `SharedInboxMessage_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CallAnalytics` ADD CONSTRAINT `CallAnalytics_callId_fkey` FOREIGN KEY (`callId`) REFERENCES `Call`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TenantSubscription` ADD CONSTRAINT `TenantSubscription_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TenantSubscription` ADD CONSTRAINT `TenantSubscription_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `SubscriptionPlan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UsageCredit` ADD CONSTRAINT `UsageCredit_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MosInvoice` ADD CONSTRAINT `MosInvoice_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `MosInvoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillingAdjustment` ADD CONSTRAINT `BillingAdjustment_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillingAdjustment` ADD CONSTRAINT `BillingAdjustment_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillingAdjustment` ADD CONSTRAINT `BillingAdjustment_approvedBy_fkey` FOREIGN KEY (`approvedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Skill` ADD CONSTRAINT `Skill_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Prompt` ADD CONSTRAINT `Prompt_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Prompt` ADD CONSTRAINT `Prompt_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `MosDepartment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentProfile` ADD CONSTRAINT `AgentProfile_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `MosCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
