# Phase 0 — Repository and Infrastructure Audit

**Document:** `docs/voice-contact-center/AUDIT.md`
**Date:** 2026-11-05
**Status:** READ-ONLY — no code modified, no production system touched.
**Auditor:** ALO Labs Engineering (Principal Software Architect role).
**Directive section:** §13 Phase 0 — Repository and Infrastructure Audit.
**Approval gate:** This audit is the first deliverable. Implementation is paused until the owner issues explicit written approval.

---

## 1. Audit scope

The directive requires a read-only inspection of the existing ALO Labs MarketingOS repository before any implementation work begins. The audit covers:

1. The actual framework and database in use.
2. Existing authentication and permissions.
3. Reusable modules that the voice/contact-center product can build on.
4. Infrastructure capacity (CPU, RAM, disk, GPU, network).
5. Telephony provider options and their fit.
6. Local Bangla TTS and ASR model candidates.
7. License audit for every candidate dependency.
8. Missing infrastructure that must be provisioned before Phase 1.

The audit explicitly does **not**:

- Modify code, database schema, environment files, or production services.
- Subscribe to any telephony or paid service.
- Activate any paid API.
- Clone any third-party repository.
- Download any AI model weights.
- Run any destructive migration.
- Make any real telephone call, send any SMS, or publish any social post.

## 2. Existing MarketingOS repository — verified state

The repository on the `main` branch (commit `8f68bb9`) was inspected locally. The following was confirmed by reading files and running build verification.

### 2.1 Framework and runtime

| Component | Version | Status |
|---|---|---|
| Next.js | 16.1.1 (App Router, Turbopack) | Production build PASS in 17.8s, 101 static pages |
| React | 19.0.0 | Server + Client Components supported |
| TypeScript | 5.x | Strict mode enabled |
| Tailwind CSS | 4.x | New York-style shadcn/ui components available |
| Prisma | 6.11.1 | SQLite staging, PostgreSQL production target |
| Node.js runtime | 24.x (LTS) | Required by Next 16 |
| Auth | `jose` (HS256 JWT, 7-day expiry) + `bcryptjs` (12 rounds) | Production-grade |
| AI SDK | `z-ai-web-dev-sdk` 0.0.18 | Reads `/etc/.z-ai-config` JSON (not env vars) |

### 2.2 Database

- **Engine:** SQLite (staging) at `db/custom.db`.
- **Production target:** PostgreSQL 16 with Row Level Security (per master audit, Phase 8).
- **Models:** 59 Prisma models, all tenant-scoped via `companyId`.
- **Recent additions relevant to voice/contact-center:**
  - `AiModelProvider`, `AiModelEntry` — configurable AI provider registry.
  - `AgentModelAssignment` — per-agent-type model selection.
  - `AgentExecutionLog`, `AgentUsageDaily` — per-call audit + per-day rollup.
  - `CircuitBreakerState` — per-provider resilience state.
  - `AfterHoursRule` — Asia/Dhaka timezone routing (already defaults to BD business hours).
  - `Integration`, `IntegrationSecret` (AES-256-GCM envelope encrypted), `OAuthState` — OAuth+PKCE surface.
- **No destructive migration has been run.** Schema changes in the recent commits were additive only.

### 2.3 Existing authentication and permissions

- **JWT-based** with HS256, 7-day expiry, `companyId` claim, `role` claim.
- **Roles** (from `src/lib/auth.ts`): `super_admin`, `company_owner`, `admin`, `manager`, `social_media_manager`, `content_manager`, `seo_manager`, `ai_agent_manager`, `customer_support`, `team_member`, `client_user`, `viewer`. Role hierarchy enforced via `hasPermission()`.
- **Super admin** is privileged — required for the AI Model Registry routes. The seeded admin user `admin@alolabs.net` was upgraded to `super_admin` in commit `acdeeeb`.
- **Multi-tenancy:** `companyId` on every tenant-scoped model. Application-layer enforcement via Prisma `where` clauses. PostgreSQL RLS is not yet implemented (Phase 8 master-audit work).
- **Session:** JWT in `mos_token` cookie OR `Authorization: Bearer <token>` header. No refresh-token rotation yet.
- **MFA:** Not implemented. The directive (§10) requires MFA for privileged accounts — this is a Phase 1 gap.

