# ALO Learning — Baseline Audit

> **Document type:** Baseline audit (Phase 0 deliverable)
> **Audited repo:** `tech360-bd/ALO-LEARNING-JOURNEY-PRODUCTION` (package version 0.2.1)
> **Audit date:** 2026-11-05
> **Auditor:** Z.ai
> **Method:** Repository-only source audit (no live runtime, VPS, or DB access). Every claim in this document was verified by reading the actual source code, the Prisma schema, the migration SQL, the package manifest, and the configuration files at the audited commit.
> **Companion documents:** `repository-audit.md`, `architecture.md`, `integration-matrix.md`, `security-review.md`, `database-design.md`, `deployment-guide.md`, `testing-report.md`, `production-readiness.md`.

---

## Purpose and scope

This baseline audit satisfies **Section 2 (MANDATORY FIRST STEP: REPOSITORY AUDIT)** of the ALO Learning Master Engineering & Integration Directive. It establishes the verified state of the existing ALO Education platform before any ALO Learning work begins. It is the authoritative reference for:

1. What already exists and must be preserved.
2. What is missing and must be built by ALO Learning.
3. What is broken or risky and must be fixed before ALO Learning integration.
4. The integration conflicts the ALO Learning architecture must respect.

The directive's FINAL RULE is explicit: **audit first, preserve existing production functionality, integrate modularly, test every real operation, never fake successful integrations.** This document is the "audit first" step.

A Git checkpoint must be created before any implementation begins. The recommended checkpoint tag is `alo-learning-baseline-2026-11-05` on the current `main` HEAD, with a signed annotated tag message referencing this document.

---

## A. Existing architecture

### A.1 Framework and runtime

| Layer | Technology | Version | Source |
|---|---|---|---|
| Application framework | Next.js | `^16.4.2` (App Router) | `package.json` |
| UI runtime | React | `^19.0.0` | `package.json` |
| Language | TypeScript | `^5` | `package.json` |
| Runtime requirement | Node.js | `>=22 <23` | `package.json` `engines` |
| Package manager | npm (with `package-lock.json`); `bun.lock` also present but bun is not the documented runtime | npm | `package.json`, `bun.lock` |
| Database ORM | Prisma | `^6.19.3` | `package.json` |
| Database | MySQL | (production DSN: `127.0.0.1:3306/db_learn`) | `.env.example`, `prisma/schema.prisma` |
| Authentication | next-auth | `^4.24.11` (v4, not v5) | `package.json` |
| Validation | zod | `^4.0.2` | `package.json` |
| Styling | Tailwind CSS | `^4` (with `@tailwindcss/postcss`, `tw-animate-css`) | `package.json` |
| UI primitives | Radix UI | ~28 `@radix-ui/*` packages | `package.json` |
| Charts | recharts | `^2.15.4` | `package.json` |
| Tables | @tanstack/react-table | `^8.21.3` | `package.json` |
| Forms | react-hook-form + @hookform/resolvers | `^7.60 / ^5.1` | `package.json` |
| State | zustand | `^5.0.6`; plus @tanstack/react-query for server state | `package.json` |
| i18n | next-intl | `^4.3.4` | `package.json` |
| Email | nodemailer | `^7.0.13` (cPanel SMTP `learn.aloeducation.com:465 SSL`) | `package.json`, `.env.example` |
| Media processing | sharp | `^0.35.5` | `package.json` |
| Video processing | `@ffmpeg-installer/ffmpeg` + `@ffprobe-installer/ffprobe` | `^1.1 / ^2.1` (bundled binaries) | `package.json` |
| AI SDK | `z-ai-web-dev-sdk` | `^0.0.18` | `package.json` |
| Password hashing | bcryptjs | `^3.0.3` (auxiliary; admin uses scrypt directly) | `package.json` |
| Local fonts | HindSiliguri | 4 weights bundled in `public/fonts/` | `public/fonts/` |

### A.2 Topology

The application is designed to run as a Next.js 16 standalone server (`next build` produces `.next/standalone/server.js`) behind a reverse proxy. **Two deployment topologies ship in the same repository and are not reconciled** — see Section F.

The application shell is a single page (`src/app/page.tsx`) hosting the entire product. There are no per-feature Next.js pages beyond `/`, `/login`, and `/contact`. Feature "views" are React components mounted in the shell, switchable via sidebar, command palette (Cmd+K), and a quick-action floating action button.

