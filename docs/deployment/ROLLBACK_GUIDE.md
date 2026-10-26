# Rollback guide — current evidence boundary

The repository includes `deploy/ROLLBACK_GUIDE.md`, release switching/rollback scripts and safety tests. This file is a pointer/summary; follow the checked-in operational runbook and owner-specific host procedure, not guessed shell commands.

Before rollback, preserve current logs and release identity, confirm database migration compatibility and media volume state, and use the known-good release recorded by the deployment system. Do not delete release directories or migrate production schema backwards without an approved restore plan.

**Rollback not executed or verified in this audit.** Latest deploy run failed and its logs could not be retrieved. Operator must verify the actual current symlink, PM2 process and health before any change.
