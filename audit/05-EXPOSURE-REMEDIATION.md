# 05 — Public-repo data exposure: remediation plan

You chose **all three, in this order**: (1) make the repo private,
(2) verify whether live OAuth tokens need rotating, (3) purge Git history.

Step 2 is **already complete** — I could do it locally, and the answer changes
the priority of the other two.

---

## Step 2 — DONE: no credential rotation is required

I decoded the committed artefact with the key that is public in
`src/app/api/backups/route.ts` and inspected it **column by column**. Values were
never printed; the decoded copy was deleted immediately afterwards.

**No model in the schema stores a credential.** Grepping all 27 models in
`prisma/schema.prisma` for `token|secret|password|apiKey|api_key|accessToken|refreshToken`
returns exactly **one** field-name match:

```
103:  tokenExpiry  DateTime?
```

That is a timestamp, not a secret.

`SocialConnection` — the table where OAuth tokens would live — has **no token
column at all**:

```
id, platform, accountName, handle, status, scopesJson,
tokenExpiry, lastSyncAt, createdAt, updatedAt
```

Across its 11 rows:

| Column | Non-null | Assessment |
|---|---|---|
| `scopesJson` | **0** | entirely NULL — no scopes, no tokens |
| `tokenExpiry` | 5 | timestamps only |
| `platform` | 11 | enum labels: facebook, gbp, instagram, linkedin, pinterest, telegram, threads, tiktok, whatsapp, x, youtube |
| `status` | 11 | enum labels: `external_setup_required` ×6, `connected` ×5 |
| `accountName` / `handle` | 11 / 1 | account display names |
| `id` | 11 | cuids |

My entropy heuristic initially flagged `id` (25-char cuids) and `status`
(23-char `external_setup_required`) as "secret-shaped". Both are **false
positives** — long enum strings and cuids have high character entropy without
being credentials. Targeted scans for real credential shapes returned **zero**:

```
Telegram bot token   [0-9]{6,}:[A-Za-z0-9_-]{30,}   → 0 matches
ghp_ / sk- / xox[baprs]-                            → 0 matches
Google (ya29./AIza), Meta (EAAG/EAA*), Slack (xox)  → 0 matches
```

**Conclusion: nothing to rotate.** The `connected` statuses are aspirational
labels — with `scopesJson` NULL and no token column, no live credential was ever
persisted here. This is corroborated by `PRODUCTION_README.md`, which lists
social publishing and metrics under *"Blocked External Setup (needs
credentials)"*.

> One caveat, honestly stated: this proves the **August snapshot** held no
> tokens, and that the **current schema** has nowhere to put one. If anyone later
> adds a token column, re-run this check.

**So step 1 and step 3 are about business-data confidentiality, not credential
compromise.** That lowers the urgency from "rotate everything tonight" to
"stop publishing our analytics, audit log and content pipeline" — still worth
doing, but it is not an active credential incident.

What *was* public: 383 rows including `AnalyticsSnapshot` (315), `AuditLog` (13),
`ApprovalItem` (11), `CommentInbox` (8), `ContentPackage` (7), `ContentIdea` (4),
`RagDocument` (4), `PublishedPost` (3), `TelegramCommand` (3), `Notification` (3),
`Company` (1).

---

## Step 1 — Make the repository private

### ⚠ Blocked right now: GitHub authentication is failing in this session

Partway through this session, GitHub access broke:

```
$ gh api repos/alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION
{"message":"Bad credentials","status":"401"}

$ git push origin arena/01a09fef-alo-learning-journey-productio
remote: Invalid username or token. Password authentication is not supported for Git operations.
fatal: Authentication failed
```

Even unauthenticated `curl` to `api.github.com` returns `Bad credentials`, which
means the sandbox proxy is injecting a token that has expired or been revoked.
**This needs attention on your side — please reconnect GitHub in Arena.** Earlier
in the session the same calls succeeded, and all the GitHub evidence in
`02-VERIFIED-FINDINGS.md` §A was captured while they worked.

Consequence for you: **my work is committed locally but could not be pushed.**
Nothing of mine reached the remote — both push attempts failed before any ref was
updated, and `main` is untouched at `e95b39b`, so **no deployment was
triggered**. The files are preserved in this workspace and in the commit
`90aff59` on branch `arena/01a09fef-alo-learning-journey-productio`.

### I did not change the repo's visibility, and would not without you doing it

Making a repository private is an account-level change with side effects (it
breaks any existing clone/pull for collaborators and CI keys, and GitHub Pages
stops serving). It is your call to execute:

```bash
# via CLI
gh repo edit alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION --visibility private --accept-visibility-change-consequences
```

or in the web UI: **Settings → General → Danger Zone → Change repository
visibility**.

**Do this first.** It is the only step that immediately stops the public
download, and it is instant and reversible. Note that it does **not** remove
anything from history, and anyone who already cloned or forked the public repo
keeps their copy — which is why step 3 still matters.

Also check for forks while you are there:
```bash
gh api repos/alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION --jq '{forks_count, network_count, subscribers_count}'
```
A fork of a public repo **stays public** after you privatise the parent. If
`forks_count` is non-zero, contact GitHub Support to have forks of a now-private
repo detached/removed.

