# ALO Learning — Testing Report

> **Document type:** Test plan and CI gates (Phase 12 deliverable, drafted alongside Phase 2)
> **Date:** 2026-11-05
> **Author:** Z.ai
> **Companion documents:** `baseline-audit.md`, `repository-audit.md`, `architecture.md`, `integration-matrix.md`, `security-review.md`, `database-design.md`, `deployment-guide.md`, `production-readiness.md`.

---

## Purpose

This document satisfies **Section 18 (TESTING REQUIREMENTS)** of the ALO Learning Master Engineering & Integration Directive. It specifies the 20 test categories (A-T) mandated by the directive, plus the test framework, CI gates, mocked-provider strategy, and sandbox-account strategy.

The directive's hard rules for testing:
1. Use mocked providers for CI.
2. Use sandbox accounts for integration tests.
3. **Never publish test content to real social accounts.**
4. Verify existing student and admin functionality after every significant integration.

---

## 1. Test framework

### 1.1 Stack

| Layer | Tool | Purpose |
|---|---|---|
| Unit tests | Node.js built-in `node:test` (existing pattern) + vitest (new for ALO Learning) | Pure-function tests, adapter contract tests |
| Integration tests | vitest + supertest (HTTP against Next.js routes) | API route tests with mocked providers |
| End-to-end tests | Playwright | Browser-driven UI tests (Phase 12+) |
| Static checks | Existing `tests/*.test.mjs` (release-claims, prisma-dev-guard, migration-verifier) | Source-code claims (preserved) |
| Mocked providers | MSW (Mock Service Worker) for HTTP; `spawnSync` mocks for CLI | CI does not call real external services |
| Coverage | c8 (Node.js native) | Target: 80% line coverage for `src/lib/alo-learning/*` |

### 1.2 Directory structure

```
tests/
├── alo-learning/
│   ├── unit/                       # pure-function tests
│   │   ├── auth.test.mjs
│   │   ├── csrf.test.mjs
│   │   ├── upload.test.mjs
│   │   ├── ssrf.test.mjs
│   │   └── rate-limit.test.mjs
│   ├── integration/                # API route tests with mocked providers
│   │   ├── voice-generate.test.mjs
│   │   ├── voice-fallback.test.mjs
│   │   ├── voice-consent.test.mjs
│   │   ├── sms-send.test.mjs
│   │   ├── sms-webhook.test.mjs
│   │   ├── telephony-call.test.mjs
│   │   ├── content-project.test.mjs
│   │   ├── fact-check.test.mjs
│   │   ├── character-consent.test.mjs
│   │   ├── child-safety.test.mjs
│   │   ├── video-pipeline.test.mjs
│   │   ├── video-render.test.mjs
│   │   ├── youtube-import.test.mjs
│   │   ├── comfyui-local.test.mjs
│   │   ├── comfyui-fallback.test.mjs
│   │   ├── subtitle-transcribe.test.mjs
│   │   ├── subtitle-quality.test.mjs
│   │   ├── publishing-oauth.test.mjs
│   │   ├── publishing-approval.test.mjs
│   │   ├── publishing-error.test.mjs
│   │   ├── agent-run.test.mjs
│   │   ├── watch-skill.test.mjs
│   │   ├── cli-anything.test.mjs
│   │   ├── queue.test.mjs
│   │   └── storage-access.test.mjs
│   ├── security/
│   │   ├── shell-injection.test.mjs
│   │   ├── security-regression.test.mjs
│   │   └── existing-alo-regression.test.mjs
│   └── e2e/                        # Playwright (Phase 12+)
│       ├── voice-studio.spec.ts
│       ├── cinematic-studio.spec.ts
│       └── social-publishing.spec.ts
└── *.test.mjs                      # existing static-claim tests (preserved)
```

### 1.3 CI gates

Every PR must pass:

1. `npm run lint` (ESLint strict rules re-enabled — baseline OPS-2).
2. `npm run typecheck` (with `noImplicitAny: true`).
3. `npm run build` (clean build).
4. `npm test` (all existing tests + new ALO Learning unit tests).
5. `npm run test:integration` (new — ALO Learning integration tests with mocked providers).
6. `npm run verify:migrations` (existing static check).
7. `npm audit --audit-level=high` (no unresolved high findings — baseline OPS-1).
8. Secrets scan (gitleaks/trufflehog).

**Merge blocked if any gate fails.** No exceptions for "I'll fix it later".

---

## 2. The 20 test categories (Section 18 A-T)

### A. Repository adapter health

**Tests:** `tests/alo-learning/integration/{voice-generate,sms-send,comfyui-local,subtitle-transcribe}.test.mjs`
**Mocked provider strategy:** MSW intercepts HTTP calls to voicebox/domovina/ComfyUI/VideoCaptioner sidecars; returns canned responses.
**Acceptance criteria:** Every adapter's `health()` method returns `{status: "connected", version: <string>}` when the mock is up; `{status: "disconnected"}` when the mock is down.
**Coverage:** All 7 sidecars (voicebox, domovina, httpSMS self-hosted, VideoCaptioner, Remotion, CogVideo, CLI-Anything).

### B. Authentication

**Tests:** `tests/alo-learning/security/auth.test.mjs`
**Mocked provider strategy:** Mock next-auth token; test with valid token, expired token, missing token, malformed token.
**Acceptance criteria:** Every `/api/alo-learning/*` route returns 401 without a valid session token. Routes that require admin return 403 with a non-admin token (when multi-user is added).

### C. Authorization

**Tests:** `tests/alo-learning/security/authorization.test.mjs`
**Mocked provider strategy:** Mock next-auth token with `email: "admin@example.com"` (valid) and `email: "other@example.com"` (invalid for single-admin).
**Acceptance criteria:** Every privileged route calls `requireOwner()`; non-owner token returns 403.

### D. Tenant isolation

**Tests:** `tests/alo-learning/security/tenant-isolation.test.mjs`
**Mocked provider strategy:** Seed test DB with two `Company` rows; send requests with `x-alo-company-id: company-a` and verify no `company-b` data leaks.
**Acceptance criteria:** Every tenant-scoped query filters by `companyId` from the `x-alo-company-id` header. Cross-tenant data access returns empty results (not an error — silent filtering).

### E. SMS send/receive

**Tests:** `tests/alo-learning/integration/{sms-send,sms-webhook}.test.mjs`
**Mocked provider strategy:** MSW intercepts httpSMS API calls; returns `{messageId: "mock-123", status: "sent"}`. Inbound webhook simulated with valid JWT signature.
**Sandbox account strategy:** httpSMS hosted SaaS has a sandbox mode; use it for integration tests against the real API (rate-limited).
**Acceptance criteria:**
- Send SMS via httpSMS hosted; message persisted with delivery status.
- Inbound webhook with valid JWT signature accepted; invalid signature returns 401.
- **Never expose OTPs in logs** — verified by grep on test output.

### F. Webhook validation

**Tests:** `tests/alo-learning/integration/{sms-webhook,publishing-oauth}.test.mjs`
**Mocked provider strategy:** Generate valid and invalid JWT signatures; test Facebook/YouTube/TikTok webhook signature algorithms.
**Acceptance criteria:** Every inbound webhook is signature-verified before processing. Invalid signatures return 401; valid signatures process the payload.

### G. Voice generation

**Tests:** `tests/alo-learning/integration/voice-generate.test.mjs`
**Mocked provider strategy:** MSW intercepts voicebox FastAPI calls; returns canned MP3 audio.
**Sandbox account strategy:** voicebox can be run locally in a Docker container for integration tests.
**Acceptance criteria:** A POST to `/api/alo-learning/voice/generate` with `engine: kokoro` returns a synthesized MP3 within 5 seconds (mocked). Voice generation record persisted with `syntheticMedia: true`.

### H. Audio playback

**Tests:** `tests/alo-learning/integration/audio-playback.test.mjs`
**Mocked provider strategy:** Generate a real MP3 via ffmpeg; verify playback via ffprobe.
**Acceptance criteria:** Generated MP3 is valid (ffprobe parses it); signed URL expires after 1 hour.

