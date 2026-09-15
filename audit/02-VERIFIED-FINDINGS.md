# 02 — VERIFIED FINDINGS (repository + GitHub side)

Everything in this document was **directly observed**, not inferred. Each item
carries the command or file:line that proves it. Items that could not be
verified are labelled **UNVERIFIED** and say what evidence is missing.

Scope of this document: the canonical GitHub source, the declared deployment
configuration, the runtime stack, the database strategy, secret posture, and the
build/test verification I was able to perform in this sandbox.

---

## §A — Canonical GitHub source

### A.1 The owner has exactly two public repositories

`gh api "users/alaminiubateee969-cmd/repos?per_page=100&sort=updated"`

| Repository | Created (UTC) | Last push | Default branch | Size | State |
|---|---|---|---|---|---|
| `ALO-LEARNING-JOURNEY-PRODUCTION` | **2026-09-14 09:31:01** | 2026-09-14 09:46:31 | `main` | 10,690 KB | **PUBLIC**, 0 open issues |
| `ALO-Education_LAST-TRY` | 2026-06-27 23:07:09 | 2026-06-27 23:07:09 | `main` | **0 KB** | **PUBLIC and COMPLETELY EMPTY** |

`ALO-Education_LAST-TRY` returns HTTP **409 "Git Repository is empty"** for
`/branches`, `/commits` and `/git/trees`. It has no branches and no commits.
**It cannot be a deployment source under any circumstances.**

### A.2 The production repository state

```
$ git ls-remote origin
e95b39b7a3ae742d0fc2dfa066fb339875c4e604    HEAD
e95b39b7a3ae742d0fc2dfa066fb339875c4e604    refs/heads/main

$ git rev-list --count origin/main
1

$ git log --oneline -12
e95b39b Production: complete ALO Learning Journey platform
```

- Remote: `https://github.com/alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION.git`
  — **clean HTTPS, no embedded username, token, or credentials.** Safe to display.
- Branches: `main` only (plus this session's working branch
  `arena/01a09fef-alo-learning-journey-productio`). `origin/HEAD -> origin/main`.
- Tags: none. Releases: none.
- Local checkout HEAD matched `origin/main` exactly; working tree was **clean**
  before I touched anything.
- 205 tracked files, 10.7 MB.

### A.3 ⚠ The timeline makes this repo *incapable* of being your upload source

You said `/root/alo-github-main-new` and `/root/ALO-LEARNING-JOURNEY` **"were
uploaded to the VPS from GitHub"** — past tense, describing work already done.

`ALO-LEARNING-JOURNEY-PRODUCTION` was **created today, 2026-09-14 at 09:31 UTC**,
roughly three hours before this session, and holds a **single squashed commit**.
A repository that did not exist until today cannot have been the source of an
earlier upload. The only other public repo is empty.

Therefore the true origin of those two VPS directories is one of:

1. a **private** repository, invisible to the token available here;
2. a repository under a **different GitHub account** (the directory names
   `alo-github-main` / `alo-github-main-new` are exactly what a browser
   *"Download ZIP"* of a `main` branch produces — `…-main.zip` — so a ZIP
   download of some repo's `main` is very likely);
3. a repository that has since been **deleted, renamed, or made private**.

**I will not name a canonical source. Doing so would be a guess.**

**Evidence that resolves this in one step** — run on the VPS:

```bash
for d in /root/ALO-LEARNING-JOURNEY /root/alo-github-main-new; do
  echo "=== $d"
  [ -d "$d/.git" ] || { echo "  NO .git — not a working tree, cannot report origin"; continue; }
  git -C "$d" remote -v          # scrub any user:token@ before sharing
  git -C "$d" rev-parse HEAD
  git -C "$d" log -1 --format='%cI %an %s'
done
```

If a directory has **no `.git`**, it is a ZIP extraction or an `rsync`/`scp`
copy. It has no origin, no branch, and no commit — and it **cannot pull or
push**. In that case the only safe way to get a Git-tracked release onto the VPS
is to clone into a **separate staging directory** and leave both existing
directories untouched, exactly as you specified.

### A.4 ⚠ The repository contradicts your stated deployment path

Your brief says the new project directory is `/root/ALO-LEARNING-JOURNEY`.
The repository's own deployment configuration says something different:

`.github/workflows/deploy.yml`
```yaml
script: |
  cd /home/aloedu/learn-app
  git pull origin main
  bun install --frozen-lockfile
  bunx prisma generate
  bunx prisma db push
  bun run build
  pm2 restart alo-learning-journey || pm2 start "bun run start" --name alo-learning-journey
```

`DEPLOYMENT.md`
```
- VPS_APP_PATH: /home/aloedu/learn-app
## Rollback
cd /home/aloedu/learn-app
git checkout PREVIOUS_COMMIT_SHA
```

So we have **three** different claimed locations, and **two** different usernames:

| Source | Path | Username |
|---|---|---|
| Your brief (new project) | `/root/ALO-LEARNING-JOURNEY` | `root` |
| Your brief (original source) | `/root/alo-github-main-new` | `root` |
| Your earlier audit | `/home/aloeduca/alo-education`, `/home/aloeduca/public_html` | `aloeduca` |
| **Repo CI + DEPLOYMENT.md** | **`/home/aloedu/learn-app`** | **`aloedu`** |

`aloeduca` ≠ `aloedu`. One of these is a typo, or there are genuinely two
accounts (a cPanel account `aloeduca` plus an app user `aloedu`). This is not
cosmetic: **the deploy path decides which directory CI overwrites on every push
to `main`.** Deploying to the wrong one leaves the live app on old code while the
new directory looks correct.

**UNVERIFIED — needs the VPS.** Resolve with §C.3 question 4 in
`01-ACCESS-BLOCKER.md` (the `grep -rniE 'alo|learn-app'` across web/service
config).

---

## §B — Application manifest and runtime stack (verified from the repo)

### B.1 Stack

| Aspect | Verified value | Evidence |
|---|---|---|
| Framework | Next.js, declared `^16.1.1`; resolved **16.3.5 (Turbopack)** in my install | `package.json`; build log `▲ Next.js 16.3.5 (Turbopack)` |
| Output mode | **`output: "standalone"`** | `next.config.ts` |
| UI | React 19, TypeScript 5, Tailwind 4, shadcn/ui (Radix), next-intl, recharts | `package.json`, `components.json` |
| ORM / DB | Prisma `^6.11.1`, **datasource provider `sqlite`**, `url = env("DATABASE_URL")` | `prisma/schema.prisma:12-13` |
| Schema size | 14,520 bytes, **27 models** | `grep -c '^model ' prisma/schema.prisma` |
| Runtime | **Bun** (`bun install`, `bun .next/standalone/server.js`) | `package.json` scripts, `DEPLOYMENT.md` |
| Process manager | **PM2**, app `alo-learning-journey`, `PORT: 3017`, `max_memory_restart: '512M'`, `instances: 1` | `ecosystem.config.js` |
| Reverse proxy | **Caddy**: `learn.aloeducation.com` → `reverse_proxy localhost:3017`, gzip, security headers | `Caddyfile` |
| Containerisation | **NONE. No `Dockerfile`, no `docker-compose*` anywhere in the repo** | `find . -iname 'Dockerfile*' -o -iname 'docker-compose*'` → empty |
| API surface | **39 `route.ts` handlers** under `src/app/api` | `find src/app/api -name route.ts \| wc -l` |
| Node present here | v22.22.3, npm 10.9.8 (**bun NOT installed** in sandbox) | `node -v`, `npm -v` |
| Lockfile | **`bun.lock` only** (328 KB). No `package-lock.json`, no `yarn.lock` | `ls` |

`DEPLOYMENT.md` also lists FFmpeg + espeak as prerequisites (video/Bengali TTS
features). Note `src/app/api/health/route.ts` reports FFmpeg and
`exec/shell_exec` as **`ok: false` / "disabled in sandbox"** — see F1.

### B.2 The 27 Prisma models

```
Company AIAgentRun ContentIdea ContentPackage ApprovalItem SocialConnection
RagDocument RagChunk AnalyticsSnapshot TelegramCommand AuditLog Notification
FamilyModel PublishedPost CommentInbox Department AgentEmployee LoopCycle
FamilyProfile FamilyReferenceAsset FamilyProject MediaGeneration
ContentOpportunityScore HookTest Campaign InkboxIntegration AgentMessage
```

### B.3 Environment variables — NAMES only, values never displayed

`.env.example` is the only `.env*` file tracked in Git (`.env` and `.env.*` are
gitignored, `!.env.example` re-includes the template). No real `.env` exists in
this checkout.

Declared in `.env.example`:

- **Uncommented:** `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`,
  `UPLOAD_DIR`, `VIDEO_DIR`, `PORT`, `NODE_ENV`
- **Commented/optional:** `OPENAI_API_KEY`, `FACEBOOK_APP_ID`,
  `FACEBOOK_APP_SECRET`, `INSTAGRAM_APP_ID`, `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `TIKTOK_CLIENT_KEY`, `LINKEDIN_CLIENT_ID`,
  `TWITTER_CLIENT_ID`, `PINTEREST_APP_ID`, `TWILIO_ACCOUNT_SID`,
  `TWILIO_AUTH_TOKEN`, `WHATSAPP_BUSINESS_TOKEN`, `RESEND_API_KEY`, `SMTP_HOST`,
  `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `TELEGRAM_BOT_TOKEN`,
  `TELEGRAM_ALLOWED_CHAT_IDS`, `INKBOX_ENDPOINT`, `INKBOX_API_KEY`

**⚠ What the code actually reads** (`grep -ohE "process\.env\.[A-Z_][A-Z0-9_]*"`
across all tracked files):

```
NODE_ENV
```

That is the **only** direct `process.env.X` reference in the entire codebase.
Consequences you should know before validating env on the VPS:

- **`DATABASE_URL`** *is* required — but consumed by Prisma through
  `schema.prisma`'s `env("DATABASE_URL")`, not by application code. Absent or
  wrong, the client fails at import time (this is exactly the failure mode in F3).
- **`PORT`** *is* honoured — by Next's standalone `server.js`, not by app code.
- **`NEXTAUTH_URL` / `NEXTAUTH_SECRET` are inert.** `next-auth@^4.24.11` is a
  declared dependency, but `SECURITY.md` states authentication is
  `NOT_IMPLEMENTED` and no auth code references these. Do not "fix" a login
  problem by editing them.
- **`UPLOAD_DIR` / `VIDEO_DIR` are inert.** The strings `VIDEO_DIR` (10×) and
  `UPLOAD_DIR` (2×) in `src/` are **local constant names**, not env lookups:
  ```ts
  // src/app/api/video/generate/route.ts:10
  const VIDEO_DIR = path.join(process.cwd(), "storage", "videos");
  // src/app/api/backups/route.ts:13
  const BACKUP_DIR = path.join(process.cwd(), "storage", "backups");
  ```
  **All storage paths are hardcoded relative to `process.cwd()`.** So the app's
  uploads, videos and backups land wherever PM2's working directory is. If PM2
  starts the app from a different `cwd` than the deployed repo root, generated
  media and backups silently go somewhere else — and the committed
  `storage/` content is not used. **Verify `pm_cwd` on the VPS** (the audit
  script prints it from `pm2 jlist`).
- The remaining ~23 variables (SMTP, Twilio, WhatsApp, Telegram, OAuth, Inkbox,
  OpenAI) are documented as optional and gate features that report
  `EXTERNAL_SETUP_REQUIRED`. Setting them is not required to boot.

**Required-to-boot set, therefore: `DATABASE_URL`, `PORT`, `NODE_ENV`.**

---

## §C — Build / test / migration verification (performed here)

### C.1 Dependency install — ✅ PASS

```
$ npm install --no-audit --no-fund
added 840 packages in 1m
```

Caveat: the project's lockfile is `bun.lock`, and **bun could not be installed
in this sandbox** (the `bun.sh` installer returned nothing; `command -v bun` →
not installed). I therefore installed with npm, which resolves the `^` ranges in
`package.json` **independently of `bun.lock`**. My versions may differ from the
locked ones — notably Next resolved to 16.3.5. Any finding below that could be
version-sensitive is flagged as such. The TypeScript error in F2 is **not**
version-sensitive: it reproduces under standalone `tsc --noEmit`.

### C.2 Type check — ❌ FAIL at the production commit, ✅ PASS after a 1-line fix

At `e95b39b`, unmodified:

```
$ npm run build
▲ Next.js 16.3.5 (Turbopack)
✓ Compiled successfully in 792ms
  Running TypeScript ...
src/app/api/rag/search/route.ts(35,28): error TS2339: Property 'title' does not exist on type '{}'.
src/app/api/rag/search/route.ts(36,27): error TS2339: Property 'sourceType' does not exist on type '{}'.
src/app/api/rag/search/route.ts(39,27): error TS2339: Property 'title' does not exist on type '{}'.
Failed to type check.
```

Reproduced independently of Next, so it is not a bundler or version artefact:

```
$ npx tsc --noEmit
src/app/api/rag/search/route.ts(35,28): error TS2339: Property 'title' does not exist on type '{}'.
src/app/api/rag/search/route.ts(36,27): error TS2339: Property 'sourceType' does not exist on type '{}'.
src/app/api/rag/search/route.ts(39,27): error TS2339: Property 'title' does not exist on type '{}'.
```

**Root cause** — `src/app/api/rag/search/route.ts:19`:

```ts
const docMap = new Map(docs.map((d) => [d.id, d]));
```

`docs.map(d => [d.id, d])` yields `(string | RagDocument)[][]` — an array of
arrays, **not** an array of tuples. TypeScript therefore infers
`Map<string | RagDocument, string | RagDocument>` and collapses the value type;
`docMap.get(...)` returns something without `.title` / `.sourceType`. Lines 35,
36 and 39 then fail.

**Fix applied on branch `arena/01a09fef-alo-learning-journey-productio`:**

```diff
-  const docMap = new Map(docs.map((d) => [d.id, d]));
+  const docMap = new Map<string, (typeof docs)[number]>(docs.map((d) => [d.id, d]));
```

Result:

```
$ npx tsc --noEmit
$ echo $?
0            # no output, no errors
```

This is the **only** source change I made. It is on my session branch, **not
merged to `main`, not pushed to a deployment trigger, not deployed anywhere.**
It needs your approval.

### C.3 Full production build — ❌ COULD NOT COMPLETE (sandbox egress), ⚠ real VPS risk

With the type error fixed, compilation succeeds but the build still fails:

```
✓ Compiled successfully in 829ms
  Finished TypeScript in 3.2s
  Collecting page data using 1 worker ...
Error: Failed to collect configuration for /api/activity
  [cause]: Error: @prisma/client did not initialize yet.
           Please run "prisma generate" and try to import it again.
    at module evaluation (src/lib/db.ts:9:3)
> Build error occurred
Error: Failed to collect page data for /api/activity

$ ls .next/standalone
ls: cannot access '.next/standalone': No such file or directory
```

**Cause:** `prisma generate` cannot fetch its engines, and this sandbox blocks
the host:

```
$ npx prisma generate
Error: request to https://binaries.prisma.sh/all_commits/c2990dca…/debian-openssl-3.0.x/schema-engine.gz.sha256
       failed, reason: Client network socket disconnected before secure TLS connection was established

$ curl -sS -o /dev/null -w '%{http_code}' https://binaries.prisma.sh/     → 000  (SSL_ERROR_SYSCALL)
$ curl -sS -o /dev/null -w '%{http_code}' https://fonts.googleapis.com/    → 000  (SSL_ERROR_SYSCALL)
$ curl -sS -o /dev/null -w '%{http_code}' https://registry.npmjs.org/      → 200  (control: works)
```

I also attempted the offline path — the npm package *does* ship WASM engines
(`node_modules/@prisma/client/runtime/query_engine_bg.sqlite.wasm-base64.js`),
so I retried with `PRISMA_CLIENT_ENGINE_TYPE=wasm`. `prisma generate` still
insists on `binaries.prisma.sh`. Build failed identically. Dead end here.

**A second, independent egress dependency** also breaks the build:
`src/app/layout.tsx:2` imports `next/font/google`

```ts
import { Geist, Geist_Mono } from "next/font/google";
```

`next/font/google` downloads font files **at build time**. With no route to
`fonts.googleapis.com`:

```
Error: Turbopack build failed with 2 errors:
Error: next/font: error: Failed to fetch Geist from Google Fonts.
Error: next/font: error: Failed to fetch Geist Mono from Google Fonts.
```

To isolate whether anything *else* was wrong, I temporarily stubbed those two
font calls, ran the build, then **reverted the file with `git checkout --
src/app/layout.tsx`** (verified: `import { Geist, Geist_Mono } from
"next/font/google";` is back at line 2, and `git status` shows `layout.tsx`
unmodified). That stub is *not* part of any proposed change.

**Honest status:** the full production build is **UNVERIFIED**. I proved
dependencies install, TypeScript passes, and Turbopack compiles. I could not
prove `.next/standalone` is produced, because two external hosts are unreachable
from this sandbox. **This is a sandbox limitation, not evidence the code is
broken** — but it is a genuine production risk, because the documented pipeline
runs both `prisma generate` and `next build` **on the VPS**, so a VPS with
restricted egress fails identically at exactly these two steps.

**Confirm on the VPS in ~20 seconds, no changes made:**

```bash
curl -sS -o /dev/null -w 'binaries.prisma.sh  %{http_code}\n' --max-time 10 https://binaries.prisma.sh/
curl -sS -o /dev/null -w 'fonts.googleapis.com %{http_code}\n' --max-time 10 https://fonts.googleapis.com/
```

If either is not `200`/`301`/`403`-with-body, the deploy pipeline is broken
regardless of the code, and the fixes are: self-host the fonts via
`next/font/local`, and pre-cache or vendor the Prisma engines.

### C.4 Tests — ❌ NONE EXIST

```
$ grep -n '"test"' package.json        → no match
$ git ls-files | grep -iE '(jest|vitest|playwright|cypress)\.config|__tests__|\.test\.|\.spec\.'
                                        → no match
```

There is **no test script, no test framework, and no test file** in the
repository. Your section 4 asks me to "check tests" — the verified answer is that
there are none to run. Post-deploy verification therefore has to be the manual
HTTP/API/DB checklist in `03-DEPLOY-ROLLBACK-RUNBOOK.md` §5. I will not report a
test pass that never happened.

### C.5 Lint — NOT RUN

`npm run lint` (`eslint .`) was not executed; with no test baseline and a
build already blocked, lint output would not change any decision. Available on
request.

### C.6 Migrations — ⚠ THERE ARE NONE (schema-push only)

```
$ ls prisma/
schema.prisma            # 14,520 bytes — that is the entire directory
$ ls prisma/migrations
ls: cannot access 'prisma/migrations': No such file or directory
```

- **No `prisma/migrations/` directory, no `migration_lock.toml`, no versioned
  migration history.** Schema is applied with `prisma db push`.
- `package.json` defines: `"db:push": "prisma db push --accept-data-loss"`.
  The destructive flag is **baked into the default script**.
- `deploy.yml` runs `bunx prisma db push` on every push to `main` — i.e. an
  **unattended schema push against the production database on every deploy.**
- `DEPLOYMENT.md` lists the same sequence, and `"db:reset": "prisma migrate
  reset"` is also exposed.

Consequences: there is no schema rollback, no diff review, and `db push` will
drop columns/tables it deems removed. With `--accept-data-loss` it will not even
prompt. **Per your instruction I did not run any migration, and none should be
run without a verified file-level backup of the SQLite DB plus explicit
approval.**

---

## §D — Findings requiring your decision

Ordered by severity. Each is reproducible from the evidence given.

---

### F1 — CRITICAL: the health check is hardcoded and cannot detect a failure

`src/app/api/health/route.ts` returns a **static literal array**. It never
touches the database, the filesystem, or any dependency:

```ts
const checks = [
  { name: "Runtime",          ok: true,  detail: "Next.js 16 + TypeScript" },
  { name: "Database",         ok: true,  detail: "Prisma + SQLite" },      // ← never queried
  { name: "OpenSSL",          ok: true,  detail: "Node crypto available" },
  { name: "FFmpeg",           ok: false, detail: "external_setup_required…" },
  { name: "exec/shell_exec",  ok: false, detail: "disabled in sandbox…" },
  { name: "Sendmail",         ok: false, detail: "external_setup_required…" },
  …
];
const allOk = checks.every((c) => c.ok);
return NextResponse.json({ status: allOk ? "COMPLETE" : "PARTIAL", checks, … });
```

Because `FFmpeg`, `GD/Imagick`, `exec/shell_exec` and `Sendmail` are hardcoded
`ok: false`, the endpoint **always returns `"status":"PARTIAL"`** — including on a
perfectly healthy production box. `DEPLOYMENT.md` even documents that as the
expected answer: *"Expected: `{"status":"PARTIAL","checks":[...]}`"*.

Now combine with the CI step:

```yaml
curl -sf http://localhost:3017/api/health || echo "HEALTH CHECK FAILED"
```

Two compounding defects:

1. `-f` fails only on HTTP ≥ 400. This route always answers **200**. A dead
   database, a broken Prisma client, an empty SQLite file — all still return 200
   with `"Database": ok: true`.
2. `|| echo "…"` **swallows the failure**. The step exits 0 either way, so the
   workflow reports a **green deploy** even when the health check failed.

**Impact:** you have no working signal that a deploy succeeded. A "successful"
GitHub Actions run tells you only that the SSH script ran. This directly
undermines your requirement to *"verify the public website, CRM, login, essential
API routes, database connectivity, and service health"* and to *"not claim
success without evidence"*.

**Needed:** a health route that actually executes `await db.$queryRaw` (or a
`count()` on one table), checks the storage dir is writable, and returns non-200
on failure; and a CI step that fails the job (`curl -sf … || exit 1`). I can
write this — **approval required**, since it changes deployed behaviour.

---

### F2 — CRITICAL: the production commit does not build (fixed, pending approval)

Full detail in **§C.2**. Summary: `next build` fails type checking at
`e95b39b` (`src/app/api/rag/search/route.ts:35,36,39`, TS2339), reproduced under
plain `tsc --noEmit`.

**Why this is deploy-critical, not cosmetic:** `next.config.ts` sets
`output: "standalone"`, and `ecosystem.config.js` starts

```js
script: '.next/standalone/server.js'
```

A build that fails type checking produces **no `.next/standalone` directory**
(confirmed: `ls .next/standalone` → *No such file or directory*). So:

- `pm2 restart alo-learning-journey` would restart a process whose script path
  does not exist;
- CI's fallback `pm2 start "bun run start"` runs
  `bun .next/standalone/server.js` → also missing;
- `deploy.yml` does `git pull` **then** builds, so on a VPS that previously had a
  working build, the pull overwrites source and the failed build can leave the
  live app unable to restart. **This is how a "small" push takes the site down.**

**Status:** fixed and verified on my branch (`tsc --noEmit` → exit 0). **Not
merged, not pushed to `main`, not deployed.** Merging to `main` would trigger
`deploy.yml` against `/home/aloedu/learn-app` — so this must not be merged until
§A.4's path question is answered and a backup exists.

---

### F3 — HIGH: the build depends on two external hosts at build time

`binaries.prisma.sh` (Prisma engines) and `fonts.googleapis.com`
(`next/font/google` for Geist and Geist_Mono). Full detail and the 20-second VPS
check in **§C.3**. Additionally, `src/app/layout.tsx` `<head>` hotlinks a
**runtime** dependency on Google for the Bengali UI font:

```html
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

For a Bengali-language education site, if Google Fonts is slow or blocked for
your users, the primary text font degrades. Self-hosting (`next/font/local`)
removes the build-time failure mode *and* the runtime dependency.

---

### F4 — HIGH: a real SQLite database is committed to a PUBLIC repo, "encrypted" with a key that is also public

`storage/backups/backup_1786236820070.alo.bak` — **266,240 bytes, tracked in
Git, in a repository whose visibility is `public`.**

The repository's own code says the protection is cosmetic
(`src/app/api/backups/route.ts:117-122`):

```ts
// XOR-obfuscate with a marker byte (not real crypto — marker only)
const key = Buffer.from("alo-backup-2024", "utf8");
const out = Buffer.alloc(dbData.length);
for (let i = 0; i < dbData.length; i++) out[i] = dbData[i] ^ key[i % key.length];
```

The key is **hardcoded in the public source**. I decoded the file with it:

```
decoded size : 266240
header ascii : "SQLite format 3\u0000"
is SQLite DB : true
```

It is a **genuine SQLite database**, not a manifest. Row counts:

| Table | Rows | | Table | Rows |
|---|---|---|---|---|
| AnalyticsSnapshot | 315 | | ContentIdea | 4 |
| SocialConnection | **11** | | RagDocument | 4 |
| ApprovalItem | 11 | | PublishedPost | 3 |
| AuditLog | 13 | | TelegramCommand | 3 |
| CommentInbox | 8 | | Notification | 3 |
| ContentPackage | 7 | | Company | 1 |
| | | | AIAgentRun / FamilyModel / RagChunk | 0 |

**Total 383 rows** — matching the manifest's own `totalRows: 383`. The manifest
`backup_1786236820070.json` asserts **`"encrypted": true`. It is not encrypted.**

**Credential scan of the decoded database** (counts only; no value printed at any
point, and the decoded copy was deleted immediately afterwards):

```
Telegram-bot-token shape  [0-9]{6,}:[A-Za-z0-9_-]{30,}   →  0 matches
ghp_ / sk- / xox[baprs]-                                 →  0 matches
"token" keyword hits                                     →  4
```

The 4 `token` hits resolve to a **schema column name** (`"tokenExpiry" DATETIME`)
and one log-style string referencing an Instagram refresh. **No credential leak
is confirmed.** But `SocialConnection` holds **11 rows** and is precisely where
OAuth access/refresh tokens would live — I could not see their contents without
dumping row data, which I did not do.

**Two further problems with this artefact:**

- **It is stale and not a valid restore point.** The DB contains **15 tables**;
  `prisma/schema.prisma` now defines **27 models**. Missing: `Department`,
  `AgentEmployee`, `LoopCycle`, `FamilyProfile`, `FamilyReferenceAsset`,
  `FamilyProject`, `MediaGeneration`, `ContentOpportunityScore`, `HookTest`,
  `Campaign`, `InkboxIntegration`, `AgentMessage` (15 + 12 = 27). Its manifest
  says `createdAt: 2026-08-09T00:53:40Z` with `retentionDays: 14` — **expired
  2026-08-23, three weeks ago.** Do not treat it as a backup.
- **It is operational/business data in public.** Audit log, analytics history,
  approvals, comment inbox, company record. Anyone can
  `curl` the raw file from GitHub and decode it with a key from the same repo.

**Recommended actions (all need your approval; none performed):**

1. Make the repository **private**, or remove the artefact.
2. Removing it from the working tree is **not enough** — it stays in Git history.
   It needs history rewriting (`git filter-repo`) plus a force-push, which is a
   destructive operation on `main` and **I will not do it without explicit
   approval and a mirror backup of the repo first.**
3. Verify on the production DB whether `SocialConnection` ever stored live OAuth
   tokens; if so, **rotate them.**
4. Replace XOR with real encryption (AES-256-GCM via `crypto.scryptSync` +
   `createCipheriv`, key from an env var) or stop committing backups entirely.
5. Add `storage/backups/` to `.gitignore` (see F6).

---

### F5 — HIGH: 39 unauthenticated API routes, several of which destroy data

`SECURITY.md`, verbatim:

```
## Authentication
- Status: NOT_IMPLEMENTED (no auth middleware)
## Known Limitations
- No authentication/RBAC — all API routes are open
- No CSRF protection
- No rate limiting
- Production deployment requires auth middleware before going live
```

The repository's own security document says it must not go live as-is. Corroborating evidence:

- **39 `route.ts` handlers**, no middleware file, no auth guard. `next-auth` is
  a dependency but unused (see §B.3).
- `Caddyfile` adds security *headers* only — no authentication, no IP allowlist.
- Routes performing destructive filesystem/DB operations
  (`unlink`, `rmSync`, `deleteMany`): `api/backups`, `api/family-studio`,
  `api/images/generate`, `api/notifications`, `api/video/generate`,
  `api/video/cinematic`.
- `api/backups` **DELETE** handler:
  `await fs.unlink(path.join(BACKUP_DIR, \`${id}.alo.bak\`))` — an anonymous
  HTTP request can **delete your backups**.
- `api/seed` can rewrite seeded data; `api/settings` and `api/telegram` are open.

**This is a stop-and-ask.** Before `learn.aloeducation.com` is pointed at this
app on a public interface, it needs at minimum an auth layer or a proxy-level
allowlist (Caddy `remote_ip` matcher / basic auth / VPN). I did **not** change
DNS, SSL, firewall, or proxy configuration, per your instruction.

---

### F6 — MEDIUM: `.gitignore` gaps (the cause of F4, plus 19 MB of media)

`.gitignore` **correctly** excludes `.env`, `.env.*` (re-including
`!.env.example`), `*.pem`, `*.key`, `*.crt`, `*.p12`, `*.pfx`, `*.sqlite`,
`*.sqlite3`, `*.db`, `node_modules/`, `.next/`, logs. **Good baseline.**

Gaps:

- **`storage/backups/` is not ignored** → the database in F4 is tracked.
- **`storage/videos/` is not ignored** → **19 generated `.mp4` files, 19 MB**,
  tracked. Largest tracked file in the repo:
  `storage/videos/video_1788962720635.mp4` (**4.5 MB**). Total `storage/` = 20 MB
  of the repo's 10.7 MB packed size — generated media dominates the repository.
- `next-env.d.ts` and `tsconfig.tsbuildinfo` are not ignored; both appeared as
  untracked after my build. I **removed both byproducts** and `.next/`, leaving
  the tree clean.
- Also removed: `package-lock.json`, created by my `npm install`. The project
  standardises on `bun.lock`; leaving a second lockfile invites dependency drift.

**Final working-tree state after all my activity:**

```
$ git status --porcelain=v1 -b
## arena/01a09fef-alo-learning-journey-productio
 M src/app/api/rag/search/route.ts     ← the F2 fix, the only source change
?? audit/                              ← these reports and the two scripts
```

---

### F7 — MEDIUM: no tests at all

See **§C.4**. No `test` script, no framework, no test files. Verification must be
manual.

---

### F8 — MEDIUM: destructive DB script is the default

See **§C.6**. `db:push` = `prisma db push --accept-data-loss`; `db:reset` =
`prisma migrate reset`; CI runs unattended `prisma db push` on every push to
`main`; no migrations directory, so no schema rollback.

---

### F9 — MEDIUM: backup code reads a hardcoded DB path that may not be your real DB

`src/app/api/backups/route.ts:112`:

```ts
const dbPath = path.join(process.cwd(), "db", "custom.db");
```

Prisma, meanwhile, connects via **`DATABASE_URL`**. These are two independent
notions of "the database". If `DATABASE_URL` does not resolve to
`<cwd>/db/custom.db`, then every backup attempt hits the `catch` branch and
silently writes a **manifest-only** file with `status: "partial"` — i.e. **the
backup feature produces no restorable data while appearing to work.**

The committed artefact in F4 *did* contain a full SQLite copy, so at the time it
was created (2026-08-09) the paths agreed. **UNVERIFIED for the current VPS** —
compare `DATABASE_URL`'s file path against `<pm_cwd>/db/custom.db`. The audit
script prints both (path shape only, never the password).

Related: because all storage is `process.cwd()`-relative (§B.3), the backup
directory also moves with PM2's cwd.

---

### F10 — MEDIUM: no atomic release, and no rollback exists

`deploy.yml` deploys **in place**: `cd /home/aloedu/learn-app && git pull &&
bun install && prisma db push && bun run build && pm2 restart`. There is no
`releases/` directory, no symlink swap, no pre-deploy backup, and the live tree
is mutated before the new build is known to work. Given F2 (the build currently
fails) and F8 (an unattended schema push runs *before* the build), a push to
`main` today would: pull new source → push schema changes to production SQLite →
fail the build → leave no `.next/standalone` → leave PM2 unable to restart.
**That is a full outage path, reachable by one `git push`.**

`DEPLOYMENT.md`'s documented rollback is:

```bash
cd /home/aloedu/learn-app
git checkout PREVIOUS_COMMIT_SHA
```

But `git rev-list --count origin/main` = **1**. There is exactly one commit in
history. **There is no previous commit to roll back to.** The documented rollback
procedure cannot work against this repository as it stands.

Rollback must instead be built from: a pre-deploy filesystem snapshot, a
pre-deploy copy of the SQLite file, and the releases/symlink pattern in
`03-DEPLOY-ROLLBACK-RUNBOOK.md`.

---

### F11 — LOW: repo hygiene

- `package.json` `name` is **`nextjs_tailwind_shadcn_ts`**, `version: 0.2.1` —
  still the scaffold identity, not `alo-learning-journey`. PM2 names the app
  `alo-learning-journey` separately. Cosmetic, but confusing when matching
  processes to releases.
- No `engines` field and no `packageManager` field, despite requiring Bun and
  Node 22+ per `DEPLOYMENT.md`. Nothing enforces the runtime version on the VPS.
- Repo is **public** while containing operational data (F4).
- 2 Turbopack build warnings: `src/app/api/family-studio/route.ts:174` and `:242`
  use `path.join(process.cwd(), asset.filePath…)`, causing **the whole project to
  be traced into the standalone output** (larger deploys, possible size-limit
  failures). Non-fatal, worth fixing.

---

## §E — Secret scan results

Scanned all 205 tracked files.

```
$ git ls-files | grep -iE '(^|/)\.env($|\.)|\.pem$|\.key$|\.crt$|\.p12$|\.pfx$|\.sql$|\.sqlite3?$|\.db$|\.alo\.bak$'
storage/backups/backup_1786236820070.alo.bak        ← the only hit; see F4
```

- **No `.env` tracked.** Only `.env.example` (placeholder template, gitignored
  pattern re-included deliberately). No `.env` file exists on disk in this checkout.
- **No private keys, certificates, `.pem`/`.p12`/`.pfx`.**
- Pattern scan across all tracked files for `AKIA…`, `ghp_…`, `github_pat_…`,
  `xox[baprs]-…`, `-----BEGIN … PRIVATE KEY`, and `mysql://`,
  `postgres://`, `mongodb://` DSNs with embedded credentials: **no matches.**
- Hardcoded credential-shaped assignments in `src/**`
  (`(api_key|secret|token|password)\s*[:=]\s*['"]…{12,}['"]`): **no matches.**
- **Remote URL contains no credentials** — plain
  `https://github.com/<owner>/<repo>.git`. Nothing to redact.
- The one exception to "no secrets in Git" is the **obfuscated database** in F4,
  which the pattern scan cannot flag because it is not plaintext. That is exactly
  why I decoded and inspected it.

`SECURITY.md` claims *"No secrets in source code, logs, or ZIP files."* That is
**accurate for credentials** and **inaccurate in spirit** for F4: a real database
of business data is in the repo, and its "encryption" key is public.
