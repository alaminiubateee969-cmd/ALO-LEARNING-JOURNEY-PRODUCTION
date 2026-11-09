# ALO Learning — Database Design

> **Document type:** Prisma schema design and migration plan (Phase 2/15 deliverable)
> **Date:** 2026-11-05
> **Author:** Z.ai
> **Companion documents:** `baseline-audit.md`, `repository-audit.md`, `architecture.md`, `integration-matrix.md`, `security-review.md`, `deployment-guide.md`, `testing-report.md`, `production-readiness.md`.

---

## Purpose

This document satisfies **Section 15 (DATABASE ARCHITECTURE)** of the ALO Learning Master Engineering & Integration Directive. It specifies the 31 new Prisma models mandated by the directive, plus the migration plan that adds them to the existing ALO database without resetting or breaking production data.

**The directive's hard rules for the database:**
1. First inspect existing Prisma schema. ✅ Done in `baseline-audit.md` Section D — 42 existing models, MySQL provider locked.
2. Reuse existing models when appropriate. ✅ `Company`, `AdminOtpChallenge`, `AuditLog`, `AIAgentRun`, `Notification` are reused.
3. Do not create duplicate user, tenant, or permission tables. ✅ No new `User`, `Tenant`, or `Permission` models — the single-admin model is preserved.
4. Generate migrations safely. ✅ Strictly additive migrations; no destructive SQL.
5. **Never reset the production database.**

---

## 1. Existing schema (recap from baseline-audit.md)

The existing Prisma schema at `prisma/schema.prisma` targets MySQL and declares **42 models** across 5 migrations:

| Migration | Lines | Summary |
|---|---|---|
| `20261001000000_initial_baseline` | 451 | Baseline: companies, agents, content, approvals, RAG, analytics, OTP, audit, social, family, departments, notifications |
| `20261007000000_human_avatar_ownership` | 61 | HumanAvatar + ownership |
| `20261010000000_admissions_crm_quotes` | 77 | CRM leads/quotations/invoices/clients/projects/campaigns |
| `20261010000001_admin_otp_challenges` | 17 | AdminOtpChallenge |
| `20261018000000_v2_additive_mysql_tables` | 145 | 10 new models (v2 expansion) |

**Reused existing models (no changes):**
- `Company` — tenant scope selector (single-admin uses `x-alo-company-id` header).
- `AdminOtpChallenge` — admin auth.
- `AuditLog` — audit trail (extended with nullable ALO Learning fields — see `security-review.md` Section 1.11).
- `AIAgentRun` — agent execution record (extended with `costUsd` Decimal field — see Section 3 below).
- `Notification` — user notifications.
- `Lead`, `Client`, `Project`, `Campaign` — CRM models (referenced by ALO Learning telephony CRM logging).

**Modified existing models (additive only — no breaking changes):**

```prisma
model AuditLog {
  // ... existing fields preserved
  aloLearningService String?  // NEW: which of the 12 ALO Learning services
  aloLearningJobId    String?  // NEW: async job ID
  syntheticMedia      Boolean? @default(false)  // NEW: synthetic-media disclosure flag
  childRelated        Boolean? @default(false)  // NEW: child-related flag
}

model AIAgentRun {
  // ... existing fields preserved
  // The costEstUsd Float field is DEPRECATED but NOT removed (to avoid breaking existing rows).
  // New code reads costUsd Decimal instead.
  costUsd Decimal? @db.Decimal(10, 4)  // NEW: real cost in USD (replaces fictional costEstUsd)
}
```

The `costEstUsd` Float field is **deprecated but not removed** — removing a column would be a destructive migration. New code writes to `costUsd` Decimal; the old field remains for backward compatibility with existing rows. A future migration (post-ALO Learning stabilization) may drop the deprecated column.

---

## 2. The 31 new Prisma models

The directive (Section 15) lists 31 new entities. They group into 6 domains. Each model below specifies: key fields, FKs to existing models, indexes, unique constraints, soft-delete column, data retention policy.

### Domain 1: Learning Content (8 models)

