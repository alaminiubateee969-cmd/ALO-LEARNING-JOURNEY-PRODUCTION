# ALO Learning — Central Architecture

> **Document type:** Central architecture design (Phase 2 deliverable)
> **Design date:** 2026-11-05
> **Author:** Z.ai
> **Companion documents:** `baseline-audit.md`, `repository-audit.md`, `integration-matrix.md`, `security-review.md`, `database-design.md`, `deployment-guide.md`, `testing-report.md`, `production-readiness.md`.

---

## Purpose

This document satisfies **Sections 4, 5, 10, and 14** of the ALO Learning Master Engineering & Integration Directive. It specifies:

- The 12 logical services (Section 4).
- The 3 content departments and their topic taxonomies (Section 5).
- The 14-step video production pipeline (Section 10).
- The 20 specialized AI agents with their responsibilities, tools, permissions, and boundaries (Section 14).

The architecture extends the existing ALO platform — it does **not** replace it. Every design choice respects the constraints established in `baseline-audit.md`: single-admin model, local-first AI, Prisma MySQL schema (additive-only), Next.js 16 + React 19 + TypeScript runtime, existing 81 API routes preserved with new routes added under `/api/alo-learning/*`.

---

## 1. Architectural principles

### 1.1 Extension, not replacement

ALO Learning is a module inside the existing ALO Education platform. New ALO Learning code lives under:
- `src/app/api/alo-learning/*` — new API routes
- `src/components/alo-learning/*` — new UI views
- `src/lib/alo-learning/*` — new library modules
- `prisma/migrations/<timestamp>_alo_learning_*` — additive migrations only

### 1.2 Local-first

ALO's existing design principle is reaffirmed: AI generation is local-first. Hosted engines (Sora, Veo, Kling, Runway, HeyGen, ElevenLabs, RunningHub cloud) are rejected at the API boundary. The three existing AI paths (external-ai allowlist, local-models, z-ai-web-dev-sdk) are unified behind a single facade before any new AI capability is added.

### 1.3 Async job pattern for long-running tasks

Every long-running operation (video render, voice generation, social publish, agent run, SMS campaign) is modeled as an async job:

```typescript
interface AloLearningJob {
  jobId: string;              // UUID, primary identifier
  requester: string;          // admin email (single-admin model)
  tenant: string;             // Company.id from x-alo-company-id header
  inputAssets: string[];      // signed media URLs or storage paths
  selectedEngine: string;     // service name (e.g., "voice_engine")
  modelProvider: string;      // e.g., "voicebox:kokoro" or "local:ollama:qwen2.5"
  status: JobStatus;          // queued | running | succeeded | failed | cancelled | awaiting_approval
  progress: number;           // 0-100
  outputFiles: string[];      // signed media URLs
  executionTimeMs: number;
  resourceUsage: ResourceUsage;  // cpuMs, memoryMb, vramMb, estimatedCostUsd
  errorDetails?: JobError;
  approvalStatus: ApprovalStatus;  // required | approved | rejected | not_required
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
}
```

Jobs are persisted to the `MediaGenerationJob` Prisma model and processed by a Redis-backed queue worker (BullMQ). The existing synchronous request-response pattern is preserved for short operations; only operations expected to exceed 2 seconds are queued.

### 1.4 Adapter pattern for external services

Every external integration is wrapped in an adapter under `src/lib/alo-learning/adapters/<service>.ts`. The adapter: (1) translates ALO's internal API to the external service's API; (2) handles authentication (env-var based, never hardcoded); (3) implements retries, timeouts, and circuit breakers; (4) logs every call to the existing `AuditLog` model; (5) falls back gracefully (local-first principle). Adapters are the only place external credentials are referenced.

### 1.5 Human approval as a first-class step

The directive mandates human approval for: child-related media, social publishing, content with medical/developmental claims, and any agent action that crosses a permission boundary. Approval is modeled as a queue (`MediaApproval` Prisma model) with a dedicated UI tab (`Safety & Approvals`). Jobs in `awaiting_approval` status may not produce output or publish.

---

## 2. The 12 logical services

### A. Learning Intelligence Engine

**Purpose:** Orchestrates the 3 content departments. Manages content project lifecycle from topic → research → script → storyboard → approval.

