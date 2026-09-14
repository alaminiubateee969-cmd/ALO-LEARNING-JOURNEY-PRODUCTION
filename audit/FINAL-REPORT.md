# FINAL REPORT — ALO Education VPS deployment verification & safe cleanup

**Date (UTC):** 2026-09-14
**Session host:** `e2b.local` — an isolated build sandbox, **not your VPS**
**Repository inspected:** `alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION` @ `main` = `e95b39b7a3ae742d0fc2dfa066fb339875c4e604`
**Session branch:** `arena/01a09fef-alo-learning-journey-productio`

> **Headline.** The VPS-side audit (your items 1–3, 5–10) is **BLOCKED**: this
> session has no route, address, or credential to your server, and every path you
> named is absent here. I did not guess at any of it. What I *could* verify from
> the authoritative repository turned up two blockers that would have made the
> deployment fail regardless of server access: **the production commit does not
> build**, and **a real SQLite database is committed to a public repository
> behind a key that is also public.** Nothing was deployed, deleted, moved,
> migrated, force-pushed, or reconfigured.

---

## UPDATE — decisions taken and work completed after your direction

You chose: **repo-side work only** · **hold the build fix on the branch** ·
**all three exposure steps in order** · **reclaim regenerable space only**.
All four were acted on. This section supersedes anything below it that says
otherwise.

### Completed and verified on branch `arena/01a09fef-alo-learning-journey-productio`

| Work | Verification |
|---|---|
| **Build blocker fixed** — `src/app/api/rag/search/route.ts` `Map` inference | `tsc --noEmit` → **exit 0** (was 3× TS2339). **Held on branch, not merged**, per your choice |
| **Fake health check replaced** — `src/app/api/health/route.ts` now really probes the DB (`SELECT 1` + `Company.count()`), `DATABASE_URL` shape, storage writability, `ffmpeg`, `espeak`, and cwd; returns **503** on critical failure | Started a dev server with a broken DB and hit it: **HTTP 503**, `status:"unhealthy"`, `failedCritical:["Database"]`, FFmpeg/espeak correctly classed *optional* (degraded, not fatal), `curl -sf` → **exit 22**. The same server served `GET / 200`, so the app itself is sound. The old route would have returned **200/PARTIAL** and `curl -f` exit **0** — CI green on a dead database |
| **CI can no longer report green on a broken deploy** — `.github/workflows/deploy.yml` | `set -euo pipefail`; refuses a non-git or dirty deploy path; prints `prisma migrate diff` **before** `db push`; **hard gate** on `.next/standalone/server.js`; health check that fails the job; automatic rollback to the recorded SHA; pre-deploy `sqlite3 .backup` + `integrity_check`; `concurrency` guard. Not executed (no VPS) |
| **Exposed database removed from the working tree** | `git rm --cached` + deleted `storage/backups/backup_1786236820070.alo.bak` (266,240 B) and its manifest. `git ls-files \| grep storage/backups` → none. **Still in Git history** — a force-push is required and needs your approval |
| **Recurrence prevented** — `.gitignore` | Added `storage/backups/`, `storage/videos/`, `storage/scene-assets/`, `next-env.d.ts`, `*.tsbuildinfo`, `.backups/`, `.releases/`. `git check-ignore -v` confirms a new `.alo.bak` is now excluded. The 19 existing MP4s were **deliberately left tracked** — `MediaGeneration`/`PublishedPost` rows may reference those paths |
| **Docs corrected** | `DEPLOYMENT.md`: real health-check contract, build-time egress requirements, and the fact that the documented rollback was impossible with one commit. `SECURITY.md`: backups are **not** encrypted; records that no credential column exists |
| **New tool for your space choice** | `audit/reclaim-regenerable.sh` — dry-run by default; targets only regenerable artefacts. Tested against a synthetic tree: removed a `node_modules` **with** a lockfile, **preserved** one **without** a lockfile (dependency-drift risk), **preserved** one belonging to a **real running process** (detected via `/proc/<pid>/cwd`), and **truncated** a 5 MB log rather than deleting it — verified the **inode was preserved** (528941 → 528941), which is what actually frees space when a process holds the descriptor open. Reclaimed 6.7 MiB and reported the real `df` delta |

### Step 2 of the exposure plan is closed — no credential rotation is needed

I decoded the public artefact and inspected it **column by column** (values never
printed; decoded copy deleted immediately):

- **No model in `prisma/schema.prisma` has a token, secret, password, or API-key
  column.** Grepping all 27 models returns exactly one field-name match:
  `tokenExpiry DateTime?` — a timestamp.
