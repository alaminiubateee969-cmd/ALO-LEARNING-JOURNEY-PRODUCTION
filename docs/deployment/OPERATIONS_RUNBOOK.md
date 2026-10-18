# Operations runbook — audit-stage draft

## Daily checks

- Review GitHub Actions CI/deploy status and exact deployed release SHA.
- Check `/api/health` and authenticated deep health where configured.
- Verify MySQL connectivity, disk/volume capacity, backup job result and alert logs.
- Confirm Ollama/ComfyUI status before advertising local generation; no service should be exposed publicly.
- Review approvals, audit events, model/provider identity and fallback flags.

## Incidents

- If deployment status is unknown, stop deployment attempts; retrieve logs and inspect host state with the owner.
- If external AI is unexpectedly attempted, keep both payment guard switches false, preserve audit/log evidence, rotate any exposed credentials, and investigate.
- If model/RAG output is unsafe or exposes cross-tenant data, disable the affected capability, preserve records, and require security review.
- If backup is missing or invalid, do not run migrations or cleanup. Restore-test in isolation first.

## Not verified

No live monitoring, cron, backup cadence, alert route, container health, or worker service was observed. This draft must be completed and approved by the production operator before operational use.