#### 2.1 LearningContent
```prisma
model LearningContent {
  id              String   @id @default(cuid())
  companyId       String   // FK to Company.id (tenant scope)
  department      LearningDepartment  // "kids" | "parenting" | "teacher"
  topic           String
  targetAudience  String
  learningOutcomes String  @db.Text  // JSON array of outcome strings
  ageSuitability  String   // e.g., "3-5 years", "6-8 years", "adults"
  researchRefs    String   @db.Text  // JSON array of citation objects
  status          ContentStatus  @default("draft")  // draft | research | scripting | storyboard | rendering | approved | published | archived
  ownerAdminEmail String   // single-admin owner
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?  // soft delete

  script          LearningScript?
  storyboard      LearningStoryboard?
  scenes          LearningScene[]
  project         LearningProject?
  assets          LearningAsset[]
  approvals       MediaApproval[]
  safetyReview    ContentSafetyReview?

  @@index([companyId, department])
  @@index([companyId, status])
  @@index([ownerAdminEmail])
}
```

#### 2.2 LearningTopic
```prisma
model LearningTopic {
  id          String   @id @default(cuid())
  department  LearningDepartment
  name        String
  parentId    String?  // hierarchical topics
  description String   @db.Text
  createdAt   DateTime @default(now())

  parent      LearningTopic?  @relation("TopicHierarchy", fields: [parentId], references: [id])
  children    LearningTopic[] @relation("TopicHierarchy")

  @@unique([department, name])
  @@index([department, parentId])
}
```

#### 2.3 LearningResearchSource
```prisma
model LearningResearchSource {
  id          String   @id @default(cuid())
  contentId   String
  url         String   @db.Text
  title       String
  author      String?
  publishedAt DateTime?
  retrievedAt DateTime @default(now())
  credibilityScore Float?  // 0-1, assigned by Fact Verification Agent
  factCheckStatus FactCheckStatus  @default("pending")  // pending | verified | flagged | rejected
  factCheckNotes String? @db.Text

  content     LearningContent @relation(fields: [contentId], references: [id], onDelete: Cascade)

  @@index([contentId])
  @@index([factCheckStatus])
}
```

#### 2.4 LearningScript
```prisma
model LearningScript {
  id          String   @id @default(cuid())
  contentId   String   @unique
  scriptText  String   @db.LongText
  language    String   @default("bn")  // ISO 639-1
  version     Int      @default(1)
  generatedBy String?  // agent ID or "human"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  content     LearningContent @relation(fields: [contentId], references: [id], onDelete: Cascade)

  @@index([contentId])
}
```

#### 2.5 LearningStoryboard
```prisma
model LearningStoryboard {
  id          String   @id @default(cuid())
  contentId   String   @unique
  scenesJson  String   @db.LongText  // JSON array of scene objects
  version     Int      @default(1)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  content     LearningContent @relation(fields: [contentId], references: [id], onDelete: Cascade)

  @@index([contentId])
}
```

#### 2.6 LearningScene
```prisma
model LearningScene {
  id            String   @id @default(cuid())
  contentId     String
  sceneNumber   Int
  description   String   @db.Text
  characterIds  String   @db.Text  // JSON array of Character IDs
  voiceProfileId String?
  visualPlan    String   @db.Text
  durationSec   Float?
  createdAt     DateTime @default(now())

  content       LearningContent @relation(fields: [contentId], references: [id], onDelete: Cascade)

  @@index([contentId, sceneNumber])
}
```

#### 2.7 LearningProject
```prisma
model LearningProject {
  id            String   @id @default(cuid())
  contentId     String   @unique
  videoMode     VideoMode  // explainer | documentary | 3d_animated | ai_presenter | talking_character | parent_education | teacher_training | short_form | long_form_youtube | animated_infographics
  pipelineState String   @default("topic")  // current step in 14-step pipeline
  jobId         String?  // FK to MediaGenerationJob
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  content       LearningContent @relation(fields: [contentId], references: [id], onDelete: Cascade)
  job           MediaGenerationJob? @relation(fields: [jobId], references: [id])

  @@index([videoMode])
  @@index([pipelineState])
}
```

#### 2.8 LearningAsset
```prisma
model LearningAsset {
  id          String   @id @default(cuid())
  contentId   String
  assetType   AssetType  // image | audio | video | subtitle | document | character_reference
  filePath    String   @db.Text  // encrypted at rest
  signedUrl   String?  @db.Text  // current signed URL (1-hour expiry)
  mimeType    String
  sizeBytes   BigInt
  checksum    String   // SHA-256
  createdAt   DateTime @default(now())
  expiresAt   DateTime?  // for signed URLs

  content     LearningContent @relation(fields: [contentId], references: [id], onDelete: Cascade)

  @@index([contentId, assetType])
  @@index([expiresAt])
}
```

### Domain 2: Character & Voice Consent (5 models)