**Internal modules:**
- `departments/kids.ts` — ALO Kids topic taxonomy (early childhood development, language development, cognitive development, emotional development, social skills, creativity, learning through play, age-appropriate educational activities, early childhood learning methods).
- `departments/parenting.ts` — ALO Parenting taxonomy (positive parenting, parent-child communication, child emotional support, parenting skills, family learning, child behavior education, digital parenting, parent education).
- `departments/teacher.ts` — ALO Teacher Academy taxonomy (early childhood education, teaching methodologies, classroom management, inclusive learning, educational psychology, teacher professional development, parent-teacher collaboration).
- `research.ts` — Source aggregation, citation tracking, fact-check queue.
- `outcome.ts` — Learning outcome definition and quiz/activity generation.

**Public API surface:**
- `POST /api/alo-learning/content/projects` — create a new content project
- `GET /api/alo-learning/content/projects` — list projects (filter by department, status)
- `GET /api/alo-learning/content/projects/[id]` — get project with all 12 mandatory fields
- `POST /api/alo-learning/content/projects/[id]/research` — queue research job
- `POST /api/alo-learning/content/projects/[id]/script` — queue script generation
- `POST /api/alo-learning/content/projects/[id]/fact-check` — queue fact verification
- `POST /api/alo-learning/content/projects/[id]/approve` — submit for human approval

**Dependencies:** AI Voice Engine (for narration script → voice), Video Generation Engine (for script → video), Safety & Approval Engine (for all approvals).

**Mandatory content project fields (per Section 5):** Topic, Target audience, Intended learning outcomes, Age suitability, Research references, Script, Storyboard, Narration, Visual plan, Quiz or learning activity, Safety review, Human approval.

**Never present unsupported medical claims as facts.** Require qualified expert review for clinical or developmental diagnosis-related material.

### B. AI Voice Engine

**Purpose:** Multi-engine TTS, STT, voice cloning with consent. Replaces existing Piper/espeak chain with voicebox as primary engine, preserves Piper/espeak as fallback.

**Internal modules:**
- `engines/voicebox.ts` — adapter for voicebox FastAPI backend.
- `engines/piper.ts` — existing Piper adapter (preserved).
- `engines/espeak.ts` — existing espeak fallback (preserved).
- `engines/formant.ts` — last-resort formant synthesis (preserved).
- `voice-profiles.ts` — voice profile CRUD, permission checks.
- `consent.ts` — voice cloning consent workflow.

**Public API surface:**
- `POST /api/alo-learning/voice/generate` — synthesize speech from script
- `POST /api/alo-learning/voice/transcribe` — ASR
- `GET /api/alo-learning/voice/profiles` — list voice profiles
- `POST /api/alo-learning/voice/profiles` — create voice profile (requires consent)
- `POST /api/alo-learning/voice/profiles/[id]/clone` — clone a voice (requires documented consent)
- `DELETE /api/alo-learning/voice/profiles/[id]` — revoke consent and delete profile + source assets
- `GET /api/alo-learning/voice/history` — generation history

**Required interfaces (Section 6):** Voice Library, Voice Engine Selection, Script-to-Voice, Audio Preview, Voice Settings, Language Settings, Voice Profile Permissions, Generation History, Audio Export — mounted in the ALO Learning UI as the ALO Voice Studio.

**Voice cloning requirements (mandatory):**
- Explicit documented consent from the person (stored in `VoiceConsent` model).
- Separate consent for commercial use (boolean field on `VoiceConsent`).
- Revocation mechanism (DELETE above).
- Restricted access to voice samples (signed URLs only).
- Encrypted source assets (AES-256-GCM at rest).
- Audit logs (every clone operation written to `MediaAuditLog`).

**Never create unauthorized voice clones. Never impersonate real people to deceive audiences. Maintain synthetic-media disclosure where appropriate.** Synthetic media generated by this engine must be tagged with a `synthetic: true` flag in `MediaAuditLog`.

### C. SMS Gateway Engine

**Purpose:** Provider-independent SMS adapter. Sends, receives, tracks delivery, manages webhooks.

**Internal modules:**
- `providers/httpsms.ts` — adapter for httpSMS hosted SaaS (preserved).
- `providers/httpsms-self-hosted.ts` — adapter for self-hosted httpSMS (optional, AGPL sidecar).
- `providers/sms-domovina.ts` — adapter for sms.domovina.ai Reverse OTP flow (optional, AGPL sidecar).
- `providers/index.ts` — provider registry with selection logic.
- `webhooks.ts` — inbound webhook handler with signature verification.
- `rate-limiter.ts` — Redis-backed rate limiting.

