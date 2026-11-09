# ALO Learning — Deployment Guide

> **Document type:** Phased deployment plan with rollback and env reference (Phase 13 deliverable, drafted alongside Phase 2)
> **Date:** 2026-11-05
> **Author:** Z.ai
> **Companion documents:** `baseline-audit.md`, `repository-audit.md`, `architecture.md`, `integration-matrix.md`, `security-review.md`, `database-design.md`, `testing-report.md`, `production-readiness.md`.

---

## Purpose

This document satisfies **Section 19 (IMPLEMENTATION PHASES)** of the ALO Learning Master Engineering & Integration Directive. It specifies the 14 phases (Phase -1 through Phase 13), each with: implementation ticket, scope, dependencies, code changes, database changes, tests, evidence, acceptance criteria, rollback plan.

Plus: env var reference, secrets handling, deploy script, health check.

The directive's FINAL RULE applies: **audit first, preserve existing production functionality, integrate modularly, test every real operation.**

---

## 1. Phase -1 — Fix S-1 Critical (shell injection)

**Implementation ticket:** ALO-PHASE-MINUS-1
**Scope:** Replace `execSync`/`exec` with `spawnSync` argv arrays in the four vulnerable video routes and lipsync helper.
**Dependencies:** None — blocks all other work.
**Code changes:**
- `src/app/api/video/cinematic/route.ts:99` — replace `exec("ffprobe ... ${audioUpload}")` with `spawnSync("ffprobe", [...argv], {encoding: "utf-8"})`.
- `src/app/api/video/generate/route.ts:109` — replace `execSync("espeak \"${escapedText}\" ...")` with `spawnSync("espeak", [text, ...args])`.
- `src/app/api/avatar-video/route.ts:277,292` — replace ffmpeg drawtext inline text with `textfile=<temp-file>` argument.
- `src/lib/lipsync.ts:41,50` — replace `execSync("ffprobe ... ${filePath}")` with `spawnSync("ffprobe", [...argv])`.
**Database changes:** None.
**Tests:** Add `tests/shell-injection.test.mjs` — verifies that filenames containing shell metacharacters (`;`, `|`, `$()`, backticks) are passed as single argv elements and do not execute shell commands.
**Evidence:** Test passes; manual verification with `touch "/tmp/$(whoami).txt; rm -rf $HOME #.wav"` as input filename.
**Acceptance criteria:**
- `npm run build` clean.
- `npm test` passes including new shell-injection test.
- No `execSync` or `exec` calls remain in `src/` (enforced by ESLint rule).
**Rollback plan:** Revert the four file changes via `git revert`. The old `execSync` code is restored; S-1 vulnerability returns — only roll back if the new code is broken in a way that blocks all video routes.
**Duration:** 1 day.

---

## 2. Phase 0 — Baseline audit, Git checkpoint, backup, restore rehearsal

**Implementation ticket:** ALO-PHASE-0
**Scope:** Create the baseline audit (companion doc `baseline-audit.md`); create Git checkpoint; take full backup; perform restore rehearsal.
**Dependencies:** Phase -1 complete.
**Code changes:** None.
**Database changes:** None.
**Tests:** `tests/backup-restore.test.mjs` — verifies that a `mysqldump` backup can be restored to a disposable MySQL instance and key tables match.
**Evidence:**
- `baseline-audit.md` committed to `docs/alo-learning/`.
- Git tag `alo-learning-baseline-2026-11-05` created (annotated, signed).
- Backup file `backup-2026-11-05.sql.gz` created and stored offsite.
- Restore rehearsal log showing all 42 existing tables restored with correct row counts.
**Acceptance criteria:**
- `git tag -l alo-learning-baseline-2026-11-05` returns the tag.
- Backup file exists and is ≥ X MB (where X is the current DB size).
- Restore rehearsal: `mysql -u root db_learn_test < backup.sql` succeeds; `SELECT COUNT(*)` matches for 5 sample tables (Company, Lead, AdminOtpChallenge, AuditLog, AIAgentRun).
**Rollback plan:** N/A — Phase 0 is non-destructive.
**Duration:** 1 week.

---

## 3. Phase 1 — Repository and license audit

