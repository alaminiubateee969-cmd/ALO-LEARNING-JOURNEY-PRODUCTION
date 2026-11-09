# Provider Compatibility Matrix

**Document:** `docs/voice-contact-center/PROVIDER_COMPATIBILITY.md`
**Date:** 2026-11-05
**Status:** Research summary — no provider has been subscribed or paid for.
**Approval gate:** Owner must approve provider selection before any subscription.

---

## 1. Telephony providers

### 1.1 Cloud telephony (replaceable adapters)

| Provider | Inbound | Outbound | Recording | WebRTC | BD numbers | Cost (USD) | License | Recommended |
|---|---|---|---|---|---|---|---|---|
| **Twilio** | ✓ | ✓ | ✓ | ✓ | No | $1.15/mo per number + $0.0085/min US | ToS (paid) | Phase 2 dev |
| **Telnyx** | ✓ | ✓ | ✓ | ✓ | No | $0.50/mo per number + $0.003/min US | ToS (paid) | Phase 2 alternate |
| **SignalWire** | ✓ | ✓ | ✓ | ✓ | No | $0.50/mo per number + per-min | ToS (paid) | FreeSWITCH-native; Phase 5 |
| **Plivo** | ✓ | ✓ | ✓ | partial | No | $0.80/mo per number + $0.008/min | ToS (paid) | Not recommended |
| **Vonage** | ✓ | ✓ | ✓ | ✓ | No | similar to Twilio | ToS (paid) | Not recommended |

**Important:** None of the cloud providers can provision `+880` (Bangladesh) numbers directly. For BD PSTN connectivity, the owner must partner with a BTRC-licensed carrier.

### 1.2 Bangladesh PSTN connectivity

| Option | How | Pros | Cons | Recommended |
|---|---|---|---|---|
| **BTRC-licensed SIP trunk carrier** | Partner with BD carrier that provides SIP trunking + BD numbers | Real `+880` numbers; legal | Requires BTRC license; paperwork takes weeks | Phase 7 (production) |
| **International numbers for testing** | Use Twilio US/UK numbers | Quick; cheap | Cannot receive calls from BD PSTN | Phase 2-6 (development) |
| **FreeSWITCH + local FXO gateway** | Connect FreeSWITCH to a BD analog landline via FXO gateway (Sangoma, Grandstream) | Real BD PSTN; one-time hardware cost | One line per gateway; limited concurrency | Phase 7 (small-scale production) |
| **WebRTC-only** | Skip PSTN entirely; customers call via web browser | No carrier needed | Customers must use web client | Not suitable for general callers |

### 1.3 Open-source telephony engines

| Engine | License | Best for | Multi-tenant | Recommended |
|---|---|---|---|---|
| **FreeSWITCH** | MPL 1.1 | Carrier-grade multi-tenant PBX | ✓ (designed for it) | Phase 2 default |
| **Asterisk** | GPL-2.0 | SMB PBX | Limited | Not recommended |
| **Kamailio** | GPL-2.0 | SBC, SIP routing at scale | ✓ | Phase 5 SBC |
| **OpenSIPS** | GPL-2.0 | Similar to Kamailio | ✓ | Alternate to Kamailio |

### 1.4 WebRTC client libraries

| Library | License | Maintained | Browser support | Recommended |
|---|---|---|---|---|
| **sip.js** | MIT | ✓ | All modern browsers | Phase 2 default |
| **Verto communicator** | MPL 1.1 | FreeSWITCH team | All modern browsers | Reference UI only |
| **JainSip** | BSD-2 | Java | Server-side only | Not for browser |
| **JsSIP** | MIT | ✓ | All modern browsers | Alternate to sip.js |

## 2. AI voice providers (TTS)

### 2.1 Local (self-hosted)