**Public API surface:**
- `POST /api/alo-learning/sms/send` — send SMS (selects provider by config or explicit param)
- `GET /api/alo-learning/sms/messages` — message history with delivery status
- `POST /api/alo-learning/sms/webhooks/httpsms` — inbound webhook (JWT signature verified)
- `POST /api/alo-learning/sms/webhooks/[provider]` — generic webhook handler
- `GET /api/alo-learning/sms/providers` — list configured providers
- `POST /api/alo-learning/sms/opt-out` — STOP/opt-out handling

**Features (Section 7):** Send SMS, Receive SMS, Delivery status, Message history, Webhooks, Retry, Rate limits, Phone number validation, Provider selection, Usage tracking, Admin configuration.

**httpSMS is supported as an optional Android gateway. Do not assume an Android gateway is equivalent to a telecom carrier.** Allow additional authorized SMS providers through adapters.

**Integrate SMS with:** Student registration, OTP verification, counseling notifications, application updates, appointment reminders, parent notifications, teacher communication, administrative alerts.

**Marketing messages must require appropriate consent.** Provide STOP/opt-out handling. **Never expose OTPs in logs.**

### D. Telephony Engine

**Purpose:** ALO AI Communication Center. SIP-based calls, call queue, AI-assisted summaries, CRM logging.

**Internal modules:**
- `sip/account.ts` — SIP account configuration (admin-managed).
- `calls/incoming.ts` — incoming call handler, call queue.
- `calls/outgoing.ts` — outgoing call initiation (admin-triggered only).
- `calls/transfer.ts` — call transfer to human escalation.
- `ai-assistant.ts` — optional AI call assistant (9-step flow).
- `transcripts.ts` — call transcript storage and retrieval.

**Public API surface:**
- `POST /api/alo-learning/telephony/sip/accounts` — configure SIP account
- `GET /api/alo-learning/telephony/calls` — call history
- `POST /api/alo-learning/telephony/calls/[id]/transfer` — transfer to human
- `GET /api/alo-learning/telephony/calls/[id]/transcript` — call transcript
- `POST /api/alo-learning/telephony/calls/[id]/summarize` — AI summary

**Required capabilities (Section 8):** SIP account configuration, Incoming calls, Outgoing calls, Call status, Call history, Agent assignment, Call queue, Call transfer, Missed call tracking, Call analytics, AI-assisted call summaries, Human escalation, Provider adapter architecture.

**Optional AI call assistant (9-step flow):** Greeting → Language identification → Intent detection → Knowledge retrieval → Student/application lookup → Appointment scheduling → Human transfer → Call summary → CRM logging.

**Do not enable automated outbound campaigns without consent and applicable regulatory review.** Recording must follow applicable consent laws. Emergency calling limitations must be clearly documented.

**ipftrace2 is not a VoIP engine. Do not integrate it as a telephony provider.** Only consider it for advanced Linux tracing during ops debugging.

### E. AI Character & Digital Presenter Engine

**Purpose:** ALO Character Studio. Manages character profiles, consent, asset ownership, generation history. Critical for child-safety controls.

**Internal modules:**
- `profiles.ts` — character profile CRUD.
- `consent.ts` — character consent workflow.
- `minors.ts` — child-safety controls.

**Public API surface:**
- `POST /api/alo-learning/characters` — create character profile
- `GET /api/alo-learning/characters` — list (filter by type: fictional, stock, presenter, family)
- `POST /api/alo-learning/characters/[id]/consent` — record consent
- `DELETE /api/alo-learning/characters/[id]/consent` — revoke consent and delete derived assets
- `POST /api/alo-learning/characters/[id]/generate` — generate character media

**Character types (Section 9):**
- Original fictional educational characters (no consent required).
- Licensed stock characters (license terms in `assetOwnership`).
- Consenting adult digital presenters (documented consent required).
- Parent and teacher presenters (documented consent required).
- Authorized family character references (family consent required, restricted access).

**For minors (mandatory):**
- Obtain verifiable parental authorization.
- Minimize identifiable source images.
- Do not expose children's private assets publicly.
- Do not enable unrestricted face or voice cloning of minors.
- Prefer fictionalized characters for public educational videos.
- Apply human approval to all child-related media.

**Never use a child's identity to imply that the child actually said or did something they did not.** Synthetic presenters must not be represented as real footage or authentic testimonials.