**Implementation ticket:** ALO-PHASE-1
**Scope:** Audit all 23 candidate repos; produce `repository-audit.md` and `integration-matrix.md`.
**Dependencies:** Phase 0 complete.
**Code changes:** None.
**Database changes:** None.
**Tests:** None.
**Evidence:** `repository-audit.md` and `integration-matrix.md` committed.
**Acceptance criteria:** Both docs reviewed and approved by tech360-bd engineering.
**Rollback plan:** N/A.
**Duration:** Done — companion docs.

---

## 4. Phase 2 — Central API and adapter architecture

**Implementation ticket:** ALO-PHASE-2
**Scope:** Build the 12-service skeleton, async job runner (BullMQ + Redis), adapter base class, the Safety & Approval Engine MVP.
**Dependencies:** Phase 1 complete.
**Code changes:**
- `src/lib/alo-learning/auth.ts` — `requireOwner()` helper.
- `src/lib/alo-learning/csrf.ts` — `csrfCheck()` helper.
- `src/lib/alo-learning/tenant.ts` — `tenantScope()` helper.
- `src/lib/alo-learning/upload.ts` — `validateUpload()` with MIME + magic bytes.
- `src/lib/alo-learning/storage.ts` — AES-256-GCM encryption helpers.
- `src/lib/alo-learning/rate-limit.ts` — Redis-backed limiter.
- `src/lib/alo-learning/ssrf.ts` — `safeFetch()` helper.
- `src/lib/alo-learning/queue.ts` — BullMQ queue + worker setup.
- `src/lib/alo-learning/adapters/base.ts` — `BaseAdapter` abstract class.
- `src/lib/alo-learning/services/index.ts` — service registry.
- `src/app/api/alo-learning/health/route.ts` — health endpoint covering all 12 services.
- UI: Overview, Safety & Approvals, System Settings views (3 of 21 navigation entries).
**Database changes:** Migration `20261106000001_alo_learning_enums` (enums) + `20261106000002_alo_learning_audit_log_extension` (AuditLog + AIAgentRun extensions) + `20261113000000_alo_learning_phase_2_jobs_approvals` (MediaGenerationJob, MediaApproval, MediaAuditLog).
**Tests:**
- `tests/alo-learning/auth.test.mjs` — every `/api/alo-learning/*` route returns 401 without session.
- `tests/alo-learning/csrf.test.mjs` — cross-origin POST returns 403.
- `tests/alo-learning/upload.test.mjs` — MIME mismatch rejected.
- `tests/alo-learning/queue.test.mjs` — BullMQ job lifecycle (queued → running → succeeded).
**Evidence:** All tests pass; health endpoint returns 12 services with `status: "disconnected"` (no engines wired yet).
**Acceptance criteria:**
- `npm run build` clean.
- `npm test` passes all new tests.
- `/api/alo-learning/health` returns JSON listing all 12 services.
- UI shows Overview, Safety & Approvals, System Settings tabs.
**Rollback plan:** Revert migrations via Section 4.4 of `database-design.md`. Drop ALO Learning tables; existing ALO unaffected.
**Duration:** 2-3 weeks.

---

## 5. Phase 3 — AI Voice Studio (voicebox pilot)

**Implementation ticket:** ALO-PHASE-3
**Scope:** Deploy voicebox FastAPI backend as sidecar; build AI Voice Engine; preserve Piper/espeak fallback chain.
**Dependencies:** Phase 2 complete.
**Code changes:**
- `src/lib/alo-learning/adapters/voice/voicebox.ts` — adapter (per `integration-matrix.md` Section 2.1).
- `src/lib/alo-learning/services/voice/engines/voicebox.ts`, `piper.ts`, `espeak.ts`, `formant.ts`.
- `src/lib/alo-learning/services/voice/voice-profiles.ts`, `consent.ts`.
- `src/lib/local-audio.ts` — updated to try voicebox first when `ALO_VOICEBOX_ENABLED=true`.
- API routes: `/api/alo-learning/voice/{generate,transcribe,profiles,profiles/[id]/clone,profiles/[id] (DELETE),history}`.
- UI: Voice Studio view.
**Database changes:** Migration `20261120000000_alo_learning_phase_3_voice` (VoiceProfile, VoiceConsent, VoiceGeneration, LearningAsset).
**Tests:**
- `tests/alo-learning/voice-generate.test.mjs` — synthesize speech with engine: kokoro; verify MP3 output.
- `tests/alo-learning/voice-fallback.test.mjs` — when voicebox is down, Piper/espeak/formant chain succeeds.
- `tests/alo-learning/voice-consent.test.mjs` — clone without consent returns 403; with consent succeeds; revoke deletes profile.
**Evidence:** Sample synthesized Bangla and English MP3s; consent workflow demo recording.
**Acceptance criteria:**
- Voicebox adapter health check returns "connected" when running.
- A POST to `/api/alo-learning/voice/generate` with `engine: kokoro` returns a synthesized MP3 within 5 seconds on CPU.
- If voicebox is down, the existing Piper/espeak/formant chain is used and the request still succeeds.
- Voice clone without consent returns 403.
**Rollback plan:** Set `ALO_VOICEBOX_ENABLED=false`; voicebox sidecar stopped; Piper/espeak chain restored as primary. Migration rollback per Section 4.4.
**Duration:** 1 week.