### I. Media upload

**Tests:** `tests/alo-learning/integration/media-upload.test.mjs`
**Mocked provider strategy:** Upload a real JPEG/MP3/MP4 with correct MIME + magic bytes; upload a JPEG with PNG magic bytes (mismatch — should fail); upload a file with a path-traversal filename.
**Acceptance criteria:**
- Valid uploads succeed; file saved with server-generated cuid filename.
- MIME/signature mismatch returns 400.
- Path-traversal filename is sanitized (original filename stored for display only).

### J. Video generation

**Tests:** `tests/alo-learning/integration/{video-pipeline,video-render}.test.mjs`
**Mocked provider strategy:** Mock ComfyUI workflow execution (returns canned image); mock voicebox TTS (returns canned MP3); real ffmpeg for final render.
**Acceptance criteria:**
- All 10 video modes produce a valid MP4.
- 14-step pipeline executes end-to-end with approval gates at steps 4, 6, 8, 13, 14, and publishing.

### K. Subtitle generation

**Tests:** `tests/alo-learning/integration/{subtitle-transcribe,subtitle-quality}.test.mjs`
**Mocked provider strategy:** MSW intercepts VideoCaptioner sidecar; returns canned SRT.
**Sandbox account strategy:** VideoCaptioner can be run locally with Whisper-small model.
**Acceptance criteria:**
- 5-minute Bangla video transcribed within 10 minutes on CPU (real Whisper) or instantly (mocked).
- SRT and VTT exports valid.
- Whisper-local engine used (never Bcut/Jianying cloud).

### L. Render completion

**Tests:** `tests/alo-learning/integration/video-render.test.mjs`
**Mocked provider strategy:** Mock the slow render with a 2-second delay; verify BullMQ job lifecycle.
**Acceptance criteria:**
- Render job transitions: queued → running → succeeded.
- Output MP4 valid (ffprobe parses).
- `executionTimeMs` and `resourceUsage` recorded.

### M. Character permissions

**Tests:** `tests/alo-learning/integration/{character-consent,child-safety}.test.mjs`
**Mocked provider strategy:** Seed test DB with characters of each type and permission status.
**Acceptance criteria:**
- Create character without consent returns 403.
- With consent succeeds.
- Revoke consent deletes derived assets (or marks them revoked).

### N. Consent revocation

**Tests:** `tests/alo-learning/integration/{voice-consent,character-consent}.test.mjs`
**Mocked provider strategy:** Seed consent records; call revoke endpoint; verify derived assets marked.
**Acceptance criteria:**
- Revoking a voice profile prevents new generations; derived assets marked revoked in `MediaAuditLog`.
- Revoking a character consent deletes derived character media; existing references return 410 Gone.

### O. Child-safety review

**Tests:** `tests/alo-learning/integration/child-safety.test.mjs`
**Mocked provider strategy:** Seed a character with `isMinor: true`; submit a generation job.
**Acceptance criteria:**
- Every job touching `isMinor: true` media enters `awaiting_approval` status.
- Face-blur default applied to minor-related images unless `consentScope` explicitly includes `"full_face_public"`.
- **Never publish child-identifiable content without documented authorization and approval** — verified by attempting to publish without consent (returns 403).

### P. Publishing authorization

**Tests:** `tests/alo-learning/integration/{publishing-oauth,publishing-approval}.test.mjs`
**Mocked provider strategy:** Mock Facebook/YouTube/TikTok OAuth flow; mock publishing API calls.
**Sandbox account strategy:** Use platform sandbox/test accounts (Facebook test app, YouTube Data API test project, TikTok sandbox).
**Acceptance criteria:**
- OAuth flow connects platform accounts.
- Every publishing job requires admin approval (default mode).
- Auto-publish only for allowlisted categories.
- **Never publish test content to real social accounts** — verified by env var `ALO_PUBLISHING_TARGET=sandbox` (must be set in CI).

### Q. Publishing error handling