### F. Video Generation Engine

**Purpose:** ALO Cinematic Studio. 10 video modes, 14-step production pipeline.

**Internal modules:**
- `modes/` — one module per video mode (Educational Explainer, Cinematic Documentary, 3D Animated Story, AI Presenter, Talking Character, Parent Education, Teacher Training, Short-form Video, Long-form YouTube Video, Animated Infographics).
- `pipeline.ts` — the 14-step production pipeline orchestrator.
- `engines/ffmpeg.ts` — existing ffmpeg adapter (preserved, with S-1 fix applied).
- `engines/remotion.ts` — optional Remotion adapter (Phase 7; gated by license check).
- `engines/manim.ts` — Manim adapter for math/educational animation (new; Python sidecar).
- `engines/cogvideo.ts` — optional CogVideo adapter (Phase 8 deferred).

**Public API surface:**
- `POST /api/alo-learning/video/projects` — create video project (selects mode)
- `GET /api/alo-learning/video/projects` — list projects
- `POST /api/alo-learning/video/projects/[id]/pipeline/[step]` — execute one pipeline step
- `POST /api/alo-learning/video/projects/[id]/render` — final render
- `GET /api/alo-learning/video/projects/[id]/outputs` — list output files

### G. Cinematic Editing Engine

**Purpose:** Post-production editing, audio mixing, subtitle burn-in, color grading.

**Internal modules:** `editor.ts`, `audio-mix.ts`, `color.ts`, `subtitles/burn.ts`, `subtitles/sidecar.ts`.

**Public API surface:**
- `POST /api/alo-learning/video/projects/[id]/edit` — apply edit operations
- `POST /api/alo-learning/video/projects/[id]/audio-mix` — audio mixing
- `POST /api/alo-learning/video/projects/[id]/subtitles/burn` — burn subtitles
- `GET /api/alo-learning/video/projects/[id]/subtitles/export?format=srt|vtt` — export subtitles

### H. 3D Animation Engine

**Purpose:** 3D educational animation. Manim for math/educational animation; Blender (via CLI-Anything skill) for 3D scene generation.

**Internal modules:** `manim.ts`, `blender.ts`, `scene-builder.ts`.

**Public API surface:**
- `POST /api/alo-learning/animation/scenes` — create scene
- `POST /api/alo-learning/animation/scenes/[id]/render` — render to MP4
- `GET /api/alo-learning/animation/scenes/[id]/preview` — preview frame

### I. Creative Workflow Engine

**Purpose:** ALO Creative Workflow Studio. ComfyUI workflow registration, execution, monitoring. Local ComfyUI is the primary; RunningHub cloud is optional and gated.

**Internal modules:**
- `comfyui-local.ts` — adapter for local ComfyUI (`http://127.0.0.1:8188`).
- `comfyui-remote.ts` — optional adapter for RunningHub cloud (gated by paid-AI switches + `ALO_RUNNINGHUB_ENABLED`; never hardcoded credentials).
- `workflow-registry.ts` — workflow JSON registration, template management.
- `node-config.ts` — node configuration, input mapping.

**Public API surface:**
- `POST /api/alo-learning/workflows` — register workflow
- `GET /api/alo-learning/workflows` — list workflows
- `POST /api/alo-learning/workflows/[id]/execute` — execute workflow (async job)
- `GET /api/alo-learning/workflows/[id]/executions/[execId]` — execution status
- `POST /api/alo-learning/workflows/[id]/executions/[execId]/retry` — retry failed execution

**Required features (Section 11):** ComfyUI workflow registration, Workflow templates, Node configuration, Input mapping, Image generation, Video generation, Audio generation, Execution monitoring, Output retrieval, Retry, Error logs, GPU selection, Local/remote execution.

**RunningHub must remain optional.** The system must work with local ComfyUI workflows when the local installation is available. **Do not hardcode provider credentials.**

### J. Social Publishing Engine

**Purpose:** ALO Social Publishing Center. Publishes to Facebook, YouTube, TikTok via official APIs. Human approval is the default mode.

**Internal modules:**
- `platforms/facebook.ts` — Facebook Graph API adapter.
- `platforms/youtube.ts` — YouTube Data API v3 adapter.
- `platforms/tiktok.ts` — TikTok Content Posting API adapter.
- `format-adapt.ts` — automatic platform adaptation (9:16, 16:9, 1:1, 4:5).
- `oauth.ts` — OAuth flow per platform.