---

## 6. Phase 4 — SMS and Telephony

**Implementation ticket:** ALO-PHASE-4
**Scope:** Build SMS Gateway Engine (provider-independent adapter); preserve httpSMS hosted SaaS; add optional sms.domovina.ai Reverse OTP sidecar. Build Telephony Engine skeleton (SIP config, call history, AI assistant stub).
**Dependencies:** Phase 2 complete.
**Code changes:**
- `src/lib/alo-learning/adapters/sms/httpsms.ts` (existing SDK wrapped).
- `src/lib/alo-learning/adapters/sms/domovina.ts`, `httpsms-self-hosted.ts` (optional sidecars).
- `src/lib/alo-learning/services/sms/providers/index.ts` — provider registry.
- `src/lib/alo-learning/services/sms/webhooks.ts` — JWT signature verification.
- `src/lib/alo-learning/services/telephony/sip/account.ts`, `calls/{incoming,outgoing,transfer}.ts`, `ai-assistant.ts`, `transcripts.ts`.
- API routes: `/api/alo-learning/sms/{send,messages,webhooks/[provider],providers,opt-out}`, `/api/alo-learning/telephony/{sip/accounts,calls,calls/[id]/transfer,calls/[id]/transcript,calls/[id]/summarize}`.
- UI: SMS Center, Telephony Center views.
**Database changes:** Migration `20261127000000_alo_learning_phase_4_communication` (CommunicationProvider, SMSMessage, SMSDelivery, TelephonyAccount, CallRecord, CallTranscript).
**Tests:**
- `tests/alo-learning/sms-send.test.mjs` — send SMS via httpSMS hosted; verify message persisted.
- `tests/alo-learning/sms-webhook.test.mjs` — inbound webhook with valid JWT signature accepted; invalid signature rejected.
- `tests/alo-learning/telephony-call.test.mjs` — call record CRUD; transcript retrieval.
**Evidence:** Sandbox SMS send/receive demo; call record screenshot.
**Acceptance criteria:**
- SMS send via httpSMS hosted succeeds; message persisted with delivery status.
- Inbound webhook with valid JWT signature accepted; invalid signature returns 401.
- Telephony call record CRUD works; transcript retrieval works.
- **Never expose OTPs in logs** — verified by grep.
**Rollback plan:** Set `ALO_DOMOVINA_ENABLED=false`, `ALO_HTTPSMS_SELF_HOSTED=false`; existing httpSMS hosted flow remains. Migration rollback per Section 4.4.
**Duration:** 2 weeks.

---

## 7. Phase 5 — Learning Content Engine

**Implementation ticket:** ALO-PHASE-5
**Scope:** Build Learning Intelligence Engine with 3 content departments (ALO Kids, ALO Parenting, ALO Teacher Academy); implement content project lifecycle (12 mandatory fields); integrate with existing Content Studio (preserve existing functionality).
**Dependencies:** Phase 2 complete.
**Code changes:**
- `src/lib/alo-learning/services/learning/departments/{kids,parenting,teacher}.ts` — topic taxonomies.
- `src/lib/alo-learning/services/learning/research.ts`, `outcome.ts`.
- API routes: `/api/alo-learning/content/{projects,projects/[id],projects/[id]/research,projects/[id]/script,projects/[id]/fact-check,projects/[id]/approve}`.
- UI: Learning Content, ALO Kids, ALO Parenting, Teacher Academy, AI Research, AI Script Studio views (6 of 21 navigation entries).
**Database changes:** Migration `20261204000000_alo_learning_phase_5_content` (LearningContent, LearningTopic, LearningResearchSource, LearningScript, LearningStoryboard, LearningScene, LearningProject, ContentSafetyReview).
**Tests:**
- `tests/alo-learning/content-project.test.mjs` — create project; verify 12 mandatory fields.
- `tests/alo-learning/fact-check.test.mjs` — medical claim triggers `requiresExpertReview: true`.
**Evidence:** Sample content project for each of the 3 departments.
**Acceptance criteria:**
- Content project can be created with all 12 mandatory fields.
- Research, script, fact-check jobs queue and complete.
- Medical/developmental claims trigger expert review flag.
- Existing Content Studio functionality unchanged (regression test).
**Rollback plan:** Migration rollback per Section 4.4.
**Duration:** 2-3 weeks.