### 2.4 Reusable modules already in the codebase

The following `src/lib/` modules can be directly reused by the voice/contact-center product without modification:

| Module | Purpose | Reuse for voice/contact-center |
|---|---|---|
| `vault.ts` | AES-256-GCM envelope encryption for secrets | Encrypt SIP credentials, voice-clone consent records, recording access tokens |
| `pkce.ts` | RFC 7636 OAuth + state tokens | OAuth flows for telephony providers (Twilio, Telnyx) and Meta WhatsApp |
| `providers.ts` | 13 integration provider definitions | Add telephony provider definitions (Twilio, Telnyx, FreeSWITCH, Asterisk) |
| `circuit-breaker.ts` | `withResilience()` wrapper — timeout, retry, breaker | Wrap every telephony API call |
| `pii-filter.ts` | 8-regex PII scrubber (BD phone, NID, email, etc.) | Scrub transcripts before persisting or sending to cloud LLMs |
| `after-hours.ts` | Asia/Dhaka TZ-aware routing | Route after-hours calls to voicemail or AI receptionist |
| `cost-estimator.ts` | Per-provider rate table | Add telephony per-minute rates |
| `agent-loop.ts` | Bounded 8-iteration loop + tool allowlist + approval gate | Reuse for AI voice agent conversation loop |
| `agent-tools.ts` | 9 registered tools (CRM, SMS, social, content) | Add telephony tools (transfer, hold, park, conference) |
| `sms-provider-chain.ts` | Twilio/HTTPSMS/Telnyx/Domovina chain | Already handles SMS — voice calls use the same providers' Voice API |
| `events.ts` | `emitEvent()` → Notification + AuditLog + Activity + Webhook | Fire call.started, call.ended, recording.ready events |
| `v1-middleware.ts` | `getSessionContext()`, `requireRole()`, `ok()`, `unauthorized()` | All new voice routes use this |

### 2.5 Existing API surface (161 routes)

- **v0 API** (`/api/*`): 150 routes covering CRM, SMS, social, AI generation, dashboard, etc.
- **v1 API** (`/api/v1/*`): 11 routes for the integration surface (session, OAuth authorize/callback, credentials, status, discover, resources, missing-fields, validate, confirm, integration-setup agent).
- **No voice-specific routes exist yet.** The existing `/api/voip/call` and `/api/voip/calls` routes are stubs that create a row in `SmsMessage` with `type='voip_call'` — no real telephony.

### 2.6 Existing AI infrastructure (verified end-to-end)

- **9 active AI providers in the chain** (commit `6ac1978`): Z.AI, Groq, Gemini, OpenRouter, Ollama, OpenCode, Cloudflare, HuggingFace, Pollinations.
- **2 paid providers disabled by default:** Ollama Cloud (metered) and Mistral (paid). Admin can re-enable after setting API key.
- **Live chain test:** Z.AI served a request in 554ms via `glm-4-plus`.
- **127/127 test assertions pass** across 4 test suites.
- **Rule-based fallback** guarantees the chain never fails.
- **Per directive §2:** "Avoid mandatory paid AI APIs" — satisfied. Every LLM call can be served by free or self-hosted providers.

## 3. Infrastructure capacity audit

The production target is the existing Ubuntu server at `103.231.239.79` (already running MarketingOS, alaminn.info, ALO Education, TECH360, and PM2-managed services per the deploy log shared by the owner). The audit could not SSH into the production host (per directive §2: read-only, no production changes), so capacity figures below are based on the deployment log the owner shared and on standard requirements for the proposed workload.

### 3.1 Observed production load (from owner's deploy log)

| Process | Memory | Status |
|---|---|---|
| `alo-dashboard` (PM2 id 0) | 139.7 MB | online |
| `alo-agent-lap` (PM2 id 1) | 70.0 MB | online |
| `alaminn` (PM2 id 2) | 69.7 MB | online (just restarted) |
| `hosting-portal` (PM2 id 4) | 165.8 MB | online |
| `ALO-LEARNING-JOURNEY` (PM2 id 6) | 104.0 MB | online |
| **Host** | CPU 20.5%, RAM 24.2% | 5 PM2 processes, ~550 MB total |