**Tests:** `tests/alo-learning/integration/publishing-error.test.mjs`
**Mocked provider strategy:** Mock platform API returning 500; mock token expiry.
**Acceptance criteria:**
- Failed publishes retried per BullMQ retry policy (3 attempts, exponential backoff).
- Permanent failures logged with `errorDetails` in `PublishingRecord`.
- Token refresh on 401; if refresh fails, account marked `isConnected: false`.

### R. Job retry

**Tests:** `tests/alo-learning/integration/{queue,video-render}.test.mjs`
**Mocked provider strategy:** Mock a job that fails twice then succeeds.
**Acceptance criteria:**
- BullMQ retries failed jobs per policy.
- `retryCount` incremented.
- After max attempts, job marked `failed` with `errorDetails`.

### S. Storage access

**Tests:** `tests/alo-learning/integration/storage-access.test.mjs`
**Mocked provider strategy:** Generate signed URLs; attempt access with expired token.
**Acceptance criteria:**
- Signed media URLs expire after 1 hour.
- Unsigned requests return 401.
- Tokens are single-use (second access returns 401).
- Encrypted assets decrypt correctly with `BACKUP_ENCRYPTION_KEY`.

### T. Production build

**Tests:** `npm run build` (clean); `npm run typecheck` (clean); `npm run lint` (clean).
**Acceptance criteria:**
- `npm run build` produces `.next/standalone/server.js` without errors.
- `npm run typecheck` passes with `noImplicitAny: true`.
- `npm run lint` passes with strict ESLint rules (re-enabled per baseline OPS-2).

---

## 3. Existing ALO regression tests

**Mandatory after every significant integration:** run `tests/alo-learning/security/existing-alo-regression.test.mjs` which verifies:

1. All 81 existing API routes still respond (HTTP 200/401/403 as appropriate).
2. All 42 existing Prisma models still query correctly.
3. All ~50 existing UI views still render (Playwright smoke test).
4. Existing admin login + OTP flow works.
5. Existing CRM lead create/read works.
6. Existing photo-to-video studio produces a valid MP4.
7. Existing `/api/backups` produces a valid encrypted snapshot.
8. Existing `/api/health` returns healthy.

**This test must pass before any ALO Learning phase is merged.** A failure means the existing ALO platform was broken — block the merge.

---

## 4. Mocked provider strategy (CI)

CI does NOT call real external services. Every external call is mocked via MSW or `spawnSync` mocks:

```typescript
// tests/alo-learning/mocks/voicebox.ts
import { http, HttpResponse } from "msw";

export const voiceboxMocks = [
  http.post("http://127.0.0.1:8000/generate", () => {
    return HttpResponse.json({
      audioPath: "/mocks/audio/sample.mp3",
      durationMs: 5000,
      engineUsed: "kokoro",
    });
  }),
  http.get("http://127.0.0.1:8000/health", () => {
    return HttpResponse.json({
      status: "connected",
      version: "1.2.0",
      enginesLoaded: ["kokoro", "piper"],
    });
  }),
];
```

CI environment:
- `ALO_VOICEBOX_ENABLED=true` (mocked)
- `ALO_VOICEBOX_BASE_URL=http://127.0.0.1:8000` (MSW intercepts)
- All other sidecars similarly mocked.

---

## 5. Sandbox account strategy (integration tests)

For tests that need to verify real API behavior (not just contract), use sandbox accounts:

| Service | Sandbox | Rate limit |
|---|---|---|
| httpSMS hosted | Sandbox mode (Ndole Studio provides) | 10 SMS/day |
| Facebook | Facebook Test App | Unlimited (test users only) |
| YouTube | YouTube Data API test project | 10,000 units/day |
| TikTok | TikTok sandbox | Limited |
| voicebox | Local Docker container | Unlimited |
| VideoCaptioner | Local Python process | Unlimited |
| ComfyUI | Local Docker container | Unlimited |

**Integration tests run nightly via GitHub Actions** (not on every PR — too slow). PRs run only mocked tests.

---

## 6. Test gates per phase