---

## 8. Phase 6 — Character Studio and consent system

**Implementation ticket:** ALO-PHASE-6
**Scope:** Build AI Character Engine; implement consent workflow (VoiceConsent, CharacterConsent); child-safety controls.
**Dependencies:** Phase 3 (voice), Phase 5 (content) complete.
**Code changes:**
- `src/lib/alo-learning/services/character/profiles.ts`, `consent.ts`, `minors.ts`.
- API routes: `/api/alo-learning/characters`, `/api/alo-learning/characters/[id]/{consent,generate}`.
- UI: Character Studio view.
**Database changes:** Migration `20261211000000_alo_learning_phase_6_character` (LearningCharacter, CharacterConsent).
**Tests:**
- `tests/alo-learning/character-consent.test.mjs` — create character without consent returns 403; with consent succeeds; revoke deletes derived assets.
- `tests/alo-learning/child-safety.test.mjs` — minor-related character triggers `awaiting_approval`; face-blur default applied.
**Evidence:** Sample character profiles for each of the 6 character types; consent revocation demo.
**Acceptance criteria:**
- Character profile can be created for each of the 6 types.
- Consent workflow: create → approve → use → revoke → derived assets marked revoked.
- Minor-related characters trigger mandatory approval and face-blur default.
- **Never use a child's identity to imply that the child actually said or did something they did not.** — verified by Content Safety Agent.
**Rollback plan:** Migration rollback per Section 4.4.
**Duration:** 2 weeks.

---

## 9. Phase 7 — Video and Cinematic Studio

**Implementation ticket:** ALO-PHASE-7
**Scope:** Build Video Generation Engine with 10 video modes and 14-step production pipeline; build Cinematic Editing Engine; integrate Pixelle-Video template patterns; optional Remotion sidecar.
**Dependencies:** Phase 3 (voice), Phase 6 (character) complete.
**Code changes:**
- `src/lib/alo-learning/services/video/modes/{explainer,documentary,3d_animated,ai_presenter,talking_character,parent_education,teacher_training,short_form,long_form_youtube,animated_infographics}.ts`.
- `src/lib/alo-learning/services/video/pipeline.ts` — 14-step orchestrator.
- `src/lib/alo-learning/services/video/templates/` — 10 HTML/CSS templates (ported from Pixelle-Video patterns).
- `src/lib/alo-learning/services/cinematic/{editor,audio-mix,color,subtitles/burn,subtitles/sidecar}.ts`.
- `src/lib/alo-learning/adapters/video/remotion.ts` (optional).
- `src/lib/alo-learning/adapters/youtube/ytdlp.ts`.
- API routes: `/api/alo-learning/video/{projects,projects/[id]/pipeline/[step],projects/[id]/render,projects/[id]/outputs,projects/[id]/edit,projects/[id]/audio-mix,projects/[id]/subtitles/burn,projects/[id]/subtitles/export}`, `/api/alo-learning/youtube/import`.
- UI: Cinematic Studio, 3D Animation (stub), Video Editor views.
**Database changes:** Migration `20261218000000_alo_learning_phase_7_video` (VideoRender, SubtitleTrack, MediaUsageRecord).
**Tests:**
- `tests/alo-learning/video-pipeline.test.mjs` — 14-step pipeline executes; each step produces expected output.
- `tests/alo-learning/video-render.test.mjs` — render produces MP4 with H.264 + AAC; subtitle burn renders HindSiliguri font.
- `tests/alo-learning/youtube-import.test.mjs` — CC-licensed URL imports; non-CC rejected.
**Evidence:** Sample 30-second educational video in each of the 10 modes.
**Acceptance criteria:**
- All 10 video modes produce a valid MP4.
- 14-step pipeline executes end-to-end with approval gates at steps 4, 6, 8, 13, 14, and publishing.
- Burned subtitles render HindSiliguri font correctly for Bangla.
- YouTube import honors CC-licensed content only.
**Rollback plan:** Migration rollback per Section 4.4. Remotion sidecar: set `ALO_REMOTION_ENABLED=false`.
**Duration:** 3-4 weeks.