- `SocialConnection` has **no token column at all**; `scopesJson` was **NULL in
  all 11 rows**. Its 11 rows are platform/account metadata with statuses
  `external_setup_required` ×6 and `connected` ×5.
- Targeted scans returned **zero** matches for Telegram-bot-token shape,
  `ghp_`/`sk-`/`xox*`, and Google/Meta/Slack token prefixes.
- My entropy heuristic initially flagged `id` (cuids) and `status`
  (`external_setup_required`) as secret-shaped. Both are **false positives**.

So steps 1 (privatise) and 3 (purge history) are about **business-data
confidentiality** — 383 rows of analytics, audit log, approvals and content
pipeline — **not an active credential incident.** Full procedure, including the
trap that a force-push to `main` triggers `deploy.yml`, is in
`05-EXPOSURE-REMEDIATION.md`.

### ⚠ GitHub authentication failed during this session

```
$ gh api repos/alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION
{"message":"Bad credentials","status":"401"}
$ git push origin arena/01a09fef-alo-learning-journey-productio
remote: Invalid username or token. Password authentication is not supported for Git operations.
fatal: Authentication failed
```

Even unauthenticated `curl` to `api.github.com` returned `Bad credentials`, so the
sandbox proxy is injecting a token that has expired or been revoked. **Please
reconnect GitHub in Arena.** Earlier calls succeeded — all GitHub evidence in
`02-VERIFIED-FINDINGS.md` §A was captured while they worked.

**Consequence: my work is committed locally but could not be pushed.** Both push
attempts failed *before* any ref was updated, so nothing of mine reached the
remote and **`main` is untouched at `e95b39b` — no deployment was triggered.**
The work is preserved in this workspace as commits on branch
`arena/01a09fef-alo-learning-journey-productio`.

