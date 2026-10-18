# Test results — 2026-10-18

| Check | Result | Scope |
|---|---|---|
| `npm run typecheck` | PASS | Checkout source at audit time. |
| `npm run lint` | PASS | ESLint over repository. |
| `npm test` | PASS: 59 passed, 0 failed | Node test suite, including AgentOS catalog/payment-guard/validator assertions. |
| `npm run build` | PASS | Next.js production build generated 60 static entries and standalone output; existing Next middleware convention deprecation warning remains. |
| `python3 -m py_compile scripts/generate-agentos-catalog.py scripts/validate-agentos-skills.py` | PASS | Python syntax only. |
| AgentOS generator dry run | PASS, no files written | Reported 2,000 planned agent descriptors and 20,000 skill scaffold files. Full generation was intentionally not run. |
| AgentOS API smoke (local dev) | PASS for GET health/agents/skills and plan-only POST in prior local smoke | A local JSON fallback approval/audit record was used for the test and removed. No production API tested. |
| `npm audit` | FAIL security policy | 13 advisories: 9 high, 4 moderate; 0 critical. Upgrade review outstanding. |
| Latest GitHub Actions deploy | FAIL | Run `39129438031`; exact cause unknown because log retrieval returned EOF. |

This is code/test evidence only. It does not prove live CPU inference, secure production deployment, tenant isolation end to end, or working integrations.