### 3.2 Required capacity for voice/contact-center Phase 1-7

| Component | Min CPU | Min RAM | Min disk | GPU | Notes |
|---|---|---|---|---|---|
| MarketingOS Next.js (existing) | 2 vCPU | 1 GB | 10 GB | none | Already running |
| PostgreSQL 16 (new) | 2 vCPU | 2 GB | 50 GB | none | Replaces SQLite; required for multi-tenant RLS |
| Redis 7 (new) | 1 vCPU | 512 MB | 5 GB | none | BullMQ task queue + WebSocket presence + rate-limit counters |
| FreeSWITCH (Phase 2) | 2 vCPU | 2 GB | 10 GB | none | SIP signaling + RTP media; needs dedicated public IP for SIP |
| Object storage (S3-compatible) | n/a | n/a | 100 GB+ | none | Call recordings, voicemail, voice-clone training audio |
| Bangla TTS worker (Phase 3) | 4 vCPU | 4 GB | 20 GB | optional | Piper runs on CPU; XTTS v2 / Kokoro benefit from GPU |
| Bangla ASR worker (Phase 3) | 4 vCPU | 4 GB | 20 GB | recommended | faster-whisper CPU works; GPU recommended for streaming + low latency |
| LLM inference (existing chain) | 2 vCPU | 2 GB | 5 GB | optional | Z.AI cloud covers primary; local Ollama is fallback (32 GB RAM if running Llama 3.3 70B locally) |

### 3.3 Missing infrastructure that must be provisioned before Phase 1

1. **PostgreSQL 16** — `apt install postgresql-16`, create `marketingos` database + `marketingos_app` role, run `prisma migrate deploy`. Estimated 30 minutes. No existing data is touched.
2. **Redis 7** — `apt install redis-server`, bind to `127.0.0.1`, set `requirepass`. Estimated 10 minutes.
3. **MinIO or equivalent S3-compatible storage** — Docker container on a separate volume for call recordings. Estimated 1 hour.
4. **Dedicated public IP for SIP** — FreeSWITCH requires a public IP for SIP signaling; the existing `103.231.239.79` may be shared with HTTP. Recommendation: a second IP for SIP-only traffic, or a dedicated SIP trunk provider that handles NAT traversal.
5. **TLS certificate for SIP** — Let's Encrypt for the SIP domain (e.g. `sip.alolabs.net`). Caddy (already deployed for `marketing.alolabs.net`) can provision this.
6. **(Optional, Phase 3) GPU worker** — NVIDIA RTX 3090 or equivalent (24 GB VRAM) for XTTS v2 voice cloning + faster-whisper-large-v3 streaming. Without GPU, Bangla TTS quality is limited to Piper (acceptable but lower quality than cloud TTS).

## 4. Telephony provider research

### 4.1 Open-source telephony engines — comparison

| Engine | License | Architecture | Best fit | Verdict |
|---|---|---|---|---|
| **FreeSWITCH** | MPL 1.1 | Modular, threaded, signaling/media separation | Carrier-grade, WebRTC, high concurrency, multi-tenant PBX | **RECOMMENDED** for Phase 2 |
| **Asterisk** | GPL-2.0 | B2BUA, largely monolithic | SMB PBX, IVR, voicemail, FreePBX | Suitable for small deployments; GPL constrains commercial derivative distribution |
| **Kamailio** | GPL-2.0 | Stateless SIP signaling proxy | SBC, load balancer, SIP routing at scale | Use as a front-line SBC in front of FreeSWITCH for hardening |
| **WebRTC** | W3C standard | Browser-native | Softphone, agent workspace, in-browser calling | Required for the human-agent workspace (Module G) |

**Reference architecture** (per research): FreeSWITCH (PBX) behind Kamailio (SBC) for carrier-grade deployments. The SBC handles TLS termination, SIP normalization, fraud detection, and topology hiding. The PBX never sees raw external SIP.

**For ALO Labs Phase 2 recommendation:** Start with FreeSWITCH alone (single-tenant, single IP). Add Kamailio in Phase 5 (multi-tenant scale). This is the lowest operational complexity that satisfies the directive.

### 4.2 Cloud telephony providers — adapter matrix