I did **not** change the repository's visibility: that is an account-level action
with side effects (breaks collaborators' clones, stops GitHub Pages) and it is
yours to execute — the exact `gh` command and the web-UI path are in
`05-EXPOSURE-REMEDIATION.md`, along with a check for forks, which stay public
after you privatise the parent.

---

## 1. Canonical GitHub repository and production branch

### ⛔ CANNOT BE DECLARED — and I will not guess

**What is verified:**

| Fact | Evidence |
|---|---|
| Owner `alaminiubateee969-cmd` has exactly **2 public repos** | `gh api users/alaminiubateee969-cmd/repos` |
| `ALO-LEARNING-JOURNEY-PRODUCTION` — created **2026-09-14 09:31:01Z**, pushed 09:46:31Z, default branch `main`, 10,690 KB, **public** | `gh api repos/…/ALO-LEARNING-JOURNEY-PRODUCTION` |
| `ALO-Education_LAST-TRY` — created 2026-06-27, **0 KB, COMPLETELY EMPTY** (HTTP 409 "Git Repository is empty" on `/branches`, `/commits`, `/git/trees`) | `gh api repos/…/ALO-Education_LAST-TRY/branches` |
| `main` HEAD = `e95b39b7a3ae742d0fc2dfa066fb339875c4e604`, confirmed identical from both local and remote | `git rev-parse HEAD` and `git ls-remote origin` |
| **Exactly 1 commit** in the entire history: *"Production: complete ALO Learning Journey platform"* | `git rev-list --count origin/main` → `1` |
| No tags, no releases, no other branches | `git branch -a`, `git show-ref` |
| Remote URL is clean HTTPS — **no embedded credentials or token** | `git remote -v` |

**Why this repo cannot be your upload source:**

You stated `/root/alo-github-main-new` and `/root/ALO-LEARNING-JOURNEY` **were
uploaded** to the VPS from GitHub — completed, past-tense work. But
`ALO-LEARNING-JOURNEY-PRODUCTION` **did not exist until 09:31 UTC today**, and
the only other public repo is empty. A repository created today cannot be the
source of an earlier upload.

So the true origin is one of: **(a)** a private repo invisible to the token
available here; **(b)** a repo under a different GitHub account; **(c)** a repo
since deleted/renamed/privatised. The directory names `alo-github-main` /
`alo-github-main-new` match the shape of a browser **"Download ZIP"** of a `main`
branch (`<repo>-main.zip`) — consistent with an upload that never had Git
metadata at all.

**Provisional statement, clearly labelled as provisional:**
*If* `/root/ALO-LEARNING-JOURNEY` is meant to be this project, then the intended
canonical source is
**`https://github.com/alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION.git`,
branch `main`** — that is the only repository anywhere in reach that contains the
ALO Learning Journey application (Next.js 16 / Prisma / 39 API routes / PM2
`alo-learning-journey` / Caddy `learn.aloeducation.com`). But "intended" is not
"verified as the source of your directories", and the repo's own CI points at a
**different path** than the one you gave me. **I am not treating this as settled.**

### ⚠ A second, independent ambiguity: three claimed deploy paths, two usernames

| Source | Path | User |
|---|---|---|
| Your brief — new project | `/root/ALO-LEARNING-JOURNEY` | `root` |
| Your brief — original source | `/root/alo-github-main-new` | `root` |
| Your earlier audit | `/home/aloeduca/alo-education`, `/home/aloeduca/public_html` | **`aloeduca`** |
| **Repo CI (`deploy.yml`) + `DEPLOYMENT.md`** | **`/home/aloedu/learn-app`** | **`aloedu`** |

`.github/workflows/deploy.yml` runs `cd /home/aloedu/learn-app && git pull origin
main && … && pm2 restart alo-learning-journey` **on every push to `main`**. That
path decides which directory CI overwrites. Deploying to `/root/ALO-LEARNING-JOURNEY`
while CI targets `/home/aloedu/learn-app` yields a directory that looks correct
and a live app that is still running old code. `aloeduca` ≠ `aloedu` — either a
typo, or two real accounts.

### Exact evidence that resolves both questions (read-only, ~10 s on the VPS)

```bash
for d in /root/ALO-LEARNING-JOURNEY /root/alo-github-main-new /home/aloedu/learn-app; do
  echo "=== $d"
  [ -d "$d/.git" ] || { echo "  NO .git — an upload/ZIP extraction. No origin, no branch,"
                        echo "  no commit. It CANNOT pull or push. Do not attribute history to it."; continue; }
  git -C "$d" remote -v                       # scrub any user:token@ before sharing
  git -C "$d" rev-parse --abbrev-ref HEAD
  git -C "$d" rev-parse HEAD
  git -C "$d" log -1 --format='%cI %an %s'
  git -C "$d" status --porcelain=v1 -b | head -30
done
getent passwd aloedu aloeduca                 # do both users really exist?
```

Then compare the VPS commit against `e95b39b7a3ae742d0fc2dfa066fb339875c4e604`.
**Ahead, behind, or diverged all mean different things**, and uncommitted changes
must be preserved — never `reset --hard`'d. If a directory has **no `.git`**, the
correct path is to clone into a **separate staging directory** and leave both
existing directories untouched, as you specified.

**Recommendation:** do not deploy until the answers above are in hand. One
canonical repository, one production branch, one verified deployment source —
none of the three can be named honestly today.

---

## 2. Verified source directory and commit deployed

### ⛔ NOTHING WAS DEPLOYED

No deployment, pull, checkout, build-on-server, restart, or file move was
performed against your VPS. There is no deployed commit to report.

**What was verified locally instead** — the release *candidate*:

| Item | Value |
|---|---|
| Repository | `alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION` |
| Branch | `main` |
| Commit | `e95b39b7a3ae742d0fc2dfa066fb339875c4e604` (1 commit total) |
| Tracked files | 205 |
| Source directory on the VPS | **UNVERIFIED** — see §1 |
| Local checkout state at session start | clean, HEAD == `origin/main` |

**Stack, verified from the repository (audit item 4 — complete):**
Next.js (declared `^16.1.1`, resolved **16.3.5 Turbopack**), `output: "standalone"`,
React 19, TypeScript 5, Tailwind 4 + shadcn/ui, Prisma `^6.11.1` with
**`provider = "sqlite"`** and `url = env("DATABASE_URL")`, **27 models**,
Bun runtime, PM2 app `alo-learning-journey` on **PORT 3017**
(`max_memory_restart: 512M`), Caddy reverse proxy
`learn.aloeducation.com → localhost:3017`, **39 API route handlers**, lockfile
**`bun.lock` only**. **No `Dockerfile` and no `docker-compose` exist anywhere in
the repo** — this is not a containerised deployment.

**Environment variables — names only, values never displayed.** The code's only
direct `process.env.X` read is `NODE_ENV`. `DATABASE_URL` is consumed by Prisma
via `schema.prisma`; `PORT` by Next's standalone server. **Required to boot:
`DATABASE_URL`, `PORT`, `NODE_ENV`.** `NEXTAUTH_URL`/`NEXTAUTH_SECRET` are
**inert** (auth not implemented), and `UPLOAD_DIR`/`VIDEO_DIR` are **inert** —
those identifiers in `src/` are local constants, and every storage path is
hardcoded as `path.join(process.cwd(), "storage", …)`
(`src/app/api/video/generate/route.ts:10`, `src/app/api/backups/route.ts:13`).
**Consequence: the app's data location depends entirely on PM2's working
directory.** Verify `pm_cwd`. Full list of 30 declared names in
`02-VERIFIED-FINDINGS.md` §B.3.

---

## 3. Build, test, migration, health-check and domain-check results

| Stage | Result | Evidence |
|---|---|---|
| Dependency install | ✅ **PASS** — `added 840 packages in 1m` | `npm install`. Caveat: **bun could not be installed** in this sandbox, so npm resolved `^` ranges independently of `bun.lock` |
| Type check @ `e95b39b` | ❌ **FAIL** — 3× `TS2339` | `src/app/api/rag/search/route.ts(35,28)`, `(36,27)`, `(39,27)`: *Property 'title'/'sourceType' does not exist on type '{}'*; `Failed to type check.` Reproduced independently with `npx tsc --noEmit` — **not a bundler or version artefact** |
| Type check after fix | ✅ **PASS** — `tsc --noEmit` exit 0, zero errors | 1-line change, see below |
| Turbopack compile | ✅ **PASS** — `✓ Compiled successfully in 829ms` | build log |
| Full `next build` | ⛔ **COULD NOT COMPLETE** (sandbox egress) | `Collecting page data … Error: @prisma/client did not initialize yet` → `prisma generate` cannot reach `binaries.prisma.sh` (`curl` → `000`, `SSL_ERROR_SYSCALL`). Separately, `next/font/google` (Geist, Geist_Mono) cannot reach `fonts.googleapis.com` (`000`). Control: `registry.npmjs.org` → `200`. Also tried `PRISMA_CLIENT_ENGINE_TYPE=wasm` despite bundled WASM engines — `prisma generate` still requires the CDN |
| `.next/standalone` produced | ❌ **NO** | `ls .next/standalone` → *No such file or directory* |
| Tests | ⛔ **NONE EXIST** | no `"test"` script in `package.json`; no jest/vitest/playwright/cypress config; no `__tests__`, `*.test.*` or `*.spec.*` among 205 tracked files. I will not report a test pass that never happened |
| Lint | ⏸ **NOT RUN** | `npm run lint` available on request; would not change any decision |
| Migrations | ⚠ **NONE EXIST** | `prisma/` contains only `schema.prisma`. **No `prisma/migrations/`, no `migration_lock.toml`.** Schema is applied via `prisma db push`; `package.json` `db:push` = `prisma db push **--accept-data-loss**`; `deploy.yml` runs `bunx prisma db push` **unattended on every push to `main`**. No schema history ⇒ **no schema rollback**. **I ran no migration.** |
| Health check (code review) | ❌ **UNRELIABLE BY CONSTRUCTION** | `src/app/api/health/route.ts` returns a **hardcoded literal array** — `Database: ok: true` is never a query. `FFmpeg`/`GD`/`exec`/`Sendmail` are hardcoded `false`, so it **always** returns `"status":"PARTIAL"`, even on a healthy box. `DEPLOYMENT.md` documents `PARTIAL` as "Expected". CI does `curl -sf … \|\| echo "HEALTH CHECK FAILED"` — `-f` only fails on HTTP ≥ 400 and this route always returns **200**, and `\|\| echo` **exits 0 regardless**, so the workflow reports **green even when unhealthy** |
| Health check (live) | ⛔ **BLOCKED** | Not on the VPS. No HTTP probe of your server was possible |
| Domain checks | ⛔ **BLOCKED** | `learn.aloeducation.com` etc. were **not** probed. `Caddyfile` *declares* `learn.aloeducation.com → localhost:3017`, but a declaration in a repo is **not** proof of live proxy config. You correctly warned against inferring the live app from an unused port — the same discipline applies to inferring it from a committed `Caddyfile` |
| Database connectivity (live) | ⛔ **BLOCKED** | No DB reachable. Type/target/strategy verified from repo only |
| Secret scan | ✅ **DONE** | No `.env` tracked (only `.env.example`); no `.pem`/`.key`/`.crt`/`.p12`/`.pfx`; no `AKIA…`/`ghp_…`/`github_pat_…`/`xox…`/PEM-private-key/DSN-with-password matches in any of 205 tracked files; no hardcoded credential assignments in `src/**`; remote URL credential-free. **One exception:** the obfuscated SQLite database in §5/F4, which a pattern scan cannot flag |

### The one code change I made (fix for the build blocker)

```diff
--- a/src/app/api/rag/search/route.ts
+++ b/src/app/api/rag/search/route.ts
@@ -16,7 +16,7 @@ export async function POST(req: Request) {
   const chunks = await db.ragChunk.findMany();
   const docs = await db.ragDocument.findMany();
-  const docMap = new Map(docs.map((d) => [d.id, d]));
+  const docMap = new Map<string, (typeof docs)[number]>(docs.map((d) => [d.id, d]));
```

**Root cause:** `docs.map(d => [d.id, d])` produces `(string | RagDocument)[][]`
— an array of *arrays*, not *tuples* — so TypeScript collapses the `Map` value
type and `.get()` returns `{}`, breaking lines 35/36/39.

**Why it is deploy-critical, not cosmetic:** `output: "standalone"` +
`ecosystem.config.js` → `script: '.next/standalone/server.js'`. A failed type
check produces **no `.next/standalone`**, so `pm2 restart` targets a
non-existent file and CI's fallback `bun run start`
(`bun .next/standalone/server.js`) fails too. Since `deploy.yml` does `git pull`
**before** building, one push to `main` can leave the live app unable to restart.

**State:** on branch `arena/01a09fef-alo-learning-journey-productio` only.
**Not merged to `main`, not pushed to a deploy trigger, not deployed.** Merging
would fire `deploy.yml` against `/home/aloedu/learn-app`, so it must wait until
§1's path question is answered and a backup exists. **Approval required.**

Also performed and **fully reverted**: a temporary stub of the two
`next/font/google` calls, used solely to isolate whether anything *else* broke
the build. Restored via `git checkout -- src/app/layout.tsx` and confirmed
(`import { Geist, Geist_Mono } from "next/font/google";` is back at line 2;
`git status` shows the file unmodified). Byproducts of my build
(`package-lock.json`, `next-env.d.ts`, `tsconfig.tsbuildinfo`, `.next/`) were
removed — the project standardises on `bun.lock`.

**Final tree:**
```
$ git status --porcelain=v1 -b
## arena/01a09fef-alo-learning-journey-productio
 M src/app/api/rag/search/route.ts     ← the build fix
?? audit/                              ← these reports + the two scripts
```

---

## 4. Is rollback available, and how do you use it?

### ⛔ NO — not as currently configured

**The documented rollback cannot work.** `DEPLOYMENT.md` says:

```bash
cd /home/aloedu/learn-app
git checkout PREVIOUS_COMMIT_SHA
```

But `git rev-list --count origin/main` = **1**. There is exactly one commit.
**There is no previous commit to check out.** No tags, no releases, no other
branches.

**And the deploy is not atomic.** `deploy.yml` mutates the live directory in
place — `git pull` → `bun install` → `prisma db push` → `bun run build` →
`pm2 restart`. No `releases/`, no symlink swap, no pre-deploy backup. Combined
with F2 (build currently fails) and F8 (unattended destructive-capable schema
push running *before* the build), the reachable sequence on a push to `main`
today is: pull new source → push schema changes into production SQLite → fail the
build → no `.next/standalone` → PM2 cannot restart. **That is a full outage path
one `git push` away.**

**Also unverified:** whether *any* restorable backup exists on the VPS. Audit
item 8 is blocked. The one backup I could inspect — the committed
`storage/backups/backup_1786236820070.alo.bak` — is **not usable**: it holds
**15 tables** against the schema's **27 models** (missing `Department`,
`AgentEmployee`, `LoopCycle`, `FamilyProfile`, `FamilyReferenceAsset`,
`FamilyProject`, `MediaGeneration`, `ContentOpportunityScore`, `HookTest`,
`Campaign`, `InkboxIntegration`, `AgentMessage`), and its own manifest says
`createdAt: 2026-08-09` with `retentionDays: 14` — **expired 2026-08-23**.