**Public API surface:**
- `POST /api/alo-learning/publishing/accounts` — connect platform account (OAuth)
- `GET /api/alo-learning/publishing/accounts` — list connected accounts
- `POST /api/alo-learning/publishing/jobs` — create publishing job (requires approval)
- `POST /api/alo-learning/publishing/jobs/[id]/approve` — admin approval
- `POST /api/alo-learning/publishing/jobs/[id]/publish` — execute publish
- `GET /api/alo-learning/publishing/records` — publishing history with external post IDs

**Formats (Section 13):** 9:16 vertical, 16:9 landscape, 1:1 square, 4:5 feed.

**Default mode: Human approval before publication.** Allow automatic publishing only for explicitly approved content categories and authorized accounts.

**Every publishing job must maintain:** Platform account, Content ID, Approval ID, Publishing timestamp, External post ID, External URL, Status, Error details.

**Use official platform APIs and authorized OAuth. Respect platform-specific API access and publishing eligibility. Never bypass platform restrictions.**

### K. Learning Analytics Engine

**Purpose:** Learning-specific analytics. Content performance, learner engagement, outcome tracking. Replaces the fictional cost telemetry flagged in baseline AI-3.

**Internal modules:**
- `content-performance.ts` — per-content engagement metrics.
- `learner-engagement.ts` — per-learner activity.
- `outcome-tracking.ts` — learning outcome achievement.
- `cost-telemetry.ts` — REAL cost telemetry (replaces hardcoded `costEstUsd: 0.01`).

**Public API surface:**
- `GET /api/alo-learning/analytics/content/[id]` — content performance
- `GET /api/alo-learning/analytics/learners/[id]` — learner engagement
- `GET /api/alo-learning/analytics/outcomes` — outcome tracking dashboard
- `GET /api/alo-learning/analytics/costs` — real cost telemetry

**The dashboard must use actual backend data. No fake metrics. No decorative buttons without working actions.**

### L. Safety & Approval Engine

**Purpose:** First-class safety and approval system. Child-safety, consent revocation, synthetic-media disclosure, human approval queue.

**Internal modules:**
- `approvals/queue.ts` — approval queue CRUD.
- `approvals/policy.ts` — which operations require approval.
- `child-safety.ts` — child-related media policy.
- `consent/registry.ts` — consent registry across voice, character, family assets.
- `consent/revocation.ts` — revocation flow.
- `synthetic-disclosure.ts` — synthetic-media tagging.
- `fact-check.ts` — fact verification queue.

**Public API surface:**
- `GET /api/alo-learning/approvals` — pending approvals
- `POST /api/alo-learning/approvals/[id]/approve` — approve
- `POST /api/alo-learning/approvals/[id]/reject` — reject (with reason)
- `POST /api/alo-learning/consent/[id]/revoke` — revoke consent
- `GET /api/alo-learning/safety/policy` — current safety policy
- `POST /api/alo-learning/safety/policy` — update policy (admin only)

---

## 3. The 14-step video production pipeline

| Step | Owner service | Description | Approval required? |
|---|---|---|---|
| 1. Topic | Learning Intelligence | Capture topic, target audience, learning outcomes | No |
| 2. Research | Learning Intelligence | Aggregate sources, citations | No |
| 3. Script | Learning Intelligence | Write script (LLM-assisted, human-edited) | No |
| 4. Fact check | Safety & Approval | Verify claims; flag medical/developmental content | **Yes** if medical/developmental |
| 5. Storyboard | Learning Intelligence | Break script into scenes | No |
| 6. Character selection | AI Character | Pick or create characters; verify consent | **Yes** if minor or family member |
| 7. Scene generation | Creative Workflow | Generate per-scene images/videos (ComfyUI local) | No |
| 8. Voice generation | AI Voice | Synthesize narration | **Yes** if voice cloning |
| 9. Lip-sync | Video Generation | Sync voice to character (if AI Presenter mode) | No |
| 10. Video composition | Cinematic Editing | Assemble scenes into timeline | No |
| 11. Subtitles | Cinematic Editing | Burn or sidecar SRT/VTT (Bangla + English) | No |
| 12. Audio mixing | Cinematic Editing | Voice + music + SFX mix | No |
| 13. Quality check | Safety & Approval | Final QC: spelling, timestamps, completeness | **Yes** (mandatory) |
| 14. Human approval | Safety & Approval | Final approval before publishing | **Yes** (mandatory) |
| (post) Publishing | Social Publishing | Publish to Facebook/YouTube/TikTok | **Yes** (mandatory, separate from step 14) |

