# Existing feature matrix — 2026-10-18

Classifications reflect source/tests in this checkout only. A route or UI surface alone is not proof of production operation.

| Feature area | Status | Source evidence | Verified evidence / gap |
|---|---|---|---|
| Login and admin authentication | PARTIAL | `src/middleware.ts`, `src/lib/auth*`, `src/app/login/page.tsx`, OTP routes | Auth code and fail-closed behavior have unit coverage. Production credential configuration and live login are UNVERIFIED. |
| Main dashboard / Command Center | PARTIAL | `src/components/alo/Dashboard.tsx`, `CommandCenterView.tsx`, `/api/command`, new `/api/agentos/command` | Existing dashboard and command APIs exist. New AgentOS command path is plan-only; not a company-wide executing orchestrator. |
| Core AI agents | PARTIAL | `src/lib/agents.ts`, `/api/agents`, `src/lib/agent-runtime.ts` | 40 static agent definitions; callback wrapper records some runs. No general worker queue/tool runtime. |
| Department catalog | PARTIAL | `src/lib/departments.ts`, `/api/workforce` | 100 config entries exist. Department counts are definitions/estimates, not observed staff or independently operational teams. |
| AgentOS 2,000 registry | PARTIAL | `src/lib/agentos-catalog.ts`, `/api/agentos/agents` | API returns 2,000 planned descriptors. Zero are instantiated by this catalog as active autonomous agents. |
| Private skills | PARTIAL | marketing kits, humanizer, previous local workflows; new skill descriptors/validator/scripts | Existing reusable code exists. 20,000 generated descriptors are templates, not individually authored or approved skills. No general skill execution sandbox. |
| Workflow/task engine | PARTIAL | existing workflow UI, loop cycles, agent runtime | Existing routes/UI and callback-based work exist; no durable general-purpose task queue, task-step engine or crash-recoverable AgentOS worker pool. |
| RAG / company knowledge | PARTIAL | `/api/rag/*`, `RagView.tsx`, `RagDocument`/`RagChunk` models | Ingest/search routes and persistence model exist. Tenant isolation, source citation quality, retrieval benchmarks, data retention, and production corpus are not proven by this audit. |
| Local text AI | PARTIAL | `src/lib/local-models.ts`, Ollama adapter, new local-only shared chat path | Local adapter/fallback exists. Ollama is not running/benchmark-tested in this sandbox; answer quality is UNVERIFIED. |
| Free external provider onboarding/router | MISSING | No providers dashboard/API/credential vault found | No provider catalog, free-model enforcement, encrypted provider-key storage, model discovery or free-only fallback router. |
| Paid/external SDK payment guard | PARTIAL | `src/lib/agentos/payment-guard.ts`, `.env.example`, guarded legacy routes | Default blocked unless both server env switches are true; tests verify. This is a server configuration gate, not a persisted approval workflow or free-provider router. |
| Local image generation | PARTIAL | ComfyUI adapter, image routes, `sharp`/SVG fallback | Local ComfyUI path and deterministic editorial fallback exist. Model weights/runtime and live outputs are not benchmarked here. |
| Voice and ASR | PARTIAL | voice/ASR APIs, local eSpeak/Piper adapter | Local speech tools are detectable by code, but third-party SDK routes are guarded by default; on-host binaries and quality are UNVERIFIED. |
| Video generation | PARTIAL | video/storyboard/cinematic APIs, FFmpeg pipeline | Script/storyboard/render pipeline exists. Neural text-to-video/lip-sync/super-resolution model deployment is not proven. |
| Music generation | PARTIAL | `/api/music/generate`, `AudioStudioView.tsx` | Procedural/local audio and lyric planning exist; this is not a trained music model or verified vocal song generator. |
| CRM, leads, quotes, clients, projects, invoices | PARTIAL | `src/app/api/crm/*`, Prisma CRM models, `AdmissionsCRMView.tsx` | Application endpoints/components exist; production database and end-to-end business processing are unverified. |
| WhatsApp Business | MISSING / PARTIAL | department definitions mention WhatsApp; no verified WhatsApp business integration in routes | No authorized WhatsApp API workflow/webhook/delivery proven. Do not imply sending works. |
| Telegram | PARTIAL | `/api/telegram`, Telegram view | Route and allow-list controls exist; live bot/webhook not verified. |
| Email marketing | PARTIAL | email-draft routes and marketing kits | Draft/planning exists. No verified SMTP campaign sender or dispatch worker. |
| Social publishing/OAuth | MISSING | social/publishing routes and UI | UI explicitly documents external setup/delivery limitations; no verified OAuth or publishing client. |
| Education/admissions/LMS | PARTIAL | learning, CRM, family, course/content features | Several application surfaces exist; no verified student-data integration, official university source sync, or complete LMS workflow. |
| Website/app builder, original rebuild, scraper | MISSING | No end-to-end builder/crawler implementation verified | No complete prompt-to-app build sandbox, URL analysis/rebuild product, compliant crawler, generated-project QA/deploy lifecycle. |
| Server/domain automation | PARTIAL | deployment scripts, Nginx config, ops UI | CI/deployment scripts exist. They are not a general owner-approved domain-deployment agent; live execution is unverified and production workflow failed in latest Actions result. |
| Backups and restore | PARTIAL | `/api/backups`, `deploy/backup.sh`, deployment docs | Backup code and runbooks exist. No successful isolated restore evidence was available. |
| Protection/payment/approval controls | PARTIAL | middleware, approval APIs, validation, payment guard | Several controls and tests exist. No single complete policy gateway mediates every workflow/tool; skills validator is not a sandbox. |
| Monitoring/health | PARTIAL | `/api/health`, monitoring scripts, workflow | Local health endpoint/tests exist. Live service metrics, alerts and SLOs are unverified. |
| Production deployment | UNVERIFIED / BLOCKED | CI/deploy workflows, scripts, Nginx files | Latest observed deploy workflow failed; exact log unavailable. No live VPS changes made in this audit. |
| 2,000 active agents / 20,000 operational skills | MISSING | Scaffold catalog only | Existing count must distinguish registered/planned/implemented/tested/enabled/operational; only scaffolds added. |