---

## 10. Phase 8 — ComfyUI and GPU integrations

**Implementation ticket:** ALO-PHASE-8
**Scope:** Build Creative Workflow Engine (local ComfyUI primary, optional RunningHub adapter); optional CogVideo sidecar (deferred).
**Dependencies:** Phase 2 (queue), Phase 7 (video) complete.
**Code changes:**
- `src/lib/alo-learning/adapters/comfyui/local.ts` — adapter for local ComfyUI (`http://127.0.0.1:8188`).
- `src/lib/alo-learning/adapters/comfyui/runninghub.ts` — optional cloud adapter (gated by paid-AI switches + `ALO_RUNNINGHUB_ENABLED`).
- `src/lib/alo-learning/services/workflow/{workflow-registry,node-config}.ts`.
- API routes: `/api/alo-learning/workflows`, `/api/alo-learning/workflows/[id]/{execute,executions/[execId],executions/[execId]/retry}`.
- UI: Workflow Manager view.
**Database changes:** Migration `20261225000000_alo_learning_phase_8_workflow` (WorkflowExecution).
**Tests:**
- `tests/alo-learning/comfyui-local.test.mjs` — execute a workflow against local ComfyUI; verify output image.
- `tests/alo-learning/comfyui-fallback.test.mjs` — when local ComfyUI is down, RunningHub adapter is NOT auto-enabled (requires explicit `ALO_RUNNINGHUB_ENABLED=true`).
**Evidence:** Sample ComfyUI workflow execution producing an image.
**Acceptance criteria:**
- Local ComfyUI workflow executes and produces output.
- RunningHub cloud adapter is gated and never auto-enabled.
- **Do not hardcode provider credentials** — verified by grep (no API keys in source).
**Rollback plan:** Set `ALO_RUNNINGHUB_ENABLED=false`; local ComfyUI preserved. Migration rollback per Section 4.4.
**Duration:** 1-2 weeks.

---

## 11. Phase 9 — Subtitle and localization

**Implementation ticket:** ALO-PHASE-9
**Scope:** Integrate VideoCaptioner as sidecar (Whisper-local mode only); add multi-language SRT/VTT; subtitle quality checks.
**Dependencies:** Phase 7 (video) complete.
**Code changes:**
- `src/lib/alo-learning/adapters/subtitles/videocaptioner.ts` (per `integration-matrix.md` Section 2.4).
- `src/lib/alo-learning/services/cinematic/subtitles/{translate,quality-check}.ts`.
- API routes: `/api/alo-learning/subtitles/{transcribe,translate,burn}`.
- UI: Subtitle & Translation view.
**Database changes:** None (SubtitleTrack added in Phase 7).
**Tests:**
- `tests/alo-learning/subtitle-transcribe.test.mjs` — 5-minute Bangla video transcribed within 10 minutes on CPU.
- `tests/alo-learning/subtitle-quality.test.mjs` — SRT validates; spelling/timestamps/completeness checks pass.
**Evidence:** Sample SRT/VTT exports in Bangla and English.
**Acceptance criteria:**
- Whisper-local engine used (never Bcut/Jianying cloud).
- SRT and VTT exports valid.
- Burned subtitles render HindSiliguri font correctly.
- Quality checks: spelling, timestamps, no missing sentences, readable text, proper font rendering, correct language selection.
**Rollback plan:** Set `ALO_VIDEOCAPTIONER_ENABLED=false`; existing ffmpeg drawtext burned captions preserved. Migration rollback not needed.
**Duration:** 1 week.

---

## 12. Phase 10 — Social publishing

