# 07 — Historical Networking Repair & Deployment Verification (2026-10-13)

> **Historical snapshot — not current production evidence.** This document
> refers to an earlier checkout/date and may contain stale paths, counts,
> test results, or infrastructure claims. Use the current repository
> baseline at `../COMPLETE-AUDIT-REPORT.md`, deployment blockers at
> `../DEPLOYMENT.md`, and migration procedure at
> `../MIGRATION-RECOVERY-PLAN.md`. Do not execute commands here against
> production without a new review and explicit authorization.


**Task:** repair GitHub Actions → self-hosted Ubuntu server deployment over
authenticated private networking (Tailscale), with production safety gates.
**Repository:** `alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION`
**Base commit:** `f266f9b274f9d9289da7eb234239bcbe1ad6c677` (current merged `main`)
**Session branch:** `arena/65ec9bb3-alo-learning-journey-productio` (feature
branch for this work; PR targeting `main` is open at
<https://github.com/alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION/pull/12>
— nothing is merged or deployed without approval)
**Server:** hosting.alolabs.net · Ubuntu 22.04.5 · LAN 192.168.0.24 · tailnet
100.85.239.114 · `aloedu@:22` · PM2 `learn-aloeducation` :3017 — **self-hosted
physical machine behind NAT, NOT a VPS/Hostinger**. The running application
was **not** restarted, reconfigured, or interrupted at any point; every change
in this repair is repository-side (GitHub Actions + docs + scripts).

---

## 1. Root cause (confirmed from GitHub-side evidence)

Failed run `Deploy to VPS` #38403285101 (merge of PR #11 into `main`):

| Job | Result | Steps |
|---|---|---|
| `verify / validate` | **success** | all CI steps green |
| `deploy` | **failure** | Checkout ✓ → Secrets gate ✓ → Configure SSH ✓ → **"Deploy exact SHA to VPS" ✗** → live check skipped |

The failing step is the first TCP connection attempt: `ssh: connect to host
*** port 22: Connection timed out`, exit code **255**, before the remote
deploy script started. Cause: GitHub-hosted runners were pointed at an address
that the runner cannot reach — the server is behind a NAT router with **no
directly reachable public IP**. This is a **network reachability** failure,
not an application, SSH-key, or deploy-script failure.

## 2. What was implemented

| File | Change |
|---|---|
| `.github/workflows/deploy.yml` | **Rewritten.** (a) `network-preflight` job: Tailscale join via the **official action pinned to a reviewed release commit**, ephemeral `tag:github-runner` identity, `tailscale ping` of the server, `tailscale status` evidence, tailnet-destination guard, TCP 22 probe, read-only SSH auth probe — **never deploys**. (b) `deploy` job: `needs: [verify, network-preflight]`, `environment: production` approval, **readiness switch** `vars.VPS_DEPLOY_ENABLED` (unset ⇒ job skipped), approval-gate self-check, Tailscale connect on the deploying runner, pinned host key (`StrictHostKeyChecking=yes`, key material bound to the deploy host), pre-deploy TCP/SSH re-check, deploy of the **exact merged SHA** (`EXPECTED_SHA=github.sha`, script refuses ≠ `origin/main`), public HTTPS gate. (c) `workflow_dispatch` `mode: preflight-only` for network evidence without any deploy. (d) legacy secret names kept compatible (`SERVER_HOST` **or** `VPS_HOST`). |
| `scripts/network-preflight.sh` | **New.** Read-only shared preflight: refuses non-tailnet destinations (public IP/hostname), TCP 22 probe with retries, optional SSH auth probe (`remote command: true`). Used by the workflow so operator evidence and CI evidence come from the same code. |
| `deploy/tailscale/acl.hujson` | **New.** Minimum-privilege tailnet policy: `tag:github-runner → tag:alo-hosting` **port 22 only**, tagOwners, optional (documented-off) Tailscale SSH block. Merge-only guidance. |
| `deploy/tailscale/README.md` | **New.** Full setup: server preconditions (UFW `allow in on tailscale0`, no public SSH, no router port-forward, keep OpenSSH host keys), ACL application, OAuth client (`auth_keys:Write` + `tag:github-runner` only, secret shown once), GitHub secrets/variables tables, host-key pinning, verification commands, self-hosted-runner fallback (evaluated, not adopted), troubleshooting map. |
| `DEPLOYMENT.md` | **Rewritten** (previous copy was truncated mid-sentence). Pipeline diagram, secrets/variables **audit tables** (legacy `VPS_HOST` migration path), production approval gate requirement, **§Deployment blockers** (the five unresolved items) and the `VPS_DEPLOY_ENABLED` readiness switch, DNS/proxy notes. |