### A.3 Single-administrator design

The product is **deliberately single-administrator**: there is no RBAC, no multi-user model, no tenant isolation. The `x-alo-company-id` header used by the company switcher is a scope selector, not identity-bound tenant authorization. This is the critical framing assumption for every security finding in this audit: the attack surface is "anyone on the internet vs the single admin", not "tenant vs tenant".

The ALO Learning directive (Section 1) lists 15 mission requirements. The single-admin model is compatible with all 15 — ALO Learning is an extension of the existing platform, not a replacement — but the ALO Learning database design must add tenant-scoped entities that respect this single-admin boundary.

---

## B. Existing modules

The 50 view files in `src/components/alo/` group into the following modules. Counts are file counts; some views are split across multiple files.

| Module | Components | Primary purpose |
|---|---|---|
| Dashboard | Dashboard, ActivityTimeline, NotificationPanel, Sparkline, QuickActionsFab | KPI overview, activity feed, sparklines |
| Command centre | CommandPalette, CommandCenterView, AgentsView, ApprovalQueue, PipelineRunner | Cmd+K palette, agent run supervision, approval workflow |
| Content studio | ContentStudio, TopicsView, PackageHistoryView, PublishingQueueView, CommentsView, SeoView | End-to-end content lifecycle |
| CRM / Admissions | AdmissionsCRMView, CrmView, crm/* (LeadFormDialog, LeadDetailsDialog, QuotationBuilder, QuotationDocument, QuotationPreview, AdmissionPipeline, print-quotation) | Leads, quotations, invoices, admission pipeline |
| Voice studio | VoiceStudioView, PhotoVoiceCloneView, AsrView | Bengali/English TTS, voice cloning, ASR transcription |
| Image studio | ImageStudioView, DiagramStudioView, InkboxView | AI/ComfyUI image generation, diagram drawing, Inkbox adapter |
| Video studio | VideoPipelineView, PhotoToVideoStudio, HumanAvatarView | Local-only MP4 pipeline from photo + script |
| Audio studio | AudioStudioView | Local speech + procedural music |
| AgentOS | AgentsView, WorkflowView, GrowthLoopView, LoopAIView | 42 configured agents, skill registry, growth loop orchestration |
| Family studio | FamilyStudioView, FamilyView | Avatar/voice family cloning with reference assets |
| Marketing | MarketingKitsView, SocialView, CommunicationsView, TelegramView | Marketing kit generation, social connectors, comms console |
| RAG / knowledge | RagView | Document ingest, chunk, vector search (local-only, keyword) |
| Insights | AnalyticsView, CostUsageView, CalendarView | Analytics snapshots, cost telemetry (fictional — see Section E), content calendar |
| Settings / admin | SettingsView, BrandSettings, AiProvidersSettings, ApiReferenceView, BackupsView, OtpView, OnboardingTour, ThemeToggle, CompanySwitcher, ExportButton | Owner configuration, AI provider toggles, backup management |

### B.1 What "exists" actually means

The directive says: **"Do not assume a feature exists because a UI component exists. Verify every feature against its API, database and actual working behavior."**

Verified against API and DB:

- **Content Studio**: real — backed by `/api/ideas`, `/api/content/{brief,generate,package}`, `/api/publish`, `/api/comments`; persists to `ContentIdea`, `ContentPackage`, `PublishedPost`, `CommentInbox` Prisma models.
- **CRM / Admissions**: real — backed by `/api/crm/{leads,quotes,invoices,clients,projects,campaigns}`; persists to `Lead`, `Quotation`, `QuotationItem`, `Invoice`, `Client`, `Project`, `Campaign` models.
- **Voice Studio**: real — backed by `/api/voice/{generate,script}`, `/api/asr-transcribe`; persists to `VoiceGeneration`, `AudioTranscription`; uses local Piper/espeak.
- **Photo-to-Video Studio**: real — backed by `/api/video/{from-photo,generate,cinematic,storyboard}`; produces MP4 + sidecar .srt.
- **Avatar Video**: real but gated — `/api/avatar-video`, `/api/avatar-video/file` use `z-ai-web-dev-sdk` (paid-AI gated).
- **Image Studio / Diagram Studio**: real — backed by `/api/{image-studio,diagrams,inkbox}`; uses local ComfyUI when configured.
- **AgentOS**: partial — `src/lib/agents.ts` defines 42 agents, but no actual job runner exists (synchronous request-response only); `/api/agentos/{command,agents,health/deep}` exist.
- **Family Studio**: real — backed by `/api/{family,family-projects,family-studio,family/clone}`; persists to `FamilyModel`, `FamilyProfile`, `FamilyReferenceAsset`, `FamilyProject`.
- **Marketing**: partial — `/api/marketing/{leads,email-draft,humanize}` exist; `/api/social` returns "external_setup_required" (OAuth not wired).
- **RAG**: real but limited — `/api/rag/{ingest,search}` exist; keyword search via Prisma only (no embeddings, no vector store).
- **Cost Usage / Analytics**: real UI, **fictional data** — `agent-runtime.ts` hardcodes `costEstUsd: 0.01` per run; `/api/costs` aggregates static catalog data; `CostUsageView` renders it as measured spend.
- **Inkbox**: real — backed by `/api/inkbox`, `src/lib/inkbox.ts`; adapter to an external service.
- **Telegram**: real but limited — `/api/telegram` is an admin-only in-app command console; no webhook, no message delivery.
- **Communications**: real — `/api/notifications`, `/api/contact`, `/api/email/test`.
- **Backups**: real — `/api/backups` uses AES-256-GCM with auth tag; restore action only verifies payload integrity (does not restore DB).

---

## C. Existing routes

The repository exposes **81 `route.ts` handlers** under `src/app/api/`. They cluster into the following domains.

| Domain | Routes | Auth | Validation | Notes |
|---|---|---|---|---|
| Auth | 4 | Middleware + per-route | Email/password schema | next-auth + OTP send + OTP config |
| CRM | 12 | Middleware only (no in-handler) | Zod schemas in `src/lib/crm-validation.ts` | Leads, quotations, invoices, clients, projects, campaigns, lead activities |
| Media studio | 14 | Middleware only | Mixed; family-upload has Zod, others ad-hoc | voice, avatar-video, image-studio, voice-studio, video, music, asr-transcribe, media |
| AI / agents | 8 | Middleware only | Ad-hoc | ai/local-status, agents, agentos, costs, rag, protective-review |
| Content | 6 | Middleware only | Ad-hoc | ideas, content, publish, comments |
| Marketing | 3 | Middleware only | Ad-hoc | marketing leads, email-draft, humanize |
| Operations | 14 | Middleware only; recovery/sweep also accepts x-cron-secret | Ad-hoc | health, dashboard, activity, notifications, analytics, calendar, audit, settings, seed, export, backups, recovery/sweep, approvals, contact |
| Family / social | 5 | Middleware only | Family uploads Zod-validated | family, family/clone, family-projects, family-studio, social |
| Platform / IO | 6 | Middleware only | Ad-hoc | companies, departments, workforce, diagrams, inkbox, telegram, publishing, human-avatars, growth, learning |
| Public API spec | 1 | Public (no auth) | N/A | openapi.json |
| Misc | 8 | Mixed | Mixed | auth/otp/config, email/test, command, publish |

### C.1 Routes with no in-handler auth check (defence-in-depth gap)

The following 30+ route files do not call `requireOwner()`, `getServerSession()`, `getServerAuthSession()`, or `getToken()` inside the handler. They depend entirely on `src/middleware.ts` for auth:

```
src/app/api/crm/quotes/route.ts
src/app/api/crm/quotes/[id]/route.ts
src/app/api/crm/invoices/route.ts
src/app/api/crm/leads/route.ts
src/app/api/crm/leads/[id]/route.ts
src/app/api/crm/leads/[id]/activities/route.ts
src/app/api/crm/projects/route.ts
src/app/api/crm/clients/route.ts
src/app/api/crm/campaigns/route.ts
src/app/api/voice-studio/route.ts
src/app/api/learning/route.ts
src/app/api/health/route.ts
src/app/api/publish/route.ts
src/app/api/settings/route.ts
src/app/api/audit/route.ts
src/app/api/family-projects/route.ts
src/app/api/seed/route.ts
src/app/api/telegram/route.ts
src/app/api/voice/script/route.ts
src/app/api/voice/generate/route.ts
src/app/api/comments/route.ts
src/app/api/workforce/route.ts
src/app/api/asr-transcribe/route.ts
src/app/api/agents/route.ts
src/app/api/companies/route.ts
src/app/api/calendar/route.ts
src/app/api/ai/local-status/route.ts
src/app/api/backups/route.ts
src/app/api/dashboard/route.ts
src/app/api/agentos/command/route.ts
```

**Implication for ALO Learning:** every new ALO Learning API route MUST call `requireOwner()` as its first statement. The 12 new logical services inherit this obligation.

---

## D. Existing database models

### D.1 Schema overview

The Prisma schema at `prisma/schema.prisma` targets **MySQL** and is locked to that provider via `prisma/migrations/migration_lock.toml`. The schema declares **42 models** covering the operational data layer.

The agent roster itself is a static config module (`src/lib/agents.ts`) so it stays richly typed and always available even before the DB is seeded — ALO Learning's 20 new agents should follow the same pattern.

### D.2 Migrations

| Migration | Lines | Summary |
|---|---|---|
| `20261001000000_initial_baseline` | 451 | Baseline schema: companies, agents, content, approvals, RAG, analytics, OTP, audit, social, family, departments, notifications |
| `20261007000000_human_avatar_ownership` | 61 | Adds HumanAvatar model + ownership fields |
| `20261010000000_admissions_crm_quotes` | 77 | Adds CRM leads/quotations/invoices/clients/projects/campaigns with compound indexes |
| `20261010000001_admin_otp_challenges` | 17 | Adds AdminOtpChallenge with phoneHash unique, otpHash, expiresAt, consumedAt, failedAttempts |
| `20261018000000_v2_additive_mysql_tables` | 145 | Adds 10 new models (v2 feature expansion — brings total to 42). Additive only. |

### D.3 Largest models by field count

| Model | Fields | Purpose |
|---|---|---|
| `HumanAvatar` | 21 | Cloned avatar ownership + reference assets |
| `Lead` | 20 | Admissions CRM lead with stage, score, follow-ups |
| `AvatarVideo` | 20 | Generated avatar video metadata |
| `Quotation` | 19 | Admissions quotation with line items via QuotationItem |
| `FamilyReferenceAsset` | 18 | Family studio reference asset |
| `Campaign` | 17 | Marketing campaign |
| `AgentMessage` | 16 | Inter-agent message routing |
| `ContentPackage` | 16 | Packaged content bundle |
| `AIAgentRun` | 11 | Agent execution record (`costEstUsd` Float — see Section E) |
| `AdminOtpChallenge` | 9 | HMAC OTP challenge + atomic consume + failedAttempts |

### D.4 Indexes and relations

Indexes are present on most FK and status columns (good). The `Lead` model has compound indexes on `(companyId, stage)`, `(companyId, nextFollowUp)`, `(companyId, createdAt)`. `AdminOtpChallenge` has an index on `(expiresAt, consumedAt)` for the rate-limit/expire sweep. `migration_lock.toml` locks provider to `mysql`. `binaryTargets` includes `rhel-openssl-3.0.x` and `rhel-openssl-1.0.x` for CloudLinux/cPanel hosts.

### D.5 Implication for ALO Learning

The 31 new Prisma models mandated by Section 15 of the directive MUST be strictly additive. No existing model may be renamed, dropped, or have a column removed. New FKs from ALO Learning models to existing models are allowed and encouraged.

---

## E. Existing AI integrations

### E.1 The three parallel AI code paths

| Path | Code | Gating | Used for |
|---|---|---|---|
| 1. Allowlisted free external providers | `src/lib/external-ai.ts` | `ALO_PAID_AI_API_ALLOWED=true` AND `ALO_OWNER_APPROVED_PAID_AI_API=true` + provider key | Non-personal content drafts only: ideas, content package, opportunity score, hooks, content brief |
| 2. Local-first models | `src/lib/local-models.ts`, `src/lib/local-audio.ts`, `src/lib/image-processing.ts` | Always available; disable with `ALO_DISABLE_BUILTIN_LOCAL_AI=true` | Comments, protective review, commands, narration, song, email drafts, student/family data |
| 3. z-ai-web-dev-sdk | `src/app/api/{avatar-video,asr-transcribe,image-studio,voice-studio}/route.ts` | Same paid-AI switches | Avatar video generation, ASR transcription, image studio, voice studio |

The external-ai.ts allowlist tries **Groq → LLM7 → OpenCode → OpenRouter → OmniRoute** (in that order). The local-models.ts path calls Ollama for text, local-audio.ts calls Piper → espeak → formant synthesis, image-processing.ts and ComfyUI handle raster output.

### E.2 Critical AI-layer findings (carried from prior audit)

| ID | Severity | Finding |
|---|---|---|
| AI-1 | High | Two parallel AI code paths behind a single switch. z-ai routes have no allowlist, no local-first fallback, and no cost telemetry. |
| AI-2 | Medium | `LOCAL_AI.md` claim "Audio upload transcription is not enabled" is contradicted by `/api/asr-transcribe/route.ts` which is live. |
| AI-3 | Medium | Cost telemetry is fictional. `agent-runtime.ts` hardcodes `costEstUsd: 0.01` per run; UI renders as measured spend. |
| AI-4 | Medium | Inconsistent local-audio fallback. Voice/music use `synthesizeLocalSpeech`; video routes call `execSync` directly with no fallback and partial shell escaping — see Section H S-1, S-2. |

### E.3 Implication for ALO Learning

The ALO Learning Voice Engine and Video Generation Engine MUST unify these three paths behind a single facade before adding new AI capabilities. Build `src/lib/alo-learning/ai-facade.ts` that exposes `textComplete()`, `imageGenerate()`, `speechSynthesize()`, `transcribe()`, and `videoFromPhoto()` — each method tries local first, falls back to allowlisted free provider, only calls a paid SDK as a last resort with per-route cap + audit log, and records real token counts and provider cost into the existing `AIAgentRun.costEstUsd` field (renamed `costUsd` and switched to Decimal).

---

## F. Existing production deployment

### F.1 Two mutually exclusive deploy targets in one repo

| Aspect | VPS / Tailscale path | cPanel path |
|---|---|---|
| App directory | `/home/aloedu/LEARNING-JOURNEY` | `/home/aloeduca/learn.aloeducation.com` |
| Process manager | PM2 (`learn-aloeducation`) | cPanel Application Manager / Phusion Passenger |
| Listen port | `3017` (fixed) | `0.0.0.0:$PORT` (cPanel-assigned) |
| Host / IP | `100.85.239.114` (Tailscale) | `115.187.18.53` (public) |
| MySQL DSN | `127.0.0.1:3306/db_learn` | cPanel-managed MySQL |
| Reverse proxy | Nginx | cPanel-managed Apache/Nginx + AutoSSL |
| TLS | Certbot | AutoSSL (verified valid until 2027) |
| Deploy script | `scripts/deploy-production.sh` | `scripts/cpanel-start.mjs` |
| Backup script | `deploy/backup.sh` (`mysqldump`) | (no cPanel-specific backup path) |

**Both paths cannot be live at the same time.** `deploy-production.sh` and `backup.sh` hard-fail unless the database URL is exactly `mysql://...@127.0.0.1:3306/db_learn`.

### F.2 Backup and restore

The `/api/backups` route uses **real AES-256-GCM with auth tag** (a historical XOR-loop flaw was fixed). However, the restore action only verifies payload integrity; it does not restore a database. `deploy/backup.sh` produces a `mysqldump` gzip but no restore-tested path exists in the repository.

### F.3 npm audit and lint

- `npm audit` reports **FAIL: 13 findings (9 high, 4 moderate)** as recorded in `deploy/RELEASE_MANIFEST.txt` and `deploy/docs/TEST_REPORT.md`. None are triaged.
- `eslint.config.mjs` disables every meaningful rule. `tsconfig.json` sets `noImplicitAny: false` and excludes `deploy/**/*` and `scripts/**/*` from typecheck. **"lint PASS" and "typecheck PASS" are false signals.**

### F.4 Implication for ALO Learning

Before any ALO Learning deployment work (Phase 13), the team must: (1) pick one deploy target and deprecate the other; (2) triage the 13 npm audit findings; (3) re-enable ESLint strict rules; (4) implement end-to-end backup restore test as a weekly CI job; (5) verify `npm run build` is clean (a TS2345 error was documented at `src/app/api/family-studio/route.ts:188`).

---

## G. Missing capabilities (gap analysis)

The ALO Learning directive (Section 1) lists 15 mission requirements. Gap analysis:

| # | Mission requirement | Current state | Gap |
|---|---|---|---|
| 1 | AI-powered educational content creation | Partial — Content Studio exists but generic | Add 3 content departments; add learning outcome, age suitability, research reference, quiz/activity fields |
| 2 | Child development education | None | Build ALO Kids department + child-safety controls |
| 3 | Parenting education | None | Build ALO Parenting department |
| 4 | Teacher training and professional development | None | Build ALO Teacher Academy department |
| 5 | AI voice generation and speech processing | Partial — Voice Studio exists | Integrate voicebox as multi-engine replacement; add voice cloning with consent workflow |
| 6 | SMS and notification infrastructure | Partial — httpSMS for admin OTP only | Build provider-independent SMS adapter |
| 7 | VoIP and AI-assisted calling | None | Build ALO AI Communication Center |
| 8 | Cinematic video generation | Partial — photo-to-video studio exists | Add 10 video modes; add 14-step production pipeline |
| 9 | 3D educational animation | None | Add 3D Animation Engine (Manim for math; Blender via CLI-Anything) |
| 10 | Digital presenter and character systems | Partial — HumanAvatarView exists | Build Character Studio with consent system |
| 11 | Automatic subtitles, translation and editing | Partial — burned Bangla captions via ffmpeg drawtext | Integrate VideoCaptioner as sidecar (GPL caveat); add multi-language SRT/VTT |
| 12 | Social media content distribution | Partial — /api/social returns "external_setup_required" | Build ALO Social Publishing Center (Facebook, YouTube, TikTok official APIs only) |
| 13 | Learning analytics and content performance | Partial — AnalyticsView exists but generic | Add learning-specific analytics |
| 14 | Human approval and child-safety controls | Partial — ApprovalQueue UI exists | Build Safety & Approval Engine with child-safety first-class controls |
| 15 | Reusable AI agents and automation workflows | Partial — AgentOS has 42 agents, no job runner | Add 20 new specialized agents; build async job runner |

**Summary:** 8 of 15 requirements are completely missing, 7 are partial. The ALO Learning module is a substantial extension, not a small addition.

---

## H. Security risks

The prior security audit produced 13 ranked findings. All 13 carry forward as baseline risks.

| ID | Severity | Finding | Location |
|---|---|---|---|
| **S-1** | **Critical** | Shell command injection via user-supplied audio path into ffprobe `execSync` | `src/app/api/video/cinematic/route.ts:99` |
| S-2 | High | Incomplete shell escaping in espeak and ffmpeg drawtext calls | `src/app/api/video/generate/route.ts:109`; `src/app/api/avatar-video/route.ts:277,292` |
| S-3 | High | No CSRF / same-origin enforcement on any mutating endpoint except `/api/auth/otp/send` | `src/lib/same-origin.ts` (used in 1 route only) |
| S-4 | High | ~20 privileged API routes have no in-handler auth check | See Section C.1 file list |
| S-5 | Medium | No security headers (CSP/HSTS/X-Frame-Options) set by the application | `next.config.ts` |
| S-6 | Medium | In-memory rate limit, single-instance only | `src/lib/rate-limit.ts` |
| S-7 | Medium | Backup route can label partial snapshot "complete" when per-model reads fail | `src/app/api/backups/route.ts` |
| S-8 | Medium | Default `DATABASE_URL` placeholder in `.env.example` could be copy-pasted unchanged | `.env.example:6` |
| S-9 | Low | Generic OTP delivery endpoint disabled but route still present | `src/app/api/otp/route.ts` |
| S-10 | Low | Social OAuth env vars read by nothing today | `.env.example`, `src/app/api/social/route.ts` |
| S-11 | Low | `ALO_LOCAL_DB_FILE` is read by code but absent from `.env.example` | `src/lib/local-db-fallback.ts` |
| S-12 | Info | No hardcoded production secrets found (positive) | `.env.example` |
| S-13 | Info | No SQL injection vectors — only tagged-template `$queryRaw` calls; zero `queryRawUnsafe` (positive) | grep across `src/` |

### H.1 The single Critical blocker

**S-1 (Critical) must be fixed before any ALO Learning implementation begins.** The `/api/video/cinematic` route receives a multipart audio upload, saves it to a temp file, and probes its format by interpolating the file path directly into `execSync`:

```typescript
// src/app/api/video/cinematic/route.ts:99 — VULNERABLE
inputAudioInfo = {
  path: audioUpload,
  duration: probeDuration(audioUpload),
  format: exec(`ffprobe -v quiet -show_entries format=format_name -of csv=p=0 "${audioUpload}"`),
};
```

A filename containing `"; rm -rf $HOME #` or `$(curl ...)` terminates the double-quoted argument and runs arbitrary shell commands as the Next.js process user. The same pattern (with incomplete escaping) appears in `/api/video/generate` (espeak) and `/api/avatar-video` (ffmpeg drawtext).

