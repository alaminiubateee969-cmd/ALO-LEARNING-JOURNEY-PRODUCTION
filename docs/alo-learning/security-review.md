# ALO Learning — Security Review

> **Document type:** Security architecture and risk register (Phase 12 deliverable, drafted alongside Phase 2)
> **Date:** 2026-11-05
> **Author:** Z.ai
> **Companion documents:** `baseline-audit.md`, `repository-audit.md`, `architecture.md`, `integration-matrix.md`, `database-design.md`, `deployment-guide.md`, `testing-report.md`, `production-readiness.md`.

---

## Purpose

This document satisfies **Section 16 (SECURITY & PRIVACY)** of the ALO Learning Master Engineering & Integration Directive. It specifies the mandatory security controls for ALO Learning, the child-privacy first-class requirements, and carries forward the S-1 to S-13 findings from `baseline-audit.md` with their concrete fixes.

The directive's child-privacy mandate is unequivocal: **"Child privacy is a first-class requirement. Do not publish child-identifiable content without documented authorization and approval."** This document operationalizes that mandate.

---

## 1. Mandatory security controls (Section 16)

### 1.1 Server-side authorization

**Mandatory:** every privileged API route under `/api/alo-learning/*` MUST call `requireOwner()` as its first statement. This is the A-1 finding from the baseline audit expanded into a hard requirement for all new ALO Learning routes.

```typescript
// src/lib/alo-learning/auth.ts
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function requireOwner(req: NextRequest): Promise<{ email: string } | NextResponse> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.email) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store", "WWW-Authenticate": "Bearer" } }
    );
  }
  return { email: token.email as string };
}

// Example usage in every /api/alo-learning/* route:
export async function POST(req: NextRequest) {
  const auth = await requireOwner(req);
  if (auth instanceof NextResponse) return auth;
  // ... handler body
}
```

The middleware boundary (existing `src/middleware.ts`) is preserved as the first line of defense; `requireOwner()` is the second line of defense (defence-in-depth).

### 1.2 RBAC

The existing ALO platform is **single-administrator by design** — there is no RBAC, no multi-user model. ALO Learning does NOT introduce a parallel user/tenant table. The existing `AdminOtpChallenge` (admin auth) and `Company` (scope selector) tables are reused.

If/when ALO adds multi-user RBAC, that work is a separate initiative, not part of ALO Learning. The ALO Learning database design (`database-design.md`) uses `ownerAdminEmail` as the ownership field on every new model — this is the single admin's email, not a multi-user concept.

### 1.3 Tenant isolation

The `x-alo-company-id` header used by the company switcher is a scope selector, not identity-bound tenant authorization. ALO Learning inherits this semantics: every query that touches tenant-scoped data MUST filter by `companyId` derived from the header, but the admin identity is still the single admin.

**Mandatory:** every Prisma query in ALO Learning services that touches tenant-scoped tables MUST include `where: { companyId: <derived from x-alo-company-id header> }`. This is enforced via a shared `tenantScope()` helper:

```typescript
// src/lib/alo-learning/tenant.ts
export function tenantScope(req: NextRequest) {
  const companyId = req.headers.get("x-alo-company-id");
  if (!companyId) throw new Error("Missing x-alo-company-id header");
  return { companyId };
}

// Example:
const leads = await prisma.lead.findMany({ where: { ...tenantScope(req), stage: "new" } });
```

### 1.4 Secure file upload

**Mandatory MIME and file signature validation.** Every file upload to ALO Learning endpoints MUST be validated by both the MIME type from the `Content-Type` header AND the file's magic bytes:

```typescript
// src/lib/alo-learning/upload.ts
const ALLOWED_MIME: Record<string, Buffer> = {
  "image/jpeg": Buffer.from([0xFF, 0xD8, 0xFF]),
  "image/png": Buffer.from([0x89, 0x50, 0x4E, 0x47]),
  "audio/mpeg": Buffer.from([0x49, 0x44, 0x33]),  // ID3
  "audio/wav": Buffer.from([0x52, 0x49, 0x46, 0x46]),  // RIFF
  "video/mp4": Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]),  // ftyp
};

export async function validateUpload(file: File): Promise<{ safePath: string }> {
  const mime = file.type;
  const expectedMagic = ALLOWED_MIME[mime];
  if (!expectedMagic) throw new Error(`Unsupported MIME type: ${mime}`);

  const buf = Buffer.from(await file.arrayBuffer());
  if (!buf.subarray(0, expectedMagic.length).equals(expectedMagic)) {
    throw new Error(`MIME type ${mime} does not match file signature`);
  }
  // ... save to ./storage/uploads/<cuid>.<ext>
}
```

