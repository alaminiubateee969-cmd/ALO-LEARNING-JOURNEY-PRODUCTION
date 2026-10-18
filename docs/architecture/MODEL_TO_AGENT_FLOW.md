# Model-to-agent flow — target security contract

## Current status

Current new AgentOS command flow is **plan-only**. Shared `src/lib/ai.ts` uses local model adapters/fallbacks. Legacy external SDK calls are behind a two-flag payment guard, default false. No generic model-powered tool execution engine is implemented.

## Required future flow

1. Authenticate owner and authorize tenant/department scope.
2. Validate command size, schema, rate limit and idempotency key.
3. Classify intent using local model or deterministic routing; keep raw output untrusted.
4. Select a logical agent descriptor, not a dedicated model process.
5. Retrieve only documents the requesting owner is allowed to read; attach sources and revision metadata.
6. Call one bounded local model worker with timeout and output/token limits.
7. Parse output against a strict JSON schema; reject invalid tool requests.
8. Resolve each tool through a trusted allowlist and permission scope. Never pass arbitrary model-provided shell/SQL/URLs to execution.
9. Create approval for any external message/publication/payment/deployment/DNS/delete/new capability or sensitive identity processing.
10. Execute only approved tool operations with idempotency and audit trail.
11. Validate result, persist task/output/audit, and report provider/model/fallback truthfully.

Model text is untrusted input. Prompt instructions cannot grant permissions or override owner/system policy. The model must never execute shell, SQL, DNS, payment, publishing or bulk messaging directly.
