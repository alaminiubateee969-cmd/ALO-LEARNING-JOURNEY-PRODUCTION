# Implementation Roadmap

**Document:** `docs/voice-contact-center/IMPLEMENTATION_ROADMAP.md`
**Date:** 2026-11-05
**Status:** Roadmap — no implementation has started.
**Approval gate:** Owner must approve the phased plan before Phase 1 begins.

---

## 1. Phase summary

| Phase | Scope | Duration estimate | Owner approval required |
|---|---|---|---|
| Phase 0 | Read-only audit (this document set) | Done | ✓ Already in owner's hands |
| Phase 1 | Platform foundation (tenants, RBAC, MFA, agent registry, usage metering, audit logs, provider adapters) | 2-3 weeks | Required before Phase 1 |
| Phase 2 | Cloud telephony (FreeSWITCH, SIP, phone numbers, inbound, outbound, IVR, queues, call state) | 3-4 weeks | Required before Phase 2 |
| Phase 3 | AI voice engine (Bangla TTS evaluation, multilingual TTS, streaming ASR, voice generation studio, voice library, authorized voice cloning) | 4-6 weeks | Required before Phase 3 |
| Phase 4 | AI call agents (agent builder, conversation orchestration, knowledge retrieval, inbound AI receptionist, outbound campaigns, human handoff, call summaries) | 3-4 weeks | Required before Phase 4 |
| Phase 5 | Human contact center + CRM (agent workspace, supervisor dashboard, CRM, shared inbox, recording management, call analytics, Kamailio SBC) | 3-4 weeks | Required before Phase 5 |
| Phase 6 | Billing + SaaS (subscription, usage metering, credit, provider cost tracking, tenant billing, API + webhooks) | 2-3 weeks | Required before Phase 6 |
| Phase 7 | Production validation (security audit, load testing, real telephony, Bangla voice evaluation, backup restoration, failure recovery, compliance verification, production readiness) | 2-3 weeks | Required before production deployment |

**Total estimate:** 19-27 weeks (5-7 months) of focused engineering work. Each phase is gated by owner approval and produces a deployable increment.

## 2. Phase 1 — Platform Foundation

### 2.1 Scope

- Tenant architecture (multi-tenant at the application layer; PostgreSQL RLS is Phase 8).
- Authentication (existing JWT + bcrypt; add refresh token rotation + idle timeout + absolute timeout).
- RBAC (existing 12 roles; add new voice-specific roles: `voice_agent`, `supervisor`, `tenant_admin`).
- MFA for privileged accounts (TOTP-based; required for `super_admin` + `company_owner`).
- Business management (existing `Company` model; add `BusinessProfile` for voice-specific fields).
- AI agent registry (existing `AiAgent` model; add `VoiceAgent` profile fields).
- Usage metering (existing `AgentUsageDaily`; add `CallUsageDaily` + `TtsUsageDaily` + `AsrUsageDaily`).
- Audit logs (existing `AuditLog`; add voice-specific event types).
- Provider adapters (existing `providers.ts`; add `voice` provider definitions for Twilio, Telnyx, FreeSWITCH).

### 2.2 Database changes (additive only — no destructive migrations)

New Prisma models:

- `MfaSecret` — TOTP secrets per user (encrypted via vault).
- `RefreshToken` — refresh token rotation.
- `BusinessProfile` — voice-specific business settings.
- `VoiceAgent` — extends `AiAgent` with voice-specific config (language, voice, speaking style, knowledge base refs).
- `CallUsageDaily` — per-tenant per-day call usage rollup.
- `TtsUsageDaily` — per-tenant per-day TTS character usage.
- `AsrUsageDaily` — per-tenant per-day ASR audio duration.
- `Consent` — who, what, when, how (cookie/IVR/web form).

### 2.3 API routes (new)

- `POST /api/v1/auth/mfa/setup` — generate TOTP secret + QR code.
- `POST /api/v1/auth/mfa/verify` — verify TOTP code, enable MFA.
- `POST /api/v1/auth/refresh` — refresh token rotation.
- `POST /api/v1/auth/logout` — invalidate refresh token.
- `GET/POST /api/v1/admin/voice-agents` — voice agent CRUD.
- `GET /api/v1/admin/usage/calls` — call usage dashboard.
- `GET /api/v1/admin/usage/tts` — TTS usage dashboard.
- `GET /api/v1/admin/usage/asr` — ASR usage dashboard.
- `POST /api/v1/consent` — capture consent.