### Rollback capability must be built first

`03-DEPLOY-ROLLBACK-RUNBOOK.md` specifies it:

- **§1** — `releases/<ts>-<sha>/` + `shared/{.env,db,storage}` + a `current`
  symlink; PM2 pinned with an explicit `cwd` (necessary because all storage paths
  are `process.cwd()`-relative).
- **§2** — a **blocking backup gate**: consistent SQLite copy via
  `sqlite3 .backup` (**not** `cp`, which can capture a half-written page),
  `PRAGMA integrity_check` must print `ok`, schema fingerprint before/after,
  app tarball, and a **restore test** (`select count(*)` must return a number).
  A backup you have not restored is an assumption.
- **§4 fast rollback** — `pm2 stop` → `ln -sfn <PREV> current` → `pm2 restart`.
  Seconds, no rebuild. The previous release path is recorded before every swap.
- **§4 full rollback** — needed if `db push` altered the schema: swap the
  symlink **and** restore the DB, verifying `integrity_check` = `ok` on both the
  backup and the restored file. The suspect DB is **moved aside, never deleted**.
- **§3.1** — replace blind `db push` with `prisma migrate diff --script` read by
  a human first; adopt real `prisma migrate deploy` migrations for genuine schema
  rollback.

Keep the last 3–5 releases on disk. Until §1–§2 are in place, **rollback =
restore from an off-server backup**, and that backup does not yet demonstrably
exist.