#### 2.9 LearningCharacter
```prisma
model LearningCharacter {
  id                  String   @id @default(cuid())
  companyId           String   // FK to Company.id
  characterType       CharacterType  // fictional | stock | adult_presenter | parent_presenter | teacher_presenter | family_member
  name                String
  visualRef           String?  @db.Text  // path to reference image (encrypted)
  appearance          String?  @db.Text
  outfitProfile       String?  @db.Text
  expressionLibrary   String?  @db.Text  // JSON array
  sceneContinuity     String?  @db.Text
  animationSettings   String?  @db.Text
  voiceProfileId      String?
  permissionStatus    PermissionStatus  @default("pending")  // pending | approved | rejected | revoked
  assetOwnership      String?  @db.Text
  isMinor             Boolean  @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  deletedAt           DateTime?  // soft delete

  consents            CharacterConsent[]
  generations         MediaAuditLog[]

  @@index([companyId, characterType])
  @@index([permissionStatus])
  @@index([isMinor])
}
```

#### 2.10 CharacterConsent
```prisma
model CharacterConsent {
  id                    String   @id @default(cuid())
  characterId           String
  consenterType         ConsentType  // self_adult | parent_guardian | legal_guardian
  consenterName         String
  consenterEmail        String
  consenterPhone        String?
  consenterRelationship String?  // for parent/guardian
  consentScope          String[]  // ["educational_video", "marketing", "commercial"]
  commercialUseConsented Boolean @default(false)
  consentedAt           DateTime @default(now())
  revokedAt             DateTime?
  evidence              String?  // path to signed PDF or recorded audio (encrypted)

  character             LearningCharacter @relation(fields: [characterId], references: [id], onDelete: Cascade)

  @@index([characterId])
  @@index([consenterEmail])
}
```

#### 2.11 VoiceProfile
```prisma
model VoiceProfile {
  id                String   @id @default(cuid())
  companyId         String
  name              String
  engine            String   // "voicebox:kokoro" | "piper" | "espeak" | "voicebox:chatterbox"
  language          String   @default("bn")
  sourceAssetPath   String?  @db.Text  // encrypted at rest; for cloned voices
  isCloned          Boolean  @default(false)
  isMinor           Boolean  @default(false)
  permissionStatus  PermissionStatus  @default("pending")
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  deletedAt         DateTime?

  consents           VoiceConsent[]
  generations        VoiceGeneration[]

  @@index([companyId])
  @@index([engine])
  @@index([isCloned])
  @@index([isMinor])
}
```

#### 2.12 VoiceConsent
```prisma
model VoiceConsent {
  id                    String   @id @default(cuid())
  voiceProfileId        String   @unique
  consenterType         ConsentType
  consenterName         String
  consenterEmail        String
  consenterPhone        String?
  consenterRelationship String?
  consentScope          String[]
  commercialUseConsented Boolean @default(false)
  consentedAt           DateTime @default(now())
  revokedAt             DateTime?
  evidence              String?

  voiceProfile          VoiceProfile @relation(fields: [voiceProfileId], references: [id], onDelete: Cascade)

  @@index([consenterEmail])
}
```

#### 2.13 VoiceGeneration
```prisma
model VoiceGeneration {
  id              String   @id @default(cuid())
  voiceProfileId  String?
  companyId       String
  scriptText      String   @db.Text
  language        String   @default("bn")
  engine          String
  outputAssetId   String?  // FK to LearningAsset
  durationSec     Float?
  jobId           String?
  syntheticMedia  Boolean  @default(true)
  createdAt       DateTime @default(now())

  voiceProfile    VoiceProfile? @relation(fields: [voiceProfileId], references: [id])
  job             MediaGenerationJob? @relation(fields: [jobId], references: [id])

  @@index([voiceProfileId])
  @@index([companyId, createdAt])
}
```

### Domain 3: Media Jobs & Approvals (7 models)

#### 2.14 MediaGenerationJob
```prisma
model MediaGenerationJob {
  id              String   @id @default(cuid())
  jobId           String   @unique  // UUID for external reference
  requester       String   // admin email
  companyId       String   // tenant scope
  serviceName     String   // one of the 12 services
  inputAssets     String   @db.Text  // JSON array of signed URLs
  selectedEngine  String
  modelProvider   String
  status          JobStatus  @default("queued")  // queued | running | succeeded | failed | cancelled | awaiting_approval
  progress        Int      @default(0)  // 0-100
  outputFiles     String?  @db.Text  // JSON array
  executionTimeMs Int?
  resourceUsage   String?  @db.Text  // JSON: {cpuMs, memoryMb, vramMb, estimatedCostUsd}
  errorDetails    String?  @db.Text  // JSON
  approvalStatus  ApprovalStatus  @default("not_required")
  approvalId      String?
  createdAt       DateTime @default(now())
  startedAt       DateTime?
  finishedAt      DateTime?

  approval        MediaApproval? @relation(fields: [approvalId], references: [id])
  project         LearningProject?
  voiceGeneration VoiceGeneration?
  videoRender     VideoRender?
  workflowExec    WorkflowExecution?
  agentExec       AgentExecution[]

  @@index([companyId, status])
  @@index([requester, createdAt])
  @@index([status, createdAt])
  @@index([jobId])
}
```

