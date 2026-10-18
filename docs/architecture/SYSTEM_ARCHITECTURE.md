# System architecture — current and target boundary

## Current verified code architecture

```text
Next.js 16 / Node 22 app
  ├─ tabbed admin UI + login
  ├─ 78 API routes
  ├─ Prisma Client -> MySQL (production connection not verified)
  ├─ local Ollama/ComfyUI adapters + deterministic fallbacks
  ├─ FFmpeg and local audio/media helpers
  ├─ approval, audit, CRM, RAG and content records
  └─ GitHub Actions CI/deployment configuration (latest deploy run failed)
```

## Current AgentOS addition

- 100 department taxonomy × 20 virtual role descriptors = 2,000 planned agent records.
- 100 department-derived skill categories × 200 virtual templates = 20,000 pending skill descriptors.
- Paginated read APIs and a command planning endpoint.
- The command endpoint creates audit/approval records and does not execute tools.
- Payment guard defaults external Z-AI SDK calls to blocked; local shared chat/image generation uses configured local adapters or fallbacks.

These catalogs do not constitute operating agents, models, or skills. No general AgentOS task queue, skill sandbox, or trusted tool gateway exists yet.

## Target architecture (not yet implemented)

```text
Authenticated owner UI
  -> API authz + rate limit + idempotency
  -> command planner (local model only or explicit free-provider route)
  -> policy / cost / data-scope gates
  -> task + step persistence in existing DB
  -> bounded worker queue (one shared model service; never 2,000 model processes)
  -> context retrieval with per-record authorization
  -> schema-validated model output
  -> trusted tool gateway (least privilege, allowlist only)
  -> owner approval for external/high-impact action
  -> output storage + audit + metrics + handoff
```

Use existing Next.js + Prisma/MySQL as the control plane unless the owner explicitly approves migration. Do not add an independent SQLite/FastAPI control plane that duplicates auth, approvals and company records.
