# Security and Compliance Checklist

**Document:** `docs/voice-contact-center/SECURITY_AND_COMPLIANCE.md`
**Date:** 2026-11-05
**Status:** Research summary — no security control has been activated, disabled, or modified.
**Approval gate:** Owner must approve security + compliance posture before production deployment.

---

## 1. Existing security controls (verified in MarketingOS)

These controls are already implemented in the current MarketingOS codebase and will be reused by the voice/contact-center product:

| Control | Implementation | Status |
|---|---|---|
| Encryption at rest (secrets) | AES-256-GCM envelope encryption in `src/lib/vault.ts` | LIVE |
| Encryption in transit | HTTPS-only (Caddy auto-TLS); HSTS headers | LIVE |
| Authentication | JWT HS256 (7-day expiry) + bcrypt 12 rounds | LIVE |
| Authorization | Role hierarchy (12 roles); `hasPermission()` check | LIVE |
| Multi-tenancy (application layer) | `companyId` on every tenant-scoped model | LIVE |
| CSRF protection | SameSite=Strict cookies; Origin header check | LIVE |
| Webhook signatures | HMAC-SHA256 with timestamp | LIVE |
| SSRF protection | `src/lib/ssrf.ts` blocks private IPs + cloud metadata | LIVE |
| CSV formula-injection protection | `=`, `+`, `-`, `@` prefixed with single quote | LIVE |
| PII data minimization (LLM) | `src/lib/pii-filter.ts` scrubs 8 PII patterns before cloud LLM calls | LIVE |
| Circuit breaker + retry | `src/lib/circuit-breaker.ts` — 5 fails → 60s cooldown | LIVE |
| Audit log | `emitEvent()` persists every action to `AuditLog` + `Activity` | LIVE |
| Rate limiting | Per-IP + per-user counters (Redis-backed, Phase 1 work) | NOT_YET |
| Multi-tenancy (database layer) | PostgreSQL RLS (Phase 8 work) | NOT_YET |
| MFA for privileged accounts | Not implemented | NOT_YET |

## 2. Voice/contact-center-specific security requirements

### 2.1 Per directive §10

The directive explicitly requires:

- Encryption in transit
- Encryption at rest
- Role-based access
- Tenant isolation
- Secret management
- Secure authentication
- MFA for privileged accounts
- Session management
- Audit logging
- Recording access controls
- Data retention
- Customer deletion workflows
- Consent records
- Data export
- Secure webhook verification
- Rate limiting
- Abuse detection

### 2.2 New controls required for voice/contact-center