**Malware scanning where supported.** If ClamAV is available on the VPS, every upload MUST be scanned before being moved to persistent storage. The scan is async via BullMQ; the upload remains in `./storage/quarantine/` until the scan passes.

### 1.5 Path traversal protection

**Mandatory:** never use user-supplied filenames in filesystem paths. Every upload is saved with a server-generated cuid as the filename; the original filename is stored in the database for display only.

```typescript
// WRONG — vulnerable to path traversal
const path = `./storage/uploads/${req.body.filename}`;

// CORRECT — server-generated filename
import { createId } from "@paralleldrive/cuid2";
const safeFilename = `${createId()}.${ext}`;
const path = `./storage/uploads/${safeFilename}`;
```

The S-1 Critical finding (shell injection via ffprobe) is the most severe instance of this anti-pattern. The fix is to never interpolate user input into shell strings — see Section 3.1.

### 1.6 Signed media URLs

**Mandatory:** every media asset under `/avatar-videos/`, `/avatar-audio/`, `/avatar-scenes/`, `/avatar-thumbs/`, `/avatars/`, and the new ALO Learning paths (`/alo-learning/voice/`, `/alo-learning/video/`, `/alo-learning/animation/`) is served only against a signed media token.

The existing `src/lib/media-token.ts` is extended to cover ALO Learning paths:

```typescript
// src/lib/media-token.ts (extended)
export const PROTECTED_MEDIA_PREFIXES = [
  "/avatar-videos/", "/avatar-audio/", "/avatar-scenes/", "/avatar-thumbs/", "/avatars/",
  // ALO Learning additions:
  "/alo-learning/voice/", "/alo-learning/video/", "/alo-learning/animation/",
  "/alo-learning/characters/", "/alo-learning/subtitles/",
];
```

Tokens are signed with `NEXTAUTH_SECRET`, expire after 1 hour, and are single-use (tracked in `MediaAuditLog`).

### 1.7 Encryption at rest

**Mandatory:** every asset in `./storage/` is encrypted with AES-256-GCM using `BACKUP_ENCRYPTION_KEY` (≥32 chars, production-only env var). The existing `/api/backups` route already uses this pattern; ALO Learning extends it to all media assets.

```typescript
// src/lib/alo-learning/storage.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

export async function encryptAsset(plaintext: Buffer, key: string): Promise<Buffer> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "base64"), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]);
}
```

The `BACKUP_ENCRYPTION_KEY` is rotated annually; the rotation process is documented in `deployment-guide.md`.

### 1.8 Encrypted provider credentials

**Mandatory:** every external provider credential (httpSMS API key, voicebox cloud key, RunningHub API key, Facebook/YouTube/TikTok OAuth tokens) is stored in `.env` (never committed) and read via `process.env` at call time.

For OAuth tokens that must be persisted (social publishing accounts), the `PublishingAccount.accessToken` and `PublishingAccount.refreshToken` Prisma fields are encrypted with AES-256-GCM before storage:

```typescript
// src/lib/alo-learning/services/social/oauth.ts
const encrypted = await encryptToken(account.accessToken, process.env.BACKUP_ENCRYPTION_KEY);
await prisma.publishingAccount.create({ data: { ...account, accessToken: encrypted } });
```

### 1.9 Webhook signature verification

**Mandatory:** every inbound webhook MUST be signature-verified before processing.

- httpSMS webhooks are JWT-signed (existing pattern, preserved).
- sms.domovina.ai webhooks are JWT-signed (per repo README).
- Social platform webhooks (Facebook, YouTube, TikTok) are signed with platform-specific algorithms — verified in `src/lib/alo-learning/services/social/webhooks.ts`.

```typescript
// Example: httpSMS webhook verification (existing pattern)
import jwt from "jsonwebtoken";

export async function verifyHttpSmsWebhook(req: NextRequest): Promise<boolean> {
  const signature = req.headers.get("signature");
  if (!signature) return false;
  try {
    jwt.verify(signature, process.env.HTTPSMS_API_KEY!);
    return true;
  } catch {
    return false;
  }
}
```

### 1.10 Rate limiting

**Mandatory:** move from in-memory rate limiting (baseline S-6) to Redis-backed rate limiting. The existing `src/lib/rate-limit.ts` is replaced with a BullMQ-backed limiter:

```typescript
// src/lib/alo-learning/rate-limit.ts
import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const bucket = `${key}:${Math.floor(Date.now() / windowMs)}`;
  const count = await redis.incr(bucket);
  if (count === 1) await redis.expire(bucket, Math.ceil(windowMs / 1000));
  return count <= limit;
}
```

Every ALO Learning endpoint that accepts user input (voice generation, video render, SMS send, social publish) MUST call `rateLimit()` with appropriate limits.

### 1.11 Audit logging

**Mandatory:** every privileged operation is logged to the existing `AuditLog` Prisma model. The existing model is extended with ALO Learning-specific fields:

```prisma
model AuditLog {
  // ... existing fields
  aloLearningService String? // which of the 12 services
  aloLearningJobId    String? // job ID if async
  syntheticMedia      Boolean? @default(false) // synthetic-media disclosure flag
}
```

Every adapter call logs: caller admin email, target service, input hash (SHA-256 of the request body), output hash (SHA-256 of the response body), duration, success/failure.

### 1.12 CSRF protection

**Mandatory:** every POST/PATCH/DELETE handler under `/api/alo-learning/*` MUST call `isSameOriginRequest()` (existing helper in `src/lib/same-origin.ts`, currently used by only one route — baseline S-3).

```typescript
// src/lib/alo-learning/csrf.ts
import { isSameOriginRequest } from "@/lib/same-origin";
import { NextRequest, NextResponse } from "next/server";

export async function csrfCheck(req: NextRequest): Promise<NextResponse | null> {
  if (!await isSameOriginRequest(req)) {
    return NextResponse.json(
      { error: "cross-origin request blocked" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }
  return null;
}

// Example usage:
export async function POST(req: NextRequest) {
  const csrf = await csrfCheck(req);
  if (csrf) return csrf;
  const auth = await requireOwner(req);
  if (auth instanceof NextResponse) return auth;
  // ... handler body
}
```

Additionally, session cookies are set with `SameSite=strict` (existing NextAuth v4 supports this via `cookies.sessionToken.options.sameSite = "strict"`).

### 1.13 SSRF protection

**Mandatory:** every endpoint that accepts a URL (yt-dlp import, webhook target configuration, OAuth callback) MUST validate the URL against an allowlist or blocklist:

```typescript
// src/lib/alo-learning/ssrf.ts
const BLOCKED_RANGES = [
  "127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
  "169.254.0.0/16", "::1/128", "fc00::/7", "fe80::/10",
];

export async function safeFetch(url: string): Promise<Response> {
  const parsed = new URL(url);
  // Block non-http(s)
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Blocked protocol: ${parsed.protocol}`);
  }
  // Resolve and check IP
  const ips = await dns.lookup(parsed.hostname, { all: true });
  for (const ip of ips) {
    if (isIpInRanges(ip.address, BLOCKED_RANGES)) {
      throw new Error(`Blocked internal IP: ${ip.address}`);
    }
  }
  return fetch(url);
}
```

### 1.14 Secure temporary files

**Mandatory:** every temporary file is created with `mkdtemp` (random directory name) and deleted after use. The S-1 Critical finding was caused in part by predictable temp file paths.

```typescript
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const dir = await mkdtemp(join(tmpdir(), "alo-learning-"));
try {
  const tmpFile = join(dir, "audio.wav");
  // ... process
} finally {
  await rm(dir, { recursive: true, force: true });
}
```

### 1.15 Job resource limits

**Mandatory:** every BullMQ job has explicit resource limits:

```typescript
const job = await queue.add("video-render", payload, {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 1000,
});

// Worker side:
new Worker("video-render", async (job) => {
  // ... 30 minute timeout
}, {
  concurrency: 2,
  maxStalledCount: 1,
  stalledInterval: 300_000,
});
```

Memory limit per job: 2GB. CPU limit per job: enforced via cgroups if running in Docker. Long-running jobs that exceed limits are killed and marked as `failed` with `errorDetails.code: "RESOURCE_LIMIT_EXCEEDED"`.

### 1.16 Safe process invocation (the S-1 fix)

**Mandatory rule, no exceptions:** never use `execSync` or `exec` with shell strings. Always use `spawnSync` with an argv array.

```typescript
// WRONG — vulnerable (baseline S-1)
execSync(`ffprobe -v quiet -show_entries format=format_name -of csv=p=0 "${audioUpload}"`);