#### 2.15 VideoRender
```prisma
model VideoRender {
  id              String   @id @default(cuid())
  jobId           String?  @unique
  projectId       String?
  videoMode       VideoMode
  outputAssetId   String?
  durationSec     Float?
  resolution      String   @default("1920x1080")
  codec           String   @default("h264")
  audioCodec      String   @default("aac")
  burnedSubtitles Boolean  @default(false)
  createdAt       DateTime @default(now())

  job             MediaGenerationJob? @relation(fields: [jobId], references: [id])
  project         LearningProject? @relation(fields: [projectId], references: [id])
  subtitleTracks  SubtitleTrack[]

  @@index([projectId])
  @@index([videoMode])
}
```

#### 2.16 SubtitleTrack
```prisma
model SubtitleTrack {
  id              String   @id @default(cuid())
  videoRenderId   String
  language        String   // ISO 639-1
  format          String   @default("srt")  // srt | vtt | ass
  content         String   @db.LongText
  burnStyle       String?  // default | rounded_bg | karaoke
  createdAt       DateTime @default(now())

  videoRender     VideoRender @relation(fields: [videoRenderId], references: [id], onDelete: Cascade)

  @@index([videoRenderId, language])
}
```

#### 2.17 MediaApproval
```prisma
model MediaApproval {
  id              String   @id @default(cuid())
  jobId           String?
  contentId       String?
  approvalType    ApprovalType  // child_related | voice_clone | medical_claim | publish | general
  requestedBy     String   // admin email
  requestedAt     DateTime @default(now())
  reviewedBy      String?
  reviewedAt      DateTime?
  decision        ApprovalDecision  @default("pending")  // pending | approved | rejected
  reviewNotes     String?  @db.Text
  childRelated    Boolean  @default(false)

  job             MediaGenerationJob? @relation(fields: [jobId], references: [id])
  content         LearningContent? @relation(fields: [contentId], references: [id])

  @@index([decision, requestedAt])
  @@index([childRelated, decision])
}
```

#### 2.18 MediaAuditLog
```prisma
model MediaAuditLog {
  id              String   @id @default(cuid())
  jobId           String?
  serviceName     String   // one of the 12 services
  operation       String   // e.g., "voice.generate", "video.render"
  callerAdminEmail String
  inputHash       String   // SHA-256
  outputHash      String?
  durationMs      Int
  success         Boolean
  errorMessage    String?  @db.Text
  syntheticMedia  Boolean  @default(false)
  childRelated    Boolean  @default(false)
  createdAt       DateTime @default(now())

  @@index([serviceName, createdAt])
  @@index([callerAdminEmail, createdAt])
  @@index([syntheticMedia])
  @@index([childRelated])
}
```

#### 2.19 MediaUsageRecord
```prisma
model MediaUsageRecord {
  id              String   @id @default(cuid())
  assetId         String   // FK to LearningAsset
  usedBy          String   // admin email or agent ID
  usageType       String   // e.g., "video_render", "voice_generation"
  usageContext    String?
  createdAt       DateTime @default(now())

  @@index([assetId, createdAt])
  @@index([usedBy])
}
```

#### 2.20 ContentSafetyReview
```prisma
model ContentSafetyReview {
  id              String   @id @default(cuid())
  contentId       String   @unique
  reviewerAgentId String?  // Agent 18 (Content Safety Agent)
  reviewStatus    ReviewStatus  @default("pending")  // pending | passed | flagged | blocked
  medicalClaims   Boolean  @default(false)
  developmentalClaims Boolean @default(false)
  requiresExpertReview Boolean @default(false)
  expertReviewedBy String?
  expertReviewedAt DateTime?
  reviewNotes     String?  @db.Text
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  content         LearningContent @relation(fields: [contentId], references: [id], onDelete: Cascade)

  @@index([reviewStatus])
  @@index([requiresExpertReview])
}
```

### Domain 4: Publishing (3 models)