---

## 5. Files/directories moved to quarantine or deleted

### ⛔ NONE on your VPS. Zero.

No file or directory on your VPS was moved, quarantined, renamed, modified, or
deleted. No service was stopped or restarted. No DNS, SSL, firewall, or proxy
configuration was changed. No database was touched. No `git reset --hard`, no
`git clean`, no force-push, no branch switch, no working-tree overwrite.

> **Update:** after your direction to proceed with repo-side work, two files
> *inside the Git repository* were removed from the working tree — the exposed
> `storage/backups/backup_1786236820070.alo.bak` and its `.json` manifest. That
> is a source-control change on my branch, reversible with `git checkout`, and
> **not** a VPS cleanup action. Everything below still stands for the server.

**In this sandbox**, the only filesystem changes were inside the repository
checkout and are all reported above: one 1-line source fix (§3), the new
`audit/` directory (7 files), and removal of my own build byproducts.
`/tmp/alo-selftest`, the decoded backup copy, and the temporary font patch were
all cleaned up.

### Tooling prepared and tested, awaiting your approval to run on the VPS

| Script | Verified behaviour |
|---|---|
| `audit/vps-readonly-audit.sh` | `bash -n` clean. **Executed end-to-end here**: exit 0, **all 11 report sections produced**, correctly reported every VPS path as `PATH DOES NOT EXIST`, and a scan of its own output for `password/secret/token = <value>` found **no secret leakage**. Performs no writes outside its report, no `git fetch`, no installs, no restarts. `.env` files yield **variable names only**; Git remotes and DSNs are credential-scrubbed |
| `audit/cleanup-quarantine.sh` | `bash -n` clean. **Executed end-to-end in dry run**: exit 0, wrote a proposal Markdown, correctly classified all 9 candidates as `ABSENT`/`NO ACTION`, moved nothing, and confirmed `/root` was untouched. **Contains no `rm` at all** — its only mutating operation is `mv` into a `chmod 700` dated quarantine, guarded by a same-device check and a hard-block list re-evaluated immediately before each move |