### 2.4 Frontend (new views)

- MFA setup page.
- Voice agent builder (Phase 4 expands this).
- Usage dashboard (calls/TTS/ASR per day per tenant).

### 2.5 Tests

- MFA enrollment + verification.
- Refresh token rotation.
- Idle + absolute timeout.
- Role-based access to new endpoints.
- Consent capture.

### 2.6 Owner approval gate

- Approve MFA requirement for privileged accounts.
- Approve new voice-specific roles.
- Approve PostgreSQL migration plan (Phase 8 separates RLS from Phase 1).
- Approve provider adapter selection (Twilio / Telnyx / FreeSWITCH).

## 3. Phase 2 — Cloud Telephony

### 3.1 Scope

- FreeSWITCH deployment (Docker container on a voice host with a public IP).
- SIP trunk registration (one international test number for development).
- Phone number management (CRUD; lifecycle: available → assigned → active → released).
- Inbound calls (PSTN → FreeSWITCH → IVR / AI receptionist / human agent).
- Outbound calls (agent workspace → sip.js → FreeSWITCH → PSTN).
- Call routing (IVR menus, ring groups, call queues, priority levels).
- IVR (JSON-tree menu definitions; `play` + `gather` + `route` nodes).
- Queue management (FIFO with priority levels; music on hold; estimated wait time).
- Call state tracking (state machine: idle → ringing → active → hold → transfer → park → closed).
- Call recording (with consent flow; MinIO storage).
- Voicemail (record on no-answer; transcribe via faster-whisper; notify via email + webhook).

### 3.2 Database changes

New Prisma models:

- `PhoneNumber` — number, tenant, provider, destination, status, business_hours.
- `Call` — callId, tenant, direction (inbound/outbound), from, to, agentId, status, startedAt, endedAt, durationSec, recordingUrl, consentId.
- `CallEvent` — per-state-transition audit trail.
- `IvrMenu` — JSON tree definition.
- `RingGroup` — collection of agents + dial strategy.
- `CallQueue` — FIFO queue + priority levels.
- `Voicemail` — audio URL, transcript, caller, duration.

### 3.3 API routes

- `GET/POST /api/v1/phone-numbers` — CRUD.
- `POST /api/v1/phone-numbers/{id}/assign` — assign to tenant.
- `POST /api/v1/phone-numbers/{id}/release` — release.
- `GET/POST /api/v1/calls` — call list + initiate outbound.
- `GET /api/v1/calls/{id}` — call detail.
- `GET /api/v1/calls/{id}/events` — state transitions.
- `GET /api/v1/calls/{id}/recording` — signed URL (5-min TTL).
- `GET/POST /api/v1/ivr-menus` — IVR CRUD.
- `GET/POST /api/v1/ring-groups` — ring group CRUD.
- `GET/POST /api/v1/call-queues` — queue CRUD.
- `GET/POST /api/v1/voicemails` — voicemail list + CRUD.
- `POST /api/v1/voicemails/{id}/transcribe` — trigger transcription.

### 3.4 Frontend

- Phone Number Manager (list, assign, release, business hours).
- Call History (filterable by date, direction, status, agent).
- Call Recordings (with consent indicator; signed URL access).
- IVR Builder (visual JSON tree editor).
- Voicemail inbox (with transcripts).

### 3.5 Tests

- FreeSWITCH connects to test SIP trunk.
- Inbound call → IVR → answer.
- Outbound call from sip.js → PSTN test number.
- Call state transitions persist correctly.
- Recording with consent flow works.
- Voicemail transcription runs as background job.

### 3.6 Owner approval gate

- Approve FreeSWITCH deployment (Docker, public IP, TLS).
- Approve test SIP trunk provider (Twilio or Telnyx).
- Approve one international test phone number subscription.
- Confirm BD PSTN connectivity is deferred to Phase 7.
- Approve recording consent flow (one-party or two-party).

## 4. Phase 3 — AI Voice Engine

### 4.1 Scope