#### 2.21 PublishingAccount
```prisma
model PublishingAccount {
  id              String   @id @default(cuid())
  companyId       String
  platform        SocialPlatform  // facebook | youtube | tiktok
  accountName     String
  accountId       String   // platform-specific account ID
  accessToken     String   @db.Text  // AES-256-GCM encrypted
  refreshToken    String?  @db.Text  // AES-256-GCM encrypted
  tokenExpiresAt  DateTime?
  autoPublishCategories String[]  // categories allowed for auto-publish
  isConnected     Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  jobs            PublishingJob[]

  @@unique([platform, accountId])
  @@index([companyId, platform])
}
```

#### 2.22 PublishingJob
```prisma
model PublishingJob {
  id              String   @id @default(cuid())
  accountId       String
  contentId       String?
  videoRenderId   String?
  format          PublishFormat  // vertical_9_16 | landscape_16_9 | square_1_1 | feed_4_5
  title           String
  description     String?  @db.Text
  hashtags        String[]  // JSON array
  thumbnailAssetId String?
  language        String   @default("bn")
  scheduledAt     DateTime?
  approvalStatus  ApprovalStatus  @default("required")
  approvalId      String?
  status          PublishStatus  @default("pending")  // pending | approved | publishing | published | failed | cancelled
  createdAt       DateTime @default(now())
  publishedAt     DateTime?

  account         PublishingAccount @relation(fields: [accountId], references: [id])
  records         PublishingRecord[]

  @@index([accountId, status])
  @@index([scheduledAt])
}
```

#### 2.23 PublishingRecord
```prisma
model PublishingRecord {
  id              String   @id @default(cuid())
  jobId           String
  platform        SocialPlatform
  externalPostId  String?  // platform-specific post ID
  externalUrl     String?  @db.Text
  publishedAt     DateTime?
  status          PublishStatus
  errorDetails    String?  @db.Text

  job             PublishingJob @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId])
  @@index([platform, publishedAt])
}
```

### Domain 5: Communication (6 models)

#### 2.24 CommunicationProvider
```prisma
model CommunicationProvider {
  id              String   @id @default(cuid())
  companyId       String
  providerType    ProviderType  // sms | telephony
  providerName    String   // "httpsms" | "httpsms_self_hosted" | "domovina" | "twilio" | "vonage" | "sip_provider"
  config          String   @db.Text  // JSON config (encrypted)
  apiKeyEnv       String   // env var name (never the key itself)
  isEnabled       Boolean  @default(false)
  isDefault       Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  smsMessages     SMSMessage[]
  callRecords     CallRecord[]

  @@index([companyId, providerType])
  @@index([isDefault])
}
```

#### 2.25 SMSMessage
```prisma
model SMSMessage {
  id              String   @id @default(cuid())
  providerId      String
  companyId       String
  fromPhone       String
  toPhone         String   // E.164
  content         String   @db.Text
  direction       SMSDirection  // outbound | inbound
  status          SMSStatus  @default("queued")  // queued | sent | delivered | failed | received | opt_out
  providerMessageId String?  // ID returned by provider
  webhookPayload  String?  @db.Text  // JSON of webhook delivery receipt
  encryptedContent Boolean @default(true)  // AES-256-GCM if true
  sentAt          DateTime?
  deliveredAt     DateTime?
  receivedAt      DateTime?
  createdAt       DateTime @default(now())

  provider        CommunicationProvider @relation(fields: [providerId], references: [id])

  @@index([toPhone, createdAt])
  @@index([companyId, status])
  @@index([providerMessageId])
}
```

#### 2.26 SMSDelivery
```prisma
model SMSDelivery {
  id              String   @id @default(cuid())
  messageId       String
  attempt         Int      @default(1)
  status          SMSStatus
  errorCode       String?
  errorMessage    String?  @db.Text
  attemptedAt     DateTime @default(now())

  @@index([messageId])
}
```

#### 2.27 TelephonyAccount
```prisma
model TelephonyAccount {
  id              String   @id @default(cuid())
  companyId       String
  providerId      String
  sipUsername     String
  sipDomain       String
  sipPasswordEnc  String   @db.Text  // AES-256-GCM encrypted
  displayName     String?
  isEnabled       Boolean  @default(true)
  createdAt       DateTime @default(now())

  provider        CommunicationProvider @relation(fields: [providerId], references: [id])
  callRecords     CallRecord[]

  @@index([companyId])
  @@index([sipUsername])
}
```