**Use Remotion for programmatic compositions. Use FFmpeg for media processing. Use Manim for mathematical and educational animation.** Use InfiniteTalk only after model, GPU and licensing compatibility verification (deferred — GPU-infeasible). Evaluate CogVideo and HunyuanVideo independently (CogVideo deferred; HunyuanVideo rejected). Provide cloud GPU adapters where local resources are insufficient.

---

## 4. The 20 AI agents

Each agent has: defined responsibility, allowed tools, permission boundaries, input/output schema, execution limits, human escalation rules, audit trail. Agents must not independently access unrestricted production credentials or sensitive child records.

| # | Agent | Responsibility | Allowed tools | Escalation |
|---|---|---|---|---|
| 01 | Learning Research Agent | Aggregate sources, citations | web_search (read-only), RAG search | Human review for medical claims |
| 02 | Curriculum Agent | Structure content into learning units | Learning Intelligence Engine APIs | Human review for age-suitability |
| 03 | Child Development Content Agent | Write ALO Kids content | LLM (local Ollama), Learning Intelligence APIs | Mandatory approval (child content) |
| 04 | Parenting Content Agent | Write ALO Parenting content | LLM, Learning Intelligence APIs | Human review |
| 05 | Teacher Training Agent | Write ALO Teacher Academy content | LLM, Learning Intelligence APIs | Human review |
| 06 | Script Writing Agent | Convert content brief to video script | LLM, Learning Intelligence APIs | Human review |
| 07 | Fact Verification Agent | Verify claims in scripts | web_search (read-only), RAG search | Mandatory expert review for medical/developmental claims |
| 08 | Storyboard Agent | Break script into scenes | LLM, Character Studio (read-only) | Human review |
| 09 | Character Management Agent | Select/create characters | Character Studio APIs | **Mandatory approval if minor or family member** |
| 10 | Voice Generation Agent | Synthesize narration | Voice Engine APIs | **Mandatory approval if voice cloning** |
| 11 | Subtitle Agent | Generate and translate subtitles | Cinematic Editing APIs, VideoCaptioner sidecar | Human review |
| 12 | Cinematic Director Agent | Compose video timeline | Cinematic Editing APIs | Human review |
| 13 | 3D Animation Agent | Generate 3D scene | 3D Animation Engine, Manim/Blender | Human review |
| 14 | Lip-Sync Agent | Sync voice to character | Video Generation APIs | Human review |
| 15 | Video Editing Agent | Final edit, transitions, overlays | Cinematic Editing APIs | Human review |
| 16 | Audio Quality Agent | Audio mixing, normalization | Cinematic Editing APIs | Human review |
| 17 | Visual Quality Agent | Visual QC, color grading | Cinematic Editing APIs | Human review |
| 18 | Content Safety Agent | Safety review, synthetic-media disclosure | Safety & Approval Engine | **Mandatory escalation to human for all child-related media** |
| 19 | Social Publishing Agent | Format and publish to platforms | Social Publishing Engine | **Mandatory human approval before publish** |
| 20 | Performance Analytics Agent | Track content performance | Learning Analytics Engine | No escalation (read-only) |

Each agent's run is persisted to `AgentExecution` Prisma model with: agentId, jobId, status, inputBrief, outputJson, costUsd (Decimal — replaces the Float `costEstUsd`), startedAt, finishedAt, retryCount.

---

## 5. UI navigation

The directive (Section 17) mandates an integrated ALO Learning navigation. The 21 entries are mounted in the existing ALO shell sidebar.

```
ALO LEARNING
  ├── Overview                       (Phase 2)
  ├── Learning Content               (Phase 5)
  ├── ALO Kids                       (Phase 5)
  ├── ALO Parenting                  (Phase 5)
  ├── Teacher Academy                (Phase 5)
  ├── AI Research                    (Phase 5)
  ├── AI Script Studio               (Phase 5)
  ├── Character Studio               (Phase 6)
  ├── Voice Studio                   (Phase 3)
  ├── Cinematic Studio               (Phase 7)
  ├── 3D Animation                   (Phase 7)
  ├── Video Editor                   (Phase 7)
  ├── Subtitle & Translation         (Phase 9)
  ├── SMS Center                     (Phase 4)
  ├── Telephony Center               (Phase 4)
  ├── Social Publishing              (Phase 10)
  ├── AI Workforce                   (Phase 11)
  ├── Workflow Manager               (Phase 8)
  ├── Analytics                      (Phase 11)
  ├── Safety & Approvals             (Phase 2)
  └── System Settings                (Phase 2)
```