- Run `BANGLA_VOICE_MODEL_EVALUATION.md` plan.
- Bangla TTS evaluation (Piper primary; Kokoro, CosyVoice evaluate; Tortoise batch).
- Multilingual TTS (English, Hindi, Arabic fallback).
- Streaming ASR (faster-whisper large-v3 with VAD).
- Voice generation studio (TTS with controls: speed, pitch, stability, pauses, pronunciation dictionary).
- Voice library (catalog of pre-built voices per language + gender + style).
- Pronunciation controls (custom dictionary for business/technical terms).
- Authorized voice cloning (`VoiceCloneAuthorization` model + identity verification + revocation).

### 4.2 Database changes

- `VoiceModel` — TTS model catalog (provider, modelId, language, gender, style, license).
- `VoiceCloneAuthorization` — voice owner consent (identity verification, purpose, expiry, revocation).
- `VoiceCloneUsageLog` — every use of a cloned voice (audit).
- `PronunciationDictionary` — per-tenant custom word mappings.
- `TtsJob` — batch TTS generation queue.

### 4.3 API routes

- `GET/POST /api/v1/voice-models` — voice model catalog.
- `POST /api/v1/tts` — generate speech (single utterance).
- `POST /api/v1/tts/stream` — streaming TTS (chunked).
- `POST /api/v1/tts/batch` — batch TTS job.
- `POST /api/v1/asr` — transcribe audio file.
- `POST /api/v1/asr/stream` — streaming ASR (WebSocket).
- `GET/POST /api/v1/voice-clone-authorizations` — voice clone consent CRUD.
- `POST /api/v1/voice-clone-authorizations/{id}/revoke` — revoke.
- `GET/POST /api/v1/pronunciation-dictionaries` — custom word mappings.

### 4.4 Frontend

- Voice Generation Studio (text input, voice selection, controls, preview, download).
- Voice Library (catalog + filters).
- Voice Clone Authorization form (consent capture + identity verification).
- Pronunciation Dictionary editor.

### 4.5 Tests

- Bangla TTS evaluation passes (per `BANGLA_VOICE_MODEL_EVALUATION.md`).
- Bangla ASR WER ≤ 15% on clean audio.
- Streaming TTS first-audio latency ≤ 400 ms.
- Streaming ASR partial latency ≤ 300 ms.
- Voice clone authorization flow (consent → verify → use → revoke → deleted).
- Pronunciation dictionary affects TTS output.

### 4.6 Owner approval gate

- Approve Bangla TTS model selection (based on evaluation results).
- Approve voice cloning policy (consent form, identity verification).
- Approve native-speaker reviewer panel.
- Confirm GPU worker availability (or accept CPU-only performance).

## 5. Phase 4 — AI Call Agents

### 5.1 Scope

- AI agent builder (visual editor for conversation flow + system prompt + tools).
- Conversation orchestration (extends existing `agent-loop.ts` with audio I/O).
- Knowledge retrieval (RAG over business docs — PDF, DOCX, TXT, CSV, website).
- Inbound AI receptionist (PSTN → FreeSWITCH → AI answers).
- Outbound campaigns (scheduled AI calls to lead lists).
- Human handoff (AI detects need → transfers to human agent with context).
- Call summaries (post-call: LLM generates structured summary + action items).

### 5.2 Database changes

- `OutboundCampaign` — campaign definition (script, contact list, schedule, retry rules).
- `CampaignCall` — per-call execution record.
- `CallSummary` — post-call structured summary (intent, sentiment, action items).
- `KnowledgeBase` — per-tenant document store.
- `KnowledgeChunk` — embedded chunks for RAG retrieval.

### 5.3 API routes

- `GET/POST /api/v1/ai-voice-agents` — agent CRUD (extends `VoiceAgent`).
- `POST /api/v1/ai-voice-agents/{id}/test` — test call with a mock customer.
- `GET/POST /api/v1/outbound-campaigns` — campaign CRUD.
- `POST /api/v1/outbound-campaigns/{id}/launch` — launch campaign (with DNC + consent check).
- `POST /api/v1/calls/{id}/handoff` — initiate human handoff.
- `GET /api/v1/calls/{id}/summary` — post-call summary.
- `GET/POST /api/v1/knowledge-bases` — knowledge base CRUD.
- `POST /api/v1/knowledge-bases/{id}/upload` — upload document.
- `POST /api/v1/knowledge-bases/{id}/reindex` — re-embed documents.