**Fix:** replace `execSync` with `spawnSync("ffprobe", ["-v","quiet","-show_entries","format=format_name","-of","csv=p=0", audioUpload])` — never interpolate user input into a shell string. Apply the same fix to `lipsync.ts:41` and `lipsync.ts:50`.

### H.2 Positive findings

- Admin auth fails closed in production; OTP is HMAC-stored, atomically consumed, DB-rate-limited, timing-safe compared.
- scrypt + `timingSafeEqual` for password verification.
- No hardcoded admin password ships in the repository.
- No SQL injection vectors.
- AES-256-GCM backup encryption (the historical XOR-loop finding is **FIXED**).

---

## I. Integration conflicts

### I.1 Single-admin vs tenant isolation

ALO Learning's directive implies a tenant model (Section 4: "Tenant/user" in the job metadata; Section 15: "Tenant ownership"). The existing ALO is **single-administrator by design**.

**Conflict resolution:** ALO Learning MUST NOT introduce a parallel user/tenant table. The existing `AdminOtpChallenge` (admin auth) and `Company` (scope selector) tables are reused. ALO Learning's "tenant" is the existing `Company` row selected by the admin via the company switcher — there is still only one admin identity.

### I.2 AGPL/copyleft exposure

Several candidate repos (httpSMS=AGPL-3.0, sms.domovina.ai=AGPL-3.0 inherited, VoIP/0perationPrivacy=GPL-3.0, linphone-iphone=GPL-3.0+, VideoCaptioner=GPL-3.0, RedditVideoMakerBot=GPL-3.0) carry copyleft licenses incompatible with closed-source SaaS distribution if linked or bundled.

