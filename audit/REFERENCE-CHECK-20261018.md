# Reference and build check — 2026-10-18

## Outcome

The checkout has broad, original feature surfaces inspired by the supplied references, but it is **not accurate to say every capability in every linked project is implemented**. The repository is an education/business platform, not a bundled replacement for the linked diffusion models, lip-sync systems, streaming servers, or third-party AI services. No third-party implementation code was copied.

## Verified reference-aligned areas already in the checkout

- **Video/media creation:** storyboard and video generation/cinematic routes, media retrieval, voice/script generation, music generation, avatar-video surfaces, and local media utilities.
- **Marketing/content:** content studio APIs, email-draft and humanization, marketing lead/kit code, publishing queue and approval surfaces.
- **AI/learning:** learning and curriculum, local AI status, agents, RAG ingest/search, image generation, and audio/voice tools.
- **Operations/product:** CRM, analytics, calendar, diagram studio/import, dashboard, approvals, notifications, backup and deployment systems.
- The route inventory was stale. It now reflects **2 page routes and 73 API route files** present in `src/app`.

## Capabilities not verified or not implemented as full linked-project equivalents

- Model-native text/image-to-video generation from LTX-Video/LongCat-Video; learned video super-resolution; subtitle inpainting/removal; and production-grade neural lip-sync/talking-head generation. Existing video/voice/avatar flows do not imply these models are installed or trained.
- A production live-streaming stack (RTMP/HLS/WebRTC ingest/distribution), Jitsi Videobridge, or an always-on multi-user real-time conversation service.
- Automatic distribution to social accounts and full OAuth integrations; integrations are explicitly bounded/documented in the current audit material.
- Full parity with MetaGPT/GLM/GPT/Grok/Gemini/Claude systems, external provider access, or a full document-chat product. Local tools and application-specific workflows are not equivalents to those models/products.
- A direct replacement for external products/sites such as Enerpize, AIPRaktor, SuperCool, Buffer, Qwen Coder, Mureka, Stack Overflow, or Meta's design system. Their patterns can inform the product but are not bundled services.

These are substantial separate products/models and require provider credentials, infrastructure, model weights, licensing review, and/or user decisions. They should not be represented as complete by adding placeholder UI or endpoints. Existing security boundaries (local-first AI; no automatic email/SMS/publishing) remain intentional.

## Fixes made during this check

- Fixed TypeScript compilation in `src/app/api/voice-studio/route.ts`: `recent` is backed by a dynamically typed database adapter, so `reduce<Record<...>>` was invalid. A typed accumulator loop now computes voice usage without changing response behavior.
- Regenerated `docs/ROUTE-INVENTORY.md`; it had omitted 13 routes currently present in the app.

## Verification performed in this checkout

- `npm ci` — passed (852 packages installed; npm reported 13 dependency advisories: 4 moderate, 9 high).
- `npm run typecheck` — passed after the fix.
- `npm run lint` — passed.
- `npm test` — passed, 52/52 tests.
- `npm run build` — passed; Next.js emitted a middleware-convention deprecation warning.

A successful local build does not verify production database migration, Docker image execution, live external integrations, deployment, or production credentials/infrastructure. See `COMPLETE-AUDIT-REPORT.md` and `DEPLOYMENT.md` for those limits.