---

## Step 3 — Purge Git history

### What I already did (safe, reversible, on my branch only)

- `git rm --cached` + deleted from the working tree:
  `storage/backups/backup_1786236820070.alo.bak` (266,240 bytes — the SQLite
  database) and `storage/backups/backup_1786236820070.json` (its manifest).
  Verified: `git ls-files | grep storage/backups` → **none tracked**.
- Added `storage/backups/`, `storage/videos/`, `storage/scene-assets/`,
  `next-env.d.ts`, `*.tsbuildinfo`, `.backups/`, `.releases/` to `.gitignore`,
  and verified with `git check-ignore` that a new `.alo.bak` is now excluded.
- Corrected `SECURITY.md`, which previously claimed backups were fine and that
  there were "no secrets in … ZIP files".

**This is not enough on its own.** Removing a file from the working tree leaves it
in every earlier commit. Because `main` has exactly one commit (`e95b39b`), that
commit still contains the database, and anyone can fetch it:

```
https://raw.githubusercontent.com/alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION/main/storage/backups/backup_1786236820070.alo.bak
```

Only a history rewrite removes it.

### Why I did not run the rewrite

It requires a **force-push to `main`**, which is explicitly on your do-not-do
list without approval, and GitHub auth is currently failing anyway. It also has a
trap worth flagging:

> **A force-push to `main` triggers `.github/workflows/deploy.yml`.** So the
> history rewrite would simultaneously fire an SSH deploy at
> `/home/aloedu/learn-app`. Disable the workflow first.

### Exact procedure, when you approve it

```bash
# 0. Install the tool (git filter-branch is deprecated and slow; use filter-repo)
pip install git-filter-repo        # or: brew install git-filter-repo

# 1. MIRROR BACKUP FIRST. A rewrite is irreversible; keep a pristine copy.
git clone --mirror https://github.com/alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION.git \
    /root/alo-repo-mirror-$(date -u +%Y%m%d-%H%M%SZ).git
ls -la /root/alo-repo-mirror-*.git        # confirm it exists and is non-trivial

# 2. STOP THE DEPLOY WORKFLOW so the force-push cannot deploy mid-rewrite
gh workflow disable "Deploy to VPS" \
  -R alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION

# 3. Work on a throwaway clone, never your live checkout
cd /tmp && git clone <repo-url> rewrite && cd rewrite

# 4. See exactly what will be removed
git filter-repo --analyze
cat filter-repo/analysis/path-all-sizes.txt | grep -iE 'alo\.bak|storage/backups'

# 5. Purge the paths from ALL history
git filter-repo --invert-paths \
  --path storage/backups/backup_1786236820070.alo.bak \
  --path storage/backups/backup_1786236820070.json
#    or, to drop the whole directory across history:
#    git filter-repo --invert-paths --path storage/backups/

# 6. Consider also dropping the 19 MB of generated media (ONLY after confirming
#    nothing references those paths — MediaGeneration / PublishedPost rows may)
# git filter-repo --invert-paths --path storage/videos/ --path storage/scene-assets/

# 7. VERIFY the artefact is gone from every commit before pushing anything
git log --all --oneline | wc -l
for c in $(git rev-list --all); do
  git ls-tree -r --name-only "$c" | grep -q 'storage/backups/.*\.alo\.bak' \
    && echo "STILL PRESENT in $c"
done
echo "verification complete (no output above = clean)"

# 8. Force-push (filter-repo removes the origin remote by design; re-add it)
git remote add origin <repo-url>
git push --force --all origin
git push --force --tags origin

# 9. Ask GitHub to expire the cached raw/blob views and GC
#    Settings → contact support, or:
gh api -X POST repos/alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION/gc \
  2>/dev/null || echo "GC is not self-service; contact GitHub Support to purge cached views"

# 10. Re-enable the workflow only once the tree is confirmed good
gh workflow enable "Deploy to VPS" -R alaminiubateee969-cmd/ALO-LEARNING-JOURNEY-PRODUCTION
```

**After a rewrite, every existing clone is stale and must be re-cloned.** Anyone
who pulls normally will get conflicts. Since the VPS directories may hold clones
of this repo (unverified — see `01-ACCESS-BLOCKER.md` Q1), re-clone them rather
than pulling.

---

## Step 4 (not requested, but it prevents recurrence)

The root cause is that the backup code invents a file format that *looks*
encrypted and isn't. Two small changes close it permanently:

1. **Real encryption** in `src/app/api/backups/route.ts`, replacing the XOR loop:
   ```ts
   import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
   const key = scryptSync(process.env.BACKUP_KEY!, randomBytes(16), 32); // key from env, never in source
   // AES-256-GCM, with the IV and auth tag stored alongside the ciphertext
   ```
   and set `"encrypted"` in the manifest from whether a key was actually
   configured — so it can never claim encryption it did not perform.
2. **Fail closed**: if `BACKUP_KEY` is unset, refuse to write a backup rather
   than silently write an obfuscated one.

I have **not** made these changes — they alter backup format and would invalidate
existing `.alo.bak` restores, so they need your approval and a migration decision
first. Say the word and I will implement them on the branch.