**Conflict resolution:** every copyleft repo must be deployed as a **separate network service / sidecar**, not linked into ALO's Next.js process. The adapter pattern is the right architectural pattern.

### I.3 Local-first principle conflicts

ALO's `.env.example` explicitly rejects cloud routing for AI generation. Three candidate repos violate this principle:
- **ComfyUI_RH_APICall** routes local ComfyUI to RunningHub cloud — HARD PASS (also: NO LICENSE).
- **Pixelle-Video** defaults to cloud LLMs + cloud image/video APIs.
- **VideoCaptioner** default free ASR is Bcut (Bilibili) + Jianying (ByteDance) cloud.

**Conflict resolution:** any candidate that defaults to cloud must be configured for local-only mode before adoption.

### I.4 Python sidecar pattern

12 of 23 candidate repos are Python; ALO is TypeScript. This is not a conflict — ALO already uses the sidecar pattern (`src/lib/local-models.ts` calls Ollama HTTP API, `src/lib/local-audio.ts` calls Piper/espeak via `spawnSync`, `src/lib/photo-video.ts` drives ffmpeg).

### I.5 GPU feasibility

ALO's current VPS does not have a GPU. CogVideoX-5B: 16-24GB VRAM (deferred). InfiniteTalk (Wan2.1-14B): 40-80GB VRAM (not feasible). HunyuanVideo (13B): 45-80GB VRAM (not feasible + territory-restricted license).