// CORRECT — safe
import { spawnSync } from "child_process";
spawnSync("ffprobe", [
  "-v", "quiet",
  "-show_entries", "format=format_name",
  "-of", "csv=p=0",
  audioUpload,
], { encoding: "utf-8" });
```

This rule applies to: ffmpeg, ffprobe, espeak, Piper, yt-dlp, cli-hub, every adapter that calls an external binary. CI lint enforces it via a custom ESLint rule that forbids `execSync` and `exec` (re-enables ESLint strict rules — baseline OPS-2).

### 1.17 Validate all media-processing inputs

**Mandatory:** every input to a media-processing function is validated with zod:

```typescript
const videoRenderSchema = z.object({
  scriptText: z.string().min(1).max(10000),
  voiceProfileId: z.string().cuid().optional(),
  videoMode: z.enum(["explainer", "documentary", "3d_animated", "ai_presenter", /* ... */]),
  outputFormat: z.enum(["mp4", "webm"]),
  codec: z.enum(["h264", "h265"]),
});
```

Invalid inputs return 400 with a clear error message. No media-processing function is called with unvalidated input.

---

## 2. Child privacy — first-class requirements

The directive is unequivocal about child privacy. This section operationalizes the mandate.

### 2.1 Documented authorization

**Mandatory:** before any media containing a child (under 18) is processed, stored, or generated, the system requires documented authorization in the `CharacterConsent` Prisma model:

```prisma
model CharacterConsent {
  id              String   @id @default(cuid())
  characterId     String
  consenterType   ConsentType  // "self_adult" | "parent_guardian" | "legal_guardian"
  consenterName   String
  consenterEmail  String
  consenterPhone  String?
  consenterRelationship String?  // for parent/guardian
  consentScope    String[] // ["educational_video", "marketing", "commercial"]
  consentedAt     DateTime @default(now())
  revokedAt       DateTime?
  evidence        String?  // path to signed PDF or recorded audio
  // ...
}
```

For minors, `consenterType` MUST be `"parent_guardian"` or `"legal_guardian"`. Self-consent is not accepted for minors.

### 2.2 Minimized identifiable source images

**Mandatory:** when processing a child's image, the system prefers:
1. **Face-blurred versions** for any non-essential use.
2. **Fictionalized characters** (AI-generated child-like characters with no real-child identity) for public educational videos.
3. **Full-face images** only with explicit parental consent for specific use cases (e.g., a personalized educational video for the family).

The default processing pipeline applies a face-blur filter unless the `consentScope` explicitly includes `"full_face_public"`.

### 2.3 No public exposure of children's assets

**Mandatory:** every asset tagged `isChildRelated: true` in `MediaAuditLog` is served only via signed URL with a 1-hour expiry. No child-related asset is served from a public path.

The middleware extends the `PROTECTED_MEDIA_PREFIXES` to include `/alo-learning/characters/minors/`. This path is never served without a signed token.

### 2.4 No unrestricted face or voice cloning of minors

**Mandatory:** cloning operations on minor-related source material require:
1. Explicit parental consent in `VoiceConsent` or `CharacterConsent` with `consenterType: "parent_guardian"`.
2. Rate-limited: max 3 clone operations per minor per 24 hours.
3. Approval-gated: every clone operation enters `awaiting_approval` status and requires admin approval before execution.
4. Audit-logged: every clone operation is logged to `MediaAuditLog` with `syntheticMedia: true` and `childRelated: true` flags.

### 2.5 Fictionalized characters preferred for public educational videos

**Mandatory:** the default character type for ALO Kids public educational videos is `"original_fictional"`. Real-child characters are only used when:
1. The video is private (not published to social platforms).
2. Parental consent explicitly includes `"educational_video"` in `consentScope`.
3. The video is reviewed and approved by the Content Safety Agent (Agent 18) and a human admin.

### 2.6 Mandatory human approval for all child-related media

**Mandatory:** every job that touches child-related media enters `awaiting_approval` status before producing output. The approval queue (`MediaApproval` model) requires admin approval for:
- Step 6 (Character selection) if character is a minor or family member.
- Step 8 (Voice generation) if voice cloning.
- Step 13 (Quality check) for all child-related content (mandatory).
- Step 14 (Human approval) for all child-related content (mandatory).
- Publishing step for all child-related content (mandatory, separate from step 14).

### 2.7 Synthetic-media disclosure

**Mandatory:** every piece of synthetic media (AI-generated voice, AI-generated character, AI-generated video) is tagged with `syntheticMedia: true` in `MediaAuditLog`. When published to social platforms, the system includes the platform-appropriate disclosure:
- Facebook: "AI-generated content" label (per Meta's policy).
- YouTube: "Altered or synthetic content" disclosure (per YouTube's policy).
- TikTok: "AI-generated" label (per TikTok's policy).

**Never use a child's identity to imply that the child actually said or did something they did not.** Synthetic presenters must not be represented as real footage or authentic testimonials.

---

## 3. Baseline findings carried forward

The 13 security findings from `baseline-audit.md` Section H carry forward. Their fixes are documented below.

### 3.1 S-1 (Critical) — Shell command injection in /api/video/cinematic

**Fix:** replace `execSync` with `spawnSync` argv arrays. Apply to:
- `src/app/api/video/cinematic/route.ts:99`
- `src/app/api/video/generate/route.ts:109`
- `src/app/api/avatar-video/route.ts:277,292`
- `src/lib/lipsync.ts:41,50`

**Timeline:** Phase -1 (before Phase 0). One day.

### 3.2 S-2 (High) — Incomplete shell escaping in espeak and ffmpeg drawtext

**Fix:** same as S-1 — use `spawnSync` argv arrays. For ffmpeg drawtext, write the caption to a temp text file and pass `textfile=/path/to/temp.txt` instead of inlining the text.

**Timeline:** Phase -1. Half a day.

### 3.3 S-3 (High) — No CSRF / same-origin on mutating endpoints

**Fix:** wire `isSameOriginRequest()` into every POST/PATCH/DELETE handler. Either per-handler (via `csrfCheck()` helper above) or centrally in middleware via Origin/Referer allowlist + SameSite=strict cookies.

**Timeline:** Phase -1. One day.

### 3.4 S-4 (High) — ~20 privileged routes have no in-handler auth

**Fix:** add `requireOwner()` as the first statement of every privileged route handler (the 30 files listed in `baseline-audit.md` Section C.1). Every new ALO Learning route inherits this obligation.

**Timeline:** Phase -1. Two days.

### 3.5 S-5 (Medium) — No security headers

**Fix:** add `headers()` block to `next.config.ts`:
```javascript
async function headers() {
  return [{
    source: "/(.*)",
    headers: [
      { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; ..." },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ],
  }];
}
```

**Timeline:** Phase -1. Half a day.

### 3.6 S-6 (Medium) — In-memory rate limit

**Fix:** move to Redis-backed limiter (Section 1.10 above).

**Timeline:** Phase 2 (alongside BullMQ queue setup). Two days.

### 3.7 S-7 (Medium) — Backup route can label partial snapshot "complete"

**Fix:** track per-model success/failure counts in `/api/backups`; refuse to label "complete" if any model failed. Add a `partialModels: string[]` field to the backup response.

**Timeline:** Phase 0. One day.

### 3.8 S-8 (Medium) — Default DATABASE_URL placeholder

**Fix:** add a startup preflight that refuses to boot if `DATABASE_URL` contains `"REPLACE_WITH_NEW_URL_ENCODED_PASSWORD"`.

**Timeline:** Phase 0. Half a day.

### 3.9 S-9 (Low) — Generic OTP delivery endpoint disabled but route present

**Fix:** add a comment header documenting the disabled state and the conditions for re-enabling. Optionally remove the route if no plan to re-enable.

**Timeline:** Phase 0. Half a day.

### 3.10 S-10 (Low) — Social OAuth env vars read by nothing

**Fix:** document explicitly that OAuth flow is reserved and not implemented. The ALO Learning Social Publishing Engine (Service J) implements OAuth properly in Phase 10; the existing env vars are reused.

**Timeline:** Phase 10.

### 3.11 S-11 (Low) — ALO_LOCAL_DB_FILE absent from .env.example

**Fix:** remove the dead SQLite fallback code in `src/lib/local-db-fallback.ts` and the `ALO_LOCAL_DB_FILE` env var (schema is MySQL-only — baseline DB-5).

**Timeline:** Phase 0. Half a day.

### 3.12 S-12 (Info) — No hardcoded production secrets (positive)

**No action required.** Add a secrets-scanning CI step (gitleaks/trufflehog) to maintain this invariant.

### 3.13 S-13 (Info) — No SQL injection vectors (positive)

**No action required.** Add an ESLint rule that forbids `queryRawUnsafe` to maintain this invariant.

---

## 4. Voice cloning consent model

The directive mandates explicit consent for voice cloning. The `VoiceConsent` Prisma model captures:

```prisma
model VoiceConsent {
  id                  String   @id @default(cuid())
  voiceProfileId      String   @unique
  consenterType       ConsentType  // "self_adult" | "parent_guardian" | "legal_guardian"
  consenterName       String
  consenterEmail      String
  consenterPhone      String?
  consenterRelationship String?  // for parent/guardian
  commercialUseConsented Boolean @default(false)  // separate consent
  consentScope        String[] // ["educational_video", "marketing", "commercial"]
  consentedAt         DateTime @default(now())
  revokedAt           DateTime?
  evidence            String?  // path to signed PDF or recorded audio
  sourceAssetEncrypted Boolean @default(true)
}
```

**Revocation mechanism:** `DELETE /api/alo-learning/voice/profiles/[id]` revokes consent, deletes the voice profile, deletes the source assets, and marks all derived generations as `revoked` in `MediaAuditLog`. Derived assets are not deleted (they may be in published content), but no new generations using the revoked profile are allowed.

**Restricted access to voice samples:** source assets are stored encrypted (`sourceAssetEncrypted: true`), served only via signed URLs with 1-hour expiry, and never exposed via public paths.

---

## 5. Social publishing consent model

The directive mandates: **"Marketing messages must require appropriate consent."** For social publishing, this means:

1. **Per-platform OAuth consent:** the admin connects each platform account via OAuth; the OAuth flow includes explicit consent for ALO to publish on the account's behalf.
2. **Per-content approval:** every publishing job requires admin approval before execution (default mode).
3. **Auto-publish allowlist:** automatic publishing (without per-job approval) is allowed only for content categories explicitly listed in `PublishingAccount.autoPublishCategories` AND only for authorized accounts.
4. **Opt-out handling:** every SMS marketing message includes a STOP keyword; the SMS Gateway Engine processes STOP replies and adds the phone number to an opt-out list.

---

## 6. Security regression test plan

Section 18 of the directive mandates testing for authentication, authorization, tenant isolation, consent revocation, child-safety review, publishing authorization, and publishing error handling. The full test plan is in `testing-report.md`; the security-specific tests are:

- **A-2 Authentication:** every `/api/alo-learning/*` route returns 401 without a valid session token.
- **A-3 Authorization:** every privileged route calls `requireOwner()`; verify with a mock non-owner token.
- **A-4 Tenant isolation:** every tenant-scoped query filters by `companyId` from the `x-alo-company-id` header.
- **N Consent revocation:** revoking a voice profile prevents new generations; derived assets are marked revoked.
- **O Child-safety review:** every job touching `isChildRelated: true` media enters `awaiting_approval`.
- **P Publishing authorization:** every publishing job requires admin approval; auto-publish only for allowlisted categories.
- **Q Publishing error handling:** failed publishes are retried per the BullMQ retry policy; permanent failures are logged with `errorDetails`.
- **S Storage access:** signed media URLs expire after 1 hour; unsigned requests are rejected.

---

## Cross-references

- `baseline-audit.md` Section H — the S-1 to S-13 findings carried forward here.
- `repository-audit.md` — license compatibility per repo (AGPL/GPL require sidecar deployment).
- `architecture.md` Section 2 — the 12 services and their security obligations.
- `integration-matrix.md` Section 5 — the adapter pattern with mandatory audit logging.
- `database-design.md` — `CharacterConsent`, `VoiceConsent`, `MediaApproval`, `MediaAuditLog` Prisma models.
- `deployment-guide.md` — env var management, secret rotation, deploy-time security checks.
- `testing-report.md` — security regression test plan.
- `production-readiness.md` — security findings block production readiness until fixed.

---

## Final note

This security review operationalizes Section 16 of the directive. The single Critical finding (S-1, shell injection) must be fixed before any ALO Learning implementation begins. The child-privacy first-class requirements are non-negotiable: documented authorization, minimized identifiable source images, no public exposure of children's assets, no unrestricted cloning of minors, fictionalized characters preferred, mandatory human approval, synthetic-media disclosure.

The directive's FINAL RULE is reaffirmed: **never use shell interpolation with user-controlled filenames or media metadata. Use safe process invocation with argument arrays. Validate all media-processing inputs. Child privacy is a first-class requirement. Never publish child-identifiable content without documented authorization and approval.**
