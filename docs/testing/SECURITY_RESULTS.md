# Security results — 2026-10-18

## Automated checks

- `npm test`: 59 passed, including auth/OTP, database guard, migration/deploy safety, request-size controls, AgentOS payment guard, and skill validator behavior.
- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npm audit`: 9 high + 4 moderate advisories; review/upgrades required.
- Remaining legacy Z-AI SDK imports are preceded by `assertExternalAiAllowed` guard; tests check this source invariant. Default flags false.

## Not performed

No external penetration test, dependency SBOM/licensing scan, secret scan of all history and production, static analysis/DAST, tenant isolation adversarial test, live auth/OTP test, provider-key vault test, sandbox escape test, or production firewall scan was performed. Do not describe this as a full security audit or certification.