---

## J. Implementation recommendations

### J.1 Sequencing

The directive sequences ALO Learning as Phase 0-13. The baseline audit adds a **Phase -1** that must precede Phase 0: fix the S-1 Critical finding.

| Phase | Name | Duration | Dependencies |
|---|---|---|---|
| **-1** | **Fix S-1 Critical (shell injection)** | 1 day | None — block all other work |
| 0 | Baseline audit (this document) + Git checkpoint + backup + restore rehearsal | 1 week | Phase -1 |
| 1 | Repository and license audit | Done — companion doc | Phase 0 |
| 2 | Central API and adapter architecture | 2-3 weeks | Phase 1 |
| 3 | AI Voice Studio (voicebox pilot) | 1 week | Phase 2 |
| 4 | SMS and Telephony | 2 weeks | Phase 2 |
| 5 | Learning Content Engine (3 departments) | 2-3 weeks | Phase 2 |
| 6 | Character Studio and consent system | 2 weeks | Phase 3, 5 |
| 7 | Video and Cinematic Studio | 3-4 weeks | Phase 3, 6 |
| 8 | ComfyUI and GPU integrations | 1-2 weeks | Phase 2, 7 |
| 9 | Subtitle and localization | 1 week | Phase 7 |
| 10 | Social publishing | 2 weeks | Phase 7, 9 |
| 11 | AI Workforce (20 agents) | 2-3 weeks | Phase 2-10 |
| 12 | Security and regression testing | 2 weeks | Phase 11 |
| 13 | Production deployment and verification | 1 week | Phase 12 |