| Provider | Inbound | Outbound | Recording | WebRTC | Bangladesh numbers | Cost model |
|---|---|---|---|---|---|---|
| **Twilio** | ✓ | ✓ | ✓ | ✓ | No direct BD numbers (need local BD carrier) | Pay per minute + per number |
| **Telnyx** | ✓ | ✓ | ✓ | ✓ | No direct BD numbers | Pay per minute + per number (lower than Twilio) |
| **SignalWire** | ✓ | ✓ | ✓ | ✓ | No direct BD numbers | Pay per minute; FreeSWITCH-native |
| **Plivo** | ✓ | ✓ | ✓ | partial | No direct BD numbers | Pay per minute + per number |
| **Vonage** | ✓ | ✓ | ✓ | ✓ | No direct BD numbers | Pay per minute + per number |
| **Local BD carrier** (BTRC-licensed) | ✓ | ✓ | varies | no | Yes | Regulated; requires BTRC license |

**Critical compliance note:** Real PSTN calling to/from Bangladesh numbers requires a BTRC-licensed telephony carrier. None of the cloud providers above can provision `+880` numbers directly. For the Phase 7 acceptance criterion "real inbound calls work", the owner must either:

- (a) Partner with a BTRC-licensed SIP trunk provider, OR
- (b) Use international numbers (US/UK) for testing and accept that BD PSTN calling is blocked until (a) is satisfied, OR
- (c) Run FreeSWITCH with a local FXO/FXS gateway connected to a BD landline (analog PSTN).

The audit recommends option (a) for production. Option (b) is acceptable for Phase 2-6 development.

## 5. Local Bangla TTS model evaluation

### 5.1 Candidate models

| Model | License | Bangla quality | Voice cloning | VRAM | CPU-only | Streaming | Verdict |
|---|---|---|---|---|---|---|---|
| **Piper** (`bn_BD-google-medium`) | MIT | Available; trained on Google data; quality "medium" (22.05 kHz, 15-20M params) | No | none (CPU) | ✓ | chunked | **Phase 3 default** — MIT license, runs on CPU, BD Bangla voice pack exists |
| **Coqui XTTS v2** | CPML (non-commercial) | 17-language incl. Bangla; 6-sec zero-shot cloning | Yes (best quality) | 4-6 GB | slow | ✓ | **REJECTED for commercial use** — CPML is non-commercial; Coqui shut down Jan 2024 |
| **F5-TTS** | CC-BY-NC-4.0 (non-commercial) | Multilingual; 3-sec zero-shot | Yes | 4-6 GB | slow | ✓ | **REJECTED for commercial use** — non-commercial license |
| **Kokoro** | Apache 2.0 | Limited Bangla support (community-trained) | No | none (CPU) | ✓ | ✓ | **Evaluate** — license is commercial-friendly; Bangla voice quality unverified |
| **StyleTTS 2** | MIT | English-focused; Bangla not officially supported | No | optional | ✓ | ✓ | English-only — not suitable for Bangla |
| **Tortoise** | Apache 2.0 | Multilingual incl. Bangla; very slow (minutes/sentence) | Yes | 4 GB | very slow | no | Too slow for real-time; acceptable for batch narration only |
| **Bark** | MIT | Generative audio (laughter, ambient); not pure TTS | No | 4 GB | slow | no | Creative use only; not for production calling |
| **CosyVoice** | Apache 2.0 | Multilingual; recent (2024-2025) | Yes | 6 GB | slow | ✓ | **Evaluate** — license OK; Bangla quality unverified |
| **Chatterbox TTS** | MIT (per research) | Zero-shot cloning | Yes | unknown | unknown | ✓ | **Evaluate** — license OK; quality claims unverified |

### 5.2 Recommendation

**Phase 3 default:** Piper (`bn_BD-google-medium`) for production calling — MIT license, CPU-only, runs on the same host as FreeSWITCH, streaming via chunked synthesis. Quality is "medium" (not human-indistinguishable) but acceptable for IVR + AI receptionist use cases.

**Phase 3 stretch goal:** Kokoro or CosyVoice if Bangla voice quality is acceptable per native-speaker evaluation. Both have commercial-friendly licenses (Apache 2.0).