Both hard-block `public_html`, live docroots, SSL paths, `.env`/secrets, database
files, systemd/PM2 working dirs, and anything a running process has open —
**even if you name them explicitly on the command line.**

Cleanup classification method, the four evidence tests, and the per-candidate
evidence gaps (including why `/home/aloeduca/ssl/.well-known.zip` is the
highest-caution archive, and why `/root/ALO-FULL-SOURCE 2.zip` is protected from
"duplicate" logic without a SHA-256-proven surviving twin) are in
`04-CLEANUP-PLAN.md`.

---

## 6. Disk usage before and after cleanup

### ⛔ NOT MEASURABLE — no cleanup occurred, and your VPS was never reachable

The only disk I can see is this sandbox's, and **reporting it as your server's
would be fabrication**:

```
Filesystem      Size  Used Avail Use% Mounted on
/dev/root        21G  846M   20G   5% /
```

For contrast: your prior audit described ~3.3 GB + ~3.1 GB + several ~1.2 GB
archives — roughly 10 GB of archives alone, which cannot fit in a 21 GB sandbox
showing 846 MB used. Those figures are recorded as **unverified prior
observations** and must be re-measured, as you instructed.

**Before/after will come from** `vps-readonly-audit.sh` §1 (`df -hT`, plus
`df -i` because a full inode table mimics "no space") and §9 (largest
directories/files under `/root`, `/home`, `/var/www`, `/opt`, `/srv`,
`/usr/local`, and every `node_modules` footprint). `cleanup-quarantine.sh` then
prints `df -h` immediately after any move.