Not changed (deliberately): `scripts/deploy-production.sh` (already exact-SHA,
verified-backup-first, atomic release switch, rollback — and it must not run
while blockers exist), `ci.yml`, application code, `ecosystem.config.js`, nginx
config. No server-side change of any kind was executed.

### Pinned Tailscale action (reviewed)

`tailscale/github-action@d1b6cd204f8dceda5b3eaad7f1f767be390056cd` — release
**v4.2.0** (latest stable as of 2026-10-13; tag resolves to that commit,
verified via `git/ref/tags` + `commits/v4.2.0` API). Tailscale client pinned to
`version: '1.94.2'`. Nodes created by the action are **ephemeral** and are
removed from the tailnet automatically after each run; the OAuth client can
only issue `tag:github-runner` keys.

## 3. GitHub secrets & variables audit (names only — no values printed)

Requested inventory vs. workflow usage after this repair:

| Name | Kind | Workflow usage | Notes |
|---|---|---|---|
| `SERVER_HOST` | secret | `secrets.SERVER_HOST \|\| secrets.VPS_HOST` | **new preferred name** for the private tailnet destination (`100.85.239.114` or `*.ts.net`) |
| `VPS_HOST` | secret | fallback of the above | **legacy — kept compatible**; migrate then delete |
| `VPS_USER` | secret | SSH user (`aloedu`) | unchanged |
| `VPS_SSH_KEY` | secret | dedicated deploy key, 0600, never echoed | unchanged, protected |
| `VPS_SSH_HOST_KEY` | secret | pinned host key, strict verification | unchanged; secret may hold any-name line — workflow binds key material to the deploy host |
| `VPS_PORT` | secret | optional, default 22 | unchanged |
| `TAILSCALE_OAUTH_CLIENT_ID` | secret | OAuth client id (new) | scope `auth_keys:Write`, tag `tag:github-runner` only |
| `TAILSCALE_OAUTH_SECRET` | secret | OAuth client secret (new) | shown once at creation; rotate on exposure |
| `VPS_APP_DIR` | variable | release base dir | unchanged |
| `VPS_PM2_APP` | variable | PM2 name | unchanged |
| `VPS_APP_PORT` | variable | local health port | unchanged |
| `VPS_DOMAIN` | variable | public HTTPS gate (strict when set) | unchanged |
| `VPS_DEPLOY_ENABLED` | variable | **readiness switch (new)** | deploy job skipped unless exactly `true` |

Audit notes: (1) this session's GitHub token cannot **list** repository secrets
(`HTTP 403`), so existence of the current values is unverified — the workflow
fails closed and names exactly which secret is missing. (2) No secret value was
printed, requested, or stored anywhere in this work. (3) Do not set
`SERVER_HOST`/`VPS_HOST` to a public IP or unverified public hostname — the
preflight **hard-refuses** non-tailnet destinations.

## 4. Verification matrix (PASS / FAIL / UNVERIFIED)

