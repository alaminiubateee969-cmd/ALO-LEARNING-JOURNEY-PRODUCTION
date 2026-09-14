# ALO Education — Deployment Verification & Safe Cleanup

**Report date (UTC):** 2026-09-14
**Prepared from:** the Git checkout of `alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION`
**Branch inspected:** `arena/01a09fef-alo-learning-journey-productio` (from `main` @ `e95b39b7a3ae742d0fc2dfa066fb339875c4e604`)

---

## READ THIS FIRST

**The requested audit could not be performed against the VPS, because this session
is not running on the VPS.** I am in an isolated build sandbox with no network
route, host address, or credentials to your server. Every path you listed
(`/root/ALO-LEARNING-JOURNEY`, `/root/alo-github-main-new`, `/var/www/alo-education`,
`/home/aloeduca/…`, the ZIP archives) is **absent** here, and no Apache/Nginx/
LiteSpeed/Caddy/Docker/PM2/MySQL/PostgreSQL is installed.

Per your execution rule — *"If a critical fact is unknown, stop that operation,
preserve the files, and report the exact command or evidence needed to resolve it"* —
I stopped the VPS-side work, changed nothing on any server, and instead did two things:

1. **Verified everything that *is* verifiable from here**, with hard evidence:
   the canonical GitHub repository state, the deployment configuration the repo
   declares, the runtime stack, the database schema strategy, the secret
   posture, and — importantly — **whether the production commit actually builds**.
   It does not. See `02-VERIFIED-FINDINGS.md`.

2. **Wrote the two tools you need to finish the VPS-side work safely**, tested
   them, and documented a staged deploy/rollback plan and a cleanup plan that
   cannot destroy anything. See below.

Nothing was deleted, no service was touched, no database was modified, no
`git reset --hard`, no force-push, no DNS/SSL/firewall change.

---

## Files in this directory

| File | What it is |
|---|---|
| `FINAL-REPORT.md` | The 7-item report you asked for, with every unknown marked explicitly |
| `01-ACCESS-BLOCKER.md` | Proof I am not on the VPS + the exact 3 ways to unblock, and the exact commands to run |
| `02-VERIFIED-FINDINGS.md` | 11 findings, each with file/line evidence. Includes a **build blocker** and a **public-repo data exposure** |
| `03-DEPLOY-ROLLBACK-RUNBOOK.md` | Staged release + atomic swap + rollback + post-deploy verification checklist |
| `04-CLEANUP-PLAN.md` | How each obsolete candidate gets classified, and what evidence is still missing for each |
| `05-EXPOSURE-REMEDIATION.md` | The public-repo data exposure: what was leaked, what was **not** (no credentials — verified), and the exact privatisation + history-purge procedure |
| `vps-readonly-audit.sh` | **Run this on the VPS.** Read-only. Produces sections 1–11 of your requested audit |
| `cleanup-quarantine.sh` | **Run this on the VPS.** Dry-run by default; moves (never deletes) to a dated quarantine |
| `reclaim-regenerable.sh` | **Run this on the VPS.** Dry-run by default. Reclaims only regenerable space: `node_modules`, `.next`, caches, logs |

---

## Repo-side fixes already implemented on this branch

You chose *"skip the VPS for now — repo-side work only"*, so these are done and
verified. **All are on `arena/01a09fef-alo-learning-journey-productio` only.
Nothing is merged to `main`, so `deploy.yml` has not been triggered.**