| Provider | License | Bangla support | Voice cloning | VRAM | CPU-only | Streaming | Recommended |
|---|---|---|---|---|---|---|---|
| **Piper** (`bn_BD-google-medium`) | MIT | Yes (16 voices) | No | none | ✓ | chunked | Phase 3 default |
| **Kokoro** | Apache 2.0 | Limited | No | none | ✓ | ✓ | Phase 3 evaluate |
| **CosyVoice** | Apache 2.0 | Multilingual | Yes | 6 GB | slow | ✓ | Phase 3 evaluate |
| **Tortoise** | Apache 2.0 | Multilingual | Yes (best commercial-friendly) | 4 GB | very slow | no | Phase 3 batch only |
| **StyleTTS 2** | MIT | English only | No | optional | ✓ | ✓ | English fallback only |
| **Bark** | MIT | Generative | No | 4 GB | slow | no | Creative only |
| Coqui XTTS v2 | CPML (non-commercial) | Yes (17 langs) | Yes (best) | 4-6 GB | slow | ✓ | **REJECTED** — non-commercial |
| F5-TTS | CC-BY-NC-4.0 | Multilingual | Yes | 4-6 GB | slow | ✓ | **REJECTED** — non-commercial |

### 2.2 Cloud (free-tier)

| Provider | License | Bangla support | Cost | Recommended |
|---|---|---|---|---|
| **Z.AI TTS** | Free tier | Yes | $0 (free quota) | Already in production; baseline |
| **Google Cloud TTS** | Paid | Yes (bn-BD) | $4/1M chars | Not recommended (paid) |
| **ElevenLabs** | Paid | Yes (limited) | $5+ per month | Not recommended (paid) |
| **Azure TTS** | Paid | Yes (bn-BD) | $16/1M chars | Not recommended (paid) |
| **Amazon Polly** | Paid | Yes (bn-IN) | $16/1M chars | Not recommended (paid) |

Per directive §2: "Avoid mandatory paid AI APIs." All paid cloud TTS providers are optional fallbacks; the production default is Piper (local, MIT-licensed).

## 3. AI speech-to-text providers (ASR)

### 3.1 Local (self-hosted)

| Provider | License | Bangla support | Code-switching | VRAM | Streaming | Recommended |
|---|---|---|---|---|---|---|
| **faster-whisper large-v3** | MIT | Yes (bn) | Yes | 4 GB | ✓ | Phase 3 default |
| **WhisperX** | BSD-4-clause | Yes | Yes | 4 GB | ✓ | Phase 3 diarization |
| **whisper.cpp large-v3** | MIT | Yes | Yes | none (CPU) | ✓ | CPU fallback |
| **NVIDIA NeMo Parakeet** | Apache 2.0 | Limited | Limited | 8 GB | ✓ | Evaluate |
| Meta SeamlessM4T | CC-BY-NC-4.0 | Yes | Yes | 8 GB | ✓ | **REJECTED** — non-commercial |

### 3.2 Cloud (free-tier)

| Provider | License | Bangla support | Cost | Recommended |
|---|---|---|---|---|
| **Z.AI ASR** | Free tier | Yes | $0 (free quota) | Already in production; baseline |
| **Google Cloud Speech** | Paid | Yes | $0.024/15s | Not recommended (paid) |
| **Azure Speech** | Paid | Yes | $1/audio hour | Not recommended (paid) |
| **Deepgram** | Paid | Yes | $0.0043/min | Not recommended (paid) |

## 4. SMS providers (already integrated)

The existing `sms-provider-chain.ts` already implements the adapter pattern. The same providers offer Voice API:

| Provider | SMS (existing) | Voice (new) | Cost (voice) | Recommended |
|---|---|---|---|---|
| **Twilio** | ✓ | ✓ Programmable Voice | $0.0085/min US + $1.15/mo per number | Phase 2 dev |
| **Telnyx** | ✓ | ✓ Call Control API | $0.003/min US + $0.50/mo per number | Phase 2 alternate |
| **httpSMS** | ✓ | ✗ (SMS-only) | n/a | SMS-only |
| **sms.domovina.ai** | ✓ | ✗ (SMS-only) | n/a | SMS-only |
| **FreeSWITCH** | n/a | ✓ (direct SIP) | $0 (self-hosted hardware) | Phase 2 default (no cloud) |

## 5. LLM providers (already integrated — for conversation orchestration)

The existing `ai-chain.ts` has 9 active free providers. The voice/contact-center product uses the same chain for the AI voice agent's conversation orchestration:

| Provider | Cost | Latency | Recommended for voice |
|---|---|---|---|
| Z.AI (GLM-4.6) | $0 | 554 ms measured | Primary |
| Groq (Llama 3.3 70B) | $0 | ~300 ms | Fastest; primary if Z.AI rate-limited |
| Gemini (1.5 Flash) | $0 | ~500 ms | Fallback |
| OpenRouter (free models) | $0 | varies | Fallback |
| Ollama (local) | $0 | depends on hardware | Local fallback |
| Rule-based | $0 | <50 ms | Last resort |

## 6. Database + storage providers

| Component | License | Recommended |
|---|---|---|
| PostgreSQL 16 | PostgreSQL License (BSD-like) | Phase 1 (replaces SQLite) |
| Redis 7 | RSAL/SSPL (dual-licensed) | Phase 1 (queue + presence) |
| MinIO (S3-compatible) | AGPL-3.0 | Phase 1 (call recordings, voicemail) |
| DragonflyDB (Redis alternative) | BSL 1.1 | Alternate to Redis (faster, less restrictive license) |

## 7. WebRTC infrastructure

| Component | Purpose | License | Recommended |
|---|---|---|---|
| **coturn** | STUN/TURN server for NAT traversal | BSD-3 | Phase 2 (WebRTC requires it for callers behind NAT) |
| **mediasoup** | SFU for video conferencing | MIT | Phase 5 (conference calling) |
| **Janus** | SFU + gateway | GPL-3.0 | Alternate to mediasoup (GPL constrains) |

## 8. CRM integrations (existing — already in MarketingOS)

The existing CRM (Lead, Deal, Contact, Ticket, Company models in Prisma) is the system of record. The voice/contact-center product integrates by:

- Every call creates a `Call` row linked to `Lead` or `Contact` via `leadId`/`contactId`.
- AI receptionist can use existing `crm_lookup_lead`, `crm_create_lead`, `crm_update_lead_status` tools (already registered in `agent-tools.ts`).
- New tools added in Phase 4: `call_transfer`, `call_hold`, `call_park`, `voicemail_leave`, `recording_start_with_consent`.

## 9. WhatsApp integration

Per directive §3 Module I: "WhatsApp must use supported official integration methods and comply with Meta policies."

**However:** The master directive (the earlier one) explicitly said "WhatsApp must be REMOVED — AI agents handle all communication."

**Conflict:** This voice/contact-center directive mentions WhatsApp as a channel; the earlier directive said remove it.

**Resolution:** This audit treats the two as in conflict. The voice/contact-center product registers a `whatsapp` channel adapter stub but marks it `DISABLED — pending owner decision`. Implementation work on WhatsApp does not proceed until the owner resolves the conflict.

## 10. Recommended production stack (Phase 7)

| Layer | Provider | Why | Cost |
|---|---|---|---|
| Telephony engine | FreeSWITCH (self-hosted) | MPL, multi-tenant, WebRTC | $0 (hardware) |
| SBC | Kamailio (self-hosted) | Hardening, fraud detection | $0 |
| PSTN connectivity | BTRC-licensed BD carrier (TBD) | Real BD numbers | Carrier-dependent |
| WebRTC softphone | sip.js (MIT) | Browser-native, MIT | $0 |
| STUN/TURN | coturn (BSD-3) | NAT traversal | $0 |
| TTS | Piper `bn_BD-google-medium` | MIT, CPU, BD Bangla | $0 |
| ASR | faster-whisper large-v3 | MIT, GPU | $0 |
| LLM | Z.AI + Groq chain | Free tier | $0 |
| Database | PostgreSQL 16 | BSD-like | $0 |
| Queue | Redis 7 | RSAL | $0 |
| Object storage | MinIO | AGPL (self-hosted) | $0 |
| Monitoring | Prometheus + Grafana | Apache 2.0 | $0 |

**Total monthly cost: $0** for software. The only paid items are: BD carrier fees (regulated), optional GPU worker rental (if needed for ASR), and Twilio/Telnyx if international numbers are used for development.

## 11. What this document does NOT do

- Does not subscribe to any paid service.
- Does not download any AI model.
- Does not provision any phone number.
- Does not partner with any BD carrier.
- Does not commit to a specific provider — all selections are recommendations pending owner approval.

The next document is `SECURITY_AND_COMPLIANCE.md`.