⚠ **One expectation to set now:** quarantine **reclaims zero bytes**. A
same-device `mv` changes only directory entries. The proposal deliberately
reports two separate numbers — *"quarantined"* and *"reclaimed after purge"* —
so you are never misled. Space returns only at the separate, later, manual purge
step, after the site/CRM/login/API/cert-renewal checks have passed and a soak
period has elapsed. If you need space back *immediately*, say so and I will
propose a targeted plan with verified independent backups first — but that trades
reversibility for bytes, and it is your call, not mine.

---

## 7. Remaining risks, unresolved questions, and actions requiring your approval

### 7a. Risks found in the repository (verified, with evidence)

Full detail in `02-VERIFIED-FINDINGS.md`.

| ID | Sev | Finding |
|---|---|---|
| **F1** | **CRITICAL** | `/api/health` returns a **hardcoded** array — `Database: ok: true` is never a query; `FFmpeg`/`GD`/`exec`/`Sendmail` hardcoded `false` so it **always** says `"status":"PARTIAL"`. CI's `curl -sf … \|\| echo` always exits 0. **You have no working signal that a deploy succeeded.** A green Actions run means only that the SSH script ran |
| **F2** | **CRITICAL** | Production commit **fails `next build`** (TS2339). No `.next/standalone` ⇒ PM2's `script` path does not exist. **Fixed and verified on my branch; not merged, not deployed** |
| **F3** | HIGH | Build needs `binaries.prisma.sh` **and** `fonts.googleapis.com` at build time; both run **on the VPS** in the documented pipeline. `layout.tsx` also hotlinks Hind Siliguri from Google at **runtime** — the Bengali UI font |
| **F4** | HIGH | **A real 266,240-byte SQLite DB is committed to a PUBLIC repo**, XOR-obfuscated with `Buffer.from("alo-backup-2024")` — a key **hardcoded in that same public source**, beside the comment *"not real crypto — marker only"*. Decodes to a valid `SQLite format 3` file, **383 rows / 15 tables** (AnalyticsSnapshot 315, AuditLog 13, SocialConnection 11, ApprovalItem 11, CommentInbox 8, …). Its manifest claims **`"encrypted": true` — it is not.** Credential scan of the decoded DB found **0** Telegram-bot-token-shaped, **0** `ghp_`/`sk-`/`xox-` strings; the 4 `token` hits are the column name `tokenExpiry` and one log-style string ⇒ **no credential leak confirmed**, but `SocialConnection`'s 11 rows are exactly where OAuth tokens would live and I did not dump row data. Business/operational data is publicly downloadable today |
| **F5** | HIGH | **39 unauthenticated API routes.** `SECURITY.md`: auth `NOT_IMPLEMENTED`, *"all API routes are open"*, no CSRF, no rate limiting, *"requires auth middleware before going live"*. `Caddyfile` adds headers only. Destructive handlers: `api/backups` **DELETE** does `fs.unlink` on your backups — an anonymous request can delete them; plus `api/family-studio`, `api/images/generate`, `api/notifications`, `api/video/*`, and `api/seed` |
| **F6** | MED | `.gitignore` gaps: **`storage/backups/` not ignored** (⇒ F4), **`storage/videos/` not ignored** (⇒ 19 generated MP4s, 19 MB; largest tracked file `video_1788962720635.mp4`, 4.5 MB), nor `next-env.d.ts` / `tsconfig.tsbuildinfo`. Baseline is otherwise good (`.env*`, keys, `*.db`/`*.sqlite*` all covered) |
| **F7** | MED | **No tests of any kind** |
| **F8** | MED | Default DB script is `prisma db push **--accept-data-loss**`; CI runs `db push` unattended on every push to `main`; **no migrations dir ⇒ no schema rollback** |
| **F9** | MED | Backups read a **hardcoded** `<cwd>/db/custom.db` while Prisma uses `DATABASE_URL`. If they disagree, every backup silently falls into the `catch` and writes a **manifest-only `"partial"`** file — the backup feature produces nothing restorable while appearing to work. (The F4 artefact did contain a full DB, so they agreed on 2026-08-09. **Unverified for today.**) |
| **F10** | MED | **No atomic release and no possible rollback** — in-place deploy, 1 commit in history |
| **F11** | LOW | `package.json` name is still the scaffold `nextjs_tailwind_shadcn_ts`; no `engines`/`packageManager` despite requiring Bun + Node 22+; repo public; 2 Turbopack warnings (`family-studio/route.ts:174,242`) cause the **whole project** to be traced into the standalone output |

### 7b. Unresolved questions — each blocks a specific step