| Fix | File | Verification |
|---|---|---|
| **Build blocker (F2)** — `Map` inferred `Map<unknown,{}>` | `src/app/api/rag/search/route.ts` | `tsc --noEmit` → **exit 0**, was 3× TS2339 |
| **Fake health check (F1)** — now really probes DB, env, storage writability, `ffmpeg`, `espeak`; returns **503** on critical failure; `curl -f` therefore fails | `src/app/api/health/route.ts` | Ran a dev server and hit it with a broken DB: **HTTP 503**, `status: "unhealthy"`, `failedCritical: ["Database"]`, optional FFmpeg/espeak failures correctly reported as *degraded* not fatal. `curl -sf` → **exit 22**. Same server served `GET / 200`, so the app itself is sound |
| **CI reported green on broken deploys (F1/F10)** — `set -euo pipefail`, refuse to deploy a dirty tree or a non-git path, `prisma migrate diff` printed before `db push`, **hard gate** on `.next/standalone/server.js`, health check that can fail the job, automatic rollback to the recorded SHA, pre-deploy SQLite `.backup` + `integrity_check`, `concurrency` guard | `.github/workflows/deploy.yml` | reviewed; not executed (no VPS) |
| **Public database artefact (F4)** — removed from the working tree; `storage/backups/`, `storage/videos/`, `storage/scene-assets/`, `next-env.d.ts`, `*.tsbuildinfo`, `.backups/`, `.releases/` now gitignored | `.gitignore`, `storage/backups/*` | `git ls-files \| grep storage/backups` → none. `git check-ignore -v` confirms a new `.alo.bak` is excluded. **Still in history** — see `05-EXPOSURE-REMEDIATION.md` |
| **Docs corrected** — health-check contract, build-time egress requirements, rollback reality | `DEPLOYMENT.md`, `SECURITY.md` | `SECURITY.md` no longer claims backups are encrypted; records that **no credential column exists** in any of the 27 models |

Deliberately **not** done: the 19 tracked MP4s were left in place (rows in
`MediaGeneration`/`PublishedPost` may reference those paths — removing them could
break stored references); font self-hosting and real backup encryption both need
your approval and, for fonts, network access this sandbox does not have.

---

## How to run the VPS-side work

```bash
# 1. Copy the two scripts to the VPS (from the VPS, or via scp from your laptop)
sudo mkdir -p /root/ALO-LEARNING-JOURNEY/audit
sudo cp vps-readonly-audit.sh cleanup-quarantine.sh /root/ALO-LEARNING-JOURNEY/audit/

# 2. READ-ONLY audit. Changes nothing. (~1-3 min)
sudo bash /root/ALO-LEARNING-JOURNEY/audit/vps-readonly-audit.sh

# 3. Same audit, but also SHA-256 the multi-GB archives to PROVE duplication.
#    Slow (~10 GB of reads); consider ionice on a busy box.
sudo ionice -c3 nice -n19 bash /root/ALO-LEARNING-JOURNEY/audit/vps-readonly-audit.sh --checksums

# 4. Cleanup proposal — DRY RUN, nothing moves.
sudo bash /root/ALO-LEARNING-JOURNEY/audit/cleanup-quarantine.sh --checksums

# 5. ONLY after you read the proposal and approve it: perform the moves.
sudo bash /root/ALO-LEARNING-JOURNEY/audit/cleanup-quarantine.sh --checksums --execute
```

Both scripts were syntax-checked (`bash -n`) and **executed end-to-end in this
sandbox** to prove they run, degrade gracefully when paths are missing, produce
all 11 report sections, write a proposal file, and print no secret values.

---

## Tooling verification — and the three bugs the testing caught

I did not hand you untested scripts. `cleanup-quarantine.sh` was exercised
against a **synthetic tree** built for the purpose (in `/tmp`, since none of your
real paths exist here), covering every verdict class:

| Synthetic item | Verdict produced | Correct? |
|---|---|---|
| `alo-live/` (unreferenced dir) | `CANDIDATE` → moved | ✅ |
| `public_html/` | `BLOCKED` — *"matches hard-blocked pattern 'public_html'"* → untouched | ✅ |
| `ssl/.well-known.zip` | `BLOCKED` — *"matches hard-blocked pattern '/ssl/'"* → untouched | ✅ |
| `dup-a.zip` + `dup-b.zip` (identical SHA-256) | `dup-a` = **`KEEPER`** → untouched; `dup-b` = `CANDIDATE` naming its keeper → moved | ✅ |
| `alo-education-web-crm-final.zip` (unique content) | **`KEEP-UNIQUE`** — *"this is the only copy and may be the only recoverable backup"* → untouched | ✅ |
| `withsecrets/` (contains `.env`) | `CANDIDATE-WITH-SECRETS` + explicit warning to copy secrets to a root-only 0600 store first | ✅ |
| two non-existent paths | `ABSENT` → *"remove from the candidate list"* | ✅ |