**Implementation ticket:** ALO-PHASE-10
**Scope:** Build Social Publishing Engine; OAuth flow for Facebook, YouTube, TikTok; human approval default; auto-publish allowlist.
**Dependencies:** Phase 7 (video), Phase 9 (subtitles) complete.
**Code changes:**
- `src/lib/alo-learning/adapters/social/{facebook,youtube,tiktok}.ts`.
- `src/lib/alo-learning/services/social/{format-adapt,oauth}.ts`.
- API routes: `/api/alo-learning/publishing/{accounts,jobs,jobs/[id]/approve,jobs/[id]/publish,records}`.
- UI: Social Publishing view.
**Database changes:** Migration `20270101000000_alo_learning_phase_10_publishing` (PublishingAccount, PublishingJob, PublishingRecord).
**Tests:**
- `tests/alo-learning/publishing-oauth.test.mjs` — OAuth flow against sandbox accounts.
- `tests/alo-learning/publishing-approval.test.mjs` — publishing without approval returns 403.
- `tests/alo-learning/publishing-error.test.mjs` — failed publishes retried per BullMQ policy; permanent failures logged.
**Evidence:** Sandbox publishing demo (NEVER publish test content to real social accounts).
**Acceptance criteria:**
- OAuth flow connects platform accounts via official APIs.
- Every publishing job requires admin approval (default mode).
- Auto-publish only for allowlisted categories and authorized accounts.
- Failed publishes retried; permanent failures logged with `errorDetails`.
- **Never bypass platform restrictions** — official APIs only.
**Rollback plan:** Set platform env vars to disable; migration rollback per Section 4.4.
**Duration:** 2 weeks.

---

## 13. Phase 11 — AI Workforce

**Implementation ticket:** ALO-PHASE-11
**Scope:** Register 20 specialized agents; integrate claude-video /watch skill; optional CLI-Anything pilot.
**Dependencies:** Phases 2-10 complete.
**Code changes:**
- `src/lib/alo-learning/agents/registry.ts` — 20 agents with responsibility, tools, permissions.
- `src/lib/alo-learning/agents/skills/watch.ts` — claude-video skill (per `integration-matrix.md` Section 2.8).
- `src/lib/alo-learning/adapters/agentos/cli-anything.ts` — optional (per `integration-matrix.md` Section 2.9).
- API routes: `/api/alo-learning/agents`, `/api/alo-learning/agents/[id]/{run,runs}`.
- UI: AI Workforce, Analytics views.
**Database changes:** Migration `20270108000000_alo_learning_phase_11_agents` (AgentExecution).
**Tests:**
- `tests/alo-learning/agent-run.test.mjs` — agent executes; output persisted.
- `tests/alo-learning/watch-skill.test.mjs` — recording starts/stops; MP4 saved.
- `tests/alo-learning/cli-anything.test.mjs` — pilot skill (audacity) executes; JSON output parsed.
**Evidence:** Sample agent run recordings; CLI-Anything pilot demo.
**Acceptance criteria:**
- All 20 agents registered; each has defined responsibility, allowed tools, permission boundaries.
- Watch skill produces MP4; retention policy enforced.
- CLI-Anything pilot (if enabled): audacity skill executes.
- Agents must not independently access unrestricted production credentials — verified.
**Rollback plan:** Set `ALO_WATCH_SKILL_ENABLED=false`, `ALO_CLI_ANYTHING_ENABLED=false`. Migration rollback per Section 4.4.
**Duration:** 2-3 weeks.

---

## 14. Phase 12 — Security and regression testing

**Implementation ticket:** ALO-PHASE-12
**Scope:** Run all 20 test categories from `testing-report.md`; security regression suite; existing ALO regression tests.
**Dependencies:** Phase 11 complete.
**Code changes:**
- `tests/alo-learning/security-regression.test.mjs` — full security regression.
- `tests/alo-learning/existing-alo-regression.test.mjs` — verify all 81 existing routes still work.
**Database changes:** None.
**Tests:** All 20 categories from `testing-report.md`.
**Evidence:** Test report; security scan results; regression test pass.
**Acceptance criteria:**
- All 20 test categories pass.
- Existing ALO functionality unchanged (81 routes, 42 models, ~50 views all work).
- Security regression: S-1 to S-13 all fixed (verified by tests).
- `npm audit` triaged; high findings resolved or documented.
- ESLint strict rules re-enabled; `npm run lint` passes.
- `npm run build` clean.
**Rollback plan:** N/A — testing phase.
**Duration:** 2 weeks.

---

## 15. Phase 13 — Production deployment and verification