| # | Question | Blocks | Resolved by |
|---|---|---|---|
| Q1 | Which GitHub repo/branch/commit are the two VPS directories actually from? Do they even have `.git`? | Naming a canonical source; any pull/checkout | §1 command block |
| Q2 | Is the deploy target `/root/ALO-LEARNING-JOURNEY` or `/home/aloedu/learn-app`? Do users `aloedu` **and** `aloeduca` both exist? | Deploying to the right place; knowing what CI overwrites | §1 + `getent passwd` |
| Q3 | **Which application serves the public website and the CRM?** What are the real vhost `DocumentRoot`/`root` values and upstreams? | Items 6–7; protecting the live system; safe cleanup | audit §6–§7 |
| Q4 | What is actually running — systemd units, PM2 (`pm_cwd`, `PORT`, restarts), Docker, listening ports? | Item 5; knowing what must not be stopped | audit §5 |
| Q5 | Real DB: engine, `DATABASE_URL` target path, does it match `<pm_cwd>/db/custom.db` (F9), current table count vs 27 models? | Item 8; migration plan; backup validity | audit §8 |
| Q6 | **Does a verified, restorable backup exist anywhere — ideally off-server?** | §4 rollback; the P5/P6 deploy gate | audit §8 + runbook §2 |
| Q7 | Re-measured sizes and `atime` for every cleanup candidate; are the archives SHA-256-identical? | Items 9–10; any quarantine | audit §9–§11, `--checksums` |
| Q8 | Can the VPS reach `binaries.prisma.sh` and `fonts.googleapis.com`? | Whether the build can succeed at all (F3) | two `curl` checks, §C.3 |
| Q9 | What is inside `/home/aloeduca/ssl/.well-known.zip`, and does cert renewal depend on that path? | Whether that 3.1 GB archive can ever be touched | `unzip -l` + audit T1 |
| Q10 | Is the CRM a separate application (e.g. PHP/Laravel under `public_html`)? | Scope of "verify the CRM"; whether this deploy touches it at all | audit §3 fingerprints `composer.json` vs `package.json` per directory |

### 7c. Actions requiring your explicit approval

I have performed none of these.

1. **Approve the F2 build fix** (merge the 1-line change). Note that merging to
   `main` **triggers `deploy.yml`** against `/home/aloedu/learn-app` — so this
   should not be merged until Q2 is answered and the §2 backup gate has passed.
   Alternative: I can hold it on the branch and you apply it manually on the VPS.
2. **Choose an unblock path** (A/B/C in `01-ACCESS-BLOCKER.md`) so the real
   items 1–10 can be produced.
3. **F4 remediation** — make the repo private, and/or remove
   `storage/backups/` from Git. Removing it from the working tree is **not
   enough**: it remains in history, so full remediation needs `git filter-repo`
   plus a **force-push to `main`** — a destructive history rewrite I will not
   attempt without explicit approval *and* a verified mirror backup of the repo
   first. Also: verify whether `SocialConnection` ever held live OAuth tokens and
   **rotate** them if so; replace XOR with real AES-256-GCM (or stop committing
   backups).
4. **F5 auth decision** before this app is publicly reachable — auth middleware,
   or a proxy-level allowlist / VPN. `SECURITY.md` itself says it must not go
   live without this.
5. **F1 health check** — rewrite it to actually query the DB and return non-200 on
   failure, and change CI to `|| exit 1`. This changes deployed behaviour, so it
   needs your sign-off.
6. **F8/F9/C.6** — adopt real Prisma migrations (`migrate deploy`) and align the
   backup path with `DATABASE_URL`.
7. **F6** — add `storage/backups/`, `storage/videos/`, `next-env.d.ts`,
   `tsconfig.tsbuildinfo` to `.gitignore`.
8. **Any quarantine execution** — `cleanup-quarantine.sh --execute`, after you
   read the dry-run proposal row by row.
9. **Any permanent deletion** — a separate, later step, after post-deploy
   verification and a soak period.
10. **F3 hardening** — self-host Geist/Geist Mono and Hind Siliguri via
    `next/font/local`, and pre-cache Prisma engines, so builds stop depending on
    two third-party CDNs.

### 7d. Standing instructions I honoured

Read-only audit and safe non-destructive checks only; no irreversible cleanup; no
destructive DB change; no force-push; no unverified production replacement. Both
protected directories were treated as protected — and since neither exists here,
neither was touched at all. Where a critical fact was unknown I **stopped that
operation, preserved everything, and recorded the exact command or evidence
needed**, which is what §7b and `01-ACCESS-BLOCKER.md` are. No secret, password,
token, or `.env` content appears anywhere in these reports.