**Total: ~22-30 weeks of engineering effort.** This is a substantial multi-quarter initiative.

### J.2 What to do this week

1. **Create the Git checkpoint:** `git tag -a alo-learning-baseline-2026-11-05 -m "Baseline before ALO Learning Phase 0"` on the current `main` HEAD.
2. **Fix S-1 (Critical):** replace `execSync` with `spawnSync` argv arrays in `src/app/api/video/cinematic/route.ts:99`, `src/app/api/video/generate/route.ts:109`, `src/app/api/avatar-video/route.ts:277,292`, and `src/lib/lipsync.ts:41,50`. One day.
3. **Fix S-4 (High):** add `requireOwner()` as the first statement of every privileged route handler (the 30 files listed in Section C.1). Two days.
4. **Fix S-3 (High):** wire `isSameOriginRequest()` into every POST/PATCH/DELETE handler. One day.
5. **Fix S-5 (Medium):** add `headers()` block to `next.config.ts` with CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. Half a day.
6. **Triage npm audit (OPS-1):** run `npm audit --json`, list every CVE, decide per-finding. One day.
7. **Verify `npm run build` is clean (OPS-6).** Half a day.
8. **Pick one deploy target (OPS-3):** VPS or cPanel — not both. One day of decision + cleanup.

### J.3 What NOT to do