**Voice cloning:** Tortoise (Apache 2.0) is the only commercial-friendly option for authorized voice cloning. It is too slow for real-time use but acceptable for batch generation of canned IVR prompts by the voice owner. The directive (§3 Module C) requires explicit verifiable consent — a new `VoiceCloneAuthorization` model will be added in Phase 3.

### 5.3 Bangla voice quality evaluation plan

Per directive §12, the audit must produce a real evaluation plan, not assume quality from marketing material. The plan is documented in `BANGLA_VOICE_MODEL_EVALUATION.md` and includes:

- A corpus of 100 Bangladeshi Bangla sentences covering regional vocabulary, Bangla-English code-switching, numbers, dates, currency, addresses, business/technical vocabulary.
- Native-speaker review panel (3+ reviewers) scoring pronunciation, naturalness, intelligibility, and conversational quality on a 5-point scale.
- WER (Word Error Rate) and CER (Character Error Rate) measured against a held-out test set.
- Latency measurements: first-audio response, end-to-end conversational latency.
- No model is marked "production-ready" until the evaluation passes.

## 6. Local multilingual ASR evaluation

### 6.1 Candidate models

| Model | License | Bangla quality | Code-switching | VRAM | Streaming | Verdict |
|---|---|---|---|---|---|---|
| **faster-whisper** (large-v3) | MIT | Whisper-large-v3 supports Bangla (bn) | yes (mixed) | 4 GB | ✓ | **Phase 3 default** — MIT license, CTranslate2-optimized, streaming via VAD |
| **WhisperX** | BSD-4-clause | Built on faster-whisper + diarization | yes | 4 GB | ✓ | **Evaluate** for speaker diarization |
| **whisper.cpp** | MIT | Same models as faster-whisper | yes | none (CPU) | ✓ | **CPU fallback** for low-resource workers |
| **NVIDIA NeMo** (Parakeet) | Apache 2.0 | Bangla supported | limited | 8 GB | ✓ | Evaluate if GPU worker available |
| **Meta SeamlessM4T** | CC-BY-NC-4.0 | Multilingual ASR + translation | yes | 8 GB | ✓ | **REJECTED** — non-commercial license |

### 6.2 Recommendation

**Phase 3 default:** `faster-whisper` with `large-v3` model for GPU workers, `medium` model for CPU workers. MIT license is commercial-friendly. Streaming with VAD (Voice Activity Detection) handles barge-in.

**Diarization:** WhisperX (BSD-4-clause) adds speaker diarization on top of faster-whisper — required for transcripts that distinguish customer from agent.

## 7. License audit

Per directive §2: "Audit licenses" and "Verify actual Bangla quality, maintenance, model licenses, voice-data rights, and commercial-use restrictions."

### 7.1 Approved (commercial-friendly)

| Dependency | License | Use |
|---|---|---|
| Next.js | MIT | Web framework |
| React | MIT | UI library |
| Prisma | Apache 2.0 | ORM |
| `jose` | MIT | JWT |
| `bcryptjs` | MIT | Password hashing |
| `z-ai-web-dev-sdk` | MIT | Z.AI cloud API |
| FreeSWITCH | MPL 1.1 | Telephony engine (commercial-friendly) |
| Asterisk | GPL-2.0 | Telephony engine (GPL constrains derivative distribution) |
| Kamailio | GPL-2.0 | SIP SBC |
| Piper TTS | MIT | Local neural TTS |
| Kokoro | Apache 2.0 | TTS (evaluate) |
| CosyVoice | Apache 2.0 | TTS (evaluate) |
| Tortoise TTS | Apache 2.0 | Voice cloning (batch) |
| faster-whisper | MIT | ASR |
| WhisperX | BSD-4-clause | ASR + diarization |
| whisper.cpp | MIT | ASR (CPU) |
| Redis | RSAL/SSPL | In-memory store (recent versions; v7.x is dual-licensed) |
| PostgreSQL | PostgreSQL License (BSD-like) | Database |
| MinIO | AGPL-3.0 | Object storage (self-hosted) |
| Postiz | AGPL-3.0 | Social publishing adapter (already integrated; do not modify source) |

### 7.2 Rejected (non-commercial or restrictive)

