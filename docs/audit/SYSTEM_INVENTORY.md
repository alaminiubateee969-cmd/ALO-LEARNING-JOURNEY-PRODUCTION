# System inventory — 2026-10-18

## Scope and evidence limits

This is a repository/workflow inventory from the checked-out source and GitHub Actions metadata. It is **not** a live VPS, production database, DNS, domain, hosting-panel, Cloudflare, or restore inspection. Those systems were not accessed. The checkout is a shallow clone, so local history cannot answer all branch/commit questions.

## Repository identity and Git

| Item | Evidence | Result |
|---|---|---|
| Repository | `/home/user/ALO-LEARNING-JOURNEY-PRODUCTION` | Existing Next.js application; not a FastAPI/SQLite AgentOS service. |
| Working branch | `arena/bef971cb-alo-learning-journey-productio` | Fixed Arena session branch. |
| Checkout/base SHA | `482fb9bf5cd979a04292aa30cc06a8210dfc9cbd` | Shallow/grafted; `git rev-parse --is-shallow-repository` = true. |
| Git remotes | `origin` points to `alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION` | Remote branches visible only for `main` plus origin HEAD in this shallow checkout. |
| Recent GitHub PRs | `gh pr list --state all --limit 30` | PRs #1–#19 listed as merged; no open PR appeared in returned list. |
| Latest Actions | `gh run list` at audit time | CI success on `main` SHA `482fb9b`; deployment workflow failed; Datadog synthetics skipped. Failure logs could not be fetched (GitHub Actions result URL returned EOF), so exact failure cause is **UNVERIFIED**. |
| Worktree | `git status --short` | Contains local, uncommitted work from this Arena session. No changes were committed or deployed. |

## Application inventory

| Metric | Measured value | Evidence |
|---|---:|---|
| Runtime | Node.js 22 | `package.json` engines; Dockerfile runtime image. |
| Framework | Next.js 16.4.2, React 19 | package manifest and successful build output. |
| Frontend page route files | 2 | `src/app/page.tsx`, `src/app/login/page.tsx`. Main application uses a tabbed SPA shell. |
| API route files | 78 | Filesystem count including AgentOS routes added in the current worktree. `docs/ROUTE-INVENTORY.md` regenerated. |
| Source files under `src` | 236 | `find src -type f` at audit time. |
| Prisma models | 42 | `grep '^model ' prisma/schema.prisma`. |
| Prisma migration directories | 5 | `prisma/migrations`. |
| Existing static core agent definitions | 40 | `src/lib/agents.ts`. |
| Department definitions | 100 | `src/lib/departments.ts`. These are taxonomy/configuration, not 100 proven operating departments. |
| Existing tests | 59 passing | `npm test`, 2026-10-18. |

## Major code areas

- UI: `src/app/page.tsx`, `src/components/alo/*`, `src/components/ui/*`.
- API: `src/app/api/*` (route inventory has exact paths).
- AI/local model: `src/lib/ai.ts`, `src/lib/local-models.ts`, `src/lib/local-audio.ts`, `src/lib/agentos/payment-guard.ts`.
- Agent definitions and runtime: `src/lib/agents.ts`, `src/lib/agent-runtime.ts`, `src/lib/agentos-catalog.ts`.
- Database: `prisma/schema.prisma`, `prisma/migrations/*`, `src/lib/db.ts`.
- RAG: `/api/rag/ingest`, `/api/rag/search`, `RagView.tsx`.
- Auth/security: `src/middleware.ts`, `src/lib/auth*`, OTP routes, rate limits, same-origin helper, security docs.
- Deployment: `.github/workflows/*`, `scripts/deploy-production.sh`, `deploy/*`, Dockerfile/Compose, Nginx/Tailscale docs.

## AgentOS scaffolds currently in the worktree

The current work adds virtual catalog endpoints for 2,000 planned agent descriptors (100 × 20) and 20,000 private skill descriptors (100 × 200). They are generated templates, not individually authored capabilities. No new agent workers, skill execution runtime, persistent task queue, or 20,000 files were created. `POST /api/agentos/command` is explicitly a plan/audit/approval endpoint only; it does not execute tools. Details: `docs/AGENTOS-IMPLEMENTATION-STATUS.md`.

## Expected infrastructure vs inspected evidence

| User-stated expectation | Local evidence | Classification |
|---|---|---|
| Ubuntu 22.04, 16–32 GB RAM, CPU-only | Dockerfile says Ubuntu 24.04+ host; no live host shell/system information available. | UNVERIFIED; deployment target differs in docs. |
| Node.js | Node 22 required by package and runtime container. | WORKING in build sandbox, not live-host verified. |
| Python | Python helper scripts exist; no production Python service. | PARTIAL / not required by current app architecture. |
| MySQL/PostgreSQL | Prisma datasource is MySQL; no Postgres datasource. | Code configuration verified; production connection/history unverified. |
| Redis | No Redis service/dependency/adapter located in inspected deployment files. | MISSING in current architecture. |
| Docker | Dockerfile and Compose exist; build not run (no daemon evidence). | PARTIAL / UNVERIFIED. |
| PM2 | Deployment scripts/configuration refer to PM2. | Code exists; live process list unverified. |
| Nginx/Caddy | Nginx config and deprecated Caddyfile exist. | Files present; live proxy config unverified. |
| Cloudflare Tunnel | No verified live tunnel status/config found in checkout audit. | UNVERIFIED. |
| Ollama / ComfyUI / Qdrant / n8n | Local adapters/configuration exist for Ollama and ComfyUI; Qdrant/n8n are not proven operational. | Ollama/ComfyUI code present, runtime health unverified; Qdrant/n8n missing or unverified. |

## Immediate blockers

1. Production/deployment Actions failure needs its actual logs and operator-side context.
2. Production domain, server, database, live model services, and backup restore remain unverified.
3. npm reports 13 advisories (9 high, 4 moderate); several fixes proposed by npm require major dependency upgrades and need compatibility review.
4. The current branch has uncommitted audit and AgentOS foundation changes; they are not deployed.