#### 2.28 CallRecord
```prisma
model CallRecord {
  id              String   @id @default(cuid())
  providerId      String
  accountId       String?
  companyId       String
  direction       CallDirection  // inbound | outbound
  fromPhone       String
  toPhone         String
  status          CallStatus  // queued | ringing | answered | missed | failed | transferred | completed
  startedAt       DateTime?
  endedAt         DateTime?
  durationSec     Int?
  recordingPath   String?  @db.Text  // encrypted at rest
  aiSummary       String?  @db.Text
  transcriptId    String?
  escalatedToHuman Boolean @default(false)
  createdAt       DateTime @default(now())

  provider        CommunicationProvider @relation(fields: [providerId], references: [id])
  account         TelephonyAccount? @relation(fields: [accountId], references: [id])
  transcript      CallTranscript?

  @@index([companyId, createdAt])
  @@index([status])
  @@index([fromPhone])
}
```

#### 2.29 CallTranscript
```prisma
model CallTranscript {
  id              String   @id @default(cuid())
  callId          String   @unique
  transcriptText  String   @db.LongText
  language        String   @default("bn")
  segments        String   @db.LongText  // JSON array of {start, end, text, speaker}
  generatedBy     String?  // agent ID or "human"
  createdAt       DateTime @default(now())

  call            CallRecord @relation(fields: [callId], references: [id], onDelete: Cascade)

  @@index([callId])
}
```

### Domain 6: Agents & Workflows (2 models)

#### 2.30 AgentExecution
```prisma
model AgentExecution {
  id              String   @id @default(cuid())
  agentId         String   // one of the 20 agents (e.g., "01_learning_research")
  jobId           String?
  companyId       String
  inputBrief      String?  @db.Text
  outputJson      String?  @db.LongText
  status          AgentStatus  @default("idle")  // idle | running | success | failed | blocked_external_setup | awaiting_approval
  costUsd         Decimal? @db.Decimal(10, 4)  // REAL cost (replaces fictional costEstUsd)
  tokenCount      Int?
  retryCount      Int      @default(0)
  escalatedToHuman Boolean @default(false)
  startedAt       DateTime?
  finishedAt      DateTime?
  createdAt       DateTime @default(now())

  job             MediaGenerationJob? @relation(fields: [jobId], references: [id])

  @@index([agentId, status])
  @@index([companyId, createdAt])
}
```

#### 2.31 WorkflowExecution
```prisma
model WorkflowExecution {
  id              String   @id @default(cuid())
  workflowId      String   // ComfyUI workflow ID
  jobId           String?  @unique
  companyId       String
  inputMapping    String   @db.Text  // JSON
  nodeConfig      String   @db.Text  // JSON
  outputAssets    String?  @db.Text  // JSON array
  status          JobStatus  @default("queued")
  errorDetails    String?  @db.Text
  gpuUsed         String?
  executionMode   String   @default("local")  // local | remote (RunningHub)
  startedAt       DateTime?
  finishedAt      DateTime?
  createdAt       DateTime @default(now())

  job             MediaGenerationJob? @relation(fields: [jobId], references: [id])

  @@index([workflowId, status])
  @@index([companyId, createdAt])
}
```

---

## 3. Enums

```prisma
enum LearningDepartment {
  kids
  parenting
  teacher
}

enum ContentStatus {
  draft
  research
  scripting
  storyboard
  rendering
  approved
  published
  archived
}

enum FactCheckStatus {
  pending
  verified
  flagged
  rejected
}

enum VideoMode {
  explainer
  documentary
  three_d_animated
  ai_presenter
  talking_character
  parent_education
  teacher_training
  short_form
  long_form_youtube
  animated_infographics
}

enum AssetType {
  image
  audio
  video
  subtitle
  document
  character_reference
}

enum CharacterType {
  fictional
  stock
  adult_presenter
  parent_presenter
  teacher_presenter
  family_member
}

enum PermissionStatus {
  pending
  approved
  rejected
  revoked
}

enum ConsentType {
  self_adult
  parent_guardian
  legal_guardian
}

enum JobStatus {
  queued
  running
  succeeded
  failed
  cancelled
  awaiting_approval
}

enum ApprovalStatus {
  not_required
  required
  approved
  rejected
}

enum ApprovalType {
  child_related
  voice_clone
  medical_claim
  publish
  general
}

enum ApprovalDecision {
  pending
  approved
  rejected
}

enum ReviewStatus {
  pending
  passed
  flagged
  blocked
}

enum SocialPlatform {
  facebook
  youtube
  tiktok
}

enum PublishFormat {
  vertical_9_16
  landscape_16_9
  square_1_1
  feed_4_5
}

enum PublishStatus {
  pending
  approved
  publishing
  published
  failed
  cancelled
}

enum ProviderType {
  sms
  telephony
}

enum SMSDirection {
  outbound
  inbound
}

enum SMSStatus {
  queued
  sent
  delivered
  failed
  received
  opt_out
}

enum CallDirection {
  inbound
  outbound
}

enum CallStatus {
  queued
  ringing
  answered
  missed
  failed
  transferred
  completed
}

enum AgentStatus {
  idle
  running
  success
  failed
  blocked_external_setup
  awaiting_approval
}
```