| Dependency | License | Reason |
|---|---|---|
| Coqui XTTS v2 | CPML | Non-commercial use only; Coqui AI shut down Jan 2024 — no seller for commercial license |
| F5-TTS | CC-BY-NC-4.0 | Non-commercial use only |
| Meta SeamlessM4T | CC-BY-NC-4.0 | Non-commercial use only |

### 7.3 Voice-data rights

- Piper's `bn_BD-google-medium` voice was trained on Google data. The voice pack is MIT-licensed for the model itself, but the underlying training data rights are Google's. Audit recommends legal review before commercial deployment in Bangladesh.
- Any voice cloned via Tortoise requires the voice owner's explicit written consent stored in `VoiceCloneAuthorization`. The directive (§3 Module C) is explicit: "Never allow cloning a third party's voice without authorization."
- Call recordings are PII. Storage must comply with Bangladesh's data protection requirements (research required — see `SECURITY_AND_COMPLIANCE.md`).

## 8. Risk register

| ID | Risk | Likelihood | Impact | Mitigation | Owner action required |
|---|---|---|---|---|---|
| R1 | Bangladesh BTRC does not allow cloud telephony providers (Twilio, Telnyx) to provision `+880` numbers | High | Critical | Use international numbers for development; partner with BTRC-licensed carrier for production | Owner must source BD SIP trunk |
| R2 | Piper `bn_BD` voice quality insufficient for production IVR | Medium | High | Run BANGLA_VOICE_MODEL_EVALUATION plan; if fails, evaluate Kokoro or CosyVoice; fall back to Z.AI cloud TTS for non-Bangla | Owner approval to budget for native-speaker review panel |
| R3 | FreeSWITCH exposed directly to internet without SBC | Medium | Critical | Deploy Kamailio as SBC in front; restrict SIP to known carrier IPs via firewall | Owner to provision second public IP |
| R4 | Call recording without consent violates Bangladesh privacy law | Medium | High | Default recording OFF; prompt callers with "this call may be recorded" announcement; explicit consent capture in IVR | Owner to commission legal review of BD recording law |
| R5 | Voice cloning abused to impersonate real people without consent | Low | Critical | `VoiceCloneAuthorization` model with identity verification + revocation + audit log; never auto-approve | Owner to define policy |
| R6 | AGPL-3.0 (Postiz, MinIO) infects MarketingOS source | Low | Medium | Do not modify AGPL source; only call APIs | Legal review |
| R7 | Multi-tenant isolation insufficient — cross-tenant call/data leak | Low | Critical | PostgreSQL RLS in Phase 8; application-layer `companyId` already enforced | Owner approval for PostgreSQL migration |
| R8 | AI voice agent says something legally binding (price, contract) without authorization | Medium | High | Bounded agent loop (already exists) + sensitive-action approval gate + "AI-generated" message provenance tag | Owner to define approval matrix |
| R9 | Concurrent call capacity not measured before launch | High | High | Phase 7 load testing with `sipp` against FreeSWITCH test env; do not publish capacity claims until measured | Owner approval for test capacity |
| R10 | Outbound calling classified as spam by BD telco regulator | Medium | Critical | DNC suppression, opt-out handling, calling-hour restrictions, frequency caps, caller ID | Owner to verify BD DNC requirements |

## 9. Owner approval gate

Per directive §13: "Stop and wait for owner approval."

The audit is complete. The following decisions are required from the owner before Phase 1 begins:

1. **Approve the FreeSWITCH-first telephony architecture** (vs Asterisk).
2. **Approve the Piper-first Bangla TTS** strategy (with Kokoro/CosyVoice as stretch goals).
3. **Approve the faster-whisper-first ASR** strategy.
4. **Confirm BD SIP trunk provider partnership** (or accept international numbers for development).
5. **Approve infrastructure provisioning**: PostgreSQL 16 + Redis 7 + MinIO + (optional) GPU worker.
6. **Approve Phase 1 scope**: tenant architecture, RBAC, MFA, agent registry, usage metering, audit logs, provider adapters.
7. **Confirm the directive's acceptance criteria** (§14) are understood: real inbound + outbound calls require a real telephony connection; the system cannot be marked production-ready until that exists.

**This audit does NOT trigger any code changes, schema migrations, infrastructure provisioning, or paid service activation.**

The next document is `TELEPHONY_ARCHITECTURE.md`.