### 5.4 Frontend

- AI Voice Agent Builder (visual conversation flow + system prompt + tool selection).
- Outbound Campaign Manager (script editor, contact list upload, schedule, launch).
- Knowledge Base Manager (upload, index, search).
- Call Summary viewer (per-call transcript + summary + action items).

### 5.5 Tests

- AI agent answers inbound call + conducts conversation + updates CRM.
- Outbound campaign calls lead list + respects DNC + calling-hour restrictions.
- Human handoff transfers call + provides context to human agent.
- Post-call summary is generated + persisted + linked to correct tenant.
- Knowledge retrieval returns relevant chunks (with source references).
- Barge-in (interruption) cancels current TTS + starts new ASR cycle.

### 5.6 Owner approval gate

- Approve AI agent conversation policy (what AI can say without approval).
- Approve human handoff triggers (complaint, sensitive action, low confidence, customer request).
- Approve outbound campaign compliance (DNC, calling hours, frequency caps).

## 6. Phase 5 — Human Contact Center + CRM

### 6.1 Scope

- Agent workspace (login, availability status, incoming call notification, answer/reject, mute, hold, transfer, conference, dial pad, call notes, CRM sidebar).
- Supervisor dashboard (live agent monitoring, queue monitoring, call distribution, supervisor intervention, QA).
- CRM (existing Lead/Deal/Contact; add `Customer` 360 view with all interactions).
- Shared inbox (unified: voice, SMS, email, web chat).
- Recording management (list, playback, redact, delete per retention policy).
- Call analytics (sentiment, intent, topic, agent performance, conversation quality scoring).
- Kamailio SBC (deploy in front of FreeSWITCH for multi-tenant hardening).

### 6.2 Database changes

- `AgentStatus` — per-agent availability state.
- `SupervisorAction` — supervisor interventions (whisper, barge-in, takeover).
- `Customer` — unified customer 360 (extends Lead + Contact).
- `SharedInboxMessage` — unified inbox (channel-agnostic).
- `CallAnalytics` — per-call sentiment, intent, topic, quality score.

### 6.3 API routes

- `GET/POST /api/v1/agent-status` — agent availability.
- `GET/POST /api/v1/supervisor/actions` — supervisor interventions.
- `GET/POST /api/v1/customers` — customer 360 CRUD.
- `GET/POST /api/v1/shared-inbox` — unified inbox.
- `GET/POST /api/v1/call-analytics` — analytics.
- `POST /api/v1/calls/{id}/redact` — redact sensitive audio segment.

### 6.4 Frontend

- Human Agent Workspace (softphone + CRM sidebar + call notes).
- Supervisor Dashboard (live queue + agent status + intervention controls).
- Customer 360 view (all interactions timeline).
- Shared Inbox (channel tabs: voice, SMS, email, web chat).
- Call Analytics dashboard (sentiment + intent + agent performance).

### 6.5 Tests

- Agent logs in → status updates → receives inbound call.
- Supervisor monitors live call + whispers + barges in.
- Customer 360 aggregates all interactions.
- Shared inbox routes messages to correct agent.
- Call analytics computes sentiment + intent (with disclaimer: not definitive).

### 6.6 Owner approval gate

- Approve supervisor monitoring capabilities (consent requirements vary by jurisdiction).
- Approve call analytics disclaimer language ("automated estimates, not definitive facts about a person").
- Approve redaction workflow for sensitive audio segments.

## 7. Phase 6 — Billing + SaaS

### 7.1 Scope

- Subscription management (plans: free trial, starter, professional, enterprise).
- Usage metering (calls, AI minutes, TTS chars, ASR duration, recording storage, voice clone).
- Credit balance (prepaid credits; auto-recharge threshold).
- Provider cost tracking (per-provider actual cost; reconciliation against billing).
- Tenant billing (invoices, payment status, manual adjustments with audit).
- API + webhooks (developer platform: API keys, scoped permissions, rate limits, signatures, retries).

### 7.2 Database changes

- `SubscriptionPlan` — plan definitions.
- `TenantSubscription` — per-tenant subscription.
- `UsageCredit` — prepaid credit balance.
- `Invoice` — billing documents.
- `Payment` — payment records.
- `ApiKey` — already exists (extend with scopes + rate limits).
- `WebhookEndpoint` — already exists (extend with retry policy).