**Every engine must display:** Connected/Disconnected, Health status, Version, Configuration, Resource availability, Last successful execution, Last error, Usage. The existing `/api/health` route is extended to cover all 12 services.

---

## 6. Cross-service communication rules

1. **HTTP only** — services communicate via internal HTTP calls. No direct module imports across service boundaries.
2. **Authenticated** — every internal call passes the admin session token. The Safety & Approval Engine may veto any call.
3. **Idempotent** — every mutating operation accepts an idempotency key; retries are safe.
4. **Audited** — every call is logged to `MediaAuditLog`.
5. **Async where slow** — operations >2s are queued via BullMQ.
6. **Circuit-broken** — adapters implement circuit breakers; failing external services trip the breaker and fall back to local-first mode.

---

## 7. CLI-Anything integration (cross-cutting)

**HKUDS/CLI-Anything** (Apache-2.0, Python 3.10+) extends ALO's AgentOS with a CLI orchestration layer. Agents can call any installed CLI-Anything skill via `spawnSync("cli-hub", ["run", skillName, "--json", ...args])`.

**Pilot skills (Phase 11):**
- `audacity` — audio editing (Agent 16: Audio Quality Agent).
- `blender` — 3D scene generation (Agent 13: 3D Animation Agent).
- `calibre` — e-book conversion for RAG ingest.
- `browser` — web automation for research (Agent 01: Learning Research Agent, read-only).
- `chromadb` — vector store (extends ALO's keyword-only RAG to semantic search).

The pilot is gated behind `ALO_CLI_ANYTHING_ENABLED` env flag and is not enabled by default in production until the pilot produces measurable value.

---

## 8. Architectural decisions log

| Decision | Rationale | Date |
|---|---|---|
| Use BullMQ + Redis for async jobs | Existing in-memory rate limiter is single-instance (baseline S-6) | 2026-11-05 |
| Use voicebox as primary TTS, preserve Piper/espeak | voicebox MIT, multi-engine, local-first; Piper/espeak fallback preserved | 2026-11-05 |
| Use sidecar pattern for AGPL/GPL repos | Avoids copyleft exposure to ALO's closed-source distribution | 2026-11-05 |
| Defer CogVideo, reject HunyuanVideo/InfiniteTalk | GPU feasibility + license restrictions | 2026-11-05 |
| Reject ComfyUI_RH_APICall | NO LICENSE + violates local-first principle | 2026-11-05 |
| Unify three AI paths behind `ai-facade.ts` | Baseline AI-1 finding | 2026-11-05 |
| Replace fictional cost telemetry with real | Baseline AI-3 finding | 2026-11-05 |
| Add `requireOwner()` to every privileged route | Baseline S-4 finding | 2026-11-05 |
| Fix S-1 Critical before any Phase 2+ work | Shell injection is a launch blocker | 2026-11-05 |

---

## Cross-references

- `baseline-audit.md` — existing ALO platform state.
- `repository-audit.md` — per-repo audit with 14 inspection dimensions.
- `integration-matrix.md` — INTEGRATE/ADAPT/REFERENCE/OPTIONAL/REJECT decision matrix.
- `security-review.md` — Section 16 mandatory security + child privacy.
- `database-design.md` — the 31 new Prisma models.
- `deployment-guide.md` — Phase 0-13 deployment with rollback.
- `testing-report.md` — the 20 test categories.
- `production-readiness.md` — current readiness verdict.

---

## Final note

This architecture extends the existing ALO Education platform without replacing it. Every design choice respects the single-admin model, local-first principle, and additive-only migration discipline established in `baseline-audit.md`. The 12 services, 14-step pipeline, and 20 agents are scoped to a multi-quarter initiative (~22-30 weeks of engineering effort) sequenced as Phase 0-13 in `deployment-guide.md`.

The directive's FINAL RULE is reaffirmed: **audit first, preserve existing production functionality, integrate modularly, test every real operation, never fake successful integrations, never expose credentials, never bypass consent, never publish unapproved child-related media.**