**Implementation ticket:** ALO-PHASE-13
**Scope:** Deploy ALO Learning to production; verify all 14 Definition of Done criteria from `production-readiness.md`.
**Dependencies:** Phase 12 complete.
**Code changes:** None.
**Database changes:** All ALO Learning migrations applied to production via `prisma migrate deploy`.
**Tests:** Smoke tests in production (read-only); health check.
**Evidence:** Production health check; sample ALO Learning operations (voice generate, video render, SMS send) succeed in production.
**Acceptance criteria:** All 14 Definition of Done criteria from `production-readiness.md` pass.
**Rollback plan:**
1. Set all `ALO_*_ENABLED=false` env vars.
2. Run rollback SQL per `database-design.md` Section 4.4 to drop ALO Learning tables.
3. Restart ALO Next.js process.
4. Existing ALO functionality preserved.
**Duration:** 1 week.

---

## 16. Environment variables reference

All env vars used by ALO Learning. Add to `.env.example` (production values in `.env`, never committed).

### Existing (preserved from baseline)
```
DATABASE_URL="mysql://..."
NEXTAUTH_SECRET="..."
ADMIN_EMAIL="..."
ADMIN_PASSWORD_HASH="scrypt$..."
ADMIN_OTP_PHONE="+8801XXXXXXXXX"
HTTPSMS_API_KEY=
HTTPSMS_FROM="+8801XXXXXXXXX"
ALO_PAID_AI_API_ALLOWED=false
ALO_OWNER_APPROVED_PAID_AI_API=false
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:7b
COMFYUI_BASE_URL=http://127.0.0.1:8188
UPLOAD_DIR=./storage/uploads
VIDEO_DIR=./storage/videos
BACKUP_ENCRYPTION_KEY=
PORT=3017
NODE_ENV=production
```

### ALO Learning additions (Phase 2 — central infrastructure)
```
# Redis for BullMQ queue + rate limit
REDIS_URL=redis://127.0.0.1:6379

# ALO Learning feature flags (all default false)
ALO_LEARNING_ENABLED=false
```

### Phase 3 — Voice Engine
```
ALO_VOICEBOX_ENABLED=false
ALO_VOICEBOX_BASE_URL=http://127.0.0.1:8000
ALO_VOICEBOX_DEFAULT_ENGINE=kokoro
ALO_VOICEBOX_DEFAULT_LANGUAGE=bn
```

### Phase 4 — SMS & Telephony
```
ALO_DOMOVINA_ENABLED=false
ALO_DOMOVINA_BASE_URL=http://127.0.0.1:8090
ALO_HTTPSMS_SELF_HOSTED=false
ALO_HTTPSMS_SELF_HOSTED_BASE_URL=http://127.0.0.1:8091
# Telephony
ALO_TELEPHONY_ENABLED=false
```

### Phase 7 — Video
```
ALO_YTDLP_ENABLED=false
ALO_YTDLP_BIN=yt-dlp
ALO_YTDLP_DEFAULT_LICENSE_FILTER=creative_common
ALO_REMOTION_ENABLED=false
ALO_REMOTION_LICENSE_TYPE=individual
ALO_REMOTION_BASE_URL=http://127.0.0.1:8093
```

### Phase 8 — ComfyUI / RunningHub
```
ALO_RUNNINGHUB_ENABLED=false
ALO_RUNNINGHUB_API_KEY=
ALO_COGVIDEO_ENABLED=false
ALO_COGVIDEO_BASE_URL=http://<gpu-box-ip>:8094
ALO_COGVIDEO_MODEL=cogvideox-5b
```

### Phase 9 — Subtitles
```
ALO_VIDEOCAPTIONER_ENABLED=false
ALO_VIDEOCAPTIONER_BASE_URL=http://127.0.0.1:8092
ALO_VIDEOCAPTIONER_DEFAULT_ENGINE=whisper-local
ALO_VIDEOCAPTIONER_DEFAULT_LANGUAGE=bn
```

### Phase 10 — Social publishing
```
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
```

### Phase 11 — AI Workforce
```
ALO_WATCH_SKILL_ENABLED=false
ALO_WATCH_OUTPUT_DIR=./storage/agent-recordings
ALO_WATCH_RETENTION_DAYS=30
ALO_CLI_ANYTHING_ENABLED=false
ALO_CLI_ANYTHING_BIN=cli-hub
ALO_CLI_ANYTHING_INSTALLED_SKILLS=audacity,blender
```

### Security
```
# ClamAV for malware scanning (optional)
ALO_CLAMAV_ENABLED=false
ALO_CLAMAV_SOCKET=/var/run/clamav/clamd.ctl
```