**Using Prisma enums (instead of String) enforces DB-level constraints** — addresses baseline DB-3 finding. Backfill any existing bad rows before applying.

---

## 4. Migration plan (non-destructive)

### 4.1 Principles

1. **Strictly additive.** No `DROP TABLE`, no `DROP COLUMN`, no `ALTER TABLE` that breaks existing rows.
2. **`_prisma_migrations` history verification first.** Before running any ALO Learning migration, the team must verify the production `_prisma_migrations` table matches the checked-in migration history. This is the directive's mandatory "first inspect existing Prisma schema" step.
3. **Restore rehearsal before production.** A disposable-DB restore from the latest production backup must be performed; the ALO Learning migrations are run against the restored DB; results are validated. Only then are the migrations run against production.
4. **`prisma migrate deploy` (not `prisma migrate dev`).** Production uses `migrate deploy` which applies existing migrations without prompting. `prisma migrate dev` is for development only and is guarded by `scripts/prisma-dev-guard.mjs`.
5. **One migration per phase.** Each ALO Learning phase gets its own migration with a timestamp prefix: `20261106000000_alo_learning_phase_2_central_api`, `20261120000000_alo_learning_phase_3_voice_engine`, etc.

### 4.2 Migration sequence

| Migration | Phase | Models added | Notes |
|---|---|---|---|
| `20261106000001_alo_learning_enums` | 2 | (enums only) | All enums above |
| `20261106000002_alo_learning_audit_log_extension` | 2 | (AuditLog + AIAgentRun extensions) | Adds nullable fields to existing models |
| `20261113000000_alo_learning_phase_2_jobs_approvals` | 2 | MediaGenerationJob, MediaApproval, MediaAuditLog | Central async job + approval infrastructure |
| `20261120000000_alo_learning_phase_3_voice` | 3 | VoiceProfile, VoiceConsent, VoiceGeneration, LearningAsset | Voice engine + consent |
| `20261127000000_alo_learning_phase_4_communication` | 4 | CommunicationProvider, SMSMessage, SMSDelivery, TelephonyAccount, CallRecord, CallTranscript | SMS + Telephony |
| `20261204000000_alo_learning_phase_5_content` | 5 | LearningContent, LearningTopic, LearningResearchSource, LearningScript, LearningStoryboard, LearningScene, LearningProject, ContentSafetyReview | Learning content engine |
| `20261211000000_alo_learning_phase_6_character` | 6 | LearningCharacter, CharacterConsent | Character studio |
| `20261218000000_alo_learning_phase_7_video` | 7 | VideoRender, SubtitleTrack, MediaUsageRecord | Video engine |
| `20261225000000_alo_learning_phase_8_workflow` | 8 | WorkflowExecution | ComfyUI workflow engine |
| `20270101000000_alo_learning_phase_10_publishing` | 10 | PublishingAccount, PublishingJob, PublishingRecord | Social publishing |
| `20270108000000_alo_learning_phase_11_agents` | 11 | AgentExecution | AI workforce |

### 4.3 Pre-migration checklist (mandatory before each migration)

1. ✅ Verify production `_prisma_migrations` table matches checked-in history.
2. ✅ Take a fresh production backup (`deploy/backup.sh`).
3. ✅ Restore the backup to a disposable MySQL instance.
4. ✅ Run the new migration against the disposable instance.
5. ✅ Validate: every new table exists with the expected columns; every existing table is unchanged; row counts match.
6. ✅ Run `npm run verify:migrations` (static check).
7. ✅ Run `npm run build` (no TypeScript errors).
8. ✅ Run `npm test` (existing tests still pass).
9. ✅ Get admin sign-off.
10. ✅ Deploy to production with `prisma migrate deploy`.

### 4.4 Rollback plan

Each ALO Learning migration is additive (creates tables, adds nullable columns). Rollback is safe: the new tables can be dropped without affecting existing data. The rollback procedure:

```bash
# Identify the migration to roll back
ls -la prisma/migrations/ | grep alo_learning

# Drop the tables added by the migration
mysql -u root db_learn -e "
  DROP TABLE IF EXISTS alo_learning_agent_execution;
  DROP TABLE IF EXISTS alo_learning_workflow_execution;
  -- etc.
"

# Remove the migration record from _prisma_migrations
mysql -u root db_learn -e "
  DELETE FROM _prisma_migrations WHERE migration_name LIKE '%alo_learning%';
"
```

**Rollback does NOT roll back the existing ALO data** — only the new ALO Learning tables are dropped. This is the safety guarantee of additive-only migrations.

### 4.5 Data retention policies

| Model | Retention | Reason |
|---|---|---|
| `MediaAuditLog` | 7 years | Compliance audit trail |
| `SMSMessage` | 2 years | Telecom regulation |
| `CallRecord` + `CallTranscript` | 2 years (consent-dependent) | Varies by jurisdiction |
| `MediaGenerationJob` | 90 days | Operational debugging |
| `VoiceGeneration` | Forever (or until voice profile revoked) | Audit trail for synthetic media |
| `PublishingRecord` | Forever | Publishing audit trail |
| `LearningAsset` (signed URLs) | 1-hour URL expiry; asset forever unless soft-deleted | |
| Agent recordings (`/watch` skill output) | 30 days (`ALO_WATCH_RETENTION_DAYS`) | Storage growth control |

A daily cron job (`scripts/alo-learning-retention-cron.mjs`) enforces these policies.

---

## 5. Index strategy

Indexes are designed for the most common query patterns:

- **Tenant-scoped queries:** every model has `@@index([companyId, <filter_field>])` for the most common filter.
- **Status-based queues:** `MediaGenerationJob`, `MediaApproval`, `SMSMessage`, `CallRecord`, `AgentExecution`, `WorkflowExecution` all have `@@index([status, createdAt])` for queue workers.
- **Soft-delete:** models with `deletedAt` have `@@index([deletedAt])` for the cleanup cron.
- **Child-safety:** `LearningCharacter` has `@@index([isMinor])`; `MediaAuditLog` has `@@index([childRelated])`; `MediaApproval` has `@@index([childRelated, decision])` for fast safety queries.
- **Consent revocation:** `VoiceConsent` and `CharacterConsent` have `@@index([consenterEmail])` for "find all consents by this person" queries.

---

## 6. Comparison to baseline findings

| Baseline finding | Resolution in this design |
|---|---|
| DB-1 (No production restore test) | Section 4.3 pre-migration checklist mandates restore rehearsal |
| DB-2 (`costEstUsd` Float) | `AgentExecution.costUsd` Decimal @db.Decimal(10, 4); old field deprecated not removed |
| DB-3 (String-typed enum-ish columns) | All 21 new fields use Prisma enums (DB-level constraint) |
| DB-4 (longText outputJson pattern) | `outputJson` longText preserved where needed; stable fields extracted to real columns where queried |
| DB-5 (Dead SQLite fallback) | Not addressed here — `security-review.md` Section 3.11 schedules removal in Phase 0 |
| DB-6 (Indexes on FK/status — positive) | Continued — every new model has appropriate indexes |
| DB-7 (Migration lock + multi-target binaries — positive) | Continued — no changes to `migration_lock.toml` or `binaryTargets` |
| DB-8 (32 vs 42 model count drift) | This design brings the total to 42 + 31 = 73 models; historical doc updated |

---

## Cross-references

- `baseline-audit.md` Section D — existing 42 models, 5 migrations.
- `repository-audit.md` — no DB impact (adapters only).
- `architecture.md` — the 12 services that own these models.
- `integration-matrix.md` — adapter state models (`CommunicationProvider`, `PublishingAccount`).
- `security-review.md` — child-privacy models (`CharacterConsent`, `VoiceConsent`, `MediaApproval`); encryption at rest.
- `deployment-guide.md` — migration execution, restore rehearsal, rollback.
- `testing-report.md` — migration verifier tests, restore test.
- `production-readiness.md` — DB migration verification is DoD criterion #9.

---

## Final note

This database design adds 31 new Prisma models in 11 additive migrations sequenced across ALO Learning Phases 2-11. No existing model is renamed, dropped, or has a column removed. Every new model is tenant-scoped via `companyId` (single-admin model preserved). Child-safety, consent, and audit trail are first-class concerns baked into the schema.

The directive's FINAL RULE is reaffirmed: **reuse existing models when appropriate. Do not create duplicate user, tenant or permission tables. Generate migrations safely. Never reset the production database.**
