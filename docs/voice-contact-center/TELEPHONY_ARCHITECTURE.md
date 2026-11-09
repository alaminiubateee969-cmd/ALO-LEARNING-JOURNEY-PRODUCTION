# Telephony Architecture Proposal

**Document:** `docs/voice-contact-center/TELEPHONY_ARCHITECTURE.md`
**Date:** 2026-11-05
**Status:** Proposal — no infrastructure has been provisioned.
**Approval gate:** Owner must approve before any SIP configuration or production number subscription.

---

## 1. Reference architecture

```
                    ┌──────────────────────────────────────────────────────────┐
                    │                       INTERNET                            │
                    │   (SIP trunk provider / PSTN carrier / WebRTC clients)   │
                    └──────────────────────────┬───────────────────────────────┘
                                               │ SIP/RTP (TLS+SRTP)
                                               ▼
                              ┌────────────────────────────────┐
                              │  Kamailio SBC (Phase 5)        │
                              │  - TLS termination              │
                              │  - SIP normalization            │
                              │  - Topology hiding              │
                              │  - DoS/DDoS protection          │
                              │  - Fraud detection              │
                              │  - Carrier ACLs                 │
                              └───────────────┬────────────────┘
                                              │ Clean SIP (internal LAN)
                                              ▼
                              ┌────────────────────────────────┐
                              │  FreeSWITCH (Phase 2)           │
                              │  - SIP B2BUA + media server     │
                              │  - IVR / voicemail / queues     │
                              │  - WebRTC gateway               │
                              │  - Call recording (when consent) │
                              │  - Confbridge / 3-way / parking │
                              └──┬─────────────────┬────────────┘
                                 │ ESL (Event Socket)│ WebSocket (Verto)
                                 │                   │
                  ┌──────────────▼──────┐  ┌─────────▼──────────────┐
                  │  Voice App Server   │  │  Agent Workspace (browser)
                  │  (Next.js API)      │  │  - sip.js / Verto.js softphone
                  │  - Call orchestration│  │  - Inbound call notification
                  │  - AI agent loop     │  │  - Hold / mute / transfer
                  │  - CRM sidebar       │  │  - Call notes
                  │  - Webhook signing   │  └────────────────────────┘
                  └──────────┬───────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
      ┌──────────┐    ┌────────────┐    ┌──────────────┐
      │ Piper TTS│    │ faster-     │    │ PostgreSQL + │
      │ (Bangla) │    │ whisper     │    │ Redis (queue)│
      │ CPU      │    │ (Bangla ASR)│    │ MinIO (audio)│
      └──────────┘    └────────────┘    └──────────────┘
```

## 2. Phase 2 (single-tenant development) — simplified

For Phase 2, deploy FreeSWITCH directly without Kamailio. This is acceptable for a single-tenant test environment with a single SIP trunk and known carrier IP. Kamailio is added in Phase 5 when multi-tenant scale and multiple carriers require SBC hardening.

```
SIP trunk  →  FreeSWITCH  →  Next.js Voice App
                  ↓
              WebRTC agent workspace (sip.js)
```

## 3. Component selection — rationale

### 3.1 FreeSWITCH (recommended) vs Asterisk

| Dimension | FreeSWITCH | Asterisk |
|---|---|---|
| License | MPL 1.1 (commercial-friendly) | GPL-2.0 (constrains derivative distribution) |
| Architecture | Modular; signaling and media on separate threads | B2BUA, largely monolithic |
| Concurrency | Higher (carrier-grade) | Lower (SMB PBX) |
| WebRTC | Native first-class | Retrofitted |
| Multi-tenant PBX | Designed for it | Limited scale |
| Conferencing | First-class (mod_conference) | Limited |
| Scripting | Lua / JavaScript / ESL (Event Socket Library) | AGI / AMI / ARI |
| Community | Smaller but skews service-provider | Larger |

**Verdict:** FreeSWITCH for the carrier-grade multi-tenant voice platform. Asterisk would be acceptable for a single-tenant small office PBX but does not scale to the directive's "Multi-tenant SaaS Architecture" requirement (§4).

### 3.2 Kamailio as SBC

Both Asterisk and FreeSWITCH are PBX engines, not Session Border Controllers. Connecting them directly to the public internet exposes the call-processing engine to SIP floods, registration scanning, malformed SIP, fraud attempts. Kamailio is a stateless SIP signaling proxy that handles:

- TLS termination (so the PBX doesn't manage per-call certificates)
- SIP header normalization between incompatible carriers
- Topology hiding (don't expose internal IPs to carriers)
- DoS/DDoS protection at the SIP layer
- Real-time fraud scoring

Kamailio is added in Phase 5 when multiple carriers + multiple tenants make it worth the operational complexity.

### 3.3 WebRTC for the agent workspace

Module G requires a real-time human-agent interface. Two paths:

1. **sip.js** in the browser — talks SIP over WebSocket to FreeSWITCH's `mod_verto`. Works in all modern browsers. Requires the agent's machine to have a working microphone + speaker.
2. **Verto communicator** — FreeSWITCH's reference WebRTC client. Provides a turnkey softphone UI but is not customizable for the directive's branded agent workspace.

**Recommendation:** sip.js + custom React UI for the agent workspace. Verto can be used as a development reference.

### 3.4 Cloud telephony provider adapters

The directive requires "external telephony providers replaceable through adapters" (§2). The existing `sms-provider-chain.ts` already implements this pattern for SMS. The same pattern applies for voice:

- **Twilio Voice Adapter** — uses Twilio Programmable Voice for outbound + inbound PSTN. Already partially integrated via `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` (currently used for SMS).
- **Telnyx Voice Adapter** — uses Telnyx Call Control API. Already integrated for SMS via `TELNYX_*` env vars.
- **FreeSWITCH Adapter** — uses ESL (Event Socket Library) for direct control of the local FreeSWITCH instance. This is the lowest-cost path for production BD numbers (when a BD SIP trunk is sourced).
- **Simulation Adapter** — for dev/staging. Records the call attempt in the DB without making a real call. Returns `simulated: true` (consistent with the existing SMS simulation behavior).

## 4. Real-time voice pipeline

Per directive §8, the audio path is:

```
Customer Phone / WebRTC client
    ↓ (audio stream, typically 8 kHz PCM A-law for PSTN; Opus for WebRTC)
Telephony Gateway (FreeSWITCH)
    ↓ (audio frames via ESL)
Voice Activity Detection (VAD) — detects speech start/end
    ↓ (audio chunks)
Streaming ASR (faster-whisper with VAD) — partial transcripts as user speaks
    ↓ (text)
Conversation Orchestrator (agent-loop.ts, already implemented)
    ↓ (LLM call)
LLM / Business Tools (chainChat with 9 free providers + tool allowlist)
    ↓ (text response)
Streaming TTS (Piper with chunked synthesis) — start speaking before full text ready
    ↓ (audio chunks)
FreeSWITCH → customer
```

### 4.1 Latency budget

Per directive §8: "Measure end-to-end latency under real test conditions."

| Stage | Budget | Measurement method |
|---|---|---|
| RTP capture → VAD | 50 ms | FreeSWITCH ESL timestamp + Python `time.monotonic()` |
| VAD → ASR partial | 300 ms | faster-whisper streaming; measured by ASR worker |
| ASR → LLM | 600 ms | chainChat durationMs (already recorded in AgentExecutionLog) |
| LLM → TTS first chunk | 400 ms | Piper chunked synthesis; measured by TTS worker |
| TTS → RTP playback | 100 ms | FreeSWITCH playback timestamp |
| **End-to-end (perceived)** | **~1.5 s** | The 1.5 s budget is the upper bound for acceptable conversational latency; sub-1 s is "natural" |

### 4.2 Interruption handling (barge-in)

When the customer speaks while the AI is mid-sentence:

1. VAD detects speech onset.
2. FreeSWITCH stops TTS playback immediately (`uuid_broadcast` with `stop`).
3. The orchestrator discards the rest of the queued LLM response.
4. A new ASR cycle starts.

This requires the orchestrator to maintain a "current generation id" that can be cancelled. The existing `agent-loop.ts` does not yet support cancellation — Phase 4 work.

### 4.3 Echo control + noise handling

- FreeSWITCH's `mod_echo` cancels acoustic echo on the carrier side.
- WebRTC clients use the browser's built-in AEC (Acoustic Echo Cancellation).
- For ASR input, `rnnoise` (Mozilla, MIT) reduces background noise before passing audio to faster-whisper.

## 5. Call state machine

```
                  ┌─────────┐
                  │  IDLE   │
                  └────┬────┘
                       │ incoming INVITE (inbound) OR originate (outbound)
                       ▼
                  ┌─────────┐
        ┌────────>│ RINGING │<────────┐
        │         └────┬────┘         │
        │              │ answer       │
        │              ▼              │
        │         ┌─────────┐          │
        │         │ ACTIVE  │          │
        │         └────┬────┘          │
        │   hold        │              │
        │              ▼              │
        │         ┌─────────┐          │
        │         │  HOLD   │          │
        │         └────┬────┘          │
        │              │ resume        │
        │              ▼              │
        │         ┌─────────┐          │
        └─park────│ TRANSFER│          │
                  │ PARK    │          │
                  └────┬────┘          │
                       │ retrieve      │
                       ▼               │
                  ┌─────────┐          │
                  │ ACTIVE  │──────────┘
                  └────┬────┘
                       │ hangup
                       ▼
                  ┌─────────┐
                  │ CLOSED  │ ───> transcription, summary, CRM update, recording (if consent)
                  └─────────┘
```

Every state transition is persisted as a `CallEvent` row in the new `Call` model (Phase 1 schema work). `emitEvent()` fires `call.started`, `call.held`, `call.transferred`, `call.ended` — handled by the existing event bus.

## 6. Phone number management

Per directive §3 Module A: "Local and international virtual numbers where legally available."

- **Phone number lifecycle:** `available` → `assigned` (to a tenant) → `active` → `released`.
- Each number has a tenant scope, a destination (IVR / agent / AI receptionist), and a `business_hours` policy.
- Number provisioning goes through a provider adapter (Twilio / Telnyx / FreeSWITCH SIP registration).
- The directive is explicit: "Real PSTN calling requires authorized telecommunications connectivity." Numbers are not auto-provisioned — admin must explicitly request each number via the Super Admin UI.

## 7. IVR + queue management

- **IVR menus** are stored as JSON trees in a new `IvrMenu` model: each node is a `play` (TTS prompt) or `gather` (collect DTMF) or `route` (transfer to extension/queue/AI agent).
- **Ring groups** are collections of agents; the dialplan tries each in turn (hunt) or all at once (ring-all).
- **Call queues** are FIFO buffers with priority levels (priority callers jump to the front).
- **Music on hold** is served by FreeSWITCH's `mod_tone_stream` or a configurable audio file.

## 8. Recording + voicemail storage

- Recordings are written to MinIO (S3-compatible) under a tenant-scoped prefix: `tenants/{companyId}/calls/{callId}.wav`.
- Access requires a signed URL (5-minute TTL) — never a public URL.
- Voicemail is stored the same way; transcription via faster-whisper runs as a background job.
- **Recording consent:** per directive §10, recording is OFF by default. The IVR announces "this call may be recorded" and only starts recording after the caller's response (DTMF or spoken "yes").

## 9. Phase 2 deliverable checklist

When Phase 2 ships (after owner approval), the following must be true:

- [ ] FreeSWITCH runs as a Docker container on the voice host.
- [ ] One test SIP trunk is registered (carrier IP whitelisted).
- [ ] One test phone number is provisioned (international, not BD).
- [ ] Inbound call → IVR → AI receptionist handoff works end-to-end.
- [ ] Outbound call from agent workspace via sip.js works.
- [ ] Call recording (with consent) writes to MinIO.
- [ ] Call state transitions persist in PostgreSQL.
- [ ] Every call fires `call.started` + `call.ended` events.
- [ ] Audit log records every privileged operation.

Phase 2 does NOT ship production telephony. It ships a working test environment.

## 10. Acceptance criteria — Phase 2

| Criterion | Status before Phase 2 | Expected after Phase 2 |
|---|---|---|
| Real inbound call works through authorized telephony | NOT_MET | MET (with international test number) |
| Real outbound call works under approved calling rules | NOT_MET | MET (with international test number) |
| Call recording securely stored where authorized | NOT_MET | MET (with consent flow) |
| Call state transitions persist | NOT_MET | MET |
| Tenant isolation enforced | MET (application layer) | MET (application layer; PostgreSQL RLS is Phase 8) |

Phase 7 (production validation) adds the BD SIP trunk + load testing + native-speaker Bangla voice evaluation.
