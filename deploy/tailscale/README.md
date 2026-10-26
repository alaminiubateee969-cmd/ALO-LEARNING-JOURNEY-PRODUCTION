# Tailscale deploy preflight — configuration runbook

> **Repository configuration only; no current live network verification.** This
> document describes the intended GitHub Actions → Tailscale → SSH path in
> `.github/workflows/deploy.yml`. This audit did not inspect the production
> host, tailnet, ACL, firewall, SSH keys, DNS, proxy, or GitHub settings. Earlier
> audit notes contain addresses and paths that may be stale; do not copy them
> without independent read-only confirmation.

## Intended flow

```text
GitHub Actions runner
  └─ scoped ephemeral Tailscale OAuth client
       └─ operator-verified tailnet host and ACL
            └─ SSH with pinned host key
                 └─ read-only preflight, then separately gated deploy workflow
```

The workflow's network preflight checks the configured host, TCP port, and SSH
public-key authentication. A successful connection is not approval to deploy.
The deploy job additionally requires passing CI, `VPS_DEPLOY_ENABLED=true`, a
protected `production` Environment approval, a confirmed application path, a
successful isolated backup restore rehearsal, and a strict public HTTPS health
check. See [`../../DEPLOYMENT.md`](../../DEPLOYMENT.md) and
[`../../MIGRATION-RECOVERY-PLAN.md`](../../MIGRATION-RECOVERY-PLAN.md).

## Before configuring the workflow

1. On the actual host, inspect the running PM2 app/cwd, SSH daemon, firewall,
   tailnet status, proxy upstream, and app storage **read-only**. Do not enable
   public SSH or change the router/firewall based on an old report.
2. Independently verify the intended tailnet IP/name and SSH host-key
   fingerprint. Use strict host-key checking; do not use `StrictHostKeyChecking=no`.
3. Configure a Tailscale OAuth client with only the scope/tag permissions
   required by your tailnet policy. Restrict ACL/grants to the verified deploy
   host and SSH port, and merge changes into the existing policy rather than
   replacing it wholesale.
4. Use a dedicated deployment SSH account/key with least privilege. Never reuse
   an application secret or commit a key.
5. Configure the protected GitHub `production` Environment with required human
   reviewers. Leave `VPS_DEPLOY_ENABLED` unset until every blocker in the
   deployment runbook is resolved.

## GitHub Actions configuration

Repository → **Settings → Secrets and variables → Actions**.

**Secrets:**

| Name | Requirement |
|---|---|
| `TAILSCALE_OAUTH_CLIENT_ID` | Operator-created scoped client ID |
| `TAILSCALE_OAUTH_SECRET` | Client secret, stored only in GitHub Secrets |
| `SERVER_HOST` or legacy `VPS_HOST` | Independently verified tailnet destination |
| `VPS_USER` | Dedicated SSH deployment user |
| `VPS_SSH_KEY` | Dedicated private SSH key |
| `VPS_SSH_HOST_KEY` | Out-of-band verified SSH host-key material |
| `VPS_PORT` | Optional SSH port; workflow defaults to 22 |

**Variables:**

| Name | Requirement |
|---|---|
| `VPS_APP_DIR` | Required exact absolute path; confirm live PM2 cwd/proxy/storage. No fallback is allowed. |
| `VPS_PM2_APP` | PM2 app name; default is `learn-aloeducation`. |
| `VPS_APP_PORT` | Actual local app port; default is `3017`. |
| `VPS_DOMAIN` | Required public `https://` URL; public health is a hard gate. |
| `VPS_RESTORE_TEST_SHA` | Exact candidate SHA successfully rehearsed on an isolated backup restore. |
| `VPS_RESTORE_TEST_REFERENCE` | Non-secret identifier for the restore-rehearsal evidence. |
| `VPS_MIGRATION_PLAN_SHA` | Exact candidate SHA only after separate schema/history review and migration rehearsal. |
| `VPS_DEPLOY_ENABLED` | Keep unset until all blockers are resolved and authorized. |

Do not set a path merely because it appears in an older document. The request
`/home/aloedu/LEARNING-JOURNEY` and the older path
`/home/aloedu/projects/learn-aloeducation` conflict; this repository has no
current evidence identifying the live app directory.

## Read-only network preflight

With secrets configured, use the workflow's `workflow_dispatch` input
`mode=preflight-only`. It performs network checks and must not deploy or mutate
the app. Review the logs for the selected destination, TCP result, pinned SSH
host-key result, and authentication result. A failure should be resolved at the
specific ACL, network, host-key, or SSH layer; do not broaden access blindly.

The script can also be reviewed locally with:

```bash
bash -n scripts/network-preflight.sh
```

Do not execute it against production from this audit environment. This audit
has not run the workflow or verified the host.

## Operational guardrails

- Do not open SSH to the public internet or change authoritative nameservers as
  part of this preflight.
- Do not treat Tailscale status, SSH connectivity, or a green network job as
  deployment authorization.
- Do not run bootstrap/deploy/migration scripts until the restore and schema
  recovery requirements in `MIGRATION-RECOVERY-PLAN.md` are met.
- Never use credentials directly in command-line arguments or print them in
  logs. Rotate any credential that may have been exposed outside the approved
  secret store.
- Record the verified host/path and evidence in the organization's approved
  private operations record, not this public source repository.