| Control | Implementation plan | Phase |
|---|---|---|
| SIP TLS + SRTP | FreeSWITCH `sip_tls` profile + `srtp` mod; cert via Caddy/Let's Encrypt | Phase 2 |
| WebRTC DTLS-SRTP | Browser-native; FreeSWITCH `mod_verto` enforces | Phase 2 |
| Recording access controls | Signed URLs (5-min TTL); no public URLs; access logged | Phase 5 |
| Recording consent capture | IVR prompt: "this call may be recorded"; record DTMF response | Phase 2 |
| Data retention policy | Configurable per-tenant: recordings 30/60/90 days, transcripts 1 year | Phase 6 |
| Customer deletion workflow | GDPR-style: soft-delete → hard-delete after 30 days | Phase 6 |
| Consent records | `Consent` model: who, what, when, how (cookie/IVR/web form) | Phase 1 |
| Data export | `/api/v1/tenants/{id}/export` returns JSON + audio ZIP | Phase 6 |
| Rate limiting | Per-IP + per-user + per-tenant on all /api/v1/* routes | Phase 1 |
| Abuse detection | Anomaly detection: spike in call volume, unusual outbound patterns | Phase 5 |
| MFA for privileged accounts | TOTP-based; required for super_admin + company_owner | Phase 1 |
| Session management | Refresh token rotation; idle timeout 30 min; absolute 8 hours | Phase 1 |
| Webhook signature verification | HMAC-SHA256 (already implemented); add replay-protection timestamp | Phase 6 |

## 3. Bangladesh-specific compliance research

The directive (§10) is explicit:

> Bangladesh-specific telecom, privacy, and recording requirements must be researched and verified before production use. Do not assume a foreign provider's permissions apply in Bangladesh.

### 3.1 Bangladesh Telecommunication Regulatory Commission (BTRC)

The BTRC regulates all telecommunications in Bangladesh. Key areas relevant to this product:

| Area | BTRC requirement | Status | Action needed |
|---|---|---|---|
| Carrier license | Operating a telephony service requires a BTRC license (ILDTS, NTTN, etc.) | NOT_VERIFIED | Owner must confirm legal basis for operating a cloud telephony platform in BD |
| Number provisioning | BD phone numbers (`+880`) can only be provisioned by BTRC-licensed carriers | NOT_VERIFIED | Owner must partner with BTRC-licensed carrier |
| Interconnect | SIP trunk interconnect to BD PSTN requires carrier agreement | NOT_VERIFIED | Owner must source BD SIP trunk |
| Call recording | BTRC requires at least one-party consent for recording | PARTIAL — one-party consent is the minimum | Owner must verify if two-party consent is required for specific use cases |
| Caller ID | Caller ID must be accurate; spoofing is prohibited | NOT_APPLICABLE | System enforces real caller ID via SIP trunk |
| DNC (Do Not Call) | BTRC maintains a DNC registry for telemarketing | NOT_VERIFIED | Owner must register; system must suppress DNC numbers in outbound campaigns |
| International calling | BTRC regulates international calling routes | NOT_VERIFIED | Owner must verify route legality |

### 3.2 Bangladesh Data Protection Act (draft 2023-2025)

Bangladesh's data protection law is in draft form (as of late 2025). Key areas likely relevant:

| Area | Likely requirement | Status | Action needed |
|---|---|---|---|
| Consent for personal data | Explicit consent required for processing personal data | NOT_VERIFIED | System captures consent in `Consent` model |
| Data localization | Some categories of personal data may need to stay in BD | NOT_VERIFIED | Owner must verify; if required, host DB + storage in BD |
| Right to access | Data subjects can request their data | NOT_VERIFIED | `/api/v1/tenants/{id}/export` endpoint (Phase 6) |
| Right to deletion | Data subjects can request deletion | NOT_VERIFIED | Customer deletion workflow (Phase 6) |
| Data breach notification | Breach must be reported to regulator + affected individuals | NOT_VERIFIED | Incident response plan required |
| Cross-border transfer | Restrictions on transferring personal data outside BD | NOT_VERIFIED | If cloud providers are used outside BD, owner must verify legality |

### 3.3 Bangladesh Penal Code + ICT Act

| Area | Requirement | Action |
|---|---|---|
| Wiretapping | Intercepting calls without court order is illegal | System records only with consent; never intercepts |
| Impersonation | Impersonating another person (including voice cloning without consent) is illegal | Voice cloning requires `VoiceCloneAuthorization` with documented consent |
| Fraud | Using AI to defraud is illegal | Bounded agent loop + approval gate prevents unauthorized business actions |

### 3.4 Consent for recording

The directive (§10) is explicit:

> Before enabling call recording, voice cloning, automated outbound calling, or international number provisioning, verify the applicable legal and provider requirements.

**Default:** Recording is OFF.

**Per-call consent flow:**

1. Caller connects (inbound) or callee answers (outbound).
2. IVR plays: "This call may be recorded for quality and training purposes. Press 1 to consent, 2 to decline."
3. If caller presses 1 → recording starts; `Consent` row persisted with `kind='call_recording'`, `caller_response='dtmf_1'`, `callId`.
4. If caller presses 2 → no recording; call proceeds normally.
5. If caller does not respond within 5 seconds → recording does NOT start (fail-safe).

**One-party consent states** (where the AI agent is the "one party"): The system records because the AI agent (operating on behalf of the business) is a party to the call. This is the minimum legal basis. Owner must verify this is sufficient for BD law.

**Two-party consent** (all parties must consent): If BD requires this, the IVR consent flow is mandatory for every call. The system supports both modes via a per-tenant `recording_consent_mode` setting.

### 3.5 Voice cloning consent

Per directive §3 Module C: "Support voice cloning only when the voice owner has provided explicit, verifiable consent."

**Requirements:**

1. Voice owner signs `VoiceCloneAuthorization` form (Phase 3 work).
2. Identity verification (government ID + selfie video) where appropriate.
3. Consent record persisted: who, what voice, for what purpose, expiry, revocation URL.
4. Clone access permissions: which tenants/agents can use the cloned voice.
5. Usage audit log: every use of the cloned voice is recorded.
6. Revocation: voice owner can revoke at any time; cloned voice is deleted within 24 hours.
7. Provenance metadata: every audio file generated with the cloned voice carries a `cloned_from` watermark.
8. Abuse detection: spike in usage triggers review.

**Forbidden:**

- Cloning a third party's voice without authorization.
- Impersonation intended to deceive listeners.
- Cloning a public figure's voice without their explicit consent.
- Using a cloned voice for fraudulent purposes.

## 4. Telephony provider compliance

### 4.1 Twilio

| Requirement | Twilio status | Action |
|---|---|---|
| Acceptable Use Policy | Must be reviewed | Owner signs Twilio AUP |
| Caller ID | Twilio enforces real caller ID | System uses Twilio-provided numbers only |
| DNC suppression | Twilio offers DNC scrub API | System integrates DNC suppression for outbound |
| Recording disclosure | Twilio requires "beep" tone at start of recording | System plays beep + IVR consent |
| International calling | Twilio supports but each country has rules | Owner verifies BD rules |

### 4.2 Telnyx

| Requirement | Telnyx status | Action |
|---|---|---|
| AUP | Must be reviewed | Owner signs Telnyx AUP |
| Caller ID | Enforced | Same as Twilio |
| DNC | Telnyx offers scrub | Same as Twilio |
| Recording | API-based start/stop | Same consent flow |

### 4.3 BD carrier (TBD)

Compliance requirements depend on the specific carrier. Owner must obtain:

- Carrier interconnect agreement
- Number porting authorization (if applicable)
- Recording disclosure requirements
- DNC registry integration
- International calling permissions

## 5. Multi-tenant isolation

Per directive §4:

> One tenant must never be able to access another tenant's calls, recordings, transcripts, contacts, or credentials.

### 5.1 Application layer (already in place)

- Every tenant-scoped Prisma query includes `where: { companyId: ctx.companyId }`.
- `getSessionContext()` (in `src/lib/v1-middleware.ts`) resolves `companyId` from the JWT and enforces it on every request.
- Cross-tenant access requires `super_admin` role (audited).

### 5.2 Database layer (Phase 8 work)

- PostgreSQL Row Level Security (RLS) enforces `companyId` at the DB level.
- Each request sets `SET app.company_id = ?` so even a SQL injection cannot cross tenants.
- Phase 8 migrates from SQLite to PostgreSQL + RLS.

### 5.3 Storage layer

- MinIO bucket policy: each tenant has a prefix `tenants/{companyId}/`; IAM policy restricts access to that prefix only.
- Signed URLs (5-min TTL) for individual recording access; no public URLs.

### 5.4 Network layer

- FreeSWITCH multi-tenant profile: each tenant has a separate SIP profile with its own context.
- WebRTC clients authenticate per-tenant; cannot dial across tenants.

### 5.5 Worker isolation

- Background workers (transcription, TTS, recording processing) pull from tenant-scoped queues.
- A worker processing tenant A's recording cannot access tenant B's storage.

## 6. Data retention + deletion

### 6.1 Default retention

| Data type | Default retention | Configurable |
|---|---|---|
| Call metadata (Call table) | 2 years | Yes |
| Call recordings (audio) | 30 days | Yes (30/60/90/365) |
| Call transcripts | 1 year | Yes |
| Voicemail audio | 30 days | Yes |
| Voicemail transcripts | 1 year | Yes |
| Voice clone training audio | Until revocation | No (required for legal defense) |
| Audit logs | 7 years | No (compliance) |

### 6.2 Deletion workflow

1. **Soft delete:** mark `deleted_at` timestamp; data is hidden from UI but still in DB.
2. **Hard delete:** after 30 days, hard-delete from DB + storage.
3. **Audit trail:** deletion event is logged with who, what, when.
4. **Customer-initiated:** `/api/v1/tenants/{id}/customers/{customerId}/delete` initiates the workflow.

### 6.3 Right to be forgotten

If a customer requests deletion of all their data:

1. All `Call`, `Recording`, `Transcript`, `Voicemail`, `Consent` rows for that customer are soft-deleted.
2. Audio files in MinIO are marked for deletion (within 24 hours).
3. The `Customer` row itself is soft-deleted.
4. A `DeletionRequest` row is persisted for audit (the request itself is retained for 7 years per compliance).

## 7. Audit logging

Per directive §10: "Audit logging" — already implemented via `emitEvent()`.

### 7.1 What is logged

Every privileged operation:

- User login / logout / failed login
- Phone number provisioning / release
- Call state transitions (start, hold, transfer, end)
- Recording start / stop / access
- AI agent configuration change
- Voice clone authorization grant / revoke
- Tenant configuration change
- API key creation / revocation
- Webhook URL change
- Outbound campaign launch
- Manual billing adjustment

### 7.2 What is NOT logged

- Call audio content (only metadata: duration, direction, parties)
- Transcript content (only that a transcript was generated, with hash for integrity)
- Customer PII in logs (PII scrubber runs before logging)

### 7.3 Audit log retention

7 years (per typical financial + telecom compliance requirements). Owner must verify BD-specific retention requirements.

## 8. Incident response

### 8.1 Incident categories

| Severity | Definition | Response time | Notification |
|---|---|---|---|
| Critical | Data breach, cross-tenant access, fraudulent calls | 1 hour | Owner + affected tenants + BTRC (if required) |
| High | Provider outage, recording access by unauthorized internal user | 4 hours | Owner + affected tenants |
| Medium | Single-tenant outage, rate-limit bypass | 24 hours | Owner |
| Low | UI bug, non-critical feature failure | 7 days | Owner |

### 8.2 Breach notification

If personal data is breached:

1. Within 24 hours: notify the owner.
2. Within 72 hours: notify affected individuals.
3. Within 7 days: notify BTRC (if telecom data is involved) + the data protection authority (if BD DPA is in force by then).

## 9. Risk register (security-focused)

| ID | Risk | Mitigation | Phase |
|---|---|---|---|
| S1 | SIP trunk credential leak | Vault encryption (already); rotate on suspicion; ACL carrier IPs in firewall | Phase 2 |
| S2 | Call recording accessed by unauthorized user | Signed URLs (5-min TTL); access logged; super_admin override audited | Phase 5 |
| S3 | Cross-tenant call access | Application-layer `companyId` (already); PostgreSQL RLS (Phase 8) | Phase 8 |
| S4 | Voice clone abused to impersonate | `VoiceCloneAuthorization` model; identity verification; revocation; audit log | Phase 3 |
| S5 | AI agent says something legally binding | Bounded loop + approval gate (already); "AI-generated" provenance tag | Already in place |
| S6 | Outbound campaign classified as spam | DNC suppression; opt-out handling; calling-hour restrictions; frequency caps | Phase 6 |
| S7 | Recording without consent | IVR consent flow (fail-safe: no response = no recording) | Phase 2 |
| S8 | JWT theft | Refresh token rotation; idle timeout 30 min; absolute 8 hours | Phase 1 |
| S9 | Privileged account takeover | MFA TOTP required for super_admin + company_owner | Phase 1 |
| S10 | API abuse | Rate limiting (per-IP + per-user + per-tenant); abuse detection | Phase 1 |

## 10. Owner approval gate

Before production deployment (Phase 7), the owner must:

1. Confirm BD-specific compliance requirements are met (BTRC license, data protection, recording consent).
2. Approve the data retention policy (defaults above or tenant-specific overrides).
3. Approve the incident response plan.
4. Confirm the voice cloning consent form (legal review).
5. Confirm the DNC suppression mechanism is in place before any outbound campaign.
6. Confirm MFA is enforced for all privileged accounts.
7. Confirm PostgreSQL RLS is active (Phase 8).
8. Confirm audit log retention is set to 7 years.
9. Confirm the breach notification workflow is documented.

**This document does NOT activate any security control, change any retention policy, or commit to any specific compliance interpretation.**

The next document is `IMPLEMENTATION_ROADMAP.md`.
