# Security architecture — observed controls and required boundaries

## Observed

- Production middleware requires admin authentication and fails closed if auth is unconfigured.
- Same-origin/OTP protections, rate-limit helpers, upload stream bounds, prompt sanitation in selected media routes, backups, approval records and audit models exist.
- AgentOS command route runs no tools and records plan/approval/audit only.
- External Z-AI SDK calls are guarded by `assertExternalAiAllowed`; both `ALO_PAID_AI_API_ALLOWED` and `ALO_OWNER_APPROVED_PAID_AI_API` must be true. `.env.example` sets both false.
- Skill validator is pattern-based; it is not an execution sandbox, a complete prompt-injection detector, or a complete source analyzer.

## Required before real agents execute

- Per-user, per-company, per-record authorization for data retrieval and tool calls.
- Server-side encrypted credentials, scoped secrets, key rotation, and redaction.
- Task permissions checked independently of model/provider output.
- Restricted worker/container sandbox; no arbitrary shell/SQL or general network access.
- Human approval for external side effects and capability activation.
- Data minimization, retention/deletion controls and audit event integrity.
- Security review of dependency advisories and all provider terms.
- Penetration tests, restore tests, production auth tests, and policy-bypass tests.

No claim of comprehensive security or live production safety is made by this code audit.