---

## 17. Secrets handling

1. **Never commit secrets.** `.env` is in `.gitignore` (verified).
2. **All secrets in env vars.** Adapters read `process.env.<SERVICE>_API_KEY` at call time.
3. **Encrypted at rest.** `BACKUP_ENCRYPTION_KEY` encrypts media assets, OAuth tokens, SIP passwords.
4. **Annual rotation.** `BACKUP_ENCRYPTION_KEY` rotated annually; rotation process documented in `security-review.md` Section 1.7.
5. **OAuth token refresh.** `PublishingAccount.refreshToken` used to refresh access tokens automatically before expiry.
6. **No secrets in logs.** `AuditLog` stores input/output hashes (SHA-256), not the actual content.
7. **No OTPs in logs.** Existing httpSMS flow HMAC-stores OTPs; reaffirmed for all new OTP paths.
8. **Secrets scanning CI.** Add gitleaks/trufflehog to CI to catch accidental commits.

---

## 18. Deploy script

```bash
#!/bin/bash
# scripts/alo-learning-deploy.sh
set -euo pipefail

echo "=== ALO Learning Deploy ==="

# 1. Verify preflight
node scripts/alo-learning-preflight.mjs

# 2. Verify migrations
node scripts/verify-migrations.mjs

# 3. Build
npm run build

# 4. Apply migrations (additive only)
prisma migrate deploy

# 5. Restart ALO Next.js process
pm2 restart learn-aloeducation --update-env

# 6. Restart sidecars (if enabled)
[ "$ALO_VOICEBOX_ENABLED" = "true" ] && docker-compose -f sidecars/voicebox/docker-compose.yml up -d
[ "$ALO_DOMOVINA_ENABLED" = "true" ] && cd sidecars/domovina && bun run webhook/src/app.ts &
# ... etc.

# 7. Health check
sleep 5
curl -s http://127.0.0.1:3017/api/alo-learning/health | jq .

echo "=== Deploy complete ==="
```

---

## 19. Health check

`GET /api/alo-learning/health` returns:

```json
{
  "services": {
    "learning_intelligence": {"status": "connected", "version": "1.0.0"},
    "ai_voice": {"status": "connected", "version": "voicebox-1.2.0", "enginesLoaded": ["kokoro", "piper"]},
    "sms_gateway": {"status": "connected", "version": "httpsms-1.5.0"},
    "telephony": {"status": "disconnected", "version": null},
    "ai_character": {"status": "connected", "version": "1.0.0"},
    "video_generation": {"status": "connected", "version": "ffmpeg-6.0"},
    "cinematic_editing": {"status": "connected", "version": "1.0.0"},
    "three_d_animation": {"status": "disconnected", "version": null},
    "creative_workflow": {"status": "connected", "version": "comfyui-0.3.0"},
    "social_publishing": {"status": "connected", "version": "1.0.0"},
    "learning_analytics": {"status": "connected", "version": "1.0.0"},
    "safety_approval": {"status": "connected", "version": "1.0.0"}
  },
  "queue": {"status": "connected", "pendingJobs": 3},
  "redis": {"status": "connected", "version": "7.0.0"},
  "timestamp": "2026-11-05T12:00:00.000Z"
}
```

Every engine displays: Connected/Disconnected, Health status, Version, Configuration, Resource availability, Last successful execution, Last error, Usage.

---

## Cross-references

- `baseline-audit.md` Section F — existing deploy topology (VPS vs cPanel).
- `repository-audit.md` — per-repo deployment considerations.
- `architecture.md` — the 12 services deployed.
- `integration-matrix.md` Section 6 — sidecar deployment inventory.
- `security-review.md` — secrets handling, env var management.
- `database-design.md` Section 4 — migration plan, preflight, rollback.
- `testing-report.md` — test gates per phase.
- `production-readiness.md` — Definition of Done.

---

## Final note

This deployment guide sequences ALO Learning as 14 phases (Phase -1 through Phase 13). Each phase has: implementation ticket, scope, dependencies, code changes, database changes, tests, evidence, acceptance criteria, rollback plan. The total duration is ~22-30 weeks of engineering effort.

The directive's FINAL RULE is reaffirmed: **audit first, preserve existing production functionality, integrate modularly, test every real operation, never fake successful integrations, never expose credentials, never bypass consent, never publish unapproved child-related media.**