Then `--execute`, followed by `restore.sh`: **3 items moved, 4 protected items
left in place, all 3 restored, 7/7 entries back, and `dup-b.zip` SHA-256 still
identical to its keeper after the round trip.** Quarantine directory created
`drwx------` (0700). A second `restore.sh` run correctly reported
`MISSING in quarantine` instead of clobbering anything.

**Three real bugs were found this way and fixed before handing the scripts over:**

1. **All copies of a duplicate pair would have been quarantined.** Each of two
   byte-identical files saw the *other* as a "surviving twin", so both qualified
   as removable — losing the only copy. Fixed by electing exactly one **KEEPER**
   per SHA-256 group (preferring a member that is already hard-blocked/live, then
   shortest path, then lexical), and by refusing to move anything whose content
   is unique. Re-checked at execute time: if the keeper has vanished, the move is
   skipped.
2. **An unhashed archive fell through to `CANDIDATE`.** The checksum scan only
   walked `/root /home /var /opt`, so an archive elsewhere never got a hash — and
   the code then treated it as an ordinary movable candidate. Fixed by also
   hashing every candidate path directly, and by adding an explicit
   `NEEDS-EVIDENCE` branch so a file with no SHA-256 can **never** be moved.
3. **A stale-variable bug from bash evaluation order.** I had written
   `local h="${SHA[$p]}" gsize="${GROUP_SIZE[$h]:-1}"` on one line. Bash expands
   *every* word in a single `local` statement **before** performing the
   assignments, so `$h` resolved to an unrelated leftover global, not the value
   being assigned. Minimal repro:
   ```bash
   $ bash -c 'declare -A G=([aaa]=2); h=zzz; f(){ local h="aaa" g="${G[$h]:-MISS}"; echo "$g"; }; f'
   MISS          # expected 2
   ```
   Fixed by splitting the declaration and renaming the loop variables so nothing
   leaks. This one mattered: depending on iteration order it could have reported
   a unique file as a member of a duplicate group.

I also hardened both scripts for a real VPS rather than this sandbox: a bash 4+
guard (`declare -A` needs it; CentOS/Alma 7 is fine, macOS bash 3.2 is not),
portable empty-array expansion, and `</dev/null` + `--connect-timeout` on the
`mysql`/`psql`/`crontab` probes so the audit can never hang on an auth prompt on
a production box.

---

## The things that still need your decision

1. **Which GitHub repository is canonical?** The repo I can see was created
   *today* (2026-09-14 09:31 UTC) and has exactly **one commit**. It cannot have
   been the source of directories you uploaded earlier. Your other public repo,
   `ALO-Education_LAST-TRY`, is **completely empty**. So the real source is a
   private repo, a different account, or no longer public. — `02-VERIFIED-FINDINGS.md` §A

2. **Which path does CI deploy to?** `/root/ALO-LEARNING-JOURNEY` (your brief) or
   `/home/aloedu/learn-app` (the repo's `deploy.yml` and `DEPLOYMENT.md`)? And do
   users `aloedu` and `aloeduca` both exist? Pushing to `main` overwrites
   `/home/aloedu/learn-app` — deploying elsewhere leaves the live app on old code.

3. **Make the repository private, then purge history.** ✅ Verified: **no
   credentials were exposed** — no model in the schema has a token/secret/password
   column, and `SocialConnection.scopesJson` was NULL in all 11 rows, so **no
   token rotation is needed**. What *was* public is business data (383 rows:
   analytics, audit log, approvals, content pipeline). Privatisation is instant
   and yours to do; history purge needs a force-push and therefore your approval.
   ⚠ **GitHub auth is currently failing in this session** (`401 Bad credentials`),
   so please reconnect GitHub in Arena. — `05-EXPOSURE-REMEDIATION.md`

4. **Auth for the 39 open API routes.** `SECURITY.md` itself says the app must not
   go live without it, and `DELETE /api/backups` lets an anonymous request
   `fs.unlink` your backups. — F5

5. **Whether to merge the fixes above.** They are verified but deliberately held
   on this branch, because merging to `main` fires `deploy.yml` against a path
   that question 2 has not yet confirmed.