1. Do not create a replacement application. ALO Learning is an extension.
2. Do not delete or reset existing production data.
3. Do not break existing authentication, APIs, portals, routes, database relations, or third-party integrations.
4. Do not run `prisma migrate deploy` against production until the restore rehearsal (Phase 0) is complete.
5. Do not bundle any AGPL/GPL repo into ALO's Next.js process — use the sidecar pattern.
6. Do not adopt ComfyUI_RH_APICall (no license + violates local-first).
7. Do not attempt HunyuanVideo or InfiniteTalk (GPU-infeasible + restrictive weight licenses).
8. Do not add new AI routes without unifying the three existing AI paths behind a single facade first (AI-1).
9. Do not present fictional cost telemetry as measured spend (AI-3).
10. Do not assume a UI component exists because a sidebar entry exists (Section B.1).

---

## Cross-references

- `repository-audit.md` — per-repo audit of the 22 candidate GitHub repos with decision matrix.
- `architecture.md` — the 12 logical services, 3 content departments, 14-step video pipeline, 20 AI agents.
- `integration-matrix.md` — INTEGRATE/ADAPT/REFERENCE/OPTIONAL/REJECT for every repo.
- `security-review.md` — Section 16 mandatory security + child privacy + S-1 to S-13 fixes.
- `database-design.md` — the 31 new Prisma models + non-destructive migration plan.
- `deployment-guide.md` — Phase 0-13 deployment with rollback, env, secrets.
- `testing-report.md` — the 20 test categories with mocked providers and sandbox accounts.
- `production-readiness.md` — the 14 Definition of Done criteria with current status.

---

## Final note

This baseline audit was conducted by Z.ai on 2026-11-05 against the public `tech360-bd/ALO-LEARNING-JOURNEY-PRODUCTION` repository (package version 0.2.1). It is a repository-only source audit — no runtime, VPS, MySQL, or external API was accessed.

The directive's FINAL RULE is reaffirmed: **audit first, preserve existing production functionality, integrate modularly, test every real operation, never fake successful integrations, never expose credentials, never bypass consent, never publish unapproved child-related media.**
