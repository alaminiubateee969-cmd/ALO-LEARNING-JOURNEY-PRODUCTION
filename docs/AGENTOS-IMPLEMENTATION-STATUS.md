# AgentOS integration status

This work integrates AgentOS scaffolding into the existing Next.js + Prisma application; it does not create a second FastAPI/SQLite service or modify the production database schema.

## Implemented in this change

- Deterministic virtual catalog: 100 departments × 20 role descriptors = 2,000 **planned agent scaffolds** (`AGENT-0001` through `AGENT-2000`). Catalog roles carry the requested metadata, but have no granted tools and `status: planned`; they are not active autonomous workers or individually authored models.
- Deterministic skill catalog: 100 department-derived categories × 200 private skill descriptors = 20,000 **pending skill scaffolds**. The descriptors are templates generated from 20 reusable task patterns, not 20,000 independently authored or approved skills.
- Read-only/paginated registry APIs: `GET /api/agentos/agents`, `GET /api/agentos/skills`, `GET /api/agentos/health/deep`.
- `POST /api/agentos/skills/validate` validates a submitted skill draft but never activates it.
- `POST /api/agentos/command` is a guarded **planner only**. It writes an audit record and creates an approval item for detected risky requests; it does not execute agents, skills, workflows, shell commands, deployment, payments, or public actions. Paid-API intent is rejected.
- The shared `src/lib/ai.ts` chat/image generation path now uses only configured private Ollama/ComfyUI or deterministic local fallbacks. Legacy routes that still contain the Z-AI SDK now call a shared fail-closed payment guard before the SDK; calls are blocked unless BOTH server-side switches `ALO_PAID_AI_API_ALLOWED=true` and `ALO_OWNER_APPROVED_PAID_AI_API=true` are set. Keep both false by default; this is not yet a free-provider router.
- Explicit generator/validator scripts. Generation is opt-in, refuses overwrites, and generated `skills/` plus `storage/agentos/` outputs are gitignored.

## Commands

```sh
# Inspect only; it does not create the 20,000 files
python3 scripts/generate-agentos-catalog.py

# After reviewing disk usage and choosing a safe target, generate local files
python3 scripts/generate-agentos-catalog.py --confirm-generation
python3 scripts/validate-agentos-skills.py
```

The generator writes 20,000 Markdown files plus a 2,000-entry JSON registry under ignored local paths. It does not approve skills or run them. Do not point these scripts at production data or run them without checking available storage and backups.

## Not implemented / not verified

- The 2,000 descriptors do not represent 2,000 running model instances. Only the existing core agent roster has implemented app behavior. Models are shared inference engines; agents are role/configuration/workflow definitions.
- The 20,000 skill templates have not been generated in this checkout, individually reviewed, or approved. The validator is a conservative pattern checker, not a security sandbox or complete prompt-injection detector.
- There is no generic durable AgentOS task/task-step/workflow engine, background queue, department/company memory promotion pipeline, OpenClaw runtime adapter, Qdrant/n8n adapter, skill execution sandbox, or self-improving model training loop.
- No agent can run shell commands or deploy domains through these new endpoints. Server automation remains an approval-gated plan, not unattended execution.
- Current persistence remains the app's existing Prisma/MySQL architecture. No schema changes or migrations were made.
- The command planner's risk detection is conservative keyword-based triage, not a complete policy engine. Review the existing application authorization and approval configuration before production use.

Counts in `GET /api/agentos/health/deep` deliberately distinguish generated catalog sizes from database-registered agents and active application agents. A scaffold count must never be reported as a count of deployed autonomous agents.
