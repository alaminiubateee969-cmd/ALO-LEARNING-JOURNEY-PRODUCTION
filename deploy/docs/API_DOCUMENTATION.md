# API Behavior Notes — Repository Snapshot

This is a concise guide to selected routes in the current source tree, not a live API verification. Production routes are protected by the NextAuth middleware unless explicitly public (for example, the minimal `/api/health` response and authentication routes). Local development can bypass admin auth unless `ALO_REQUIRE_AUTH=true`; do not treat that preview behavior as production security.

## Content and review

### `POST /api/content/generate`
Creates one content draft using a configured model or fallback template and passes up to three stored documents as prompt context. This is not query-ranked retrieval and does not run independent agents, fact-checking, safety certification, or a verified quality score. Stored score is set to `0` (not independently scored), safety remains pending, and the draft is placed in the internal approval queue for human review.

### `POST /api/content/brief`
Creates an SEO brief draft. `publishReady` remains false and human verification is required. The generated/model-provided content is not independently fact-checked or SEO-certified; no score makes it publish-ready.

### `POST /api/protective-review`
Returns an unverified model suggestion. The route always forces `approved=false`, `needsHumanReview=true`, and clears machine “checks passed.” Model-reported observations are unverified. This endpoint is not a safety certification and does not approve an item.

### `POST /api/approvals`
Records an admin decision. Approving content adds an item to the app’s internal publishing queue; it does not post to a social network. Verify the selected artifact yourself before approval.

## Comments

### `GET /api/comments`
Returns the comment inbox and counts for an authenticated admin.

### `POST /api/comments`
Supports classification, unsent reply drafting, local draft saving, escalation, and ignore actions. If the classifier falls back, the result is marked `review_required`. Sensitive/unclassified comments cannot receive generated drafts. The `send` action returns `503 external_reply_delivery_not_configured`; it does not send a message or mark a comment replied. No external social inbox/reply provider is configured here.

## RAG search

### `POST /api/rag/search`
Performs lexical keyword/overlap matching over stored chunks/documents. It is not vector search or semantic retrieval, and relevance scores are heuristic. Content citations are restricted to exact titles in the selected context, but matching a title does not prove the document supports the content.

## OTP

### `POST /api/otp`
Generic SMS/email/WhatsApp/voice OTP delivery remains disabled until a real provider has been implemented and verified. The route must not generate, store, or return simulated OTP codes. Administrator sign-in OTP is a separate flow with hashed challenges and separate provider configuration.

## Human avatar / video

### `/api/human-avatars`, `/api/avatar-video`
These routes support authenticated avatar/video operations. Generation depends on configured tools/services and may fail or return fallback content. FFmpeg stream/resolution validation is not a quality, identity-consistency, consent, or safety review. The final compositor currently uses still scene images; lip-sync output is not integrated, no lip-sync provider is called by the route, and new video records report `lipSyncUsed=false` / `lipSyncReason=not_integrated`.

Delete operations remove database rows and files; treat them as destructive and require an explicit retention decision and verified backup. Do not use undocumented wildcard cleanup.

## Recovery and health

### `GET /api/recovery/sweep`
Read-only preview of stuck jobs.

### `POST /api/recovery/sweep`
Protected by the admin session or configured `x-cron-secret`. The write action can mark stale jobs failed; it does not regenerate work or verify the public site.

### `GET /api/health`
The unauthenticated response is intentionally minimal. Detailed checks require admin authentication. A health response alone does not establish database migration compatibility, backup restoreability, or user-flow correctness.

## Source of truth

Inspect the matching route in `src/app/api/` before integrating a client. This guide is not evidence of deployed behavior, external provider availability, or public-domain health.
