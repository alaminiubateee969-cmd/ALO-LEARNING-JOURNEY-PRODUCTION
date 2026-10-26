# Feature gap and adoption plan — 2026-10-18

## Decision summary

Continue integrating into the existing Next.js 16 + Prisma/MySQL app. Do not create a parallel FastAPI/SQLite stack, replace the CRM, or touch production without explicit approval and a successful restore test. Reuse existing modules where verified; do not copy third-party code. This report is an initial source-catalog pass, not a full code audit of 135 upstream repositories.

## Verified ALO baseline and gaps

| Workstream | Existing ALO capability | Current status | Gap / adoption decision | Priority |
|---|---|---|---|---|
| Local AI | Ollama adapter, local fallback, ComfyUI adapter; shared chat/image path local-first; legacy Z-AI routes payment-gated | PARTIAL; no live local service or benchmarks | Benchmark one small model on the actual CPU host; add model checksums and authenticated model gateway before deploying. | P0 |
| Agent core | 40 static agent definitions; callback runtime; 100 department taxonomy | PARTIAL | Build a bounded persistent job queue and tool gateway, then implement a few real, testable agents. Do not activate generated 2,000 descriptor catalog. | P0 |
| AgentOS scaffolds | 2,000 virtual planned descriptors and 20,000 virtual private-skill descriptors; planner route | SCAFFOLD ONLY | Durable registry/status/versioning and owner approval workflow; generated entries are not operating workers or skills. | P0 |
| Skills | marketing kits/humanizer and local utility code | PARTIAL | Define audited skill schema, implementation bindings, permission enforcement, test runner, version/rollback; no third-party skill installs. | P0 |
| RAG | Ingest/search routes and Prisma document/chunk models | PARTIAL | Tenant/document ACLs, source freshness, citations, embedding benchmark, injection tests, retention/deletion workflow. | P0 |
| Free model router | No provider onboarding/catalog/secret vault | MISSING | Start with local Ollama; free API providers only after allowed-model registry, current terms check, server-side encrypted secrets, quotas, and no paid fallback. | P1 |
| CRM | Leads, activities, quotes, clients, projects, invoices | PARTIAL | Integration proof against a disposable DB; map existing CRM repo only after license and schema review. | P1 |
| WhatsApp | Department/UI references, no verified business integration | MISSING | Official WhatsApp Business platform only; webhook signature validation, opt-in, templates, rate limits, owner approval for bulk. | P1 |
| Education/students | Learning content, admissions CRM components | PARTIAL | Student record access isolation, official-source freshness/citations, document upload workflow, human review; no fabricated visa advice. | P1 |
| Marketing/email | Drafting, kits, humanization, publishing queue | PARTIAL | Keep drafts; SMTP and external social delivery remain disabled pending provider/legal/compliance review and owner approval. | P1 |
| Media | FFmpeg, storyboard/video/audio/image utility endpoints | PARTIAL | Local-model-specific video/lip-sync/super-resolution need GPUs/weights; benchmark before integrating. Use prompt/render-plan fallback honestly. | P2 |
| Website/app builder | No full isolated builder lifecycle verified | MISSING | Build generated projects in sandbox, run static/security checks, package for owner review; no automatic deploy. | P2 |
| Scraper/research | RAG/search and reference links | PARTIAL | Public-only crawler with robots/TOS checks, per-domain limits, PII filtering, source/capture metadata; never bypass login/paywalls. | P2 |
| Server/domain automation | Production deployment scripts and runbooks | PARTIAL | Current release workflow failed; first fix and inspect logs with operator; no autonomous DNS/Nginx/deploy action. | P0 blocker |
| Security/backups | Auth, OTP, payment guard, backup code and deployment checks | PARTIAL | Run production secrets/dependency review, isolated restore and security test. | P0 blocker |

## Source dispositions by focus

- **Adapt behavior/design patterns:** `cathrynlavery/diagram-design`, `coreyhaines31/marketingskills`, `blader/humanizer`, `songguoxs/gpt4o-image-prompts`, and select permissively licensed learning references. Existing ALO features already reflect some patterns; see prior code and source catalog.
- **Reference, do not copy:** AGPL/GPL projects (ToolJet, OpenViking, Firecrawl, Frappe CRM, Chatwoot, Jitsi, ComfyUI Video Helper Suite, VoiceStudio, and others); model research code; broad SaaS/desktop systems.
- **Defer legal/hardware review:** custom or unresolved licenses, community model licenses, noncommercial projects, weight/dataset terms, and any project with hidden paid-service dependencies.
- **Reject for commercial model/code use unless separately licensed:** observed noncommercial restrictions in selected model/repository license text; see exact excerpts/hash in catalog.
- **No public skills installed. No public repo was cloned/executed.**

## Recommended staged delivery

1. Close production evidence blockers: obtain failed deployment log, verify backup/restore, verify DB migration history and host state; do not deploy from this sandbox.
2. CPU benchmark a single small model and embedding model on the actual server; keep local inference behind private authenticated network.
3. Implement scoped RAG evaluation and company/student ACL tests before adding new ingestion.
4. Add persistent task queue + policy/tool gateway using existing auth/DB. Begin with one low-risk CRM summarizer and one content workflow.
5. Add audited skills with actual code bindings, schemas, unit/integration tests and explicit owner activation.
6. Add free-provider routing only when user-selected providers have current free-model rules and encrypted secret handling; default blocked, no paid-model fallback.
7. Build additional workflows from verified business requirements; never scale placeholder counts into fake operations.

## Sources

`GITHUB_SOURCE_CATALOG.csv` stores 135 normalized repository records with GitHub metadata, pushed timestamp, default-branch SHA, README excerpts and license-file evidence. `GITHUB_LICENSE_MATRIX.md` has individual disposition and reason per repo. A separate deep source-code review is still required before selecting a dependency.