| # | Item | Status | Evidence / what remains |
|---|---|---|---|
| 1 | GitHub workflow syntax | **PASS** | `deploy.yml` + `ci.yml` parse as valid YAML; job graph `verify → network-preflight → deploy` validated; pinned action SHA present; `bash -n` on all shell blocks' scripts; `scripts/test-deploy-rollback.sh` green |
| 2 | CI result (PR `validate`) | **PASS** | run [#38420650731](https://github.com/alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION/actions/runs/38420650731) **success** (1m27s): npm ci, prisma validate/generate, lint, typecheck, tests incl. Sharp lazy-load regression + rollback test, production build — all green on the PR |
| 3 | Tailscale authentication | **UNVERIFIED** | requires `TAILSCALE_OAUTH_CLIENT_ID/SECRET` in repo secrets — not settable from this session (token is 403 on secrets). Evidence path: Actions → Deploy to VPS → **Run workflow → mode: preflight-only** after adding secrets |
| 4 | Tailnet access permissions (ACL/grants) | **UNVERIFIED** | minimum-privilege policy delivered at `deploy/tailscale/acl.hujson` (`tag:github-runner → tag:alo-hosting :22` only); the tailnet owner must merge it in the admin console and tag the server `tag:alo-hosting` |
| 5 | TCP port 22 connectivity (runner → server) | **UNVERIFIED** | from this sandbox (not on the tailnet) the probe correctly reports unreachable with guidance — that is the expected FAIL for a non-tailnet vantage. Real evidence = the `network-preflight` job logs (`PASS TCP 100.85.239.114:22 is open`) |
| 6 | SSH public-key authentication | **UNVERIFIED** | server-side key auth is reported enabled (operator audit 2026-10-13); the workflow's auth probe (`remote command: true`, pinned host key, BatchMode) proves it per run once tailnet path exists |
| 7 | Exact GitHub commit checkout | **PASS** (enforcement) / **UNVERIFIED** (first live run) | workflow passes `EXPECTED_SHA=<github.sha>`; `deploy-production.sh` refuses any SHA ≠ `origin/main`, archives into `releases/<sha>/`, and verifies `RELEASE_SHA` before/after PM2 switch |
| 8 | MySQL access | **FAIL** | known P1010 access-denied for the production DB user — explicitly listed as blocker #1; deploy stays disabled |
| 9 | Verified database backup | **UNVERIFIED** | no verified restore point confirmed yet (blocker #3). The deploy script's backup gate (`mysqldump` + `gzip -t` + content probe, stop-on-failure) only runs **during** a deploy and is not a substitute |
| 10 | Next.js production build on the server CPU | **UNVERIFIED** | CI builds pass on GitHub runners (x86-64); the server CPU rejected Bun (illegal instruction) and Sharp PNG compatibility is unproven there (blocker #4) |
| 11 | PM2 release-switch procedure | **UNVERIFIED** (on server) / **PASS** (isolated mechanics) | `scripts/test-deploy-rollback.sh` proves the atomic `mv -T` symlink switch + rollback; first real switch on the server is untested (blocker #5) |
| 12 | Local port 3017 health | **PASS** (operator evidence 2026-10-13) | `http://127.0.0.1:3017/` → 200 and `/api/health` → 200 from the server audit; PM2 online, 0 restarts |
| 13 | Public HTTPS health (`learn.aloeducation.com`) | **FAIL** | DNS did not resolve at audit time; Nginx owns 80/443 with Caddy/cloudflared conflict unresolved. Public gate stays warn-only until `VPS_DOMAIN` is set |
| 14 | Rollback capability | **PASS** (mechanism) / **UNVERIFIED** (end-to-end) | deploy script: automatic code rollback on any failure after switch + `releases/` retention + `history.log`; end-to-end rollback drill on the server still required (blocker #5) |

## 5. Network test evidence (this session)

* Failed run #38403285101 job log: `verify` green, deploy died at the SSH step
  with `Connection timed out` exit 255 — pre-repair evidence of the reachability
  gap (root cause, §1).
* `scripts/network-preflight.sh` behavior verified in-sandbox:
  * `SERVER_HOST=203.0.113.5` → **refused** (“not inside … 100.64.0.0/10 … never
    a public IP”) exit 1 — public destinations are impossible by construction;
  * `SERVER_HOST=learn.aloeducation.com` → **refused** (not a tailnet IP / not
    `*.ts.net`) exit 1 — unverified public hostnames cannot be deploy targets;
  * `SERVER_HOST=100.85.239.114` → destination **accepted**, TCP probe fails
    from this sandbox with an actionable message (this sandbox has no tailnet
    membership — expected).
* CI (PR `validate`) **green** on this branch — run
  [#38420650731](https://github.com/alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION/actions/runs/38420650731)
  (`validate` job success, 1m27s, every step green).
* `deploy.yml` was additionally validated by YAML parse + structural checks
  (job graph, pinned action SHA, gate expressions) and `bash -n` on every
  script. This session's GitHub token cannot create `workflow_dispatch` events
  (`HTTP 403` on `actions/workflows/…/dispatches`), so a live `mode:
  preflight-only` run must be triggered by the operator (checklist §8 step 5) —
  that run is also the required evidence for matrix items 3–6.

## 6. Database and backup blockers (deployment stays disabled)

1. **MySQL P1010 access-denied** — fix the production DB user's host grants
   (verify `SELECT 1` with the exact `DATABASE_URL` the app uses).
2. **Exposed database credential requiring rotation** — rotate before any new
   release can reintroduce it.
3. **No verified production backup** — take + verify (`gzip -t`, row probe,
   restore drill) a manual backup first.
4. **Sharp CPU compatibility unverified** on the old server CPU (Bun already
   miscompiles there; npm is canonical).
5. **First release-switch procedure untested** on the live copy (bootstrap +
   rollback window required).

Until **all five** are cleared: keep `vars.VPS_DEPLOY_ENABLED` **unset** (the
deploy job cannot even start), keep `production` required-reviewers configured,
and use `mode: preflight-only` for network work. **Successful connectivity is
not authorization to deploy.**

## 7. Deployment readiness decision

**NOT READY — deployment intentionally blocked.**

* Networking repair: **implemented** (Tailscale-tunneled, authenticated,
  minimum-privilege, strict host keys, ephemeral runners, preflight evidence).
* Network authentication/ACL/22/SSH items: **UNVERIFIED** until the operator
  adds the two Tailscale secrets, merges the ACL, and runs `mode: preflight-only`.
* Server/data blockers (§6): **open**.
* Per the stated policy: **no production success is claimed** — the exact
  approved SHA is not yet verified running on the server, and public HTTPS
  health does not pass.

**Fallback considered:** a dedicated self-hosted GitHub Actions runner on a
separate trusted machine (never inside the production app's security context).
Evaluated and **not adopted** — the Tailscale path is strictly preferred and is
what the workflow implements (see `deploy/tailscale/README.md` §7).

## 8. Operator checklist (in order)

1. Review + merge the PR (CI green; this report attached). *(not done for you)*
2. Add secrets: `TAILSCALE_OAUTH_CLIENT_ID`, `TAILSCALE_OAUTH_SECRET`,
   `SERVER_HOST=100.85.239.114` (keep `VPS_HOST` until migrated).
3. Merge `deploy/tailscale/acl.hujson` into tailnet ACL; tag the server
   `tag:alo-hosting`; create the OAuth client (`auth_keys:Write` +
   `tag:github-runner`).
4. Settings → Environments → `production` → **Required reviewers** (approval
   gate; the workflow refuses to deploy if it can read the environment and
   finds none).
5. Actions → **Deploy to VPS → Run workflow → mode: preflight-only** — capture
   the `PASS` lines as network evidence. Do not enable deployment yet.
6. Clear blockers §6 one by one (DB grants, credential rotation, verified
   backup, Sharp check on the server, rollback drill).
7. Set `VPS_DEPLOY_ENABLED=true`, set `VPS_DOMAIN` when DNS resolves, then
   merge the next PR: preflight → **approve in `production`** → exact-SHA
   deploy → health gates. Verify `current/RELEASE_SHA` equals the merged SHA
   and public `/api/health` returns 200 before claiming success.