| Phase | Tests required to pass before merge |
|---|---|
| -1 | shell-injection.test.mjs; existing-alo-regression.test.mjs |
| 0 | backup-restore.test.mjs |
| 2 | auth, csrf, upload, ssrf, rate-limit, queue |
| 3 | voice-generate, voice-fallback, voice-consent |
| 4 | sms-send, sms-webhook, telephony-call |
| 5 | content-project, fact-check |
| 6 | character-consent, child-safety |
| 7 | video-pipeline, video-render, youtube-import |
| 8 | comfyui-local, comfyui-fallback |
| 9 | subtitle-transcribe, subtitle-quality |
| 10 | publishing-oauth, publishing-approval, publishing-error |
| 11 | agent-run, watch-skill, cli-anything |
| 12 | security-regression (all 20 categories), existing-alo-regression |
| 13 | Production smoke tests (read-only) |

---

## 7. Coverage targets

| Module | Line coverage target |
|---|---|
| `src/lib/alo-learning/auth.ts` | 100% |
| `src/lib/alo-learning/csrf.ts` | 100% |
| `src/lib/alo-learning/upload.ts` | 95% |
| `src/lib/alo-learning/ssrf.ts` | 95% |
| `src/lib/alo-learning/rate-limit.ts` | 90% |
| `src/lib/alo-learning/queue.ts` | 85% |
| `src/lib/alo-learning/adapters/*` | 85% |
| `src/lib/alo-learning/services/*` | 80% |
| `src/app/api/alo-learning/*` | 85% |

Coverage enforced via c8; merge blocked if below target.

---

## 8. Test data management

- **Test DB:** disposable MySQL instance (Docker) seeded from `prisma/seed-alo-learning.ts`.
- **No production data in tests.** Test data is synthetic; no real student/admin records.
- **Test isolation:** each test file uses a fresh DB transaction that rolls back after the test.
- **Fixtures:** `tests/alo-learning/fixtures/` contains sample scripts, sample images, sample videos for testing.

---

## 9. Never publish test content to real social accounts

**Hard rule:** `ALO_PUBLISHING_TARGET=sandbox` env var must be set in CI. The Social Publishing Engine checks this var before every publish call:

```typescript
// src/lib/alo-learning/services/social/publish.ts
if (process.env.ALO_PUBLISHING_TARGET !== "sandbox" && process.env.NODE_ENV === "test") {
  throw new Error("Refusing to publish to real social accounts in test environment");
}
```

Additionally, the integration test mock intercepts all Facebook/YouTube/TikTok API calls — even if the env var is misconfigured, the mock prevents real calls.

---

## 10. Verify existing student and admin functionality

**Mandatory after every significant integration:** the `existing-alo-regression.test.mjs` suite (Section 3) must pass. This verifies that the existing ALO platform — including student and admin modules — continues to work after ALO Learning changes.

The directive says: **"Verify existing student and admin functionality after every significant integration."** This is enforced by the CI gate: every PR runs the regression suite; merge is blocked on failure.

---

## Cross-references

- `baseline-audit.md` Section C — existing 81 API routes (regression coverage).
- `repository-audit.md` — per-repo security tests.
- `architecture.md` Section 2 — the 12 services under test.
- `integration-matrix.md` — adapter contract tests.
- `security-review.md` Section 6 — security regression test plan.
- `database-design.md` Section 4 — migration verifier tests, restore test.
- `deployment-guide.md` Section 1.3 — CI gates per phase.
- `production-readiness.md` — Definition of Done criterion #10 (security regression), #11 (existing ALO regression), #12 (production build).

---

## Final note

This testing report specifies 20 test categories (A-T) covering every operation mandated by Section 18 of the directive. Every test uses mocked providers for CI; sandbox accounts for nightly integration tests; never publishes test content to real social accounts; verifies existing student and admin functionality after every significant integration.

The directive's FINAL RULE is reaffirmed: **use mocked providers for CI. Use sandbox accounts for integration tests. Never publish test content to real social accounts. Verify existing student and admin functionality after every significant integration.**