### 7.3 API routes

- `GET/POST /api/v1/billing/plans` — plan catalog.
- `POST /api/v1/billing/subscribe` — tenant subscribes to plan.
- `GET /api/v1/billing/usage` — usage breakdown.
- `GET /api/v1/billing/invoices` — invoice list.
- `POST /api/v1/billing/credits/purchase` — purchase credits.
- `GET/POST /api/v1/api-keys` — API key CRUD.
- `GET/POST /api/v1/webhooks` — webhook endpoint CRUD.

### 7.4 Frontend

- Billing + Usage dashboard (current plan, usage this period, credits, invoices).
- API Keys management (create, scope, revoke).
- Webhooks management (endpoint URL, secret, events, retry policy).

### 7.5 Tests

- Subscription lifecycle (trial → paid → upgrade → cancel).
- Usage metering accuracy (matches actual call records).
- Credit balance + auto-recharge.
- API key rate limiting + scope enforcement.
- Webhook signature verification + retry on failure.

### 7.6 Owner approval gate

- Approve plan pricing (free trial, paid tiers).
- Approve payment provider (Stripe / SSLCommerz for BD / manual invoicing).
- Approve cost reconciliation method (per-provider actuals vs billing).

## 8. Phase 7 — Production Validation

### 8.1 Scope

- Security audit (penetration test, code review, dependency audit).
- Load testing (sipp against FreeSWITCH; measure concurrent call capacity).
- Real telephony testing (BD PSTN if carrier sourced; international fallback).
- Bangla voice quality evaluation (per `BANGLA_VOICE_MODEL_EVALUATION.md`).
- Backup restoration (verify backups are restorable).
- Failure recovery (provider outage, network partition, server crash).
- Compliance verification (BTRC, data protection, recording consent).
- Production readiness review.

### 8.2 Acceptance criteria (per directive §14)

1. Real inbound calls work through an authorized telephony connection.
2. Real outbound calls work under approved calling rules.
3. Bangla TTS has passed native-speaker evaluation.
4. Bangla ASR has measured accuracy.
5. AI conversations support interruption and human handoff.
6. Human agents can receive and manage calls.
7. Call recordings are securely stored where authorized.
8. Transcripts and summaries are linked to the correct tenant.
9. CRM updates are verified.
10. Usage metering is accurate.
11. Billing calculations are tested.
12. Tenant isolation has passed security tests.
13. Provider outages are handled safely.
14. Monitoring and backup restoration are verified.
15. Documentation accurately reflects implemented functionality.

### 8.3 Owner approval gate (final)

- Approve production deployment.
- Approve BD carrier partnership (or accept international-only for initial launch).
- Approve monitoring + alerting setup.
- Approve backup + disaster recovery plan.

## 9. What this roadmap does NOT do

- Does not start any implementation work.
- Does not subscribe to any paid service.
- Does not provision any infrastructure.
- Does not commit to specific dates (estimates only).
- Does not override the directive's explicit approval gates.

## 10. STOP — waiting for owner approval

Per directive §15: "START WITH PHASE 0 ONLY."

Phase 0 is complete. The 6 audit documents are:

1. `docs/voice-contact-center/AUDIT.md` — Repository + infrastructure audit.
2. `docs/voice-contact-center/TELEPHONY_ARCHITECTURE.md` — FreeSWITCH-first architecture proposal.
3. `docs/voice-contact-center/BANGLA_VOICE_MODEL_EVALUATION.md` — Bangla TTS + ASR evaluation plan.
4. `docs/voice-contact-center/PROVIDER_COMPATIBILITY.md` — Provider matrix + selection recommendations.
5. `docs/voice-contact-center/SECURITY_AND_COMPLIANCE.md` — Security + compliance checklist.
6. `docs/voice-contact-center/IMPLEMENTATION_ROADMAP.md` — This document.

The next action is for the owner to review this document set and respond with one of:

- **APPROVE Phase 1** — proceed with platform foundation.
- **APPROVE WITH CHANGES** — list sections to revise; the audit will be re-issued.
- **REJECT** — list deal-breakers; the directive will be re-scoped.

No code will be written, no infrastructure provisioned, no service subscribed, no model downloaded until one of these responses is received.
